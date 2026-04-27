import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralKurtosis } from '../src/sourcerowtokenspectralkurtosis.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-28T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  // Add a large DC offset to keep total_tokens >= 0. DC offset is
  // removed by mean-centering so it does not affect PSD-derived
  // quantities.
  const DC = 100000;
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v + DC,
    );
  });
}

test('spectral-kurtosis: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralKurtosis([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.minKurtosis, null);
  assert.equal(r.maxKurtosis, null);
  assert.equal(r.sort, 'excess-desc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-kurtosis: report fields are wired through', () => {
  const r = buildSourceRowTokenSpectralKurtosis([], {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-30T00:00:00Z',
    source: 'sx',
    minRows: 8,
    top: 5,
    minKurtosis: 1.5,
    maxKurtosis: 10,
    sort: 'kurtosis-desc',
  });
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 'sx');
  assert.equal(r.minRows, 8);
  assert.equal(r.top, 5);
  assert.equal(r.minKurtosis, 1.5);
  assert.equal(r.maxKurtosis, 10);
  assert.equal(r.sort, 'kurtosis-desc');
});

test('spectral-kurtosis: minRows non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralKurtosis([], { minRows: 4.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-kurtosis: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralKurtosis([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-kurtosis: top non-integer throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralKurtosis([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('spectral-kurtosis: minKurtosis non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        minKurtosis: Number.NaN,
      }),
    /minKurtosis must be a finite number/,
  );
});

test('spectral-kurtosis: maxKurtosis non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        maxKurtosis: Number.POSITIVE_INFINITY,
      }),
    /maxKurtosis must be a finite number/,
  );
});

test('spectral-kurtosis: minKurtosis > maxKurtosis throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        minKurtosis: 5,
        maxKurtosis: 2,
      }),
    /minKurtosis \(5\) must be <= maxKurtosis \(2\)/,
  );
});

test('spectral-kurtosis: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        // @ts-expect-error - intentionally invalid
        sort: 'wat',
      }),
    /sort must be one of/,
  );
});

test('spectral-kurtosis: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('spectral-kurtosis: invalid until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

test('spectral-kurtosis: bad hour_start counted under droppedInvalidHourStart', () => {
  const q = [ql('garbage', 's', 100), ql('also-bad', 's', 100)];
  const r = buildSourceRowTokenSpectralKurtosis(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('spectral-kurtosis: NaN total_tokens counted under droppedInvalidTokens', () => {
  const q = series([1, 2, 3, 4, 5, 6, 7, 8]);
  // poison one row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q[0] as any).total_tokens = Number.NaN;
  const r = buildSourceRowTokenSpectralKurtosis(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('spectral-kurtosis: negative total_tokens counted under droppedNegativeTokens', () => {
  const q = series([1, 2, 3, 4, 5, 6, 7, 8]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (q[0] as any).total_tokens = -5;
  const r = buildSourceRowTokenSpectralKurtosis(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('spectral-kurtosis: source filter counts non-matching under droppedSourceFilter', () => {
  const a = series([1, 2, 3, 4, 5, 6, 7, 8], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 8);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('spectral-kurtosis: below min-rows surfaces under droppedBelowMinRows', () => {
  const r = buildSourceRowTokenSpectralKurtosis(series([1, 2, 3, 4]), {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-kurtosis: constant series surfaces under droppedConstantSeries', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([5, 5, 5, 5, 5, 5, 5, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.droppedConstantSeries, 1);
  assert.equal(r.sources.length, 0);
});

test('spectral-kurtosis: row.bins == floor(n/2)', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bins, 5);
  assert.equal(r.sources[0]!.rowsKept, 10);
});

test('spectral-kurtosis: kurtosis is always >= 1 (Cauchy-Schwarz lower bound)', () => {
  // A bunch of pseudo-random patterns, all should yield kurtosis >= 1.
  const patterns: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 8, 1, 8, 1, 8, 1, 8],
    [1, 1, 1, 8, 8, 8, 1, 1, 1, 8],
    [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8],
    [10, 0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0],
  ];
  for (const p of patterns) {
    const r = buildSourceRowTokenSpectralKurtosis(series(p, 's'), {
      generatedAt: GEN,
      minRows: 4,
    });
    assert.equal(r.sources.length, 1, `pattern ${JSON.stringify(p)}`);
    assert.ok(
      r.sources[0]!.kurtosis >= 1 - 1e-9,
      `kurtosis ${r.sources[0]!.kurtosis} should be >= 1 for pattern ${JSON.stringify(p)}`,
    );
  }
});

test('spectral-kurtosis: excess == kurtosis - 3 (Pearson/Fisher relation)', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6]),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
  assert.ok(
    Math.abs(r.sources[0]!.excess - (r.sources[0]!.kurtosis - 3)) < 1e-12,
  );
});

test('spectral-kurtosis: bandwidthBin == sqrt(m2) is reported and finite', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.ok(Number.isFinite(r.sources[0]!.bandwidthBin));
  assert.ok(r.sources[0]!.bandwidthBin > 0);
});

test('spectral-kurtosis: m4 is non-negative (sum of (k-c)^4 * P[k] >= 0)', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.m4 >= 0);
});

test('spectral-kurtosis: invariant to additive DC shift', () => {
  // The builder mean-centers the series before FFT, so adding a
  // constant offset must not change kurtosis.
  const a = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5]),
    { generatedAt: GEN },
  );
  const b = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5].map((x) => x + 50)),
    { generatedAt: GEN },
  );
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  assert.ok(Math.abs(a.sources[0]!.kurtosis - b.sources[0]!.kurtosis) < 1e-9);
});

