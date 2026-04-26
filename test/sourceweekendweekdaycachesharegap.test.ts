import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceWeekendWeekdayCacheShareGap,
  isWeekendUtc,
} from '../src/sourceweekendweekdaycachesharegap.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  inputTokens: number,
  cachedInputTokens: number,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: inputTokens,
    cached_input_tokens: cachedInputTokens,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: inputTokens + 1, // ensure positive total_tokens to pass the gate
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// 2026-04-20 = Monday (UTC), 2026-04-25 = Saturday, 2026-04-26 = Sunday
// quick sanity: getUTCDay for these dates
test('isWeekendUtc: Sat=6 and Sun=0 are weekend; Mon..Fri are not', () => {
  assert.equal(isWeekendUtc(0), true); // Sun
  assert.equal(isWeekendUtc(6), true); // Sat
  for (const d of [1, 2, 3, 4, 5]) assert.equal(isWeekendUtc(d), false);
});

test('builder: empty queue -> zero sources, zero totals', () => {
  const r = buildSourceWeekendWeekdayCacheShareGap([], {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.totalCachedInputTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'absgap');
  assert.equal(r.minInputTokens, 0);
});

test('builder: single weekday-only source -> weekend share is null, gap is null', () => {
  // 2026-04-20 = Monday UTC
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'codex', 1000, 200),
    ql('2026-04-20T11:00:00.000Z', 'codex', 500, 100),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'codex');
  assert.equal(row.weekdayInputTokens, 1500);
  assert.equal(row.weekdayCachedInputTokens, 300);
  assert.equal(row.weekendInputTokens, 0);
  assert.equal(row.weekendCachedInputTokens, 0);
  assert.equal(row.weekdayBuckets, 2);
  assert.equal(row.weekendBuckets, 0);
  assert.equal(row.weekdayCacheShare, 300 / 1500);
  assert.equal(row.weekendCacheShare, null);
  assert.equal(row.shareGap, null);
  assert.equal(row.absShareGap, null);
  assert.equal(row.shareRatio, null);
});

test('builder: weekday and weekend present -> shares + gap + ratio computed', () => {
  // weekday: Mon 2026-04-20  weekend: Sat 2026-04-25
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'src', 1000, 100), // wkdy share = 0.10
    ql('2026-04-25T10:00:00.000Z', 'src', 1000, 400), // wknd share = 0.40
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.weekdayCacheShare, 0.1);
  assert.equal(row.weekendCacheShare, 0.4);
  assert.equal(row.shareGap, 0.30000000000000004); // 0.4 - 0.1, JS float
  assert.equal(row.absShareGap, 0.30000000000000004);
  assert.equal(row.shareRatio, 4);
  assert.equal(row.weekdayBuckets, 1);
  assert.equal(row.weekendBuckets, 1);
});

test('builder: shareRatio is null when weekdayCacheShare is exactly 0', () => {
  const q: QueueLine[] = [
    // weekday: input but zero cached
    ql('2026-04-20T10:00:00.000Z', 'src', 1000, 0),
    // weekend: input + cached
    ql('2026-04-25T10:00:00.000Z', 'src', 1000, 250),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.weekdayCacheShare, 0);
  assert.equal(row.weekendCacheShare, 0.25);
  assert.equal(row.shareGap, 0.25);
  assert.equal(row.absShareGap, 0.25);
  assert.equal(row.shareRatio, null); // div by zero guarded
});

test('builder: minInputTokens drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'big', 5000, 1000),
    ql('2026-04-20T10:00:00.000Z', 'small', 100, 10),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('builder: source filter applied; non-matching surface as droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'codex', 1000, 100),
    ql('2026-04-20T10:00:00.000Z', 'other', 1000, 100),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    source: 'codex',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'codex');
  assert.equal(r.source, 'codex');
});

test('builder: bad hour_start counted; non-positive total_tokens counted', () => {
  const q: QueueLine[] = [
    { ...ql('not-a-date', 'codex', 100, 0) },
    { ...ql('2026-04-20T10:00:00.000Z', 'codex', 100, 0), total_tokens: 0 },
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: since/until window filters by hour_start', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T10:00:00.000Z', 's', 1000, 100), // before window
    ql('2026-04-20T10:00:00.000Z', 's', 1000, 200), // inside
    ql('2026-04-22T10:00:00.000Z', 's', 1000, 300), // at until -> excluded (until is exclusive)
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-22T10:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  // Only the 2026-04-20 row counts -> weekday-only
  assert.equal(r.sources[0]!.weekdayInputTokens, 1000);
  assert.equal(r.sources[0]!.weekdayCachedInputTokens, 200);
  assert.equal(r.sources[0]!.weekendInputTokens, 0);
});

