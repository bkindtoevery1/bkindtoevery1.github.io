import {chooseAction,OPPONENT_PROFILES} from '../game/policies.mjs';

const KEY='wellness-mahjong-training-profile-v1';
export function hasTrainedPolicies(training){return Object.keys(training.weights).length>0;}
export function readTrainingMode(storage,training){
  try{if(storage?.getItem(KEY)==='original')return 'original';}catch{}
  return hasTrainedPolicies(training)?'trained':'original';
}
export function saveTrainingMode(storage,mode){try{storage?.setItem(KEY,mode==='trained'?'trained':'original');}catch{}}
export function trainingWeights(view,mode,training){
  return view.rules.variant!=='S'&&mode==='trained'?training.weights:{};
}
// Keep every opponent at the original definition used in the validation games.
export function practiceAction(view,{humanSeat,policy,profile,mode,training}){
  if(view.seat===humanSeat)return chooseAction(view,policy,trainingWeights(view,mode,training)[policy]);
  const spec=OPPONENT_PROFILES[profile][(view.seat-humanSeat+4)%4-1];
  return chooseAction(view,spec.id,spec.weights);
}
