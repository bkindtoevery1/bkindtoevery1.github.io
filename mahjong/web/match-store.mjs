import {compactLog,expandLog} from './game-log.mjs';
import {assertMatch,matchSummary} from '../s-engine/match.mjs';
const KEY='wellness-s-match-v1';
const clone=x=>structuredClone(x);
export class MatchStore{
 constructor(storage=null){this.storage=storage;this.persisted=false;this.error=null;this.data=null;}
 read(){
  if(this.data)return this.data;
  try{const raw=this.storage?.getItem(KEY),data=raw?JSON.parse(raw):{version:1,resume:false,active:null,history:[]};if(data?.version!==1||!Array.isArray(data.history))throw new Error('invalid format');this.data=data;return data;}
  catch{this.error='저장된 반장을 읽지 못했습니다. 기존 저장 데이터는 유지했습니다.';return null;}
 }
 save({match,seat,log,policy,profile}){
  const data=this.read();if(!data)return false;
  if(data.active?.match.id!==match.id&&data.active){const old=data.active;data.history.unshift({seat:old.seat,summary:matchSummary(old.match,expandLog(old.log).game)});data.history=data.history.slice(0,9);}
  data.active={match:clone(match),seat,policy,profile,log:compactLog(log)};data.resume=true;return this.write();
 }
 write(){this.persisted=false;try{if(!this.storage)return false;this.storage.setItem(KEY,JSON.stringify(this.data));this.persisted=true;this.error=null;return true;}catch{this.error='반장 자동 저장 공간이 부족합니다. 점수표와 현재 로그를 파일로 저장해 주세요.';return false;}}
 setResume(enabled){const data=this.read();if(!data)return;data.resume=!!enabled;this.write();}
 saveSummary(summary,{seat}){
  const data=this.read();if(!data)return false;
  const entry={seat,summary:clone(summary)},previous=data.history.find(x=>x.summary.id===summary.id);
  if(JSON.stringify(previous)===JSON.stringify(entry))return this.persisted;
  data.history=[entry,...data.history.filter(x=>x.summary.id!==summary.id)].slice(0,data.active?9:10);return this.write();
 }
 restore({force=false}={}){
  const data=this.read();if(!data?.active||!force&&!data.resume)return null;
  try{const saved=clone(data.active),log=expandLog(saved.log);if(!Number.isInteger(saved.seat)||saved.seat<0||saved.seat>3||log.humanSeat!==saved.seat)throw new Error('Invalid saved seat');assertMatch(saved.match,log.game);saved.log=log;return saved;}
  catch{this.error='저장된 반장의 점수 또는 패 상태가 맞지 않습니다. 기존 기록은 유지했습니다.';return null;}
 }
 list(){const data=this.read();if(!data)return [];try{const active=data.active;return [...active?[{seat:active.seat,summary:matchSummary(active.match,expandLog(active.log).game)}]:[],...data.history];}catch{this.error='저장된 반장 점수표를 읽지 못했습니다. 기존 기록은 유지했습니다.';return [];}}
}
export function matchCSV(summary,names=['시작 동','시작 남','시작 서','시작 북']){
 const cell=value=>'"'+String(value??'').replaceAll('"','""')+'"',rows=[['국','결과',...names.map(n=>n+' 증감'),...names.map(n=>n+' 누적'),'공탁']];
 for(const r of summary.rounds)rows.push([r.label,r.result==='win'?'화료':'유국',...r.delta,...r.totals,r.pot]);
 for(const t of summary.finalTransfers){const delta=[0,0,0,0];delta[t.to]=t.amount;rows.push(['종료 공탁 지급',names[t.to],...delta,...summary.totals,summary.pot]);}
 rows.push([summary.status==='complete'?'최종':'현재',summary.label,'','','','',...summary.totals,summary.pot]);
 rows.push([summary.status==='complete'?'최종 순위':'현재 순위','동점 공동 순위','','','','',...[0,1,2,3].map(seat=>summary.rankings.find(r=>r.seat===seat).rank),'']);
 return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
