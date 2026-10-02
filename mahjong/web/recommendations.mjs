import {tileName} from '../engine/tiles.mjs';
import {chooseAction, evaluateDiscards, POLICIES} from '../policies/index.mjs';

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

function reasonFor(action, view, policy) {
  if (action.type === 'tsumo') return '지금 쯔모 화료할 수 있습니다.';
  if (action.type === 'ron') return policy === 'C'
    ? '이 규칙에서는 론을 넘길 수 없어 화료합니다.' : '완성된 패로 지금 론 화료합니다.';
  if (action.type === 'pass') {
    if (view.legalActions.some(a => a.type === 'ron')) return '합법적인 론을 넘기고 쯔모를 기다리는 선택입니다.';
    if (view.legalActions.length === 1) return '론이나 후로가 불가능해 넘깁니다.';
    return '후로 이후의 형태와 손패 유지를 비교해 넘기기를 선택했습니다.';
  }
  if (action.type === 'chi' || action.type === 'pon') return '후로 이후에 버릴 패까지 비교한 선택입니다.';
  if (['ankan', 'kakan', 'minkan'].includes(action.type)) return '보충패를 받기 전의 형태를 기준으로 깡을 평가했습니다.';
  return focus[policy];
}

// The only input is the engine's own-hand/public-information observation.
// Recommendation actions use the exact same policy function as automatic play.
export function strategyRecommendations(view) {
  if (!view.legalActions.length) return [];
  const discards = view.legalActions.filter(a => a.type === 'discard');
  return Object.entries(POLICIES).map(([policy, config]) => {
    const action = chooseAction(view, policy);
    let discard = null;
    if (discards.length && action.type !== 'tsumo') {
      // Keep the policy's shanten-loss limit when offering a discard instead of a kan.
      const selected = action.type === 'discard' ? action
        : chooseAction({...view, legalActions: discards}, policy);
      const metrics = evaluateDiscards({...view, legalActions: [selected]}, policy)[0];
      discard = {
        action: {...selected}, label: actionLabel(selected),
        shanten: metrics.shanten, ukeire: metrics.ukeire,
      };
    }
    return {
      policy, name: config.name, action: {...action}, label: actionLabel(action, view),
      reason: reasonFor(action, view, policy), discard,
    };
  });
}
