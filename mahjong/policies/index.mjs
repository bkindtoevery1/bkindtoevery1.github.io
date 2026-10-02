import {counts,isYao} from '../engine/tiles.mjs';
import {shanten,effectiveTiles} from '../engine/shanten.mjs';
import {scoreHand} from '../engine/score.mjs';

export const POLICIES = Object.freeze({
  A:{name:'최속 화료 · 론 수락',speed:1000,ukeire:1,value:0,pinfu:0,risk:0,maxShantenLoss:0,callCost:0.2,declineRon:false},
  B:{name:'핑후 우선 · 론 수락',speed:65,ukeire:1,value:0,pinfu:24,risk:0,maxShantenLoss:1,callCost:0.2,declineRon:false},
  C:{name:'핑후 우선 · 론 거절',speed:65,ukeire:1,value:0,pinfu:24,risk:0,maxShantenLoss:1,callCost:0.2,declineRon:true},
  D:{name:'고득점 지향',speed:38,ukeire:0.7,value:0.11,pinfu:0,risk:0,maxShantenLoss:1,callCost:0.2,declineRon:false},
  E:{name:'균형형',speed:65,ukeire:1,value:0.045,pinfu:3,risk:18,maxShantenLoss:1,callCost:0.5,declineRon:false}
});
export const OPPONENT_PROFILES=Object.freeze({
  speed:[{id:'A'},{id:'A'},{id:'A'}],
  pinfu:[{id:'B'},{id:'B'},{id:'B'}],
  value:[{id:'D'},{id:'D'},{id:'D'}],
  cautious:[{id:'E',weights:{risk:45}},{id:'E',weights:{risk:45}},{id:'E',weights:{risk:45}}],
  mixed:[{id:'A'},{id:'D'},{id:'E'}]
});
export function policyConfig(id,weights={}){
  if(!POLICIES[id])throw new Error(`Unknown policy ${id}`);for(const [k,v]of Object.entries(weights))if(!['speed','ukeire','value','pinfu','risk','maxShantenLoss','callCost'].includes(k)||!Number.isFinite(v)||v<0)throw new Error(`Invalid policy weight ${k}`);
  return {...POLICIES[id],...weights};
}
function potential(c,melds,o){
  const tiles=[];for(let t=0;t<34;t++)for(let k=0;k<c[t];k++)tiles.push(t);
  for(const m of melds)tiles.push(...(m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(3).fill(m.tile)));
  const len=tiles.length,openTrip=melds.filter(m=>m.type!=='chi').length;
  let connections=0,triplets=0,pairs=0;
  for(let t=0;t<34;t++){if(c[t]>=3)triplets++;if(c[t]>=2)pairs++;if(t<27&&t%9<8)connections+=Math.min(c[t],c[t+1]);if(t<27&&t%9<7)connections+=0.35*Math.min(c[t],c[t+2]);}
  const pinfu=connections/4 + melds.filter(m=>m.type==='chi').length*0.7 - openTrip*1.8-triplets*0.25;
  const frequency=counts(tiles),honors=tiles.filter(t=>t>=27).length;
  // Shape score is a transparent heuristic, not a calibrated win probability.
  let val=50;
  const fraction=pred=>tiles.filter(pred).length/Math.max(1,len);
  const feasible=pred=>melds.every(m=>(m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:[m.tile]).every(pred));
  const attract=(points,pred)=>{if(feasible(pred))val=Math.max(val,points*Math.pow(fraction(pred),5));};
  if(melds.every(m=>!m.open)&&(!o.rules.concealedKanBreaksMenzen||!melds.length))val=Math.max(val,100);
  attract(100,t=>!isYao(t));
  for(let s=0;s<3;s++){attract(400,t=>t<27&&Math.floor(t/9)===s);if(honors)attract(200,t=>t>=27||Math.floor(t/9)===s);}
  attract(1000,t=>t>=27);attract(1000,t=>o.rules.greenTiles.includes(t));
  if(!melds.some(m=>m.type==='chi'))val=Math.max(val,200*Math.min(1,(2*(triplets+openTrip)+pairs)/9));
  if(!melds.length)val=Math.max(val,400*(pairs/7)**3);
  for(let t=27;t<34;t++){
    const unit=t>=31?o.rules.dragonBonus:(t===o.rules.roundWind?o.rules.roundWindBonus:0)+(t===27+(o.seat-o.dealer+4)%4?o.rules.seatWindBonus:0);
    val+=unit*(frequency[t]>=3?1:frequency[t]===2?0.45:0.05);
  }
  val+=melds.filter(m=>m.type==='kan').length*o.rules.kanBonus;
  return {value:val,pinfu};
}
export function publicRisk(tile,o){
  const availability=(4-o.visible[tile])/4,shape=tile>=27?0.45:[0,8].includes(tile%9)?0.7:1;
  let threat=0;
  for(const p of o.players)if(p.seat!==o.seat&&!p.won){
    const suits=p.melds.filter(m=>m.tile<27).map(m=>Math.floor(m.tile/9));
    const focus=suits.length>=2&&new Set(suits).size===1&&tile<27&&Math.floor(tile/9)===suits[0]?1.35:1;
    threat+=(0.15+Math.min(1,p.discards.length/16)+p.melds.length*0.25)*focus;
  }
  // H has no default furiten: a previously discarded tile is never assigned zero risk.
  return availability*shape*threat;
}
function value13(c,melds,o,w,discard=null){
  const e=effectiveTiles(c,melds.length,o.visible,o.rules),p=potential(c,melds,o);
  const activeFactor=0.6+o.activeCount/5;
  const risk=discard===null?0:publicRisk(discard,o);
  const score=-w.speed*e.shanten+w.ukeire*e.ukeire+w.value*p.value*activeFactor+w.pinfu*p.pinfu-w.risk*risk*(e.shanten>=2?1.35:1);
  return {score,shanten:e.shanten,ukeire:e.ukeire,value:p.value,pinfu:p.pinfu,risk};
}
function bestDiscard(c,melds,o,w,allowed=null){
  const raw=[];for(let t=0;t<34;t++)if(c[t]&&(!allowed||allowed.includes(t))){c[t]--;const s=shanten(c,melds.length,o.rules.sevenPairsQuadAsTwo);c[t]++;raw.push({tile:t,shanten:s});}
  const min=Math.min(...raw.map(x=>x.shanten));let best=null;
  for(const candidate of raw)if(candidate.shanten<=min+w.maxShantenLoss){const t=candidate.tile;c[t]--;const metrics=value13(c,melds,o,w,t);c[t]++;const r={tile:t,...metrics};if(!best||r.score>best.score+1e-9)best=r;}
  return best;
}
export function chooseAction(o,id='E',weights={}){
  const w=policyConfig(id,weights),as=o.legalActions;
  if(!as.length)throw new Error('No legal action');
  const find=t=>as.find(a=>a.type===t);
  if(find('tsumo'))return find('tsumo');
  if(find('ron')&&(!w.declineRon||!find('pass')))return find('ron');
  if(find('ron')&&w.declineRon)return find('pass');
  if(as.length===1)return as[0];
  const c=counts(o.hand),melds=o.melds;
  if(o.phase==='turn'){
    const d=bestDiscard(c,melds,o,w,as.filter(a=>a.type==='discard').map(a=>a.tile));
    let chosen={type:'discard',tile:d.tile},best=d.score;
    for(const a of as.filter(a=>a.type==='ankan'||a.type==='kakan')){
      const cc=[...c],mm=melds.map(m=>({...m}));
      if(a.type==='ankan'){cc[a.tile]-=4;mm.push({type:'kan',tile:a.tile,open:false});}else {cc[mm[a.meld].tile]--;mm[a.meld].type='kan';}
      const v=value13(cc,mm,o,w);if(v.shanten<=d.shanten&&v.score+3>best){best=v.score+3;chosen=a;}
    }
    return chosen;
  }
  let chosen=find('pass'),base=value13(c,melds,o,w),best=base.score;
  for(const a of as.filter(a=>['chi','pon','minkan'].includes(a.type))){
    const cc=[...c],mm=melds.map(m=>({...m})),t=o.lastDiscard.tile;
    const need=a.type==='chi'?[a.tile,a.tile+1,a.tile+2].filter(x=>x!==t):Array(a.type==='minkan'?3:2).fill(t);
    for(const n of need)cc[n]--;mm.push({type:a.type==='chi'?'chi':a.type==='pon'?'pon':'kan',tile:a.tile,open:true});
    const v=a.type==='minkan'?value13(cc,mm,o,w):bestDiscard(cc,mm,o,w,o.rules.allowKuikae?null:Array.from({length:34},(_,i)=>i).filter(i=>i!==t));
    if(!v||v.shanten>base.shanten+w.maxShantenLoss)continue;
    const score=v.score-w.callCost+(a.type==='minkan'?3:0);if(score>best+1e-9){best=score;chosen=a;}
  }
  return chosen;
}

export function evaluateDiscards(o,id='E',weights={}) {const w=policyConfig(id,weights),c=counts(o.hand);return o.legalActions.filter(a=>a.type==='discard').map(a=>{c[a.tile]--;const v=value13(c,o.melds,o,w,a.tile);c[a.tile]++;return {...a,...v};}).sort((a,b)=>b.score-a.score);}
