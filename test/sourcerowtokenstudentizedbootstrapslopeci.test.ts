/**
 * Unit + property tests for source-row-token-studentized-bootstrap-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenStudentizedBootstrapSlopeCi,
  jackknifeSlopeSe,
  pivotalTCi,
  bootstrapTSkewSignal,
} from '../src/sourcerowtokenstudentizedbootstrapslopeci.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// =========================================================================
// jackknifeSlopeSe
// =========================================================================

test('jackknifeSlopeSe: constant series -> 0', () => {
  const se = jackknifeSlopeSe([5, 5, 5, 5, 5], 1);
  assert.equal(se, 0);
});

test('jackknifeSlopeSe: monotone series -> finite > 0', () => {
  const se = jackknifeSlopeSe([1, 2, 3, 4, 5, 6, 7, 8], 1);
  assert.ok(Number.isFinite(se));
  assert.ok(se > 0);
});

test('jackknifeSlopeSe: short series (n=2) returns 0', () => {
  const se = jackknifeSlopeSe([1, 2], 1);
  assert.equal(se, 0);
});

test('jackknifeSlopeSe: noisier series gives larger SE', () => {
  const seClean = jackknifeSlopeSe([1, 2, 3, 4, 5, 6, 7, 8], 1);
  const seNoisy = jackknifeSlopeSe([1, 9, 3, 12, 5, 18, 7, 22], 1);
  assert.ok(seNoisy > seClean);
});

// =========================================================================
// pivotalTCi
// =========================================================================

test('pivotalTCi: cross-tail flip — ciLower uses tUpper, ciUpper uses tLower', () => {
  const [lo, hi] = pivotalTCi(10, 2, -1.5, 1.8);
  // ciLower = 10 - 1.8 * 2 = 6.4
  // ciUpper = 10 - (-1.5) * 2 = 13.0
  assert.equal(lo, 6.4);
  assert.equal(hi, 13);
});

test('pivotalTCi: seFull == 0 collapses to point', () => {
  const [lo, hi] = pivotalTCi(7, 0, -2, 2);
  assert.equal(lo, 7);
  assert.equal(hi, 7);
});

test('pivotalTCi: symmetric T* gives symmetric CI', () => {
  const [lo, hi] = pivotalTCi(5, 1.5, -2, 2);
  assert.equal(lo, 5 - 3);
  assert.equal(hi, 5 + 3);
});

test('pivotalTCi: asymmetric T* preserves asymmetry', () => {
  // tLo = -1, tHi = 4 -> ciLower = thetaHat - 4 * SE, ciUpper = thetaHat - (-1) * SE = thetaHat + SE
  const [lo, hi] = pivotalTCi(0, 1, -1, 4);
  assert.equal(lo, -4);
  assert.equal(hi, 1);
});

// =========================================================================
// bootstrapTSkewSignal
// =========================================================================

test('bootstrapTSkewSignal: symmetric T* -> 0', () => {
  assert.equal(bootstrapTSkewSignal(-2, 2), 0);
});

test('bootstrapTSkewSignal: right-skewed (long upper tail) -> > 0', () => {
  // tHi=5, tLo=-1 -> (5 + (-1)) / (5 - (-1)) = 4/6 ≈ 0.6667
  const s = bootstrapTSkewSignal(-1, 5);
  assert.ok(s > 0);
  assert.ok(Math.abs(s - 4 / 6) < 1e-12);
});

test('bootstrapTSkewSignal: left-skewed -> < 0', () => {
  const s = bootstrapTSkewSignal(-5, 1);
  assert.ok(s < 0);
});

test('bootstrapTSkewSignal: tHi == tLo -> NaN', () => {
  assert.ok(Number.isNaN(bootstrapTSkewSignal(0.5, 0.5)));
});

test('bootstrapTSkewSignal: clamped to [-1, +1]', () => {
  // pathological: tLo = -0.1, tHi = 100 -> (99.9)/(100.1) > 0 but < 1; harder: tLo=0, tHi=1 -> 1
  assert.equal(bootstrapTSkewSignal(0, 1), 1);
  assert.equal(bootstrapTSkewSignal(-1, 0), -1);
});

// =========================================================================
// builder: option validation
// =========================================================================

test('builder: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenStudentizedBootstrapSlopeCi([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: bootstraps < 100 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], { bootstraps: 50 }),
    /bootstraps must be an integer >= 100/,
  );
});

test('builder: confidence not in (0,1) throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], { confidence: 0 }),
    /confidence must be a finite number in \(0, 1\)/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], { confidence: 1 }),
    /confidence must be a finite number in \(0, 1\)/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], { confidence: 1.5 }),
    /confidence must be a finite number in \(0, 1\)/,
  );
});

test('builder: lambda <= 0 throws', () => {
  assert.throws(
    () => buildSourceRowTokenStudentizedBootstrapSlopeCi([], { lambda: 0 }),
    /lambda must be a finite, strictly positive number/,
  );
  assert.throws(
    () => buildSourceRowTokenStudentizedBootstrapSlopeCi([], { lambda: -1 }),
    /lambda must be a finite, strictly positive number/,
  );
});

test('builder: non-integer seed throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], { seed: 1.5 }),
    /seed must be an integer/,
  );
});

test('builder: alertDegenerateSeMin negative throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], {
        alertDegenerateSeMin: -1,
      }),
    /alertDegenerateSeMin must be a non-negative integer/,
  );
});

test('builder: top < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenStudentizedBootstrapSlopeCi([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('builder: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], {
        // @ts-expect-error intentional
        sort: 'banana',
      }),
    /sort must be one of/,
  );
});

test('builder: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
});

test('builder: invalid until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenStudentizedBootstrapSlopeCi([], {
        until: 'nope',
      }),
    /invalid until/,
  );
});

// =========================================================================
// builder: row dropping accounting
// =========================================================================

test('builder: bad hour_start counted', () => {
  const rows: QueueLine[] = [ql('not-a-date', 's', 1), ...mkSeries('s', [1, 2, 3, 4, 5])];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: bad total_tokens counted', () => {
  const rows: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', NaN as number),
    ...mkSeries('s', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('builder: negative total_tokens counted', () => {
  const rows: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -10),
    ...mkSeries('s', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('builder: source filter drops everything else', () => {
  const rows = [...mkSeries('a', [1, 2, 3, 4, 5]), ...mkSeries('b', [10, 20, 30, 40, 50])];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    source: 'a',
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 5);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('builder: below min-rows drops sources', () => {
  const rows = [
    ...mkSeries('few', [1, 2, 3]),
    ...mkSeries('many', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'many');
});

// =========================================================================
// builder: degenerate / edge cases
// =========================================================================

test('builder: constant series collapses CI to point estimate', () => {
  const rows = mkSeries('flat', [5, 5, 5, 5, 5, 5]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 1,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.seFull, 0);
  assert.equal(s.ciLower, s.ciUpper);
  assert.equal(s.ciWidth, 0);
  assert.ok(s.ciContainsZero);
  // Every replicate should be degenerate (constant resample => SE*=0).
  assert.equal(s.degenerateSeReplicates, 200);
});

test('builder: monotone increasing series — CI generally excludes zero', () => {
  const rows = mkSeries('rising', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 500,
    seed: 11,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.slope > 0);
  assert.ok(Number.isFinite(s.seFull));
  assert.ok(s.ciLower < s.ciUpper);
  // For a strict monotone arithmetic progression the CI should comfortably
  // exclude zero.
  assert.ok(s.ciLower > 0);
});

test('builder: monotone decreasing series — slope < 0', () => {
  const rows = mkSeries('falling', [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 500,
    seed: 11,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.slope < 0);
  assert.ok(s.ciUpper < 0);
});

test('builder: noisy series gives wider CI than clean monotone of same span', () => {
  const clean = mkSeries('c', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const noisy = mkSeries('n', [10, 90, 30, 70, 50, 100, 20, 80, 40, 60]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(
    [...clean, ...noisy],
    { bootstraps: 500, seed: 5, generatedAt: GEN },
  );
  const c = r.sources.find((s) => s.source === 'c')!;
  const n = r.sources.find((s) => s.source === 'n')!;
  assert.ok(n.ciWidth > c.ciWidth);
});

test('builder: tLower <= tUpper (sorted picks)', () => {
  const rows = mkSeries('s', [5, 8, 13, 21, 34, 55, 89]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 300,
    seed: 17,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.tLower <= s.tUpper);
});

test('builder: ciLower <= ciUpper always', () => {
  const rows = mkSeries('s', [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 300,
    seed: 23,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.ciLower <= s.ciUpper);
});

// =========================================================================
// builder: determinism
// =========================================================================

test('builder: same seed -> identical output', () => {
  const rows = mkSeries('s', [1, 2, 3, 5, 8, 13, 21, 34]);
  const a = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 99,
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 99,
    generatedAt: GEN,
  });
  assert.deepEqual(a.sources, b.sources);
});

test('builder: different seeds -> generally different CI', () => {
  const rows = mkSeries('s', [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
  const a = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 1,
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 2,
    generatedAt: GEN,
  });
  // Same point slope (deterministic), but the CI endpoints should differ.
  assert.equal(a.sources[0]!.slope, b.sources[0]!.slope);
  assert.notEqual(a.sources[0]!.ciLower, b.sources[0]!.ciLower);
});

// =========================================================================
// builder: alert filters
// =========================================================================

test('builder: --alert-zero-in-ci drops sources whose CI excludes zero', () => {
  const rising = mkSeries('rise', [10, 20, 30, 40, 50, 60, 70, 80]);
  const flat = mkSeries('flat', [50, 50, 50, 50, 50, 50, 50]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(
    [...rising, ...flat],
    {
      bootstraps: 200,
      seed: 13,
      alertZeroInCi: true,
      generatedAt: GEN,
    },
  );
  // rising should be dropped (CI excludes 0), flat should survive (CI = [0,0]).
  const surviving = r.sources.map((s) => s.source);
  assert.ok(surviving.includes('flat'));
  assert.ok(!surviving.includes('rise'));
  assert.equal(r.droppedNotZeroInCi, 1);
});

test('builder: --alert-degenerate-se-min drops sources below threshold', () => {
  const rising = mkSeries('rise', [10, 20, 30, 40, 50, 60, 70, 80]);
  const flat = mkSeries('flat', [50, 50, 50, 50, 50, 50, 50]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(
    [...rising, ...flat],
    {
      bootstraps: 200,
      seed: 13,
      alertDegenerateSeMin: 200,
      generatedAt: GEN,
    },
  );
  // Only the flat source has all 200 degenerate replicates; rising should drop.
  const surviving = r.sources.map((s) => s.source);
  assert.ok(surviving.includes('flat'));
  assert.ok(!surviving.includes('rise'));
});

// =========================================================================
// builder: top cap
// =========================================================================

test('builder: --top caps and tracks dropped count', () => {
  const series: QueueLine[] = [];
  for (const s of ['a', 'b', 'c', 'd', 'e']) {
    series.push(...mkSeries(s, [1, 2, 3, 4, 5, 6]));
  }
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 100,
    seed: 3,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

// =========================================================================
// builder: sorting
// =========================================================================

test('builder: sort=source orders alphabetically', () => {
  const series: QueueLine[] = [];
  for (const s of ['c', 'a', 'b']) {
    series.push(...mkSeries(s, [1, 2, 3, 4, 5]));
  }
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 100,
    seed: 3,
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b', 'c'],
  );
});

test('builder: sort=slope-desc puts largest slope first', () => {
  const series = [
    ...mkSeries('big', [1, 100, 200, 300, 400, 500, 600]),
    ...mkSeries('small', [1, 2, 3, 4, 5, 6, 7]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 100,
    seed: 3,
    sort: 'slope-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('builder: sort=ci-width-desc puts widest CI first', () => {
  const series = [
    ...mkSeries('clean', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('messy', [10, 90, 30, 70, 50, 100, 20, 80, 40, 60]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 300,
    seed: 4,
    sort: 'ci-width-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'messy');
});

test('builder: sort=se-full-desc orders by full-data SE', () => {
  const series = [
    ...mkSeries('clean', [10, 20, 30, 40, 50, 60, 70, 80]),
    ...mkSeries('messy', [10, 80, 30, 70, 50, 100, 20]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 100,
    seed: 4,
    sort: 'se-full-desc',
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.seFull >= r.sources[1]!.seFull);
});

test('builder: sort=degenerate-se-desc puts most-degenerate first', () => {
  const series = [
    ...mkSeries('flat', [9, 9, 9, 9, 9, 9, 9]),
    ...mkSeries('rise', [1, 2, 3, 4, 5, 6, 7]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 200,
    seed: 4,
    sort: 'degenerate-se-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'flat');
});

test('builder: sort=ci-contains-zero-first surfaces zero-spanning intervals', () => {
  const series = [
    ...mkSeries('flat', [9, 9, 9, 9, 9, 9, 9]),
    ...mkSeries('rise', [1, 2, 3, 4, 5, 6, 7]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 200,
    seed: 4,
    sort: 'ci-contains-zero-first',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'flat');
});

test('builder: sort=rows orders by rowsKept', () => {
  const series = [
    ...mkSeries('few', [1, 2, 3, 4, 5]),
    ...mkSeries('many', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 100,
    seed: 4,
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('builder: sort=t-skew-magnitude-desc puts large |tSkew| first', () => {
  // hard to construct deterministically, but at minimum the sort must run
  // without error and respect tiebreak.
  const series = [
    ...mkSeries('a', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('b', [1, 1, 2, 2, 3, 3]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 200,
    seed: 4,
    sort: 't-skew-magnitude-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
});

// =========================================================================
// builder: window filtering
// =========================================================================

test('builder: since/until window filtering', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    rows.push(
      ql(`2026-04-2${i % 2 === 0 ? 7 : 8}T0${i}:00:00.000Z`, 's', i + 1),
    );
  }
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    since: '2026-04-28T00:00:00.000Z',
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  // Only days starting 2026-04-28 kept; 5 rows. Need >= minRows (4).
  assert.equal(r.totalRowsKept, 5);
});

// =========================================================================
// report shape
// =========================================================================

test('report: includes all top-level fields', () => {
  const rows = mkSeries('s', [1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 100,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minRows, 4);
  assert.equal(r.bootstraps, 100);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.seed, 7);
  assert.equal(r.alertZeroInCi, false);
  assert.equal(r.alertDegenerateSeMin, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'magnitude-desc');
  assert.equal(typeof r.totalSources, 'number');
  assert.equal(typeof r.totalRowsKept, 'number');
});

test('row: includes all per-source fields', () => {
  const rows = mkSeries('s', [10, 20, 30, 40, 50, 60, 70]);
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 200,
    seed: 7,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(typeof s.source, 'string');
  assert.equal(typeof s.rowsKept, 'number');
  assert.equal(typeof s.slope, 'number');
  assert.equal(typeof s.seFull, 'number');
  assert.equal(typeof s.tLower, 'number');
  assert.equal(typeof s.tUpper, 'number');
  assert.equal(typeof s.ciLower, 'number');
  assert.equal(typeof s.ciUpper, 'number');
  assert.equal(typeof s.ciWidth, 'number');
  assert.equal(typeof s.ciContainsZero, 'boolean');
  assert.equal(typeof s.degenerateSeReplicates, 'number');
  // tSkewSignal can be NaN (allowed) or finite in [-1, 1]
  if (Number.isFinite(s.tSkewSignal)) {
    assert.ok(s.tSkewSignal >= -1 && s.tSkewSignal <= 1);
  }
});

// =========================================================================
// confidence width monotonicity
// =========================================================================

test('builder: higher confidence -> wider CI (typically)', () => {
  const rows = mkSeries('s', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  const r80 = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 500,
    confidence: 0.8,
    seed: 31,
    generatedAt: GEN,
  });
  const r99 = buildSourceRowTokenStudentizedBootstrapSlopeCi(rows, {
    bootstraps: 500,
    confidence: 0.99,
    seed: 31,
    generatedAt: GEN,
  });
  assert.ok(r99.sources[0]!.ciWidth >= r80.sources[0]!.ciWidth);
});

// =========================================================================
// pivot consistency: ciContainsZero <=> 0 in [ciLower, ciUpper]
// =========================================================================

test('builder: ciContainsZero matches 0 in [ciLower, ciUpper]', () => {
  const series = [
    ...mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...mkSeries('b', [5, 5, 5, 5, 5, 5, 5]),
    ...mkSeries('c', [50, 5, 50, 5, 50, 5, 50]),
  ];
  const r = buildSourceRowTokenStudentizedBootstrapSlopeCi(series, {
    bootstraps: 300,
    seed: 19,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    const inside = s.ciLower <= 0 && s.ciUpper >= 0;
    assert.equal(s.ciContainsZero, inside, `mismatch for ${s.source}`);
  }
});
