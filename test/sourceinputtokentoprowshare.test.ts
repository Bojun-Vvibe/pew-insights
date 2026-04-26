import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceInputTokenTopRowShare } from '../src/sourceinputtokentoprowshare.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  input_tokens: number,
  output_tokens = 10,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens,
    cached_input_tokens: 0,
    output_tokens,
    reasoning_output_tokens: 0,
    total_tokens: input_tokens + output_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('source-input-token-top-row-share: empty input -> empty report with defaults', () => {
  const r = buildSourceInputTokenTopRowShare([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.topK, 3);
  assert.equal(r.minRows, 3);
  assert.equal(r.minTop1Share, 0);
  assert.equal(r.minTopKShare, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tokens');
});

test('source-input-token-top-row-share: rejects bad topK', () => {
  assert.throws(() => buildSourceInputTokenTopRowShare([], { topK: 0 }));
  assert.throws(() => buildSourceInputTokenTopRowShare([], { topK: -1 }));
  assert.throws(() => buildSourceInputTokenTopRowShare([], { topK: 1.5 }));
});

test('source-input-token-top-row-share: rejects bad minRows', () => {
  assert.throws(() => buildSourceInputTokenTopRowShare([], { minRows: 0 }));
  assert.throws(() => buildSourceInputTokenTopRowShare([], { minRows: 1.5 }));
});

test('source-input-token-top-row-share: rejects bad minTop1Share / minTopKShare', () => {
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { minTop1Share: -0.01 }),
  );
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { minTop1Share: 1.01 }),
  );
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { minTopKShare: -0.01 }),
  );
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { minTopKShare: 1.01 }),
  );
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], {
      minTop1Share: Number.POSITIVE_INFINITY,
    }),
  );
});

test('source-input-token-top-row-share: rejects bad top', () => {
  assert.throws(() => buildSourceInputTokenTopRowShare([], { top: 0 }));
  assert.throws(() => buildSourceInputTokenTopRowShare([], { top: 1.5 }));
});

test('source-input-token-top-row-share: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceInputTokenTopRowShare([], { sort: 'bogus' }),
  );
});

test('source-input-token-top-row-share: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], { until: 'also-bad' }),
  );
});

test('source-input-token-top-row-share: uniform source -> top1Share=1/n, hhi=1/n', () => {
  // 5 equal rows of 200 each: top1Share = 200/1000 = 0.2; topKShare (k=3) = 600/1000 = 0.6;
  // hhi = 5 * (0.2)^2 = 0.2
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    q.push(ql(`2026-04-0${i + 1}T00:00:00.000Z`, 's1', 200));
  }
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 5);
  assert.equal(s.rowsZeroInput, 0);
  assert.equal(s.inputSum, 1000);
  assert.equal(s.top1Tokens, 200);
  assert.ok(Math.abs(s.top1Share - 0.2) < 1e-9);
  assert.equal(s.topKTokens, 600);
  assert.ok(Math.abs(s.topKShare - 0.6) < 1e-9);
  assert.ok(Math.abs(s.hhi - 0.2) < 1e-9);
  assert.equal(s.singleRow, false);
});

test('source-input-token-top-row-share: spiky source has top1Share near 1, hhi near 1', () => {
  // 9 tiny + 1 huge: total = 9*1 + 1000 = 1009; top1Share = 1000/1009 ~= 0.991
  const q: QueueLine[] = [];
  for (let i = 0; i < 9; i += 1) {
    q.push(ql(`2026-04-01T0${i}:00:00.000Z`, 'spiky', 1));
  }
  q.push(ql('2026-04-01T09:00:00.000Z', 'spiky', 1000));
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 10);
  assert.equal(s.top1Tokens, 1000);
  assert.ok(s.top1Share > 0.99);
  // topK (k=3) = 1000 + 1 + 1 = 1002 -> ~0.993
  assert.equal(s.topKTokens, 1002);
  assert.ok(s.topKShare > 0.99);
  // hhi dominated by (1000/1009)^2
  assert.ok(s.hhi > 0.98);
});

test('source-input-token-top-row-share: rowsConsidered <= K -> topKShare = 1', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    topK: 3,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 2);
  assert.equal(s.topKTokens, 300);
  assert.equal(s.topKShare, 1);
});

