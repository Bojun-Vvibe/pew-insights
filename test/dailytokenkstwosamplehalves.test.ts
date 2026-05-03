import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKsTwoSampleHalves,
  buildDailyTokenKsTwoSampleHalves,
} from '../src/dailytokenkstwosamplehalves.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- primitive: input validation ----------

test('dailyTokenKsTwoSampleHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenKsTwoSampleHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenKsTwoSampleHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenKsTwoSampleHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenKsTwoSampleHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenKsTwoSampleHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenKsTwoSampleHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenKsTwoSampleHalves: n1 = floor(n/2), n2 = n - n1, even n', () => {
  const r = dailyTokenKsTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.ksN1, 4);
  assert.equal(r.ksN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenKsTwoSampleHalves: n1 = floor(n/2), n2 = n - n1, odd n', () => {
  const r = dailyTokenKsTwoSampleHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.ksN1, 4);
  assert.equal(r.ksN2, 5);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: clean step shift ----------

test('dailyTokenKsTwoSampleHalves: clean step shift => ksD = 1, ksDSigned = +1', () => {
  // first half all 1s, second half all 5s (but with a single
  // tweak so we don't hit zero-variance guard)
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5];
  const r = dailyTokenKsTwoSampleHalves(x);
  assert.ok(r.ksD > 0.7);
  assert.ok(r.ksDSigned > 0); // second half stochastically larger
  assert.ok(r.ksZ > 1.96);
  assert.ok(r.ksP < 0.05);
});

test('dailyTokenKsTwoSampleHalves: reversed step shift => ksDSigned = -1', () => {
  const x = [5, 5, 5, 5, 1, 1, 1, 1.5];
  const r = dailyTokenKsTwoSampleHalves(x);
  assert.ok(r.ksDSigned < 0);
  assert.ok(r.ksZ < -1.96);
});

// ---------- primitive: identities ----------

test('dailyTokenKsTwoSampleHalves: ksD invariant under additive constant', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const r1 = dailyTokenKsTwoSampleHalves(x);
  const r2 = dailyTokenKsTwoSampleHalves(x.map((v) => v + 100));
  assert.ok(Math.abs(r1.ksD - r2.ksD) < 1e-12);
  assert.ok(Math.abs(r1.ksDSigned - r2.ksDSigned) < 1e-12);
  assert.ok(Math.abs(r1.ksZ - r2.ksZ) < 1e-9);
});

test('dailyTokenKsTwoSampleHalves: ksD invariant under positive scale', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
  const r1 = dailyTokenKsTwoSampleHalves(x);
  const r2 = dailyTokenKsTwoSampleHalves(x.map((v) => v * 7));
  assert.ok(Math.abs(r1.ksD - r2.ksD) < 1e-12);
  assert.ok(Math.abs(r1.ksDSigned - r2.ksDSigned) < 1e-12);
});

test('dailyTokenKsTwoSampleHalves: ksDSigned negates under sign flip', () => {
  // reversing sign reverses the ECDF orientation
  const x = [1, 3, 2, 4, 9, 8, 10, 7];
  const r1 = dailyTokenKsTwoSampleHalves(x);
  const r2 = dailyTokenKsTwoSampleHalves(x.map((v) => -v));
  assert.ok(Math.abs(r1.ksD - r2.ksD) < 1e-12);
  assert.ok(Math.abs(r1.ksDSigned + r2.ksDSigned) < 1e-12);
});

test('dailyTokenKsTwoSampleHalves: swapping halves negates ksDSigned (equal n1 = n2)', () => {
  const a = [1, 2, 3, 4];
  const b = [10, 20, 30, 40];
  const r1 = dailyTokenKsTwoSampleHalves([...a, ...b]);
  const r2 = dailyTokenKsTwoSampleHalves([...b, ...a]);
  assert.ok(Math.abs(r1.ksD - r2.ksD) < 1e-12);
  assert.ok(Math.abs(r1.ksDSigned + r2.ksDSigned) < 1e-12);
});

// ---------- primitive: bounds ----------

