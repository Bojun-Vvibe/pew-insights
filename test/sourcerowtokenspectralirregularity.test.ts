import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenSpectralIrregularity } from '../src/sourcerowtokenspectralirregularity.js';
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

test('spectral-irregularity: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenSpectralIrregularity([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'irregularity-desc');
  assert.equal(r.generatedAt, GEN);
});

test('spectral-irregularity: pure single-bin tone -> high irregularity (one bin spike, rest near 0)', () => {
  // A pure sine at bin b puts almost all PSD power at bin b; adjacent
  // bins are near 0. So (P[b-1] - P[b])^2 and (P[b] - P[b+1])^2 dominate
  // the diffEnergy, and sumP2 ~ P[b]^2 — irregularity ~ 2 (two big jumps
  // / one big peak^2).
  const n = 64;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(1000 + 100 * Math.sin((2 * Math.PI * 5 * t) / n));
  }
  const r = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(
    row.irregularity > 1,
    `expected irregularity > 1 for spiky single-bin tone, got ${row.irregularity}`,
  );
  // sanity: sumP2 > 0 and diffEnergy > 0
  assert.ok(row.sumP2 > 0);
  assert.ok(row.diffEnergy > 0);
});

test('spectral-irregularity: sum of many adjacent harmonics -> lower irregularity than single tone', () => {
  // A signal that excites many adjacent bins evenly is locally smooth
  // bin-to-bin -> lower irregularity than a one-bin spike.
  const n = 64;
  const single: number[] = [];
  for (let t = 0; t < n; t++) {
    single.push(1000 + 100 * Math.sin((2 * Math.PI * 5 * t) / n));
  }
  const broad: number[] = [];
  for (let t = 0; t < n; t++) {
    let s = 1000;
    // many adjacent harmonics, near-equal amplitudes
    for (let h = 3; h <= 12; h++) {
      s += 30 * Math.sin((2 * Math.PI * h * t) / n + h * 0.7);
    }
    broad.push(s);
  }
  const rSingle = buildSourceRowTokenSpectralIrregularity(series(single), {
    generatedAt: GEN,
  });
  const rBroad = buildSourceRowTokenSpectralIrregularity(series(broad), {
    generatedAt: GEN,
  });
  assert.equal(rSingle.sources.length, 1);
  assert.equal(rBroad.sources.length, 1);
  assert.ok(
    rBroad.sources[0]!.irregularity < rSingle.sources[0]!.irregularity,
    `broad-band signal should be smoother bin-to-bin: broad=${rBroad.sources[0]!.irregularity} single=${rSingle.sources[0]!.irregularity}`,
  );
});

test('spectral-irregularity: irregularity is non-negative and matches diffEnergy/sumP2 closed form', () => {
  const n = 32;
  const v: number[] = [];
  for (let t = 0; t < n; t++) {
    v.push(
      1000 +
        50 * Math.sin((2 * Math.PI * 2 * t) / n) +
        80 * Math.sin((2 * Math.PI * 7 * t) / n),
    );
  }
  const r = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.irregularity >= 0, `irregularity must be >= 0`);
  // Verify the closed form exactly
  const expected = row.diffEnergy / row.sumP2;
  assert.ok(
    Math.abs(row.irregularity - expected) < 1e-12,
    `expected ${expected}, got ${row.irregularity}`,
  );
  assert.ok(Number.isFinite(row.irregularity));
  assert.ok(row.sumP2 > 0);
  assert.ok(row.diffEnergy >= 0);
});

test('spectral-irregularity: constant series surfaces under droppedConstantSeries', () => {
  const v = new Array(16).fill(0);
  const r = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedConstantSeries, 1);
});

test('spectral-irregularity: below minRows surfaces under droppedBelowMinRows', () => {
  const v = [1, 2, 3, 4]; // n=4 with default minRows 8
  const r = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('spectral-irregularity: invalid minRows -> throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralIrregularity([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralIrregularity([], { minRows: 1.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('spectral-irregularity: invalid sort -> throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralIrregularity([], {
        sort: 'banana' as never,
      }),
    /sort must be one of/,
  );
});

