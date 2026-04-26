import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceOutputTokenBenfordDeviation,
  benfordExpectedFreq,
  firstSignificantDigit,
} from '../src/sourceoutputtokenbenforddeviation.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, output: number, total = output): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: output,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- helpers ---------------------------------------------------------------

test('firstSignificantDigit: integer cases', () => {
  assert.equal(firstSignificantDigit(1), 1);
  assert.equal(firstSignificantDigit(9), 9);
  assert.equal(firstSignificantDigit(10), 1);
  assert.equal(firstSignificantDigit(42), 4);
  assert.equal(firstSignificantDigit(999), 9);
  assert.equal(firstSignificantDigit(1000), 1);
  assert.equal(firstSignificantDigit(7654321), 7);
});

test('firstSignificantDigit: fractional and edge cases', () => {
  assert.equal(firstSignificantDigit(0.5), 5);
  assert.equal(firstSignificantDigit(0.0034), 3);
  assert.equal(firstSignificantDigit(0), 0);
  assert.equal(firstSignificantDigit(-3), 0);
  assert.equal(firstSignificantDigit(NaN), 0);
  assert.equal(firstSignificantDigit(Infinity), 0);
});

test('benfordExpectedFreq: matches log10 closed form', () => {
  // d=1 -> log10(2) ~ 0.30103
  assert.ok(Math.abs(benfordExpectedFreq(1) - 0.30103) < 1e-4);
  // d=9 -> log10(10/9) ~ 0.04576
  assert.ok(Math.abs(benfordExpectedFreq(9) - 0.045757) < 1e-4);
  // sum over 1..9 = 1
  let s = 0;
  for (let d = 1; d <= 9; d++) s += benfordExpectedFreq(d);
  assert.ok(Math.abs(s - 1) < 1e-12);
});

test('benfordExpectedFreq: rejects out-of-range', () => {
  assert.throws(() => benfordExpectedFreq(0));
  assert.throws(() => benfordExpectedFreq(10));
  assert.throws(() => benfordExpectedFreq(1.5));
});

// ---- option validation -----------------------------------------------------

test('option validation: minRows', () => {
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { minRows: 8 }),
  );
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { minRows: 1.5 }),
  );
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { minRows: -1 }),
  );
});

test('option validation: top, maxMad, sort, since, until', () => {
  assert.throws(() => buildSourceOutputTokenBenfordDeviation([], { top: -1 }));
  assert.throws(() => buildSourceOutputTokenBenfordDeviation([], { top: 1.5 }));
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { maxMad: -0.1 }),
  );
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { sort: 'bogus' as never }),
  );
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { since: 'bad' }),
  );
  assert.throws(() =>
    buildSourceOutputTokenBenfordDeviation([], { until: 'nope' }),
  );
});

// ---- empty / sparse --------------------------------------------------------

test('empty input -> zero sources, zero rows', () => {
  const r = buildSourceOutputTokenBenfordDeviation([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRows, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minRows, 30);
});

test('sparse source dropped below minRows', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 9; i++) {
    q.push(ql(`2026-04-${String(i).padStart(2, '0')}T10:00:00.000Z`, 'a', i * 11));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 30,
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('non-positive output rows are dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 'a', 0),
    ql('2026-04-02T10:00:00.000Z', 'a', -5),
  ];
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
  });
  assert.equal(r.droppedNonPositiveOutput, 2);
  assert.equal(r.sources.length, 0);
});

// ---- core math: a perfectly Benford-shaped source -------------------------

test('a perfectly-Benford source has near-zero MAD and chi2', () => {
  // Build N=9000 rows with exact Benford counts: digit d gets round(P(d)*N) rows
  const N = 9000;
  const q: QueueLine[] = [];
  let day = 1;
  for (let d = 1; d <= 9; d++) {
    const k = Math.round(benfordExpectedFreq(d) * N);
    for (let i = 0; i < k; i++) {
      // pick value with leading digit d, varied magnitudes
      const mag = 1 + (i % 5); // 10^1..10^5
      const val = d * Math.pow(10, mag) + (i % 9);
      const dayStr = `2026-04-${String(((day++) % 28) + 1).padStart(2, '0')}`;
      q.push(ql(`${dayStr}T10:00:00.000Z`, 'b', val));
    }
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'b');
  // MAD should be tiny (rounding noise only)
  assert.ok(row.madPercent < 0.1, `madPercent ${row.madPercent} not < 0.1`);
  assert.ok(row.chi2 < 1, `chi2 ${row.chi2} not < 1`);
  assert.equal(row.modeDigit, 1);
  assert.ok(row.modeFreq > 0.29 && row.modeFreq < 0.31);
  // digits sum to N
  const obsSum = row.digits.reduce((s, d) => s + d.observed, 0);
  assert.equal(obsSum, N);
});

test('a strongly anti-Benford source (all leading-9) has large MAD and chi2', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 100; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 'c', 900 + i));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.modeDigit, 9);
  assert.ok(row.modeFreq > 0.99); // all leading 9
  // MAD% rule of thumb: MAD here is mean(|p - benford|) over 9 bins
  // ~ (8 * benford(d) + (1 - benford(9))) / 9 ~ 19.85 (in pct points)
  assert.ok(row.madPercent > 15, `madPercent ${row.madPercent} not > 15`);
  assert.ok(row.chi2 > 100, `chi2 ${row.chi2} not > 100`);
});

// ---- filters & sort --------------------------------------------------------

