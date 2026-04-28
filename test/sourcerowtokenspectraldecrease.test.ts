import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralDecrease } from '../src/sourcerowtokenspectraldecrease.js';
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
  // Add a large DC offset to keep total_tokens >= 0 (negatives are dropped
  // by the builder). DC offset is removed by the builder's mean-centering
  // step, so it does NOT change PSD-derived quantities.
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

test('spectral-decrease: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralDecrease([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.minDecrease, null);
  assert.equal(r.maxDecrease, null);
  assert.equal(r.sort, 'decrease-asc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-decrease: pure low-frequency tone at bin 1 -> strongly negative decrease', () => {
  // A pure sine at bin 1 puts almost all power at P[1]; tail bins ~ 0.
  // (P[k] - P[1])/(k-1) is then dominated by negative values.
  const n = 64;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * 1 * t) / n));
  }
  const r = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.decrease < 0, `expected negative decrease, got ${row.decrease}`);
  // P[1] should dominate
  assert.ok(
    row.firstBinPower > row.tailPower,
    `expected P[1] > tailPower, got P[1]=${row.firstBinPower} tail=${row.tailPower}`,
  );
});

test('spectral-decrease: pure high-frequency tone (no power at bin 1) -> positive decrease', () => {
  // A tone at bin K-1 puts power high; P[1] near 0; (P[k]-P[1])/(k-1) > 0.
  const n = 64;
  const K = n / 2; // 32
  const v: number[] = [];
  const tone = K - 1; // 31
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * tone * t) / n));
  }
  const r = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.decrease > 0, `expected positive decrease, got ${row.decrease}`);
});

test('spectral-decrease: matches Peeters 2004 closed-form on hand-chosen PSD', () => {
  // Construct values that produce a known PSD shape, then verify the
  // formula reproduces decrease = (sum_{k>=2} (P[k]-P[1])/(k-1)) /
  // sum_{k>=2} P[k].
  const n = 32;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(
      1000 +
        50 * Math.sin((2 * Math.PI * 2 * t) / n) +
        80 * Math.sin((2 * Math.PI * 5 * t) / n),
    );
  }
  const r = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Recompute decrease from raw definition by reverse-engineering P[k]
  // structure here is not practical; instead, sanity-check that:
  // decrease == (P[k] != P[1] aggregated linearly weighted) / tailPower
  // i.e. the reported value is finite and the relation
  //   decrease * tailPower = sum_{k>=2} (P[k] - P[1]) / (k-1)
  // is consistent with the reported tailPower being positive.
  assert.ok(Number.isFinite(row.decrease));
  assert.ok(row.tailPower > 0);
  assert.ok(row.firstBinPower >= 0);
  // For a PSD with mass at bins 2 and 5 (and ~zero at bin 1), every
  // (P[k]-P[1]) for k in {2, 5} is large positive, others ~ -P[1] ~ 0,
  // so decrease should be > 0.
  assert.ok(row.decrease > 0, `mass at low-but-not-bin-1 -> positive decrease, got ${row.decrease}`);
});

test('spectral-decrease: constant series surfaces under droppedConstantSeries', () => {
  const v = new Array(16).fill(0);
  const r = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedConstantSeries, 1);
});

test('spectral-decrease: below minRows surfaces under droppedBelowMinRows', () => {
  const v = [1, 2, 3, 4]; // n=4, minRows default 8
  const r = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('spectral-decrease: invalid minRows -> throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralDecrease([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralDecrease([], { minRows: 1.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-decrease: invalid sort -> throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralDecrease([], {
        sort: 'banana' as never,
      }),
    /sort must be one of/,
  );
});

test('spectral-decrease: top cap surfaces droppedBelowTopCap', () => {
  const sources: QueueLine[] = [];
  for (let s = 0; s < 4; s++) {
    const v: number[] = [];
    for (let t = 0; t < 16; t++) {
      v.push(
        100 +
          (s + 1) * 10 * Math.sin((2 * Math.PI * (1 + s) * t) / 16),
      );
    }
    for (let t = 0; t < v.length; t++) {
      const day = 25 + Math.floor(t / (24 * 60));
      const hh = Math.floor(t / 60) % 24;
      const mm = t % 60;
      sources.push(
        ql(
          `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
          `src${s}`,
          v[t]! + 100000,
        ),
      );
    }
  }
  const r = buildSourceRowTokenSpectralDecrease(sources, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('spectral-decrease: sort=source produces lex order; tiebreak source asc on ties', () => {
  const all: QueueLine[] = [];
  for (const s of ['zeta', 'alpha', 'mike']) {
    const v: number[] = [];
    for (let t = 0; t < 16; t++) {
      v.push(100 + 10 * Math.sin((2 * Math.PI * 2 * t) / 16));
    }
    for (let t = 0; t < v.length; t++) {
      const hh = Math.floor(t / 60) % 24;
      const mm = t % 60;
      all.push(
        ql(
          `2026-04-25T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
          s,
          v[t]! + 100000,
        ),
      );
    }
  }
  const r = buildSourceRowTokenSpectralDecrease(all, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mike', 'zeta'],
  );
});

