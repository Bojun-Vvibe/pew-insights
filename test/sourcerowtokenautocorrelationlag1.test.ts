import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenAutocorrelationLag1 } from '../src/sourcerowtokenautocorrelationlag1.js';
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

test('row-acf1: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenAutocorrelationLag1([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 3);
  assert.equal(r.minAbsRho, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'rho-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-acf1: rejects bad minRows / minAbsRho / top / sort', () => {
  assert.throws(() => buildSourceRowTokenAutocorrelationLag1([], { minRows: 2 }));
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { minRows: 3.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { minAbsRho: -0.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { minAbsRho: 1.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { minAbsRho: Number.NaN }),
  );
  assert.throws(() => buildSourceRowTokenAutocorrelationLag1([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenAutocorrelationLag1([], { top: 1.5 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceRowTokenAutocorrelationLag1([], { sort: 'bogus' as any }),
  );
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildSourceRowTokenAutocorrelationLag1([], { until: 'nope' }),
  );
});

test('row-acf1: bad hour_start increments dropped counter', () => {
  const q = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 3);
});

test('row-acf1: bad total_tokens increments dropped counter', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', Number.NaN),
    ql('2026-04-27T01:00:00.000Z', 'a', 100),
    ql('2026-04-27T02:00:00.000Z', 'a', 200),
    ql('2026-04-27T03:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.totalRowsKept, 3);
});

test('row-acf1: constant series -> rho1=0, flat=true', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 50),
    ql('2026-04-27T01:00:00.000Z', 'a', 50),
    ql('2026-04-27T02:00:00.000Z', 'a', 50),
    ql('2026-04-27T03:00:00.000Z', 'a', 50),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.rowsKept, 4);
  assert.equal(row.pairs, 3);
  assert.equal(row.flat, true);
  assert.equal(row.rho1, 0);
  assert.equal(row.variance, 0);
});

test('row-acf1: perfect persistent series rho1 close to 1', () => {
  // Strictly monotone rising series — high positive lag-1 correlation.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'a', 500),
    ql('2026-04-27T05:00:00.000Z', 'a', 600),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.flat, false);
  // Hand-computed: for x = [100..600] step 100, mu=350,
  // x-mu = [-250,-150,-50,50,150,250], denom = sum sq = 175000.
  // numer = (-250*-150)+(-150*-50)+(-50*50)+(50*150)+(150*250)
  //       = 37500+7500-2500+7500+37500 = 87500.
  // rho1 = 87500/175000 = 0.5
  assert.ok(Math.abs(row.rho1 - 0.5) < 1e-12, `expected ~0.5 got ${row.rho1}`);
});

test('row-acf1: perfect anti-persistent (alternating) -> rho1 close to -1', () => {
  // Alternating low/high — should give strongly negative lag-1.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 1000),
    ql('2026-04-27T02:00:00.000Z', 'a', 100),
    ql('2026-04-27T03:00:00.000Z', 'a', 1000),
    ql('2026-04-27T04:00:00.000Z', 'a', 100),
    ql('2026-04-27T05:00:00.000Z', 'a', 1000),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.flat, false);
  // x = [100,1000,100,1000,100,1000], mu=550, x-mu = [-450,450,-450,450,-450,450]
  // denom = 6*450^2 = 1215000.
  // numer = sum_{i=0..4} (x[i]-mu)*(x[i+1]-mu)
  //       = 5 pairs each = -450*450 = -202500. Sum = -1012500.
  // rho1 = -1012500 / 1215000 = -0.8333...
  assert.ok(
    Math.abs(row.rho1 - -5 / 6) < 1e-12,
    `expected ~-0.8333 got ${row.rho1}`,
  );
});

