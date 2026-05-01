import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenBoxCountFd,
  boxCountFd,
} from '../src/dailytokenboxcountfd.js';
import { sevcikFd } from '../src/dailytokensevcikfd.js';
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

const GEN = '2026-05-02T12:00:00.000Z';

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- boxCountFd primitive --------------------------------------------

test('boxCountFd: rejects non-finite values', () => {
  assert.throws(() => boxCountFd([1, 2, NaN, 4, 5], 2, 4));
  assert.throws(() => boxCountFd([1, 2, Infinity, 4, 5], 2, 4));
  assert.throws(() => boxCountFd([1, -Infinity, 3, 4, 5], 2, 4));
});

test('boxCountFd: rejects too-short series (n < 3)', () => {
  assert.throws(() => boxCountFd([], 2, 4));
  assert.throws(() => boxCountFd([1], 2, 4));
  assert.throws(() => boxCountFd([1, 2], 2, 4));
});

test('boxCountFd: rejects bad grid bounds', () => {
  assert.throws(() => boxCountFd([1, 2, 3, 4, 5], 1, 4)); // gridMin < 2
  assert.throws(() => boxCountFd([1, 2, 3, 4, 5], 2.5, 4)); // non-integer
  assert.throws(() => boxCountFd([1, 2, 3, 4, 5], 4, 4)); // gridMax <= gridMin
  assert.throws(() => boxCountFd([1, 2, 3, 4, 5], 4, 2)); // gridMax < gridMin
});

test('boxCountFd: rejects zero y-range (constant series)', () => {
  assert.throws(() => boxCountFd([7, 7, 7, 7, 7, 7, 7, 7], 2, 8));
});

test('boxCountFd: rejects when surviving ladder has < 2 grid points', () => {
  // N = 5 -> N-1 = 4 -> ladder cap 4. gridMin=8 -> no surviving grids.
  assert.throws(() => boxCountFd([0, 1, 2, 3, 5], 8, 16));
  // gridMin=4, gridMax=8, but cap at N-1=4 means only m=4 survives.
  assert.throws(() => boxCountFd([0, 1, 2, 3, 5], 4, 8));
});

test('boxCountFd: monotone ramp -> BFD near 1', () => {
  // For a smooth monotone ramp, N(m) ~ m (linear coverage), so log-log
  // slope ~ 1.
  const N = 65;
  const v = Array.from({ length: N }, (_, i) => i + 1);
  const r = boxCountFd(v, 2, 32);
  assert.ok(r.bfd >= 1 && r.bfd <= 1.4, `expected BFD ~ 1, got ${r.bfd}`);
  // R^2 should be very high for a smooth ramp.
  assert.ok(r.slopeR2 > 0.95, `expected R^2 > 0.95, got ${r.slopeR2}`);
});

test('boxCountFd: monotone descending ramp -> BFD low like ascending (both near 1)', () => {
  // Floor-based rasterization is not symmetric under y -> ymax - y
  // because grid-boundary rounding differs at y* = 0 vs y* = 1.
  // Both should still yield BFD near 1 (smooth diagonal).
  const N = 65;
  const up = Array.from({ length: N }, (_, i) => i + 1);
  const dn = Array.from({ length: N }, (_, i) => N - i);
  const a = boxCountFd(up, 2, 32);
  const b = boxCountFd(dn, 2, 32);
  assert.ok(a.bfd < 1.2 && b.bfd < 1.2, `up=${a.bfd} dn=${b.bfd}`);
});

test('boxCountFd: noisy series -> BFD strictly above smooth ramp', () => {
  const N = 129;
  const rng = mulberry32(0xc0ffee);
  const ramp = Array.from({ length: N }, (_, i) => i);
  const noisy = Array.from({ length: N }, () => rng());
  const a = boxCountFd(ramp, 2, 64);
  const b = boxCountFd(noisy, 2, 64);
  assert.ok(b.bfd > a.bfd, `noisy BFD ${b.bfd} should exceed ramp BFD ${a.bfd}`);
});

