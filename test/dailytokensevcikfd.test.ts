import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenSevcikFd,
  sevcikFd,
} from '../src/dailytokensevcikfd.js';
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

// ---- sevcikFd primitive --------------------------------------------

test('sevcikFd: rejects non-finite values', () => {
  assert.throws(() => sevcikFd([1, 2, NaN, 4]));
  assert.throws(() => sevcikFd([1, 2, Infinity, 4]));
  assert.throws(() => sevcikFd([1, -Infinity, 3]));
});

test('sevcikFd: rejects too-short series (n < 3)', () => {
  assert.throws(() => sevcikFd([]));
  assert.throws(() => sevcikFd([1]));
  assert.throws(() => sevcikFd([1, 2]));
});

test('sevcikFd: rejects zero y-range (constant series)', () => {
  assert.throws(() => sevcikFd([7, 7, 7, 7, 7]));
});

test('sevcikFd: monotone ramp -> SFD near the smooth lower edge', () => {
  // Ramp of length N normalizes to dy*[i] = 1/(N-1) for all i, dx = 1/(N-1).
  // Each segment length = sqrt(2) / (N-1); L = sqrt(2). SFD = 1 + ln(sqrt(2)) / ln(2*(N-1)).
  const N = 50;
  const v = Array.from({ length: N }, (_, i) => i + 1);
  const r = sevcikFd(v);
  const expectedL = Math.sqrt(2);
  assert.ok(Math.abs(r.pathLength - expectedL) < 1e-12);
  const expectedSfd = 1 + Math.log(expectedL) / Math.log(2 * (N - 1));
  assert.ok(Math.abs(r.sfdRaw - expectedSfd) < 1e-12);
  // SFD ~ 1.038 for N=50 -> close to 1 but strictly above.
  assert.ok(r.sfd > 1);
  assert.ok(r.sfd < 1.1);
});

test('sevcikFd: monotone descending ramp -> identical SFD to ascending (range-norm absorbs sign)', () => {
  const N = 50;
  const up = Array.from({ length: N }, (_, i) => i + 1);
  const dn = Array.from({ length: N }, (_, i) => N - i);
  const a = sevcikFd(up);
  const b = sevcikFd(dn);
  assert.ok(Math.abs(a.sfdRaw - b.sfdRaw) < 1e-12);
  assert.ok(Math.abs(a.pathLength - b.pathLength) < 1e-12);
});

test('sevcikFd: closed-form match on small hand-checked series', () => {
  // [0, 1, 0, 1, 0] -> ymin=0, ymax=1, yRange=1, N=5, dx=0.25.
  // dy*[i] = ±1; each segment sqrt(0.0625 + 1) = sqrt(1.0625);
  // L = 4 * sqrt(1.0625).
  const v = [0, 1, 0, 1, 0];
  const r = sevcikFd(v);
  const expectedL = 4 * Math.sqrt(1.0625);
  assert.ok(Math.abs(r.pathLength - expectedL) < 1e-12);
  const expectedSfd = 1 + Math.log(expectedL) / Math.log(2 * 4);
  assert.ok(Math.abs(r.sfdRaw - expectedSfd) < 1e-12);
  assert.equal(r.yRange, 1);
  assert.ok(Math.abs(r.dxStep - 0.25) < 1e-12);
});

test('sevcikFd: positive affine rescale invariance (y to a*y + b, a > 0)', () => {
  const rng = mulberry32(0xdeadbeef);
  const v = Array.from({ length: 200 }, () => rng() * 1000);
  const a = sevcikFd(v);
  const v2 = v.map((x) => 13.7 * x + 5000);
  const b = sevcikFd(v2);
  assert.ok(Math.abs(a.sfdRaw - b.sfdRaw) < 1e-12);
  assert.ok(Math.abs(a.pathLength - b.pathLength) < 1e-12);
});