test('spectral-irregularity: invalid top -> throws', () => {
  assert.throws(
    () => buildSourceRowTokenSpectralIrregularity([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenSpectralIrregularity([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

test('spectral-irregularity: top cap surfaces droppedBelowTopCap', () => {
  const sources: QueueLine[] = [];
  for (let s = 0; s < 4; s++) {
    const v: number[] = [];
    for (let t = 0; t < 16; t++) {
      v.push(100 + (s + 1) * 10 * Math.sin((2 * Math.PI * (1 + s) * t) / 16));
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
  const r = buildSourceRowTokenSpectralIrregularity(sources, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('spectral-irregularity: sort=source produces lex order; sort=irregularity-asc/desc reorder', () => {
  const all: QueueLine[] = [];
  // Make 3 sources with different tone densities -> different irregularity
  const tones: Record<string, number[]> = {
    alpha: [3], // single tone -> high irregularity
    mike: [2, 3, 4, 5, 6, 7], // many adjacent -> low irregularity
    zeta: [4, 12], // two-tone
  };
  for (const s of Object.keys(tones)) {
    for (let t = 0; t < 32; t++) {
      let val = 100;
      for (const tone of tones[s]!) {
        val += 30 * Math.sin((2 * Math.PI * tone * t) / 32 + tone);
      }
      const hh = Math.floor(t / 60) % 24;
      const mm = t % 60;
      all.push(
        ql(
          `2026-04-25T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
          s,
          100000 + val,
        ),
      );
    }
  }
  const rLex = buildSourceRowTokenSpectralIrregularity(all, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    rLex.sources.map((s) => s.source),
    ['alpha', 'mike', 'zeta'],
  );
  const rDesc = buildSourceRowTokenSpectralIrregularity(all, {
    generatedAt: GEN,
    sort: 'irregularity-desc',
  });
  const rAsc = buildSourceRowTokenSpectralIrregularity(all, {
    generatedAt: GEN,
    sort: 'irregularity-asc',
  });
  // desc must be sorted by irregularity descending
  for (let i = 0; i + 1 < rDesc.sources.length; i++) {
    assert.ok(
      rDesc.sources[i]!.irregularity >= rDesc.sources[i + 1]!.irregularity,
      `desc must be non-increasing: ${rDesc.sources[i]!.irregularity} vs ${rDesc.sources[i + 1]!.irregularity}`,
    );
  }
  // asc must be sorted by irregularity ascending
  for (let i = 0; i + 1 < rAsc.sources.length; i++) {
    assert.ok(
      rAsc.sources[i]!.irregularity <= rAsc.sources[i + 1]!.irregularity,
      `asc must be non-decreasing: ${rAsc.sources[i]!.irregularity} vs ${rAsc.sources[i + 1]!.irregularity}`,
    );
  }
  // both must include the same set of sources
  assert.deepEqual(
    [...rDesc.sources.map((s) => s.source)].sort(),
    [...rAsc.sources.map((s) => s.source)].sort(),
  );
});

test('spectral-irregularity: deterministic across calls (no wall clock leak when generatedAt set)', () => {
  const v: number[] = [];
  for (let t = 0; t < 32; t++) {
    v.push(100 + 10 * Math.sin((2 * Math.PI * 3 * t) / 32));
  }
  const r1 = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenSpectralIrregularity(series(v), {
    generatedAt: GEN,
  });
  assert.deepEqual(r1, r2);
});

test('spectral-irregularity: source filter restricts to one source', () => {
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
  const r = buildSourceRowTokenSpectralIrregularity(all, {
    generatedAt: GEN,
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 16);
});

test('spectral-irregularity: invalid since/until -> throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSpectralIrregularity([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSpectralIrregularity([], {
        until: 'also-bad',
      }),
    /invalid until/,
  );
});

test('spectral-irregularity: tiebreak source asc preserved on equal irregularity', () => {
  // Two sources with literally identical PSDs (same series) -> identical
  // irregularity -> tiebreak by source asc.
  const all: QueueLine[] = [];
  for (const s of ['z_src', 'a_src']) {
    for (let t = 0; t < 16; t++) {
      all.push(
        ql(
          `2026-04-25T00:${t.toString().padStart(2, '0')}:00Z`,
          s,
          100000 + 10 * Math.sin((2 * Math.PI * 3 * t) / 16),
        ),
      );
    }
  }
  const r = buildSourceRowTokenSpectralIrregularity(all, {
    generatedAt: GEN,
    sort: 'irregularity-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(
    r.sources[0]!.irregularity,
    r.sources[1]!.irregularity,
    'identical series should produce identical irregularity',
  );
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a_src', 'z_src'],
    'tiebreak should be source asc',
  );
});
