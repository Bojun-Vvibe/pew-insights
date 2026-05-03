import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenIsoWeekDayOfWeekEntropy,
  classifyDowConcentrationRegime,
  isoDayOfWeek,
  isoWeekKey,
  normalisedDowEntropy,
} from '../src/dailytokenisoweekdayofweekentropy.js';
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

const GEN = '2026-05-04T12:00:00.000Z';
const LOG2_7 = Math.log2(7);

// --- helpers --------------------------------------------------------------

test('isoWeekKey: 2026-01-05 (Mon) -> 2026-W02', () => {
  // 2026-01-01 is Thu; iso-week-1 is the week containing Jan 1's
  // Thursday (which IS Jan 1). 2026-01-05 (Mon) starts iso-W02.
  assert.deepEqual(isoWeekKey('2026-01-05'), { year: 2026, week: 2 });
});

test('isoWeekKey: 2025-12-29 (Mon) -> 2026-W01 (year boundary)', () => {
  // Mon Dec 29 2025 -> iso year 2026, week 1 (Thursday is Jan 1 2026).
  assert.deepEqual(isoWeekKey('2025-12-29'), { year: 2026, week: 1 });
});

test('isoWeekKey: 2026-01-01 (Thu) -> 2026-W01', () => {
  assert.deepEqual(isoWeekKey('2026-01-01'), { year: 2026, week: 1 });
});

test('isoWeekKey: throws on garbage', () => {
  assert.throws(() => isoWeekKey('not-a-day'));
});

test('isoDayOfWeek: 2026-01-05 (Mon) -> 0', () => {
  assert.equal(isoDayOfWeek('2026-01-05'), 0);
});

test('isoDayOfWeek: 2026-01-11 (Sun) -> 6', () => {
  assert.equal(isoDayOfWeek('2026-01-11'), 6);
});

test('isoDayOfWeek: 2026-01-08 (Thu) -> 3', () => {
  assert.equal(isoDayOfWeek('2026-01-08'), 3);
});

test('isoDayOfWeek: throws on garbage', () => {
  assert.throws(() => isoDayOfWeek('not-a-day'));
});

// --- normalisedDowEntropy -------------------------------------------------

test('normalisedDowEntropy: empty mass -> 0', () => {
  assert.equal(normalisedDowEntropy([0, 0, 0, 0, 0, 0, 0]), 0);
});

test('normalisedDowEntropy: single bin -> 0', () => {
  assert.equal(normalisedDowEntropy([100, 0, 0, 0, 0, 0, 0]), 0);
});

test('normalisedDowEntropy: uniform 7 bins -> 1', () => {
  const v = normalisedDowEntropy([1, 1, 1, 1, 1, 1, 1]);
  assert.ok(Math.abs(v - 1) < 1e-12, `expected 1, got ${v}`);
});

test('normalisedDowEntropy: two equal bins -> log2(2)/log2(7)', () => {
  const v = normalisedDowEntropy([1, 1, 0, 0, 0, 0, 0]);
  const expected = 1 / LOG2_7;
  assert.ok(Math.abs(v - expected) < 1e-12, `expected ${expected}, got ${v}`);
});

test('normalisedDowEntropy: 5 equal workdays -> log2(5)/log2(7)', () => {
  const v = normalisedDowEntropy([1, 1, 1, 1, 1, 0, 0]);
  const expected = Math.log2(5) / LOG2_7;
  assert.ok(Math.abs(v - expected) < 1e-12, `expected ${expected}, got ${v}`);
});

test('normalisedDowEntropy: throws on wrong length', () => {
  assert.throws(() => normalisedDowEntropy([1, 1, 1]));
});

test('normalisedDowEntropy: throws on negative weight', () => {
  assert.throws(() => normalisedDowEntropy([1, 1, 1, 1, 1, 1, -1]));
});

test('normalisedDowEntropy: invariant to scale', () => {
  const a = normalisedDowEntropy([3, 7, 0, 0, 0, 0, 0]);
  const b = normalisedDowEntropy([300, 700, 0, 0, 0, 0, 0]);
  assert.ok(Math.abs(a - b) < 1e-12);
});

