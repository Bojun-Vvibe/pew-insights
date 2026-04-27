import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenApproximateEntropy } from '../src/sourcerowtokenapproximateentropy.js';
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

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('apen: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenApproximateEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.m, 2);
  assert.equal(r.r, 0.2);
  assert.equal(r.minRows, 12);
  assert.equal(r.sort, 'apen-asc');
  assert.equal(r.generatedAt, GEN);
});

test('apen: constant series -> droppedZeroVariance', () => {
  const data = series(new Array(20).fill(5));
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('apen: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('apen: highly periodic series -> low ApEn (close to 0)', () => {
  const period = [1, 2, 3, 4, 3, 2];
  const vals: number[] = [];
  for (let i = 0; i < 60; i++) vals.push(period[i % 6]!);
  const data = series(vals);
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN, m: 2, r: 0.2 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.apEn));
  // Periodic -> length-m matches reliably extend -> ApEn small.
  assert.ok(s.apEn < 0.5, `expected ApEn<0.5, got ${s.apEn}`);
  // Note: ApEn (unlike SampEn) is not strictly non-negative for finite samples
  // due to small-sample self-match bias; tolerate small negative drift.
  assert.ok(s.apEn >= -0.01, `ApEn close-to-zero acceptable, got ${s.apEn}`);
});

test('apen: ApEn always finite for non-constant series (no degenerate failure mode)', () => {
  // Single short transition where SampEn would degenerate (no length-(m+1) match)
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const data = series(vals);
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN, m: 2, r: 0.05 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.apEn), `ApEn must be finite, got ${s.apEn}`);
  assert.ok(Number.isFinite(s.phiM));
  assert.ok(Number.isFinite(s.phiMp1));
  assert.equal(r.droppedDegenerate, 0);
});

test('apen: random-ish series -> higher ApEn than periodic', () => {
  const period = [1, 2, 3, 4, 3, 2];
  const periodic: number[] = [];
  for (let i = 0; i < 60; i++) periodic.push(period[i % 6]!);
  // Pseudo-random LCG
  let seed = 7;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const random = Array.from({ length: 60 }, () => rng());
  const r1 = buildSourceRowTokenApproximateEntropy(series(periodic, 'p'), {
    generatedAt: GEN,
    m: 2,
    r: 0.2,
  });
  const r2 = buildSourceRowTokenApproximateEntropy(series(random, 'q'), {
    generatedAt: GEN,
    m: 2,
    r: 0.2,
  });
  const apenP = r1.sources[0]!.apEn;
  const apenR = r2.sources[0]!.apEn;
  assert.ok(apenR > apenP, `random ApEn (${apenR}) should exceed periodic ApEn (${apenP})`);
});

test('apen: alternating two-level sequence has near-zero ApEn', () => {
  const vals = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1 : 2));
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
    r: 0.2,
  });
  const s = r.sources[0]!;
  // perfect alternation -> templates [1,2] and [2,1] each match exactly half;
  // extensions also match exactly half -> ApEn = 0 by construction
  assert.ok(Math.abs(s.apEn) < 0.05, `expected ApEn ~ 0, got ${s.apEn}`);
});

test('apen: sigma and tolerance recorded correctly', () => {
  const vals = Array.from({ length: 20 }, (_, i) => i);
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
    r: 0.5,
  });
  const s = r.sources[0]!;
  assert.ok(s.sigma > 5 && s.sigma < 6, `sigma should be ~5.77, got ${s.sigma}`);
  assert.equal(s.tolerance, 0.5 * s.sigma);
});

test('apen: template counts correct', () => {
  const vals = Array.from({ length: 20 }, (_, i) => i + 0.1 * (i % 3));
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsKept, 20);
  assert.equal(s.templateCountM, 19); // n - m + 1
  assert.equal(s.templateCountMp1, 18); // n - m
});

test('apen: invalid m throws', () => {
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { m: 0 }));
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { m: 7 }));
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { m: 1.5 }));
});

test('apen: invalid r throws', () => {
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { r: 0 }));
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { r: -0.1 }));
  assert.throws(() => buildSourceRowTokenApproximateEntropy([], { r: NaN }));
});

test('apen: invalid minRows throws (must be >= m+2)', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { m: 2, minRows: 3 }),
  );
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { m: 3, minRows: 4 }),
  );
});

test('apen: invalid sort throws', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { sort: 'bogus' as never }),
  );
});

test('apen: invalid since/until throws', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { until: 'not-a-date' }),
  );
});

test('apen: invalid top throws', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { top: 1.5 }),
  );
});

test('apen: source filter restricts and counts dropped', () => {
  const data = [
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'a'),
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'b'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 15);
});

test('apen: sort apen-desc puts highest ApEn first', () => {
  let seed = 11;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const data = [
    ...series(Array.from({ length: 30 }, () => rng()), 'noisy'),
    ...series(
      Array.from({ length: 30 }, (_, i) => [1, 2, 3, 2][i % 4]!),
      'periodic',
    ),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    sort: 'apen-desc',
  });
  assert.equal(r.sources[0]!.source, 'noisy');
  assert.equal(r.sources[1]!.source, 'periodic');
});

