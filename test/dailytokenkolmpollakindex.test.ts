import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenKolmPollakIndex,
  kolmPollakOfVector,
} from '../src/dailytokenkolmpollakindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- kolmPollakOfVector primitive --------------------------------------

test('kolmPollakOfVector: empty -> degenerate, K=0', () => {
  const r = kolmPollakOfVector([], 1.0);
  assert.equal(r.kolm, 0);
  assert.equal(r.degenerate, true);
});

test('kolmPollakOfVector: n=1 -> degenerate, K=0', () => {
  const r = kolmPollakOfVector([42], 1.0);
  assert.equal(r.kolm, 0);
  assert.equal(r.degenerate, true);
});

test('kolmPollakOfVector: all-zero -> degenerate, K=0', () => {
  const r = kolmPollakOfVector([0, 0, 0, 0], 1.0);
  assert.equal(r.kolm, 0);
  assert.equal(r.degenerate, true);
});

test('kolmPollakOfVector: perfect equality -> K=0', () => {
  const r = kolmPollakOfVector([10, 10, 10, 10], 0.1);
  assert.ok(Math.abs(r.kolm) < 1e-10);
  assert.equal(r.degenerate, false);
});

test('kolmPollakOfVector: small-alpha limit ~ variance/(2*mu) * alpha-corrected', () => {
  // For small alpha, K(alpha) ~ (alpha/2) * var(D). Use alpha small.
  const v = [1, 2, 3, 4, 5]; // mean=3, var=2 (population)
  const alpha = 1e-4;
  const r = kolmPollakOfVector(v, alpha);
  // K ~ alpha/2 * var = 0.5e-4 * 2 = 1e-4. Tolerance loose.
  assert.ok(r.kolm > 0);
  assert.ok(r.kolm < 0.01);
});

test('kolmPollakOfVector: large-alpha limit -> Rawlsian deficit (mu - min)', () => {
  const v = [1, 2, 3, 4, 100]; // mu=22, min=1, deficit=21
  const r = kolmPollakOfVector(v, 10.0);
  // alpha very large => K -> mu - min = 21. Tolerance: within 5%.
  assert.ok(r.kolm > 19.9);
  assert.ok(r.kolm <= 21.0 + 1e-9);
});

test('kolmPollakOfVector: TRANSLATION-INVARIANT: K(D + c) = K(D)', () => {
  const a = kolmPollakOfVector([1, 2, 3, 4, 5], 0.1);
  const b = kolmPollakOfVector([1001, 1002, 1003, 1004, 1005], 0.1);
  assert.ok(Math.abs(a.kolm - b.kolm) < 1e-9);
});

test('kolmPollakOfVector: NOT scale-invariant: K(c*D) = c*K(D) (when alpha rescaled to alpha/c)', () => {
  // K(c*D) at alpha = c*K(D) at c*alpha (homogeneity of degree 1
  // when alpha is rescaled). Verify scale-equivariance:
  const a = kolmPollakOfVector([1, 2, 3, 4, 5], 1.0);
  const b = kolmPollakOfVector([10, 20, 30, 40, 50], 0.1);
  // K(10*D, alpha=0.1) = (1/0.1) ln((1/n) sum exp(0.1*(30 - 10x_i)))
  //                     = 10 * (1/1) ln((1/n) sum exp(1*(3 - x_i)))
  //                     = 10 * K(D, alpha=1).
  assert.ok(Math.abs(b.kolm - 10 * a.kolm) < 1e-9);
});

test('kolmPollakOfVector: permutation invariance', () => {
  const a = kolmPollakOfVector([1, 2, 3, 4, 5], 0.5);
  const b = kolmPollakOfVector([5, 1, 4, 2, 3], 0.5);
  assert.ok(Math.abs(a.kolm - b.kolm) < 1e-12);
});

test('kolmPollakOfVector: regressive transfer raises K', () => {
  const before = kolmPollakOfVector([3, 4, 5], 0.5);
  const after = kolmPollakOfVector([2, 4, 6], 0.5);
  assert.ok(after.kolm > before.kolm);
});

test('kolmPollakOfVector: non-negative (>= 0)', () => {
  for (const v of [
    [1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 1, 2, 3],
    [1, 1, 1, 1000],
  ]) {
    const r = kolmPollakOfVector(v, 0.1);
    assert.ok(r.kolm >= -1e-9);
  }
});

