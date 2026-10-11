import {scoreHand} from '../engine/score.mjs';

const clamp=(value,low=0,high=1)=>Math.min(high,Math.max(low,value));
const wind=(o,seat)=>27+(seat-(o.dealer??0)+4)%4;
const honorUnit=(tile,o,seat=o.seat)=>tile>=31?o.rules.dragonBonus:
  (tile===o.rules.roundWind?o.rules.roundWindBonus:0)+(tile===wind(o,seat)?o.rules.seatWindBonus:0);
const unseen=(tile,o,fallback=0)=>clamp(4-(o.visible?.[tile]??fallback),0,4);
const opponents=o=>o.players.filter(player=>player.seat!==o.seat&&!player.won);

function ownFrequency(c,melds){
  const frequency=[...c];
  for(const meld of melds){
    if(!Number.isInteger(meld.tile)||meld.tile<0||meld.tile>=34)continue;
    if(meld.type==='chi')for(let offset=0;offset<3;offset++)frequency[meld.tile+offset]++;
    else frequency[meld.tile]+=meld.type==='kan'?4:3;
  }
  return frequency;
}

/** Expected bonus potential, not a probability of winning or promised score.
 * Incomplete honor sets account for publicly unseen copies and wall opportunity.
 * Depleted pairs remain available as a head; this only estimates triplet bonus.
 */
export function honorValue(c,melds,o){
  const frequency=ownFrequency(c,melds);
  const population=Math.max(1,Array.from({length:34},(_,tile)=>unseen(tile,o,frequency[tile])).reduce((sum,n)=>sum+n,0));
  const active=1+opponents(o).length;
  // The first copy of a singleton cannot be called. Its smaller two-copy term
  // below discounts that fact. These opportunity factors are explicit heuristics.
  const opportunities=Math.max(0,o.wallRemaining??0)*(1+0.4*(active-1))/active;
  const honors=Array.from({length:7},(_,i)=>{
    const tile=27+i,count=frequency[tile],unit=honorUnit(tile,o),remaining=unseen(tile,o,count);
    const oneMore=1-Math.exp(-opportunities*remaining/population);
    const completion=count>=3?1:count===2?oneMore:count===1&&remaining>=2?0.35*oneMore**2*(remaining-1)/remaining:0;
    return {tile,count,unit,unseen:remaining,estimatedBonus:unit*completion};
  });
  return {bonus:honors.reduce((sum,honor)=>sum+honor.estimatedBonus,0),honors};
}

function opponentThreat(player,o){
  const progress=clamp((player.discards.length-4)/12);
  const meldProgress=clamp(player.melds.length/3);
  // Concealed kan count is public. Its type and potential honor bonus are not.
  const knownBonus=player.melds.reduce((sum,meld)=>sum+(
    !meld.hidden&&Number.isInteger(meld.tile)&&meld.tile>=27&&meld.type!=='chi'
      ?honorUnit(meld.tile,o,player.seat):0),0);
  return clamp(0.03+0.60*progress+0.32*meldProgress+0.08*clamp(knownBonus/200));
}

export function adaptivePressure(o){
  const total=opponents(o).reduce((sum,player)=>sum+opponentThreat(player,o),0);
  return 1-Math.exp(-total/1.3);
}

/** Public pattern support, not calibrated deal-in probability.
 * A suited tile can complete a sequence even when all four copies were known.
 * Only pair/triplet support depends on unseen copies of the discarded rank.
 */
export function adaptiveRisk(tile,o){
  const remaining=unseen(tile,o);
  const pair=remaining/4,triplet=Math.max(0,remaining-1)/3;
  let sequence=0;
  if(tile<27){
    for(const offsets of [[-2,-1],[-1,1],[1,2]]){
      const [a,b]=offsets.map(offset=>tile+offset);
      if(a>=0&&b<27&&Math.floor(a/9)===Math.floor(tile/9)&&Math.floor(b/9)===Math.floor(tile/9))sequence+=Math.min(unseen(a,o),unseen(b,o))/12;
    }
  }
  const pattern=tile>=27?0.12*pair+0.65*triplet:0.9*sequence+0.10*pair+0.18*triplet;
  return opponents(o).reduce((sum,player)=>{
    const suits=player.melds.filter(meld=>!meld.hidden&&Number.isInteger(meld.tile)&&meld.tile<27).map(meld=>Math.floor(meld.tile/9));
    const focused=suits.length>=2&&new Set(suits).size===1&&tile<27&&Math.floor(tile/9)===suits[0];
    const honorExposure=tile>=27?1+clamp(honorUnit(tile,o,player.seat)/500,0,0.6):1;
    return sum+pattern*(0.10+0.90*opponentThreat(player,o))*(focused?1.3:1)*honorExposure;
  },0);
}

export function adaptiveMetrics(c,melds,o,e,potential,w,discard=null){
  const honor=honorValue(c,melds,o),payers=opponents(o).length;
  let value=potential.value,estimatedBase=potential.baseValue;
  let ronValue=value,tsumoReceipt=(value+o.rules.tsumoBonusPerPayer)*payers;
  let valueSource='shape-heuristic',liveWaitCopies=null;
  if(e.shanten===0){
    const tiles=c.flatMap((count,tile)=>Array(count).fill(tile));
    let copies=0,ron=0,tsumo=0,base=0;
    const candidates=e.tiles?.map(item=>item.tile)??Array.from({length:34},(_,tile)=>tile);
    for(const tile of candidates){
      const remaining=unseen(tile,o,c[tile]);
      if(!remaining||c[tile]>=4)continue;
      const context={winTile:tile,seatWind:wind(o,o.seat)};
      const ronHand=scoreHand([...tiles,tile],melds,{...context,method:'ron'},o.rules);
      const tsumoHand=scoreHand([...tiles,tile],melds,{...context,method:'tsumo'},o.rules);
      if(!ronHand||!tsumoHand)continue;
      copies+=remaining;ron+=remaining*ronHand.total;base+=remaining*ronHand.base;
      tsumo+=remaining*(tsumoHand.total+o.rules.tsumoBonusPerPayer)*payers;
    }
    liveWaitCopies=copies;
    value=ronValue=copies?ron/copies:0;
    estimatedBase=copies?base/copies:0;
    tsumoReceipt=copies?tsumo/copies:0;
    valueSource=copies?'tenpai-unseen':'tenpai-no-outs';
  }
  const pressure=adaptivePressure(o),risk=discard===null?0:adaptiveRisk(discard,o);
  const readiness=1/(1+1.2*Math.max(0,e.shanten));
  const publicUkeire=Math.max(0,e.ukeire);
  const ukeireQuality=publicUkeire/(publicUkeire+6);
  // A fixed mixing ratio is a transparent preference, not a fitted probability.
  const payout=0.65*Math.max(0,ronValue)+0.35*Math.max(0,tsumoReceipt);
  const payoutQuality=payout/(payout+220);
  const attack=valueSource==='tenpai-no-outs'?0:clamp((0.7*readiness+0.3*ukeireQuality)*(0.65+0.35*payoutQuality));
  const defenseMix=pressure*(1-attack);
  const riskWeight=2+Math.max(0,w.adaptiveDefense??0)*defenseMix;
  return {value,estimatedBase,risk,riskWeight,attack,defenseMix,pressure,valueSource,ronValue,tsumoReceipt,
    honorPotential:honor.bonus,honors:honor.honors,liveWaitCopies,publicUkeire};
}