test('sevcikFd: negative affine rescale (a < 0) yields identical SFD (range-norm absorbs sign)', () => {
  const rng = mulberry32(0xfeedface);
  const v = Array.from({ length: 100 }, () => rng() * 100);
  const a = sevcikFd(v);
  const v2 = v.map((x) => -2.5 * x + 10);
  const b = sevcikFd(v2);
  // |dy| / yRange is preserved under sign flip + rescale.
  assert.ok(Math.abs(a.sfdRaw - b.sfdRaw) < 1e-12);
});

test('sevcikFd: NOT invariant under non-affine monotone transform (sqrt)', () => {
  // sqrt(y) reshapes the dy*[i] distribution -> SFD changes.
  const rng = mulberry32(0xc0ffee01);
  const v = Array.from({ length: 100 }, () => 1 + rng() * 1000); // strictly positive
  const a = sevcikFd(v);
  const v2 = v.map((x) => Math.sqrt(x));
  const b = sevcikFd(v2);
  // We just assert they're materially different (SFD > 1 sensitivity).
  assert.ok(Math.abs(a.sfdRaw - b.sfdRaw) > 1e-6);
});

test('sevcikFd: sorted vs shuffled witness (multiset-invariance violation)', () => {
  // Same multiset, sorted -> ramp -> L = sqrt(2) -> small SFD;
  // shuffled -> many large excursions -> L >> sqrt(2) -> larger SFD.
  const rng = mulberry32(0xc0ffee);
  const base = Array.from({ length: 200 }, () => Math.floor(rng() * 1000));
  const sorted = [...base].sort((a, b) => a - b);
  const shuffled = [...base];
  const r2 = mulberry32(0x12345);
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r2() * (i + 1));
    [shuffled[i]!, shuffled[j]!] = [shuffled[j]!, shuffled[i]!];
  }
  const ps = sevcikFd(sorted);
  const psh = sevcikFd(shuffled);
  // Sorted bounds: each y* step is non-negative and sums to 1; with
  // N - 1 segments of horizontal step 1/(N-1), L is bounded above by
  // sum(sqrt(dx^2 + dy*^2)) <= sum(dx + dy*) = 1 + 1 = 2 (triangle).
  assert.ok(ps.pathLength <= 2 + 1e-9);
  // Shuffled L substantially larger.
  assert.ok(psh.pathLength > ps.pathLength + 1);
  assert.ok(psh.sfd > ps.sfd + 0.05);
});

test('sevcikFd: clamp bounds reported but sfdRaw retained', () => {
  // Normal series: clamp flags should both be false; sfd == sfdRaw.
  const v = [1, 5, 2, 9, 3, 4, 7, 8, 1, 6, 4, 5];
  const r = sevcikFd(v);
  assert.equal(r.clampedBelow1, false);
  assert.equal(r.clampedAbove2, false);
  assert.ok(r.sfdRaw >= 1 && r.sfdRaw <= 2);
  assert.equal(r.sfd, r.sfdRaw);
});

test('sevcikFd: dxStep equals 1 / (N - 1)', () => {
  const v = [0, 1, 2, 3, 4, 5, 6, 0];
  const r = sevcikFd(v);
  assert.ok(Math.abs(r.dxStep - 1 / 7) < 1e-12);
});

test('sevcikFd: property — random finite series always yield finite SFD in [1, 2]', () => {
  // Defence-in-depth: 200 random seeds at varied lengths and value
  // ranges. SFD must be finite, in [1, 2], with positive L.
  for (let seed = 1; seed <= 200; seed += 1) {
    const rng = mulberry32(seed * 7919 + 13);
    const N = 5 + Math.floor(rng() * 200);
    const scale = 10 ** (rng() * 8 - 2); // 1e-2 .. 1e6
    const v = Array.from({ length: N }, () => rng() * scale - scale / 2);
    // Ensure non-constant (vanishingly rare to be constant but defensive).
    if (Math.min(...v) === Math.max(...v)) continue;
    const r = sevcikFd(v);
    assert.ok(Number.isFinite(r.sfd), `seed=${seed} sfd not finite`);
    assert.ok(Number.isFinite(r.sfdRaw), `seed=${seed} sfdRaw not finite`);
    assert.ok(r.sfd >= 1 && r.sfd <= 2, `seed=${seed} sfd=${r.sfd} out of [1,2]`);
    assert.ok(r.pathLength > 0, `seed=${seed} L=${r.pathLength} not positive`);
    assert.ok(r.yRange > 0, `seed=${seed} yRange=${r.yRange} not positive`);
  }
});

