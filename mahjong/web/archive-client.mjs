import {compactLog} from './game-log.mjs';
export const archiveOrigin=()=>['localhost','127.0.0.1'].includes(globalThis.location?.hostname)?'http://127.0.0.1:8790':'https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site';
const TOKEN='mahjong-archive-device-v1',OUTBOX='mahjong-archive-outbox-v1:',ACK='mahjong-archive-ack-v1:';
const stamp=log=>[log.actions.length,log.observations.at(-1)?.revision??0,log.errors.length,log.game.events.length,log.game.end??''].join(':');
export class ArchiveClient{
 constructor({storage=null,fetcher=(...args)=>globalThis.fetch(...args),origin=archiveOrigin(),onStatus=()=>{},setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}={}){
  Object.assign(this,{storage,fetcher,origin,onStatus,setTimer,clearTimer});this.pending=new Map();this.acks=new Map();this.busy=false;this.timer=null;this.failures=0;this.blocked=new Set();this.stopped=false;
  try{this.token=storage?.getItem(TOKEN);}catch{}
  if(!/^[0-9a-f]{64}$/.test(this.token??'')){this.token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');try{storage?.setItem(TOKEN,this.token);}catch{}}
  try{for(let i=0;i<(storage?.length??0);i++){const key=storage.key(i);if(key?.startsWith(OUTBOX)){const log=JSON.parse(storage.getItem(key));if(log?.format==='wellness-mahjong-log/v2')this.pending.set(log.id,{log,stamp:stamp(log)});}}}catch{}
  this.schedule();
 }
 enqueue(log){
  if(!log)return;const version=stamp(log);let ack=this.acks.get(log.id);try{ack??=this.storage?.getItem(ACK+log.id);}catch{}
  if(ack===version){this.onStatus({id:log.id,state:'saved'});return;}if(this.pending.get(log.id)?.stamp===version)return;
  this.pending.set(log.id,{log,stamp:version});this.blocked.delete(log.id);this.onStatus({id:log.id,state:'waiting'});this.schedule();
 }
 schedule(delay=2000){if(this.stopped||this.timer!==null||this.busy||![...this.pending.keys()].some(id=>!this.blocked.has(id)))return;this.timer=this.setTimer(()=>{this.timer=null;void this.flush();},delay);}
 async flush({keepalive=false}={}){
  if(this.busy||this.stopped)return;
  if(this.timer!==null){this.clearTimer(this.timer);this.timer=null;}
  const next=[...this.pending].find(([id])=>!this.blocked.has(id));if(!next)return;
  const [id,item]=next;this.busy=true;
  try{
   const log=compactLog(item.log),version=stamp(log);item.stamp=version;
   const text=JSON.stringify(log);try{this.storage?.setItem(OUTBOX+id,text);}catch{}
   let body=text;const headers={Authorization:'Bearer '+this.token,'Content-Type':'application/json'};
   if(typeof CompressionStream!=='undefined'){body=new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());headers['Content-Type']='application/octet-stream';headers['X-Mahjong-Log-Encoding']='gzip';}
   this.onStatus({id,state:'uploading'});
   const response=await this.fetcher(this.origin+'/api/archives',{method:'POST',headers,body,signal:AbortSignal.timeout(12000),keepalive:keepalive&&(typeof body==='string'?new TextEncoder().encode(body).length:body.length)<60000});
   const result=await response.json();if(!response.ok){const error=new Error(result.error??'서버 저장 실패');error.status=response.status;throw error;}
   if(result.id!==id||!result.saved)throw new Error('서버 저장 확인을 받지 못했습니다.');
   this.acks.set(id,version);try{this.storage?.setItem(ACK+id,version);this.storage?.removeItem(OUTBOX+id);}catch{}
   if(this.pending.get(id)?.stamp===version)this.pending.delete(id);
   this.failures=0;this.onStatus({id,state:'saved'});
  }catch(error){
   this.failures++;if(error.status&&error.status<500&&![408,409,429].includes(error.status))this.blocked.add(id);
   this.onStatus({id,state:'error',message:this.blocked.has(id)?'서버 저장 실패 · JSON 파일로 저장해 주세요.':'연결되면 자동 재시도 · 기기 기록 유지',error:String(error.message)});
  }finally{this.busy=false;this.schedule(this.failures?Math.min(30000,2000*2**Math.min(this.failures,4)):250);}
 }
 retry(){this.blocked.clear();this.failures=0;void this.flush();}
 stop(){this.stopped=true;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
}
// Server archiving is optional: a transport/UI callback failure must not stop play.
export function archiveTask(action,onError=()=>{}){
 const failed=error=>{try{onError(error);}catch{}};
 try{const result=action();return result?.catch?result.catch(failed):result;}catch(error){failed(error);}
}
