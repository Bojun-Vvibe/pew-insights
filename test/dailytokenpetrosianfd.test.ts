import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPetrosianFd,
  petrosianFd,
} from '../src/dailytokenpetrosianfd.js';
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

// ---- petrosianFd primitive --------------------------------------------

test('petrosianFd: rejects non-finite values', () => {
  assert.throws(() => petrosianFd([1, 2, NaN, 4]));
  assert.throws(() => petrosianFd([1, 2, Infinity, 4]));
  assert.throws(() => petrosianFd([1, -Infinity, 3]));
});

test('petrosianFd: rejects too-short series (n < 3)', () => {
  assert.throws(() => petrosianFd([]));
  assert.throws(() => petrosianFd([1]));
  assert.throws(() => petrosianFd([1, 2]));
});

test('petrosianFd: monotone ramp -> Nd = 0, PFD = 1.0 exactly', () => {
  const v = Array.from({ length: 50 }, (_, i) => i + 1);
  const r = petrosianFd(v);
  assert.equal(r.Nd, 0);
  assert.equal(r.M, 49);
  // log10(M) / (log10(M) + log10(M/M)) = log10(M) / log10(M) = 1.
  assert.ok(Math.abs(r.pfd - 1) < 1e-12);
  assert.ok(Math.abs(r.pfdRaw - 1) < 1e-12);
  assert.equal(r.flipRate, 0);
});

test('petrosianFd: monotone descending ramp -> Nd = 0, PFD = 1.0', () => {
  const v = Array.from({ length: 30 }, (_, i) => 100 - i);
  const r = petrosianFd(v);
  assert.equal(r.Nd, 0);
  assert.ok(Math.abs(r.pfd - 1) < 1e-12);
});

test('petrosianFd: constant series (zero diffs map to +1) -> Nd = 0, PFD = 1.0', () => {
  // All diffs are 0 -> +1 -> no flips.
  const v = new Array(40).fill(7);
  const r = petrosianFd(v);
  assert.equal(r.Nd, 0);
  assert.equal(r.zeroDiffs, 39);
  assert.ok(Math.abs(r.pfd - 1) < 1e-12);
});

test('petrosianFd: alternating Nyquist series -> Nd = M-1, PFD near upper bound', () => {
  // Strict alternation 0, 1, 0, 1, ... -> diff is +1, -1, +1, -1, ...
  // -> Nd = M - 1.
  const v: number[] = [];
  for (let i = 0; i < 100; i += 1) v.push(i % 2);
  const r = petrosianFd(v);
  assert.equal(r.M, 99);
  assert.equal(r.Nd, 98);
  // Nyquist PFD ~ 1.046 for M = 99; just check it's bounded and well above 1.
  assert.ok(r.pfd > 1.04);
  assert.ok(r.pfd < 1.1);
  assert.ok(r.pfd <= 2);
});

test('petrosianFd: closed-form match on small hand-checked series', () => {
  // [1, 2, 1, 2, 1] -> diffs [+1, -1, +1, -1] -> M = 4, Nd = 3.
  // PFD = log10(4) / (log10(4) + log10(4 / (4 + 1.2)))
  const v = [1, 2, 1, 2, 1];
  const r = petrosianFd(v);
  assert.equal(r.M, 4);
  assert.equal(r.Nd, 3);
  const M = 4;
  const Nd = 3;
  const expected =
    Math.log10(M) / (Math.log10(M) + Math.log10(M / (M + 0.4 * Nd)));
  assert.ok(Math.abs(r.pfdRaw - expected) < 1e-12);
});

test('petrosianFd: positive multiplicative rescale leaves Nd / PFD bit-identical', () => {
  const rng = mulberry32(0xdeadbeef);
  const v = Array.from({ length: 200 }, () => rng() * 1000);
  const a = petrosianFd(v);
  const v2 = v.map((x) => x * 13.7);
  const b = petrosianFd(v2);
  assert.equal(a.Nd, b.Nd);
  assert.equal(a.pfd, b.pfd);
  assert.equal(a.pfdRaw, b.pfdRaw);
});

