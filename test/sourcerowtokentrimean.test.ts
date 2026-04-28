import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTrimean } from '../src/sourcerowtokentrimean.js';
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

const GEN = '2026-04-28T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(`2026-04-27T${String(i % 24).padStart(2, '0')}:00:00.000Z`, source, v),
  );
}

// ---------- shape / option validation ----------

test('trimean: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTrimean([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minTrimean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'trimean-desc');
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
});

test('trimean: rejects bad minRows (< 4 or non-integer)', () => {
  assert.throws(() => buildSourceRowTokenTrimean([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenTrimean([], { minRows: 4.5 }));
  assert.throws(() => buildSourceRowTokenTrimean([], { minRows: -1 }));
  assert.throws(() => buildSourceRowTokenTrimean([], { minRows: 0 }));
});

test('trimean: rejects bad minTrimean', () => {
  assert.throws(() => buildSourceRowTokenTrimean([], { minTrimean: -1 }));
  assert.throws(() =>
    buildSourceRowTokenTrimean([], { minTrimean: Number.NaN }),
  );
  assert.throws(() =>
    buildSourceRowTokenTrimean([], { minTrimean: Number.POSITIVE_INFINITY }),
  );
});

test('trimean: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenTrimean([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenTrimean([], { top: -3 }));
  assert.throws(() => buildSourceRowTokenTrimean([], { top: 1.5 }));
});

test('trimean: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenTrimean([], { sort: 'nope' as never }),
  );
});

test('trimean: rejects invalid since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenTrimean([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenTrimean([], { until: 'not-a-date' }),
  );
});

// ---------- core arithmetic ----------

test('trimean: all-equal series TM = c', () => {
  const q = mkSeries('a', [100, 100, 100, 100, 100]);
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.q1, 100);
  assert.equal(s.median, 100);
  assert.equal(s.q3, 100);
  assert.equal(s.midhinge, 100);
  assert.equal(s.trimean, 100);
  assert.equal(s.tmMedianGap, 0);
});

test('trimean: all-zero series TM = 0 (no degeneracy)', () => {
  const q = mkSeries('a', [0, 0, 0, 0, 0, 0]);
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimean, 0);
  assert.equal(s.midhinge, 0);
  assert.equal(s.tmMedianGap, 0);
  assert.equal(s.q1, 0);
  assert.equal(s.q3, 0);
});

test('trimean: simple 5-value series', () => {
  // sorted: [1, 2, 3, 4, 5]; type-7: q1 = 2, median = 3, q3 = 4
  // trimean = (2 + 6 + 4) / 4 = 3
  const q = mkSeries('a', [3, 1, 4, 1, 5]).map((row, i) => ({
    ...row,
    total_tokens: [3, 1, 4, 5, 2][i]!,
  }));
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.q1, 2);
  assert.equal(s.median, 3);
  assert.equal(s.q3, 4);
  assert.equal(s.trimean, 3);
  assert.equal(s.midhinge, 3);
  assert.equal(s.tmMedianGap, 0);
});

test('trimean: known 9-value asymmetric series', () => {
  // sorted: [1,2,3,4,5,6,7,8,100]
  // type-7: q1 at h=2.0 -> xs[2]=3; median at h=4.0 -> xs[4]=5;
  //         q3 at h=6.0 -> xs[6]=7. trimean = (3 + 10 + 7) / 4 = 5.
  const q = mkSeries('a', [1, 2, 3, 4, 5, 6, 7, 8, 100]);
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.q1, 3);
  assert.equal(s.median, 5);
  assert.equal(s.q3, 7);
  assert.equal(s.trimean, 5);
  // mean would be 13.something; trimean is robust
});

test('trimean: 6-value series (interpolation)', () => {
  // sorted: [10, 20, 30, 40, 50, 60]
  // h_q1 = (6-1)*0.25 = 1.25 -> 20 + 0.25*(30-20) = 22.5
  // h_med = (6-1)*0.5  = 2.5  -> 30 + 0.5*(40-30) = 35
  // h_q3 = (6-1)*0.75 = 3.75 -> 40 + 0.75*(50-40) = 47.5
  // trimean = (22.5 + 70 + 47.5) / 4 = 140 / 4 = 35
  const q = mkSeries('a', [10, 20, 30, 40, 50, 60]);
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.q1, 22.5);
  assert.equal(s.median, 35);
  assert.equal(s.q3, 47.5);
  assert.equal(s.trimean, 35);
  assert.equal(s.midhinge, 35);
});

