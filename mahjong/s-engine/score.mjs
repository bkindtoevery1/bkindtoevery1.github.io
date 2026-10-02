import {counts,isYao,isHonor,isTerminal} from '../engine/tiles.mjs';
import {decompositions} from '../engine/score.mjs';
import {S_DEFAULTS} from './rules.mjs';

export const ORPHANS=[0,8,9,17,18,26,27,28,29,30,31,32,33];
export function sShapes(tiles,melds=[],rules=S_DEFAULTS){
  const out=decompositions(tiles,melds,{sevenPairsQuadAsTwo:false}),c=counts(tiles);
  if(rules.standardYakuman&&!melds.length&&tiles.length===14&&ORPHANS.every(t=>c[t]>=1)&&ORPHANS.some(t=>c[t]===2))out.push({kind:'orphans',groups:[],pair:ORPHANS.find(t=>c[t]===2)});
  return out;
}
export function shapeWaits(tiles,melds=[],rules=S_DEFAULTS){const c=counts([...tiles,...melds.flatMap(m=>m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile))]);const out=[];for(let t=0;t<34;t++)if(c[t]<4&&sShapes([...tiles,t],melds,rules).length)out.push(t);return out;}
export function doraAfter(tile){return tile<27?Math.floor(tile/9)*9+(tile+1)%9:tile<31?27+(tile-26)%4:31+(tile-30)%3;}
export function sPoints(han,dealer=false,yakuman=false){
  const base=yakuman?32000:han>=11?24000:han>=8?16000:han>=6?12000:han>=4?8000:han===3?4000:han===2?2000:1000;
  return {ron:dealer?base*1.5:base,tsumoDealer:dealer?base/2:base/2,tsumoOther:dealer?base/2:Math.ceil(base/400)*100};
}
export function scoreS(tiles,melds=[],context={},rules=S_DEFAULTS){
  const all=[...tiles,...melds.flatMap(m=>m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile))],c=counts(all);
  if(c.some(n=>n>4))return null;
  const closed=melds.every(m=>!m.open),suits=new Set(all.filter(t=>t<27).map(t=>Math.floor(t/9))),honors=all.some(isHonor);
  let best=null;
  for(const shape of sShapes(tiles,melds,rules)){
    const groups=[...shape.groups,...melds],seq=groups.filter(g=>g.type==='chi'),trip=groups.filter(g=>g.type!=='chi');
    const entries=[],limits=[],add=(id,name,han,condition)=>{if(condition)entries.push({id,name,han});},limit=(id,name,condition)=>{if(condition)limits.push({id,name,han:0});};
    const tripTiles=trip.map(g=>g.tile),freq=new Map();for(const g of seq)freq.set(g.tile,(freq.get(g.tile)??0)+1);
    const identical=[...freq.values()].reduce((n,count)=>n+Math.floor(count/2),0),pairValue=shape.pair>=31||shape.pair===rules.roundWind||shape.pair===(context.seatWind??27);
    const ryanmen=shape.groups.some(g=>g.type==='chi'&&(context.winTile===g.tile&&g.tile%9!==6||context.winTile===g.tile+2&&g.tile%9!==0));
    let concealed=trip.filter(g=>!g.open).length;
    const ronTrip=context.method==='ron'&&shape.pair!==context.winTile&&!shape.groups.some(g=>g.type==='chi'&&context.winTile>=g.tile&&context.winTile<=g.tile+2);
    if(ronTrip&&shape.groups.some(g=>g.type==='pon'&&g.tile===context.winTile))concealed--;
    add('pinfu','핑후',rules.pinfuHan,seq.length===4&&closed&&ryanmen&&(rules.pinfuValuePairAllowed||!pairValue));
    add('ryanpeikou','량페코',3,identical>=2&&(!rules.peikouClosedOnly||closed));
    add('iipeikou','이페코',1,identical===1&&(!rules.peikouClosedOnly||closed));
    add('menzenTsumo','멘젠 쯔모',1,closed&&context.method==='tsumo');
    add('tanyao','탕야오',1,all.every(t=>!isYao(t)));
    add('rinshan','영상개화',1,context.rinshan&&context.method==='tsumo');
    add('haitei','해저로월',1,context.lastTile&&context.method==='tsumo'&&!context.rinshan);
    add('houtei','하저로어',1,context.lastTile&&context.method==='ron'&&!context.chankan);
    add('chankan','창깡',1,context.chankan&&context.method==='ron');
    add('toitoi','또이또이',2,trip.length===4);
    add('sanshokuTriplets','삼색동각',2,Array.from({length:9},(_,n)=>n).some(n=>[n,n+9,n+18].every(t=>tripTiles.includes(t))));
    const reduced=rules.openSequenceReduction&&!closed?1:0;
    add('sanshokuSequences','삼색동순',2-reduced,Array.from({length:7},(_,n)=>n).some(n=>[n,n+9,n+18].every(t=>seq.some(g=>g.tile===t))));
    add('ittsu','일기통관',2-reduced,[0,9,18].some(n=>[n,n+3,n+6].every(t=>seq.some(g=>g.tile===t))));
    const outside=shape.kind==='standard'&&groups.every(g=>g.type==='chi'?[0,6].includes(g.tile%9):isYao(g.tile))&&isYao(shape.pair);
    add('chanta','찬타',2-reduced,outside&&honors&&seq.length>0);add('junchan','준찬타',3-reduced,outside&&!honors&&seq.length>0);
    add('honroutou','혼노두',2,all.every(isYao));
    add('sevenPairs','칠대자',2,shape.kind==='sevenPairs');add('sanankou','삼암각',2,concealed>=3);
    add('smallThreeDragons','소삼원',2,tripTiles.filter(t=>t>=31).length===2&&shape.pair>=31);
    add('threeKans','삼깡자',2,melds.filter(m=>m.type==='kan').length===3);
    add('honitsu','혼일색',closed?3:2,suits.size===1&&honors);add('chinitsu','청일색',closed?6:5,suits.size===1&&!honors);
    for(const t of tripTiles){add('dragon'+t,['백','발','중'][t-31],1,t>=31);add('roundWind','장풍',1,t===rules.roundWind);add('seatWind','자풍',1,t===(context.seatWind??27));}
    limit('bigThreeDragons','대삼원',tripTiles.filter(t=>t>=31).length===3);limit('bigFourWinds','대사희',tripTiles.filter(t=>t>=27&&t<31).length===4);
    if(rules.standardYakuman){
      limit('orphans','국사무쌍',shape.kind==='orphans');limit('fourConcealed','사암각',concealed===4);limit('fourKans','사깡자',melds.filter(m=>m.type==='kan').length===4);
      limit('smallFourWinds','소사희',tripTiles.filter(t=>t>=27&&t<31).length===3&&shape.pair>=27&&shape.pair<31);
      limit('allHonors','자일색',all.every(isHonor));limit('allTerminals','청노두',all.every(isTerminal));limit('allGreen','녹일색',all.every(t=>[19,20,21,23,25,32].includes(t)));
      if(closed&&!melds.length&&suits.size===1&&!honors){const offset=[...suits][0]*9;limit('nineGates','구련보등',c[offset]>=3&&c[offset+8]>=3&&Array.from({length:7},(_,i)=>i+1).every(n=>c[offset+n]>=1));}
    }
    if(!entries.length&&!limits.length)continue; // Riichi, dora and kan bonuses cannot supply the required yaku.
    const bonuses=[];const bonus=(id,name,han)=>{if(han)bonuses.push({id,name,han});};
    bonus('riichi','리치',context.riichi?1:0);bonus('ippatsu','일발',context.riichi&&context.ippatsu?1:0);
    bonus('kan','깡 가산',melds.filter(m=>m.type==='kan'&&!m.open).length+Math.floor(melds.filter(m=>m.type==='kan'&&m.open).length/2));
    bonus('dora','도라',(context.doraIndicators??[]).reduce((n,t)=>n+c[doraAfter(t)],0));
    bonus('ura','우라도라',context.riichi?(context.uraIndicators??[]).reduce((n,t)=>n+c[doraAfter(t)],0):0);
    const yakuman=limits.length>0,hanYaku=entries.reduce((n,e)=>n+e.han,0),bonusHan=bonuses.reduce((n,e)=>n+e.han,0),han=yakuman?0:hanYaku+bonusHan;
    const points=sPoints(han,!!context.dealer,yakuman),yaku=yakuman?limits:entries;
    const score={variant:'S',name:yaku.map(e=>e.name).join(' · '),yaku:yaku[0].id,yakuEntries:yaku,bonuses:yakuman?[]:bonuses,han,hanYaku:yakuman?0:hanYaku,bonusHan:yakuman?0:bonusHan,yakuman,base:points.ron,bonus:0,total:points.ron,points,closed,shape};
    if(!best||score.total>best.total||score.total===best.total&&score.han>best.han)best=score;
  }
  return best;
}
