import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenKatzFd,
  katzFd,
} from '../src/dailytokenkatzfd.js';
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

// ---- katzFd primitive ------------------------------------------------

test('katzFd: rejects non-finite values', () => {
  assert.throws(() => katzFd([1, 2, NaN, 4]));
  assert.throws(() => katzFd([1, 2, Infinity, 4]));
});

test('katzFd: rejects too-short series (n < 2)', () => {
  assert.throws(() => katzFd([]));
  assert.throws(() => katzFd([1]));
});

test('katzFd: constant series gives KFD=1.0 cleanly (d/L=1)', () => {
  // Flat: dy = 0 each step -> L = (N-1)*1 = N-1, d = N-1, d/L = 1,
  // log10(d/L) = 0, denom = log10(N-1), KFD = log10(N-1)/log10(N-1) = 1.
  const r = katzFd([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(r.kfdRaw, 1);
  assert.equal(r.kfd, 1);
  assert.ok(Math.abs(r.pathLength - 9) < 1e-9);
  assert.ok(Math.abs(r.maxChord - 9) < 1e-9);
});

test('katzFd: straight ramp gives KFD=1.0 (d/L=1; canonical Katz line)', () => {
  // x = [0, 1, 2], N = 3. Steps dy=[1,1]. L = 2*sqrt(2). d at i=2:
  // sqrt(4+4) = 2*sqrt(2). d/L = 1 -> KFD = log10(2)/log10(2) = 1.
  const r = katzFd([0, 1, 2]);
  assert.equal(r.kfdRaw, 1);
  assert.equal(r.kfd, 1);
});

test('katzFd: 4-point near-ramp with one perturbation gives finite KFD > 1', () => {
  // x = [0, 1, 2.5, 3], N = 4.
  // dy = [1, 1.5, 0.5]. L = sqrt(2) + sqrt(1+2.25) + sqrt(1+0.25)
  //     = 1.41421356 + 1.80277564 + 1.11803399 = 4.33502318
  // Chords from 0: i=1 sqrt(1+1)=sqrt(2);
  //                i=2 sqrt(4+6.25)=sqrt(10.25)=3.20156212;
  //                i=3 sqrt(9+9)=sqrt(18)=4.24264069
  // d = 4.24264069. n = N-1 = 3.
  // log10(3) = 0.47712125. log10(d/L) = log10(0.97868456) =
  // -0.00935. denom = 0.46777. KFD = 0.47712 / 0.46777 = 1.01998..
  const r = katzFd([0, 1, 2.5, 3]);
  assert.ok(Math.abs(r.pathLength - 4.33502318) < 1e-6);
  assert.ok(Math.abs(r.maxChord - 4.24264069) < 1e-6);
  assert.equal(r.maxChordIndex, 3);
  assert.ok(Math.abs(r.kfdRaw - 1.01998) < 1e-3, `kfdRaw=${r.kfdRaw}`);
  assert.ok(r.kfd >= 1 && r.kfd <= 2);
});

test('katzFd: noisy bounded series gives KFD substantially above 1', () => {
  const rng = mulberry32(11);
  const n = 256;
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rng() * 100);
  const r = katzFd(noise);
  assert.ok(r.kfdRaw > 1.05, `expected kfdRaw > 1.05 for noise, got ${r.kfdRaw}`);
  assert.ok(Number.isFinite(r.kfd));
});

test('katzFd: orthogonality witness — shuffled has higher KFD than sorted on heavy-tailed multiset', () => {
  // Multiset statistics (mean, var, gini, atkinson, ...) are
  // identical between sorted and shuffled. KFD must be strictly
  // higher on the shuffled (rough) version than on the sorted
  // (smooth, near-monotone) version. Sorting collapses L toward
  // d (the curve nearly equals its own start-to-end chord);
  // shuffling pumps L while leaving d roughly comparable, so
  // d/L collapses and KFD inflates.
  const rng = mulberry32(7);
  const n = 256;
  const base: number[] = [];
  for (let i = 0; i < n; i += 1) {
    base.push(Math.floor(Math.exp(rng() * 6)));
  }
  const sorted = [...base].sort((a, b) => a - b);
  const sortedKfd = katzFd(sorted).kfdRaw;
  const shuffledKfd = katzFd(base).kfdRaw;
  assert.ok(
    shuffledKfd - sortedKfd > 0.02,
    `shuffled KFD (${shuffledKfd}) must exceed sorted KFD (${sortedKfd}) by >= 0.02`,
  );
});

test('katzFd: outputs finite across diverse non-constant inputs (property test)', () => {
  const n = 128;
  const cases: number[][] = [];
  // Ramp + mild perturbation (avoid exact-line denominator collapse).
  const ramp: number[] = [];
  for (let i = 0; i < n; i += 1) ramp.push(i + (i % 7 === 0 ? 0.5 : 0));
  cases.push(ramp);
  // Pseudo-random uniform.
  const rng = mulberry32(2027);
  const noise: number[] = [];
  for (let i = 0; i < n; i += 1) noise.push(rng());
  cases.push(noise);
  // Heavy-tailed positive series.
  const heavy: number[] = [];
  const rng2 = mulberry32(19);
  for (let i = 0; i < n; i += 1) heavy.push(Math.floor(Math.exp(rng2() * 8)));
  cases.push(heavy);
  // Ramp + noise.
  const rampNoisy: number[] = [];
  const rng3 = mulberry32(13);
  for (let i = 0; i < n; i += 1) rampNoisy.push(i + rng3() * 5);
  cases.push(rampNoisy);
  // Alternation + tiny jitter.
  const altr: number[] = [];
  const rng4 = mulberry32(17);
  for (let i = 0; i < n; i += 1) altr.push((i % 2 === 0 ? 100 : 200) + rng4());
  cases.push(altr);

  for (const x of cases) {
    const r = katzFd(x);
    assert.ok(Number.isFinite(r.kfd), `kfd not finite: ${r.kfd}`);
    assert.ok(Number.isFinite(r.kfdRaw), `kfdRaw not finite: ${r.kfdRaw}`);
    assert.ok(Number.isFinite(r.pathLength), `L not finite`);
    assert.ok(Number.isFinite(r.maxChord), `d not finite`);
    assert.ok(r.kfd >= 1 && r.kfd <= 2, `kfd out of [1,2]: ${r.kfd}`);
    assert.ok(r.pathLength > 0);
    assert.ok(r.maxChord > 0);
    assert.ok(r.maxChordIndex >= 1);
  }
});

// ---- buildDailyTokenKatzFd full pipeline ------------------------------

test('buildDailyTokenKatzFd: validates option ranges', () => {
  assert.throws(() => buildDailyTokenKatzFd([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenKatzFd([], { minTenureDays: 3 }));
  assert.throws(() => buildDailyTokenKatzFd([], { top: -1 }));
  assert.throws(() => buildDailyTokenKatzFd([], { sort: 'bogus' as any }));
  assert.throws(() => buildDailyTokenKatzFd([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenKatzFd([], { until: 'not-a-date' }));
});

test('buildDailyTokenKatzFd: empty queue -> empty rows with defaults', () => {
  const r = buildDailyTokenKatzFd([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minTenureDays, 32);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'absKfdDeviationDesc');
});

test('buildDailyTokenKatzFd: drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 40; d += 1) {
    queue.push(
      ql(`2026-01-${String(d).padStart(2, '0')}T00:00:00.000Z`, 'sparse', 1),
    );
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKatzFd: drops sources below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d += 1) {
    queue.push(
      ql(`2026-01-${String(d).padStart(2, '0')}T00:00:00.000Z`, 'short', 5000),
    );
  }
  const r = buildDailyTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKatzFd: end-to-end on a noisy 64-day source', () => {
  const queue: QueueLine[] = [];
  const rng = mulberry32(2026);
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const tt = Math.max(1, Math.floor(10000 + (rng() - 0.5) * 4000));
    queue.push(ql(`${day}T00:00:00.000Z`, 'noisy', tt));
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 32,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'noisy');
  assert.equal(row.nTenureDays, 64);
  assert.equal(row.nActiveDays, 64);
  assert.ok(row.kfd >= 1 && row.kfd <= 2);
  assert.ok(row.pathLength > 0);
  assert.ok(row.maxChord > 0);
  assert.ok(row.maxChordIndex >= 1 && row.maxChordIndex <= 63);
});

test('buildDailyTokenKatzFd: sort=kfdDesc orders rough-above-smooth', () => {
  const rng = mulberry32(31);
  const queue: QueueLine[] = [];
  for (let d = 0; d < 64; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'smooth', 1000 + d * 100));
    const tt = Math.max(1, Math.floor(Math.exp(rng() * 9)));
    queue.push(ql(`${day}T00:00:00.000Z`, 'rough', tt));
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    minTenureDays: 32,
    sort: 'kfdDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'rough');
  assert.equal(r.sources[1]!.source, 'smooth');
  assert.ok(r.sources[0]!.kfd >= r.sources[1]!.kfd);
});

test('buildDailyTokenKatzFd: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 40; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 1000 + d * 17));
    }
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    minTenureDays: 32,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenKatzFd: window since/until filters rows', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 90; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'win', 5000 + d));
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    since: '2026-02-01T00:00:00.000Z',
    until: '2026-03-15T00:00:00.000Z',
    minTenureDays: 32,
  });
  assert.equal(r.windowStart, '2026-02-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-03-15T00:00:00.000Z');
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.nTenureDays >= 32);
  assert.ok(r.sources[0]!.nTenureDays <= 43);
});

