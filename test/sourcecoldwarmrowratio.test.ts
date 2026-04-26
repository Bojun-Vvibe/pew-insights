import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceColdWarmRowRatio } from '../src/sourcecoldwarmrowratio.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens = 0,
): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: inputTokens,
    cached_input_tokens: cachedInputTokens,
    output_tokens: outputTokens,
    reasoning_output_tokens: 0,
    total_tokens: inputTokens + outputTokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

// ---- validation ------------------------------------------------------------

test('build: rejects negative minRows', () => {
  assert.throws(() => buildSourceColdWarmRowRatio([], { minRows: -1 }));
});

test('build: rejects non-integer minRows', () => {
  assert.throws(() => buildSourceColdWarmRowRatio([], { minRows: 1.5 }));
});

test('build: rejects negative top', () => {
  assert.throws(() => buildSourceColdWarmRowRatio([], { top: -1 }));
});

test('build: rejects unknown sort', () => {
  assert.throws(() =>
    buildSourceColdWarmRowRatio([], { sort: 'nope' as 'tokens' }),
  );
});

test('build: rejects bad since/until', () => {
  assert.throws(() => buildSourceColdWarmRowRatio([], { since: 'whatever' }));
  assert.throws(() => buildSourceColdWarmRowRatio([], { until: 'nope' }));
});

// ---- empty / edge ----------------------------------------------------------

test('build: empty queue -> empty sources', () => {
  const r = buildSourceColdWarmRowRatio([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('build: drops rows with non-positive input_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'codex', 0, 0),
    ql('2026-04-20T02:00:00.000Z', 'codex', -5, 0),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 0 });
  assert.equal(r.droppedNonPositiveInput, 2);
  assert.equal(r.sources.length, 0);
});

test('build: drops rows with invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'codex', 100, 0),
    ql('2026-04-20T01:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T02:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T05:00:00.000Z', 'codex', 100, 0),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nRows, 5);
});

// ---- core counting ---------------------------------------------------------

test('build: pure cold source -> coldShare=1, coldInputTokenShare=1, gap=0', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 6; h++) {
    q.push(
      ql(
        `2026-04-20T${String(h).padStart(2, '0')}:00:00.000Z`,
        'codex',
        100,
        0,
      ),
    );
  }
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.coldRows, 6);
  assert.equal(s.warmRows, 0);
  assert.equal(s.coldShare, 1);
  assert.equal(s.coldInputTokenShare, 1);
  assert.equal(s.coldRowMassGap, 0);
  assert.equal(s.meanWarmInput, 0);
  assert.equal(s.meanColdInput, 100);
});

test('build: pure warm source -> coldShare=0, coldInputTokenShare=0, gap=0', () => {
  const q: QueueLine[] = [];
  for (let h = 0; h < 5; h++) {
    q.push(
      ql(
        `2026-04-20T${String(h).padStart(2, '0')}:00:00.000Z`,
        'claude-code',
        500,
        300,
      ),
    );
  }
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.coldRows, 0);
  assert.equal(s.warmRows, 5);
  assert.equal(s.coldShare, 0);
  assert.equal(s.coldInputTokenShare, 0);
  assert.equal(s.coldRowMassGap, 0);
  assert.equal(s.meanColdInput, 0);
  assert.equal(s.meanWarmInput, 500);
});

test('build: gap is positive when cold rows are smaller than warm rows', () => {
  // 3 small cold rows of 100, 2 huge warm rows of 10_000.
  // coldShare = 3/5 = 0.6
  // coldInputTokenShare = 300 / (300 + 20_000) = 300/20300 ≈ 0.01478
  // gap ≈ +0.585
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T04:00:00.000Z', 'codex', 10000, 5000),
    ql('2026-04-20T05:00:00.000Z', 'codex', 10000, 5000),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  const s = r.sources[0]!;
  assert.equal(s.coldRows, 3);
  assert.equal(s.warmRows, 2);
  assert.equal(s.coldShare, 0.6);
  assert.ok(Math.abs(s.coldInputTokenShare - 300 / 20300) < 1e-12);
  assert.ok(s.coldRowMassGap > 0.5);
});

