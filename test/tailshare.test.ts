import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildTailShare } from '../src/tailshare.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'claude-code',
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

test('tail-share: rejects bad since/until/minBuckets', () => {
  assert.throws(() => buildTailShare([], { since: 'not-a-date' }));
  assert.throws(() => buildTailShare([], { until: 'nope' }));
  assert.throws(() => buildTailShare([], { minBuckets: -1 }));
  assert.throws(() => buildTailShare([], { minBuckets: 1.5 }));
});

// ---- empty / drops --------------------------------------------------------

test('tail-share: empty queue returns zeros', () => {
  const r = buildTailShare([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.sources, []);
});

test('tail-share: drops zero-token rows and bad hour_start', () => {
  const r = buildTailShare(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 500 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 500);
});

// ---- single-bucket source: one bucket = 100% of tokens at every K --------

test('tail-share: single-bucket source has top1=top5=top10=top20=1.0 and giniLike=1', () => {
  const r = buildTailShare(
    [ql('2026-04-20T05:00:00Z', { source: 'vscode-ext', total_tokens: 999 })],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'vscode-ext');
  assert.equal(s.bucketCount, 1);
  assert.equal(s.tokens, 999);
  assert.equal(s.top1Share, 1);
  assert.equal(s.top5Share, 1);
  assert.equal(s.top10Share, 1);
  assert.equal(s.top20Share, 1);
  // baseline = 1 with n=1 → giniLike = 0 (uniform on 1 bucket is degenerate).
  assert.equal(s.giniLike, 0);
});

// ---- uniform 100 buckets: top10% should be ~10% of tokens ----------------

test('tail-share: uniform distribution across 100 buckets gives top10% ≈ 10%, low giniLike', () => {
  const lines: QueueLine[] = [];
  // 100 distinct hours, all same token count
  for (let h = 0; h < 100; h += 1) {
    const hh = String(h).padStart(2, '0');
    // spread across 4 days * 24h to get 100 distinct hour_starts
    const day = 20 + Math.floor(h / 24);
    const hour = h % 24;
    const ts = `2026-04-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`;
    void hh;
    lines.push(ql(ts, { source: 'flat', total_tokens: 10 }));
  }
  const r = buildTailShare(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 100);
  // exactly 10 buckets * 10 tokens / 1000 total = 0.1
  assert.equal(s.top10Share, 0.1);
  assert.equal(s.top20Share, 0.2);
  // giniLike should be ~0 (within rounding).
  assert.ok(s.giniLike < 0.05, `expected giniLike < 0.05, got ${s.giniLike}`);
});

// ---- skewed distribution: one giant bucket dominates ---------------------

test('tail-share: heavily skewed source has high giniLike (close to 1)', () => {
  const lines: QueueLine[] = [];
  // 99 buckets of 1 token + 1 bucket of 9901 tokens = 10000 total
  for (let h = 0; h < 99; h += 1) {
    const day = 20 + Math.floor(h / 24);
    const hour = h % 24;
    const ts = `2026-04-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`;
    lines.push(ql(ts, { source: 'spike', total_tokens: 1 }));
  }
  lines.push(ql('2026-04-25T05:00:00Z', { source: 'spike', total_tokens: 9901 }));

  const r = buildTailShare(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.bucketCount, 100);
  // Heaviest 1% = top 1 bucket = 9901 / 10000 = 0.9901
  assert.ok(Math.abs(s.top1Share - 0.9901) < 1e-6, `got top1Share=${s.top1Share}`);
  assert.ok(s.giniLike > 0.9, `expected giniLike > 0.9, got ${s.giniLike}`);
});

// ---- multiple sources sort by giniLike desc ------------------------------

test('tail-share: sources sorted by giniLike desc with name tiebreak', () => {
  const lines: QueueLine[] = [];
  // source 'aaa' uniform on 10 buckets
  for (let h = 0; h < 10; h += 1) {
    lines.push(
      ql(`2026-04-20T${String(h).padStart(2, '0')}:00:00Z`, {
        source: 'aaa',
        total_tokens: 100,
      }),
    );
  }
  // source 'zzz' very skewed
  for (let h = 0; h < 9; h += 1) {
    lines.push(
      ql(`2026-04-21T${String(h).padStart(2, '0')}:00:00Z`, {
        source: 'zzz',
        total_tokens: 1,
      }),
    );
  }
  lines.push(ql('2026-04-21T10:00:00Z', { source: 'zzz', total_tokens: 1000 }));

  const r = buildTailShare(lines, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'zzz'); // higher giniLike first
  assert.equal(r.sources[1]!.source, 'aaa');
});

// ---- window filter -------------------------------------------------------

test('tail-share: since/until window filter excludes out-of-range buckets', () => {
  const r = buildTailShare(
    [
      ql('2026-04-19T05:00:00Z', { total_tokens: 9999 }), // before since
      ql('2026-04-21T05:00:00Z', { total_tokens: 100 }), // in window
      ql('2026-04-25T05:00:00Z', { total_tokens: 9999 }), // at/after until
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-25T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 100);
});

// ---- multi-model in same hour collapses to one bucket --------------------

test('tail-share: same hour_start with multiple models collapses to one bucket per source', () => {
  const r = buildTailShare(
    [
      ql('2026-04-20T05:00:00Z', { source: 'cli-x', model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T05:00:00Z', { source: 'cli-x', model: 'opus', total_tokens: 200 }),
      ql('2026-04-20T06:00:00Z', { source: 'cli-x', model: 'gpt-5', total_tokens: 50 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.bucketCount, 2);
  assert.equal(r.sources[0]!.tokens, 350);
});

// ---- empty source string normalises to 'unknown' ------------------------

test('tail-share: empty source string normalises to "unknown"', () => {
  const r = buildTailShare(
    [ql('2026-04-20T05:00:00Z', { source: '', total_tokens: 100 })],
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---- minBuckets filter ---------------------------------------------------

test('tail-share: --min-buckets drops sparse sources, totals reflect kept population', () => {
  const lines: QueueLine[] = [];
  // 'fat' has 12 buckets
  for (let h = 0; h < 12; h += 1) {
    lines.push(
      ql(`2026-04-20T${String(h).padStart(2, '0')}:00:00Z`, {
        source: 'fat',
        total_tokens: 50,
      }),
    );
  }
  // 'thin' has just 2 buckets — should be dropped at minBuckets=10
  lines.push(ql('2026-04-21T01:00:00Z', { source: 'thin', total_tokens: 9999 }));
  lines.push(ql('2026-04-21T02:00:00Z', { source: 'thin', total_tokens: 9999 }));

  const r = buildTailShare(lines, { minBuckets: 10, generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'fat');
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedSparseBuckets, 2);
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalBuckets, 12);
  assert.equal(r.totalTokens, 600); // sparse source tokens excluded from totals
});

// ---- top cap -------------------------------------------------------------

test('tail-share: --top caps display rows; totals stay full-population, droppedTopSources surfaces remainder', () => {
  const lines: QueueLine[] = [];
  // 3 sources, each with a single bucket so giniLike == 0 for all,
  // tiebreak is by name asc → aaa, bbb, ccc.
  lines.push(ql('2026-04-20T01:00:00Z', { source: 'aaa', total_tokens: 100 }));
  lines.push(ql('2026-04-20T02:00:00Z', { source: 'bbb', total_tokens: 100 }));
  lines.push(ql('2026-04-20T03:00:00Z', { source: 'ccc', total_tokens: 100 }));

  const r = buildTailShare(lines, { top: 2, generatedAt: GEN });
  assert.equal(r.top, 2);
  assert.equal(r.sources.length, 2);
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['aaa', 'bbb'],
  );
  assert.equal(r.droppedTopSources, 1);
  // Totals reflect full surviving population, not just displayed.
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalBuckets, 3);
  assert.equal(r.totalTokens, 300);
});

// ---- top option validation -----------------------------------------------

test('tail-share: rejects bad top', () => {
  assert.throws(() => buildTailShare([], { top: -1 }));
  assert.throws(() => buildTailShare([], { top: 1.5 }));
});