test('buildDailyTokenKatzFd: source filter retains only matching source', () => {
  const queue: QueueLine[] = [];
  for (const src of ['keep', 'drop']) {
    for (let d = 0; d < 40; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 2000 + d));
    }
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    source: 'keep',
    minTenureDays: 32,
  });
  assert.equal(r.source, 'keep');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenKatzFd: counts non-positive tokens and bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'x', 100),
    ql('2026-01-01T00:00:00.000Z', 'x', 0),
    ql('2026-01-01T00:00:00.000Z', 'x', -5),
  ];
  const r = buildDailyTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenKatzFd: drops zero-variance gap-filled tenures', () => {
  // Two days with identical tokens at the boundary, all middle
  // gap-filled at zero -> mn=0, mx=tokens — that's NOT zero-
  // variance. To trigger zero-variance we need every populated
  // day AND every gap-filled day to be identical, which only
  // happens when the source has a single populated day == 0 (which
  // upstream filter already removes). So this counter is
  // defensive; we exercise the catch path via the constant-series
  // throw inside katzFd by constructing a 32-day flat series.
  // But our gap-fill convention puts gaps as 0 only inside the
  // populated tenure; a single-day source with positive tokens
  // has nTenure = 1 < minTenureDays, so it's dropped earlier.
  // To genuinely hit droppedNonFiniteKfd, ship a 32-day series
  // whose every populated entry is identical; this is what users
  // hit if their token usage is perfectly flat.
  const queue: QueueLine[] = [];
  for (let d = 0; d < 32; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'flat', 1000));
  }
  const r = buildDailyTokenKatzFd(queue, {
    generatedAt: GEN,
    minTenureDays: 32,
  });
  // Fully-populated, every day == 1000 -> mn === mx -> droppedZeroVariance.
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});
