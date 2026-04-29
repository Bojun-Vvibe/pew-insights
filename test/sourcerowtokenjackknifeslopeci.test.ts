/**
 * Unit + property tests for source-row-token-jackknife-slope-ci.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenJackknifeSlopeCi,
  inverseStandardNormalCdf,
  jackknifeDemingSlope,
  jackknifeLeaveOneOutSlopes,
} from '../src/sourcerowtokenjackknifeslopeci.js';
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
// inverseStandardNormalCdf
// =========================================================================

test('inverseStandardNormalCdf: median is 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdf(0.5)) < 1e-9);
});

test('inverseStandardNormalCdf: 0.975 ≈ 1.959964', () => {
  const z = inverseStandardNormalCdf(0.975);
  assert.ok(Math.abs(z - 1.959964) < 1e-5, `got ${z}`);
});

test('inverseStandardNormalCdf: 0.95 ≈ 1.644854', () => {
  const z = inverseStandardNormalCdf(0.95);
  assert.ok(Math.abs(z - 1.644854) < 1e-5, `got ${z}`);
});

test('inverseStandardNormalCdf: 0.995 ≈ 2.575829', () => {
  const z = inverseStandardNormalCdf(0.995);
  assert.ok(Math.abs(z - 2.575829) < 1e-4, `got ${z}`);
});

test('inverseStandardNormalCdf: symmetry: invCdf(p) = -invCdf(1-p)', () => {
  for (const p of [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]) {
    const a = inverseStandardNormalCdf(p);
    const b = inverseStandardNormalCdf(1 - p);
    assert.ok(Math.abs(a + b) < 1e-6, `p=${p}: ${a} vs ${-b}`);
  }
});

test('inverseStandardNormalCdf: p=0 -> -Infinity, p=1 -> +Infinity', () => {
  assert.equal(inverseStandardNormalCdf(0), -Infinity);
  assert.equal(inverseStandardNormalCdf(1), Infinity);
});

test('inverseStandardNormalCdf: p outside [0,1] -> NaN', () => {
  assert.ok(Number.isNaN(inverseStandardNormalCdf(-0.1)));
  assert.ok(Number.isNaN(inverseStandardNormalCdf(1.1)));
  assert.ok(Number.isNaN(inverseStandardNormalCdf(Number.POSITIVE_INFINITY)));
  assert.ok(Number.isNaN(inverseStandardNormalCdf(Number.NaN)));
});

test('inverseStandardNormalCdf: monotone increasing across the unit interval', () => {
  let prev = -Infinity;
  for (let k = 1; k < 100; k += 1) {
    const z = inverseStandardNormalCdf(k / 100);
    assert.ok(z > prev, `not monotone at p=${k / 100}`);
    prev = z;
  }
});

// =========================================================================
// jackknifeDemingSlope
// =========================================================================

test('jackknifeDemingSlope: n<2 -> 0', () => {
  assert.equal(jackknifeDemingSlope([], 1), 0);
  assert.equal(jackknifeDemingSlope([5], 1), 0);
});

test('jackknifeDemingSlope: all-equal -> 0', () => {
  assert.equal(jackknifeDemingSlope([7, 7, 7, 7], 1), 0);
});

test('jackknifeDemingSlope: ascending series has positive slope', () => {
  assert.ok(jackknifeDemingSlope([1, 2, 3, 4, 5], 1) > 0);
});

test('jackknifeDemingSlope: descending series has negative slope', () => {
  assert.ok(jackknifeDemingSlope([5, 4, 3, 2, 1], 1) < 0);
});

test('jackknifeDemingSlope: lambda parameter affects the slope', () => {
  const xs = [1, 3, 2, 5, 4, 7, 6, 9];
  const a = jackknifeDemingSlope(xs, 0.5);
  const b = jackknifeDemingSlope(xs, 2.0);
  assert.notEqual(a, b);
});

// =========================================================================
// jackknifeLeaveOneOutSlopes
// =========================================================================

test('jackknifeLeaveOneOutSlopes: returns exactly n slopes', () => {
  const out = jackknifeLeaveOneOutSlopes([1, 2, 3, 4, 5], 1);
  assert.equal(out.length, 5);
});

test('jackknifeLeaveOneOutSlopes: ascending series -> all leave-one-out slopes positive', () => {
  const out = jackknifeLeaveOneOutSlopes([1, 2, 3, 4, 5, 6, 7, 8], 1);
  for (const s of out) assert.ok(s > 0, `expected >0 got ${s}`);
});

test('jackknifeLeaveOneOutSlopes: all-equal -> all leave-one-out slopes are 0', () => {
  const out = jackknifeLeaveOneOutSlopes([4, 4, 4, 4, 4, 4], 1);
  for (const s of out) assert.equal(s, 0);
});

test('jackknifeLeaveOneOutSlopes: deterministic - same input -> same output', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
  const a = jackknifeLeaveOneOutSlopes(xs, 1);
  const b = jackknifeLeaveOneOutSlopes(xs, 1);
  assert.deepEqual(a, b);
});

test('jackknifeLeaveOneOutSlopes: dropping a clear outlier moves the slope', () => {
  // Last point is huge outlier
  const xs = [1, 2, 3, 4, 5, 1000];
  const out = jackknifeLeaveOneOutSlopes(xs, 1);
  // The slope dropping the last (outlier) should differ from the
  // slope dropping the first.
  assert.notEqual(out[5], out[0]);
});

test('jackknifeLeaveOneOutSlopes: n=2 returns zeros (length-1 leave-one-out)', () => {
  const out = jackknifeLeaveOneOutSlopes([3, 7], 1);
  assert.deepEqual(out, [0, 0]);
});

// =========================================================================
// builder validation
// =========================================================================

test('builder: minRows < 4 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenJackknifeSlopeCi([], { minRows: 3, generatedAt: GEN }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: non-integer minRows throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      minRows: 4.5,
      generatedAt: GEN,
    }),
  );
});

test('builder: confidence <= 0 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      confidence: 0,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      confidence: -0.1,
      generatedAt: GEN,
    }),
  );
});

test('builder: confidence >= 1 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      confidence: 1,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      confidence: 1.5,
      generatedAt: GEN,
    }),
  );
});

test('builder: non-finite confidence throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      confidence: Number.NaN,
      generatedAt: GEN,
    }),
  );
});

test('builder: lambda <= 0 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], { lambda: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], { lambda: -1, generatedAt: GEN }),
  );
});

test('builder: bad sort key throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      sort: 'invalid' as never,
      generatedAt: GEN,
    }),
  );
});

test('builder: top < 1 throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], { top: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], { top: -3, generatedAt: GEN }),
  );
});

test('builder: invalid since throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      since: 'not-a-date',
      generatedAt: GEN,
    }),
  );
});

test('builder: invalid until throws', () => {
  assert.throws(() =>
    buildSourceRowTokenJackknifeSlopeCi([], {
      until: 'not-a-date',
      generatedAt: GEN,
    }),
  );
});

// =========================================================================
// builder data flow
// =========================================================================

test('builder: empty queue -> empty report', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: single source ascending -> positive slope', () => {
  const q = mkSeries('s1', [10, 20, 30, 40, 50]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.slope > 0);
});

test('builder: --min-rows drops sub-threshold sources', () => {
  const q = [
    ...mkSeries('big', [10, 20, 30, 40, 50, 60]),
    ...mkSeries('tiny', [1, 2, 3]),
  ];
  const r = buildSourceRowTokenJackknifeSlopeCi(q, {
    minRows: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: --source filter restricts output', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [5, 4, 3, 2, 1]),
  ];
  const r = buildSourceRowTokenJackknifeSlopeCi(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('builder: bad total_tokens drops the row', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 's', 10),
    ql('2026-04-27T00:01:00.000Z', 's', Number.NaN),
    ql('2026-04-27T00:02:00.000Z', 's', Number.POSITIVE_INFINITY),
    ql('2026-04-27T00:03:00.000Z', 's', -5),
    ql('2026-04-27T00:04:00.000Z', 's', 20),
    ql('2026-04-27T00:05:00.000Z', 's', 30),
    ql('2026-04-27T00:06:00.000Z', 's', 40),
    ql('2026-04-27T00:07:00.000Z', 's', 50),
  ];
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.droppedNegativeTokens, 1);
});

test('builder: bad hour_start drops the row', () => {
  const q = [
    ql('not-a-date', 's', 10),
    ...mkSeries('s', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: missing source maps to "unknown"', () => {
  const q = mkSeries('', [10, 20, 30, 40, 50]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: since/until window filters', () => {
  const q = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, {
    since: '2026-04-27T00:02:00.000Z',
    until: '2026-04-27T00:08:00.000Z',
    generatedAt: GEN,
  });
  // Window keeps rows 2..7 = 6 rows
  assert.equal(r.sources[0]!.rowsKept, 6);
});

test('builder: defaults are echoed', () => {
  const q = mkSeries('s', [10, 20, 30, 40, 50, 60]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.minRows, 4);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.sort, 'magnitude-desc');
  assert.equal(r.alertZeroInCi, false);
  assert.equal(r.top, null);
  // z for 95% should be approximately 1.959964
  assert.ok(Math.abs(r.zCritical - 1.959964) < 1e-5);
});

test('builder: generatedAt default is an ISO string', () => {
  const q = mkSeries('s', [10, 20, 30, 40, 50, 60]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(r.generatedAt));
});

// =========================================================================
// jackknife math
// =========================================================================

test('jackknife: ascending data -> positive bias-corrected slope', () => {
  const q = mkSeries('s', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.slope > 0, `slope=${row.slope}`);
  assert.ok(row.biasCorrected > 0, `biasCorrected=${row.biasCorrected}`);
  assert.ok(row.jackMean > 0, `jackMean=${row.jackMean}`);
});

test('jackknife: jackSe is non-negative', () => {
  const q = mkSeries('s', [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.ok(r.sources[0]!.jackSe >= 0);
});

test('jackknife: ciLower <= ciUpper', () => {
  const q = mkSeries('s', [5, 8, 3, 9, 2, 7, 4, 6, 1]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.ciLower <= row.ciUpper);
  }
});

test('jackknife: all-equal data -> SE=0, bias=0, CI=[0,0], contains zero', () => {
  const q = mkSeries('s', [5, 5, 5, 5, 5, 5, 5, 5]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.slope, 0);
  assert.equal(row.jackMean, 0);
  assert.equal(row.jackSe, 0);
  assert.equal(row.bias, 0);
  assert.equal(row.biasCorrected, 0);
  assert.equal(row.ciLower, 0);
  assert.equal(row.ciUpper, 0);
  assert.equal(row.ciWidth, 0);
  assert.equal(row.ciContainsZero, true);
});

test('jackknife: deterministic - same input -> identical output', () => {
  const q = mkSeries('s', [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8]);
  const a = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const b = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.deepEqual(a.sources, b.sources);
});

test('jackknife: ciWidth = 2 * z * jackSe', () => {
  const q = mkSeries('s', [10, 20, 35, 25, 45, 50, 60, 80, 65, 90]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  const expected = 2 * r.zCritical * row.jackSe;
  assert.ok(Math.abs(row.ciWidth - expected) < 1e-9);
});

test('jackknife: bias-corrected = thetaFull - bias = n*thetaFull - (n-1)*jackMean', () => {
  const q = mkSeries('s', [3, 7, 2, 8, 5, 10, 4, 12, 6, 14]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  const fromFormulaA = row.slope - row.bias;
  const n = row.rowsKept;
  const fromFormulaB = n * row.slope - (n - 1) * row.jackMean;
  assert.ok(Math.abs(row.biasCorrected - fromFormulaA) < 1e-6);
  assert.ok(Math.abs(row.biasCorrected - fromFormulaB) < 1e-6);
});

test('jackknife: biasCorrected lies inside [ciLower, ciUpper]', () => {
  const q = mkSeries('s', [3, 7, 2, 8, 5, 10, 4, 12, 6, 14]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(row.biasCorrected >= row.ciLower);
    assert.ok(row.biasCorrected <= row.ciUpper);
  }
});

test('jackknife: 99% CI is wider than 95% CI on the same data', () => {
  const q = mkSeries('s', [3, 7, 2, 8, 5, 10, 4, 12, 6, 14]);
  const r95 = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const r99 = buildSourceRowTokenJackknifeSlopeCi(q, {
    confidence: 0.99,
    generatedAt: GEN,
  });
  assert.ok(r99.sources[0]!.ciWidth > r95.sources[0]!.ciWidth);
});

test('jackknife: zCritical is monotone in confidence', () => {
  const q = mkSeries('s', [10, 20, 30, 40, 50]);
  const r80 = buildSourceRowTokenJackknifeSlopeCi(q, {
    confidence: 0.8,
    generatedAt: GEN,
  });
  const r95 = buildSourceRowTokenJackknifeSlopeCi(q, {
    confidence: 0.95,
    generatedAt: GEN,
  });
  const r99 = buildSourceRowTokenJackknifeSlopeCi(q, {
    confidence: 0.99,
    generatedAt: GEN,
  });
  assert.ok(r80.zCritical < r95.zCritical);
  assert.ok(r95.zCritical < r99.zCritical);
});

// =========================================================================
// ciContainsZero refinement
// =========================================================================

test('ciContainsZero: noisy near-zero data -> CI tends to straddle zero', () => {
  // Tiny variation; slope is essentially noise.
  const q = mkSeries('s', [10, 11, 9, 10, 11, 9, 10, 11, 9, 10]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.ciContainsZero, true);
});

test('ciContainsZero: --alert-zero-in-ci returns only zero-straddling sources', () => {
  const q = [
    ...mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
    ...mkSeries('b', [10, 11, 9, 10, 11, 9, 10, 11, 9, 10]),
  ];
  const filtered = buildSourceRowTokenJackknifeSlopeCi(q, {
    alertZeroInCi: true,
    generatedAt: GEN,
  });
  const unfiltered = buildSourceRowTokenJackknifeSlopeCi(q, {
    generatedAt: GEN,
  });
  // Every row in filtered must straddle zero.
  for (const row of filtered.sources) {
    assert.equal(row.ciContainsZero, true);
  }
  // Sum: filtered + droppedNotZeroInCi == unfiltered count.
  assert.equal(
    filtered.sources.length + filtered.droppedNotZeroInCi,
    unfiltered.sources.length,
  );
});

test('ciWidth = ciUpper - ciLower', () => {
  const q = mkSeries('s', [3, 7, 2, 8, 5, 10, 4, 12, 6, 14]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  for (const row of r.sources) {
    assert.ok(Math.abs(row.ciWidth - (row.ciUpper - row.ciLower)) < 1e-9);
  }
});

// =========================================================================
// sort + top + tiebreak
// =========================================================================

function multiSourceQueue(): QueueLine[] {
  return [
    ...mkSeries('alpha', [10, 20, 30, 40, 50, 60]), // strong positive
    ...mkSeries('beta', [60, 50, 40, 30, 20, 10]), // strong negative
    ...mkSeries('gamma', [10, 11, 9, 10, 11, 9, 10, 11]), // tiny
    ...mkSeries('delta', [5, 50, 5, 50, 5, 50]), // wild
  ];
}

test('sort: magnitude-desc default puts |slope| top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.slope) >= Math.abs(r.sources[i]!.slope),
    );
  }
});

test('sort: slope-desc puts largest slope top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'slope-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope >= r.sources[i]!.slope);
  }
});

test('sort: slope-asc puts smallest slope top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'slope-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.slope <= r.sources[i]!.slope);
  }
});

test('sort: ci-width-desc puts widest CI top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'ci-width-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth >= r.sources[i]!.ciWidth);
  }
});

test('sort: ci-width-asc puts tightest CI top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'ci-width-asc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.ciWidth <= r.sources[i]!.ciWidth);
  }
});

test('sort: jack-se-desc puts largest SE top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'jack-se-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.jackSe >= r.sources[i]!.jackSe);
  }
});

test('sort: bias-magnitude-desc puts largest |bias| top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'bias-magnitude-desc',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      Math.abs(r.sources[i - 1]!.bias) >= Math.abs(r.sources[i]!.bias),
    );
  }
});

test('sort: ci-contains-zero-first puts ci-straddling-zero rows first', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'ci-contains-zero-first',
    generatedAt: GEN,
  });
  let seenFalse = false;
  for (const row of r.sources) {
    if (!row.ciContainsZero) seenFalse = true;
    if (seenFalse) {
      assert.equal(
        row.ciContainsZero,
        false,
        `unexpected true after a false: source=${row.source}`,
      );
    }
  }
});

test('sort: rows puts most-rows top', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'rows',
    generatedAt: GEN,
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.rowsKept >= r.sources[i]!.rowsKept);
  }
});

test('sort: source key is alphabetical', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    sort: 'source',
    generatedAt: GEN,
  });
  const names = r.sources.map((s) => s.source);
  const sorted = names.slice().sort();
  assert.deepEqual(names, sorted);
});

test('sort: tiebreak is source asc on equal primary', () => {
  const q = [
    ...mkSeries('zeta', [5, 5, 5, 5, 5, 5]),
    ...mkSeries('alpha', [5, 5, 5, 5, 5, 5]),
  ];
  const r = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  // Both have slope=0, |slope|=0; tiebreak on source asc.
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('top: caps the per-source list', () => {
  const r = buildSourceRowTokenJackknifeSlopeCi(multiSourceQueue(), {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

// =========================================================================
// properties
// =========================================================================

test('property: confidence is echoed in the report', () => {
  const q = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, {
    confidence: 0.9,
    generatedAt: GEN,
  });
  assert.equal(r.confidence, 0.9);
});

test('property: lambda is echoed in the report', () => {
  const q = mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8]);
  const r = buildSourceRowTokenJackknifeSlopeCi(q, {
    lambda: 0.5,
    generatedAt: GEN,
  });
  assert.equal(r.lambda, 0.5);
});

test('property: alertZeroInCi=false keeps all rows', () => {
  const q = multiSourceQueue();
  const all = buildSourceRowTokenJackknifeSlopeCi(q, { generatedAt: GEN });
  const filtered = buildSourceRowTokenJackknifeSlopeCi(q, {
    alertZeroInCi: false,
    generatedAt: GEN,
  });
  assert.equal(all.sources.length, filtered.sources.length);
  assert.equal(filtered.droppedNotZeroInCi, 0);
});

test('property: lambda affects the slope (vs lambda=1 default)', () => {
  const q = mkSeries('s', [1, 3, 2, 5, 4, 7, 6, 9, 8, 11]);
  const r1 = buildSourceRowTokenJackknifeSlopeCi(q, {
    lambda: 1,
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenJackknifeSlopeCi(q, {
    lambda: 0.1,
    generatedAt: GEN,
  });
  assert.notEqual(r1.sources[0]!.slope, r2.sources[0]!.slope);
});
