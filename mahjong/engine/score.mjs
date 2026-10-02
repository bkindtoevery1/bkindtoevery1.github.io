import {counts, isTerminal, isHonor, isYao} from './tiles.mjs';
import {DEFAULT_RULES} from './rules.mjs';

export const YAKU = {
  noYaku:['무역(人和)',50],pinfu:['핑후',100],iipeikou:['이페코',100],menzen:['멘젠',100],tanyao:['탕야오',100],
  toitoi:['또이또이',200],fiveGates:['오문(五门)',200],sanshokuTriplets:['삼색동각',200],sanshokuSequences:['삼색동순',200],chanta:['찬타',200],honitsu:['혼일색',200],
  junchan:['준찬타',400],ryanpeikou:['량페코',400],ittsu:['일기통관',400],honroutou:['혼노두',400],chinitsu:['청일색',400],sevenPairs:['칠대자',400],
  jiangdui:['장대(2·5·8 또이또이)',800],qingdui:['청대(청일색 또이또이)',800],threeKans:['삼깡자',800],pureSevenPairs:['청칠대자',800],sanankou:['삼암각',800],smallFourWinds:['소사희',800],smallThreeDragons:['소삼원',800],
  allTerminals:['청노두',1000],allHonors:['자일색',1000],allGreen:['녹일색(원문 해석)',1000],bigFourWinds:['대사희',1000],bigThreeDragons:['대삼원',1000]
};

export function decompositions(tiles, melds=[], r=DEFAULT_RULES) {
  const c=counts(tiles),out=[]; if(c.some(x=>x>4)||tiles.length!==14-3*melds.length) return out;
  if(!melds.length && (r.sevenPairsQuadAsTwo ? c.every(x=>x%2===0) : c.filter(x=>x===2).length===7)) out.push({kind:'sevenPairs',groups:[],pair:-1});
  function visit(groups,pair) {
    const i=c.findIndex(x=>x>0);
    if(i<0) {if(groups.length===4-melds.length) out.push({kind:'standard',pair,groups:groups.map(g=>({...g}))});return;}
    if(c[i]>=3) {c[i]-=3;groups.push({type:'pon',tile:i,open:false});visit(groups,pair);groups.pop();c[i]+=3;}
    if(i<27 && i%9<7 && c[i+1] && c[i+2]) {c[i]--;c[i+1]--;c[i+2]--;groups.push({type:'chi',tile:i,open:false});visit(groups,pair);groups.pop();c[i]++;c[i+1]++;c[i+2]++;}
  }
  for(let p=0;p<34;p++) if(c[p]>=2){c[p]-=2;visit([],p);c[p]+=2;}
  return out;
}

