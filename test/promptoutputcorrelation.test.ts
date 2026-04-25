import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPromptOutputCorrelation } from '../src/promptoutputcorrelation.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens:
      opts.total_tokens ??
      (opts.input_tokens ?? 100) + (opts.output_tokens ?? 100),
  };
}

const GEN = '2026-04-25T13:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('prompt-output-correlation: rejects bad minBuckets', () => {
  assert.throws(() => buildPromptOutputCorrelation([], { minBuckets: 0 }));
  assert.throws(() => buildPromptOutputCorrelation([], { minBuckets: -1 }));
  assert.throws(() => buildPromptOutputCorrelation([], { minBuckets: 1.5 }));
});

test('prompt-output-correlation: rejects bad top', () => {
  assert.throws(() => buildPromptOutputCorrelation([], { top: -1 }));
  assert.throws(() => buildPromptOutputCorrelation([], { top: 1.5 }));
});

test('prompt-output-correlation: rejects bad by', () => {
  assert.throws(() =>
    buildPromptOutputCorrelation([], { by: 'device' as unknown as 'model' }),
  );
});

test('prompt-output-correlation: rejects bad sort', () => {
  assert.throws(() =>
    buildPromptOutputCorrelation([], {
      sort: 'cheese' as unknown as 'tokens',
    }),
  );
});

test('prompt-output-correlation: rejects bad since/until', () => {
  assert.throws(() =>
    buildPromptOutputCorrelation([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildPromptOutputCorrelation([], { until: 'nope' }),
  );
});

// ---- empty / edge ----------------------------------------------------------

test('prompt-output-correlation: empty queue returns zeros', () => {
  const r = buildPromptOutputCorrelation([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalGroups, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.globalDegenerate, true);
  assert.equal(r.groups.length, 0);
});

test('prompt-output-correlation: single bucket → degenerate, dropped by default minBuckets=2', () => {
  const r = buildPromptOutputCorrelation(
    [ql('2026-04-25T10:00:00Z', { input_tokens: 200, output_tokens: 400 })],
    { generatedAt: GEN },
  );
  assert.equal(r.totalGroups, 1);
  assert.equal(r.droppedSparseGroups, 1);
  assert.equal(r.groups.length, 0);
  // global pool also has 1 point → degenerate
  assert.equal(r.globalDegenerate, true);
});

test('prompt-output-correlation: minBuckets=1 keeps singleton but flags degenerate', () => {
  const r = buildPromptOutputCorrelation(
    [ql('2026-04-25T10:00:00Z', { input_tokens: 200, output_tokens: 400 })],
    { generatedAt: GEN, minBuckets: 1 },
  );
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.degenerate, true);
  assert.equal(r.groups[0]!.pearsonR, 0);
  assert.equal(r.groups[0]!.activeBuckets, 1);
});

// ---- happy path ------------------------------------------------------------

test('prompt-output-correlation: perfect linear y=2x → r=+1, slope=2, intercept=0', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    const x = 100 * (i + 1);
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        input_tokens: x,
        output_tokens: 2 * x,
      }),
    );
  }
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN });
  assert.equal(r.groups.length, 1);
  const g = r.groups[0]!;
  assert.equal(g.activeBuckets, 5);
  assert.equal(g.degenerate, false);
  assert.ok(Math.abs(g.pearsonR - 1) < 1e-12, `r should be +1 got ${g.pearsonR}`);
  assert.ok(Math.abs(g.slope - 2) < 1e-12, `slope should be 2 got ${g.slope}`);
  assert.ok(Math.abs(g.intercept) < 1e-9, `intercept should be 0 got ${g.intercept}`);
});

