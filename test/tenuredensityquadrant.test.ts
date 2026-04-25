import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildTenureDensityQuadrant } from '../src/tenuredensityquadrant.js';
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
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('tdq: rejects bad since/until/min-buckets/top/sort', () => {
  assert.throws(() => buildTenureDensityQuadrant([], { since: 'not-a-date' }));
  assert.throws(() => buildTenureDensityQuadrant([], { until: 'nope' }));
  assert.throws(() => buildTenureDensityQuadrant([], { minBuckets: -1 }));
  assert.throws(() => buildTenureDensityQuadrant([], { minBuckets: 1.5 }));
  assert.throws(() => buildTenureDensityQuadrant([], { top: -1 }));
  // @ts-expect-error wrong sort
  assert.throws(() => buildTenureDensityQuadrant([], { sort: 'bogus' }));
});

// ---- empty / drops --------------------------------------------------------

test('tdq: empty queue returns zeros and null medians', () => {
  const r = buildTenureDensityQuadrant([], { generatedAt: GEN });
  assert.equal(r.totalModels, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.medianSpanHours, null);
  assert.equal(r.medianDensity, null);
  for (const q of r.quadrants) assert.equal(q.count, 0);
});

test('tdq: drops zero-token rows and bad hour_start', () => {
  const r = buildTenureDensityQuadrant(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { model: 'm1', total_tokens: 500 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalModels, 1);
  assert.equal(r.totalTokens, 500);
});

test('tdq: source filter excludes non-matching rows and counts them', () => {
  const r = buildTenureDensityQuadrant(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', model: 'a', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { source: 'claude-code', model: 'b', total_tokens: 200 }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.totalModels, 1);
  assert.equal(r.source, 'codex');
});

// ---- quadrant assignment --------------------------------------------------

test('tdq: 4-model fixture splits cleanly into 4 quadrants by medians', () => {
  // Build 4 models with distinct (span, density) corners.
  // medianSpan among 4 models will be average of 2nd and 3rd values.
  // Make: long-dense, long-sparse, short-dense, short-sparse explicit.
  const queue: QueueLine[] = [
    // long-dense: 100h span, density 1000
    ql('2026-04-01T00:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-05T04:00:00Z', { model: 'ld', total_tokens: 1000 }),
    // long-sparse: 80h span, density 100
    ql('2026-04-01T00:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-04T08:00:00Z', { model: 'ls', total_tokens: 100 }),
    // short-dense: 2h span, density 2000
    ql('2026-04-10T00:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T02:00:00Z', { model: 'sd', total_tokens: 2000 }),
    // short-sparse: 1h span, density 50
    ql('2026-04-10T00:00:00Z', { model: 'ss', total_tokens: 50 }),
    ql('2026-04-10T01:00:00Z', { model: 'ss', total_tokens: 50 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  assert.equal(r.totalModels, 4);
  // medianSpan = avg(2,80) = 41 ; medianDensity = avg(75, 1000) = 537.5
  // Spans:  ld=100, ls=80, sd=2, ss=1  -> sorted: 1,2,80,100, median=(2+80)/2=41
  // Density: ld=1000, ls=100, sd=2000, ss=50 -> sorted: 50,100,1000,2000, median=(100+1000)/2=550
  assert.equal(r.medianSpanHours, 41);
  assert.equal(r.medianDensity, 550);
  const byQ = new Map(r.quadrants.map((q) => [q.quadrant, q]));
  assert.equal(byQ.get('long-dense')!.count, 1);
  assert.equal(byQ.get('long-dense')!.models[0]!.model, 'ld');
  assert.equal(byQ.get('long-sparse')!.count, 1);
  assert.equal(byQ.get('long-sparse')!.models[0]!.model, 'ls');
  assert.equal(byQ.get('short-dense')!.count, 1);
  assert.equal(byQ.get('short-dense')!.models[0]!.model, 'sd');
  assert.equal(byQ.get('short-sparse')!.count, 1);
  assert.equal(byQ.get('short-sparse')!.models[0]!.model, 'ss');
});

test('tdq: tokens, activeBuckets, density per row are correct', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'a', total_tokens: 300 }),
    ql('2026-04-01T01:00:00Z', { model: 'a', total_tokens: 700 }),
    ql('2026-04-01T00:00:00Z', { model: 'b', total_tokens: 500 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  // medianSpan = (0+1)/2 = 0.5 ; medianDensity = (500+500)/2 = 500
  // A: span=1 long; density=500 dense (>=) -> long-dense
  // B: span=0 short; density=500 dense (>=) -> short-dense
  const byQ = new Map(r.quadrants.map((q) => [q.quadrant, q]));
  const a = byQ.get('long-dense')!.models.find((m) => m.model === 'a')!;
  assert.equal(a.tokens, 1000);
  assert.equal(a.activeBuckets, 2);
  assert.equal(a.density, 500);
  assert.equal(a.spanHours, 1);
  const b = byQ.get('short-dense')!.models.find((m) => m.model === 'b')!;
  assert.equal(b.tokens, 500);
  assert.equal(b.activeBuckets, 1);
  assert.equal(b.density, 500);
  assert.equal(b.spanHours, 0);
});

test('tdq: ties on medians go long/dense (>=)', () => {
  // Two models, identical span and density. Both meet >= median.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-01T01:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-02T00:00:00Z', { model: 'b', total_tokens: 100 }),
    ql('2026-04-02T01:00:00Z', { model: 'b', total_tokens: 100 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  // Both models: span=1, density=100. medianSpan=1, medianDensity=100. Both >= -> long-dense.
  const byQ = new Map(r.quadrants.map((q) => [q.quadrant, q]));
  assert.equal(byQ.get('long-dense')!.count, 2);
  assert.equal(byQ.get('long-sparse')!.count, 0);
  assert.equal(byQ.get('short-dense')!.count, 0);
  assert.equal(byQ.get('short-sparse')!.count, 0);
});

// ---- minBuckets floor ------------------------------------------------------

test('tdq: minBuckets drops sparse models and excludes them from medians', () => {
  const queue: QueueLine[] = [
    // sparse model: only 1 active bucket
    ql('2026-04-01T00:00:00Z', { model: 'sparse', total_tokens: 999_999 }),
    // dense models with multiple buckets
    ql('2026-04-01T00:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-01T01:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-02T00:00:00Z', { model: 'b', total_tokens: 100 }),
    ql('2026-04-02T01:00:00Z', { model: 'b', total_tokens: 100 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, minBuckets: 2 });
  assert.equal(r.totalModels, 2); // sparse excluded
  assert.equal(r.droppedSparseModels, 1);
  assert.equal(r.droppedSparseBuckets, 1);
  // Medians computed only on A, B (not on the giant sparse one).
  assert.equal(r.medianDensity, 100);
});

// ---- top cap --------------------------------------------------------------

test('tdq: top cap truncates per-quadrant model lists, droppedTop accounts for remainder', () => {
  const queue: QueueLine[] = [];
  // Five models all in the same quadrant by construction:
  // identical span (1h) and identical density (100). All -> long-dense.
  for (const name of ['m1', 'm2', 'm3', 'm4', 'm5']) {
    queue.push(ql('2026-04-01T00:00:00Z', { model: name, total_tokens: 100 }));
    queue.push(ql('2026-04-01T01:00:00Z', { model: name, total_tokens: 100 }));
  }
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, top: 2 });
  const byQ = new Map(r.quadrants.map((q) => [q.quadrant, q]));
  const ld = byQ.get('long-dense')!;
  assert.equal(ld.count, 5); // count is full population
  assert.equal(ld.models.length, 2); // shown only top 2
  assert.equal(ld.droppedTop, 3);
});

// ---- sort key -------------------------------------------------------------

test('tdq: sort=span orders quadrant rows by spanHours desc, tiebreak model asc', () => {
  const queue: QueueLine[] = [
    // All same density (100), differing spans. All same minBuckets.
    ql('2026-04-01T00:00:00Z', { model: 'short', total_tokens: 100 }),
    ql('2026-04-01T01:00:00Z', { model: 'short', total_tokens: 100 }),
    ql('2026-04-01T00:00:00Z', { model: 'long', total_tokens: 100 }),
    ql('2026-04-03T00:00:00Z', { model: 'long', total_tokens: 100 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, sort: 'span' });
  // Both same density -> both >= median density -> dense.
  // medianSpan = (1+48)/2 = 24.5. long(48)>=24.5 long-dense; short(1)<24.5 short-dense.
  const byQ = new Map(r.quadrants.map((q) => [q.quadrant, q]));
  assert.equal(byQ.get('long-dense')!.models[0]!.model, 'long');
  assert.equal(byQ.get('short-dense')!.models[0]!.model, 'short');
});

// ---- window filtering -----------------------------------------------------

test('tdq: since/until window filters apply before medians', () => {
  const queue: QueueLine[] = [
    ql('2026-03-01T00:00:00Z', { model: 'old', total_tokens: 999 }),
    ql('2026-04-01T00:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-01T01:00:00Z', { model: 'a', total_tokens: 100 }),
  ];
  const r = buildTenureDensityQuadrant(queue, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
  });
  assert.equal(r.totalModels, 1);
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
});

// ---- determinism ----------------------------------------------------------

test('tdq: deterministic — same input produces same output', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'a', total_tokens: 100 }),
    ql('2026-04-01T05:00:00Z', { model: 'a', total_tokens: 200 }),
    ql('2026-04-02T00:00:00Z', { model: 'b', total_tokens: 50 }),
    ql('2026-04-02T01:00:00Z', { model: 'b', total_tokens: 50 }),
  ];
  const r1 = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  const r2 = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

// ---- echoed options -------------------------------------------------------

test('tdq: report echoes options (minBuckets, top, sort, source)', () => {
  const r = buildTenureDensityQuadrant(
    [ql('2026-04-01T00:00:00Z', { source: 'codex', model: 'a', total_tokens: 100 })],
    { generatedAt: GEN, minBuckets: 1, top: 3, sort: 'density', source: 'codex' },
  );
  assert.equal(r.minBuckets, 1);
  assert.equal(r.top, 3);
  assert.equal(r.sort, 'density');
  assert.equal(r.source, 'codex');
});

// ---- --quadrant filter ----------------------------------------------------

test('tdq: --quadrant filters report to a single quadrant', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-05T04:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-01T00:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-04T08:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-10T00:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T02:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T00:00:00Z', { model: 'ss', total_tokens: 50 }),
    ql('2026-04-10T01:00:00Z', { model: 'ss', total_tokens: 50 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, quadrant: 'long-dense' });
  assert.equal(r.quadrants.length, 1);
  assert.equal(r.quadrants[0]!.quadrant, 'long-dense');
  assert.equal(r.quadrants[0]!.models[0]!.model, 'ld');
});

test('tdq: --quadrant filter preserves classification (medians use full population)', () => {
  // Use the same 4-model fixture. medianSpan=41, medianDensity=550 regardless of filter.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-05T04:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-01T00:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-04T08:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-10T00:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T02:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T00:00:00Z', { model: 'ss', total_tokens: 50 }),
    ql('2026-04-10T01:00:00Z', { model: 'ss', total_tokens: 50 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, quadrant: 'short-dense' });
  // Medians are still computed over all 4 models.
  assert.equal(r.medianSpanHours, 41);
  assert.equal(r.medianDensity, 550);
  assert.equal(r.totalModels, 4);
});

test('tdq: --quadrant filter records droppedQuadrantModels and droppedQuadrantTokens', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-05T04:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-01T00:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-04T08:00:00Z', { model: 'ls', total_tokens: 100 }),
    ql('2026-04-10T00:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T02:00:00Z', { model: 'sd', total_tokens: 2000 }),
    ql('2026-04-10T00:00:00Z', { model: 'ss', total_tokens: 50 }),
    ql('2026-04-10T01:00:00Z', { model: 'ss', total_tokens: 50 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN, quadrant: 'long-dense' });
  // 3 quadrants suppressed: ls (200 tokens), sd (4000 tokens), ss (100 tokens) = 4300 tokens, 3 models.
  assert.equal(r.droppedQuadrantModels, 3);
  assert.equal(r.droppedQuadrantTokens, 4300);
});

test('tdq: --quadrant filter rejects invalid quadrant name', () => {
  // @ts-expect-error invalid value
  assert.throws(() => buildTenureDensityQuadrant([], { quadrant: 'sideways' }));
});

test('tdq: no --quadrant filter -> droppedQuadrant{Models,Tokens} both zero', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-05T04:00:00Z', { model: 'ld', total_tokens: 1000 }),
    ql('2026-04-10T00:00:00Z', { model: 'ss', total_tokens: 50 }),
    ql('2026-04-10T01:00:00Z', { model: 'ss', total_tokens: 50 }),
  ];
  const r = buildTenureDensityQuadrant(queue, { generatedAt: GEN });
  assert.equal(r.droppedQuadrantModels, 0);
  assert.equal(r.droppedQuadrantTokens, 0);
  assert.equal(r.quadrants.length, 4);
});