test('kolmPollakOfVector: rejects negative', () => {
  assert.throws(() => kolmPollakOfVector([1, -1, 2], 0.1));
});

test('kolmPollakOfVector: rejects NaN', () => {
  assert.throws(() => kolmPollakOfVector([1, Number.NaN, 2], 0.1));
});

test('kolmPollakOfVector: rejects infinity', () => {
  assert.throws(() => kolmPollakOfVector([1, Number.POSITIVE_INFINITY, 2], 0.1));
});

test('kolmPollakOfVector: rejects alpha <= 0', () => {
  assert.throws(() => kolmPollakOfVector([1, 2, 3], 0));
  assert.throws(() => kolmPollakOfVector([1, 2, 3], -0.1));
});

test('kolmPollakOfVector: rejects non-finite alpha', () => {
  assert.throws(() => kolmPollakOfVector([1, 2, 3], Number.NaN));
  assert.throws(() => kolmPollakOfVector([1, 2, 3], Number.POSITIVE_INFINITY));
});

test('kolmPollakOfVector: log-sum-exp numerically stable on large mu', () => {
  const v = [1e8, 2e8, 3e8, 4e8, 5e8];
  // alpha auto-scaled: alpha_rel/mu = 1.0 / 3e8.
  const r = kolmPollakOfVector(v, 1.0 / 3e8);
  assert.ok(Number.isFinite(r.kolm));
  assert.ok(r.kolm > 0);
});

// ---- buildDailyTokenKolmPollakIndex ------------------------------------

test('build: empty queue', () => {
  const r = buildDailyTokenKolmPollakIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.alphaRel, 1.0);
  assert.equal(r.alphaAbsolute, false);
});

test('build: drops invalid hour_start', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [ql('not-a-date', 'a', 100), ql('2026-04-20T00:00:00Z', 'a', 100)],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: drops non-positive tokens', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [
      ql('2026-04-20T00:00:00Z', 'a', 0),
      ql('2026-04-20T01:00:00Z', 'a', -5),
      ql('2026-04-21T00:00:00Z', 'a', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: respects since/until window', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [
      ql('2026-04-19T00:00:00Z', 'a', 1000),
      ql('2026-04-20T00:00:00Z', 'a', 2000),
      ql('2026-04-21T00:00:00Z', 'a', 3000),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      minDays: 2,
      generatedAt: GEN,
    },
  );
  // Only one day in window -> below min-days.
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [
      ql('2026-04-20T00:00:00Z', 'a', 1000),
      ql('2026-04-21T00:00:00Z', 'a', 2000),
      ql('2026-04-20T00:00:00Z', 'b', 500),
    ],
    { source: 'a', generatedAt: GEN },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]?.source, 'a');
});

test('build: drops sparse sources below min-tokens', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [
      ql('2026-04-20T00:00:00Z', 'a', 100),
      ql('2026-04-21T00:00:00Z', 'a', 100),
    ],
    { minTokens: 1000, generatedAt: GEN },
  );
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops sources below min-days', () => {
  const r = buildDailyTokenKolmPollakIndex(
    [
      ql('2026-04-20T00:00:00Z', 'a', 5000),
      ql('2026-04-20T01:00:00Z', 'a', 5000),
    ],
    { minDays: 2, generatedAt: GEN },
  );
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: top cap', () => {
  const lines: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let d = 0; d < 3; d += 1) {
      lines.push(
        ql(`2026-04-${20 + d}T00:00:00Z`, `s${s}`, 5000 + s * 1000 * (d + 1)),
      );
    }
  }
  const r = buildDailyTokenKolmPollakIndex(lines, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: per-source alpha auto-scales by meanDaily', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1000),
    ql('2026-04-21T00:00:00Z', 'a', 9000),
    ql('2026-04-20T00:00:00Z', 'b', 1_000_000),
    ql('2026-04-21T00:00:00Z', 'b', 9_000_000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    alphaRel: 1.0,
    generatedAt: GEN,
  });
  const a = r.sources.find((s) => s.source === 'a');
  const b = r.sources.find((s) => s.source === 'b');
  assert.ok(a !== undefined && b !== undefined);
  // Both scaled to alpha*mu = 1.0; since both vectors are
  // proportional (b = 1000 * a), and Kolm-Pollak is degree-1
  // homogeneous when alpha is rescaled by 1/c, b.kolm = 1000 * a.kolm.
  assert.ok(Math.abs(b!.kolm - 1000 * a!.kolm) / b!.kolm < 1e-6);
  // kolmRelativeIntensity should be IDENTICAL (dimensionless).
  assert.ok(Math.abs(a!.kolmRelativeIntensity - b!.kolmRelativeIntensity) < 1e-9);
});