test('source-input-token-top-row-share: zero-input rows excluded from mass, counted in zeros', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 0),
    ql('2026-04-02T00:00:00.000Z', 's1', 0),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 200),
    ql('2026-04-05T00:00:00.000Z', 's1', 300),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 3);
  assert.equal(s.rowsZeroInput, 2);
  assert.equal(s.inputSum, 600);
  assert.equal(s.top1Tokens, 300);
  assert.ok(Math.abs(s.top1Share - 0.5) < 1e-9);
});

test('source-input-token-top-row-share: all-zero source dropped as droppedAllZero', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'silent', 0),
    ql('2026-04-02T00:00:00.000Z', 'silent', 0),
    ql('2026-04-03T00:00:00.000Z', 'noisy', 100),
    ql('2026-04-04T00:00:00.000Z', 'noisy', 200),
    ql('2026-04-05T00:00:00.000Z', 'noisy', 300),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedAllZero, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'noisy');
});

test('source-input-token-top-row-share: minRows gate suppresses sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'sparse', 100),
    ql('2026-04-02T00:00:00.000Z', 'sparse', 200),
    ql('2026-04-03T00:00:00.000Z', 'fat', 100),
    ql('2026-04-04T00:00:00.000Z', 'fat', 200),
    ql('2026-04-05T00:00:00.000Z', 'fat', 300),
    ql('2026-04-06T00:00:00.000Z', 'fat', 400),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'fat');
});

test('source-input-token-top-row-share: minTop1Share gate suppresses flat sources', () => {
  const q: QueueLine[] = [];
  // flat source, top1Share = 0.1
  for (let i = 0; i < 10; i += 1) {
    q.push(ql(`2026-04-01T0${i}:00:00.000Z`, 'flat', 100));
  }
  // spiky source, top1Share > 0.5
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-02T0${i}:00:00.000Z`, 'spiky', 10));
  }
  q.push(ql('2026-04-02T09:00:00.000Z', 'spiky', 1000));

  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    minTop1Share: 0.5,
  });
  assert.equal(r.droppedBelowMinTop1Share, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spiky');
});

test('source-input-token-top-row-share: minTopKShare gate', () => {
  const q: QueueLine[] = [];
  // 100 rows of 1 each: topKShare (k=3) = 3/100 = 0.03
  for (let i = 0; i < 100; i += 1) {
    q.push(
      ql(
        `2026-04-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
        'flat',
        1,
      ),
    );
  }
  // 5 rows: 100, 100, 100, 1, 1 -> topKShare = 300/302
  q.push(ql('2026-04-01T00:00:00.000Z', 'spiky', 100));
  q.push(ql('2026-04-01T01:00:00.000Z', 'spiky', 100));
  q.push(ql('2026-04-01T02:00:00.000Z', 'spiky', 100));
  q.push(ql('2026-04-01T03:00:00.000Z', 'spiky', 1));
  q.push(ql('2026-04-01T04:00:00.000Z', 'spiky', 1));
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    minTopKShare: 0.5,
  });
  assert.equal(r.droppedBelowMinTopKShare, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spiky');
});

test('source-input-token-top-row-share: top cap reports droppedBelowTopCap', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 5; i += 1) {
      q.push(
        ql(
          `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          s,
          (s.charCodeAt(0) - 96) * 100,
        ),
      );
    }
  }
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  assert.equal(r.sources[0]!.source, 'd');
  assert.equal(r.sources[1]!.source, 'c');
});

test('source-input-token-top-row-share: sort by top1 surfaces most-monopolised first', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(
      ql(`2026-04-01T${String(i).padStart(2, '0')}:00:00.000Z`, 'flat', 100),
    );
  }
  for (let i = 0; i < 9; i += 1) {
    q.push(
      ql(`2026-04-02T${String(i).padStart(2, '0')}:00:00.000Z`, 'spiky', 10),
    );
  }
  q.push(ql('2026-04-02T09:00:00.000Z', 'spiky', 100000));

  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'top1',
  });
  assert.equal(r.sources[0]!.source, 'spiky');
  assert.ok(r.sources[0]!.top1Share > r.sources[1]!.top1Share);
});

test('source-input-token-top-row-share: sort by hhi surfaces most-concentrated first', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    q.push(
      ql(`2026-04-01T${String(i).padStart(2, '0')}:00:00.000Z`, 'flat', 100),
    );
  }
  for (let i = 0; i < 9; i += 1) {
    q.push(
      ql(`2026-04-02T${String(i).padStart(2, '0')}:00:00.000Z`, 'spiky', 10),
    );
  }
  q.push(ql('2026-04-02T09:00:00.000Z', 'spiky', 100000));

  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'hhi',
  });
  assert.equal(r.sources[0]!.source, 'spiky');
});

test('source-input-token-top-row-share: sort by source is lex asc', () => {
  const q: QueueLine[] = [];
  for (const s of ['zebra', 'alpha', 'mango']) {
    for (let i = 0; i < 5; i += 1) {
      q.push(
        ql(
          `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          s,
          100,
        ),
      );
    }
  }
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('source-input-token-top-row-share: since/until window honored', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 300),
    ql('2026-04-04T00:00:00.000Z', 's1', 400),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-04T00:00:00.000Z',
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 2);
  assert.equal(s.inputSum, 500);
  assert.equal(s.top1Tokens, 300);
});