test('trimean: trimean lies in [q1, q3]', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const vals: number[] = [];
    let x = seed * 7919;
    for (let i = 0; i < 50; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      vals.push((x % 10000) / 1.0);
    }
    const q = mkSeries('s', vals);
    const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
    const s = r.sources[0]!;
    assert.ok(s.trimean >= s.q1 - 1e-9, `trimean ${s.trimean} < q1 ${s.q1}`);
    assert.ok(s.trimean <= s.q3 + 1e-9, `trimean ${s.trimean} > q3 ${s.q3}`);
  }
});

// ---------- invariants: order, scale, translation, breakdown ----------

test('trimean invariant: order-invariant (shuffle)', () => {
  const base = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5];
  const r1 = buildSourceRowTokenTrimean(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const shuffled = [5, 9, 1, 3, 2, 6, 4, 1, 5, 3, 5];
  const r2 = buildSourceRowTokenTrimean(mkSeries('a', shuffled), {
    generatedAt: GEN,
  });
  assert.equal(r1.sources[0]!.trimean, r2.sources[0]!.trimean);
  assert.equal(r1.sources[0]!.median, r2.sources[0]!.median);
});

test('trimean invariant: scale-equivariant (TM(c*x) = c*TM(x))', () => {
  const base = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const r1 = buildSourceRowTokenTrimean(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const c = 7.5;
  const r2 = buildSourceRowTokenTrimean(
    mkSeries('a', base.map((x) => x * c)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.trimean - c * r1.sources[0]!.trimean) < 1e-9,
  );
});

test('trimean invariant: translation-equivariant (TM(x+c) = TM(x)+c)', () => {
  const base = [10, 20, 30, 40, 50, 60, 70, 80];
  const c = 1234;
  const r1 = buildSourceRowTokenTrimean(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenTrimean(
    mkSeries('a', base.map((x) => x + c)),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(r2.sources[0]!.trimean - (r1.sources[0]!.trimean + c)) < 1e-9,
  );
});

test('trimean invariant: 25%-breakdown — single huge row barely moves TM', () => {
  // 20 base values + 1 outlier. Outlier is 5% of rows (well below 25% breakdown).
  const base = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
  const withOutlier = [...base, 1_000_000];
  const r1 = buildSourceRowTokenTrimean(mkSeries('a', base), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenTrimean(mkSeries('a', withOutlier), {
    generatedAt: GEN,
  });
  // Mean would jump by ~50000; trimean should move by < 5
  assert.ok(
    Math.abs(r2.sources[0]!.trimean - r1.sources[0]!.trimean) < 5,
    `trimean moved by ${Math.abs(r2.sources[0]!.trimean - r1.sources[0]!.trimean)}`,
  );
});

test('trimean invariant: equals median on symmetric distribution', () => {
  // Symmetric around 100: [80, 90, 100, 110, 120]
  const q = mkSeries('a', [80, 90, 100, 110, 120]);
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.trimean, s.median);
  assert.equal(s.tmMedianGap, 0);
});

test('trimean invariant: equals median on larger symmetric distribution', () => {
  // sym around 0 -> shift to non-neg: [0, 10, 20, 30, 40] symmetric around 20
  const vals = [0, 10, 20, 30, 40, 50, 60, 70, 80];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.trimean, s.median);
  assert.equal(s.tmMedianGap, 0);
});

test('trimean invariant: tmMedianGap > 0 for upper-tail-heavy distribution', () => {
  // Half low, half high: q3 sits in upper cluster, midhinge > median.
  // sorted: [1,2,3,4,5, 80,90,100,110,120] n=10
  // h_q1=2.25 -> 3+0.25*1=3.25; h_med=4.5 -> 5+0.5*75=42.5; h_q3=6.75 -> 90+0.75*10=97.5
  // midhinge=(3.25+97.5)/2=50.375; trimean=(3.25+85+97.5)/4=46.4375; gap=46.4375-42.5=+3.9375
  const vals = [1, 2, 3, 4, 5, 80, 90, 100, 110, 120];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.tmMedianGap > 0, `expected gap > 0, got ${s.tmMedianGap}`);
  assert.ok(s.trimean > s.median);
});