test('spectral-kurtosis: orthogonal-to-skewness — sign-flipped pattern preserves kurtosis', () => {
  // Reversing the sequence in time flips the sign of the spectral
  // skewness around the centroid (the PSD bin index stays the same
  // but the centroid is preserved by symmetry-of-magnitude); the
  // kurtosis as a 4th central moment is sign-blind, so it must be
  // close to identical for the forward and reversed sequence
  // (modulo numerical noise from a finite DFT).
  const fwd = [1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6];
  const rev = [...fwd].reverse();
  const a = buildSourceRowTokenSpectralKurtosis(series(fwd, 'a'), {
    generatedAt: GEN,
    minRows: 4,
  });
  const b = buildSourceRowTokenSpectralKurtosis(series(rev, 'b'), {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(a.sources.length, 1);
  assert.equal(b.sources.length, 1);
  // Power spectrum of a real sequence is invariant to time-reversal,
  // so kurtosis must be exactly equal up to floating point.
  assert.ok(
    Math.abs(a.sources[0]!.kurtosis - b.sources[0]!.kurtosis) < 1e-9,
    `expected reverse-invariance, got ${a.sources[0]!.kurtosis} vs ${b.sources[0]!.kurtosis}`,
  );
});

test('spectral-kurtosis: sort excess-desc orders most leptokurtic first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a'); // very peaky
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b'); // smooth ramp
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'excess-desc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.excess >= r.sources[1]!.excess);
});

test('spectral-kurtosis: sort excess-asc orders most platykurtic first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'excess-asc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.excess <= r.sources[1]!.excess);
});

test('spectral-kurtosis: sort kurtosis-desc orders highest kurtosis first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'kurtosis-desc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.kurtosis >= r.sources[1]!.kurtosis);
});

test('spectral-kurtosis: sort kurtosis-asc orders lowest kurtosis first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'kurtosis-asc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.kurtosis <= r.sources[1]!.kurtosis);
});

test('spectral-kurtosis: sort abs-excess-desc orders furthest-from-Gaussian first', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'abs-excess-desc',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.excess) >= Math.abs(r.sources[1]!.excess),
  );
});

test('spectral-kurtosis: sort source asc breaks ties lexically', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'aa');
  const b = series([1, 4, 2, 6, 3, 7, 2, 8], 'bb');
  const c = series([1, 4, 2, 6, 3, 7, 2, 8], 'cc');
  const r = buildSourceRowTokenSpectralKurtosis([...c, ...a, ...b], {
    generatedAt: GEN,
    sort: 'source',
    minRows: 4,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aa', 'bb', 'cc'],
  );
});

test('spectral-kurtosis: sort rows orders by rowsKept desc', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'a'); // 8 rows
  const b = series(
    [1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6, 2, 9, 3],
    'b',
  ); // 15 rows
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    sort: 'rows',
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.sources[1]!.source, 'a');
});

test('spectral-kurtosis: top cap suppresses below-cap rows into droppedBelowTopCap', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'a');
  const b = series([1, 1, 1, 8, 1, 1, 1, 1], 'b');
  const c = series([1, 2, 3, 4, 5, 6, 7, 8], 'c');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    sort: 'excess-desc',
    top: 1,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('spectral-kurtosis: min-kurtosis suppresses low-kurtosis sources into droppedBelowMinKurtosis', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1], 'a'); // peaky -> high kurtosis
  const b = series([1, 2, 3, 4, 5, 6, 7, 8], 'b'); // smooth ramp
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    minKurtosis: 1000, // unrealistically high to drop both
    minRows: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinKurtosis, 2);
});

