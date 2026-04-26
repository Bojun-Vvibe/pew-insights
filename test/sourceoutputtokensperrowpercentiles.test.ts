import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceOutputTokensPerRowPercentiles } from '../src/sourceoutputtokensperrowpercentiles.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  output_tokens: number,
  input_tokens = 10,
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

const GEN = '2026-04-26T12:00:00.000Z';

test('source-output-tokens-per-row-percentiles: empty input -> empty report', () => {
  const r = buildSourceOutputTokensPerRowPercentiles([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalOutputTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 3);
  assert.equal(r.minP99, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tokens');
});

test('source-output-tokens-per-row-percentiles: rejects bad minRows', () => {
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { minRows: 0 }));
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { minRows: -1 }));
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { minRows: 1.5 }));
});

test('source-output-tokens-per-row-percentiles: rejects bad minP99', () => {
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { minP99: -1 }));
  assert.throws(() =>
    buildSourceOutputTokensPerRowPercentiles([], { minP99: Number.POSITIVE_INFINITY }),
  );
});

test('source-output-tokens-per-row-percentiles: rejects bad top', () => {
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { top: 0 }));
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { top: -1 }));
  assert.throws(() => buildSourceOutputTokensPerRowPercentiles([], { top: 1.5 }));
});

test('source-output-tokens-per-row-percentiles: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceOutputTokensPerRowPercentiles([], { sort: 'bogus' }),
  );
});

test('source-output-tokens-per-row-percentiles: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceOutputTokensPerRowPercentiles([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceOutputTokensPerRowPercentiles([], { until: 'also-bad' }),
  );
});

test('source-output-tokens-per-row-percentiles: constant source -> p50=p90=p99=mean=max, tail=1', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    q.push(ql(`2026-04-0${i + 1}T00:00:00.000Z`, 's1', 200));
  }
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 5);
  assert.equal(s.rowsZeroOutput, 0);
  assert.equal(s.outputSum, 1000);
  assert.equal(s.mean, 200);
  assert.equal(s.max, 200);
  assert.equal(s.p50, 200);
  assert.equal(s.p90, 200);
  assert.equal(s.p99, 200);
  assert.equal(s.p99OverP50, 1);
  assert.equal(s.singleSample, false);
});

test('source-output-tokens-per-row-percentiles: linear sequence type-7 percentiles', () => {
  // values 1..101 (n=101). type-7 p50 at rank 50 -> value 51, p90 at rank 90 -> value 91, p99 at rank 99 -> value 100
  const q: QueueLine[] = [];
  for (let v = 1; v <= 101; v += 1) {
    q.push(ql(`2026-04-01T00:${String(v % 60).padStart(2, '0')}:00.000Z`, 's1', v));
  }
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 101);
  assert.equal(s.p50, 51);
  assert.equal(s.p90, 91);
  // rank = 0.99 * 100 = 99 -> exact index -> value 100
  assert.equal(s.p99, 100);
  assert.equal(s.max, 101);
  assert.equal(s.p99OverP50, 100 / 51);
});

test('source-output-tokens-per-row-percentiles: zero-output rows not in percentile, but counted in zeros', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 0),
    ql('2026-04-02T00:00:00.000Z', 's1', 0),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 200),
    ql('2026-04-05T00:00:00.000Z', 's1', 300),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 3);
  assert.equal(s.rowsZeroOutput, 2);
  assert.equal(s.outputSum, 600);
  assert.equal(s.p50, 200);
  assert.equal(s.max, 300);
});

test('source-output-tokens-per-row-percentiles: all-zero source dropped as droppedAllZero', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'silent', 0),
    ql('2026-04-02T00:00:00.000Z', 'silent', 0),
    ql('2026-04-03T00:00:00.000Z', 'noisy', 100),
    ql('2026-04-04T00:00:00.000Z', 'noisy', 200),
    ql('2026-04-05T00:00:00.000Z', 'noisy', 300),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.droppedAllZero, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'noisy');
});