test('sort by mad puts highest-MAD source first; --top caps display', () => {
  const q: QueueLine[] = [];
  // Source 'allnines' -> all leading 9
  for (let i = 0; i < 50; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 'allnines', 900 + i));
  }
  // Source 'mixed' -> spread across digits 1..9 reasonably (10 each)
  for (let d = 1; d <= 9; d++) {
    for (let i = 0; i < 10; i++) {
      q.push(
        ql(
          `2026-04-${String(((d * 3 + i) % 28) + 1).padStart(2, '0')}T11:00:00.000Z`,
          'mixed',
          d * 100 + i,
        ),
      );
    }
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    sort: 'mad',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'allnines');
  assert.ok(r.sources[0]!.madPercent > r.sources[1]!.madPercent);

  const r2 = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    sort: 'mad',
    top: 1,
  });
  assert.equal(r2.sources.length, 1);
  assert.equal(r2.droppedTopSources, 1);
  assert.equal(r2.sources[0]!.source, 'allnines');
});

test('maxMad filter hides high-MAD sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i++) {
    q.push(
      ql(
        `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        'noisy',
        900 + i,
      ),
    );
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    maxMad: 5,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAboveMaxMad, 1);
});

test('source filter restricts to one source', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 12; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 'keep', 100 + i * 7));
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T11:00:00.000Z`, 'drop', 100 + i * 7));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 12);
});

test('window since/until filter on hour_start', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) {
    q.push(ql(`2026-04-${String(i).padStart(2, '0')}T10:00:00.000Z`, 'a', i * 13));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    since: '2026-04-05T00:00:00.000Z',
    until: '2026-04-15T00:00:00.000Z',
  });
  // 5..14 inclusive -> 10 rows
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nRows, 10);
  assert.equal(r.sources[0]!.firstDay, '2026-04-05');
  assert.equal(r.sources[0]!.lastDay, '2026-04-14');
});

test('digits array is digit-asc with valid frequencies', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(
      ql(
        `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        's',
        (i + 1) * 17,
      ),
    );
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
  });
  const row = r.sources[0]!;
  assert.equal(row.digits.length, 9);
  for (let i = 0; i < 9; i++) {
    assert.equal(row.digits[i]!.digit, i + 1);
    assert.ok(row.digits[i]!.observedFreq >= 0);
    assert.ok(row.digits[i]!.observedFreq <= 1);
    assert.ok(row.digits[i]!.expectedFreq > 0);
  }
  const sumObs = row.digits.reduce((s, d) => s + d.observed, 0);
  assert.equal(sumObs, row.nRows);
});

test('determinism: identical inputs produce identical reports', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 50; i++) {
    q.push(
      ql(
        `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
        'x',
        (i + 1) * 31,
      ),
    );
  }
  const a = buildSourceOutputTokenBenfordDeviation(q, { generatedAt: GEN, minRows: 9 });
  const b = buildSourceOutputTokenBenfordDeviation(q, { generatedAt: GEN, minRows: 9 });
  assert.deepEqual(a, b);
});

test('scale-invariance: multiplying every output by a constant preserves the digit fit', () => {
  const q1: QueueLine[] = [];
  const q2: QueueLine[] = [];
  for (let i = 0; i < 60; i++) {
    const v = (i + 1) * 23;
    const day = `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`;
    q1.push(ql(day, 's', v));
    q2.push(ql(day, 's', v * 1000));
  }
  const r1 = buildSourceOutputTokenBenfordDeviation(q1, { generatedAt: GEN, minRows: 9 });
  const r2 = buildSourceOutputTokenBenfordDeviation(q2, { generatedAt: GEN, minRows: 9 });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  // chi2 and madPercent depend only on leading digit; should be equal
  assert.ok(Math.abs(r1.sources[0]!.chi2 - r2.sources[0]!.chi2) < 1e-9);
  assert.ok(Math.abs(r1.sources[0]!.madPercent - r2.sources[0]!.madPercent) < 1e-12);
  for (let i = 0; i < 9; i++) {
    assert.equal(r1.sources[0]!.digits[i]!.observed, r2.sources[0]!.digits[i]!.observed);
  }
});

// ---- requireD1Mode refinement (v0.6.31) ------------------------------------

test('requireD1Mode hides sources whose mode digit is not 1', () => {
  const q: QueueLine[] = [];
  // d1-dominant: lots of leading-1 (decreasing geometric-ish)
  for (let i = 0; i < 30; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 'd1src', 1000 + i));
  }
  // d9-dominant: every value starts with 9
  for (let i = 0; i < 30; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T11:00:00.000Z`, 'd9src', 9000 + i));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    requireD1Mode: true,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'd1src');
  assert.equal(r.sources[0]!.modeDigit, 1);
  assert.equal(r.droppedNonD1Mode, 1);
  assert.equal(r.requireD1Mode, true);
});

test('requireD1Mode default false leaves all sources visible', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 15; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`, 'd9src', 9000 + i));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedNonD1Mode, 0);
  assert.equal(r.requireD1Mode, false);
});

test('requireD1Mode is applied AFTER maxMad (filter order)', () => {
  const q: QueueLine[] = [];
  // d9-dominant high MAD source -> would be cut by maxMad first
  for (let i = 0; i < 30; i++) {
    q.push(ql(`2026-04-${String((i % 28) + 1).padStart(2, '0')}T11:00:00.000Z`, 'd9src', 9000 + i));
  }
  const r = buildSourceOutputTokenBenfordDeviation(q, {
    generatedAt: GEN,
    minRows: 9,
    maxMad: 5,
    requireD1Mode: true,
  });
  assert.equal(r.sources.length, 0);
  // counted in maxMad bucket, NOT in non-d1-mode (filter order: maxMad then requireD1Mode)
  assert.equal(r.droppedAboveMaxMad, 1);
  assert.equal(r.droppedNonD1Mode, 0);
});