// --- regime ---------------------------------------------------------------

test('regime: degenerate when nWeeks=1 nDays=1', () => {
  assert.equal(classifyDowConcentrationRegime(0, 1, 1), 'degenerate');
});

test('regime: single-dow at 0', () => {
  assert.equal(classifyDowConcentrationRegime(0, 5, 5), 'single-dow');
});

test('regime: two-dow at 0.3562 (two-bin uniform)', () => {
  assert.equal(
    classifyDowConcentrationRegime(1 / LOG2_7, 5, 10),
    'two-dow',
  );
});

test('regime: workweek-tilted at 0.6', () => {
  assert.equal(
    classifyDowConcentrationRegime(0.6, 5, 25),
    'workweek-tilted',
  );
});

test('regime: broad-week at 0.83 (workdays uniform)', () => {
  assert.equal(
    classifyDowConcentrationRegime(Math.log2(5) / LOG2_7, 5, 25),
    'broad-week',
  );
});

test('regime: uniform-week at 1.0', () => {
  assert.equal(classifyDowConcentrationRegime(1, 5, 35), 'uniform-week');
});

// --- builder: empty -------------------------------------------------------

test('builder: empty queue -> empty report', () => {
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
});

test('builder: drops non-positive total_tokens', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 's1', 0),
    ql('2026-01-06T10:00:00.000Z', 's1', -5),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 0);
});

