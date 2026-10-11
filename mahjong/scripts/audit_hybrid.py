"""Independent standard-library audit of completed hybrid H experiments.

Does not import JavaScript simulation/statistics or change their outputs.
The journals store focal-player summaries, not all four final score vectors.
"""
import csv
import hashlib
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, stdev

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'results' / 'hybrid-20261011'
IDS = ['A', 'D', 'E', 'V1', 'Y1', 'M1', 'M2', 'M3']
COMPARISONS = [(m, r) for r in ['V1', 'Y1'] for m in ['M1', 'M2', 'M3']]


def read(path):
    return json.loads(path.read_text())


def sha(value):
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(value.encode()).hexdigest()


def close(actual, expected):
    assert math.isclose(actual, expected, abs_tol=1e-8), (actual, expected)


def random32(seed):
    state, mask = seed & 0xffffffff, 0xffffffff
    while True:
        state = (state + 0x6D2B79F5) & mask
        t = ((state ^ (state >> 15)) * (state | 1)) & mask
        t = (t ^ (t + (((t ^ (t >> 7)) * (t | 61)) & mask))) & mask
        yield ((t ^ (t >> 14)) & mask) / 4294967296


def initial_hash(seed):
    wall, random = list(range(136)), random32(seed)
    for i in range(135, 0, -1):
        j = int(next(random) * (i + 1))
        wall[i], wall[j] = wall[j], wall[i]
    hands = [sorted(wall[seat:52:4]) for seat in range(4)]
    hands[0] = sorted(hands[0] + [wall[52]])
    return sha({'hands': hands, 'wall': wall[53:], 'dead': []})


def quantile(values, p):
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    lo, hi = math.floor(index), math.ceil(index)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (index - lo)


manifest = read(OUT / 'manifest.json')
assert manifest['status'] == 'complete', 'Audit requires the completed run.'
plan = read(ROOT / 'configs/hybrid-20261011.json')
selection = read(OUT / 'selection.json')
analysis = read(OUT / 'analysis.json')
assert manifest['completedGames'] == manifest['counts']['total'] == 22276
assert manifest['counts'] == {'pilot': 100, 'tuning': 6048, 'holdout': 16128, 'total': 22276}
assert sha(plan) == manifest['planHash'] == selection['planHash']
assert sha((OUT / 'selection.json').read_text()) == manifest['selectionHash']
assert sha((ROOT / 'training/hybrid-run.mjs').read_text()) == manifest['runnerHash']
assert sha((ROOT / 'training/hybrid-analysis.mjs').read_text()) == manifest['analysisSourceHash']
code = [[str(path.relative_to(ROOT)), path.read_text()]
        for directory in ['engine', 'policies', 'sim']
        for path in sorted((ROOT / directory).glob('*.mjs'))]
assert sha(code) == manifest['code']['sha256']
assert any(name == 'policies/adaptive.mjs' for name, _ in code)
for item in manifest['code']['files']:
    assert sha((ROOT / item['name']).read_text()) == item['sha256']

parts = {}
for stage in ['pilot', 'tuning', 'holdout']:
    spec = plan[stage]
    parts[stage] = set(range(spec['seedStart'], spec['seedStart'] + spec['seedCount']))
assert sum(map(len, parts.values())) == len(set.union(*parts.values())) == 761
old = read(ROOT / 'configs/private-kan-training-20261011.json')
for stage in ['pilot', 'tuning', 'holdout']:
    previous = set(range(old[stage]['seedStart'], old[stage]['seedStart'] + old[stage]['seedCount']))
    assert not previous.intersection(set.union(*parts.values()))