test('tdq: --quadrant composes with --top (only the kept quadrant is truncated for display)', () => {
  // 5 models all in long-dense (same span, same density).
  const queue: QueueLine[] = [];
  for (const name of ['m1', 'm2', 'm3', 'm4', 'm5']) {
    queue.push(ql('2026-04-01T00:00:00Z', { model: name, total_tokens: 100 }));
    queue.push(ql('2026-04-01T01:00:00Z', { model: name, total_tokens: 100 }));
  }
  const r = buildTenureDensityQuadrant(queue, {
    generatedAt: GEN,
    quadrant: 'long-dense',
    top: 2,
  });
  assert.equal(r.quadrants.length, 1);
  const ld = r.quadrants[0]!;
  assert.equal(ld.count, 5);
  assert.equal(ld.models.length, 2);
  assert.equal(ld.droppedTop, 3);
});

test('tdq: --quadrant filter targeting an empty quadrant returns empty models[] but preserves count=0', () => {
  // All 4 models cluster into long-dense (identical span, identical density).
  const queue: QueueLine[] = [];
  for (const name of ['m1', 'm2', 'm3', 'm4']) {
    queue.push(ql('2026-04-01T00:00:00Z', { model: name, total_tokens: 100 }));
    queue.push(ql('2026-04-01T01:00:00Z', { model: name, total_tokens: 100 }));
  }
  const r = buildTenureDensityQuadrant(queue, {
    generatedAt: GEN,
    quadrant: 'short-sparse',
  });
  assert.equal(r.quadrants.length, 1);
  assert.equal(r.quadrants[0]!.quadrant, 'short-sparse');
  assert.equal(r.quadrants[0]!.count, 0);
  assert.equal(r.quadrants[0]!.models.length, 0);
  // The 4 long-dense models were suppressed by the filter.
  assert.equal(r.droppedQuadrantModels, 4);
});