test('builder: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 's1', 100)];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

// --- builder: single-DOW per week -> 0 -----------------------------------

test('builder: all-Mon every iso week -> meanWeeklyEntropyNorm = 0', () => {
  const queue: QueueLine[] = [
    // 2026-W02 Mon = Jan 5
    ql('2026-01-05T10:00:00.000Z', 's1', 5000),
    // 2026-W03 Mon = Jan 12
    ql('2026-01-12T10:00:00.000Z', 's1', 5000),
    // 2026-W04 Mon = Jan 19
    ql('2026-01-19T10:00:00.000Z', 's1', 5000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    minDays: 2,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 3);
  assert.equal(s.nDays, 3);
  assert.ok(Math.abs(s.meanWeeklyEntropyNorm) < 1e-12);
  assert.ok(Math.abs(s.unweightedMeanEntropyNorm) < 1e-12);
  assert.equal(s.dowConcentrationRegime, 'single-dow');
});

// --- builder: uniform-week -> 1 ------------------------------------------

test('builder: uniform Mon-Sun in single iso week -> 1', () => {
  const queue: QueueLine[] = [];
  // 2026-W02 = Jan 5 (Mon) .. Jan 11 (Sun).
  for (let i = 0; i < 7; i += 1) {
    const day = String(5 + i).padStart(2, '0');
    queue.push(ql(`2026-01-${day}T10:00:00.000Z`, 's1', 1000));
  }
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 1);
  assert.equal(s.nDays, 7);
  assert.ok(Math.abs(s.meanWeeklyEntropyNorm - 1) < 1e-12);
  assert.equal(s.dowConcentrationRegime, 'uniform-week');
});

// --- builder: two-DOW each week -> log2(2)/log2(7) -----------------------

test('builder: Mon+Tue equal mass each of two iso weeks -> log2(2)/log2(7)', () => {
  const queue: QueueLine[] = [
    // 2026-W02 Mon + Tue
    ql('2026-01-05T10:00:00.000Z', 's1', 1000),
    ql('2026-01-06T10:00:00.000Z', 's1', 1000),
    // 2026-W03 Mon + Tue
    ql('2026-01-12T10:00:00.000Z', 's1', 1000),
    ql('2026-01-13T10:00:00.000Z', 's1', 1000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 2);
  const expected = 1 / LOG2_7;
  assert.ok(
    Math.abs(s.meanWeeklyEntropyNorm - expected) < 1e-12,
    `expected ${expected}, got ${s.meanWeeklyEntropyNorm}`,
  );
  assert.equal(s.dowConcentrationRegime, 'two-dow');
});

// --- builder: token-weighted vs unweighted divergence --------------------

test('builder: token-weighted mean differs from unweighted when weeks have different totals', () => {
  const queue: QueueLine[] = [
    // Heavy uniform-week (W02, 7000 tokens uniform across 7 DOWs).
    ql('2026-01-05T10:00:00.000Z', 's1', 1000),
    ql('2026-01-06T10:00:00.000Z', 's1', 1000),
    ql('2026-01-07T10:00:00.000Z', 's1', 1000),
    ql('2026-01-08T10:00:00.000Z', 's1', 1000),
    ql('2026-01-09T10:00:00.000Z', 's1', 1000),
    ql('2026-01-10T10:00:00.000Z', 's1', 1000),
    ql('2026-01-11T10:00:00.000Z', 's1', 1000),
    // Light single-DOW week (W03, 100 tokens on Mon).
    ql('2026-01-12T10:00:00.000Z', 's1', 100),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 2);
  // Weighted ~ (7000*1 + 100*0) / 7100 ~ 0.9859.
  // Unweighted = (1 + 0) / 2 = 0.5.
  assert.ok(s.meanWeeklyEntropyNorm > 0.98);
  assert.ok(Math.abs(s.unweightedMeanEntropyNorm - 0.5) < 1e-12);
});

// --- orthogonality witnesses ---------------------------------------------

test('orthogonality: same global DOW histogram, different per-week distribution', () => {
  // Source A: 1000 on Mon W02, 1000 on Tue W03 -> single-DOW each
  // week, global DOW shares 50% Mon + 50% Tue.
  const a: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    ql('2026-01-13T10:00:00.000Z', 'A', 1000),
  ];
  // Source B: 500 Mon + 500 Tue each of W02 and W03 -> two-DOW
  // each week, identical global DOW shares.
  const b: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'B', 500),
    ql('2026-01-06T10:00:00.000Z', 'B', 500),
    ql('2026-01-12T10:00:00.000Z', 'B', 500),
    ql('2026-01-13T10:00:00.000Z', 'B', 500),
  ];
  const ra = buildDailyTokenIsoWeekDayOfWeekEntropy(a, { generatedAt: GEN });
  const rb = buildDailyTokenIsoWeekDayOfWeekEntropy(b, { generatedAt: GEN });
  assert.ok(Math.abs(ra.sources[0].meanWeeklyEntropyNorm) < 1e-12);
  assert.ok(
    Math.abs(rb.sources[0].meanWeeklyEntropyNorm - 1 / LOG2_7) < 1e-12,
  );
});

// --- filters --------------------------------------------------------------

test('filter: minTokens drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'tiny', 10),
    ql('2026-01-06T10:00:00.000Z', 'tiny', 10),
    ql('2026-01-05T10:00:00.000Z', 'big', 5000),
    ql('2026-01-06T10:00:00.000Z', 'big', 5000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('filter: minMeanEntropy hides low-entropy sources', () => {
  const queue: QueueLine[] = [
    // single-DOW source
    ql('2026-01-05T10:00:00.000Z', 'A', 5000),
    ql('2026-01-12T10:00:00.000Z', 'A', 5000),
    // uniform-week source
    ql('2026-01-05T10:00:00.000Z', 'B', 1000),
    ql('2026-01-06T10:00:00.000Z', 'B', 1000),
    ql('2026-01-07T10:00:00.000Z', 'B', 1000),
    ql('2026-01-08T10:00:00.000Z', 'B', 1000),
    ql('2026-01-09T10:00:00.000Z', 'B', 1000),
    ql('2026-01-10T10:00:00.000Z', 'B', 1000),
    ql('2026-01-11T10:00:00.000Z', 'B', 1000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    minMeanEntropy: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'B');
  assert.equal(r.droppedBelowMinMeanEntropy, 1);
});

// --- validation -----------------------------------------------------------

test('validation: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenIsoWeekDayOfWeekEntropy([], {
      // @ts-expect-error
      sort: 'bogus',
      generatedAt: GEN,
    }),
  );
});

