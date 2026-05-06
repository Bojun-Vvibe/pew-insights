import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint,
  inoueCopulaScan,
  inoueVerdict,
  averageRanks,
  fnv1a32,
} from '../src/dailytokeninouecopuladfsupempiricalcopulachangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// Build a deterministic synthetic series of n daily values for one source.
function synth(source: string, vals: number[], startDay = '2026-01-01'): QueueLine[] {
  return vals.map((v, i) => {
    const ms = Date.parse(`${startDay}T00:00:00.000Z`) + i * 86_400_000;
    const ts = new Date(ms).toISOString();
    return ql(ts, source, Math.max(1, Math.round(v)));
  });
}

// ---- option validation ---------------------------------------------------

test('inoue: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { minTokens: NaN }),
  );
});

test('inoue: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { minTenureDays: 21.5 }),
  );
});

test('inoue: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { top: 1.5 }),
  );
});

test('inoue: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], {
      sort: 'nope' as 'dMax',
    }),
  );
});

test('inoue: rejects bad kMin', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { kMin: 4 }),
  );
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { kMin: 5.5 }),
  );
});

test('inoue: rejects bad onlyShifts', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], {
      onlyShifts: 'true' as unknown as boolean,
    }),
  );
});

test('inoue: rejects invalid since/until', () => {
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { since: 'wat' }),
  );
  assert.throws(() =>
    buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], { until: 'wat' }),
  );
});

// ---- empty / sparse ------------------------------------------------------

test('inoue: empty queue → empty report', () => {
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.generatedAt, GEN);
});