test('dailyTokenKsTwoSampleHalves: ksD in [0, 1], ksDSigned in [-1, +1]', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [1, 1, 1, 1, 2, 2, 2, 2],
    [1, 5, 2, 6, 3, 7, 4, 8],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  ];
  for (const x of cases) {
    const r = dailyTokenKsTwoSampleHalves(x);
    assert.ok(r.ksD >= 0 && r.ksD <= 1, `ksD out of bounds: ${r.ksD}`);
    assert.ok(
      r.ksDSigned >= -1 && r.ksDSigned <= 1,
      `ksDSigned out of bounds: ${r.ksDSigned}`,
    );
    assert.ok(r.ksDPlus >= 0 && r.ksDPlus <= 1);
    assert.ok(r.ksDMinus >= 0 && r.ksDMinus <= 1);
    assert.ok(Math.abs(r.ksDSigned) <= r.ksD + 1e-12);
  }
});

test('dailyTokenKsTwoSampleHalves: ksP in (0, 1]', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [1, 1, 1, 1, 5, 5, 5, 5.1],
    [1, 5, 2, 6, 3, 7, 4, 8],
  ];
  for (const x of cases) {
    const r = dailyTokenKsTwoSampleHalves(x);
    assert.ok(r.ksP > 0 && r.ksP <= 1, `ksP out of bounds: ${r.ksP}`);
  }
});

test('dailyTokenKsTwoSampleHalves: ksLambda = sqrt(en) * ksD', () => {
  const r = dailyTokenKsTwoSampleHalves([1, 1, 1, 2, 7, 7, 7, 8]);
  const en = (r.ksN1 * r.ksN2) / (r.ksN1 + r.ksN2);
  const expected = Math.sqrt(en) * r.ksD;
  assert.ok(Math.abs(r.ksLambda - expected) < 1e-12);
});

test('dailyTokenKsTwoSampleHalves: ksDCrit05 = 1.36 * sqrt((n1+n2)/(n1*n2))', () => {
  const r = dailyTokenKsTwoSampleHalves([1, 1, 1, 2, 7, 7, 7, 8]);
  const expected = 1.36 * Math.sqrt((r.ksN1 + r.ksN2) / (r.ksN1 * r.ksN2));
  assert.ok(Math.abs(r.ksDCrit05 - expected) < 1e-12);
});

test('dailyTokenKsTwoSampleHalves: ksZ sign matches ksDSigned sign', () => {
  const r1 = dailyTokenKsTwoSampleHalves([1, 1, 1, 1.5, 5, 5, 5, 5]);
  assert.ok(r1.ksZ > 0 && r1.ksDSigned > 0);
  const r2 = dailyTokenKsTwoSampleHalves([5, 5, 5, 5, 1, 1, 1, 1.5]);
  assert.ok(r2.ksZ < 0 && r2.ksDSigned < 0);
});

// ---------- primitive: well-known case (textbook) ----------

test('dailyTokenKsTwoSampleHalves: small two-sample reference (Massey 1951)', () => {
  // F_A(t) at points where both ECDFs change; both halves
  // size 4. With A = {1,2,3,4} and B = {2,3,4,5} the ECDF
  // gap is at most 1/4 = 0.25.
  const r = dailyTokenKsTwoSampleHalves([1, 2, 3, 4, 2, 3, 4, 5]);
  assert.ok(r.ksD <= 0.25 + 1e-12);
  assert.ok(r.ksD >= 0.2);
});

test('dailyTokenKsTwoSampleHalves: identical halves (modulo perturbation) => small ksD', () => {
  // Halves are nearly identical: ECDF gaps are tiny.
  const r = dailyTokenKsTwoSampleHalves([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 7]);
  assert.ok(r.ksD <= 0.34);
});

// ---------- primitive: consistency between fields ----------

test('dailyTokenKsTwoSampleHalves: ksD = max(ksDPlus, ksDMinus)', () => {
  const cases: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [1, 1, 1, 1, 2, 2, 2, 2.1],
    [1, 5, 2, 6, 3, 7, 4, 8],
  ];
  for (const x of cases) {
    const r = dailyTokenKsTwoSampleHalves(x);
    assert.ok(Math.abs(r.ksD - Math.max(r.ksDPlus, r.ksDMinus)) < 1e-12);
  }
});

test('dailyTokenKsTwoSampleHalves: ksDSigned magnitude = ksD', () => {
  const r = dailyTokenKsTwoSampleHalves([1, 1, 1, 1.1, 5, 5, 5, 5]);
  assert.ok(Math.abs(Math.abs(r.ksDSigned) - r.ksD) < 1e-12);
});

