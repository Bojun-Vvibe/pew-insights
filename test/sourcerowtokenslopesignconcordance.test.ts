/**
 * Unit + integration tests for source-row-token-slope-sign-concordance.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeSignConcordance,
  renderSourceRowTokenSlopeSignConcordance,
  signBin,
  normalisedSignEntropy,
  dominantSign,
  SLOPE_SIGN_LENS_NAMES,
} from '../src/sourcerowtokenslopesignconcordance.js';
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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// --- Pure helpers ---

test('signBin: positive maps to +', () => {
  assert.equal(signBin(0.0001), '+');
  assert.equal(signBin(1e9), '+');
});

test('signBin: negative maps to -', () => {
  assert.equal(signBin(-0.0001), '-');
  assert.equal(signBin(-1e9), '-');
});

test('signBin: exact zero maps to 0', () => {
  assert.equal(signBin(0), '0');
  assert.equal(signBin(-0), '0');
});

test('signBin: NaN / Infinity map to 0', () => {
  assert.equal(signBin(NaN), '0');
  assert.equal(signBin(Infinity), '0');
  assert.equal(signBin(-Infinity), '0');
});

test('normalisedSignEntropy: unanimous returns 0', () => {
  assert.equal(normalisedSignEntropy(6, 0, 0), 0);
  assert.equal(normalisedSignEntropy(0, 6, 0), 0);
  assert.equal(normalisedSignEntropy(0, 0, 6), 0);
});

test('normalisedSignEntropy: even split returns 1', () => {
  const h = normalisedSignEntropy(2, 2, 2);
  assert.ok(Math.abs(h - 1) < 1e-12, `expected 1, got ${h}`);
});

test('normalisedSignEntropy: empty returns 0', () => {
  assert.equal(normalisedSignEntropy(0, 0, 0), 0);
});

test('normalisedSignEntropy: 5/1/0 split is small but positive', () => {
  const h = normalisedSignEntropy(5, 1, 0);
  assert.ok(h > 0 && h < 0.5, `expected small positive, got ${h}`);
});

test('normalisedSignEntropy: 3/3/0 < 2/2/2', () => {
  assert.ok(
    normalisedSignEntropy(3, 3, 0) < normalisedSignEntropy(2, 2, 2),
  );
});

test('dominantSign: strict majority +', () => {
  assert.equal(dominantSign(4, 1, 1), '+');
});

test('dominantSign: strict majority -', () => {
  assert.equal(dominantSign(1, 5, 0), '-');
});

test('dominantSign: strict majority 0', () => {
  assert.equal(dominantSign(1, 1, 4), '0');
});

test('dominantSign: 3-3-0 tie resolves to 0', () => {
  assert.equal(dominantSign(3, 3, 0), '0');
});

test('dominantSign: 2-2-2 tie resolves to 0', () => {
  assert.equal(dominantSign(2, 2, 2), '0');
});

test('dominantSign: all zero counts resolves to 0', () => {
  assert.equal(dominantSign(0, 0, 0), '0');
});

// --- Validation ---

test('build: throws on minRows < 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], { minRows: 3 }),
    /minRows/,
  );
});

test('build: throws on non-integer minRows', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], { minRows: 4.5 }),
    /minRows/,
  );
});

test('build: throws on confidence <= 0', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], { confidence: 0 }),
    /confidence/,
  );
});

test('build: throws on confidence >= 1', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], { confidence: 1 }),
    /confidence/,
  );
});

test('build: throws on lambda <= 0', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeSignConcordance([], { lambda: 0 }),
    /lambda/,
  );
});

test('build: throws on bootstraps < 100', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], { bootstraps: 99 }),
    /bootstraps/,
  );
});

test('build: throws on non-integer seed', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeSignConcordance([], { seed: 1.5 }),
    /seed/,
  );
});

test('build: throws on top < 1', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeSignConcordance([], { top: 0 }),
    /top/,
  );
});

test('build: throws on bad sort', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeSignConcordance([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

// --- Empty / no-source behavior ---

test('build: empty queue produces empty report', () => {
  const r = buildSourceRowTokenSlopeSignConcordance([], {
    generatedAt: '2026-04-29T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.signSplitCount, 0);
  assert.equal(r.allSignificantCount, 0);
});

test('build: report carries forward generatedAt and option fields', () => {
  const r = buildSourceRowTokenSlopeSignConcordance([], {
    generatedAt: '2026-04-29T00:00:00.000Z',
    confidence: 0.9,
    lambda: 2,
    bootstraps: 200,
    seed: 7,
    minRows: 5,
    top: 3,
    sort: 'sign-dispersion-desc',
    alertSignSplit: true,
    alertAnyInsignificant: true,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    source: 'foo',
  });
  assert.equal(r.confidence, 0.9);
  assert.equal(r.lambda, 2);
  assert.equal(r.bootstraps, 200);
  assert.equal(r.seed, 7);
  assert.equal(r.minRows, 5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'sign-dispersion-desc');
  assert.equal(r.alertSignSplit, true);
  assert.equal(r.alertAnyInsignificant, true);
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.source, 'foo');
});

// --- Real-data behavior on monotonic series ---

test('build: strongly increasing series -> all lenses point + and concordance == 1', () => {
  const queue = mkSeries(
    's1',
    Array.from({ length: 30 }, (_, i) => 100 + i * 50),
  );
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    generatedAt: '2026-04-29T00:00:00.000Z',
    bootstraps: 200,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.canonicalSign, '+');
  assert.equal(row.pointSignConcordance, 1);
  assert.equal(row.lensesAllAgreePoint, true);
  assert.equal(row.dominantDirection, '+');
  assert.equal(row.signDispersion, 0);
  assert.equal(row.pointSignCounts.plus, 6);
  assert.equal(row.pointSignCounts.minus, 0);
  assert.equal(row.pointSignCounts.zero, 0);
});

test('build: strongly decreasing series -> all lenses point - and dominant is -', () => {
  const queue = mkSeries(
    's2',
    Array.from({ length: 30 }, (_, i) => 5000 - i * 80),
  );
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    generatedAt: '2026-04-29T00:00:00.000Z',
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  assert.equal(row.canonicalSign, '-');
  assert.equal(row.dominantDirection, '-');
  assert.equal(row.pointSignConcordance, 1);
});

test('build: per-lens entries cover all 6 lenses in canonical order', () => {
  const queue = mkSeries('s3', Array.from({ length: 20 }, (_, i) => 100 + i * 10));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  const row = r.sources[0]!;
  assert.equal(row.perLens.length, 6);
  assert.deepEqual(
    row.perLens.map((p) => p.lens),
    [...SLOPE_SIGN_LENS_NAMES],
  );
});

test('build: per-lens midpoint = (lo + hi) / 2', () => {
  const queue = mkSeries('s4', Array.from({ length: 25 }, (_, i) => 200 + i * 25));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  for (const p of r.sources[0]!.perLens) {
    const lo = Math.min(p.ciLower, p.ciUpper);
    const hi = Math.max(p.ciLower, p.ciUpper);
    assert.ok(Math.abs(p.midpoint - (lo + hi) / 2) < 1e-12);
  }
});

test('build: increasing series -> sigDirectionalConcordance bounded by lensesAllSignificant', () => {
  const queue = mkSeries(
    's5',
    Array.from({ length: 40 }, (_, i) => 100 + i * 100),
  );
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 250,
  });
  const row = r.sources[0]!;
  if (row.lensesAllSignificant) {
    assert.equal(row.sigDirectionalConcordance, 1);
    assert.equal(row.lensesAllSignificantSameDirection, true);
  } else {
    assert.ok(row.sigDirectionalConcordance < 1);
  }
});

test('build: filters by --source', () => {
  const q1 = mkSeries('a', Array.from({ length: 20 }, (_, i) => 100 + i * 10));
  const q2 = mkSeries('b', Array.from({ length: 20 }, (_, i) => 100 + i * 10));
  const r = buildSourceRowTokenSlopeSignConcordance([...q1, ...q2], {
    bootstraps: 200,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('build: top cap drops trailing rows', () => {
  const queues: QueueLine[] = [];
  for (const s of ['a', 'b', 'c', 'd']) {
    queues.push(...mkSeries(s, Array.from({ length: 18 }, (_, i) => 100 + i * 10)));
  }
  const r = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('build: alertSignSplit with all-positive sources empties output', () => {
  const queues: QueueLine[] = [];
  for (const s of ['a', 'b']) {
    queues.push(...mkSeries(s, Array.from({ length: 18 }, (_, i) => 100 + i * 20)));
  }
  const r = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
    alertSignSplit: true,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedNotSignSplit >= 1);
});

test('build: alertAnyInsignificant filter is stable and non-increasing', () => {
  const queues: QueueLine[] = [];
  for (const s of ['a', 'b']) {
    queues.push(...mkSeries(s, Array.from({ length: 18 }, (_, i) => 100 + i * 20)));
  }
  const baseline = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
  });
  const filtered = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
    alertAnyInsignificant: true,
  });
  assert.ok(filtered.sources.length <= baseline.sources.length);
});

test('build: signSplitCount counts only non-unanimous rows', () => {
  const queue = mkSeries('s', Array.from({ length: 25 }, (_, i) => 100 + i * 30));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  // monotonic increasing -> unanimous +
  assert.equal(r.signSplitCount, 0);
});

test('build: deterministic given same seed', () => {
  const queue = mkSeries('s', Array.from({ length: 22 }, (_, i) => 100 + i * 17));
  const r1 = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
    seed: 1234,
    generatedAt: 'x',
  });
  const r2 = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
    seed: 1234,
    generatedAt: 'x',
  });
  assert.deepEqual(r1, r2);
});

test('build: changing seed perturbs at least one bootstrap-family CI', () => {
  const queue = mkSeries('s', Array.from({ length: 22 }, (_, i) => 100 + i * 17));
  const r1 = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
    seed: 1,
  });
  const r2 = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
    seed: 9999,
  });
  const lens1 = r1.sources[0]!.perLens.find((p) => p.lens === 'bootstrap')!;
  const lens2 = r2.sources[0]!.perLens.find((p) => p.lens === 'bootstrap')!;
  // CI bounds shift even though point slope (Deming MLE) is identical
  assert.ok(
    lens1.ciLower !== lens2.ciLower || lens1.ciUpper !== lens2.ciUpper,
  );
});

test('build: midpointSignConcordance in [0, 1]', () => {
  const queue = mkSeries('s', Array.from({ length: 20 }, (_, i) => 100 + i * 10));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  for (const row of r.sources) {
    assert.ok(row.midpointSignConcordance >= 0 && row.midpointSignConcordance <= 1);
    assert.ok(row.pointSignConcordance >= 0 && row.pointSignConcordance <= 1);
    assert.ok(
      row.sigDirectionalConcordance >= 0 && row.sigDirectionalConcordance <= 1,
    );
  }
});

test('build: ciExcludesZero matches sigDirection convention', () => {
  const queue = mkSeries('s', Array.from({ length: 30 }, (_, i) => 100 + i * 50));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  for (const p of r.sources[0]!.perLens) {
    if (p.ciExcludesZero) {
      assert.notEqual(p.sigDirection, '0');
    } else {
      assert.equal(p.sigDirection, '0');
    }
  }
});

test('build: sort=source orders alphabetically', () => {
  const queues: QueueLine[] = [];
  for (const s of ['z', 'a', 'm']) {
    queues.push(...mkSeries(s, Array.from({ length: 18 }, (_, i) => 100 + i * 20)));
  }
  const r = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('build: sort=rows orders desc', () => {
  const queues: QueueLine[] = [];
  queues.push(...mkSeries('a', Array.from({ length: 12 }, (_, i) => 100 + i * 5)));
  queues.push(...mkSeries('b', Array.from({ length: 30 }, (_, i) => 100 + i * 5)));
  const r = buildSourceRowTokenSlopeSignConcordance(queues, {
    bootstraps: 200,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'b');
});

// --- Renderer ---

test('render: empty report renders header and (no sources)', () => {
  const r = buildSourceRowTokenSlopeSignConcordance([], {
    generatedAt: '2026-04-29T00:00:00.000Z',
  });
  const out = renderSourceRowTokenSlopeSignConcordance(r);
  assert.match(out, /pew-insights source-row-token-slope-sign-concordance/);
  assert.match(out, /\(no sources\)/);
});

test('render: one-source report includes table header columns', () => {
  const queue = mkSeries('mySrc', Array.from({ length: 18 }, (_, i) => 100 + i * 20));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeSignConcordance(r);
  assert.match(out, /canonSign/);
  assert.match(out, /ptConcord/);
  assert.match(out, /sigConcord/);
  assert.match(out, /domDir/);
  assert.match(out, /signDisp/);
  assert.match(out, /mySrc/);
});

test('render: shows allPt yes/NO column reflecting lensesAllAgreePoint', () => {
  const queue = mkSeries('s', Array.from({ length: 22 }, (_, i) => 100 + i * 30));
  const r = buildSourceRowTokenSlopeSignConcordance(queue, {
    bootstraps: 200,
  });
  const out = renderSourceRowTokenSlopeSignConcordance(r);
  // lensesAllAgreePoint should be true for monotonic series
  assert.equal(r.sources[0]!.lensesAllAgreePoint, true);
  assert.match(out, /yes/);
});