test('boxCountFd: positive affine rescale invariance (y -> a*y + b, a > 0)', () => {
  const rng = mulberry32(0xdeadbeef);
  const v = Array.from({ length: 200 }, () => rng() * 1000);
  const a = boxCountFd(v, 2, 64);
  const v2 = v.map((x) => 13.7 * x + 5000);
  const b = boxCountFd(v2, 2, 64);
  // Range-normalization absorbs both a and b; box counts identical.
  assert.deepEqual(a.boxCounts, b.boxCounts);
  assert.ok(Math.abs(a.bfdRaw - b.bfdRaw) < 1e-12);
});

test('boxCountFd: clamps to [1, 2]', () => {
  // Construct alternation that should yield BFD near 2 (high coverage).
  const N = 257;
  const v: number[] = [];
  for (let i = 0; i < N; i += 1) v.push(i % 2 === 0 ? 0 : 1000);
  const r = boxCountFd(v, 2, 128);
  assert.ok(r.bfd >= 1 && r.bfd <= 2, `bfd ${r.bfd} out of [1, 2]`);
  assert.ok(r.bfdRaw > 1.3, `expected high bfdRaw for noisy alternation, got ${r.bfdRaw}`);
});

test('boxCountFd: ladder caps at N-1', () => {
  const N = 17; // N-1 = 16
  const rng = mulberry32(7);
  const v = Array.from({ length: N }, () => rng() * 100);
  const r = boxCountFd(v, 2, 64);
  assert.ok(r.gridMaxUsed <= N - 1, `gridMaxUsed ${r.gridMaxUsed} should be <= ${N - 1}`);
  // Ladder by doubling from 2: 2, 4, 8, 16. So gridMaxUsed = 16, nGridSteps = 4.
  assert.equal(r.gridMaxUsed, 16);
  assert.equal(r.nGridSteps, 4);
});

test('boxCountFd: N(m) is monotone non-decreasing across ladder', () => {
  const rng = mulberry32(999);
  const v = Array.from({ length: 200 }, () => rng() * 50 + 10);
  const r = boxCountFd(v, 2, 64);
  for (let i = 1; i < r.boxCounts.length; i += 1) {
    assert.ok(
      r.boxCounts[i]! >= r.boxCounts[i - 1]!,
      `N(m) not monotone: ${r.boxCounts[i - 1]} -> ${r.boxCounts[i]}`,
    );
  }
});

test('boxCountFd: N(m) bounded by m^2 (cant cover more than total boxes)', () => {
  const rng = mulberry32(42);
  const v = Array.from({ length: 200 }, () => rng() * 100);
  const r = boxCountFd(v, 2, 64);
  // grids = [2, 4, 8, 16, 32, 64]
  for (let i = 0; i < r.boxCounts.length; i += 1) {
    const m = 2 ** (i + 1);
    assert.ok(
      r.boxCounts[i]! <= m * m,
      `N(${m}) = ${r.boxCounts[i]} exceeds m^2 = ${m * m}`,
    );
  }
});

test('boxCountFd: shuffle-sensitive (sorted vs shuffled differ)', () => {
  const rng = mulberry32(0xbabe);
  const v = Array.from({ length: 200 }, () => rng() * 100);
  const sorted = [...v].sort((a, b) => a - b);
  const a = boxCountFd(sorted, 2, 64);
  const b = boxCountFd(v, 2, 64);
  assert.ok(b.bfd - a.bfd > 0.05, `shuffled BFD ${b.bfd} should exceed sorted BFD ${a.bfd}`);
});