experiments, initial, matched, merged = {}, {}, {}, []
stage_counts = defaultdict(int)
first_settings, holdout_start, clock_measurements = None, [], []
for entry in manifest['experiments']:
    stage, tag = entry['key'].split('/')
    folder = OUT / stage / tag
    sub, settings = read(folder / 'manifest.json'), read(folder / 'settings.json')
    stamp_seconds = sum((datetime.fromisoformat(run['finishedAt'].replace('Z', '+00:00')) - datetime.fromisoformat(run['startedAt'].replace('Z', '+00:00'))).total_seconds() for run in sub['runs'])
    clock_measurements.append({'experiment': entry['key'], 'timestampSeconds': stamp_seconds, 'monotonicSeconds': entry['seconds'], 'differenceSeconds': entry['seconds']-stamp_seconds})
    raw = (folder / 'games.jsonl').read_text()
    rows = [json.loads(line) for line in raw.splitlines()]
    assert entry['status'] == sub['status'] == 'complete'
    assert len(rows) == len({r['key'] for r in rows}) == sub['completed'] == sub['total'] == entry['games'] == entry['expected']
    assert sha(raw) == entry['rawHash']
    assert sub['code']['sha256'] == manifest['code']['sha256']
    assert settings == sub['config'] and sha(settings) == sub['configHash']
    assert settings['rules'] == manifest['rules']
    assert settings['rules']['concealedKanPrivate'] is True
    assert settings['rules']['id'] == 'H-2026-private-kan-v1'
    if first_settings is None:
        first_settings = settings
    for key in ['rules', 'policyDefinitions', 'opponentDefinitions']:
        assert settings[key] == first_settings[key]
    assert not list((folder / 'failures').glob('*.json'))
    saved_csv = list(csv.DictReader((folder / 'games.csv').open()))
    assert len(saved_csv) == len(rows)
    assert {r['key']: int(r['net']) for r in saved_csv} == {r['key']: r['net'] for r in rows}
    saved_seeds = list(csv.DictReader((folder / 'seeds.csv').open()))
    assert len(saved_seeds) == len(parts[stage])
    assert {int(r['seed']) for r in saved_seeds} == parts[stage]
    expected = {(seed, seat, policy) for seed in parts[stage] for seat in range(4) for policy in settings['policies']}
    assert {(r['seed'], r['seat'], r['policy']) for r in rows} == expected
    for r in rows:
        assert r['key'] == f"{r['seed']}:{r['seat']}:{r['policy']}"
        assert r['net'] == r['winReceipt'] + r['drawGain'] - r['dealInLoss'] - r['tsumoPaid'] - r['drawLoss']
        assert all(r[key] >= 0 for key in ['winReceipt', 'drawGain', 'dealInLoss', 'tsumoPaid', 'drawLoss'])
        assert r['won'] == r['ron'] + r['tsumo']
        assert r['topScore'] == int(r['scoreRank'] == 1)
        assert r['end'] in ('three-winners', 'exhaustive-draw')
        assert (r['winnerCount'] == 3) if r['end'] == 'three-winners' else (r['winnerCount'] < 3)
        assert r['profile'] == plan['profiles'][(r['seed'] - plan[stage]['seedStart']) % 6]
        initial.setdefault(r['seed'], r['initialHash'])
        assert initial[r['seed']] == r['initialHash']
        key = (r['seed'], r['seat'])
        matched.setdefault(key, (r['profile'], r['opponents']))
        assert matched[key] == (r['profile'], r['opponents'])
    if stage == 'holdout':
        version = next(v for v in selection['controls'] + selection['versions'] if v['id'] == tag)
        assert settings['weights'] == {version['policy']: version['weights']}
        holdout_start.extend(run['startedAt'] for run in sub['runs'])
        merged.extend([{**r, 'policy': tag} for r in rows])
    stage_counts[stage] += len(rows)
    experiments[entry['key']] = rows

assert len(experiments) == 19
assert dict(stage_counts) == {stage: manifest['counts'][stage] for stage in parts}
assert len(initial) == 761
for seed, recorded in initial.items():
    assert initial_hash(seed) == recorded, ('Reconstructed wall mismatch', seed)
assert selection['frozenAt'] == manifest['frozenAt'] < min(holdout_start)
assert selection['controls'] == plan['controls']
for version in selection['versions']:
    candidates = [(mean(r['net'] for r in experiments[f"tuning/{version['id']}-{i}"]), f"{version['id']}-{i}") for i in [1, 2]]
    chosen = sorted(candidates, key=lambda item: (-item[0], item[1]))[0]
    assert version['candidate'] == chosen[1]
    close(version['tuningMean'], chosen[0])
    config = read(OUT / 'tuning' / chosen[1] / 'settings.json')
    assert config['weights'] == {version['policy']: version['weights']}