// ---------- builder: smoke ----------

test('buildDailyTokenKsTwoSampleHalves: empty queue', () => {
  const r = buildDailyTokenKsTwoSampleHalves([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKsTwoSampleHalves: filters non-positive and bad hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src-a', 1000),
    ql(dayIso(0), 'src-a', 0),
    ql(dayIso(0), 'src-a', -5),
  ];
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenKsTwoSampleHalves: drops below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 200));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKsTwoSampleHalves: drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-sparse', 5));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenKsTwoSampleHalves: drops zero variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-flat', 200));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('buildDailyTokenKsTwoSampleHalves: source-filter routes non-matching to droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 200 + i));
    queue.push(ql(dayIso(i), 'src-b', 200 + i));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    source: 'src-a',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedSourceFilter, 20);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
});

test('buildDailyTokenKsTwoSampleHalves: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 200 + s * 10 + i));
    }
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    top: 2,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.droppedTopSources, 2);
  assert.equal(r.sources.length, 2);
});

test('buildDailyTokenKsTwoSampleHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenKsTwoSampleHalves([], {
        sort: 'bogus' as unknown as 'ksD',
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenKsTwoSampleHalves: rejects bad min-tenure-days', () => {
  assert.throws(
    () => buildDailyTokenKsTwoSampleHalves([], { minTenureDays: 5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenKsTwoSampleHalves: rejects bad min-tokens', () => {
  assert.throws(
    () => buildDailyTokenKsTwoSampleHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('buildDailyTokenKsTwoSampleHalves: rejects bad top', () => {
  assert.throws(
    () => buildDailyTokenKsTwoSampleHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('buildDailyTokenKsTwoSampleHalves: rejects bad since/until', () => {
  assert.throws(
    () => buildDailyTokenKsTwoSampleHalves([], { since: 'bogus' }),
    /invalid since/,
  );
  assert.throws(
    () => buildDailyTokenKsTwoSampleHalves([], { until: 'bogus' }),
    /invalid until/,
  );
});

test('buildDailyTokenKsTwoSampleHalves: end-to-end with synthetic shift', () => {
  // src-a: clean second-half jump => ksZ should be > 1.96
  // src-b: stable => ksZ near 0
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    const valA = i < 10 ? 100 + i : 500 + i;
    queue.push(ql(dayIso(i), 'src-a', valA));
    queue.push(ql(dayIso(i), 'src-b', 200 + ((i * 13) % 7)));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    sort: 'ksDDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  // src-a should be first by ksDDesc
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.sources[0]!.ksDSigned > 0);
  assert.ok(r.sources[0]!.ksZ > 1.96);
  assert.ok(r.sources[0]!.ksD > r.sources[1]!.ksD);
});

test('buildDailyTokenKsTwoSampleHalves: sort by source asc', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'zebra', 100 + i));
    queue.push(ql(dayIso(i), 'aardvark', 100 + i));
  }
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    sort: 'source',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.source, 'aardvark');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('buildDailyTokenKsTwoSampleHalves: deterministic generatedAt passthrough', () => {
  const stamp = '2026-05-03T12:34:56.000Z';
  const r = buildDailyTokenKsTwoSampleHalves([], { generatedAt: stamp });
  assert.equal(r.generatedAt, stamp);
});

test('buildDailyTokenKsTwoSampleHalves: gap-filled tenure includes zero days', () => {
  const queue: QueueLine[] = [];
  // active days 0, 5, 10, 15 -> tenure 16, 12 zero-fills
  queue.push(ql(dayIso(0), 'src-a', 1000));
  queue.push(ql(dayIso(5), 'src-a', 2000));
  queue.push(ql(dayIso(10), 'src-a', 3000));
  queue.push(ql(dayIso(15), 'src-a', 4000));
  const r = buildDailyTokenKsTwoSampleHalves(queue, {
    minTenureDays: 8,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 16);
  assert.equal(r.sources[0]!.nActiveDays, 4);
  assert.equal(r.sources[0]!.ksN1, 8);
  assert.equal(r.sources[0]!.ksN2, 8);
});