test('validation: invalid windowSize throws (none here, but minDays=0 throws)', () => {
  assert.throws(() =>
    buildDailyTokenIsoWeekDayOfWeekEntropy([], {
      minDays: 0,
      generatedAt: GEN,
    }),
  );
});

test('validation: invalid minMeanEntropy throws', () => {
  assert.throws(() =>
    buildDailyTokenIsoWeekDayOfWeekEntropy([], {
      minMeanEntropy: 1.5,
      generatedAt: GEN,
    }),
  );
});

// --- sort -----------------------------------------------------------------

test('sort: by tokens descending puts heavier source first', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    ql('2026-01-06T10:00:00.000Z', 'A', 1000),
    ql('2026-01-05T10:00:00.000Z', 'B', 5000),
    ql('2026-01-06T10:00:00.000Z', 'B', 5000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    sort: 'tokens',
  });
  assert.equal(r.sources[0].source, 'B');
  assert.equal(r.sources[1].source, 'A');
});

test('sort: tie-break heavier source first on equal entropy', () => {
  const queue: QueueLine[] = [
    // both two-DOW (Mon+Tue) per single iso week -> identical entropy
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    ql('2026-01-06T10:00:00.000Z', 'A', 1000),
    ql('2026-01-05T10:00:00.000Z', 'B', 5000),
    ql('2026-01-06T10:00:00.000Z', 'B', 5000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    sort: 'meanEntropy',
  });
  // Same headline; B should be first by token tie-break.
  assert.ok(
    Math.abs(
      r.sources[0].meanWeeklyEntropyNorm -
        r.sources[1].meanWeeklyEntropyNorm,
    ) < 1e-12,
  );
  assert.equal(r.sources[0].source, 'B');
});

// --- top cap --------------------------------------------------------------

test('top cap: --top 1 keeps only one row, reports dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    ql('2026-01-06T10:00:00.000Z', 'A', 1000),
    ql('2026-01-05T10:00:00.000Z', 'B', 1000),
    ql('2026-01-06T10:00:00.000Z', 'B', 1000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

// --- min/max/std fields ---------------------------------------------------

test('min/max/std: single iso week -> std = 0, min = max = mean', () => {
  const queue: QueueLine[] = [
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    ql('2026-01-06T10:00:00.000Z', 'A', 1000),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 1);
  assert.equal(s.stdWeeklyEntropyNorm, 0);
  assert.ok(Math.abs(s.minWeeklyEntropyNorm - s.maxWeeklyEntropyNorm) < 1e-12);
  assert.ok(Math.abs(s.minWeeklyEntropyNorm - s.meanWeeklyEntropyNorm) < 1e-12);
});

test('min/max/std: divergent weeks -> std > 0, min < max', () => {
  const queue: QueueLine[] = [
    // W02: single Mon
    ql('2026-01-05T10:00:00.000Z', 'A', 1000),
    // W03: uniform Mon-Sun
    ql('2026-01-12T10:00:00.000Z', 'A', 100),
    ql('2026-01-13T10:00:00.000Z', 'A', 100),
    ql('2026-01-14T10:00:00.000Z', 'A', 100),
    ql('2026-01-15T10:00:00.000Z', 'A', 100),
    ql('2026-01-16T10:00:00.000Z', 'A', 100),
    ql('2026-01-17T10:00:00.000Z', 'A', 100),
    ql('2026-01-18T10:00:00.000Z', 'A', 100),
  ];
  const r = buildDailyTokenIsoWeekDayOfWeekEntropy(queue, { generatedAt: GEN });
  const s = r.sources[0];
  assert.equal(s.nIsoWeeks, 2);
  assert.ok(Math.abs(s.minWeeklyEntropyNorm) < 1e-12);
  assert.ok(Math.abs(s.maxWeeklyEntropyNorm - 1) < 1e-12);
  assert.ok(s.stdWeeklyEntropyNorm > 0);
});
