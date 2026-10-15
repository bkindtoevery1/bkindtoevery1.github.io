import {rulebookTrainingCompatible} from './rulebook-training.mjs';

// Reusing frozen weights with public ankans is a runtime choice, not a new
// validation result. Keep the experiment's strict compatibility check intact.
export function rulebookTrainingApplicable(view){
 if(rulebookTrainingCompatible(view))return true;
 const rules=view?.rules??view;
 return rules?.concealedKanPrivate===false&&rulebookTrainingCompatible({...rules,concealedKanPrivate:true});
}
