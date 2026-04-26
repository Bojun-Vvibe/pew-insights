import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceBurstinessFanoFactor,
  utcDayKey,
} from '../src/sourceburstinessfanofactor.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('utcDayKey: returns YYYY-MM-DD in UTC', () => {
  assert.equal(utcDayKey(Date.parse('2026-04-20T23:30:00.000Z')), '2026-04-20');
  assert.equal(utcDayKey(Date.parse('2026-04-20T00:00:00.000Z')), '2026-04-20');
});

test('builder: empty queue -> zero sources, zero totals', () => {
  const r = buildSourceBurstinessFanoFactor([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'fano');
  assert.equal(r.minActiveDays, 3);
});

test('builder: source with < minActiveDays drops as droppedBelowMinActiveDays', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'small', 100),
    ql('2026-04-21T10:00:00.000Z', 'small', 200),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedBelowMinActiveDays, 1);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: flat constant series -> variance=0, fano=0, cv=0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 200),
    ql('2026-04-21T05:00:00.000Z', 's', 200),
    ql('2026-04-22T05:00:00.000Z', 's', 200),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.meanDailyTokens, 200);
  assert.equal(row.varianceDailyTokens, 0);
  assert.equal(row.stddevDailyTokens, 0);
  assert.equal(row.fanoFactor, 0);
  assert.equal(row.cv, 0);
});

test('builder: known variance -> exact fano = variance / mean', () => {
  // y = 100, 200, 300 -> mean=200, var = ((100-200)^2 + 0 + (300-200)^2)/3 = 20000/3
  // fano = (20000/3) / 200 = 100/3
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 100),
    ql('2026-04-21T05:00:00.000Z', 's', 200),
    ql('2026-04-22T05:00:00.000Z', 's', 300),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.totalTokens, 600);
  assert.equal(row.meanDailyTokens, 200);
  assert.ok(Math.abs(row.varianceDailyTokens - 20000 / 3) < 1e-9);
  assert.ok(Math.abs(row.stddevDailyTokens - Math.sqrt(20000 / 3)) < 1e-9);
  assert.ok(row.fanoFactor !== null && Math.abs(row.fanoFactor - 100 / 3) < 1e-9);
  assert.ok(row.cv !== null && Math.abs(row.cv - Math.sqrt(20000 / 3) / 200) < 1e-9);
});

test('builder: same UTC day rows aggregate before stat (n=3 from 6 rows)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 's', 50),
    ql('2026-04-20T18:00:00.000Z', 's', 50), // -> day1=100
    ql('2026-04-21T05:00:00.000Z', 's', 100),
    ql('2026-04-21T18:00:00.000Z', 's', 100), // -> day2=200
    ql('2026-04-22T05:00:00.000Z', 's', 150),
    ql('2026-04-22T18:00:00.000Z', 's', 150), // -> day3=300
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.meanDailyTokens, 200);
  assert.equal(row.totalTokens, 600);
});

test('builder: bursty source ranks above steady source under sort=fano', () => {
  const q: QueueLine[] = [
    // steady: 100,100,100,100 -> var=0, fano=0
    ql('2026-04-20T05:00:00.000Z', 'steady', 100),
    ql('2026-04-21T05:00:00.000Z', 'steady', 100),
    ql('2026-04-22T05:00:00.000Z', 'steady', 100),
    ql('2026-04-23T05:00:00.000Z', 'steady', 100),
    // bursty: 10, 10, 10, 1000 -> mean=257.5, var > mean
    ql('2026-04-20T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-21T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-22T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-23T05:00:00.000Z', 'bursty', 1000),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
    sort: 'fano',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'bursty');
  assert.equal(r.sources[1]!.source, 'steady');
  assert.ok(r.sources[0]!.fanoFactor! > r.sources[1]!.fanoFactor!);
});

test('builder: drops non-positive total_tokens and bad hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-20T05:00:00.000Z', 's', 0),
    ql('2026-04-20T05:00:00.000Z', 's', -5),
    ql('2026-04-20T05:00:00.000Z', 's', 100),
    ql('2026-04-21T05:00:00.000Z', 's', 100),
    ql('2026-04-22T05:00:00.000Z', 's', 100),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.fanoFactor, 0);
});

