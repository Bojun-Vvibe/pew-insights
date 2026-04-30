import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMehranIndex,
  mehranOfVector,
} from '../src/dailytokenmehranindex.js';
import { giniOfVector } from '../src/dailytokenginicoefficient.js';
import { bonferroniOfVector } from '../src/dailytokenbonferroniindex.js';
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

// ---- mehranOfVector primitive -----------------------------------------

test('mehranOfVector: empty -> degenerate, M=0', () => {
  const r = mehranOfVector([]);
  assert.equal(r.mehran, 0);
  assert.equal(r.degenerate, true);
});

test('mehranOfVector: n=1 -> degenerate, M=0', () => {
  const r = mehranOfVector([42]);
  assert.equal(r.mehran, 0);
  assert.equal(r.degenerate, true);
});

test('mehranOfVector: all-zero -> degenerate, M=0', () => {
  const r = mehranOfVector([0, 0, 0, 0]);
  assert.equal(r.mehran, 0);
  assert.equal(r.degenerate, true);
});

test('mehranOfVector: perfect equality -> M=0', () => {
  const r = mehranOfVector([10, 10, 10, 10]);
  assert.ok(Math.abs(r.mehran) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('mehranOfVector: maximal inequality on 4 days -> M=1', () => {
  // x_(1..3) = 0, x_(4) = 40; mu = 10
  // S_1=S_2=S_3=0; M_k/mu = 0; sum w_k * 0 = 0; M = 1 - 0 = 1
  const r = mehranOfVector([0, 0, 0, 40]);
  assert.ok(Math.abs(r.mehran - 1) < 1e-12);
});

test('mehranOfVector: two-point [1,9] exact value', () => {
  // n=2, sorted [1,9], mu=5
  // w_1 = 2*(2-1)/(2*1) = 1; S_1=1; ratio = 1/(1*5) = 0.2
  // M = 1 - 1*0.2 = 0.8
  const r = mehranOfVector([1, 9]);
  assert.ok(Math.abs(r.mehran - 0.8) < 1e-12);
});

test('mehranOfVector: three-point [1,2,7] exact value', () => {
  // n=3, sorted [1,2,7], mu=10/3
  // w_1 = 2*(3-1)/(3*2) = 4/6 = 2/3
  // w_2 = 2*(3-2)/(3*2) = 2/6 = 1/3
  // S_1=1, M_1/mu = 1/(10/3) = 3/10 = 0.3
  // S_2=3, M_2 = 1.5, M_2/mu = 1.5/(10/3) = 4.5/10 = 0.45
  // sum = (2/3)*0.3 + (1/3)*0.45 = 0.2 + 0.15 = 0.35
  // M = 1 - 0.35 = 0.65
  const r = mehranOfVector([1, 2, 7]);
  assert.ok(Math.abs(r.mehran - 0.65) < 1e-12);
});

test('mehranOfVector: rank weights sum to 1', () => {
  // For any n>=2, sum_{k=1..n-1} 2*(n-k)/(n*(n-1)) = 1
  for (const n of [2, 3, 4, 5, 10, 50]) {
    let sum = 0;
    const denom = n * (n - 1);
    for (let k = 1; k <= n - 1; k += 1) sum += (2 * (n - k)) / denom;
    assert.ok(Math.abs(sum - 1) < 1e-12, `n=${n} weights sum=${sum}`);
  }
});

test('mehranOfVector: M in [0, 1] for typical inputs', () => {
  for (const v of [
    [1, 1, 1, 1],
    [1, 2, 3, 4, 5],
    [0, 1, 2, 3],
    [1, 1, 1, 1000],
    [5, 5, 5, 5, 5, 5, 100],
    [0, 0, 0, 0, 100],
  ]) {
    const r = mehranOfVector(v);
    assert.ok(r.mehran >= 0, `v=${v} got ${r.mehran}`);
    assert.ok(r.mehran <= 1 + 1e-12, `v=${v} got ${r.mehran}`);
  }
});

test('mehranOfVector: scale-invariant (relative measure)', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = mehranOfVector(v).mehran;
  const b = mehranOfVector(v.map((x) => x * 100)).mehran;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('mehranOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = mehranOfVector(v).mehran;
  const b = mehranOfVector([11, 4, 9, 3, 7, 1]).mehran;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('mehranOfVector: throws on negative', () => {
  assert.throws(() => mehranOfVector([1, -2, 3]));
});

test('mehranOfVector: throws on non-finite', () => {
  assert.throws(() => mehranOfVector([1, Number.NaN, 3]));
  assert.throws(() => mehranOfVector([1, Number.POSITIVE_INFINITY, 3]));
});

test('mehranOfVector: zero day inflates M (bottom-rank-pull)', () => {
  // Adding a zero day to a unequal vector should NOT reduce M.
  const a = mehranOfVector([5, 10, 15]).mehran;
  const b = mehranOfVector([0, 5, 10, 15]).mehran;
  assert.ok(b > a);
});

// ---- relationship with Gini and Bonferroni ----------------------------

test('mehran >= gini for bottom-heavy distribution with one large value', () => {
  // For [1,2,3,4,100] (bulk-low + one extreme), Mehran's bottom-weighted
  // linear kernel reads ABOVE Gini's uniform Lorenz integral. Mehran vs
  // Bonferroni ordering is NOT sign-constrained in general (depends on
  // the bottom-shape vs the harmonic-tail-vs-linear weighting trade).
  const v = [1, 2, 3, 4, 100];
  const g = giniOfVector(v);
  const m = mehranOfVector(v).mehran;
  const b = bonferroniOfVector(v).bonferroni;
  assert.ok(m >= g - 1e-9, `expected M=${m} >= G=${g}`);
  // sanity: both M and B are in (0,1) for this non-degenerate case
  assert.ok(b > 0 && b < 1);
  assert.ok(m > 0 && m < 1);
});

test('mehran equals gini equals bonferroni at perfect equality', () => {
  const v = [7, 7, 7, 7, 7];
  assert.ok(Math.abs(mehranOfVector(v).mehran) < 1e-12);
  assert.ok(Math.abs(giniOfVector(v)) < 1e-12);
  assert.ok(Math.abs(bonferroniOfVector(v).bonferroni) < 1e-12);
});

// ---- buildDailyTokenMehranIndex pipeline ------------------------------

test('build: empty queue -> empty sources, no errors', () => {
  const r = buildDailyTokenMehranIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('2026-04-01T00:00:00Z', 's1', 100),
    ql('2026-04-02T00:00:00Z', 's1', 200),
  ];
  const r = buildDailyTokenMehranIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: drops non-positive total_tokens', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's1', 0),
    ql('2026-04-02T00:00:00Z', 's1', -5),
    ql('2026-04-03T00:00:00Z', 's1', 100),
    ql('2026-04-04T00:00:00Z', 's1', 200),
  ];
  const r = buildDailyTokenMehranIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter routes others to droppedSourceFilter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's1', 1000),
    ql('2026-04-02T00:00:00Z', 's1', 2000),
    ql('2026-04-01T00:00:00Z', 's2', 5000),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    source: 's1',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: minTokens drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's_small', 10),
    ql('2026-04-02T00:00:00Z', 's_small', 20),
    ql('2026-04-01T00:00:00Z', 's_big', 5000),
    ql('2026-04-02T00:00:00Z', 's_big', 6000),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's_big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: minDays drops single-day sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's_one', 5000),
    ql('2026-04-01T01:00:00Z', 's_one', 5000),
    ql('2026-04-01T00:00:00Z', 's_multi', 1000),
    ql('2026-04-02T00:00:00Z', 's_multi', 2000),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    minDays: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's_multi');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: per-day collapse sums hourly buckets', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-01T05:00:00Z', 's', 200),
    ql('2026-04-02T00:00:00Z', 's', 700),
    ql('2026-04-03T00:00:00Z', 's', 0.0001),
  ];
  const r = buildDailyTokenMehranIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // 3 days, totals [300, 700, ~0]
  assert.equal(r.sources[0]!.nDays, 3);
  // mehran computed on [300, 700, 0.0001]
  const expected = mehranOfVector([300, 700, 0.0001]).mehran;
  assert.ok(Math.abs(r.sources[0]!.mehran - expected) < 1e-9);
});