test('prompt-output-correlation: perfect inverse y=-x+C → r=-1, slope=-1', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 100 * (i + 1); // 100, 200, 300, 400
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        input_tokens: x,
        output_tokens: 1000 - x,
      }),
    );
  }
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.degenerate, false);
  assert.ok(Math.abs(g.pearsonR + 1) < 1e-12, `r should be -1 got ${g.pearsonR}`);
  assert.ok(Math.abs(g.slope + 1) < 1e-12, `slope should be -1 got ${g.slope}`);
});

test('prompt-output-correlation: constant input → degenerate, r=0', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 4; i++) {
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        input_tokens: 500, // constant
        output_tokens: 100 * (i + 1),
      }),
    );
  }
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.degenerate, true);
  assert.equal(g.pearsonR, 0);
  assert.equal(g.slope, 0);
  assert.equal(g.intercept, 0);
});

test('prompt-output-correlation: bucket coalescing — same hour_start sums input+output', () => {
  const rows: QueueLine[] = [
    ql('2026-04-25T10:00:00Z', { input_tokens: 100, output_tokens: 50 }),
    ql('2026-04-25T10:00:00Z', { input_tokens: 200, output_tokens: 80 }),
    ql('2026-04-25T11:00:00Z', { input_tokens: 50, output_tokens: 25 }),
    ql('2026-04-25T12:00:00Z', { input_tokens: 400, output_tokens: 200 }),
  ];
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.activeBuckets, 3);
  assert.equal(g.totalInputTokens, 100 + 200 + 50 + 400);
  assert.equal(g.totalOutputTokens, 50 + 80 + 25 + 200);
});

test('prompt-output-correlation: --by source groups by source not model', () => {
  const rows: QueueLine[] = [
    ql('2026-04-25T10:00:00Z', { source: 'codex', input_tokens: 100, output_tokens: 200 }),
    ql('2026-04-25T11:00:00Z', { source: 'codex', input_tokens: 200, output_tokens: 400 }),
    ql('2026-04-25T10:00:00Z', { source: 'cli-x', input_tokens: 100, output_tokens: 50 }),
    ql('2026-04-25T11:00:00Z', { source: 'cli-x', input_tokens: 200, output_tokens: 100 }),
  ];
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN, by: 'source' });
  assert.equal(r.by, 'source');
  assert.equal(r.totalGroups, 2);
  const keys = r.groups.map((g) => g.model).sort();
  assert.deepEqual(keys, ['cli-x', 'codex']);
});

test('prompt-output-correlation: filters drop bad hour_start and zero-token rows', () => {
  const rows: QueueLine[] = [
    ql('not-a-date', {}),
    ql('2026-04-25T10:00:00Z', { total_tokens: 0 }),
    ql('2026-04-25T11:00:00Z', { input_tokens: 100, output_tokens: 200 }),
    ql('2026-04-25T12:00:00Z', { input_tokens: 200, output_tokens: 400 }),
  ];
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.activeBuckets, 2);
});

test('prompt-output-correlation: --since/--until window applies', () => {
  const rows: QueueLine[] = [
    ql('2026-04-24T10:00:00Z', { input_tokens: 100, output_tokens: 200 }),
    ql('2026-04-25T10:00:00Z', { input_tokens: 200, output_tokens: 400 }),
    ql('2026-04-26T10:00:00Z', { input_tokens: 300, output_tokens: 600 }),
  ];
  const r = buildPromptOutputCorrelation(rows, {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-26T00:00:00Z',
    minBuckets: 1,
  });
  assert.equal(r.totalActiveBuckets, 1);
  assert.equal(r.totalInputTokens, 200);
});

