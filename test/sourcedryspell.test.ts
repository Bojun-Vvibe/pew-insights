import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceDrySpell } from '../src/sourcedryspell.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(total_tokens / 2),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(total_tokens / 2),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-dry-spell: empty input → zero rows, defaults echoed', () => {
  const r = buildSourceDrySpell([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 1);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'longest');
  assert.equal(r.minLongest, 0);
});

test('source-dry-spell: rejects bad opts', () => {
  assert.throws(() => buildSourceDrySpell([], { minDays: 0 }));
  assert.throws(() => buildSourceDrySpell([], { minDays: -1 }));
  assert.throws(() => buildSourceDrySpell([], { minDays: 1.5 }));
  assert.throws(() => buildSourceDrySpell([], { top: 0 }));
  assert.throws(() => buildSourceDrySpell([], { top: 1.5 }));
  assert.throws(() => buildSourceDrySpell([], { minLongest: -1 }));
  assert.throws(() => buildSourceDrySpell([], { minLongest: 1.5 }));
  assert.throws(() =>
    buildSourceDrySpell([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
  assert.throws(() => buildSourceDrySpell([], { since: 'not-a-date' }));
  assert.throws(() => buildSourceDrySpell([], { until: 'not-a-date' }));
});

test('source-dry-spell: perfect attendance → longestDrySpell 0, nDrySpells 0', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    q.push(ql(`2026-04-0${d}T08:00:00Z`, 'alpha', 100));
  }
  const r = buildSourceDrySpell(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.tenureDays, 5);
  assert.equal(s.activeDays, 5);
  assert.equal(s.inactiveDays, 0);
  assert.equal(s.longestDrySpell, 0);
  assert.equal(s.nDrySpells, 0);
  assert.equal(s.meanDrySpell, 0);
  assert.equal(s.drySpellFraction, 0);
  assert.equal(s.longestDrySpellStart, '');
  assert.equal(s.longestDrySpellEnd, '');
});

test('source-dry-spell: single 3-day gap inside tenure', () => {
  // active: 04-01, 04-05 → 3-day dry spell on 04-02..04-04
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'beta', 50),
    ql('2026-04-05T01:00:00Z', 'beta', 50),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.tenureDays, 5);
  assert.equal(s.activeDays, 2);
  assert.equal(s.inactiveDays, 3);
  assert.equal(s.longestDrySpell, 3);
  assert.equal(s.longestDrySpellStart, '2026-04-02');
  assert.equal(s.longestDrySpellEnd, '2026-04-04');
  assert.equal(s.nDrySpells, 1);
  assert.equal(s.meanDrySpell, 3);
  assert.ok(Math.abs(s.drySpellFraction - 0.6) < 1e-9);
});

test('source-dry-spell: two gaps; longest wins; earliest-tied wins', () => {
  // active days: 04-01, 04-03, 04-04, 04-07, 04-10
  // gaps: (01->03)=1day, (04->07)=2days, (07->10)=2days
  // longest = 2, earliest tied = 04-05..04-06
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'gamma', 10),
    ql('2026-04-03T00:00:00Z', 'gamma', 10),
    ql('2026-04-04T00:00:00Z', 'gamma', 10),
    ql('2026-04-07T00:00:00Z', 'gamma', 10),
    ql('2026-04-10T00:00:00Z', 'gamma', 10),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.tenureDays, 10);
  assert.equal(s.activeDays, 5);
  assert.equal(s.inactiveDays, 5);
  assert.equal(s.nDrySpells, 3);
  assert.equal(s.longestDrySpell, 2);
  assert.equal(s.longestDrySpellStart, '2026-04-05');
  assert.equal(s.longestDrySpellEnd, '2026-04-06');
  assert.ok(Math.abs(s.meanDrySpell - 5 / 3) < 1e-9);
});

