import {actor,legalActions} from '../game/engine.mjs';
import {typeOf} from '../engine/tiles.mjs';

export function canSelectTile(state,seat,id,auto=false){
 return !auto&&Number.isInteger(id)&&state.phase==='turn'&&actor(state)===seat&&
  state.players[seat].hand.includes(id)&&legalActions(state,seat).some(a=>a.type==='discard'&&a.tile===typeOf(id));
}
export function selectedDiscard(state,seat,id,auto=false){
 if(!canSelectTile(state,seat,id,auto))throw new Error('현재 손패에서 버릴 패를 다시 선택하세요.');
 return {type:'discard',tile:typeOf(id)};
}
export function seatPositions(humanSeat){
 return {bottom:humanSeat,right:(humanSeat+1)%4,top:(humanSeat+2)%4,left:(humanSeat+3)%4};
}