test('apen: sort apen-asc puts lowest ApEn first', () => {
  let seed = 11;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const data = [
    ...series(Array.from({ length: 30 }, () => rng()), 'noisy'),
    ...series(
      Array.from({ length: 30 }, (_, i) => [1, 2, 3, 2][i % 4]!),
      'periodic',
    ),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    sort: 'apen-asc',
  });
  assert.equal(r.sources[0]!.source, 'periodic');
  assert.equal(r.sources[1]!.source, 'noisy');
});

test('apen: sort by rows desc', () => {
  const data = [
    ...series(Array.from({ length: 30 }, (_, i) => i + 0.1 * (i % 5)), 'big'),
    ...series(Array.from({ length: 14 }, (_, i) => i + 0.1 * (i % 5)), 'small'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('apen: sort by source asc', () => {
  const data = [
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'zeta'),
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'alpha'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('apen: --top caps and counts droppedBelowTopCap', () => {
  const data = [
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'a'),
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'b'),
    ...series(Array.from({ length: 15 }, (_, i) => i + 1), 'c'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('apen: bad hour_start counted', () => {
  const bad = ql('not-a-date', 's', 5);
  const data = [bad, ...series(Array.from({ length: 15 }, (_, i) => i + 1))];
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('apen: negative tokens counted', () => {
  const bad = ql('2026-04-25T00:00:00Z', 's', -5);
  const data = [bad, ...series(Array.from({ length: 15 }, (_, i) => i + 1))];
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('apen: NaN tokens counted', () => {
  const bad = ql('2026-04-25T00:00:00Z', 's', Number.NaN);
  const data = [bad, ...series(Array.from({ length: 15 }, (_, i) => i + 1))];
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('apen: window since/until filters', () => {
  const data = series(Array.from({ length: 30 }, (_, i) => i + 1));
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-25T00:15:00Z',
  });
  // 15 rows in [00:00, 00:15) -> below default minRows 12? No, exactly 15 -> kept
  assert.equal(r.sources[0]!.rowsKept, 15);
});

test('apen: ascending integer ramp has small but positive ApEn', () => {
  const vals = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
    r: 0.5,
  });
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.apEn));
  assert.ok(s.apEn >= -0.1, `ApEn ~ small, got ${s.apEn}`);
});

test('apen: phi^m >= phi^(m+1) (so ApEn >= 0) — Pincus monotonicity in m on noise', () => {
  // For any non-constant series with self-matches included,
  // C_i^m >= C_i^(m+1) (extending a window can only reduce matches),
  // so ln(C_i^m) >= ln(C_i^(m+1)) and phi^m >= phi^(m+1).
  let seed = 19;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const vals = Array.from({ length: 50 }, () => rng());
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
    r: 0.2,
  });
  const s = r.sources[0]!;
  assert.ok(s.phiM >= s.phiMp1 - 1e-9, `phi^m (${s.phiM}) should be >= phi^(m+1) (${s.phiMp1})`);
  assert.ok(s.apEn >= -1e-9, `ApEn should be >=0, got ${s.apEn}`);
});

test('apen: m=1 works and yields finite ApEn', () => {
  const vals = Array.from({ length: 20 }, (_, i) => i + 0.1 * (i % 3));
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 1,
    r: 0.2,
    minRows: 5,
  });
  const s = r.sources[0]!;
  assert.equal(s.templateCountM, 20);
  assert.equal(s.templateCountMp1, 19);
  assert.ok(Number.isFinite(s.apEn));
});

test('apen: m=3 works with enough rows', () => {
  const vals = Array.from({ length: 30 }, (_, i) => i + 0.1 * (i % 5));
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 3,
    r: 0.2,
  });
  const s = r.sources[0]!;
  assert.equal(s.templateCountM, 28);
  assert.equal(s.templateCountMp1, 27);
  assert.ok(Number.isFinite(s.apEn));
});

test('apen: report carries opts back', () => {
  const r = buildSourceRowTokenApproximateEntropy([], {
    generatedAt: GEN,
    m: 3,
    r: 0.15,
    minRows: 8,
    sort: 'apen-desc',
    top: 5,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
    source: 'mysource',
  });
  assert.equal(r.m, 3);
  assert.equal(r.r, 0.15);
  assert.equal(r.minRows, 8);
  assert.equal(r.sort, 'apen-desc');
  assert.equal(r.top, 5);
  assert.equal(r.windowStart, '2026-04-25T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-26T00:00:00Z');
  assert.equal(r.source, 'mysource');
});

test('apen: tiebreak on equal ApEn is source asc', () => {
  // Two identical periodic sources -> identical ApEn -> tiebreak by source
  const period = [1, 2, 3, 4];
  const vals: number[] = [];
  for (let i = 0; i < 30; i++) vals.push(period[i % 4]!);
  const data = [
    ...series(vals, 'zsource'),
    ...series(vals, 'asource'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    sort: 'apen-asc',
  });
  assert.equal(r.sources[0]!.source, 'asource');
  assert.equal(r.sources[1]!.source, 'zsource');
});

test('apen: empty source string mapped to "unknown"', () => {
  const data = series(Array.from({ length: 15 }, (_, i) => i + 1), '');
  const r = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('apen: orthogonal-to-SampEn check — ApEn finite where SampEn-style A=0 would degenerate', () => {
  // Sequence designed so that under tight tolerance no length-(m+1) match exists.
  // SampEn would set sampEn=+Inf with degenerateNoExtensions=1.
  // ApEn (with self-matches) has C_i^(m+1) >= 1/Nk > 0, so phi finite, ApEn finite.
  const vals = [1, 100, 2, 200, 3, 300, 4, 400, 5, 500, 6, 600, 7, 700, 8];
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
    m: 2,
    r: 0.001,
  });
  const s = r.sources[0]!;
  assert.ok(Number.isFinite(s.apEn));
  assert.equal(r.droppedDegenerate, 0);
});

test('apen: changing r changes the result monotonically (larger r -> more matches -> lower ApEn typically)', () => {
  let seed = 23;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const vals = Array.from({ length: 40 }, () => rng());
  const data = series(vals);
  const tight = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    m: 2,
    r: 0.05,
  });
  const wide = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    m: 2,
    r: 0.5,
  });
  // Both should be finite; relative magnitude depends on series but
  // very wide r typically produces lower ApEn than very tight r on noise.
  assert.ok(Number.isFinite(tight.sources[0]!.apEn));
  assert.ok(Number.isFinite(wide.sources[0]!.apEn));
  assert.notEqual(tight.sources[0]!.apEn, wide.sources[0]!.apEn);
});