test('source-dry-spell: sort=longest desc, then source asc tiebreak', () => {
  const q: QueueLine[] = [
    // alpha: 4-day dry spell 04-02..04-05
    ql('2026-04-01T00:00:00Z', 'alpha', 10),
    ql('2026-04-06T00:00:00Z', 'alpha', 10),
    // bravo: same 4-day dry spell shape
    ql('2026-04-01T00:00:00Z', 'bravo', 10),
    ql('2026-04-06T00:00:00Z', 'bravo', 10),
    // charlie: 1-day dry spell
    ql('2026-04-01T00:00:00Z', 'charlie', 10),
    ql('2026-04-03T00:00:00Z', 'charlie', 10),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN, sort: 'longest' });
  assert.equal(r.sources.length, 3);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'bravo');
  assert.equal(r.sources[2]!.source, 'charlie');
});

test('source-dry-spell: minLongest filter drops perfect-attendance', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'perfect', 10),
    ql('2026-04-02T00:00:00Z', 'perfect', 10),
    ql('2026-04-03T00:00:00Z', 'perfect', 10),
    ql('2026-04-01T00:00:00Z', 'gappy', 10),
    ql('2026-04-05T00:00:00Z', 'gappy', 10),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN, minLongest: 1 });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'gappy');
  assert.equal(r.droppedBelowMinLongest, 1);
});

test('source-dry-spell: top cap surfaces droppedBelowTopCap', () => {
  const q: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    q.push(ql('2026-04-01T00:00:00Z', src, 10));
    q.push(ql('2026-04-05T00:00:00Z', src, 10));
  }
  const r = buildSourceDrySpell(q, { generatedAt: GEN, top: 2 });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-dry-spell: window cut shrinks tenure and reshapes spells', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'x', 10),
    ql('2026-04-10T00:00:00Z', 'x', 10),
    ql('2026-04-12T00:00:00Z', 'x', 10),
  ];
  // full: tenure 12 days, dry spells = 8 (04-02..04-09) and 1 (04-11)
  const full = buildSourceDrySpell(q, { generatedAt: GEN });
  assert.equal(full.sources[0]!.longestDrySpell, 8);
  // window: only 04-10 and 04-12 → 1-day dry spell 04-11
  const cut = buildSourceDrySpell(q, {
    generatedAt: GEN,
    since: '2026-04-08T00:00:00Z',
  });
  assert.equal(cut.sources[0]!.longestDrySpell, 1);
  assert.equal(cut.sources[0]!.tenureDays, 3);
});

test('source-dry-spell: zero/non-finite tokens dropped from active set', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'z', 10),
    ql('2026-04-03T00:00:00Z', 'z', 0), // dropped
    ql('2026-04-05T00:00:00Z', 'z', 10),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.sources[0]!.activeDays, 2);
  assert.equal(r.sources[0]!.longestDrySpell, 3);
});

test('source-dry-spell: invalid hour_start counted, not tallied', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'z', 10),
    ql('2026-04-01T00:00:00Z', 'z', 10),
    ql('2026-04-02T00:00:00Z', 'z', 10),
  ];
  const r = buildSourceDrySpell(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.activeDays, 2);
  assert.equal(r.sources[0]!.longestDrySpell, 0);
});

test('source-dry-spell: model and source filters narrow population', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 10, { model: 'm1' }),
    ql('2026-04-03T00:00:00Z', 'a', 10, { model: 'm2' }),
    ql('2026-04-05T00:00:00Z', 'a', 10, { model: 'm1' }),
    ql('2026-04-01T00:00:00Z', 'b', 10, { model: 'm1' }),
  ];
  const onlyM1 = buildSourceDrySpell(q, { generatedAt: GEN, model: 'm1' });
  // a has 04-01, 04-05 (4-day tenure, 3-day spell) under m1
  const aRow = onlyM1.sources.find((s) => s.source === 'a')!;
  assert.equal(aRow.longestDrySpell, 3);
  assert.equal(onlyM1.droppedModelFilter, 1);

  const onlyA = buildSourceDrySpell(q, { generatedAt: GEN, source: 'a' });
  assert.equal(onlyA.totalSources, 1);
  assert.equal(onlyA.droppedSourceFilter, 1);
});
