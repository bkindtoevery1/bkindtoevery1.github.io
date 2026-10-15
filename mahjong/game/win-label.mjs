import {YAKU} from '../engine/score.mjs';

// H keeps the highest single original yaku. Prefer pinfu only among 100-point
// ties; eligibleYaku alone also includes shapes belonging to lower-scoring
// decompositions (for example a hand scored as pure seven pairs).
export function scoreDisplayYaku(score){
 if(!score||score.variant==='S'||score.yaku==='pinfu')return score?.yaku;
 const originalPoints=YAKU[score.yaku]?.[1]??(score.baseFan===1?100:null);
 return originalPoints===100&&(score.eligibleYaku?.includes('pinfu')||score.displayYaku==='pinfu')?'pinfu':score.yaku;
}

export function scoreDisplayName(score){
 return score?.variant!=='S'&&scoreDisplayYaku(score)==='pinfu'?'핑후':score?.name;
}

export function isPinfuWin(score){
 if(!score)return false;
 if(score.variant==='S')return !score.yakuman&&!!score.yakuEntries?.some(entry=>entry.id==='pinfu');
 return scoreDisplayYaku(score)==='pinfu';
}
