-- Requires 001 and 002. All invoice queues use the same lock and project cap rules.
begin;
create or replace function public.ps_finance_enqueue(w text, actor uuid, doc uuid, source text, kind_value text, invoice jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid; snapshot jsonb; project_job jsonb; project jsonb; phase jsonb; linked_order jsonb;
 contract numeric; requested numeric; reserved numeric; planned numeric;
begin
 if not exists(select 1 from ps_finance_members where workspace_id=w and user_id=actor and role in ('admin','accountant')) then raise exception 'Access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(w||':finance',0));
 select id into existing from ps_finance_documents where workspace_id=w and source_id=source and kind=kind_value;
 if existing is not null then return existing; end if;
 select data into snapshot from workspace_snapshots where workspace_id=w;
 if source like 'PROJECT:%' then
  select j into project_job from jsonb_array_elements(coalesce(snapshot->'jobs','[]'::jsonb)) j
   where exists(select 1 from jsonb_array_elements(coalesce(j->'project'->'phases','[]'::jsonb)) ph where source='PROJECT:'||(j->>'id')||':'||(ph->>'id'));
  if project_job is null or kind_value<>'ACCREC' then raise exception 'Project stage not found in shared workspace'; end if;
  project=project_job->'project';
  select ph into phase from jsonb_array_elements(project->'phases') ph where source='PROJECT:'||(project_job->>'id')||':'||(ph->>'id');
  if coalesce((project->>'quoteAccepted')::boolean,false)=false or coalesce((phase->>'ready')::boolean,false)=false or coalesce(phase->>'agreement','')='' then raise exception 'Accepted quote and agreed completed stage required'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(project->'tasks','[]'::jsonb)) t where t->>'phaseId'=phase->>'id' and t->>'status'<>'Done') then raise exception 'Stage tasks remain incomplete'; end if;
  if coalesce(phase->>'dependencyId','')<>'' and not exists(select 1 from jsonb_array_elements(project->'phases') p where p->>'id'=phase->>'dependencyId' and (p->>'ready')::boolean) then raise exception 'Preceding stage is incomplete'; end if;
  contract=round((project->>'quoteNet')::numeric*100);
  select contract+coalesce(sum(round((v->>'sellNet')::numeric*100)),0) into contract from jsonb_array_elements(coalesce(project->'variations','[]'::jsonb)) v where v->>'status'='Approved';
  select coalesce(sum(round((ph->>'amountNet')::numeric*100)),0) into planned from jsonb_array_elements(project->'phases') ph;
  select sum(round((l->>'Quantity')::numeric*(l->>'UnitAmount')::numeric*100)) into requested from jsonb_array_elements(invoice->'LineItems') l;
  if requested is null or requested<=0 or requested<>round((phase->>'amountNet')::numeric*100) or planned>contract or invoice->>'CurrencyCode'<>'GBP' then raise exception 'Invoice amount differs from agreed project stage'; end if;
  if exists(select 1 from ps_finance_documents d,jsonb_array_elements(coalesce(snapshot->'salesOrders','[]'::jsonb)) o where d.workspace_id=w and d.kind='ACCREC' and d.source_id=o->>'id' and o->>'jobId'=project_job->>'id' and d.status not in ('VOIDED','DELETED')) then raise exception 'A linked order already has an invoice. Reconcile existing billing before phase billing'; end if;
  select coalesce(sum(round((l->>'Quantity')::numeric*(l->>'UnitAmount')::numeric*100)),0) into reserved
   from ps_finance_documents d cross join lateral jsonb_array_elements(d.payload->'LineItems') l
   where d.workspace_id=w and d.kind='ACCREC' and d.status not in ('VOIDED','DELETED') and starts_with(d.source_id,'PROJECT:'||(project_job->>'id')||':');
  if reserved+requested>contract then raise exception 'Project billing would exceed the agreed contract'; end if;
 else
  select o into linked_order from jsonb_array_elements(coalesce(snapshot->'salesOrders','[]'::jsonb)) o where o->>'id'=source;
  if kind_value='ACCREC' and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'jobs','[]'::jsonb)) j where j->>'id'=linked_order->>'jobId' and j->'project'->>'billingMode'='phases') then raise exception 'Use project phase billing for this order'; end if;
 end if;
 insert into ps_finance_documents(id,workspace_id,source_id,kind,payload,created_by) values(doc,w,source,kind_value,invoice,actor);
 insert into ps_finance_jobs(id,workspace_id,document_id) values(doc,w,doc);
 insert into ps_finance_audit(workspace_id,actor,action,detail) values(w,actor::text,'queue_requested',jsonb_build_object('document',doc,'source',source));
 return doc;
end $$;
revoke all on function public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.ps_finance_enqueue(text,uuid,uuid,text,text,jsonb) to service_role;
commit;