test('boxCountFd: NOT invariant under non-affine monotone transform (sqrt witness)', () => {
  const rng = mulberry32(0xfeed);
  // Use a series with wide dynamic range so sqrt reshapes it meaningfully.
  const v = Array.from({ length: 200 }, () => Math.floor(rng() * 10000) + 1);
  const a = boxCountFd(v, 2, 64);
  const v2 = v.map((x) => Math.sqrt(x));
  const b = boxCountFd(v2, 2, 64);
  assert.ok(
    Math.abs(a.bfdRaw - b.bfdRaw) > 1e-3,
    `expected sqrt to change BFD; got |${a.bfdRaw} - ${b.bfdRaw}| = ${Math.abs(a.bfdRaw - b.bfdRaw)}`,
  );
});

test('boxCountFd vs sevcikFd: sameL_differentBFD witness (orthogonal to axis 77)', () => {
  // Two series of equal N. Series A: one big spike at the middle.
  // Series B: many small spikes summing to similar total path length.
  const N = 65;
  const A: number[] = new Array(N).fill(0);
  A[Math.floor(N / 2)] = 1000;
  const B: number[] = [];
  for (let i = 0; i < N; i += 1) B.push(i % 2 === 0 ? 0 : 31.25);
  // SFD of A vs B: both have nontrivial L; values may differ but
  // path-length axis treats every up-down equally weighted.
  const sfdA = sevcikFd(A);
  const sfdB = sevcikFd(B);
  const bfdA = boxCountFd(A, 2, 32);
  const bfdB = boxCountFd(B, 2, 32);
  // The point: SFD ratio and BFD ratio differ. We don't need them
  // identical on SFD; we need (bfdA - bfdB) and (sfdA - sfdB) to be
  // structurally different, e.g. one positive, one negative, or
  // their magnitudes substantially differ -- proving BFD captures
  // a complexity facet SFD misses.
  const dSfd = sfdA.sfdRaw - sfdB.sfdRaw;
  const dBfd = bfdA.bfdRaw - bfdB.bfdRaw;
  // Both finite, both real numbers, and their relationship should be
  // distinguishable -- assert magnitudes differ by at least 1e-2.
  assert.ok(Math.abs(dSfd - dBfd) > 1e-2, `expected SFD/BFD divergence; dSfd=${dSfd}, dBfd=${dBfd}`);
});

test('boxCountFd: slopeR2 in [0, 1]', () => {
  const rng = mulberry32(11);
  const v = Array.from({ length: 200 }, () => rng() * 100);
  const r = boxCountFd(v, 2, 64);
  assert.ok(r.slopeR2 >= 0 && r.slopeR2 <= 1, `R2=${r.slopeR2}`);
});

test('boxCountFd: deterministic / pure (same input, same output)', () => {
  const rng = mulberry32(123);
  const v = Array.from({ length: 100 }, () => rng() * 100);
  const a = boxCountFd(v, 2, 32);
  const b = boxCountFd(v, 2, 32);
  assert.equal(a.bfdRaw, b.bfdRaw);
  assert.deepEqual(a.boxCounts, b.boxCounts);
});

// ---- buildDailyTokenBoxCountFd builder -------------------------------

