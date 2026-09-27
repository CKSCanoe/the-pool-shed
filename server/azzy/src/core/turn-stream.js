const turns=new Map();
const MAX_TURNS=120;
const TURN_TTL_MS=15*60*1000;

const now=()=>Date.now();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function cleanup(){
  const cutoff=now()-TURN_TTL_MS;
  for(const [id,turn] of turns){
    if(turn.updatedAt<cutoff&&turn.status!=='running')turns.delete(id);
  }
  if(turns.size<=MAX_TURNS)return;
  const removable=[...turns.values()].filter(x=>x.status!=='running').sort((a,b)=>a.updatedAt-b.updatedAt);
  while(turns.size>MAX_TURNS&&removable.length)turns.delete(removable.shift().id);
}

function normaliseId(id){
  const value=String(id||'').trim();
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(value))throw new Error('Invalid turn id.');
  return value;
}

function push(turn,event){
  const row={seq:turn.events.length+1,...event};
  turn.events.push(row);
  turn.updatedAt=now();
  return row;
}

export function getOrCreateTurn({id,userId,producer}){
  cleanup();
  id=normaliseId(id);
  const existing=turns.get(id);
  if(existing){
    if(existing.userId!==userId)throw new Error('Turn does not belong to this user.');
    return existing;
  }
  const turn={id,userId,status:'running',events:[],createdAt:now(),updatedAt:now(),error:null,promise:null};
  turns.set(id,turn);
  turn.promise=(async()=>{
    try{
      await producer(event=>push(turn,event));
      if(turn.status==='running')turn.status='done';
    }catch(error){
      turn.error=error?.message||'Azzy could not finish that response.';
      push(turn,{type:'error',error:turn.error});
      turn.status='error';
    }finally{
      turn.updatedAt=now();
      cleanup();
    }
  })();
  return turn;
}

export function turnSnapshot(id,userId,{after=0}={}){
  cleanup();
  id=normaliseId(id);
  const turn=turns.get(id);
  if(!turn)return null;
  if(turn.userId!==userId)return {forbidden:true};
  const cursor=Math.max(0,Number(after)||0);
  return {id:turn.id,status:turn.status,events:turn.events.filter(x=>x.seq>cursor),lastSeq:turn.events.at(-1)?.seq||0,error:turn.error,updatedAt:new Date(turn.updatedAt).toISOString()};
}

export async function pipeTurn(res,turn,{after=0}={}){
  let cursor=Math.max(0,Number(after)||0),lastWrite=now();
  while(!res.destroyed){
    const pending=turn.events.filter(x=>x.seq>cursor);
    for(const event of pending){
      if(res.destroyed)return;
      res.write(JSON.stringify(event)+'\n');
      cursor=event.seq;
      lastWrite=now();
    }
    if(turn.status!=='running'&&cursor>=(turn.events.at(-1)?.seq||0))break;
    if(now()-lastWrite>2500){
      res.write('\n');
      lastWrite=now();
    }
    await sleep(25);
  }
  if(!res.destroyed)res.end();
}