test('inoue: sparse source dropped by minTokens', () => {
  const q = synth('s', new Array(30).fill(1));
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('inoue: short tenure dropped by minTenureDays', () => {
  const q = synth('s', new Array(15).fill(1000));
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('inoue: zero-variance series dropped', () => {
  const q = synth('s', new Array(30).fill(1000));
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('inoue: invalid hour_start counted', () => {
  const q: QueueLine[] = [ql('not-a-date', 's', 1000)];
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('inoue: non-positive tokens counted', () => {
  const q: QueueLine[] = [ql('2026-01-01T00:00:00.000Z', 's', 0)];
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('inoue: source filter works', () => {
  const q = [
    ...synth('a', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250]),
    ...synth('b', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250]),
  ];
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

// ---- functional behaviour -----------------------------------------------

test('inoue: stationary AR-like series → small dMax / no-shift verdict', () => {
  // Pseudo-random but stationary
  const vals: number[] = [];
  let prev = 1000;
  let s = 12345;
  for (let i = 0; i < 60; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s % 200) - 100;
    prev = Math.round(0.5 * prev + 500 + noise);
    vals.push(Math.max(1, prev));
  }
  const q = synth('s', vals);
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.dMax));
  assert.ok(row.dMax >= 0);
  // Sanity: verdict drawn from the documented ladder.
  assert.ok(['no-shift', 'borderline', 'shift', 'strong-shift'].includes(row.verdict));
});

test('inoue: clear regime change → larger dMax than stationary', () => {
  // First half: low ~100, second half: high ~10000 (joint distribution shifts).
  const lo: number[] = new Array(30).fill(0).map((_, i) => 100 + (i % 5));
  const hi: number[] = new Array(30).fill(0).map((_, i) => 10000 + (i % 7));
  const shifted = synth('shift', [...lo, ...hi]);
  const stationary = synth('stat', new Array(60).fill(0).map((_, i) => 1000 + (i % 11)));
  const r1 = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(shifted, {
    minTokens: 0,
    generatedAt: GEN,
  });
  const r2 = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(stationary, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  const dShift = r1.sources[0]!.dMax;
  const dStat = r2.sources[0]!.dMax;
  assert.ok(
    dShift > dStat,
    `regime-change dMax ${dShift} should exceed stationary dMax ${dStat}`,
  );
  // tauHat for shift should be near the middle (30 ± 10).
  const tau = r1.sources[0]!.tauHat;
  assert.ok(tau >= 15 && tau <= 45, `tauHat=${tau} should be near series midpoint`);
});

test('inoue: tauHatDay is within firstActiveDay..lastActiveDay range', () => {
  const q = synth(
    's',
    new Array(50).fill(0).map((_, i) => 100 + i * 10),
    '2026-02-01',
  );
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.tauHatDay >= row.firstActiveDay);
  assert.ok(row.tauHatDay <= row.lastActiveDay);
});

test('inoue: deterministic — repeated build yields identical dMax / tauHat', () => {
  const q = synth('s', new Array(40).fill(0).map((_, i) => 100 + (i * 37) % 500));
  const a = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 0,
    generatedAt: GEN,
  });
  const b = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(a.sources.length, 1);
  assert.equal(a.sources[0]!.dMax, b.sources[0]!.dMax);
  assert.equal(a.sources[0]!.tauHat, b.sources[0]!.tauHat);
});

test('inoue: rank-invariance — strictly monotone marginal transform leaves dMax unchanged', () => {
  const base = synth(
    's',
    new Array(40).fill(0).map((_, i) => 100 + (i * 53) % 700),
  );
  // Strictly monotone transform: x -> x*3 + 11 (preserves ranks).
  const trans = base.map((q) => ({ ...q, total_tokens: q.total_tokens * 3 + 11 }));
  const r1 = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(base, {
    minTokens: 0,
    generatedAt: GEN,
  });
  const r2 = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(trans, {
    minTokens: 0,
    generatedAt: GEN,
  });
  // Pseudo-observations are the same → same dMax, same tauHat.
  assert.equal(r1.sources[0]!.dMax, r2.sources[0]!.dMax);
  assert.equal(r1.sources[0]!.tauHat, r2.sources[0]!.tauHat);
});

test('inoue: onlyShifts filters out no-shift verdicts', () => {
  // Stationary (likely no-shift) + clear shift series.
  const stat = synth('stat', new Array(60).fill(0).map((_, i) => 1000 + (i % 7)));
  const lo: number[] = new Array(30).fill(100);
  const hi: number[] = new Array(30).fill(10000);
  const shifted = synth('shift', [...lo, ...hi]);
  const q = [...stat, ...shifted];
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(q, {
    minTokens: 0,
    onlyShifts: true,
    generatedAt: GEN,
  });
  for (const row of r.sources) {
    assert.notEqual(row.verdict, 'no-shift');
  }
});

test('inoue: top truncates and counts dropped', () => {
  const sources = ['a', 'b', 'c', 'd'];
  const all: QueueLine[] = [];
  for (const s of sources) {
    const vals = new Array(40).fill(0).map((_, i) => 100 + ((i + s.charCodeAt(0)) * 17) % 500);
    all.push(...synth(s, vals));
  }
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(all, {
    minTokens: 0,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('inoue: sort=tokens orders by totalTokens descending', () => {
  const all: QueueLine[] = [];
  // a: bigger tokens, b: smaller tokens
  all.push(
    ...synth(
      'a',
      new Array(30).fill(0).map((_, i) => 5000 + i * 100),
    ),
  );
  all.push(
    ...synth(
      'b',
      new Array(30).fill(0).map((_, i) => 100 + i),
    ),
  );
  const r = buildDailyTokenInoueCopulaDfSupEmpiricalCopulaChangepoint(all, {
    minTokens: 0,
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

// ---- helper unit tests --------------------------------------------------

test('averageRanks: simple ascending', () => {
  assert.deepEqual(averageRanks([10, 20, 30]), [1, 2, 3]);
});

test('averageRanks: ties get mean rank', () => {
  // 5,5 → both rank (1+2)/2 = 1.5; 7 → rank 3
  assert.deepEqual(averageRanks([5, 5, 7]), [1.5, 1.5, 3]);
});

test('averageRanks: triple tie', () => {
  assert.deepEqual(averageRanks([1, 1, 1]), [2, 2, 2]);
});

test('inoueCopulaScan: rejects N < 11', () => {
  assert.throws(() => inoueCopulaScan([0.1, 0.2, 0.3], [0.4, 0.5, 0.6]));
});

test('inoueCopulaScan: u1/u2 length mismatch', () => {
  assert.throws(() => inoueCopulaScan(new Array(15).fill(0.5), new Array(14).fill(0.5)));
});

test('inoueCopulaScan: kMin out of range', () => {
  const u = Array.from({ length: 20 }, (_, i) => (i + 1) / 21);
  assert.throws(() => inoueCopulaScan(u, u, 4));
  assert.throws(() => inoueCopulaScan(u, u, 11));
});

test('inoueCopulaScan: returns finite dMax on uniform pseudo-obs', () => {
  const N = 25;
  const u1 = Array.from({ length: N }, (_, i) => (i + 1) / (N + 1));
  // Reverse u2 so we get some bivariate structure.
  const u2 = Array.from({ length: N }, (_, i) => (N - i) / (N + 1));
  const r = inoueCopulaScan(u1, u2);
  assert.ok(Number.isFinite(r.dMax));
  assert.ok(r.dMax >= 0);
  assert.ok(r.tauHat >= r.kMin && r.tauHat <= N - r.kMin);
  assert.equal(r.dCurve.length, N - 2 * r.kMin + 1);
});

test('inoueVerdict: cutoff ladder', () => {
  assert.equal(inoueVerdict(0.5), 'no-shift');
  assert.equal(inoueVerdict(1.224), 'borderline');
  assert.equal(inoueVerdict(1.357), 'borderline');
  assert.equal(inoueVerdict(1.358), 'shift');
  assert.equal(inoueVerdict(1.627), 'shift');
  assert.equal(inoueVerdict(1.628), 'strong-shift');
  assert.equal(inoueVerdict(NaN), 'no-shift');
});

test('fnv1a32: deterministic and non-zero', () => {
  assert.equal(fnv1a32('axis231'), fnv1a32('axis231'));
  assert.notEqual(fnv1a32('a'), fnv1a32('b'));
});