preferred = sorted(selection['versions'], key=lambda v: (-v['tuningMean'], v['id']))[0]['id']
assert selection['preferredVersion'] == preferred

csv_merged = list(csv.DictReader((OUT / 'holdout-games.csv').open()))
assert len(csv_merged) == len(merged) == 16128
assert {(int(r['seed']), int(r['seat']), r['policy']): int(r['net']) for r in csv_merged} == {(r['seed'], r['seat'], r['policy']): r['net'] for r in merged}
by_policy = {policy: [r for r in merged if r['policy'] == policy] for policy in IDS}
assert all(len(rows) == 2016 for rows in by_policy.values())
means = {policy: mean(r['net'] for r in rows) for policy, rows in by_policy.items()}
clusters = defaultdict(lambda: {policy: [] for policy in IDS})
profile_by_seed = {}
for r in merged:
    clusters[r['seed']][r['policy']].append(r['net'])
    profile_by_seed[r['seed']] = r['profile']
strata = {}
for seed in sorted(clusters):
    assert all(len(values) == 4 for values in clusters[seed].values())
    strata.setdefault(profile_by_seed[seed], []).append([mean(clusters[seed][policy]) for policy in IDS])
assert len(clusters) == 504 and all(len(vectors) == 84 for vectors in strata.values())

# For symmetric A/A/A/A and D/D/D/D controls, the four seat-switched rows
# describe one identical four-player game, permitting a real zero-sum check.
zero_sum_controls = 0
for policy, profile in [('A', 'speed'), ('D', 'value')]:
    for seed in clusters:
        if profile_by_seed[seed] == profile:
            assert sum(clusters[seed][policy]) == 0
            zero_sum_controls += 1

for summary in analysis['summary']:
    rows = by_policy[summary['policy']]
    close(summary['meanNet'], means[summary['policy']])
    for output, field in [('winRate', 'won'), ('firstWinRate', 'firstWin'), ('meanRank', 'scoreRank'), ('topScoreRate', 'topScore'), ('winReceiptPerGame', 'winReceipt'), ('dealInLossPerGame', 'dealInLoss'), ('tsumoPaidPerGame', 'tsumoPaid'), ('drawLossPerGame', 'drawLoss'), ('drawGainPerGame', 'drawGain')]:
        close(summary[output], mean(r[field] for r in rows))
    winners = [r for r in rows if r['won']]
    for output, field in [('ronShareAmongWins', 'ron'), ('tsumoShareAmongWins', 'tsumo'), ('averageWinOrder', 'winOrder'), ('averageWinDrawNumber', 'winDrawNumber'), ('netAmongWins', 'net')]:
        close(summary[output], mean(r[field] for r in winners))
for summary in analysis['profileSummary']:
    rows = [r for r in by_policy[summary['policy']] if r['profile'] == summary['profile']]
    assert len(rows) == summary['games'] == 336
    close(summary['meanNet'], mean(r['net'] for r in rows))

random = random32(plan['bootstrap']['seed'])
boot = {policy: [] for policy in IDS}
for _ in range(plan['bootstrap']['samples']):
    sums = [0.0] * len(IDS)
    for vectors in strata.values():
        for _ in vectors:
            vector = vectors[int(next(random) * len(vectors))]
            for i, value in enumerate(vector):
                sums[i] += value
    for i, policy in enumerate(IDS):
        boot[policy].append(sums[i] / len(clusters))
for summary in analysis['summary']:
    close(summary['ci95Low'], quantile(boot[summary['policy']], .025))
    close(summary['ci95High'], quantile(boot[summary['policy']], .975))
