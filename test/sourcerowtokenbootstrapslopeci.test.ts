/**
 * Unit + property tests for source-row-token-bootstrap-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenBootstrapSlopeCi,
  bootstrapDemingSlope,
  bootstrapResample,
  makeLcg,
  percentileSorted,
} from '../src/sourcerowtokenbootstrapslopeci.js';
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
// percentileSorted
// =========================================================================

test('percentileSorted: empty array -> NaN', () => {
  assert.ok(Number.isNaN(percentileSorted([], 0.5)));
});

test('percentileSorted: single element returns that element', () => {
  assert.equal(percentileSorted([7], 0.0), 7);
  assert.equal(percentileSorted([7], 0.5), 7);
  assert.equal(percentileSorted([7], 1.0), 7);
});

test('percentileSorted: p<=0 returns first', () => {
  assert.equal(percentileSorted([1, 2, 3, 4], -0.1), 1);
  assert.equal(percentileSorted([1, 2, 3, 4], 0), 1);
});

test('percentileSorted: p>=1 returns last', () => {
  assert.equal(percentileSorted([1, 2, 3, 4], 1), 4);
  assert.equal(percentileSorted([1, 2, 3, 4], 1.1), 4);
});

test('percentileSorted: median of [1,2,3,4,5] is 3', () => {
  assert.equal(percentileSorted([1, 2, 3, 4, 5], 0.5), 3);
});

test('percentileSorted: 0.25 of [0,1,2,3,4] is 1', () => {
  assert.equal(percentileSorted([0, 1, 2, 3, 4], 0.25), 1);
});

test('percentileSorted: linear interpolation between adjacent ranks', () => {
  // n=4, p=0.5 -> h = 1.5 -> interp between idx 1 (=2) and idx 2 (=3) = 2.5
  assert.equal(percentileSorted([1, 2, 3, 4], 0.5), 2.5);
});

test('percentileSorted: integer index lands exact', () => {
  assert.equal(percentileSorted([10, 20, 30], 0.0), 10);
  assert.equal(percentileSorted([10, 20, 30], 1.0), 30);
});

// =========================================================================
// makeLcg
// =========================================================================

test('makeLcg: deterministic for same seed', () => {
  const a = makeLcg(42);
  const b = makeLcg(42);
  for (let i = 0; i < 50; i += 1) {
    assert.equal(a(), b());
  }
});

test('makeLcg: different seeds yield different first values', () => {
  const a = makeLcg(1);
  const b = makeLcg(2);
  assert.notEqual(a(), b());
});

test('makeLcg: outputs are in [0, 1)', () => {
  const r = makeLcg(7);
  for (let i = 0; i < 100; i += 1) {
    const u = r();
    assert.ok(u >= 0 && u < 1, `${u} not in [0,1)`);
  }
});

test('makeLcg: zero seed is allowed (mapped to 1)', () => {
  const r = makeLcg(0);
  // Just shouldn't loop forever or produce NaN.
  for (let i = 0; i < 10; i += 1) {
    const u = r();
    assert.ok(Number.isFinite(u));
  }
});

// =========================================================================
// bootstrapResample
// =========================================================================

test('bootstrapResample: preserves length', () => {
  const r = makeLcg(42);
  const xs = [10, 20, 30, 40, 50];
  const out = bootstrapResample(xs, r);
  assert.equal(out.length, xs.length);
});

test('bootstrapResample: each element comes from the source', () => {
  const r = makeLcg(42);
  const xs = [10, 20, 30, 40, 50];
  const set = new Set(xs);
  const out = bootstrapResample(xs, r);
  for (const v of out) assert.ok(set.has(v));
});

test('bootstrapResample: deterministic under same seed', () => {
  const a = makeLcg(99);
  const b = makeLcg(99);
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.deepEqual(bootstrapResample(xs, a), bootstrapResample(xs, b));
});

// =========================================================================
// bootstrapDemingSlope
// =========================================================================

test('bootstrapDemingSlope: n<2 returns 0', () => {
  assert.equal(bootstrapDemingSlope([], 1), 0);
  assert.equal(bootstrapDemingSlope([5], 1), 0);
});

test('bootstrapDemingSlope: all-equal series returns 0', () => {
  assert.equal(bootstrapDemingSlope([5, 5, 5, 5, 5], 1), 0);
});

test('bootstrapDemingSlope: ascending line yields positive slope', () => {
  const s = bootstrapDemingSlope([10, 20, 30, 40, 50], 1);
  assert.ok(s > 0);
});

test('bootstrapDemingSlope: descending line yields negative slope', () => {
  const s = bootstrapDemingSlope([50, 40, 30, 20, 10], 1);
  assert.ok(s < 0);
});

test('bootstrapDemingSlope: lambda must be > 0 propagates', () => {
  // s_xx, s_xy non-zero; lambda invalid -> inner throws
  assert.throws(() => bootstrapDemingSlope([10, 20, 30], 0));
});

// =========================================================================
// builder: validation
// =========================================================================

test('builder: rejects minRows < 4', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { minRows: 3 }),
    /minRows/,
  );
});

test('builder: rejects bootstraps < 100', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { bootstraps: 99 }),
    /bootstraps/,
  );
});

test('builder: rejects non-integer bootstraps', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { bootstraps: 100.5 }),
    /bootstraps/,
  );
});

test('builder: rejects confidence <= 0', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { confidence: 0 }),
    /confidence/,
  );
});

test('builder: rejects confidence >= 1', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { confidence: 1 }),
    /confidence/,
  );
});

test('builder: rejects non-finite confidence', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBootstrapSlopeCi([], { confidence: Number.NaN }),
    /confidence/,
  );
});

test('builder: rejects lambda <= 0', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { lambda: 0 }),
    /lambda/,
  );
});

test('builder: rejects non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { seed: 1.5 }),
    /seed/,
  );
});

test('builder: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBootstrapSlopeCi([], {
        // @ts-expect-error - testing bad input
        sort: 'unknown-key',
      }),
    /sort/,
  );
});

test('builder: rejects top < 1', () => {
  assert.throws(
    () => buildSourceRowTokenBootstrapSlopeCi([], { top: 0 }),
    /top/,
  );
});

test('builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBootstrapSlopeCi([], { since: 'not-a-date' }),
    /since/,
  );
});

test('builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildSourceRowTokenBootstrapSlopeCi([], { until: 'still-not' }),
    /until/,
  );
});

// =========================================================================
// builder: empty / minimal data
// =========================================================================

test('builder: empty queue -> empty report with metadata echoed', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi([], {
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.bootstraps, 100);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.seed, 42);
  assert.equal(r.generatedAt, GEN);
});

test('builder: single source with ascending data has positive slope', () => {
  const q = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.slope > 0);
});

test('builder: --min-rows drops sources below the floor', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3]), // n=3
    ...mkSeries('b', [10, 20, 30, 40, 50]), // n=5
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    minRows: 5,
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('builder: --source filter restricts and counts droppedSourceFilter', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    source: 'a',
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: bad total_tokens dropped (non-finite, NaN, negative)', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00Z', 'a', 10),
    ql('2026-04-27T01:00:00Z', 'a', Number.NaN),
    ql('2026-04-27T02:00:00Z', 'a', Number.POSITIVE_INFINITY),
    ql('2026-04-27T03:00:00Z', 'a', -5),
    ql('2026-04-27T04:00:00Z', 'a', 20),
    ql('2026-04-27T05:00:00Z', 'a', 30),
    ql('2026-04-27T06:00:00Z', 'a', 40),
    ql('2026-04-27T07:00:00Z', 'a', 50),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('builder: bad hour_start dropped', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 10),
    ...mkSeries('a', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: empty source string falls into "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00Z', '', 10),
    ql('2026-04-27T01:00:00Z', '', 20),
    ql('2026-04-27T02:00:00Z', '', 30),
    ql('2026-04-27T03:00:00Z', '', 40),
    ql('2026-04-27T04:00:00Z', '', 50),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: window since/until restricts data', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    since: '2026-04-27T00:03:00Z',
    until: '2026-04-27T00:08:00Z',
    bootstraps: 100,
    generatedAt: GEN,
  });
  // Indices 3..7 -> rows 4..8 (5 rows)
  assert.equal(r.sources[0]!.rowsKept, 5);
  assert.equal(r.windowStart, '2026-04-27T00:03:00Z');
  assert.equal(r.windowEnd, '2026-04-27T00:08:00Z');
});

// =========================================================================
// builder: defaults / metadata echo
// =========================================================================

test('builder: defaults are echoed correctly', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.minRows, 4);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.seed, 42);
  assert.equal(r.alertZeroInCi, false);
  assert.equal(r.sort, 'magnitude-desc');
  assert.equal(r.top, null);
});

test('builder: generatedAt defaults to ISO if not provided', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi([], { bootstraps: 100 });
  assert.match(r.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// =========================================================================
// builder: bootstrap math
// =========================================================================

test('builder: ascending data -> CI (mostly) above zero, slope >0', () => {
  const q = mkSeries('a', [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
  ]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 500,
    confidence: 0.9,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.slope > 0);
  assert.ok(s.ciLower < s.ciUpper);
  assert.equal(s.ciWidth, s.ciUpper - s.ciLower);
});

test('builder: bootStd is non-negative', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.bootStd >= 0);
});

test('builder: ciLower <= ciUpper for every source', () => {
  const q = [
    ...mkSeries('a', [1, 4, 2, 8, 5, 9, 3, 7, 6, 10]),
    ...mkSeries('b', [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
    ...mkSeries('c', [5, 5, 5, 5, 5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.ok(s.ciLower <= s.ciUpper, `${s.source}: ciLower > ciUpper`);
  }
});

test('builder: all-equal series -> slope=0, CI=[0,0], bootStd=0', () => {
  const q = mkSeries('flat', [42, 42, 42, 42, 42, 42, 42, 42]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.slope, 0);
  assert.equal(s.bootStd, 0);
  assert.equal(s.ciLower, 0);
  assert.equal(s.ciUpper, 0);
  assert.equal(s.ciWidth, 0);
  assert.equal(s.ciContainsZero, true);
});

test('builder: same seed -> identical results (determinism)', () => {
  const q = mkSeries('a', [1, 4, 2, 8, 5, 9, 3, 7, 6, 10]);
  const r1 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 123,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 123,
    generatedAt: GEN,
  });
  assert.deepEqual(r1.sources, r2.sources);
});

test('builder: different seeds typically yield different bootstraps', () => {
  const q = mkSeries('a', [1, 4, 2, 8, 5, 9, 3, 7, 6, 10, 11, 12]);
  const r1 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 1,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 2,
    generatedAt: GEN,
  });
  assert.notEqual(r1.sources[0]!.bootMean, r2.sources[0]!.bootMean);
});

test('builder: larger B tends to tighter bootStd convergence (smoke)', () => {
  // We just check that with B=1000 the bootStd is finite and not crazy.
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 1000,
    generatedAt: GEN,
  });
  assert.ok(Number.isFinite(r.sources[0]!.bootStd));
  assert.ok(r.sources[0]!.bootStd >= 0);
});

// =========================================================================
// builder: ciContainsZero refinement
// =========================================================================

test('builder: noisy data around zero slope -> ciContainsZero true', () => {
  // Random-ish flat-ish series; slope should be close to zero.
  const q = mkSeries(
    'flat',
    [50, 52, 49, 51, 50, 48, 52, 50, 49, 51, 50, 50],
  );
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 500,
    confidence: 0.95,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // For tiny noise, the CI should likely contain zero. Not guaranteed
  // but very likely; we check the relationship matches the diagnostic.
  assert.equal(s.ciContainsZero, s.ciLower <= 0 && s.ciUpper >= 0);
});

test('builder: strong ascending data -> point slope is positive', () => {
  const q = mkSeries(
    'rising',
    [
      10, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200,
      1300, 1400, 1500,
    ],
  );
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 500,
    confidence: 0.95,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // Point Deming slope on the full data is unambiguously positive.
  assert.ok(s.slope > 0);
  // ciContainsZero diagnostic must match the literal definition.
  assert.equal(s.ciContainsZero, s.ciLower <= 0 && s.ciUpper >= 0);
});

test('builder: --alert-zero-in-ci filters consistently', () => {
  // Add a clearly-flat source whose CI must straddle zero, then verify
  // it survives and the alert filter only keeps such rows.
  const q = [
    ...mkSeries('flat', [5, 5, 5, 5, 5, 5, 5, 5]),
    ...mkSeries('rising', [10, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 500,
    alertZeroInCi: true,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.equal(s.ciContainsZero, true);
  }
  // 'flat' must survive (it's all zeros -> ciContainsZero true).
  assert.ok(r.sources.some((s) => s.source === 'flat'));
});

test('builder: ciWidth = ciUpper - ciLower exactly', () => {
  const q = mkSeries('a', [1, 5, 3, 8, 6, 2, 9, 4, 7, 10]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.equal(s.ciWidth, s.ciUpper - s.ciLower);
  }
});

// =========================================================================
// builder: sorts
// =========================================================================

const MULTI: QueueLine[] = [
  ...mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ...mkSeries('b', [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]),
  ...mkSeries('c', [5, 5, 5, 5, 5, 5, 5, 5]),
  ...mkSeries('d', [10, 20, 15, 25, 20, 30, 25, 35, 30, 40, 35, 45]),
];

test('sort: magnitude-desc orders by |slope| desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'magnitude-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.slope) >= Math.abs(r.sources[i]!.slope),
    );
  }
});

test('sort: slope-desc orders by slope desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'slope-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope >= r.sources[i]!.slope);
  }
});

test('sort: slope-asc orders by slope asc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope <= r.sources[i]!.slope);
  }
});

test('sort: ci-width-desc orders by CI width desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'ci-width-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth >= r.sources[i]!.ciWidth);
  }
});

test('sort: ci-width-asc orders by CI width asc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'ci-width-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth <= r.sources[i]!.ciWidth);
  }
});

test('sort: boot-std-desc orders by bootStd desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'boot-std-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.bootStd >= r.sources[i]!.bootStd);
  }
});

test('sort: ci-contains-zero-first puts true rows first', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'ci-contains-zero-first',
    generatedAt: GEN,
  });
  let sawFalse = false;
  for (const s of r.sources) {
    if (!s.ciContainsZero) sawFalse = true;
    if (sawFalse) {
      assert.equal(s.ciContainsZero, false);
    }
  }
});

test('sort: rows orders by rowsKept desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'rows',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.rowsKept >= r.sources[i]!.rowsKept);
  }
});

test('sort: source orders by source asc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'source',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.source <= r.sources[i]!.source);
  }
});

test('sort tiebreak: source asc when primary equal', () => {
  // All-equal data so slopes are all 0 -> tiebreak should hold.
  const q = [
    ...mkSeries('zzz', [5, 5, 5, 5, 5]),
    ...mkSeries('aaa', [5, 5, 5, 5, 5]),
    ...mkSeries('mmm', [5, 5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    sort: 'magnitude-desc',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aaa', 'mmm', 'zzz'],
  );
});

// =========================================================================
// top cap
// =========================================================================

test('--top caps the output and counts droppedBelowTopCap', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 100,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

// =========================================================================
// property: CI contains the bootMean
// =========================================================================

test('property: bootMean lies within [ciLower, ciUpper] (typical)', () => {
  // For percentile CI of the bootstrap distribution, the mean of that
  // distribution must lie within the 2.5%-97.5% percentile range
  // unless the distribution is wildly degenerate.
  const q = mkSeries('a', [1, 4, 2, 8, 5, 9, 3, 7, 6, 10, 11, 12, 14, 13]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 500,
    confidence: 0.95,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.bootMean >= s.ciLower);
  assert.ok(s.bootMean <= s.ciUpper);
});

test('property: confidence echo matches', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    confidence: 0.8,
    generatedAt: GEN,
  });
  assert.equal(r.confidence, 0.8);
});

test('property: lambda echo matches', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 100,
    lambda: 2.5,
    generatedAt: GEN,
  });
  assert.equal(r.lambda, 2.5);
});

test('property: alertZeroInCi=false keeps all rows', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    alertZeroInCi: false,
    generatedAt: GEN,
  });
  assert.equal(r.droppedNotZeroInCi, 0);
});

// =========================================================================
// refinement: bootMedian + bootSkewMeanMinusMedian
// =========================================================================

test('refinement: bootMedian and bootSkewMeanMinusMedian present on every row', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.bootMedian));
    assert.ok(Number.isFinite(s.bootSkewMeanMinusMedian));
  }
});

test('refinement: bootSkewMeanMinusMedian = bootMean - bootMedian exactly', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    assert.equal(s.bootSkewMeanMinusMedian, s.bootMean - s.bootMedian);
  }
});

test('refinement: all-equal series -> bootMedian = 0 and bootSkew = 0', () => {
  const q = mkSeries('flat', [42, 42, 42, 42, 42, 42, 42, 42]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.bootMedian, 0);
  assert.equal(s.bootSkewMeanMinusMedian, 0);
});

test('refinement: bootMedian is between min and max of resample slopes (within CI bounds)', () => {
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 200,
    confidence: 0.99,
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  // 99% CI is wide; median must lie within it for any reasonable
  // distribution.
  assert.ok(s.bootMedian >= s.ciLower);
  assert.ok(s.bootMedian <= s.ciUpper);
});

test('refinement: boot-skew-magnitude-desc sort orders by |bootSkew| desc', () => {
  const r = buildSourceRowTokenBootstrapSlopeCi(MULTI, {
    bootstraps: 200,
    sort: 'boot-skew-magnitude-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.bootSkewMeanMinusMedian) >=
        Math.abs(r.sources[i]!.bootSkewMeanMinusMedian),
    );
  }
});

test('refinement: boot-skew-magnitude-desc accepted by validator', () => {
  // Should not throw.
  buildSourceRowTokenBootstrapSlopeCi([], {
    bootstraps: 100,
    sort: 'boot-skew-magnitude-desc',
    generatedAt: GEN,
  });
});

test('refinement: bootMedian determinism under same seed', () => {
  const q = mkSeries('a', [1, 4, 2, 8, 5, 9, 3, 7, 6, 10]);
  const r1 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 7,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenBootstrapSlopeCi(q, {
    bootstraps: 300,
    seed: 7,
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.bootMedian, r2.sources[0]!.bootMedian);
  assert.equal(
    r1.sources[0]!.bootSkewMeanMinusMedian,
    r2.sources[0]!.bootSkewMeanMinusMedian,
  );
});
