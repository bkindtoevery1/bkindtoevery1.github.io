import * as h from '../policies/index.mjs';
import * as s from '../s-engine/policy.mjs';
export const POLICIES=h.POLICIES,OPPONENT_PROFILES=h.OPPONENT_PROFILES;
export const chooseAction=(view,id,weights)=>(view.rules.variant==='S'?s:h).chooseAction(view,id,weights);
export const evaluateDiscards=(view,id,weights)=>(view.rules.variant==='S'?s:h).evaluateDiscards(view,id,weights);
