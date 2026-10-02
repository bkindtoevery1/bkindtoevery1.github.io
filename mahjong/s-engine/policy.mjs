import {counts,isYao} from '../engine/tiles.mjs';
import {shanten} from '../engine/shanten.mjs';
import {policyConfig} from '../policies/index.mjs';
import {ORPHANS,doraAfter} from './score.mjs';

const distance=(c,m,rules)=>Math.min(shanten(c,m),!m&&rules.standardYakuman?13-ORPHANS.filter(t=>c[t]).length-Number(ORPHANS.some(t=>c[t]>=2)):8);
function metrics(c,melds,o,w,discard=null){
  const s=distance(c,melds.length,o.rules);let ukeire=0;
  for(let t=0;t<34;t++)if(c[t]<4&&o.visible[t]<4){c[t]++;if(distance(c,melds.length,o.rules)<s)ukeire+=4-o.visible[t];c[t]--;}
  const closed=melds.every(m=>!m.open),all=[...c];for(const m of melds)for(const t of m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile))all[t]++;
  let value=closed?100:0,connections=0;
  for(let t=0;t<27;t++){if(t%9<8)connections+=Math.min(c[t],c[t+1]);if(t%9<7)connections+=.35*Math.min(c[t],c[t+2]);}
  for(let t=27;t<34;t++)if(t>=31||t===o.rules.roundWind||t===27+(o.seat-o.dealer+4)%4)value+=(all[t]>=3?200:all[t]===2?75:0);
  value+=(o.doraIndicators??[]).reduce((n,t)=>n+all[doraAfter(t)]*100,0);
  const size=all.reduce((a,b)=>a+b,0),simple=all.reduce((n,count,t)=>n+(!isYao(t)?count:0),0);value+=100*(simple/size)**5;
  for(let suit=0;suit<3;suit++)value=Math.max(value,600*(all.slice(suit*9,suit*9+9).reduce((a,b)=>a+b,0)/size)**5);
  const pinfu=closed?connections/4-c.filter(n=>n>=3).length*.3:0;
  let risk=0;if(discard!==null)for(const p of o.players)if(p.seat!==o.seat&&!p.discards.some(d=>d.tile===discard))risk+=(p.riichi?3:.2+Math.min(1,p.discards.length/16))*(4-o.visible[discard])/4*(discard>=27?.45:1);
  return {shanten:s,ukeire,value,pinfu,risk,score:-w.speed*s+w.ukeire*ukeire+w.value*value+w.pinfu*pinfu-w.risk*risk};
}
function bestDiscard(c,melds,o,w,allowed){const rows=[];for(let t=0;t<34;t++)if(c[t]&&(!allowed||allowed.includes(t))){c[t]--;rows.push({type:'discard',tile:t,...metrics(c,melds,o,w,t)});c[t]++;}const min=Math.min(...rows.map(r=>r.shanten));return rows.filter(r=>r.shanten<=min+w.maxShantenLoss).sort((a,b)=>b.score-a.score)[0];}
export function evaluateDiscards(o,id='E',weights={}){const c=counts(o.hand),w=policyConfig(id,weights);return o.legalActions.filter(a=>a.type==='discard').map(a=>{c[a.tile]--;const m=metrics(c,o.melds,o,w,a.tile);c[a.tile]++;return {...a,...m};}).sort((a,b)=>b.score-a.score);}
export function chooseAction(o,id='E',weights={}){
  const as=o.legalActions,w=policyConfig(id,weights),find=t=>as.find(a=>a.type===t);if(!as.length)throw new Error('No legal action');
  if(find('tsumo'))return find('tsumo');if(find('ron'))return w.declineRon?find('pass'):find('ron');if(as.length===1)return as[0];
  const c=counts(o.hand);
  if(o.phase==='turn'){
    const d=bestDiscard(c,o.melds,o,w,as.filter(a=>a.type==='discard').map(a=>a.tile));let chosen={type:'discard',tile:d.tile},best=d.score;
    for(const a of as.filter(a=>a.type==='ankan'||a.type==='kakan')){const cc=[...c],mm=structuredClone(o.melds);if(a.type==='ankan'){cc[a.tile]-=4;mm.push({type:'kan',tile:a.tile,open:false});}else{cc[mm[a.meld].tile]--;mm[a.meld].type='kan';}const m=metrics(cc,mm,o,w);if(m.shanten<=d.shanten&&m.score+3>best){best=m.score+3;chosen=a;}}
    if(chosen.type==='discard'){const riichi=as.find(a=>a.type==='riichi'&&a.tile===chosen.tile);if(riichi&&!(id==='E'&&d.risk>3))return riichi;}return chosen;
  }
  let chosen=find('pass'),base=metrics(c,o.melds,o,w),best=base.score;
  for(const a of as.filter(a=>['chi','pon','minkan'].includes(a.type))){
    const cc=[...c],mm=structuredClone(o.melds),t=o.lastDiscard.tile;
    for(const tile of a.type==='chi'?[a.tile,a.tile+1,a.tile+2].filter(x=>x!==t):Array(a.type==='minkan'?3:2).fill(t))cc[tile]--;
    mm.push({type:a.type==='chi'?'chi':a.type==='pon'?'pon':'kan',tile:a.tile,open:true});
    // Require a plausible open yaku before sacrificing menzen. No H no-yaku win.
    const openValue=mm.some(m=>m.type!=='chi'&&(m.tile>=31||m.tile===o.rules.roundWind||m.tile===27+(o.seat-o.dealer+4)%4));
    const simple=o.hand.every(t=>!isYao(t))&&!isYao(t);
    const flush=new Set([...o.hand,...mm.map(m=>m.tile)].filter(t=>t<27).map(t=>Math.floor(t/9))).size===1;
    const triplets=mm.every(m=>m.type!=='chi')&&cc.filter(n=>n>=2).length+mm.length>=4;
    if(!openValue&&!simple&&!flush&&!triplets)continue;
    const m=a.type==='minkan'?metrics(cc,mm,o,w):bestDiscard(cc,mm,o,w,o.rules.allowKuikae?null:Array.from({length:34},(_,i)=>i).filter(i=>i!==t));
    if(m&&m.shanten<=base.shanten+w.maxShantenLoss&&m.score-w.callCost>best){chosen=a;best=m.score-w.callCost;}
  }
  return chosen;
}