test('builder: sort=absgap puts largest |gap| first; nulls last', () => {
  // src A: wkdy 0.10, wknd 0.40 -> gap 0.30
  // src B: wkdy 0.05, wknd 0.15 -> gap 0.10
  // src C: weekday only -> gap null
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 1000, 100),
    ql('2026-04-25T10:00:00.000Z', 'A', 1000, 400),
    ql('2026-04-20T10:00:00.000Z', 'B', 1000, 50),
    ql('2026-04-25T10:00:00.000Z', 'B', 1000, 150),
    ql('2026-04-20T10:00:00.000Z', 'C', 5000, 500),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    sort: 'absgap',
    generatedAt: GEN,
  });
  const order = r.sources.map((s) => s.source);
  assert.deepEqual(order, ['A', 'B', 'C']);
});

test('builder: sort=gap distinguishes sign (positive first, then negative)', () => {
  // src A: gap +0.30
  // src B: gap -0.20
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 1000, 100), // 0.10
    ql('2026-04-25T10:00:00.000Z', 'A', 1000, 400), // 0.40
    ql('2026-04-20T10:00:00.000Z', 'B', 1000, 400), // 0.40
    ql('2026-04-25T10:00:00.000Z', 'B', 1000, 200), // 0.20
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    sort: 'gap',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'A');
  assert.equal(r.sources[1]!.source, 'B');
});

test('builder: top cap applied after sort', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 1000, 100),
    ql('2026-04-25T10:00:00.000Z', 'A', 1000, 400),
    ql('2026-04-20T10:00:00.000Z', 'B', 1000, 50),
    ql('2026-04-25T10:00:00.000Z', 'B', 1000, 150),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    sort: 'absgap',
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('builder: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceWeekendWeekdayCacheShareGap([], {
        sort: 'nope' as never,
        generatedAt: GEN,
      }),
    /sort must be one of/,
  );
});

test('builder: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceWeekendWeekdayCacheShareGap([], {
        since: 'definitely-not-a-date',
        generatedAt: GEN,
      }),
    /invalid since/,
  );
});

test('builder: negative minInputTokens throws', () => {
  assert.throws(
    () =>
      buildSourceWeekendWeekdayCacheShareGap([], {
        minInputTokens: -1,
        generatedAt: GEN,
      }),
    /minInputTokens must be/,
  );
});

test('builder: empty source string normalized to "(unknown)"', () => {
  const q: QueueLine[] = [ql('2026-04-20T10:00:00.000Z', '', 1000, 100)];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

// ---- v0.6.50 refinement: --min-input-tokens-each-side --------------------

test('builder v0.6.50: minInputTokensEachSide drops sources with one tiny side', () => {
  // A: weekday 5000, weekend 100 -> tiny weekend
  // B: weekday 5000, weekend 5000 -> both sides healthy
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 5000, 500),
    ql('2026-04-25T10:00:00.000Z', 'A', 100, 10),
    ql('2026-04-20T10:00:00.000Z', 'B', 5000, 500),
    ql('2026-04-25T10:00:00.000Z', 'B', 5000, 1500),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    minInputTokensEachSide: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.minInputTokensEachSide, 1000);
  assert.equal(r.droppedBelowMinInputTokensEachSide, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'B');
});

test('builder v0.6.50: minInputTokensEachSide=0 is no-op (default)', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 5000, 500),
    ql('2026-04-25T10:00:00.000Z', 'A', 100, 10),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    generatedAt: GEN,
  });
  assert.equal(r.minInputTokensEachSide, 0);
  assert.equal(r.droppedBelowMinInputTokensEachSide, 0);
  assert.equal(r.sources.length, 1);
});

test('builder v0.6.50: minInputTokensEachSide drops weekday-only sources (weekend = 0)', () => {
  // weekday-only source A: weekendInputTokens = 0 < any positive floor
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 5000, 500),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 0,
    minInputTokensEachSide: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinInputTokensEachSide, 1);
  assert.equal(r.sources.length, 0);
});

test('builder v0.6.50: negative minInputTokensEachSide throws', () => {
  assert.throws(
    () =>
      buildSourceWeekendWeekdayCacheShareGap([], {
        minInputTokensEachSide: -1,
        generatedAt: GEN,
      }),
    /minInputTokensEachSide must be/,
  );
});

test('builder v0.6.50: per-side filter applies AFTER pooled minInputTokens (filter order)', () => {
  // A: pooled 500 (below minInputTokens=1000) -> dropped as sparse, NOT counted in per-side drop
  // B: pooled 5100 (passes), weekend tiny -> dropped as per-side
  const q: QueueLine[] = [
    ql('2026-04-20T10:00:00.000Z', 'A', 400, 100),
    ql('2026-04-25T10:00:00.000Z', 'A', 100, 10),
    ql('2026-04-20T10:00:00.000Z', 'B', 5000, 500),
    ql('2026-04-25T10:00:00.000Z', 'B', 100, 10),
  ];
  const r = buildSourceWeekendWeekdayCacheShareGap(q, {
    minInputTokens: 1000,
    minInputTokensEachSide: 500,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1); // A
  assert.equal(r.droppedBelowMinInputTokensEachSide, 1); // B
  assert.equal(r.sources.length, 0);
});
