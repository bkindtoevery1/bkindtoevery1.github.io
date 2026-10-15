import {PRIVATE_KAN_TRAINING} from './private-kan-training.mjs';
import {HYBRID_TRAINING} from './hybrid-training.mjs';
import {chooseAction,OPPONENT_PROFILES} from '../game/policies.mjs';
import {DEFAULT_RULES} from '../engine/rules.mjs';
import {RULEBOOK_TRAINING,rulebookTrainingCompatible,rulebookTrainingVersion} from '../game/rulebook-training.mjs';
import {rulebookTrainingApplicable} from '../game/training-runtime.mjs';

const completedVersions=training=>training.status==='complete'?training.versions:[];
const hybridVersions=()=>[...completedVersions(HYBRID_TRAINING),...(HYBRID_TRAINING.status==='complete'?HYBRID_TRAINING.controls.filter(v=>v.id==='Y1').map(v=>({...v,description:'역패 장수·가산 단가·공개된 잔여 패를 반영한 고득점형',improved:false})):[])];
export const privateTrainingVersions=()=>[...hybridVersions(),...completedVersions(PRIVATE_KAN_TRAINING)];
export const privateTrainingVersion=mode=>privateTrainingVersions().find(v=>v.id===mode);
export const trainingVersions=()=>[...completedVersions(RULEBOOK_TRAINING),...privateTrainingVersions()];
export const trainingVersion=mode=>trainingVersions().find(v=>v.id===mode);
export const trainingIdForMode=mode=>rulebookTrainingVersion(mode)?RULEBOOK_TRAINING.id:hybridVersions().some(v=>v.id===mode)?HYBRID_TRAINING.id:privateTrainingVersion(mode)?PRIVATE_KAN_TRAINING.id:null;
export const defaultHybridMode=()=>completedVersions(HYBRID_TRAINING).some(v=>v.id===HYBRID_TRAINING.preferredVersion)?HYBRID_TRAINING.preferredVersion:null;
export function privateTrainingCompatible(view){return PRIVATE_KAN_TRAINING.status==='complete'&&view?.rules?.variant!=='S'&&view?.rules?.concealedKanPrivate===true&&Object.entries(PRIVATE_KAN_TRAINING.rules).every(([key,value])=>JSON.stringify(view.rules[key])===JSON.stringify(value));}
// Reuse the requested mixed/honor-aware strategy on the revised rules without
// presenting the old experiment as validation of the new game.
export function revisedTrainingApplicable(view){return view?.rules?.variant!=='S'&&[27,28].includes(view?.rules?.roundWind)&&Object.entries(DEFAULT_RULES).every(([key,value])=>key==='roundWind'||JSON.stringify(view?.rules?.[key])===JSON.stringify(value));}
export function trainingVersionApplicable(view,mode){return rulebookTrainingVersion(mode)?rulebookTrainingApplicable(view):!!privateTrainingVersion(mode)&&(privateTrainingCompatible(view)||revisedTrainingApplicable(view)&&['M1','M2','M3','Y1'].includes(mode));}
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
  try{const saved=storage?.getItem(KEY);if(saved==='original'||trainingVersion(saved))return saved;if(saved==='trained')return hasTrainedPolicies(training)?'trained':'original';}catch{}
  return defaultHybridMode()??(hasTrainedPolicies(training)?'trained':'original');
}
export function saveTrainingMode(storage,mode){try{storage?.setItem(KEY,mode==='trained'||trainingVersion(mode)?mode:'original');}catch{}}
export function trainingWeights(view,mode,training){
  const version=trainingVersion(mode);
  if(version)return trainingVersionApplicable(view,mode)?{[version.policy]:version.weights}:{};
  return trainingCompatible(view,training)&&mode==='trained'?training.weights:{};
}
export function trainingProvenance(view,mode,training){
 const version=trainingVersion(mode),applicable=trainingVersionApplicable(view,mode),legacy=mode==='trained'&&trainingCompatible(view,training);
 const effectiveMode=applicable||legacy?mode:'original';
 const validated=applicable&&(!!rulebookTrainingVersion(mode)&&rulebookTrainingCompatible(view)||privateTrainingCompatible(view))||legacy;
 return {mode,effectiveMode,trainingId:applicable?trainingIdForMode(mode):legacy?training.id:null,rulesetId:view?.rules?.id??null,
  validationStatus:validated?'validated-for-rules':applicable?'not-validated-for-rules':'baseline',
  ...(applicable?{policy:version.policy,weights:structuredClone(version.weights)}:legacy?{weights:structuredClone(training.weights)}:{})};
}
// Optional, compact provenance: add one entry when a choice changes, never on
// every draw. Existing logs without this field remain readable.
export function recordTrainingSelection(log,view,mode,training,{policy,profile,opponentTrainingId}={}){
 if(!log)return;
 const selection={...trainingProvenance(view,mode,training),...policy?{autoPolicy:policy}:{},...profile?{opponentProfile:profile}:{},...opponentTrainingId!==undefined?{opponentTrainingId}:{}};
 const previous=log.training?.selections?.at(-1),{actionIndex:_,...previousSelection}=previous??{};
 if(JSON.stringify(previousSelection)===JSON.stringify(selection))return;
 log.training??={format:'wellness-training-selection/v1',selections:[]};
 log.training.selections.push({actionIndex:log.actions?.length??0,...selection});
}
// Keep every opponent at the original definition used in the validation games.
export function practiceAction(view,{humanSeat,policy,profile,mode,training}){
  if(view.seat===humanSeat)return chooseAction(view,policy,trainingWeights(view,mode,training)[policy]);
  const spec=OPPONENT_PROFILES[profile][(view.seat-humanSeat+4)%4-1];
  return chooseAction(view,spec.id,spec.weights);
}