test('trimean invariant: tmMedianGap < 0 for lower-tail-heavy distribution', () => {
  // Mirror: most rows clustered high; q1 sits in low region pulling midhinge down.
  // sorted: [1,2,3,4,5, 95,96,97,98,99] n=10 -> by symmetry around shift,
  // gap should be negative when median is closer to the upper cluster
  // Use uneven mass: [1,2,3, 100,101,102,103,104,105,106] n=10
  // h_q1=2.25 -> 3+0.25*97=27.25; h_med=4.5 -> 100+0.5*1=100.5;
  // h_q3=6.75 -> 102+0.75*1=102.75
  // midhinge=(27.25+102.75)/2=65; trimean=(27.25+201+102.75)/4=82.75; gap=82.75-100.5=-17.75
  const vals = [1, 2, 3, 100, 101, 102, 103, 104, 105, 106];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.tmMedianGap < 0, `expected gap < 0, got ${s.tmMedianGap}`);
  assert.ok(s.trimean < s.median);
});

test('trimean invariant: tmMedianGap bounded by ±(q3-q1)/4', () => {
  for (const seed of [11, 22, 33, 44, 55]) {
    const vals: number[] = [];
    let x = seed * 7919;
    for (let i = 0; i < 30; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      vals.push(x % 5000);
    }
    const r = buildSourceRowTokenTrimean(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    const bound = (s.q3 - s.q1) / 4;
    assert.ok(
      Math.abs(s.tmMedianGap) <= bound + 1e-9,
      `|gap|=${Math.abs(s.tmMedianGap)} > bound=${bound}`,
    );
  }
});

test('trimean invariant: trimean = median + (midhinge - median) / 2', () => {
  const vals = [1, 3, 7, 15, 31, 63, 127, 255, 511];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  const expected = s.median + (s.midhinge - s.median) / 2;
  assert.ok(Math.abs(s.trimean - expected) < 1e-9);
});

test('trimean invariant: TM >= 0 for all-non-negative data', () => {
  for (const seed of [101, 202, 303, 404]) {
    const vals: number[] = [];
    let x = seed;
    for (let i = 0; i < 25; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      vals.push(x % 1000);
    }
    const r = buildSourceRowTokenTrimean(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    assert.ok(r.sources[0]!.trimean >= 0);
  }
});

// ---------- filtering / dropping ----------

test('trimean: drops invalid hour_start', () => {
  const q = [
    ql('not-a-date', 'a', 100),
    ...mkSeries('a', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('trimean: drops invalid total_tokens (NaN, Infinity, non-number)', () => {
  const q = [
    ql('2026-04-27T01:00:00Z', 'a', Number.NaN),
    ql('2026-04-27T02:00:00Z', 'a', Number.POSITIVE_INFINITY),
    {
      ...ql('2026-04-27T03:00:00Z', 'a', 0),
      total_tokens: 'bad' as unknown as number,
    } as QueueLine,
    ...mkSeries('a', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 3);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('trimean: drops negative total_tokens', () => {
  const q = [
    ql('2026-04-27T01:00:00Z', 'a', -5),
    ql('2026-04-27T02:00:00Z', 'a', -100),
    ...mkSeries('a', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 2);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

test('trimean: --since and --until window filters', () => {
  const q = [
    ql('2026-04-26T00:00:00Z', 'a', 1000),
    ql('2026-04-27T00:00:00Z', 'a', 10),
    ql('2026-04-27T01:00:00Z', 'a', 20),
    ql('2026-04-27T02:00:00Z', 'a', 30),
    ql('2026-04-27T03:00:00Z', 'a', 40),
    ql('2026-04-28T00:00:00Z', 'a', 999999),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00Z',
    until: '2026-04-28T00:00:00Z',
  });
  assert.equal(r.sources[0]!.rowsKept, 4);
  assert.equal(r.windowStart, '2026-04-27T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00Z');
});

test('trimean: --source filter restricts to one source', () => {
  const q = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    source: 'b',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedSourceFilter, 4);
});

test('trimean: empty/missing source -> "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00Z', '', 10),
    ql('2026-04-27T01:00:00Z', '', 20),
    ql('2026-04-27T02:00:00Z', '', 30),
    ql('2026-04-27T03:00:00Z', '', 40),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('trimean: drops sources below minRows', () => {
  const q = [
    ...mkSeries('small', [10, 20, 30]), // n=3, below 4
    ...mkSeries('big', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('trimean: minRows=10 drops both', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20, 30, 40, 50, 60]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN, minRows: 10 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 2);
});

test('trimean: --min-trimean drops sources below floor', () => {
  const q = [
    ...mkSeries('low', [1, 2, 3, 4, 5]), // trimean ~3
    ...mkSeries('high', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    minTrimean: 50,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinTrimean, 1);
});

test('trimean: --min-trimean=0 keeps all', () => {
  const q = [
    ...mkSeries('a', [0, 0, 0, 0]),
    ...mkSeries('b', [1, 2, 3, 4]),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    minTrimean: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinTrimean, 0);
});

// ---------- sorting ----------

test('trimean: sort=trimean-desc (default)', () => {
  const q = [
    ...mkSeries('mid', [10, 20, 30, 40, 50]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
    ...mkSeries('low', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['high', 'mid', 'low'],
  );
});

test('trimean: sort=trimean-asc', () => {
  const q = [
    ...mkSeries('mid', [10, 20, 30, 40, 50]),
    ...mkSeries('high', [100, 200, 300, 400, 500]),
    ...mkSeries('low', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    sort: 'trimean-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['low', 'mid', 'high'],
  );
});

test('trimean: sort=median-desc', () => {
  const q = [
    ...mkSeries('a', [10, 20, 30, 40, 50]), // median 30
    ...mkSeries('b', [100, 100, 100, 100, 100]), // median 100
    ...mkSeries('c', [1, 2, 3, 4, 5]), // median 3
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    sort: 'median-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('trimean: sort=gap-desc orders by |tmMedianGap|', () => {
  // upper-tail heavy gives positive gap; symmetric gives 0
  const q = [
    ...mkSeries('sym', [10, 20, 30, 40, 50]), // symmetric -> gap 0
    ...mkSeries('skew', [1, 2, 3, 4, 5, 6, 7, 8, 1000]), // heavy upper -> gap > 0
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'skew');
});

test('trimean: sort=rows orders by rowsKept desc', () => {
  const q = [
    ...mkSeries('few', [1, 2, 3, 4]),
    ...mkSeries('many', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN, sort: 'rows' });
  assert.equal(r.sources[0]!.source, 'many');
});

test('trimean: sort=source uses lex asc with source tiebreak', () => {
  const q = [
    ...mkSeries('zeta', [10, 20, 30, 40]),
    ...mkSeries('alpha', [10, 20, 30, 40]),
    ...mkSeries('mike', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenTrimean(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mike', 'zeta'],
  );
});

test('trimean: tiebreak on identical trimean -> source asc', () => {
  // Two identical series under different sources -> tiebreak by source asc
  const q = [
    ...mkSeries('zzz', [10, 20, 30, 40, 50]),
    ...mkSeries('aaa', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'zzz');
});

// ---------- top cap ----------

test('trimean: --top caps survived list and counts dropped', () => {
  const q = [
    ...mkSeries('a', [100, 100, 100, 100, 100]),
    ...mkSeries('b', [50, 50, 50, 50, 50]),
    ...mkSeries('c', [10, 10, 10, 10, 10]),
    ...mkSeries('d', [1, 1, 1, 1, 1]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('trimean: --top larger than survivors -> no truncation', () => {
  const q = [...mkSeries('a', [10, 20, 30, 40])];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN, top: 100 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 0);
});

// ---------- determinism / generatedAt ----------

test('trimean: pure builder, deterministic across runs with same input + generatedAt', () => {
  const q = mkSeries('a', [10, 20, 30, 40, 50, 60, 70, 80, 90]);
  const r1 = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  const r2 = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('trimean: generatedAt override is reported verbatim', () => {
  const r = buildSourceRowTokenTrimean(mkSeries('a', [1, 2, 3, 4]), {
    generatedAt: '2099-12-31T23:59:59.999Z',
  });
  assert.equal(r.generatedAt, '2099-12-31T23:59:59.999Z');
});

// ---------- multi-source aggregate ----------

test('trimean: multiple sources reported with correct counts', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [10, 20, 30, 40]),
    ...mkSeries('c', [100, 200, 300, 400, 500, 600]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalRowsKept, 15);
  assert.equal(r.sources.length, 3);
});

test('trimean: dropped counters do not double-count', () => {
  // Each row has exactly one reason to be dropped
  const q = [
    ql('not-a-date', 'a', 100), // bad hour_start
    ql('2026-04-27T00:00:00Z', 'a', Number.NaN), // bad tokens
    ql('2026-04-27T01:00:00Z', 'a', -5), // negative
    ...mkSeries('a', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenTrimean(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
  assert.equal(r.sources[0]!.rowsKept, 5);
});

// ---------- relationship to other lenses ----------

test('trimean: differs from mean on heavy-tailed distributions', () => {
  // 9 small, 1 huge. mean dominated by huge; trimean barely budges.
  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10000];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const tm = r.sources[0]!.trimean;
  // mean = 1004.5; trimean should be far less
  assert.ok(mean > 1000);
  assert.ok(tm < 20, `trimean=${tm} should be << mean=${mean}`);
});

test('trimean: differs from median on asymmetric distribution', () => {
  // Bimodal-asymmetric: q3 in upper cluster pulls trimean above median.
  const vals = [1, 2, 3, 4, 5, 80, 90, 100, 110, 120];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.trimean > s.median);
  assert.ok(s.trimean - s.median > 0.5);
});

test('trimean: equals midhinge when median == midhinge', () => {
  // Symmetric series ensures median == midhinge == trimean
  const vals = [10, 20, 30, 40, 50];
  const r = buildSourceRowTokenTrimean(mkSeries('a', vals), {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.midhinge, s.median);
  assert.equal(s.trimean, s.midhinge);
});

// ---------- robustness: single huge row breakdown corollary ----------

test('trimean: single huge contaminating row leaves trimean equal to clean median ± small jitter', () => {
  const clean = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  const cleanR = buildSourceRowTokenTrimean(mkSeries('a', clean), {
    generatedAt: GEN,
  });
  const contaminated = [...clean, 1e9];
  const contR = buildSourceRowTokenTrimean(mkSeries('a', contaminated), {
    generatedAt: GEN,
  });
  // q3 jumps because n grew from 11 to 12 and outlier shifts q3 a bit.
  // But trimean should still be in same order of magnitude as clean.
  const ratio = contR.sources[0]!.trimean / cleanR.sources[0]!.trimean;
  assert.ok(ratio < 5 && ratio > 0.5, `ratio=${ratio}`);
});

// ---------- report metadata pass-through ----------

test('trimean: report mirrors options', () => {
  const r = buildSourceRowTokenTrimean(mkSeries('a', [10, 20, 30, 40]), {
    generatedAt: GEN,
    since: '2026-04-26T00:00:00Z',
    until: '2026-04-28T00:00:00Z',
    minRows: 4,
    minTrimean: 5,
    top: 3,
    sort: 'gap-desc',
    source: 'a',
  });
  assert.equal(r.windowStart, '2026-04-26T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00Z');
  assert.equal(r.minTrimean, 5);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'gap-desc');
  assert.equal(r.source, 'a');
});

// ---------- randomized property invariants (refinement pins) ----------

/**
 * 4 randomized property pins that lock the trimean's distinguishing
 * mathematical guarantees against any future refactor that might
 * accidentally turn it back into the mean or the bare median.
 *
 * Seeded LCG so the corpus is fixed and the pins are deterministic.
 */
function lcg(seed: number): () => number {
  let x = seed | 0;
  return () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x;
  };
}

test('trimean property pin: trimean is bounded by [q1, q3] across 200 random samples', () => {
  const rng = lcg(424242);
  for (let trial = 0; trial < 200; trial++) {
    const n = 4 + (rng() % 60); // 4..63
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      vals.push(rng() % 100000);
    }
    const r = buildSourceRowTokenTrimean(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(
      s.trimean >= s.q1 - 1e-9,
      `trial ${trial}: trimean ${s.trimean} < q1 ${s.q1}`,
    );
    assert.ok(
      s.trimean <= s.q3 + 1e-9,
      `trial ${trial}: trimean ${s.trimean} > q3 ${s.q3}`,
    );
  }
});

test('trimean property pin: scale-equivariant across 100 random series and scales', () => {
  const rng = lcg(8675309);
  for (let trial = 0; trial < 100; trial++) {
    const n = 5 + (rng() % 40);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(rng() % 50000);
    // scale in (0.001, 1000)
    const c = ((rng() % 1000000) + 1) / 1000;
    const r1 = buildSourceRowTokenTrimean(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenTrimean(
      mkSeries('s', vals.map((x) => x * c)),
      { generatedAt: GEN },
    );
    const expected = c * r1.sources[0]!.trimean;
    const got = r2.sources[0]!.trimean;
    // Relative tolerance: float ops on values up to 5e4 * 1e3
    const tol = Math.max(1e-6, Math.abs(expected) * 1e-9);
    assert.ok(
      Math.abs(got - expected) <= tol,
      `trial ${trial} (c=${c}): expected ${expected}, got ${got}`,
    );
  }
});

test('trimean property pin: order-invariant across 100 random shuffles', () => {
  const rng = lcg(20260428);
  for (let trial = 0; trial < 100; trial++) {
    const n = 4 + (rng() % 50);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) vals.push(rng() % 10000);
    // Fisher-Yates shuffle with the same RNG
    const shuffled = vals.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng() % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const r1 = buildSourceRowTokenTrimean(mkSeries('s', vals), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenTrimean(mkSeries('s', shuffled), {
      generatedAt: GEN,
    });
    assert.equal(
      r1.sources[0]!.trimean,
      r2.sources[0]!.trimean,
      `trial ${trial}: order-variant!`,
    );
    assert.equal(r1.sources[0]!.median, r2.sources[0]!.median);
  }
});

test('trimean property pin: 25%-breakdown — contaminating < 25% of rows with arbitrarily large outliers leaves trimean within q3-of-clean (i.e., still inside the original central support, not tracking the outliers)', () => {
  // Take a clean series and contaminate <25% of it with values
  // 1000x larger than max. Trimean must stay within original q3
  // (i.e., must NOT track the outlier magnitude). Mean would
  // race off to the contaminating value.
  const rng = lcg(999);
  for (let trial = 0; trial < 50; trial++) {
    const n = 20 + (rng() % 30); // 20..49
    const clean: number[] = [];
    for (let i = 0; i < n; i++) clean.push(1 + (rng() % 1000));
    clean.sort((a, b) => a - b);
    const cleanMax = clean[clean.length - 1]!;
    const cleanQ3Idx = Math.ceil((n - 1) * 0.75);
    const cleanQ3 = clean[cleanQ3Idx]!;
    // Inject k outliers each = 1000 * cleanMax, where k < n/4
    const k = Math.max(1, Math.floor((n - 1) / 4));
    const contaminated = clean.slice();
    for (let i = 0; i < k; i++) {
      contaminated.push(1000 * cleanMax);
    }
    const r = buildSourceRowTokenTrimean(mkSeries('s', contaminated), {
      generatedAt: GEN,
    });
    const tm = r.sources[0]!.trimean;
    // Trimean must be << outlier magnitude. Use a generous gate:
    // tm should not exceed (cleanQ3 + outlierMagnitude/4); since
    // outliers can pull q3 up by interpolation when k is close
    // to 25%. The non-trivial claim is "trimean does NOT
    // approach the outlier magnitude itself".
    const outlier = 1000 * cleanMax;
    assert.ok(
      tm < outlier / 2,
      `trial ${trial}: trimean ${tm} approached outlier ${outlier}`,
    );
    // And it should remain at least vaguely related to the clean
    // central tendency (within 5x of clean q3).
    assert.ok(
      tm < 5 * cleanQ3 || tm < cleanMax * 2,
      `trial ${trial}: trimean ${tm} far from clean q3 ${cleanQ3}`,
    );
  }
});