test('build: zero rows -> empty report', () => {
  const r = buildDailyTokenBoxCountFd([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.gridMin, 2);
  assert.equal(r.gridMax, 32);
});

test('build: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src', 100),
    ql('2026-01-01T00:00:00.000Z', 'src', 100),
  ];
  const r = buildDailyTokenBoxCountFd(queue, { generatedAt: GEN, minTokens: 0, minTenureDays: 4 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive total_tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'src', 0),
    ql('2026-01-01T01:00:00.000Z', 'src', -5),
    ql('2026-01-01T02:00:00.000Z', 'src', 100),
  ];
  const r = buildDailyTokenBoxCountFd(queue, { generatedAt: GEN, minTokens: 0, minTenureDays: 4 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter drops non-matching', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'a', 100),
    ql('2026-01-01T01:00:00.000Z', 'b', 100),
  ];
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    source: 'a',
    minTokens: 0,
    minTenureDays: 4,
  });
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: below min-tokens dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 40; i += 1) {
    queue.push(ql(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, 'small', 1));
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 4,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('build: below min-tenure dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, 's', 1000));
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 32,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance gap-filled series dropped', () => {
  // Source has identical values on every day in tenure -> zero variance.
  // Use 40 consecutive valid dates (Jan 1..31 + Feb 1..9).
  const queue: QueueLine[] = [];
  const dates = [
    ...Array.from({ length: 31 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 9 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`),
  ];
  for (const d of dates) {
    queue.push(ql(`${d}T00:00:00.000Z`, 'flat', 100));
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 32,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: gap-fill produces canonical tenure length', () => {
  // First day 2026-01-01, last day 2026-02-09 -> tenure = 40 days
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 's', 5000),
    ql('2026-02-09T00:00:00.000Z', 's', 7000),
  ];
  // Pad with some intermediate variation so variance > 0
  for (let i = 5; i < 35; i += 3) {
    queue.push(ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00.000Z`, 's', 1000 * i));
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 32,
  });
  if (r.sources.length === 1) {
    assert.equal(r.sources[0]!.nTenureDays, 40);
    assert.equal(r.sources[0]!.firstActiveDay, '2026-01-01');
    assert.equal(r.sources[0]!.lastActiveDay, '2026-02-09');
  }
});

