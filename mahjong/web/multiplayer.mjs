const STORAGE='h-mahjong-room-v1';
export const API_ORIGIN=['127.0.0.1','localhost'].includes(location.hostname)?'http://127.0.0.1:8790':'https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site';
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export class RoomClient{
 constructor({onState,onStatus}){this.onState=onState;this.onStatus=onStatus;this.session=null;this.snapshot=null;this.timer=null;this.generation=0;this.connected=false;this.failures=0;}
 saved(){try{return JSON.parse(sessionStorage.getItem(STORAGE));}catch{return null;}}
 remember(){try{sessionStorage.setItem(STORAGE,JSON.stringify(this.session));}catch{}}
 stop(){this.generation++;clearTimeout(this.timer);this.timer=null;this.connected=false;}
 async request(path,body,session=this.session){
  const headers={Authorization:'Bearer '+session.key};if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{response=await fetch(API_ORIGIN+'/api/'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});}
  catch{throw new Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.');}
  let data;try{data=await response.json();}catch{throw new Error('대국 서버를 준비 중입니다. 잠시 후 다시 시도하세요.');}
  if(!response.ok){const error=new Error(data.error??'요청을 처리하지 못했습니다.');error.status=response.status;throw error;}
  return data;
 }
 accept(data){
  if(this.snapshot?.code===data.code&&data.revision<this.snapshot.revision)return;
  const changed=!this.connected||!this.snapshot||this.snapshot.code!==data.code||this.snapshot.revision!==data.revision;
  this.snapshot=data;this.connected=true;this.failures=0;this.onStatus('연결됨');if(changed)this.onState(data);
 }
 async connect(name,code){
  this.stop();const generation=this.generation;
  const saved=this.saved();this.session={key:saved?.key??key(),name,code:code??null};this.snapshot=null;this.onStatus('방에 연결 중…');
  const data=await this.request(code?`rooms/${code}/join`:'rooms',{name});
  if(generation!==this.generation)return;
  this.session.code=data.code;this.remember();this.accept(data);this.poll(generation);return data;
 }
 async resume(){
  const saved=this.saved();if(!saved?.code||!saved?.key)return false;
  this.stop();this.session=saved;this.snapshot=null;const generation=this.generation;
  const data=await this.request(`rooms/${saved.code}/state`);if(generation!==this.generation)return false;
  this.accept(data);this.poll(generation);return true;
 }
 poll(generation=this.generation){
  clearTimeout(this.timer);this.timer=setTimeout(async()=>{
   if(generation!==this.generation)return;
   try{const data=await this.request(`rooms/${this.session.code}/state`);if(generation!==this.generation)return;this.accept(data);}
   catch(error){if(generation!==this.generation)return;this.connected=false;this.failures++;this.onStatus(error.status===404?'방이 만료되었습니다. 새 방을 만들어 주세요.':'연결 복구 중… 내 선택은 연결 후 할 수 있습니다.');if([401,403,404].includes(error.status))return;}
   this.poll(generation);
  },this.failures?Math.min(8000,1000*2**this.failures):350);
 }
 async act(action){
  if(!this.connected||!this.snapshot?.state)throw new Error('서버 연결을 기다려 주세요.');
  const generation=this.generation,body={decisionId:this.snapshot.decisionId,actionId:crypto.randomUUID(),action};
  try{const data=await this.request(`rooms/${this.session.code}/action`,body);if(generation===this.generation)this.accept(data);return data;}
  catch(error){if(generation===this.generation){try{this.accept(await this.request(`rooms/${this.session.code}/state`));}catch{this.connected=false;}}throw error;}
 }
 async rematch(){const generation=this.generation,data=await this.request(`rooms/${this.session.code}/rematch`,{gameNumber:this.snapshot.gameNumber});if(generation===this.generation)this.accept(data);}
}