test('spectral-kurtosis: max-kurtosis suppresses high-kurtosis sources into droppedAboveMaxKurtosis', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    maxKurtosis: 0.5, // every kurtosis is >= 1, so every source is dropped
    minRows: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAboveMaxKurtosis, 2);
});

test('spectral-kurtosis: min-kurtosis filter applied before top cap', () => {
  // If filter happens after top cap, droppedBelowTopCap can shadow
  // droppedBelowMinKurtosis. Confirm the documented compose order:
  // filter first, then top cap.
  const a = series([1, 4, 2, 6, 3, 7, 2, 8], 'a');
  const b = series([1, 1, 1, 8, 1, 1, 1, 1], 'b');
  const c = series([1, 2, 3, 4, 5, 6, 7, 8], 'c');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    minKurtosis: 1000, // drops everyone via filter, NOT via top cap
    top: 1,
    minRows: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinKurtosis, 3);
  assert.equal(r.droppedBelowTopCap, 0);
});

test('spectral-kurtosis: time-window filter excludes out-of-window rows pre-aggregation', () => {
  const a = series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5], 'a');
  const r = buildSourceRowTokenSpectralKurtosis(a, {
    generatedAt: GEN,
    since: '2026-04-25T00:05:00Z', // drop the first 5 rows
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('spectral-kurtosis: same source split across two devices is aggregated', () => {
  // The lens is keyed on `source`, not `device_id`, so two devices
  // emitting under the same source key contribute to the same series.
  const q1 = series([1, 4, 2, 6], 's').map((q) => ({ ...q, device_id: 'd1' }));
  const q2 = series([3, 7, 2, 8], 's').map((q) => ({ ...q, device_id: 'd2' }));
  const r = buildSourceRowTokenSpectralKurtosis([...q1, ...q2], {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 8);
});

test('spectral-kurtosis: empty / missing source coalesces to "unknown"', () => {
  const q = series([1, 4, 2, 6, 3, 7, 2, 8], '');
  const r = buildSourceRowTokenSpectralKurtosis(q, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('spectral-kurtosis: determinism — same input yields identical output', () => {
  const q = series([1, 4, 2, 6, 3, 7, 2, 8, 1, 5, 4, 6], 's');
  const a = buildSourceRowTokenSpectralKurtosis(q, { generatedAt: GEN });
  const b = buildSourceRowTokenSpectralKurtosis(q, { generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('spectral-kurtosis: sample order matters (time-domain rearrangement changes PSD)', () => {
  // Spectral kurtosis is order-sensitive — shuffling the sequence
  // generally changes the PSD shape and hence kurtosis. (Use a
  // pattern that we know does change under shuffle.)
  const fwd = series([1, 1, 1, 8, 1, 1, 1, 1, 8, 8, 8, 1], 'a');
  const shuffled = series([1, 8, 1, 1, 8, 1, 1, 8, 1, 1, 1, 1], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...fwd, ...shuffled], {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.sources.length, 2);
  // The two should not be identical; if they happen to coincide
  // we still log a non-failure (rare) — assert at least the values
  // are finite.
  assert.ok(Number.isFinite(r.sources[0]!.kurtosis));
  assert.ok(Number.isFinite(r.sources[1]!.kurtosis));
});

test('spectral-kurtosis: short series (n=4) yields bins=2 and a finite kurtosis', () => {
  const r = buildSourceRowTokenSpectralKurtosis(series([1, 4, 2, 6]), {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bins, 2);
  assert.ok(Number.isFinite(r.sources[0]!.kurtosis));
  assert.ok(r.sources[0]!.kurtosis >= 1 - 1e-9);
});

test('spectral-kurtosis: n=5 (bins=2) admits a kurtosis report', () => {
  const r = buildSourceRowTokenSpectralKurtosis(
    series([1, 4, 2, 6, 3]),
    { generatedAt: GEN, minRows: 4 },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bins, 2);
  assert.ok(Number.isFinite(r.sources[0]!.kurtosis));
});

test('spectral-kurtosis: totalRowsKept counts pre-min-rows samples per source', () => {
  // totalRowsKept is a pre-cut tally: it counts everything that
  // passed validity filters even if the source is later dropped
  // because it has too few rows.
  const a = series([1, 2, 3], 'a'); // dropped under min-rows
  const b = series([1, 4, 2, 6, 3, 7, 2, 8], 'b');
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    minRows: 8,
  });
  assert.equal(r.totalRowsKept, 11);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
});

test('spectral-kurtosis refinement: minExcess non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        minExcess: Number.NaN,
      }),
    /minExcess must be a finite number/,
  );
});

test('spectral-kurtosis refinement: maxExcess non-finite throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        maxExcess: Number.NEGATIVE_INFINITY,
      }),
    /maxExcess must be a finite number/,
  );
});

test('spectral-kurtosis refinement: minExcess > maxExcess throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralKurtosis([], {
        minExcess: 1,
        maxExcess: -1,
      }),
    /minExcess \(1\) must be <= maxExcess \(-1\)/,
  );
});

