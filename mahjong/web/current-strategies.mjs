import {chooseAction} from '../game/policies.mjs';
import {RULEBOOK_TRAINING,rulebookTrainingCompatible} from '../game/rulebook-training.mjs';

// A–E are the current display/selection IDs. Keep the frozen experiment's
// version ID and evidence intact for saved-game provenance and comparisons.
export const CURRENT_STRATEGIES=Object.freeze(RULEBOOK_TRAINING.versions.map(version=>
  Object.freeze({...version,id:version.policy,versionId:version.id})
));
export const currentStrategy=id=>CURRENT_STRATEGIES.find(strategy=>strategy.id===id);

const currentWeightMap=Object.freeze(Object.fromEntries(CURRENT_STRATEGIES.map(strategy=>[strategy.id,strategy.weights])));
const baselineWeights=Object.freeze({});
export const currentWeights=view=>rulebookTrainingCompatible(view)?currentWeightMap:baselineWeights;

const profile=(name,policies)=>Object.freeze({name,policies:Object.freeze(policies)});
export const PRACTICE_PROFILES=Object.freeze({
  mixed:profile('혼합형 · A·D·E',['A','D','E']),
  speed:profile('최속 화료형 · A',['A','A','A']),
  pinfu:profile('핑후 우선형 · B',['B','B','B']),
  tsumo:profile('쯔모 지향형 · C',['C','C','C']),
  value:profile('고득점 지향형 · D',['D','D','D']),
  cautious:profile('상황별 공수 균형형 · E',['E','E','E']),
});

// This practice lineup is new: the recorded validation used the original
// opponent profiles. Updating opponents does not create new validation data.
export function currentPracticeAction(view,{humanSeat,policy='E',profile='mixed'}={}){
  if(!Number.isInteger(humanSeat)||humanSeat<0||humanSeat>3||!Number.isInteger(view?.seat)||view.seat<0||view.seat>3)throw new Error('Invalid practice seat');
  // Removed saved profiles (including valuePressure) resume as mixed.
  const lineup=Object.hasOwn(PRACTICE_PROFILES,profile)?PRACTICE_PROFILES[profile]:PRACTICE_PROFILES.mixed;
  const id=view.seat===humanSeat?policy:lineup.policies[(view.seat-humanSeat+4)%4-1];
  if(!currentStrategy(id))throw new Error('Unknown current strategy '+id);
  return chooseAction(view,id,currentWeights(view)[id]);
}
