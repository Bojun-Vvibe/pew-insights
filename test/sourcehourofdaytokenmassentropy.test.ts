import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceHourOfDayTokenMassEntropy,
  shannonEntropyBits,
  MAX_HOUR_ENTROPY_BITS,
} from '../src/sourcehourofdaytokenmassentropy.js';
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

const GEN = '2026-04-26T12:00:00.000Z';
const EPS = 1e-9;

// ---- shannonEntropyBits ---------------------------------------------------

test('shannonEntropyBits: empty -> 0', () => {
  assert.equal(shannonEntropyBits([]), 0);
});

test('shannonEntropyBits: all zero -> 0', () => {
  assert.equal(shannonEntropyBits([0, 0, 0, 0]), 0);
});

test('shannonEntropyBits: single non-zero -> 0', () => {
  assert.equal(shannonEntropyBits([0, 5, 0]), 0);
});

test('shannonEntropyBits: two equal -> 1 bit', () => {
  assert.ok(Math.abs(shannonEntropyBits([1, 1]) - 1) < EPS);
});

test('shannonEntropyBits: four equal -> 2 bits', () => {
  assert.ok(Math.abs(shannonEntropyBits([3, 3, 3, 3]) - 2) < EPS);
});

test('shannonEntropyBits: 24 equal -> log2(24) bits', () => {
  const v = new Array(24).fill(7);
  assert.ok(Math.abs(shannonEntropyBits(v) - Math.log2(24)) < EPS);
});

test('shannonEntropyBits: skewed (0.95, 0.05) < 1 bit', () => {
  const h = shannonEntropyBits([95, 5]);
  assert.ok(h > 0 && h < 1);
  // closed form: H = -0.95 log2 0.95 - 0.05 log2 0.05 ~= 0.2864
  assert.ok(Math.abs(h - 0.28639695711595625) < 1e-9);
});

test('shannonEntropyBits: rejects negative entries', () => {
  assert.throws(() => shannonEntropyBits([1, -1, 1]));
});

// ---- builder: validation --------------------------------------------------

test('build: rejects negative minTokens', () => {
  assert.throws(() => buildSourceHourOfDayTokenMassEntropy([], { minTokens: -1 }));
});

test('build: rejects non-integer top', () => {
  assert.throws(() => buildSourceHourOfDayTokenMassEntropy([], { top: 1.5 }));
});

test('build: rejects minNormalized out of [0,1]', () => {
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { minNormalized: -0.01 }),
  );
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { minNormalized: 1.01 }),
  );
});

test('build: rejects minEffectiveHours out of [0,24]', () => {
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { minEffectiveHours: -0.01 }),
  );
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { minEffectiveHours: 24.01 }),
  );
});

test('build: rejects unknown sort', () => {
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], {
      sort: 'nope' as unknown as 'tokens',
    }),
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { since: 'not-an-iso' }),
  );
  assert.throws(() =>
    buildSourceHourOfDayTokenMassEntropy([], { until: 'not-an-iso' }),
  );
});

// ---- builder: structural --------------------------------------------------

test('build: empty queue -> empty sources, all-zero counters', () => {
  const r = buildSourceHourOfDayTokenMassEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.maxEntropyBits, MAX_HOUR_ENTROPY_BITS);
  assert.equal(r.generatedAt, GEN);
});

test('build: bad hour_start drops to droppedInvalidHourStart', () => {
  const q: QueueLine[] = [ql('not-a-date', 's', 100)];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalSources, 0);
});

test('build: non-positive tokens drop to droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 's', 0),
    ql('2026-04-20T04:00:00.000Z', 's', -1),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.totalSources, 0);
});

test('build: source filter drops non-matching', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 'a', 5000),
    ql('2026-04-20T04:00:00.000Z', 'b', 5000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('build: minTokens drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 'sparse', 100),
    ql('2026-04-20T04:00:00.000Z', 'rich', 5000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'rich');
});

// ---- builder: math --------------------------------------------------------

