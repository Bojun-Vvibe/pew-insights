/**
 * Cross-analyzer ladder tests for the new Welsch (Leclerc)
 * Gaussian-kernel redescending M-estimator (v0.6.213).
 *
 * Compares Welsch against:
 *   - Andrews sine (v0.6.212): transcendental redescender, COMPACT support.
 *   - Hampel three-part (v0.6.211): piecewise-linear redescender.
 *   - Tukey biweight (v0.6.210): smooth polynomial redescender.
 *   - Huber (v0.6.209): monotone, never zeroes.
 *   - Raw median, arithmetic mean.
 *
 * Hierarchy of expected behavior on right-tail contaminated data:
 *
 *   mean  >>>  Huber  >  Tukey  ~  Hampel  ~  Andrews  ~  Welsch  >=  median
 *
 * Welsch-specific claim: because Welsch has INFINITE SUPPORT (weight
 * never exactly zero), it differs structurally from Tukey/Hampel/
 * Andrews — every row keeps a strictly positive weight, so
 * `negligibleRows` is a soft bucket (w < 0.01) rather than a hard
 * rejection bucket. Under heavy tail contamination, all four
 * redescenders nevertheless produce estimates close to the bulk
 * median, far from the contaminated mean.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMEstimatorWelsch } from '../src/sourcerowtokenmestimatorwelsch.js';
import { buildSourceRowTokenMEstimatorAndrews } from '../src/sourcerowtokenmestimatorandrews.js';
import { buildSourceRowTokenMEstimatorTukey } from '../src/sourcerowtokenmestimatortukey.js';
import { buildSourceRowTokenMEstimatorHuber } from '../src/sourcerowtokenmestimatorhuber.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-29T12:00:00.000Z';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  if (n % 2 === 1) return s[(n - 1) / 2]!;
  return (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

test('ladder: clean symmetric data -> all four redescenders ~ Huber ~ mean ~ median', () => {
  const xs = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  const series = mkSeries('s', xs);
  const opts = { generatedAt: GEN } as const;
  const w = buildSourceRowTokenMEstimatorWelsch(series, opts).sources[0]!;
  const a = buildSourceRowTokenMEstimatorAndrews(series, opts).sources[0]!;
  const t = buildSourceRowTokenMEstimatorTukey(series, opts).sources[0]!;
  const h = buildSourceRowTokenMEstimatorHuber(series, opts).sources[0]!;
  const med = median(xs);
  const mu = mean(xs);
  for (const v of [w.welsch, a.andrews, t.tukey, h.huber]) {
    assert.ok(Math.abs(v - med) < 0.5, `clean: ${v} far from median ${med}`);
    assert.ok(Math.abs(v - mu) < 0.5, `clean: ${v} far from mean ${mu}`);
  }
});

test('ladder: heavy right-tail contamination -> all redescenders close to bulk median; Huber pulled toward mean', () => {
  const bulk = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
  const xs = [...bulk, 1e8, 1e8, 1e8, 1e8, 1e8];
  const series = mkSeries('s', xs);
  const opts = { generatedAt: GEN } as const;
  const w = buildSourceRowTokenMEstimatorWelsch(series, opts).sources[0]!;
  const a = buildSourceRowTokenMEstimatorAndrews(series, opts).sources[0]!;
  const t = buildSourceRowTokenMEstimatorTukey(series, opts).sources[0]!;
  const h = buildSourceRowTokenMEstimatorHuber(series, opts).sources[0]!;
  const bulkMed = median(bulk);
  // All three smooth redescenders close to bulk median.
  for (const [name, v] of [
    ['welsch', w.welsch],
    ['andrews', a.andrews],
    ['tukey', t.tukey],
  ] as const) {
    assert.ok(
      Math.abs(v - bulkMed) < 50,
      `${name} ${v} drifted >50 from bulk median ${bulkMed}`,
    );
  }
  // Huber is pulled MUCH farther toward the contaminated mean.
  assert.ok(
    Math.abs(h.huber - bulkMed) > Math.abs(w.welsch - bulkMed),
    `huber ${h.huber} should be farther from bulk median than welsch ${w.welsch}`,
  );
});

test('ladder: Welsch infinite support — extreme outliers are negligible NOT rejected', () => {
  // Welsch unique property: even rows in negligibleRows still carry a
  // STRICTLY POSITIVE (just very small) weight in the IRLS sum.
  // Andrews/Tukey would hard-reject these; Welsch only down-weights.
  const bulk = [100, 110, 120, 130, 140];
  const xs = [...bulk, 1e8, 1e9];
  const series = mkSeries('s', xs);
  const opts = { generatedAt: GEN } as const;
  const w = buildSourceRowTokenMEstimatorWelsch(series, opts).sources[0]!;
  const a = buildSourceRowTokenMEstimatorAndrews(series, opts).sources[0]!;
  // Welsch lumps the two giant tail rows into negligibleRows.
  assert.ok(w.negligibleRows >= 2, `welsch negligible ${w.negligibleRows} < 2`);
  // Andrews REJECTS them (rejectedRows reports the same count for the
  // same data structurally).
  assert.ok(a.rejectedRows >= 2, `andrews rejected ${a.rejectedRows} < 2`);
  // Both arrive at similar location estimates despite the structural
  // difference.
  assert.ok(
    Math.abs(w.welsch - a.andrews) < 5,
    `welsch ${w.welsch} vs andrews ${a.andrews} too far apart`,
  );
});

test('ladder: Welsch core/descend/negligible buckets are well-formed across a graded contamination ladder', () => {
  const bulk = Array.from({ length: 20 }, (_, i) => 100 + i);
  for (const tail of [[], [1e6], [1e6, 2e6], [1e6, 2e6, 5e6, 1e7]]) {
    const xs = [...bulk, ...tail];
    const series = mkSeries('s', xs);
    const w = buildSourceRowTokenMEstimatorWelsch(series, {
      generatedAt: GEN,
    }).sources[0]!;
    assert.equal(
      w.coreRows + w.descendingRows + w.negligibleRows,
      w.rowsKept,
      `bucket sum != rowsKept for tail ${tail.length}`,
    );
    // Tail rows always end up negligible at this scale.
    assert.ok(
      w.negligibleRows >= tail.length,
      `tail=${tail.length} negligible=${w.negligibleRows}`,
    );
  }
});