test('row-acf1: minRows=3 drops too-small sources, counted', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'b', 1),
    ql('2026-04-27T03:00:00.000Z', 'b', 2),
    ql('2026-04-27T04:00:00.000Z', 'b', 3),
    ql('2026-04-27T05:00:00.000Z', 'b', 4),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedBelowMinRows, 1); // 'a' has only 2 rows
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('row-acf1: window since/until filters by hour_start', () => {
  const q = [
    ql('2026-04-26T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T00:00:00.000Z', 'a', 2),
    ql('2026-04-27T01:00:00.000Z', 'a', 3),
    ql('2026-04-27T02:00:00.000Z', 'a', 4),
    ql('2026-04-28T00:00:00.000Z', 'a', 5),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, {
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.sources[0]!.rowsKept, 3);
});

test('row-acf1: source filter restricts to one source', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 1),
    ql('2026-04-27T01:00:00.000Z', 'a', 2),
    ql('2026-04-27T02:00:00.000Z', 'a', 3),
    ql('2026-04-27T03:00:00.000Z', 'b', 1),
    ql('2026-04-27T04:00:00.000Z', 'b', 2),
    ql('2026-04-27T05:00:00.000Z', 'b', 3),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 3);
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-acf1: minAbsRho filter drops near-zero and flat sources', () => {
  // Source a: persistent, rho1 = 0.5 (from monotone test above).
  // Source b: constant -> flat=true, rho1=0.
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 100),
    ql('2026-04-27T01:00:00.000Z', 'a', 200),
    ql('2026-04-27T02:00:00.000Z', 'a', 300),
    ql('2026-04-27T03:00:00.000Z', 'a', 400),
    ql('2026-04-27T04:00:00.000Z', 'a', 500),
    ql('2026-04-27T05:00:00.000Z', 'a', 600),
    ql('2026-04-27T06:00:00.000Z', 'b', 50),
    ql('2026-04-27T07:00:00.000Z', 'b', 50),
    ql('2026-04-27T08:00:00.000Z', 'b', 50),
    ql('2026-04-27T09:00:00.000Z', 'b', 50),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, {
    minAbsRho: 0.4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinAbsRho, 1); // 'b' (rho=0)
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-acf1: rho clamped to [-1, 1] (numerical safety)', () => {
  // Two-row series — pathological 2-pt rho1 = -0.5; verify two
  // distinct values give that, no NaN, no out-of-range.
  // (Skips minRows by construction; here we use minRows=3 so
  // exercise it via 3 rows of two-point alternation between
  // identical pairs.)
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 7),
    ql('2026-04-27T01:00:00.000Z', 'a', 7),
    ql('2026-04-27T02:00:00.000Z', 'a', 7.0000001),
  ];
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.rho1 >= -1 && row.rho1 <= 1, `rho1 in range got ${row.rho1}`);
  assert.equal(row.flat, false);
});

test('row-acf1: sort key abs-rho-desc orders by |rho1|', () => {
  // a: monotone -> rho ~ +0.5
  // b: alternating -> rho ~ -0.833
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) {
    q.push(ql(`2026-04-27T0${i}:00:00.000Z`, 'a', 100 * (i + 1)));
  }
  for (let i = 0; i < 6; i += 1) {
    q.push(ql(`2026-04-27T0${i}:00:00.000Z`, 'b', i % 2 === 0 ? 100 : 1000));
  }
  const r = buildSourceRowTokenAutocorrelationLag1(q, {
    sort: 'abs-rho-desc',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'b'); // |~-0.833| > |~0.5|
  assert.equal(r.sources[1]!.source, 'a');
});

test('row-acf1: top cap surfaces droppedBelowTopCap', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 4; i += 1) {
      q.push(ql(`2026-04-27T0${i}:00:00.000Z`, s, 10 * (i + 1)));
    }
  }
  const r = buildSourceRowTokenAutocorrelationLag1(q, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('row-acf1: sort tie-break is source asc (deterministic)', () => {
  // Build two sources with identical monotone series -> identical rho1.
  const q: QueueLine[] = [];
  for (const s of ['z', 'a']) {
    for (let i = 0; i < 5; i += 1) {
      q.push(ql(`2026-04-27T0${i}:00:00.000Z`, s, 10 * (i + 1)));
    }
  }
  const r = buildSourceRowTokenAutocorrelationLag1(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});
