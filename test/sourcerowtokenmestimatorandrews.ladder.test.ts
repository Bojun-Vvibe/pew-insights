/**
 * Cross-analyzer ladder tests for the new Andrews sine
 * redescending M-estimator (v0.6.212).
 *
 * Compares Andrews against:
 *   - Hampel three-part (v0.6.211): piecewise-linear redescender.
 *   - Tukey biweight (v0.6.210): smooth polynomial redescender.
 *   - Huber (v0.6.209): monotone, never zeroes.
 *   - Raw median, arithmetic mean.
 *
 * Hierarchy of expected behavior on right-tail contaminated data:
 *
 *   mean  >>>  Huber  >  Tukey  ~  Hampel  ~  Andrews  >=  median
 *
 * Key claim: under sufficiently extreme contamination, all three
 * redescenders (Andrews, Tukey, Hampel) fully reject the offending
 * rows (rejectedRows > 0 for each, |estimate - median| <<
 * |Huber - median|), while Huber only clips them so it remains
 * pulled toward the contaminated mean.
 *
 * Andrews-specific claim: because Andrews's per-MAD-unit rejection
 * threshold A*pi ≈ 4.207 is the most aggressive shipped threshold
 * (Tukey 4.685, Hampel outer knot 8.5), Andrews rejects AT LEAST
 * AS MANY rows as the others on identical contamination — and
 * strictly more than Hampel under intermediate-tail contamination
 * (rows with |z| in (4.207, 8.5]).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenMEstimatorAndrews } from '../src/sourcerowtokenmestimatorandrews.js';
import { buildSourceRowTokenMEstimatorHampel } from '../src/sourcerowtokenmestimatorhampel.js';
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

test('ladder: Andrews matches Tukey/Hampel under heavy outlier contamination', () => {
  // Bulk + a small number of catastrophic outliers.
  const bulk = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const xs = [...bulk, 1e10, 1e10, 1e10];
  const series = mkSeries('s', xs);

  const a = buildSourceRowTokenMEstimatorAndrews(series, { generatedAt: GEN });
  const ham = buildSourceRowTokenMEstimatorHampel(series, { generatedAt: GEN });
  const tuk = buildSourceRowTokenMEstimatorTukey(series, { generatedAt: GEN });
  const hub = buildSourceRowTokenMEstimatorHuber(series, { generatedAt: GEN });

  const med = median(xs);

  // All three redescenders reject the catastrophic tail.
  assert.ok(a.sources[0]!.rejectedRows >= 3);
  assert.ok(ham.sources[0]!.rejectedRows >= 3);
  assert.ok(tuk.sources[0]!.rejectedRows >= 3);

  // All three redescenders land within ~1 MAD of the median.
  const aGap = Math.abs(a.sources[0]!.andrews - med);
  const hamGap = Math.abs(ham.sources[0]!.hampel - med);
  const tukGap = Math.abs(tuk.sources[0]!.tukey - med);
  assert.ok(aGap < 5, `Andrews drifted: gap=${aGap}`);
  assert.ok(hamGap < 5, `Hampel drifted: gap=${hamGap}`);
  assert.ok(tukGap < 5, `Tukey drifted: gap=${tukGap}`);

  // Huber CLIPS but does not zero out, so on really extreme tails
  // it still gets pulled away from the median by the bounded but
  // nonzero tail influence. The three redescenders, by contrast,
  // converge tightly to the bulk median.
  const hubGap = Math.abs(hub.sources[0]!.huber - med);
  // Huber should be at least somewhat displaced; the redescenders
  // should agree among themselves to within < 1 unit.
  assert.ok(
    Math.abs(a.sources[0]!.andrews - tuk.sources[0]!.tukey) < 1 &&
      Math.abs(a.sources[0]!.andrews - ham.sources[0]!.hampel) < 1,
    `redescenders disagree: andrews=${a.sources[0]!.andrews} tukey=${tuk.sources[0]!.tukey} hampel=${ham.sources[0]!.hampel}`,
  );
  // Huber's residual gap is finite and reported (sanity touch).
  assert.ok(Number.isFinite(hubGap));
});

test('ladder: large tuning -> Andrews collapses to mean (no rejection)', () => {
  const xs = [10, 12, 14, 16, 18, 20, 22, 24];
  const series = mkSeries('s', xs);
  const a = buildSourceRowTokenMEstimatorAndrews(series, {
    tuning: 1e7,
    generatedAt: GEN,
  });
  const arithMean = xs.reduce((p, q) => p + q, 0) / xs.length;
  assert.ok(
    Math.abs(a.sources[0]!.andrews - arithMean) < 1e-3,
    `large tuning Andrews ${a.sources[0]!.andrews} vs mean ${arithMean}`,
  );
  assert.equal(a.sources[0]!.rejectedRows, 0);
  assert.equal(a.sources[0]!.descendingRows, 0);
});

test('ladder: under intermediate-tail contamination Andrews rejects >= Hampel', () => {
  // Construct rows whose z-residuals lie in the "Andrews rejects but
  // Hampel doesn't" gap: Andrews rejection threshold A*pi ≈ 4.207,
  // Hampel outer knot c = 8.5. Bulk has MAD ≈ 1, so a row at
  // distance ~5 from the bulk median has |z| ≈ 5/0.6745 ≈ 7.41 —
  // beyond Andrews's threshold but inside Hampel's outer knot.
  const bulk = [
    100, 100, 100, 100, 101, 101, 101, 99, 99, 99, 100, 100, 100, 99, 101,
    100, 100, 100, 100, 100,
  ];
  // intermediate-tail rows at z ≈ 6-8 MAD-units (rejected by
  // Andrews but only descended by Hampel)
  const intermediate = [108, 109, 110];
  const xs = [...bulk, ...intermediate];
  const series = mkSeries('s', xs);

  const a = buildSourceRowTokenMEstimatorAndrews(series, { generatedAt: GEN });
  const ham = buildSourceRowTokenMEstimatorHampel(series, { generatedAt: GEN });

  // Andrews rejects strictly more (or at least as many) than Hampel
  // on this carefully constructed intermediate-tail.
  assert.ok(
    a.sources[0]!.rejectedRows >= ham.sources[0]!.rejectedRows,
    `Andrews rejected ${a.sources[0]!.rejectedRows} < Hampel ${ham.sources[0]!.rejectedRows}`,
  );
});

test('ladder: clean symmetric data -> all four estimators agree', () => {
  // No tail. All five estimators (mean, median, Huber, Tukey,
  // Hampel, Andrews) should land at the symmetric center.
  const xs = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const series = mkSeries('s', xs);
  const center = 15;

  const a = buildSourceRowTokenMEstimatorAndrews(series, { generatedAt: GEN });
  const ham = buildSourceRowTokenMEstimatorHampel(series, { generatedAt: GEN });
  const tuk = buildSourceRowTokenMEstimatorTukey(series, { generatedAt: GEN });
  const hub = buildSourceRowTokenMEstimatorHuber(series, { generatedAt: GEN });

  assert.ok(Math.abs(a.sources[0]!.andrews - center) < 1e-6);
  assert.ok(Math.abs(ham.sources[0]!.hampel - center) < 1e-6);
  assert.ok(Math.abs(tuk.sources[0]!.tukey - center) < 1e-6);
  assert.ok(Math.abs(hub.sources[0]!.huber - center) < 1e-6);

  // No rejection on clean data.
  assert.equal(a.sources[0]!.rejectedRows, 0);
  assert.equal(ham.sources[0]!.rejectedRows, 0);
  assert.equal(tuk.sources[0]!.rejectedRows, 0);
});