test('build: includeLinearRankExcess populates field', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-02T00:00:00Z', 's', 200),
    ql('2026-04-03T00:00:00Z', 's', 700),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    includeLinearRankExcess: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.notEqual(row.linearRankExcess, undefined);
  assert.ok(Math.abs((row.linearRankExcess as number) - (row.mehran - row.gini)) < 1e-12);
});

test('build: includeBonferroniCrossAnchor populates field', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-02T00:00:00Z', 's', 200),
    ql('2026-04-03T00:00:00Z', 's', 700),
    ql('2026-04-04T00:00:00Z', 's', 50),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    includeBonferroniCrossAnchor: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.notEqual(row.bonferroni, undefined);
  assert.notEqual(row.mehranMinusBonferroni, undefined);
  assert.ok(
    Math.abs(
      (row.mehranMinusBonferroni as number) -
        (row.mehran - (row.bonferroni as number)),
    ) < 1e-12,
  );
});

test('build: sort=mehran descending; ties broken by source asc', () => {
  const queue: QueueLine[] = [
    // s_a: equal-ish (low M)
    ql('2026-04-01T00:00:00Z', 's_a', 1000),
    ql('2026-04-02T00:00:00Z', 's_a', 1100),
    ql('2026-04-03T00:00:00Z', 's_a', 1050),
    // s_b: spiky (high M)
    ql('2026-04-01T00:00:00Z', 's_b', 100),
    ql('2026-04-02T00:00:00Z', 's_b', 100),
    ql('2026-04-03T00:00:00Z', 's_b', 9000),
  ];
  const r = buildDailyTokenMehranIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 's_b');
  assert.equal(r.sources[1]!.source, 's_a');
});