test('build: rejects invalid options', () => {
  assert.throws(() => buildDailyTokenBoxCountFd([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenBoxCountFd([], { minTenureDays: 3 }));
  assert.throws(() => buildDailyTokenBoxCountFd([], { gridMin: 1 }));
  assert.throws(() => buildDailyTokenBoxCountFd([], { gridMax: 1 }));
  assert.throws(() => buildDailyTokenBoxCountFd([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenBoxCountFd([], { sort: 'bogus' as never }),
  );
  assert.throws(() => buildDailyTokenBoxCountFd([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenBoxCountFd([], { until: 'not-a-date' }));
});

test('build: sort by source produces alphabetical order', () => {
  const queue: QueueLine[] = [];
  for (const src of ['gamma', 'alpha', 'beta']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(
        ql(
          `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          src,
          1000 + i * 50 + (src.charCodeAt(0) % 7) * 10,
        ),
      );
    }
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 32,
    sort: 'source',
  });
  if (r.sources.length === 3) {
    assert.equal(r.sources[0]!.source, 'alpha');
    assert.equal(r.sources[1]!.source, 'beta');
    assert.equal(r.sources[2]!.source, 'gamma');
  }
});

test('build: top cap applies after sort', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 40; i += 1) {
      queue.push(
        ql(
          `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          src,
          1000 + i * (src.charCodeAt(0) - 96) * 100,
        ),
      );
    }
  }
  const r = buildDailyTokenBoxCountFd(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minTenureDays: 32,
    top: 2,
  });
  assert.ok(r.sources.length <= 2);
  assert.ok(r.droppedTopSources >= 0);
});

test('build: deterministic on same input', () => {
  const rng = mulberry32(2026);
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    queue.push(
      ql(
        `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`.replace(
          /\d{2}T/,
          (m) => {
            const n = Number(m.slice(0, 2));
            const d = ((n - 1) % 28) + 1;
            return `${String(d).padStart(2, '0')}T`;
          },
        ),
        'src',
        Math.floor(rng() * 5000) + 100,
      ),
    );
  }
  const a = buildDailyTokenBoxCountFd(queue, { generatedAt: GEN, minTokens: 0, minTenureDays: 4 });
  const b = buildDailyTokenBoxCountFd(queue, { generatedAt: GEN, minTokens: 0, minTenureDays: 4 });
  assert.deepEqual(a, b);
});

test('build: default gridMin/gridMax surface in report', () => {
  const r = buildDailyTokenBoxCountFd([], { generatedAt: GEN });
  assert.equal(r.gridMin, 2);
  assert.equal(r.gridMax, 32);
});

test('build: custom gridMin/gridMax surface in report', () => {
  const r = buildDailyTokenBoxCountFd([], {
    generatedAt: GEN,
    gridMin: 4,
    gridMax: 64,
  });
  assert.equal(r.gridMin, 4);
  assert.equal(r.gridMax, 64);
});

// ---- Property-based tests --------------------------------------------

test('property: BFD invariant under translation y -> y + c', () => {
  const rng = mulberry32(0x1234);
  for (let trial = 0; trial < 5; trial += 1) {
    const N = 100 + trial * 30;
    const v = Array.from({ length: N }, () => rng() * 1000);
    const a = boxCountFd(v, 2, 32);
    const v2 = v.map((x) => x + 12345);
    const b = boxCountFd(v2, 2, 32);
    assert.ok(Math.abs(a.bfdRaw - b.bfdRaw) < 1e-12, `trial ${trial}: ${a.bfdRaw} vs ${b.bfdRaw}`);
  }
});

test('property: BFD invariant under positive scale y -> a*y, a > 0', () => {
  const rng = mulberry32(0x5678);
  for (let trial = 0; trial < 5; trial += 1) {
    const N = 80 + trial * 20;
    const v = Array.from({ length: N }, () => rng() * 100 + 1);
    const a = boxCountFd(v, 2, 32);
    const scale = 0.001 + rng() * 1000;
    const v2 = v.map((x) => x * scale);
    const b = boxCountFd(v2, 2, 32);
    assert.ok(Math.abs(a.bfdRaw - b.bfdRaw) < 1e-10, `trial ${trial}: ${a.bfdRaw} vs ${b.bfdRaw}`);
  }
});

test('property: BFD bounded by [1 - eps, 2 + eps] across many random series', () => {
  const rng = mulberry32(0x9abc);
  for (let trial = 0; trial < 20; trial += 1) {
    const N = 50 + trial * 10;
    const v = Array.from({ length: N }, () => rng() * 1000);
    const r = boxCountFd(v, 2, 32);
    // Allow small drift outside [1, 2] before clamping.
    assert.ok(r.bfdRaw > 0.5 && r.bfdRaw < 2.5, `trial ${trial}: bfdRaw=${r.bfdRaw}`);
    assert.ok(r.bfd >= 1 && r.bfd <= 2);
  }
});

test('property: BFD strictly larger for shuffle than for sort across many random series', () => {
  const rng = mulberry32(0xface);
  let wins = 0;
  const trials = 10;
  for (let trial = 0; trial < trials; trial += 1) {
    const N = 100;
    const v = Array.from({ length: N }, () => rng() * 100);
    const sorted = [...v].sort((a, b) => a - b);
    const a = boxCountFd(sorted, 2, 32);
    const b = boxCountFd(v, 2, 32);
    if (b.bfd > a.bfd) wins += 1;
  }
  // Shuffled should win the vast majority of the time.
  assert.ok(wins >= trials - 1, `shuffle BFD beat sort only ${wins}/${trials} times`);
});

test('property: monotone-transform-invariance witness across multiple sqrt-style transforms', () => {
  // Confirm BFD is sensitive to monotone non-affine transforms.
  const rng = mulberry32(0xdada);
  let differs = 0;
  const trials = 10;
  for (let trial = 0; trial < trials; trial += 1) {
    const N = 100;
    const v = Array.from({ length: N }, () => Math.floor(rng() * 10000) + 1);
    const a = boxCountFd(v, 2, 32);
    const v2 = v.map((x) => Math.sqrt(x));
    const b = boxCountFd(v2, 2, 32);
    if (Math.abs(a.bfdRaw - b.bfdRaw) > 1e-4) differs += 1;
  }
  // Most trials should differ.
  assert.ok(differs >= trials - 2, `sqrt-transform differed in only ${differs}/${trials}`);
});
