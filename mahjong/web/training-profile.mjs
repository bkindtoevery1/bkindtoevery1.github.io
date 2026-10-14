import {PRIVATE_KAN_TRAINING} from './private-kan-training.mjs';
import {HYBRID_TRAINING} from './hybrid-training.mjs';
import {chooseAction,OPPONENT_PROFILES} from '../game/policies.mjs';
import {DEFAULT_RULES} from '../engine/rules.mjs';

const completedVersions=training=>training.status==='complete'?training.versions:[];
const hybridVersions=()=>[...completedVersions(HYBRID_TRAINING),...(HYBRID_TRAINING.status==='complete'?HYBRID_TRAINING.controls.filter(v=>v.id==='Y1').map(v=>({...v,description:'역패 장수·가산 단가·공개된 잔여 패를 반영한 고득점형',improved:false})):[])];
export const privateTrainingVersions=()=>[...hybridVersions(),...completedVersions(PRIVATE_KAN_TRAINING)];
export const privateTrainingVersion=mode=>privateTrainingVersions().find(v=>v.id===mode);
export const trainingIdForMode=mode=>hybridVersions().some(v=>v.id===mode)?HYBRID_TRAINING.id:privateTrainingVersion(mode)?PRIVATE_KAN_TRAINING.id:null;
export const defaultHybridMode=()=>completedVersions(HYBRID_TRAINING).some(v=>v.id===HYBRID_TRAINING.preferredVersion)?HYBRID_TRAINING.preferredVersion:null;
export function privateTrainingCompatible(view){return PRIVATE_KAN_TRAINING.status==='complete'&&view?.rules?.variant!=='S'&&view?.rules?.concealedKanPrivate===true&&Object.entries(PRIVATE_KAN_TRAINING.rules).every(([key,value])=>JSON.stringify(view.rules[key])===JSON.stringify(value));}
// Reuse the requested mixed/honor-aware strategy on the revised rules without
// presenting the old experiment as validation of the new game.
export function revisedTrainingApplicable(view){return view?.rules?.variant!=='S'&&[27,28].includes(view?.rules?.roundWind)&&Object.entries(DEFAULT_RULES).every(([key,value])=>key==='roundWind'||JSON.stringify(view?.rules?.[key])===JSON.stringify(value));}
export function trainingVersionApplicable(view,mode){return !!privateTrainingVersion(mode)&&(privateTrainingCompatible(view)||revisedTrainingApplicable(view)&&['M1','M2','M3','Y1'].includes(mode));}
// New defaults follow the requested mixed strategy. Later explicit selections persist.
const KEY='wellness-mahjong-training-profile-v2';
export function hasTrainedPolicies(training){return Object.keys(training.weights).length>0;}
// A validation result belongs to the rules used for those actual games.
export function trainingCompatible(view,training){
  const rules=view?.rules;
  return !!rules&&rules.variant!=='S'&&rules.id===(training.rulesetId??'H-2026-literal-v1')&&
    !rules.concealedKanPrivate&&!rules.greenRequiresDragon&&!rules.fourOfAKindBonus&&(!rules.ronContinuation||rules.ronContinuation==='discarder');
}
export function readTrainingMode(storage,training){
  try{const saved=storage?.getItem(KEY);if(saved==='original'||privateTrainingVersion(saved))return saved;if(saved==='trained')return hasTrainedPolicies(training)?'trained':'original';}catch{}
  return defaultHybridMode()??(hasTrainedPolicies(training)?'trained':'original');
}
export function saveTrainingMode(storage,mode){try{storage?.setItem(KEY,mode==='trained'||privateTrainingVersion(mode)?mode:'original');}catch{}}
export function trainingWeights(view,mode,training){
  const version=privateTrainingVersion(mode);
  if(version)return trainingVersionApplicable(view,mode)?{[version.policy]:version.weights}:{};
  return trainingCompatible(view,training)&&mode==='trained'?training.weights:{};
}
// Keep every opponent at the original definition used in the validation games.
export function practiceAction(view,{humanSeat,policy,profile,mode,training}){
  if(view.seat===humanSeat)return chooseAction(view,policy,trainingWeights(view,mode,training)[policy]);
  const spec=OPPONENT_PROFILES[profile][(view.seat-humanSeat+4)%4-1];
  return chooseAction(view,spec.id,spec.weights);
}