test('build: minMehran filter drops below threshold', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's_low', 1000),
    ql('2026-04-02T00:00:00Z', 's_low', 1010),
    ql('2026-04-01T00:00:00Z', 's_high', 100),
    ql('2026-04-02T00:00:00Z', 's_high', 9000),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    minMehran: 0.3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's_high');
  assert.equal(r.droppedBelowMinMehran, 1);
});

test('build: top cap surfaces remainder count', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql('2026-04-01T00:00:00Z', `s${i}`, 1000 + i));
    queue.push(ql('2026-04-02T00:00:00Z', `s${i}`, 2000 + i));
  }
  const r = buildDailyTokenMehranIndex(queue, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: validates minDays >= 2', () => {
  assert.throws(() => buildDailyTokenMehranIndex([], { minDays: 1 }));
});

test('build: validates minMehran in [0, 1]', () => {
  assert.throws(() => buildDailyTokenMehranIndex([], { minMehran: -0.1 }));
  assert.throws(() => buildDailyTokenMehranIndex([], { minMehran: 1.1 }));
});

test('build: validates sort key', () => {
  assert.throws(() =>
    buildDailyTokenMehranIndex([], {
      sort: 'nonsense' as never,
    }),
  );
});

test('build: time window respected (since/until exclusive end)', () => {
  const queue: QueueLine[] = [
    ql('2026-03-31T23:00:00Z', 's', 1000),
    ql('2026-04-01T00:00:00Z', 's', 2000),
    ql('2026-04-02T00:00:00Z', 's', 3000),
    ql('2026-04-03T00:00:00Z', 's', 4000),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-03T00:00:00Z',
    generatedAt: GEN,
  });
  // Two days kept: 04-01 (2000), 04-02 (3000)
  assert.equal(r.sources[0]!.nDays, 2);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: degenerate single-positive-day source set to mehran=0', () => {
  // Two positive-token rows on same day -> nDays=1 -> dropped by minDays=2
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 5000),
    ql('2026-04-01T01:00:00Z', 's', 5000),
  ];
  const r = buildDailyTokenMehranIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 0);
});

// ---- v0.6.289 refinements --------------------------------------------

test('build: includeDeVergottiniCrossAnchor populates fields', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-02T00:00:00Z', 's', 200),
    ql('2026-04-03T00:00:00Z', 's', 700),
    ql('2026-04-04T00:00:00Z', 's', 50),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    includeDeVergottiniCrossAnchor: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.notEqual(row.deVergottini, undefined);
  assert.notEqual(row.mehranMinusDeVergottini, undefined);
  assert.ok(
    Math.abs(
      (row.mehranMinusDeVergottini as number) -
        (row.mehran - (row.deVergottini as number)),
    ) < 1e-12,
  );
  // For bottom-heavy data, Mehran (linear bottom-weighted) should
  // exceed De Vergottini (harmonic top-weighted).
  assert.ok((row.mehranMinusDeVergottini as number) > 0);
});

test('build: includeEqualityIdentityWitness yields ~0 residual', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 100),
    ql('2026-04-02T00:00:00Z', 's', 200),
    ql('2026-04-03T00:00:00Z', 's', 700),
    ql('2026-04-04T00:00:00Z', 's', 1234),
    ql('2026-04-05T00:00:00Z', 's', 50),
  ];
  const r = buildDailyTokenMehranIndex(queue, {
    includeEqualityIdentityWitness: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.notEqual(row.equalityIdentityResidual, undefined);
  // M(mu * 1) = 0 by construction; allow tiny float epsilon.
  assert.ok(
    (row.equalityIdentityResidual as number) < 1e-12,
    `residual=${row.equalityIdentityResidual}`,
  );
});