test('build: single hour -> entropyBits=0, normalized=0, effective=1, gap=0', () => {
  const q: QueueLine[] = [ql('2026-04-20T05:00:00.000Z', 's', 5000)];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 1);
  assert.equal(s.entropyBits, 0);
  assert.equal(s.entropyNormalized, 0);
  assert.equal(s.effectiveHours, 1);
  assert.equal(s.concentrationGap, 0);
  assert.equal(s.topHour, 5);
  assert.equal(s.topHourShare, 1);
});

test('build: 24 hours equal mass -> normalized=1, effective=24, gap=0', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    q.push(ql(`2026-04-20T${hh}:00:00.000Z`, 's', 1000));
  }
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 24);
  assert.ok(Math.abs(s.entropyBits - Math.log2(24)) < EPS);
  assert.ok(Math.abs(s.entropyNormalized - 1) < EPS);
  assert.ok(Math.abs(s.effectiveHours - 24) < 1e-9);
  assert.ok(Math.abs(s.concentrationGap) < 1e-9);
  assert.ok(Math.abs(s.topHourShare - 1 / 24) < EPS);
});

test('build: skewed (95, 5) on 2 hours -> illusory breadth, gap > 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 's', 9500),
    ql('2026-04-20T04:00:00.000Z', 's', 500),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 2);
  // H = 0.286..., effective = 2^H ~= 1.219..., gap ~= 0.78
  assert.ok(s.entropyBits > 0.28 && s.entropyBits < 0.29);
  assert.ok(s.effectiveHours > 1.21 && s.effectiveHours < 1.22);
  assert.ok(s.concentrationGap > 0.78 && s.concentrationGap < 0.79);
  assert.equal(s.topHour, 3);
  assert.ok(Math.abs(s.topHourShare - 0.95) < EPS);
});

test('build: balanced 3 hours -> H=log2(3), no gap', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T08:00:00.000Z', 's', 1000),
    ql('2026-04-20T12:00:00.000Z', 's', 1000),
    ql('2026-04-20T20:00:00.000Z', 's', 1000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeHours, 3);
  assert.ok(Math.abs(s.entropyBits - Math.log2(3)) < EPS);
  assert.ok(Math.abs(s.effectiveHours - 3) < 1e-9);
  assert.ok(Math.abs(s.concentrationGap) < 1e-9);
});

// ---- builder: sort + filter -----------------------------------------------

test('build: sort=entropy puts highest H first; ties break on source asc', () => {
  const q: QueueLine[] = [
    // a: 1 hour, H=0
    ql('2026-04-20T03:00:00.000Z', 'a', 5000),
    // b: 4 equal hours, H=2
    ql('2026-04-20T01:00:00.000Z', 'b', 1000),
    ql('2026-04-20T07:00:00.000Z', 'b', 1000),
    ql('2026-04-20T13:00:00.000Z', 'b', 1000),
    ql('2026-04-20T19:00:00.000Z', 'b', 1000),
    // c: 2 equal hours, H=1
    ql('2026-04-20T05:00:00.000Z', 'c', 2500),
    ql('2026-04-20T17:00:00.000Z', 'c', 2500),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    sort: 'entropy',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'c', 'a'],
  );
});

test('build: sort=gap puts illusory-breadth first', () => {
  const q: QueueLine[] = [
    // x: 4 hours, very skewed -> high gap
    ql('2026-04-20T01:00:00.000Z', 'x', 9700),
    ql('2026-04-20T07:00:00.000Z', 'x', 100),
    ql('2026-04-20T13:00:00.000Z', 'x', 100),
    ql('2026-04-20T19:00:00.000Z', 'x', 100),
    // y: 4 hours, equal -> gap=0
    ql('2026-04-20T02:00:00.000Z', 'y', 1000),
    ql('2026-04-20T08:00:00.000Z', 'y', 1000),
    ql('2026-04-20T14:00:00.000Z', 'y', 1000),
    ql('2026-04-20T20:00:00.000Z', 'y', 1000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    sort: 'gap',
  });
  assert.equal(r.sources[0]!.source, 'x');
  assert.equal(r.sources[1]!.source, 'y');
  assert.ok(r.sources[0]!.concentrationGap > 2);
  assert.ok(Math.abs(r.sources[1]!.concentrationGap) < 1e-9);
});