test('source-input-token-top-row-share: source filter & droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'keep', 100),
    ql('2026-04-02T00:00:00.000Z', 'keep', 200),
    ql('2026-04-03T00:00:00.000Z', 'keep', 300),
    ql('2026-04-04T00:00:00.000Z', 'drop', 400),
    ql('2026-04-05T00:00:00.000Z', 'drop', 500),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('source-input-token-top-row-share: bad hour_start counted in droppedInvalidHourStart', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00.000Z', 's1', 100), hour_start: 'garbage' },
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 300),
    ql('2026-04-04T00:00:00.000Z', 's1', 400),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsConsidered, 3);
  assert.equal(r.sources[0]!.inputSum, 900);
});

test('source-input-token-top-row-share: scale-invariance — 10x volume same shape -> identical concentrations', () => {
  const small: QueueLine[] = [];
  const big: QueueLine[] = [];
  const shape = [10, 20, 30, 40, 100];
  for (let i = 0; i < shape.length; i += 1) {
    small.push(
      ql(`2026-04-0${i + 1}T00:00:00.000Z`, 'small', shape[i]!),
    );
    big.push(ql(`2026-04-0${i + 1}T00:00:00.000Z`, 'big', shape[i]! * 10));
  }
  const rSmall = buildSourceInputTokenTopRowShare(small, {
    generatedAt: GEN,
    minRows: 1,
  });
  const rBig = buildSourceInputTokenTopRowShare(big, {
    generatedAt: GEN,
    minRows: 1,
  });
  const a = rSmall.sources[0]!;
  const b = rBig.sources[0]!;
  assert.ok(Math.abs(a.top1Share - b.top1Share) < 1e-12);
  assert.ok(Math.abs(a.topKShare - b.topKShare) < 1e-12);
  assert.ok(Math.abs(a.hhi - b.hhi) < 1e-12);
});

test('source-input-token-top-row-share: top-k=1 makes topKShare equal top1Share', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 10),
    ql('2026-04-02T00:00:00.000Z', 's1', 20),
    ql('2026-04-03T00:00:00.000Z', 's1', 30),
    ql('2026-04-04T00:00:00.000Z', 's1', 40),
  ];
  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    topK: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.top1Share, s.topKShare);
  assert.equal(s.top1Tokens, s.topKTokens);
});

test('source-input-token-top-row-share: rejects bad minHhi', () => {
  assert.throws(() => buildSourceInputTokenTopRowShare([], { minHhi: -0.01 }));
  assert.throws(() => buildSourceInputTokenTopRowShare([], { minHhi: 1.01 }));
  assert.throws(() =>
    buildSourceInputTokenTopRowShare([], {
      minHhi: Number.POSITIVE_INFINITY,
    }),
  );
});

test('source-input-token-top-row-share: minHhi gate suppresses flat sources', () => {
  const q: QueueLine[] = [];
  // 100 uniform rows of 100 -> hhi = 1/100 = 0.01
  for (let i = 0; i < 100; i += 1) {
    q.push(
      ql(
        `2026-04-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
        'flat',
        100,
      ),
    );
  }
  // 4 small rows + 1 monster -> hhi dominated by monster, > 0.5
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-15T0${i}:00:00.000Z`, 'spiky', 1));
  }
  q.push(ql('2026-04-15T05:00:00.000Z', 'spiky', 1000));

  const r = buildSourceInputTokenTopRowShare(q, {
    generatedAt: GEN,
    minRows: 1,
    minHhi: 0.5,
  });
  assert.equal(r.droppedBelowMinHhi, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spiky');
});

test('source-input-token-top-row-share: minHhi default 0 in report', () => {
  const r = buildSourceInputTokenTopRowShare([], { generatedAt: GEN });
  assert.equal(r.minHhi, 0);
  assert.equal(r.droppedBelowMinHhi, 0);
});