test('petrosianFd: shift-by-constant invariance (sign-of-diff invariant under additive shift)', () => {
  const rng = mulberry32(0xfeedface);
  const v = Array.from({ length: 100 }, () => rng() * 100);
  const a = petrosianFd(v);
  const v2 = v.map((x) => x + 5000);
  const b = petrosianFd(v2);
  assert.equal(a.Nd, b.Nd);
  assert.equal(a.pfdRaw, b.pfdRaw);
});

test('petrosianFd: sorted vs shuffled witness (multiset-invariance violation)', () => {
  // Same multiset, sorted -> ramp -> PFD ~ 1; shuffled -> many flips -> PFD > 1.
  const rng = mulberry32(0xc0ffee);
  const base = Array.from({ length: 200 }, () => Math.floor(rng() * 1000));
  const sorted = [...base].sort((a, b) => a - b);
  const shuffled = [...base];
  // Fisher-Yates
  const r2 = mulberry32(0x12345);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r2() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  const ps = petrosianFd(sorted);
  const psh = petrosianFd(shuffled);
  // Sorted has Nd ~ 0 (one zero-diff from any equal pair counts as +1 run).
  assert.ok(ps.Nd <= 1);
  assert.ok(ps.pfd < 1.005);
  // Shuffled inflates Nd substantially.
  assert.ok(psh.Nd > 50);
  assert.ok(psh.pfd > ps.pfd + 0.01);
});

test('petrosianFd: flipRate matches Nd / (M-1)', () => {
  const v = [1, 2, 1, 2, 1, 2, 1];
  const r = petrosianFd(v);
  assert.equal(r.M, 6);
  assert.equal(r.Nd, 5);
  assert.ok(Math.abs(r.flipRate - 5 / 5) < 1e-12);
});

test('petrosianFd: clamp bounds reported but pfdRaw retained', () => {
  // It's hard to make pfdRaw escape [1, 2] on real data; we just verify
  // the wiring on a normal series: clamp flags should both be false.
  const v = [1, 5, 2, 9, 3, 4, 7, 8, 1, 6, 4, 5];
  const r = petrosianFd(v);
  assert.equal(r.clampedBelow1, false);
  assert.equal(r.clampedAbove2, false);
  assert.ok(r.pfdRaw >= 1 && r.pfdRaw <= 2);
  assert.equal(r.pfd, r.pfdRaw);
});

test('petrosianFd: property — random finite series always yield finite PFD in [1, 2]', () => {
  // Defence-in-depth: 200 random seeds at varied lengths, magnitudes
  // and value distributions. PFD must be finite, in [1, 2], with
  // 0 <= Nd <= M-1 and flipRate matching exactly.
  for (let seed = 1; seed <= 200; seed += 1) {
    const rng = mulberry32(seed * 7919 + 13);
    const N = 5 + Math.floor(rng() * 200);
    const scale = 10 ** (rng() * 8 - 2); // 1e-2 .. 1e6
    const v = Array.from({ length: N }, () => rng() * scale - scale / 2);
    const r = petrosianFd(v);
    assert.ok(Number.isFinite(r.pfd), `seed=${seed} pfd not finite`);
    assert.ok(Number.isFinite(r.pfdRaw), `seed=${seed} pfdRaw not finite`);
    assert.ok(r.pfd >= 1 && r.pfd <= 2, `seed=${seed} pfd=${r.pfd} out of [1,2]`);
    assert.ok(r.Nd >= 0 && r.Nd <= r.M - 1, `seed=${seed} Nd=${r.Nd} M=${r.M}`);
    assert.equal(r.M, N - 1);
    assert.ok(
      Math.abs(r.flipRate - r.Nd / (r.M - 1)) < 1e-12,
      `seed=${seed} flipRate mismatch`,
    );
  }
});

test('petrosianFd: monotone-increasing transform invariance (sign-of-diff preserved)', () => {
  // f(x) = exp(x) is strictly monotone increasing -> sign(diff(f(v))) == sign(diff(v)).
  const rng = mulberry32(0xa5a5);
  const v = Array.from({ length: 80 }, () => rng() * 4 - 2); // bounded so exp doesn't overflow
  const v2 = v.map((x) => Math.exp(x));
  const a = petrosianFd(v);
  const b = petrosianFd(v2);
  assert.equal(a.Nd, b.Nd, 'monotone transform must preserve Nd');
  assert.equal(a.pfdRaw, b.pfdRaw);
});

// ---- buildDailyTokenPetrosianFd builder -------------------------------