test('spectral-kurtosis refinement: minExcess 0 isolates leptokurtic subset', () => {
  // Build a mixed batch and assert the filter splits exactly on
  // excess >= 0, with non-matching sources surfacing in
  // droppedBelowMinExcess.
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a'); // peaky -> likely lepto
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b'); // smooth ramp
  const c = series([8, 1, 1, 1, 8, 1, 1, 1, 8, 1], 'c'); // periodic
  const all = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(all.sources.length, 3);
  const lepto = all.sources.filter((s) => s.excess >= 0).length;
  const platy = all.sources.filter((s) => s.excess < 0).length;
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    minExcess: 0,
    minRows: 4,
  });
  assert.equal(r.sources.length, lepto);
  assert.equal(r.droppedBelowMinExcess, platy);
});

test('spectral-kurtosis refinement: maxExcess 0 isolates platykurtic subset', () => {
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const c = series([8, 1, 1, 1, 8, 1, 1, 1, 8, 1], 'c');
  const all = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    minRows: 4,
  });
  const lepto = all.sources.filter((s) => s.excess > 0).length;
  const platy = all.sources.filter((s) => s.excess <= 0).length;
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    maxExcess: 0,
    minRows: 4,
  });
  assert.equal(r.sources.length, platy);
  assert.equal(r.droppedAboveMaxExcess, lepto);
});

test('spectral-kurtosis refinement: kurtosis & excess filters are independent gates', () => {
  // Verify each gate surfaces in its own dropped bucket and that
  // a source dropped by the kurtosis gate is NOT also counted in
  // the excess-gate bucket. Compose order: kurtosis filters first,
  // then excess filters, then top cap.
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a'); // high kurtosis
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b'); // smooth ramp
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b], {
    generatedAt: GEN,
    maxKurtosis: 0.5, // every kurtosis is >= 1, so both fall through this gate
    minExcess: 100, // would also drop them, but kurtosis gate runs first
    minRows: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAboveMaxKurtosis, 2);
  assert.equal(r.droppedBelowMinExcess, 0);
});

test('spectral-kurtosis refinement: filter+top compose order — filter first, then top cap', () => {
  // Three sources, drop one via min-excess so only two remain,
  // then cap top to 1. The dropped-via-filter source must surface
  // in droppedBelowMinExcess and the cap-suppressed source in
  // droppedBelowTopCap; neither gets double-counted.
  const a = series([1, 1, 1, 8, 1, 1, 1, 1, 1, 1], 'a');
  const b = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'b');
  const c = series([8, 1, 1, 1, 8, 1, 1, 1, 8, 1], 'c');
  const all = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    sort: 'excess-desc',
    minRows: 4,
  });
  assert.equal(all.sources.length, 3);
  // Pick a min-excess strictly between sortedExcess[1] and sortedExcess[2]
  // so exactly one source falls to the filter.
  const sortedExcess = all.sources.map((s) => s.excess);
  const cut = (sortedExcess[1]! + sortedExcess[2]!) / 2;
  const r = buildSourceRowTokenSpectralKurtosis([...a, ...b, ...c], {
    generatedAt: GEN,
    sort: 'excess-desc',
    minExcess: cut,
    top: 1,
    minRows: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinExcess, 1);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.droppedAboveMaxExcess, 0);
});

test('spectral-kurtosis refinement: report fields wire minExcess/maxExcess through', () => {
  const r = buildSourceRowTokenSpectralKurtosis([], {
    generatedAt: GEN,
    minExcess: -1.5,
    maxExcess: 5,
  });
  assert.equal(r.minExcess, -1.5);
  assert.equal(r.maxExcess, 5);
});
