import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLempelZiv } from '../src/sourcerowtokenlempelziv.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('lempel-ziv: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenLempelZiv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.sort, 'lznorm-asc');
  assert.equal(r.generatedAt, GEN);
});

test('lempel-ziv: constant series -> droppedConstantBitstream', () => {
  // All identical values -> all bits 0 (strict > median is false).
  const data = series(new Array(20).fill(7));
  const r = buildSourceRowTokenLempelZiv(data, { generatedAt: GEN });
  assert.equal(r.droppedConstantBitstream, 1);
  assert.equal(r.sources.length, 0);
});

test('lempel-ziv: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4]);
  const r = buildSourceRowTokenLempelZiv(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('lempel-ziv: alternating 0/1 series -> bounded lz', () => {
  // values 0,10,0,10,...  -> bits 0,1,0,1,...  (strict > median = 5)
  const N = 40;
  const vals: number[] = [];
  for (let i = 0; i < N; i++) vals.push(i % 2 === 0 ? 0 : 10);
  const r = buildSourceRowTokenLempelZiv(series(vals), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, N);
  assert.equal(row.onesCount, 20);
  assert.equal(row.zerosCount, 20);
  // Periodic 01 grows like O(sqrt(N)) factors. For N=40 we expect
  // c(N) in the single digits, well below the i.i.d. ~ N/log2 N ~ 7.5 baseline.
  assert.ok(row.lz <= 12, `expected bounded lz for periodic series, got ${row.lz}`);
  assert.ok(
    row.lz < N / Math.log2(N) * 1.5,
    `lz (${row.lz}) should be well below i.i.d. baseline`,
  );
});

test('lempel-ziv: monotone ramp -> bits 0...01...1, very low lz', () => {
  const N = 30;
  const vals: number[] = [];
  for (let i = 0; i < N; i++) vals.push(i);
  const r = buildSourceRowTokenLempelZiv(series(vals), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Bits are 0...0 then 1...1. LZ76 parses left-to-right; when it
  // hits the first 1 it has to grow the run. Empirically c(N) <= 10
  // for N=30. The point is it stays bounded as N grows.
  assert.ok(row.lz <= 10, `monotone ramp should have low lz, got ${row.lz}`);
});

test('lempel-ziv: known small example matches hand-computed LZ76', () => {
  // bits = 0001101001000101  (length 16). Hand-computed LZ76:
  //   0 | 00 | 1 | 10 | 100 | 1000 | 101  -> 7 factors.
  // Build values whose strict-greater-than-median gives those bits.
  // Use values 0 for bit=0 and 10 for bit=1, then median is below 10.
  const bitStr = '0001101001000101';
  const vals = bitStr.split('').map((c) => (c === '1' ? 10 : 0));
  const r = buildSourceRowTokenLempelZiv(series(vals), { generatedAt: GEN, minRows: 4 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.lz, 7, `expected hand-computed c(N)=7, got ${row.lz}`);
});

test('lempel-ziv: more random-looking series has higher lzNorm than periodic', () => {
  const N = 60;
  // Periodic
  const periodic: number[] = [];
  for (let i = 0; i < N; i++) periodic.push(i % 2 === 0 ? 1 : 9);
  // Pseudo-random (deterministic LCG)
  let seed = 12345;
  const random: number[] = [];
  for (let i = 0; i < N; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    random.push(seed % 100);
  }
  const rPeriodic = buildSourceRowTokenLempelZiv(series(periodic, 'a'), {
    generatedAt: GEN,
  });
  const rRandom = buildSourceRowTokenLempelZiv(series(random, 'b'), {
    generatedAt: GEN,
  });
  assert.equal(rPeriodic.sources.length, 1);
  assert.equal(rRandom.sources.length, 1);
  assert.ok(
    rRandom.sources[0]!.lzNorm > rPeriodic.sources[0]!.lzNorm,
    `expected pseudo-random lzNorm (${rRandom.sources[0]!.lzNorm}) > periodic lzNorm (${rPeriodic.sources[0]!.lzNorm})`,
  );
});

test('lempel-ziv: --since / --until trim rows', () => {
  const data = series(new Array(40).fill(0).map((_, i) => i));
  const r = buildSourceRowTokenLempelZiv(data, {
    generatedAt: GEN,
    since: '2026-04-25T00:30:00Z',
    until: '2026-04-25T01:00:00Z',
  });
  // Rows with i in [30, 60) -> 30 rows kept (or less depending on exact times)
  assert.ok(r.totalRowsKept > 0 && r.totalRowsKept < 40);
});

test('lempel-ziv: source filter restricts groups', () => {
  const a = series(new Array(20).fill(0).map((_, i) => i % 2), 'a');
  const b = series(new Array(20).fill(0).map((_, i) => i % 3), 'b');
  const r = buildSourceRowTokenLempelZiv([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('lempel-ziv: top cap surfaces droppedBelowTopCap', () => {
  const all: QueueLine[] = [];
  for (let s = 0; s < 5; s++) {
    const vals = new Array(20).fill(0).map((_, i) => (i + s) % 2 === 0 ? 0 : 10);
    all.push(...series(vals, `src${s}`));
  }
  const r = buildSourceRowTokenLempelZiv(all, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('lempel-ziv: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenLempelZiv([], {
        // @ts-expect-error testing invalid input
        sort: 'nope',
      }),
    /sort must be one of/,
  );
});

test('lempel-ziv: invalid minRows throws', () => {
  assert.throws(
    () => buildSourceRowTokenLempelZiv([], { minRows: 1 }),
    /minRows must be an integer >= 2/,
  );
});

test('lempel-ziv: report serialises cleanly through JSON', () => {
  const data = series(new Array(20).fill(0).map((_, i) => i % 2 === 0 ? 0 : 5));
  const r = buildSourceRowTokenLempelZiv(data, { generatedAt: GEN });
  const round = JSON.parse(JSON.stringify(r));
  assert.equal(round.generatedAt, GEN);
  assert.equal(round.sources.length, r.sources.length);
  for (const s of round.sources) {
    assert.ok(Number.isFinite(s.lz));
    assert.ok(Number.isFinite(s.lzNorm));
    assert.ok(Number.isFinite(s.median));
  }
});
