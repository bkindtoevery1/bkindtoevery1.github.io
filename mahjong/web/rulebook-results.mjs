import {RULEBOOK_TRAINING} from '../game/rulebook-training.mjs';

const fixed=n=>Number.isFinite(n)?n.toFixed(2):'—';
const percent=n=>Number.isFinite(n)?`${(n*100).toFixed(1)}%`:'—';
const interval=(low,high)=>`${fixed(low)} ~ ${fixed(high)}`;
export const rulebookVerdict=row=>row.ci99Low>0?'기존 대비 순수익 개선 확인':row.ci99High<0?'기존 대비 순수익 낮음':'순수익 차이 미확정';
export function rulebookVersionNote(version,{displayId=version.id}={}){
 const r=version.validation,c=r.comparison;
 return `${displayId} · ${version.name} · 새 규칙 별도 시드 검증 · 국당 ${fixed(r.meanNet)}점 · 화료율 ${percent(r.winRate)} · ${rulebookVerdict(c)}${version.objective==='highValue'?` · 고득점 목적: 기존 D보다 국당 ${fixed(Math.abs(c.meanDifference))}점 ${c.meanDifference<0?'낮음':'높음'}, 수익 개선형이 아닙니다.`:''}`;
}
export function rulebookResultModel(training=RULEBOOK_TRAINING){
 const {counts,summary,versions,improvements,validationSeeds}=training??{},ids=['A','B','C','D','E','A+','B+','C+','D+','E+'];
 if(training?.status!=='complete'||!counts||!Array.isArray(summary)||summary.length!==10||!Array.isArray(versions)||versions.length!==5||!Array.isArray(improvements)||improvements.length!==5||!Number.isSafeInteger(validationSeeds)||validationSeeds<2||counts.holdout!==validationSeeds*4*10||training.completedGames!==counts.pilot+counts.tuning+counts.holdout||!Number.isFinite(training.elapsedSeconds))throw new Error('완료된 검증 기록을 확인하지 못했습니다.');
 for(const id of ids){const rows=summary.filter(r=>r.policy===id);if(rows.length!==1||rows[0].games!==validationSeeds*4||![rows[0].meanNet,rows[0].ci95Low,rows[0].ci95High,rows[0].winRate].every(Number.isFinite))throw new Error('정책별 완료 국 수와 결과가 일치하지 않습니다.');}
 for(const [index,version]of versions.entries()){
  const baseline='ABCDE'[index],r=summary.find(row=>row.policy===version.id),c=improvements.find(row=>row.policy===version.id&&row.reference===baseline);
  if(version.id!==baseline+'+'||version.policy!==baseline||!c||![c.meanDifference,c.ci99Low,c.ci99High].every(Number.isFinite)||JSON.stringify(version.validation)!==JSON.stringify({...r,comparison:c}))throw new Error('동결한 전략과 검증 결과가 일치하지 않습니다.');
 }
 const sorted=[...summary].sort((a,b)=>b.meanNet-a.meanNet),best=sorted[0],approved=versions.filter(v=>v.validation.comparison.ci99Low>0).map(v=>v.id);
 return {training,summary:sorted,versions,improvements,best,
  conclusion:`이번 자동 대국의 평균 순수익은 현재 ${best.policy.replace('+','')}가 국당 ${fixed(best.meanNet)}점으로 가장 높았습니다. 학습 전 기준과의 다섯 비교를 보정한 뒤 개선을 확인한 전략: ${approved.map(id=>id.replace('+','')).join(', ')||'없음'}. 아래에서 내 자동 대국 전략을 선택할 수 있습니다.`};
}
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function rows(target,data,values){target.replaceChildren();for(const row of data){const tr=element('tr');for(const text of values(row))tr.append(element('td',text));target.append(tr);}}
export function renderRulebookResults(get,{training=RULEBOOK_TRAINING,onSelect=()=>{},canSelect=()=>false}={}){
 const status=get('rulebook-training-status'),content=get('rulebook-training-data'),conclusion=get('rulebook-training-conclusion');
 if(!status||!content||!conclusion)return;
 content.hidden=true;
 try{
  const model=rulebookResultModel(training),c=training.counts;
  status.textContent=`10/14 개정 H룰 · ${training.completedGames.toLocaleString()}국 완료 · ${(training.elapsedSeconds/3600).toFixed(2)}시간`;
  conclusion.textContent=model.conclusion;
  get('rulebook-training-design').textContent=`점검 ${c.pilot.toLocaleString()}국 · 튜닝 ${c.tuning.toLocaleString()}국 · 별도 검증 ${c.holdout.toLocaleString()}국 (${training.validationSeeds.toLocaleString()}개 새 시드 × 4자리 × 10전략). 상대 6성향 × 동·남장 12층의 비율을 유지하고, 같은 시드의 모든 자리·정책을 묶어 신뢰구간을 계산했습니다.`;
  const cards=get('rulebook-training-versions');cards.replaceChildren();
  for(const v of model.versions){
   const card=element('article');card.className='training-version-card';
   const r=v.validation,description=element('p',v.description),verdict=element('p',rulebookVersionNote(v,{displayId:v.policy}));verdict.className='training-version-verdict';
   card.append(element('h3',`${v.policy} · ${v.name}`),description,verdict);
   if(v.objective==='highValue')card.append(element('p',`화료 시 평균 원역 기본점 ${fixed(r.meanOriginalBaseAmongWins)}점 · 화료 중 400점 이상 ${percent(r.high400ShareAmongWins)}, 800점 이상 ${percent(r.high800ShareAmongWins)}. 깡 +1판·사귀일·번패 가산 전 기준입니다.`));
   const button=element('button',`${v.policy}를 내 자동 대국에 선택`);button.dataset.rulebookVersion=v.id;button.disabled=!canSelect(v.id);button.onclick=()=>onSelect(v.id);card.append(button);cards.append(card);
  }
  rows(get('rulebook-training-summary'),model.summary,r=>[`${r.policy.replace('+','')} · ${r.policy.endsWith('+')?'현재':'비교 기준'}`,fixed(r.meanNet),interval(r.ci95Low,r.ci95High),percent(r.winRate),percent(r.ronShareAmongWins),percent(r.tsumoShareAmongWins)]);
  rows(get('rulebook-training-comparisons'),model.improvements,r=>[`현재 ${r.policy.replace('+','')} − 기준 ${r.reference}`,fixed(r.meanDifference),interval(r.ci99Low,r.ci99High),rulebookVerdict(r)]);
  content.hidden=false;
 }catch(error){status.textContent='새 규칙 검증 기록 확인 필요';conclusion.textContent=error.message;}
}