test('source-output-tokens-per-row-percentiles: minRows gate suppresses sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'sparse', 100),
    ql('2026-04-02T00:00:00.000Z', 'sparse', 200),
    ql('2026-04-03T00:00:00.000Z', 'fat', 100),
    ql('2026-04-04T00:00:00.000Z', 'fat', 200),
    ql('2026-04-05T00:00:00.000Z', 'fat', 300),
    ql('2026-04-06T00:00:00.000Z', 'fat', 400),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 3,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'fat');
});

test('source-output-tokens-per-row-percentiles: minP99 gate suppresses low-tail sources', () => {
  const q: QueueLine[] = [];
  // big source with p99 ~ 1000
  for (let i = 1; i <= 100; i += 1) {
    q.push(ql(`2026-04-01T${String(i % 24).padStart(2, '0')}:00:00.000Z`, 'big', i * 10));
  }
  // small source with max output_tokens = 50
  for (let i = 1; i <= 5; i += 1) {
    q.push(ql(`2026-04-02T0${i}:00:00.000Z`, 'tiny', 10 * i));
  }
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    minP99: 100,
  });
  assert.equal(r.droppedBelowMinP99, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('source-output-tokens-per-row-percentiles: top cap reports droppedBelowTopCap', () => {
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
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 2);
  // sort=tokens default -> heaviest first -> 'd' then 'c'
  assert.equal(r.sources[0]!.source, 'd');
  assert.equal(r.sources[1]!.source, 'c');
});

test('source-output-tokens-per-row-percentiles: sort by tail surfaces heaviest tail first', () => {
  const q: QueueLine[] = [];
  // flat source: same value every row -> tail = 1
  for (let i = 0; i < 10; i += 1) {
    q.push(
      ql(`2026-04-01T${String(i).padStart(2, '0')}:00:00.000Z`, 'flat', 100),
    );
  }
  // spiky: nine small + one huge
  for (let i = 0; i < 9; i += 1) {
    q.push(
      ql(`2026-04-02T${String(i).padStart(2, '0')}:00:00.000Z`, 'spiky', 10),
    );
  }
  q.push(ql('2026-04-02T09:00:00.000Z', 'spiky', 100000));

  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'tail',
  });
  assert.equal(r.sources[0]!.source, 'spiky');
  assert.ok(r.sources[0]!.p99OverP50 > r.sources[1]!.p99OverP50);
});

test('source-output-tokens-per-row-percentiles: sort by source is lex asc', () => {
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
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mango', 'zebra'],
  );
});

test('source-output-tokens-per-row-percentiles: since/until window honored', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 300),
    ql('2026-04-04T00:00:00.000Z', 's1', 400),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-04T00:00:00.000Z',
  });
  const s = r.sources[0]!;
  assert.equal(s.rowsConsidered, 2);
  assert.equal(s.outputSum, 500);
});

test('source-output-tokens-per-row-percentiles: source filter & droppedSourceFilter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'keep', 100),
    ql('2026-04-02T00:00:00.000Z', 'keep', 200),
    ql('2026-04-03T00:00:00.000Z', 'keep', 300),
    ql('2026-04-04T00:00:00.000Z', 'drop', 400),
    ql('2026-04-05T00:00:00.000Z', 'drop', 500),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('source-output-tokens-per-row-percentiles: invalid hour_start counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 300),
    ql('2026-04-04T00:00:00.000Z', 's1', 400),
  ];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.rowsConsidered, 3);
});

test('source-output-tokens-per-row-percentiles: singleSample flag', () => {
  const q: QueueLine[] = [ql('2026-04-01T00:00:00.000Z', 'lonely', 777)];
  const r = buildSourceOutputTokensPerRowPercentiles(q, {
    generatedAt: GEN,
    minRows: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.singleSample, true);
  assert.equal(s.p50, 777);
  assert.equal(s.p99, 777);
  assert.equal(s.p99OverP50, 1);
});