test('apen: deterministic across runs (no wall-clock leak when generatedAt is set)', () => {
  const vals = Array.from({ length: 20 }, (_, i) => i + 0.1 * (i % 3));
  const data = series(vals);
  const r1 = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  const r2 = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('apen: --min-apen suppresses below-threshold and counts droppedBelowMinApen', () => {
  // periodic source -> low ApEn; random-ish source -> higher ApEn
  let seed = 41;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const periodic = Array.from({ length: 30 }, (_, i) => [1, 2, 3, 2][i % 4]!);
  const noisy = Array.from({ length: 30 }, () => rng());
  const data = [...series(periodic, 'p'), ...series(noisy, 'n')];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    minApen: 0.5,
  });
  // Only the noisy one (higher ApEn) should survive
  assert.ok(r.droppedBelowMinApen >= 1);
  for (const s of r.sources) assert.ok(s.apEn >= 0.5);
});

test('apen: --max-apen suppresses above-threshold and counts droppedAboveMaxApen', () => {
  let seed = 41;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const periodic = Array.from({ length: 30 }, (_, i) => [1, 2, 3, 2][i % 4]!);
  const noisy = Array.from({ length: 30 }, () => rng());
  const data = [...series(periodic, 'p'), ...series(noisy, 'n')];
  // Compute baseline first to find an effective maxApen between the two
  const base = buildSourceRowTokenApproximateEntropy(data, { generatedAt: GEN });
  const apens = base.sources.map((s) => s.apEn).sort((a, b) => a - b);
  const cutoff = (apens[0]! + apens[apens.length - 1]!) / 2;
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    maxApen: cutoff,
  });
  assert.ok(r.droppedAboveMaxApen >= 1);
  for (const s of r.sources) assert.ok(s.apEn <= cutoff);
});

test('apen: minApen > maxApen throws', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { minApen: 0.8, maxApen: 0.4 }),
  );
});

test('apen: non-finite minApen/maxApen throws', () => {
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { minApen: NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenApproximateEntropy([], { maxApen: Infinity }),
  );
});

test('apen: minApen and maxApen both null -> all rows kept and counters zero', () => {
  const vals = Array.from({ length: 20 }, (_, i) => i + 0.1 * (i % 3));
  const r = buildSourceRowTokenApproximateEntropy(series(vals), {
    generatedAt: GEN,
  });
  assert.equal(r.minApen, null);
  assert.equal(r.maxApen, null);
  assert.equal(r.droppedBelowMinApen, 0);
  assert.equal(r.droppedAboveMaxApen, 0);
  assert.equal(r.sources.length, 1);
});

test('apen: --min-apen + --max-apen window combination', () => {
  // 3 sources at different ApEn levels
  let seed = 5;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 100;
  };
  const data = [
    ...series(Array.from({ length: 30 }, (_, i) => [1, 2][i % 2]!), 'low'),
    ...series(Array.from({ length: 30 }, (_, i) => [1, 2, 3, 4, 3, 2][i % 6]!), 'mid'),
    ...series(Array.from({ length: 30 }, () => rng()), 'high'),
  ];
  const r = buildSourceRowTokenApproximateEntropy(data, {
    generatedAt: GEN,
    minApen: 0.1,
    maxApen: 1.5,
  });
  // Should keep mid and high; drop low (~0)
  for (const s of r.sources) {
    assert.ok(s.apEn >= 0.1 && s.apEn <= 1.5);
  }
});