test('builder: window filter (since/until exclusive upper)', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T05:00:00.000Z', 's', 999),
    ql('2026-04-20T05:00:00.000Z', 's', 100),
    ql('2026-04-21T05:00:00.000Z', 's', 100),
    ql('2026-04-22T05:00:00.000Z', 's', 100),
    ql('2026-04-23T05:00:00.000Z', 's', 999),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-23T00:00:00.000Z',
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 300);
  assert.equal(r.sources[0]!.fanoFactor, 0);
});

test('builder: source filter restricts to one source, others count droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'a', 100),
    ql('2026-04-20T05:00:00.000Z', 'b', 999),
    ql('2026-04-21T05:00:00.000Z', 'a', 100),
    ql('2026-04-22T05:00:00.000Z', 'a', 100),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    source: 'a',
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 1);
});

test('builder: top cap drops remainder as droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let d = 0; d < 3; d++) {
      q.push(
        ql(`2026-04-2${d}T05:00:00.000Z`, s, 100 + (s.charCodeAt(0) - 97) * 10),
      );
    }
  }
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: sort=source is alphabetical; sort=mean orders by meanDailyTokens desc', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'beta', 100),
    ql('2026-04-21T05:00:00.000Z', 'beta', 100),
    ql('2026-04-22T05:00:00.000Z', 'beta', 100),
    ql('2026-04-20T05:00:00.000Z', 'alpha', 1000),
    ql('2026-04-21T05:00:00.000Z', 'alpha', 1000),
    ql('2026-04-22T05:00:00.000Z', 'alpha', 1000),
  ];
  const rSrc = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(rSrc.sources.map((s) => s.source), ['alpha', 'beta']);

  const rMean = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    sort: 'mean',
    generatedAt: GEN,
  });
  assert.deepEqual(rMean.sources.map((s) => s.source), ['alpha', 'beta']);
  assert.equal(rMean.sources[0]!.meanDailyTokens, 1000);
});

test('builder: invalid options throw', () => {
  assert.throws(
    () => buildSourceBurstinessFanoFactor([], { minActiveDays: 1 }),
    /minActiveDays/,
  );
  assert.throws(
    () => buildSourceBurstinessFanoFactor([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () =>
      buildSourceBurstinessFanoFactor([], {
        sort: 'nope' as unknown as 'fano',
      }),
    /sort/,
  );
  assert.throws(
    () => buildSourceBurstinessFanoFactor([], { since: 'not-a-date' }),
    /since/,
  );
});

test('builder (v0.6.54): minFano filter keeps only fano >= n; rest count droppedBelowMinFano', () => {
  const q: QueueLine[] = [
    // steady: var=0, fano=0
    ql('2026-04-20T05:00:00.000Z', 'steady', 100),
    ql('2026-04-21T05:00:00.000Z', 'steady', 100),
    ql('2026-04-22T05:00:00.000Z', 'steady', 100),
    // bursty: 10,10,10,1000 -> mean=257.5, var=164306.25, fano ~ 638
    ql('2026-04-20T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-21T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-22T05:00:00.000Z', 'bursty', 10),
    ql('2026-04-23T05:00:00.000Z', 'bursty', 1000),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    minFano: 1,
    generatedAt: GEN,
  });
  assert.equal(r.minFano, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'bursty');
  assert.equal(r.droppedBelowMinFano, 1);
});

test('builder (v0.6.54): minFano = 0 is the default and drops nothing', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T05:00:00.000Z', 'steady', 100),
    ql('2026-04-21T05:00:00.000Z', 'steady', 100),
    ql('2026-04-22T05:00:00.000Z', 'steady', 100),
  ];
  const r = buildSourceBurstinessFanoFactor(q, {
    minActiveDays: 3,
    generatedAt: GEN,
  });
  assert.equal(r.minFano, 0);
  assert.equal(r.droppedBelowMinFano, 0);
  assert.equal(r.sources.length, 1);
});

test('builder (v0.6.54): invalid minFano throws', () => {
  assert.throws(
    () => buildSourceBurstinessFanoFactor([], { minFano: -1 }),
    /minFano/,
  );
  assert.throws(
    () => buildSourceBurstinessFanoFactor([], { minFano: Number.NaN }),
    /minFano/,
  );
});