test('build: minNormalized filters and counts droppedBelowMinNormalized', () => {
  const q: QueueLine[] = [
    // a: 1 hour, normalized = 0
    ql('2026-04-20T03:00:00.000Z', 'a', 5000),
    // b: 24 equal hours, normalized = 1
    ...Array.from({ length: 24 }, (_, h) =>
      ql(`2026-04-20T${String(h).padStart(2, '0')}:00:00.000Z`, 'b', 1000),
    ),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    minNormalized: 0.5,
  });
  assert.equal(r.droppedBelowMinNormalized, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('build: top caps results and surfaces droppedTopSources', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T03:00:00.000Z', 'a', 5000),
    ql('2026-04-20T03:00:00.000Z', 'b', 4000),
    ql('2026-04-20T03:00:00.000Z', 'c', 3000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    sort: 'tokens',
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('build: minEffectiveHours filters by perplexity, not normalized', () => {
  const q: QueueLine[] = [
    // illusory: activeHours=24 but mass concentrated -> effective ~ 2.1
    ql('2026-04-20T01:00:00.000Z', 'illusory', 9700),
    ...Array.from({ length: 23 }, (_, i) =>
      ql(
        `2026-04-20T${String(i + 1).padStart(2, '0')}:00:00.000Z`,
        'illusory',
        100,
      ),
    ),
    // real: 8 equal hours -> effective = 8.0
    ...Array.from({ length: 8 }, (_, i) =>
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00.000Z`, 'real', 1000),
    ),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    minEffectiveHours: 6,
  });
  assert.equal(r.droppedBelowMinEffectiveHours, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'real');
  assert.ok(Math.abs(r.sources[0]!.effectiveHours - 8) < 1e-9);
});

test('build: minNormalized and minEffectiveHours compose by intersection', () => {
  const q: QueueLine[] = [
    // a: 1 hour -> normalized=0, effective=1. Filtered by either.
    ql('2026-04-20T03:00:00.000Z', 'a', 5000),
    // b: 4 equal hours -> normalized = 2 / log2(24) ~ 0.436, effective = 4.
    //    Passes --min-normalized 0.4 but fails --min-effective-hours 6.
    ...Array.from({ length: 4 }, (_, i) =>
      ql(`2026-04-20T${String(i * 6).padStart(2, '0')}:00:00.000Z`, 'b', 1000),
    ),
    // c: 24 equal hours -> normalized=1, effective=24. Passes both.
    ...Array.from({ length: 24 }, (_, i) =>
      ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00.000Z`, 'c', 1000),
    ),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    minNormalized: 0.4,
    minEffectiveHours: 6,
  });
  // a dropped by min-normalized; b passes min-normalized but dropped by min-effective-hours
  assert.equal(r.droppedBelowMinNormalized, 1);
  assert.equal(r.droppedBelowMinEffectiveHours, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
});

test('build: since/until window filters mass', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T03:00:00.000Z', 's', 5000), // before
    ql('2026-04-20T03:00:00.000Z', 's', 5000), // in
    ql('2026-04-22T03:00:00.000Z', 's', 5000), // out (>= until)
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
  });
  assert.equal(r.totalTokens, 5000);
  assert.equal(r.sources[0]!.activeHours, 1);
  assert.equal(r.sources[0]!.totalTokens, 5000);
});

test('build: hour-of-day uses UTC even when local is different', () => {
  // 2026-04-20T23:30:00Z is hour 23 UTC regardless of local TZ.
  const q: QueueLine[] = [
    ql('2026-04-20T23:30:00.000Z', 's', 5000),
  ];
  const r = buildSourceHourOfDayTokenMassEntropy(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.topHour, 23);
});
