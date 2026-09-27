import { createHash } from 'node:crypto';
export const gbp = n => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(n||0));
export const daysBetween = (a,b) => Math.floor((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);
export const daysLate = (expected,today) => expected ? Math.max(0,daysBetween(expected,today)) : 0;
export const daysUntil = (date,today) => date ? daysBetween(today,date) : null;
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
const clean = s => String(s??'').trim();
export const lower = s => clean(s).toLowerCase();
export const clamp = (n,min,max)=>Math.min(max,Math.max(min,n));
export function evidence(entityType,entityId,label,path,value){ return { id:`EV-${entityType}-${entityId}-${path}`.replace(/[^A-Za-z0-9_-]/g,'_'), entityType, entityId, label, path, value:String(value) }; }
export function dedupeEvidence(items){ const m=new Map(); for(const x of items||[]) if(x?.id&&!m.has(x.id)) m.set(x.id,x); return [...m.values()]; }
