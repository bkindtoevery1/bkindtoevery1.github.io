import {tileName} from '../engine/tiles.mjs';
import {legalWinScore} from '../policies/index.mjs';
import {chooseAction, POLICIES} from '../game/policies.mjs';
import {explainDiscards} from './recommendation-explanation.mjs';
import {scoreDisplayName} from '../game/win-label.mjs';

const focus = {
  A: '샨텐을 먼저 줄이고 유효패가 많은 쪽을 고릅니다.',
  B: '순자 중심의 핑후 형태와 빠른 완성을 함께 봅니다.',
  C: '핑후 형태를 우선하며, 론을 넘길 수 있으면 쯔모를 기다립니다.',
  D: '속도와 함께 높은 역을 만들 가능성을 평가합니다.',
  E: '속도·역 가치·남은 상대 수와 공개된 위험 정보를 함께 봅니다.',
};

export function actionLabel(action, view = {}) {
  switch (action.type) {
    case 'discard': return `${tileName(action.tile)} 버리기`;
    case 'riichi': return `리치 · ${tileName(action.tile)} 버리기`;
    case 'tsumo': return '쯔모 화료';
    case 'ron': return '론 화료';
    case 'pass': return view.legalActions?.some(a => a.type === 'ron') ? '론 넘기기' : '넘기기';
    case 'chi': return `치 · ${[action.tile, action.tile + 1, action.tile + 2].map(tileName).join(' ')}`;
    case 'pon': return `퐁 · ${tileName(action.tile)}`;
    case 'minkan': return `명깡 · ${tileName(action.tile)}`;
    case 'ankan': return `안깡 · ${tileName(action.tile)}`;
    case 'kakan': return `가깡 · ${tileName(view.melds[action.meld].tile)}`;
    default: throw new Error('알 수 없는 추천 행동입니다.');
  }
}

function reasonFor(action, view, policy, weights) {
  const adaptive=view.rules.variant!=='S'&&weights?.adaptiveDefense>0;
  if(action.type==='riichi')return view.rules.riichiIsYaku===true?'멘젠 텐파이로 1,000점을 공탁합니다. 새 S룰에서는 리치 자체가 1판 역입니다.':'멘젠 텐파이로 1,000점을 공탁합니다. 이 대국의 구 S룰에서는 리치 외의 화료 역이 필요합니다.';
  if (action.type === 'tsumo') return '지금 쯔모 화료할 수 있습니다.';
  if (action.type === 'ron') return policy === 'C'
    ? '이 규칙에서는 론을 넘길 수 없어 화료합니다.' : '완성된 패로 지금 론 화료합니다.';
  if (action.type === 'pass') {
    if (view.legalActions.some(a => a.type === 'ron')) return view.rules.variant==='S'?'론을 넘겨 후리텐이 됩니다. 리치 중이면 이 국에서 다시 론할 수 없습니다.':view.rules.passRonLock==='same-tile-until-draw'?'론을 넘깁니다. 다음 자기 쯔모 전에는 같은 패로 다시 론할 수 없습니다. 판수가 높아지면 예외이며, 쯔모는 가능합니다.':'합법적인 론을 넘기고 쯔모를 기다리는 선택입니다.';
    if (view.legalActions.length === 1) return '론이나 후로가 불가능해 넘깁니다.';
    return '후로 이후의 형태와 손패 유지를 비교해 넘기기를 선택했습니다.';
  }
  if (action.type === 'chi' || action.type === 'pon') return '후로 이후에 버릴 패까지 비교한 선택입니다.';
  if (['ankan', 'kakan', 'minkan'].includes(action.type)) return adaptive
    ? '공개 정보상 아직 보이지 않은 보충패 후보를 가중하고, 보충 후 화료 또는 버릴 패까지 비교해 깡을 평가했습니다. 실제 보충패나 패산 순서는 보지 않습니다.'
    : '보충패를 받기 전의 형태를 기준으로 깡을 평가했습니다.';
  if(adaptive)return '완성 속도·손 가치·남은 지급자 수와 공개된 위협을 함께 비교하고, 손의 상태에 따라 수비 감점을 조절합니다.';
  if(policy==='E'&&weights?.risk===0)return '속도·역 가치·남은 상대 수를 봅니다. 이 학습 버전은 위험도 감점을 쓰지 않습니다.';
  return focus[policy];
}

function deferredWinReason(view,action,weights){
 if(view.rules.variant==='S'||!weights?.minWinBase||['ron','tsumo'].includes(action.type)||view.wallRemaining<=(weights.minWinWall??0))return '';
 const method=view.legalActions.some(a=>a.type==='tsumo')?'tsumo':'ron',score=legalWinScore(view,method);
 if(!score||score.base>=weights.minWinBase)return '';
 return `지금 ${scoreDisplayName(score)}의 역 점수는 ${score.base}점으로 목표 ${weights.minWinBase}점보다 낮아 ${method==='ron'?'론을':'쯔모를'} 넘깁니다. 번패·사귀일·쯔모 가산은 목표 역 점수에서 제외합니다. 패산 ${weights.minWinWall??0}장 이하에서는 낮은 점수도 화료합니다.`;
}

// The only input is the engine's own-hand/public-information observation.
// Recommendation actions use the exact same policy function as automatic play.
export function strategyRecommendations(view, weights = {}) {
  if (!view.legalActions.length) return [];
  const discards = view.legalActions.filter(a => a.type === 'discard');
  return Object.entries(POLICIES).map(([policy, config]) => {
    const action = chooseAction(view, policy, weights[policy]);
    let discard = null;
    if (discards.length && action.type !== 'tsumo') {
      // Keep the policy's shanten-loss limit when offering a discard instead of a kan.
      const selected = action.type === 'discard' ? action
        : chooseAction({...view, legalActions: discards}, policy, weights[policy]);
      const explanation=explainDiscards({...view,legalActions:discards},policy,weights[policy],selected);
      const metrics=explanation.ranking.find(row=>row.tile===selected.tile);
      discard = {
        action: {...selected}, label: actionLabel(selected),
        shanten: metrics.shanten, ukeire: metrics.ukeire,
        reason:explanation.reason,ranking:explanation.ranking,excludedCount:explanation.excludedCount,
      };
    }
    return {
      policy, name: config.name, action: {...action}, label: actionLabel(action, view),
      reason: [deferredWinReason(view,action,weights[policy]),action.type==='discard'?discard.reason:reasonFor(action, view, policy, weights[policy])].filter(Boolean).join(' '), discard,
    };
  });
}