test('build: gap-fills inside tenure and computes per-source PFD', () => {
  const queue: QueueLine[] = [];
  // src A: ramp on alternate days -> gap-filled series oscillates.
  for (let i = 0; i < 50; i += 1) {
    queue.push(
      ql(`2026-01-${String(((i * 2) % 28) + 1).padStart(2, '0')}T00:00:00Z`, 'A', 1000 + i),
    );
  }
  // src B: monotone-ish, contiguous days.
  for (let i = 0; i < 50; i += 1) {
    const day = `2026-02-${String((i % 28) + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00Z`, 'B', 100 * (i + 1)));
  }
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 100,
  });
  assert.equal(r.generatedAt, GEN);
  assert.ok(r.sources.length >= 1);
  for (const s of r.sources) {
    assert.ok(s.pfd >= 1 && s.pfd <= 2);
    assert.ok(s.M === s.nTenureDays - 1);
    assert.ok(s.Nd >= 0 && s.Nd <= s.M - 1);
  }
});

test('build: drops sources below min-tenure-days and below min-tokens', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'tiny', 50),
    ql('2026-01-02T00:00:00Z', 'tiny', 50),
    ql('2026-01-03T00:00:00Z', 'tiny', 50),
    ql('2026-01-04T00:00:00Z', 'tiny', 50),
    ql('2026-01-05T00:00:00Z', 'tiny', 50),
    ql('2026-01-06T00:00:00Z', 'tiny', 50),
  ];
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minTenureDays: 4,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: invalid hour_start surfaces in droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 100),
    ql('2026-01-01T00:00:00Z', 'A', 1000),
    ql('2026-01-02T00:00:00Z', 'A', 1000),
    ql('2026-01-03T00:00:00Z', 'A', 1000),
    ql('2026-01-04T00:00:00Z', 'A', 1000),
    ql('2026-01-05T00:00:00Z', 'A', 1000),
  ];
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: zero-variance gap-filled series surfaces in droppedZeroVariance', () => {
  // Source with one positive day inside a long-enough single-day tenure?
  // We need >= minTenureDays days but constant series after gap-fill.
  // Make every contiguous day have same value.
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'flat', 500),
    );
  }
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: source filter restricts to a single source', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'A', 100 * i),
    );
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'B', 50 * i),
    );
  }
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    source: 'A',
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.source, 'A');
  assert.ok(r.sources.every((s) => s.source === 'A'));
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: top cap surfaces dropped count', () => {
  const queue: QueueLine[] = [];
  const sources = ['A', 'B', 'C', 'D', 'E'];
  for (const src of sources) {
    for (let i = 1; i <= 10; i += 1) {
      queue.push(
        ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, src, 100 * i + (src.charCodeAt(0) % 7)),
      );
    }
  }
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    top: 2,
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: sort=source orders alphabetically', () => {
  const queue: QueueLine[] = [];
  for (const src of ['c', 'a', 'b']) {
    for (let i = 1; i <= 10; i += 1) {
      queue.push(
        ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, src, 100 * i + src.charCodeAt(0)),
      );
    }
  }
  const r = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    sort: 'source',
    minTenureDays: 4,
    minTokens: 100,
  });
  const names = r.sources.map((s) => s.source);
  assert.deepEqual(names, [...names].sort());
});

test('build: rejects bad options', () => {
  const queue: QueueLine[] = [];
  assert.throws(() =>
    buildDailyTokenPetrosianFd(queue, { minTokens: -5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPetrosianFd(queue, { minTenureDays: 2, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPetrosianFd(queue, { top: -1, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenPetrosianFd(queue, {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildDailyTokenPetrosianFd(queue, { since: 'not-a-date', generatedAt: GEN }),
  );
});

test('build: window since/until filters rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 30; i += 1) {
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'A', 1000 + i),
    );
  }
  const all = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minTenureDays: 4,
    minTokens: 100,
  });
  const win = buildDailyTokenPetrosianFd(queue, {
    generatedAt: GEN,
    since: '2026-01-10T00:00:00Z',
    until: '2026-01-20T00:00:00Z',
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.ok(all.sources.length === 1);
  assert.ok(win.sources.length === 1);
  assert.ok(win.sources[0]!.nTenureDays < all.sources[0]!.nTenureDays);
});