standard_errors = {}
for pair in analysis['pairs']:
    p, r = pair['policy'], pair['reference']
    differences = [a-b for a, b in zip(boot[p], boot[r])]
    close(pair['meanDifference'], means[p]-means[r])
    close(pair['ci95Low'], quantile(differences, .025))
    close(pair['ci95High'], quantile(differences, .975))
    # Fixed-stratum design: sum_h weight_h**2 * sampleVar_h / n_h.
    variance = 0.0
    for vectors in strata.values():
        diffs = [v[IDS.index(p)]-v[IDS.index(r)] for v in vectors]
        variance += (len(vectors)/len(clusters))**2 * stdev(diffs)**2 / len(vectors)
    standard_errors[pair['comparison']] = math.sqrt(variance)
assert [(r['policy'], r['reference']) for r in analysis['improvements']] == COMPARISONS
for comparison in analysis['improvements']:
    differences = [a-b for a, b in zip(boot[comparison['policy']], boot[comparison['reference']])]
    close(comparison['simultaneousLow'], quantile(differences, .05/12))
    close(comparison['simultaneousHigh'], quantile(differences, 1-.05/12))
    assert comparison['familySize'] == 6

command_seconds = sum(run['elapsedSeconds'] for run in manifest['runs'])
close(command_seconds, manifest['elapsedSeconds'])
simulation_seconds = sum(entry['seconds'] for entry in manifest['experiments'])
close(simulation_seconds, manifest['simulationSeconds'])

result = {
    'status': 'passed', 'auditedAt': datetime.now(timezone.utc).isoformat(),
    'script': 'scripts/audit_hybrid.py', 'completedGames': 22276,
    'stageGames': dict(stage_counts), 'experiments': len(experiments),
    'initialWallsIndependentlyReconstructed': len(initial),
    'holdoutSeedClusters': 504, 'holdoutGames': len(merged),
    'gamesPerPolicy': 2016, 'seedsPerOpponentProfile': 84,
    'codeHashMatchesCurrent': True, 'codeHash': manifest['code']['sha256'],
    'adaptiveModuleIncludedInCodeHash': True, 'allRawAndConfigHashesMatch': True,
    'ruleAndOpponentDefinitionsMatch': True, 'concealedKanPrivateEveryExperiment': True,
    'selectionHashMatches': True, 'selectionFrozenAt': selection['frozenAt'],
    'firstHoldoutStartedAt': min(holdout_start), 'selectionFrozenBeforeHoldout': True,
    'selectionMatchesTuningMaximum': True, 'preferredVersionFrozenFromTuning': preferred,
    'seedPartitionsDisjointIncludingPriorExperiment': True,
    'initialConditionsAndOpponentsMatched': True, 'grossNetAttributionAllRows': True,
    'symmetricControlSeedGamesIndependentlyZeroSum': zero_sum_controls,
    'fourPlayerScoreVectorsAvailableForEveryGame': False,
    'noFailureReplayFiles': True, 'independentGlobal95Intervals': len(analysis['summary']),
    'independentPaired95Intervals': len(analysis['pairs']),
    'independentBonferroniIntervals': len(analysis['improvements']),
    'bootstrapReplicates': plan['bootstrap']['samples'],
    'bootstrapRng': 'Independent Python Mulberry32 with uint32 wrapping',
    'profileMeansAndCountsChecked': len(analysis['profileSummary']),
    'profileIntervalsIndependentlyResampled': False,
    'timing': {
        'commandTimestampSecondsSum': command_seconds,
        'simulationMonotonicSecondsSum': simulation_seconds,
        'childTimestampSecondsSum': sum(item['timestampSeconds'] for item in clock_measurements),
        'largestClockDifference': max(clock_measurements, key=lambda item: abs(item['differenceSeconds'])),
        'note': 'Runner totals use calendar timestamps; child simulation durations use a monotonic clock. Do not add the pilot twice or treat these different clocks as identical.'
    },
    'meanNet': means, 'stratifiedClusterStandardErrors': standard_errors,
    'limits': [
        'Raw journals record focal summaries, not all four final scores or every transfer; independent zero-sum is checked only in symmetric controls. Engine invariants cover all simulated actions.',
        'Public-input privacy is exercised by regression tests and frozen code hashes; observation traces for every action are not stored or independently audited.',
        'Opponent subgroup means/counts are checked, but subgroup bootstrap intervals are not independently resampled here.'
    ]
}
(OUT / 'audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(result, ensure_ascii=False))