test('build: gap is negative when cold rows are bigger than warm rows', () => {
  // 2 huge cold rows of 10_000, 3 tiny warm rows of 100.
  // coldShare = 2/5 = 0.4
  // coldInputTokenShare = 20_000 / (20_000 + 300) ≈ 0.9852
  // gap ≈ -0.585
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'codex', 10000, 0),
    ql('2026-04-20T02:00:00.000Z', 'codex', 10000, 0),
    ql('2026-04-20T03:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T05:00:00.000Z', 'codex', 100, 50),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  const s = r.sources[0]!;
  assert.equal(s.coldRows, 2);
  assert.equal(s.warmRows, 3);
  assert.equal(s.coldShare, 0.4);
  assert.ok(s.coldRowMassGap < -0.5);
});

// ---- filters / sort --------------------------------------------------------

test('build: minRows drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'sparse', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'sparse', 100, 0),
    // dense source: 6 rows
    ql('2026-04-20T01:00:00.000Z', 'dense', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'dense', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'dense', 100, 0),
    ql('2026-04-20T04:00:00.000Z', 'dense', 100, 0),
    ql('2026-04-20T05:00:00.000Z', 'dense', 100, 0),
    ql('2026-04-20T06:00:00.000Z', 'dense', 100, 0),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 5 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'dense');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: source filter routes non-matching to droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'codex', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'claude-code', 100, 50),
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 0,
    source: 'codex',
  });
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'codex');
});

test('build: sort by gap ranks largest |gap| first', () => {
  const q: QueueLine[] = [
    // small-gap source: 2 cold of 100, 2 warm of 100  -> coldShare=0.5,
    // coldInputTokenShare=0.5, gap=0
    ql('2026-04-20T01:00:00.000Z', 'small', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'small', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'small', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'small', 100, 50),
    // big-gap source: 4 cold of 10, 1 warm of 10_000 -> gap large positive
    ql('2026-04-20T01:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T02:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T03:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T04:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T05:00:00.000Z', 'big', 10000, 5000),
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'gap',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('build: top caps after sort and reports droppedTopSources', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'a', 1000, 0),
    ql('2026-04-20T02:00:00.000Z', 'a', 1000, 0),
    ql('2026-04-20T03:00:00.000Z', 'a', 1000, 0),
    ql('2026-04-20T01:00:00.000Z', 'b', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'b', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'b', 100, 0),
    ql('2026-04-20T01:00:00.000Z', 'c', 10, 0),
    ql('2026-04-20T02:00:00.000Z', 'c', 10, 0),
    ql('2026-04-20T03:00:00.000Z', 'c', 10, 0),
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    top: 2,
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.droppedTopSources, 1);
});

test('build: window filter excludes rows outside [since, until)', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T23:00:00.000Z', 'codex', 100, 0), // before
    ql('2026-04-20T01:00:00.000Z', 'codex', 100, 0), // in
    ql('2026-04-20T02:00:00.000Z', 'codex', 100, 0), // in
    ql('2026-04-21T00:00:00.000Z', 'codex', 100, 0), // at until = excluded
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nRows, 2);
});

test('build: ties broken by source asc on equal sort key', () => {
  const q: QueueLine[] = [
    // both pure-cold, identical totals
    ql('2026-04-20T01:00:00.000Z', 'b-source', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'b-source', 100, 0),
    ql('2026-04-20T01:00:00.000Z', 'a-source', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'a-source', 100, 0),
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'cold-share',
  });
  assert.equal(r.sources[0]!.source, 'a-source');
  assert.equal(r.sources[1]!.source, 'b-source');
});

// ---- refinement (v0.6.64): minAbsGap ---------------------------------------