test('build: alpha-absolute mode does NOT auto-scale', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1000),
    ql('2026-04-21T00:00:00Z', 'a', 9000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    alphaRel: 0.001,
    alphaAbsolute: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.alphaEffective, 0.001);
});

test('build: includeAdditiveInvarianceWitness verifies translation-invariance', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1000),
    ql('2026-04-21T00:00:00Z', 'a', 9000),
    ql('2026-04-22T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    includeAdditiveInvarianceWitness: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.kolmIfPlusMu !== undefined);
  assert.ok(row.additiveInvarianceResidual !== undefined);
  // Residual must be ~ 0.
  assert.ok(row.additiveInvarianceResidual! < 1e-6);
});

test('build: includeRawlsianAnchor surfaces deficit and ratio', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1000),
    ql('2026-04-21T00:00:00Z', 'a', 9000),
    ql('2026-04-22T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    includeRawlsianAnchor: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // mean = 5000, min = 1000, deficit = 4000.
  assert.equal(row.rawlsianDeficit, 4000);
  assert.ok(row.kolmOverRawlsian !== undefined);
  assert.ok(row.kolmOverRawlsian! > 0 && row.kolmOverRawlsian! <= 1.0);
});

test('build: kolm relative intensity dimensionless and bounded by 1', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1000),
    ql('2026-04-21T00:00:00Z', 'a', 9000),
    ql('2026-04-22T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, { generatedAt: GEN });
  const row = r.sources[0]!;
  // K <= mu - min = 4000, mu = 5000, so k/mu <= 0.8.
  assert.ok(row.kolmRelativeIntensity > 0);
  assert.ok(row.kolmRelativeIntensity < 1);
});

test('build: minKolm display filter', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 5000),
    ql('2026-04-21T00:00:00Z', 'a', 5000), // perfectly equal -> kolm ~= 0
    ql('2026-04-20T00:00:00Z', 'b', 1000),
    ql('2026-04-21T00:00:00Z', 'b', 9000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    minKolm: 100,
    generatedAt: GEN,
  });
  // a should be filtered (kolm ~ 0); b kept (large kolm).
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]?.source, 'b');
  assert.equal(r.droppedBelowMinKolm, 1);
});

test('build: sort by kolm desc default', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'low', 5000),
    ql('2026-04-21T00:00:00Z', 'low', 5500),
    ql('2026-04-20T00:00:00Z', 'high', 1000),
    ql('2026-04-21T00:00:00Z', 'high', 9000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, { generatedAt: GEN });
  assert.equal(r.sources[0]?.source, 'high');
  assert.equal(r.sources[1]?.source, 'low');
});

test('build: sort by source asc on ties / source mode', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'b', 5000),
    ql('2026-04-21T00:00:00Z', 'b', 5000),
    ql('2026-04-20T00:00:00Z', 'a', 5000),
    ql('2026-04-21T00:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenKolmPollakIndex(lines, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]?.source, 'a');
  assert.equal(r.sources[1]?.source, 'b');
});

test('build: rejects bad alpha-rel', () => {
  assert.throws(() =>
    buildDailyTokenKolmPollakIndex([], { alphaRel: 0, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenKolmPollakIndex([], { alphaRel: -1, generatedAt: GEN }),
  );
});

test('build: rejects bad min-days', () => {
  assert.throws(() =>
    buildDailyTokenKolmPollakIndex([], { minDays: 1, generatedAt: GEN }),
  );
});

test('build: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenKolmPollakIndex([], {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
});

test('build: zero-day boosts kolm relative to non-zero baseline', () => {
  const withZero: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 1),
    ql('2026-04-21T00:00:00Z', 'a', 5000),
    ql('2026-04-22T00:00:00Z', 'a', 5000),
  ];
  const baseline: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 2500),
    ql('2026-04-21T00:00:00Z', 'a', 5000),
    ql('2026-04-22T00:00:00Z', 'a', 5000),
  ];
  const a = buildDailyTokenKolmPollakIndex(withZero, { generatedAt: GEN });
  const b = buildDailyTokenKolmPollakIndex(baseline, { generatedAt: GEN });
  assert.ok(a.sources[0]!.kolm > b.sources[0]!.kolm);
});