// ---- buildDailyTokenSevcikFd builder -------------------------------

test('build: gap-fills inside tenure and computes per-source SFD', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 50; i += 1) {
    queue.push(
      ql(`2026-01-${String(((i * 2) % 28) + 1).padStart(2, '0')}T00:00:00Z`, 'A', 1000 + i),
    );
  }
  for (let i = 0; i < 50; i += 1) {
    const day = `2026-02-${String((i % 28) + 1).padStart(2, '0')}`;
    queue.push(ql(`${day}T00:00:00Z`, 'B', 100 * (i + 1)));
  }
  const r = buildDailyTokenSevcikFd(queue, {
    generatedAt: GEN,
    minTenureDays: 8,
    minTokens: 100,
  });
  assert.equal(r.generatedAt, GEN);
  assert.ok(r.sources.length >= 1);
  for (const s of r.sources) {
    assert.ok(s.sfd >= 1 && s.sfd <= 2);
    assert.ok(s.pathLength > 0);
    assert.ok(s.yRange > 0);
    assert.ok(Math.abs(s.dxStep - 1 / (s.nTenureDays - 1)) < 1e-12);
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
  const r = buildDailyTokenSevcikFd(queue, {
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
  const r = buildDailyTokenSevcikFd(queue, {
    generatedAt: GEN,
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: zero-variance gap-filled series surfaces in droppedZeroVariance', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'flat', 500),
    );
  }
  const r = buildDailyTokenSevcikFd(queue, {
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
  const r = buildDailyTokenSevcikFd(queue, {
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
  const r = buildDailyTokenSevcikFd(queue, {
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
  const r = buildDailyTokenSevcikFd(queue, {
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
    buildDailyTokenSevcikFd(queue, { minTokens: -5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenSevcikFd(queue, { minTenureDays: 2, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenSevcikFd(queue, { top: -1, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenSevcikFd(queue, {
      sort: 'bogus' as never,
      generatedAt: GEN,
    }),
  );
  assert.throws(() =>
    buildDailyTokenSevcikFd(queue, { since: 'not-a-date', generatedAt: GEN }),
  );
});

test('build: window since/until filters rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 30; i += 1) {
    queue.push(
      ql(`2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, 'A', 1000 + i),
    );
  }
  const all = buildDailyTokenSevcikFd(queue, {
    generatedAt: GEN,
    minTenureDays: 4,
    minTokens: 100,
  });
  const win = buildDailyTokenSevcikFd(queue, {
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

test('build: sfdDesc sort orders by SFD descending', () => {
  const queue: QueueLine[] = [];
  // src smooth: monotone ramp -> low SFD.
  for (let i = 1; i <= 15; i += 1) {
    queue.push(
      ql(`2026-03-${String(i).padStart(2, '0')}T00:00:00Z`, 'smooth', 100 * i),
    );
  }
  // src rough: alternating high/low -> high SFD.
  for (let i = 1; i <= 15; i += 1) {
    queue.push(
      ql(
        `2026-03-${String(i).padStart(2, '0')}T00:00:00Z`,
        'rough',
        i % 2 === 0 ? 10000 : 100,
      ),
    );
  }
  const r = buildDailyTokenSevcikFd(queue, {
    generatedAt: GEN,
    sort: 'sfdDesc',
    minTenureDays: 4,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.sfd >= r.sources[1]!.sfd);
  assert.equal(r.sources[0]!.source, 'rough');
});