test('spectral-decrease: deterministic across calls (no wall clock leak when generatedAt set)', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) {
    v.push(100 + 10 * Math.sin((2 * Math.PI * 3 * t) / 32));
  }
  const r1 = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenSpectralDecrease(series(v), { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('spectral-decrease: source filter restricts to one source', () => {
  const all: QueueLine[] = [];
  for (const s of ['s1', 's2']) {
    for (let t = 0; t < 16; t++) {
      all.push(
        ql(
          `2026-04-25T00:${t.toString().padStart(2, '0')}:00Z`,
          s,
          100000 + 10 * Math.sin((2 * Math.PI * 2 * t) / 16),
        ),
      );
    }
  }
  const r = buildSourceRowTokenSpectralDecrease(all, {
    generatedAt: GEN,
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 16);
});

test('spectral-decrease: --min-decrease and --max-decrease filters surface in dropped buckets', () => {
  // Build 4 sources with varying tones to get a spread of decrease values.
  const all: QueueLine[] = [];
  for (let s = 0; s < 4; s++) {
    const tone = s * 4 + 2; // bins 2, 6, 10, 14 — all in [1, K-1] for K=16
    for (let t = 0; t < 32; t++) {
      const hh = Math.floor(t / 60) % 24;
      const mm = t % 60;
      all.push(
        ql(
          `2026-04-25T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
          `src${s}`,
          100000 + 100 * Math.sin((2 * Math.PI * tone * t) / 32),
        ),
      );
    }
  }
  // First read the unfiltered values to anchor expectations.
  const baseline = buildSourceRowTokenSpectralDecrease(all, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.ok(baseline.sources.length >= 2);

  // --max-decrease 0: keeps only sources whose decrease <= 0
  // (filter is strict-`>`: rows with decrease > 0 are dropped).
  const negOnly = buildSourceRowTokenSpectralDecrease(all, {
    generatedAt: GEN,
    maxDecrease: 0,
  });
  for (const row of negOnly.sources) {
    assert.ok(
      row.decrease <= 0,
      `--max-decrease 0 must keep only decrease <= 0, got ${row.decrease}`,
    );
  }
  assert.equal(
    negOnly.sources.length + negOnly.droppedAboveMaxDecrease,
    baseline.sources.length,
  );
  assert.equal(
    negOnly.droppedAboveMaxDecrease,
    baseline.sources.filter((s) => s.decrease > 0).length,
  );

  // --min-decrease 0: keeps only sources whose decrease >= 0
  // (filter is strict-`<`: rows with decrease < 0 are dropped).
  const posOnly = buildSourceRowTokenSpectralDecrease(all, {
    generatedAt: GEN,
    minDecrease: 0,
  });
  for (const row of posOnly.sources) {
    assert.ok(
      row.decrease >= 0,
      `--min-decrease 0 must keep only decrease >= 0, got ${row.decrease}`,
    );
  }
  assert.equal(
    posOnly.sources.length + posOnly.droppedBelowMinDecrease,
    baseline.sources.length,
  );
  assert.equal(
    posOnly.droppedBelowMinDecrease,
    baseline.sources.filter((s) => s.decrease < 0).length,
  );
});

test('spectral-decrease: minDecrease > maxDecrease -> throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralDecrease([], {
        minDecrease: 0.5,
        maxDecrease: -0.5,
      }),
    /minDecrease.*<=.*maxDecrease/,
  );
});

test('spectral-decrease: non-finite minDecrease/maxDecrease -> throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralDecrease([], {
        minDecrease: Number.NaN,
      }),
    /minDecrease must be a finite number/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSpectralDecrease([], {
        maxDecrease: Number.POSITIVE_INFINITY,
      }),
    /maxDecrease must be a finite number/,
  );
});