// tiles includes the winning tile; context carries no extra yaku from S/Riichi.
export function scoreHand(tiles,melds=[],context={},r=DEFAULT_RULES) {
  const all=[...tiles,...melds.flatMap(m=>m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile))];
  if(counts(all).some(x=>x>4)) return null;
  const ds=decompositions(tiles,melds,r); if(!ds.length) return null;
  const closed=melds.every(m=>!m.open) && (!r.concealedKanBreaksMenzen||melds.length===0);
  const suits=new Set(all.filter(t=>t<27).map(t=>Math.floor(t/9))),honors=all.some(isHonor);
  let best=null;const allEligible=new Set();
  for(const d of ds) {
    const gs=[...d.groups,...melds],seq=gs.filter(g=>g.type==='chi'),tri=gs.filter(g=>g.type!=='chi');
    const ids=[]; const add=(id,condition)=>{if(condition)ids.push(id);};
    add('noYaku',true);
    add('menzen',closed&&(!r.menzenRequiresTsumo||context.method==='tsumo'));
    add('tanyao',all.every(t=>!isYao(t)));
    add('fiveGates',suits.size===3 && all.some(t=>t>=27&&t<31) && all.some(t=>t>=31));
    add('honitsu',suits.size===1&&honors); add('chinitsu',suits.size===1&&!honors);
    add('honroutou',all.every(isYao)); add('allTerminals',all.every(isTerminal));add('allHonors',all.every(isHonor));
    add('allGreen',all.every(t=>r.greenTiles.includes(t)));
    if(d.kind==='sevenPairs') {add('sevenPairs',true);add('pureSevenPairs',(suits.size===1&&!honors)||suits.size===0);}
    else {
      add('pinfu',seq.length===4&&(!r.pinfuClosedOnly||closed));
      const frequencies=new Map(); for(const g of seq) frequencies.set(g.tile,(frequencies.get(g.tile)||0)+1);
      const pairs=[...frequencies].flatMap(([t,n])=>Array(Math.floor(n/2)).fill(t));
      add('iipeikou',pairs.length>=1&&(!r.peikouClosedOnly||closed));
      add('ryanpeikou',pairs.length>=2&&(!r.peikouClosedOnly||closed)&&(!r.ryanpeikouDistinctSuits||new Set(pairs.map(t=>Math.floor(t/9))).size>=2));
      add('toitoi',tri.length===4);
      add('qingdui',tri.length===4&&suits.size===1&&!honors);
      add('jiangdui',tri.length===4&&all.every(t=>t<27&&[1,4,7].includes(t%9)));
      add('threeKans',gs.filter(g=>g.type==='kan').length>=3);
      const tripTiles=tri.map(g=>g.tile);
      add('sanshokuTriplets',Array.from({length:9},(_,n)=>n).some(n=>[n,n+9,n+18].every(t=>tripTiles.includes(t))));
      add('sanshokuSequences',Array.from({length:7},(_,n)=>n).some(n=>[n,n+9,n+18].every(t=>seq.some(g=>g.tile===t))));
      add('ittsu',[0,9,18].some(n=>[n,n+3,n+6].every(t=>seq.some(g=>g.tile===t))));
      const outside=gs.every(g=>g.type==='chi'?(g.tile%9===0||g.tile%9===6):isYao(g.tile))&&isYao(d.pair);
      add('chanta',outside&&seq.length>0&&honors);add('junchan',outside&&seq.length>0&&!honors);
      const winds=tri.filter(g=>g.tile>=27&&g.tile<31).length,dragons=tri.filter(g=>g.tile>=31).length;
      add('smallFourWinds',winds===3&&d.pair>=27&&d.pair<31);add('bigFourWinds',winds===4);
      add('smallThreeDragons',dragons===2&&d.pair>=31);add('bigThreeDragons',dragons===3);
      let concealed=tri.filter(g=>!g.open).length;
      // If ron can complete a pair or sequence, maximize over that valid assignment.
      if(context.method==='ron' && context.winTile!==undefined) {
        const t=context.winTile,otherPlacement=d.pair===t || d.groups.some(g=>g.type==='chi'&&t>=g.tile&&t<=g.tile+2);
        if(!otherPlacement&&d.groups.some(g=>g.type==='pon'&&g.tile===t)) concealed--;
      }
      add('sanankou',concealed>=3);
    }
    const trip=gs.filter(g=>g.type!=='chi'),bonuses={
      kan:melds.filter(m=>m.type==='kan').length*r.kanBonus,
      dragon:trip.filter(g=>g.tile>=31).length*r.dragonBonus,
      roundWind:trip.filter(g=>g.tile===r.roundWind).length*r.roundWindBonus,
      seatWind:trip.filter(g=>g.tile===(context.seatWind??27)).length*r.seatWindBonus
    };
    for(const id of ids)allEligible.add(id);
    ids.sort((a,b)=>YAKU[b][1]-YAKU[a][1]);const base=YAKU[ids[0]][1],bonus=Object.values(bonuses).reduce((a,b)=>a+b,0),total=base+bonus;
    if(!best||total>best.total)best={yaku:ids[0],name:YAKU[ids[0]][0],base,bonus,total,bonuses,eligibleYaku:ids,closed,shape:d};
  }
  best.eligibleYaku=[...allEligible].sort((a,b)=>YAKU[b][1]-YAKU[a][1]);return best;
}

export function winningTiles(tiles,melds=[],context={},r=DEFAULT_RULES) {
  const c=counts([...tiles,...melds.flatMap(m=>m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile))]);
  const out=[];for(let t=0;t<34;t++)if(c[t]<4){const score=scoreHand([...tiles,t],melds,{...context,method:'ron',winTile:t},r);if(score)out.push({tile:t,score});}return out;
}