test('prompt-output-correlation: --sort abs-r ranks strongest correlations regardless of sign', () => {
  // model A: perfect positive (r=+1)
  // model B: perfect negative (r=-1)
  // model C: noisy positive (r ~ 0.5)
  const rows: QueueLine[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 100 * (i + 1);
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: 'a',
        input_tokens: x,
        output_tokens: 2 * x,
      }),
    );
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: 'b',
        input_tokens: x,
        output_tokens: 1000 - x,
      }),
    );
    // c: alternates noisy
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: 'c',
        input_tokens: x,
        output_tokens: i % 2 === 0 ? x : x + 50,
      }),
    );
  }
  const r = buildPromptOutputCorrelation(rows, {
    generatedAt: GEN,
    sort: 'abs-r',
  });
  // a and b both |r|=1, c is somewhere lower; tiebreak alphabetic between a,b
  assert.equal(r.sort, 'abs-r');
  assert.equal(r.groups[0]!.model, 'a');
  assert.equal(r.groups[1]!.model, 'b');
  assert.equal(r.groups[2]!.model, 'c');
});

test('prompt-output-correlation: --sort r ranks signed (positive first)', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 100 * (i + 1);
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: 'neg',
        input_tokens: x,
        output_tokens: 1000 - x,
      }),
    );
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: 'pos',
        input_tokens: x,
        output_tokens: 2 * x,
      }),
    );
  }
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN, sort: 'r' });
  assert.equal(r.groups[0]!.model, 'pos');
  assert.equal(r.groups[1]!.model, 'neg');
});

test('prompt-output-correlation: --top caps and surfaces droppedTopGroups (global denoms unchanged)', () => {
  const rows: QueueLine[] = [];
  for (const m of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 3; i++) {
      const x = 100 * (i + 1);
      rows.push(
        ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
          model: m,
          input_tokens: x,
          output_tokens: 2 * x + (m === 'a' ? 1000 : m === 'b' ? 500 : 0),
        }),
      );
    }
  }
  const r = buildPromptOutputCorrelation(rows, { generatedAt: GEN, top: 2 });
  assert.equal(r.groups.length, 2);
  assert.equal(r.droppedTopGroups, 2);
  // global denominators reflect all 4 groups
  assert.equal(r.totalGroups, 4);
  assert.equal(r.totalActiveBuckets, 3);
});

test('prompt-output-correlation: minBuckets=3 drops groups with 2 buckets but counts pre-filter totals', () => {
  const rows: QueueLine[] = [
    // group 'thin' with 2 buckets
    ql('2026-04-25T10:00:00Z', { model: 'thin', input_tokens: 100, output_tokens: 200 }),
    ql('2026-04-25T11:00:00Z', { model: 'thin', input_tokens: 200, output_tokens: 400 }),
    // group 'thick' with 4 buckets
    ql('2026-04-25T10:00:00Z', { model: 'thick', input_tokens: 100, output_tokens: 200 }),
    ql('2026-04-25T11:00:00Z', { model: 'thick', input_tokens: 200, output_tokens: 400 }),
    ql('2026-04-25T12:00:00Z', { model: 'thick', input_tokens: 300, output_tokens: 600 }),
    ql('2026-04-25T13:00:00Z', { model: 'thick', input_tokens: 400, output_tokens: 800 }),
  ];
  const r = buildPromptOutputCorrelation(rows, {
    generatedAt: GEN,
    minBuckets: 3,
  });
  assert.equal(r.totalGroups, 2);
  assert.equal(r.droppedSparseGroups, 1);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'thick');
  // global denominators include thin's tokens
  assert.equal(r.totalInputTokens, 100 + 200 + 100 + 200 + 300 + 400);
});

test('prompt-output-correlation: deterministic JSON roundtrip', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    rows.push(
      ql(`2026-04-25T${String(10 + i).padStart(2, '0')}:00:00Z`, {
        model: i % 2 === 0 ? 'a' : 'b',
        input_tokens: 100 * (i + 1),
        output_tokens: 200 * (i + 1),
      }),
    );
  }
  const a = JSON.stringify(buildPromptOutputCorrelation(rows, { generatedAt: GEN, minBuckets: 1 }));
  const b = JSON.stringify(buildPromptOutputCorrelation(rows, { generatedAt: GEN, minBuckets: 1 }));
  assert.equal(a, b);
});