test('build: rejects minAbsGap out of [0,1]', () => {
  assert.throws(() => buildSourceColdWarmRowRatio([], { minAbsGap: -0.1 }));
  assert.throws(() => buildSourceColdWarmRowRatio([], { minAbsGap: 1.5 }));
  assert.throws(() => buildSourceColdWarmRowRatio([], { minAbsGap: NaN }));
});

test('build: minAbsGap=0 default keeps every source', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'a', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'a', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'a', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'a', 100, 50),
    // gap = 0 source
    ql('2026-04-20T01:00:00.000Z', 'b', 200, 0),
    ql('2026-04-20T02:00:00.000Z', 'b', 200, 0),
    ql('2026-04-20T03:00:00.000Z', 'b', 200, 100),
    ql('2026-04-20T04:00:00.000Z', 'b', 200, 100),
  ];
  const r = buildSourceColdWarmRowRatio(q, { generatedAt: GEN, minRows: 1 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinAbsGap, 0);
});

test('build: minAbsGap drops gap-zero sources but keeps gap-large ones', () => {
  const q: QueueLine[] = [
    // gap=0 source: 2 cold of 100, 2 warm of 100
    ql('2026-04-20T01:00:00.000Z', 'flat', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'flat', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'flat', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'flat', 100, 50),
    // gap-large source: 4 cold of 10, 1 warm of 10_000
    ql('2026-04-20T01:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T02:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T03:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T04:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T05:00:00.000Z', 'big', 10000, 5000),
  ];
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    minAbsGap: 0.1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinAbsGap, 1);
});

test('build: minAbsGap fires on negative gap as well as positive (abs filter)', () => {
  // Single source with negative gap (big cold rows, small warm rows).
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'codex', 10000, 0),
    ql('2026-04-20T02:00:00.000Z', 'codex', 10000, 0),
    ql('2026-04-20T03:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'codex', 100, 50),
    ql('2026-04-20T05:00:00.000Z', 'codex', 100, 50),
  ];
  const rPass = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    minAbsGap: 0.5,
  });
  assert.equal(rPass.sources.length, 1);
  // Bumping above the magnitude should drop it.
  const rDrop = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    minAbsGap: 0.99,
  });
  assert.equal(rDrop.sources.length, 0);
  assert.equal(rDrop.droppedBelowMinAbsGap, 1);
});

test('build: minAbsGap composes with --top (filter happens before cap)', () => {
  const q: QueueLine[] = [
    // 3 sources: gap 0.0, gap +0.5, gap +0.8
    // 0
    ql('2026-04-20T01:00:00.000Z', 'flat', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'flat', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'flat', 100, 50),
    ql('2026-04-20T04:00:00.000Z', 'flat', 100, 50),
    // mid: 3 cold of 100, 1 warm of 1000  -> coldShare=0.75, mass=300/1300=0.231, gap≈0.519
    ql('2026-04-20T01:00:00.000Z', 'mid', 100, 0),
    ql('2026-04-20T02:00:00.000Z', 'mid', 100, 0),
    ql('2026-04-20T03:00:00.000Z', 'mid', 100, 0),
    ql('2026-04-20T04:00:00.000Z', 'mid', 1000, 500),
    // big: 4 cold of 10, 1 warm of 10000  -> gap≈0.7997
    ql('2026-04-20T01:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T02:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T03:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T04:00:00.000Z', 'big', 10, 0),
    ql('2026-04-20T05:00:00.000Z', 'big', 10000, 5000),
  ];
  // min-abs-gap=0.4 drops 'flat'. Then --top=1 sorted by gap keeps 'big'.
  const r = buildSourceColdWarmRowRatio(q, {
    generatedAt: GEN,
    minRows: 1,
    minAbsGap: 0.4,
    top: 1,
    sort: 'gap',
  });
  assert.equal(r.droppedBelowMinAbsGap, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: minAbsGap is reported on the report object', () => {
  const r = buildSourceColdWarmRowRatio([], {
    generatedAt: GEN,
    minAbsGap: 0.25,
  });
  assert.equal(r.minAbsGap, 0.25);
});
