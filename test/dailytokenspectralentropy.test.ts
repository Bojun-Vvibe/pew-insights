import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenSpectralEntropy,
  periodogramOneSided,
  normalisedSpectralEntropy,
} from '../src/dailytokenspectralentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-02T12:00:00.000Z';

// ---- periodogramOneSided primitive ----------------------------------

test('periodogramOneSided: rejects non-finite values', () => {
  assert.throws(() => periodogramOneSided([1, NaN, 3, 4, 5, 6, 7, 8]));
  assert.throws(() => periodogramOneSided([1, Infinity, 3]));
});

test('periodogramOneSided: n < 2 -> empty', () => {
  assert.deepEqual(periodogramOneSided([]), []);
  assert.deepEqual(periodogramOneSided([5]), []);
});

test('periodogramOneSided: constant series -> all-zero (mean-centring zeroes input)', () => {
  const p = periodogramOneSided([7, 7, 7, 7, 7, 7, 7, 7]);
  assert.equal(p.length, 4);
  for (const v of p) assert.equal(v, 0);
});

test('periodogramOneSided: pure cosine concentrates power at the matching bin', () => {
  // x[t] = cos(2 pi * 2 * t / 16), t = 0..15. Pure tone at bin k=2.
  const n = 16;
  const xs: number[] = [];
  for (let t = 0; t < n; t += 1) xs.push(Math.cos((2 * Math.PI * 2 * t) / n));
  const p = periodogramOneSided(xs);
  // K = 8. Total power ~ N/2 (Parseval for unit-amplitude cosine).
  // Bin index in returned 1-indexed array: f=2 maps to p[1].
  let total = 0;
  for (const v of p) total += v;
  // Bin 2 should contain ~ 100% of the total power.
  const share = p[1]! / total;
  assert.ok(share > 0.99, `expected >99% share at bin 2, got ${share}`);
});

// ---- normalisedSpectralEntropy primitive ----------------------------

test('normalisedSpectralEntropy: rejects negative / non-finite power', () => {
  assert.throws(() => normalisedSpectralEntropy([1, -1, 3]));
  assert.throws(() => normalisedSpectralEntropy([1, NaN, 3]));
});

test('normalisedSpectralEntropy: all-zero power -> flat=true, entropy=0', () => {
  const r = normalisedSpectralEntropy([0, 0, 0, 0]);
  assert.equal(r.flat, true);
  assert.equal(r.entropyNorm, 0);
  assert.equal(r.peakBin, 0);
  assert.equal(r.peakShare, 0);
});

test('normalisedSpectralEntropy: K < 2 -> flat=true', () => {
  const r = normalisedSpectralEntropy([1]);
  assert.equal(r.flat, true);
});

test('normalisedSpectralEntropy: uniform power -> H_norm = 1 exactly', () => {
  const r = normalisedSpectralEntropy([3, 3, 3, 3, 3, 3, 3, 3]);
  assert.equal(r.flat, false);
  assert.ok(Math.abs(r.entropyNorm - 1) < 1e-12, `expected H_norm=1, got ${r.entropyNorm}`);
});

test('normalisedSpectralEntropy: spike-only -> H_norm = 0 exactly', () => {
  const r = normalisedSpectralEntropy([0, 0, 5, 0, 0, 0]);
  assert.equal(r.flat, false);
  assert.equal(r.entropyNorm, 0);
  assert.equal(r.peakBin, 3);
  assert.equal(r.peakShare, 1);
});

test('normalisedSpectralEntropy: stays in [0, 1]', () => {
  const r = normalisedSpectralEntropy([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.entropyNorm >= 0 && r.entropyNorm <= 1);
});

// ---- buildDailyTokenSpectralEntropy builder -------------------------

test('build: rejects bad opts', () => {
  assert.throws(() => buildDailyTokenSpectralEntropy([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenSpectralEntropy([], { minTenureDays: 3 }));
  assert.throws(() => buildDailyTokenSpectralEntropy([], { top: -1 }));
  assert.throws(() => buildDailyTokenSpectralEntropy([], { maxEntropy: 1.5 }));
  assert.throws(() =>
    buildDailyTokenSpectralEntropy([], { sort: 'nope' as never }),
  );
  assert.throws(() => buildDailyTokenSpectralEntropy([], { since: 'bad' }));
  assert.throws(() => buildDailyTokenSpectralEntropy([], { until: 'bad' }));
});

test('build: empty queue', () => {
  const r = buildDailyTokenSpectralEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, GEN);
});

test('build: drops bad hour_start, non-positive tokens', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ql('2026-04-01T01:00:00Z', 'a', 0),
    ql('2026-04-01T02:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('build: sparse source dropped via min-tokens', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(
      ql(`2026-04-${dd}T00:00:00Z`, 'small', 10),
      ql(`2026-04-${dd}T01:00:00Z`, 'big', 5000),
    );
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1000,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: tenure below floor dropped', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 7; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'short', 10000));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: weekly cosine cycle gives low spectral entropy with peakBin matching N/7', () => {
  // 28 days = 4 weeks of a clean weekly cosine.
  const lines: QueueLine[] = [];
  const N = 28;
  for (let d = 0; d < N; d += 1) {
    const ms = Date.parse('2026-04-01T00:00:00Z') + d * 86_400_000;
    const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
    // Offset by 1000 to keep total_tokens > 0 (queue line drop rule).
    const v = Math.round(1000 + 500 * Math.cos((2 * Math.PI * d) / 7));
    lines.push(ql(iso, 'weekly', v));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.flat, false);
  assert.equal(row.nTenureDays, 28);
  assert.equal(row.nFreqBins, 14);
  // The cosine has period 7 days on N=28 -> bin k* = N/7 = 4.
  assert.equal(row.peakBin, 4);
  // Single-tone peak should carry essentially all the mass -> H_norm low.
  assert.ok(row.peakShare > 0.99, `peakShare expected >0.99, got ${row.peakShare}`);
  assert.ok(row.entropyNorm < 0.05, `H_norm expected <0.05, got ${row.entropyNorm}`);
});

test('build: linear ramp gives non-trivial low-frequency mass', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 20; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'ramp', 1000 + d * 100));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.flat, false);
  // A linear ramp's spectrum is dominated by bin 1 (lowest frequency).
  assert.equal(row.peakBin, 1);
  assert.ok(row.entropyNorm > 0 && row.entropyNorm < 1);
});

test('build: degenerate flat source surfaces with H_norm=0 / flat=true', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'flat', 5000));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.flat, true);
  assert.equal(r.sources[0]!.entropyNorm, 0);
  assert.equal(r.sources[0]!.peakBin, 0);
});

test('build: source filter', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 14; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'A', 1000 + d));
    lines.push(ql(`2026-04-${dd}T01:00:00Z`, 'B', 2000 + d));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    source: 'A',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'A');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: window since/until', () => {
  const lines: QueueLine[] = [];
  for (let d = 1; d <= 30; d += 1) {
    const dd = d.toString().padStart(2, '0');
    lines.push(ql(`2026-04-${dd}T00:00:00Z`, 'A', 1000 + d));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 4,
    since: '2026-04-05T00:00:00Z',
    until: '2026-04-20T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 15);
  assert.equal(r.sources[0]!.nTenureDays, 15);
});

test('build: top cap surfaces droppedTopSources', () => {
  const lines: QueueLine[] = [];
  for (const s of ['A', 'B', 'C']) {
    for (let d = 1; d <= 14; d += 1) {
      const dd = d.toString().padStart(2, '0');
      lines.push(ql(`2026-04-${dd}T00:00:00Z`, s, 1000 + d));
    }
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('build: maxEntropy filter drops whitest rows', () => {
  const lines: QueueLine[] = [];
  // CONCENTRATED: weekly cosine -> low entropy.
  for (let d = 0; d < 21; d += 1) {
    const ms = Date.parse('2026-04-01T00:00:00Z') + d * 86_400_000;
    const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
    const v = Math.round(1000 + 500 * Math.cos((2 * Math.PI * d) / 7));
    lines.push(ql(iso, 'CONCENTRATED', v));
  }
  // WHITE-ish: a deterministic series that produces broader spectrum.
  // Use a mixed signal: cos(2pi t/7) + cos(2pi t/3) + cos(2pi t/5) plus
  // a constant offset to keep tokens > 0. Spreads mass across multiple
  // bins and pushes H_norm well above 0.5.
  for (let d = 0; d < 21; d += 1) {
    const ms = Date.parse('2026-04-01T00:00:00Z') + d * 86_400_000;
    const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
    const v = Math.round(
      2000 +
        300 * Math.cos((2 * Math.PI * d) / 7) +
        300 * Math.cos((2 * Math.PI * d) / 3) +
        300 * Math.cos((2 * Math.PI * d) / 5),
    );
    lines.push(ql(iso, 'MIXED', v));
  }
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    maxEntropy: 0.3,
    generatedAt: GEN,
  });
  const kept = r.sources.map((s) => s.source);
  assert.ok(kept.includes('CONCENTRATED'));
  assert.ok(!kept.includes('MIXED'));
  assert.ok(r.droppedAboveMaxEntropy >= 1);
});

test('build: sort orderings work', () => {
  const lines: QueueLine[] = [];
  // CONCENTRATED: pure weekly cosine.
  for (let d = 0; d < 21; d += 1) {
    const ms = Date.parse('2026-04-01T00:00:00Z') + d * 86_400_000;
    const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
    const v = Math.round(1000 + 500 * Math.cos((2 * Math.PI * d) / 7));
    lines.push(ql(iso, 'CONCENTRATED', v));
  }
  // MIXED: multi-tone -> higher entropy.
  for (let d = 0; d < 21; d += 1) {
    const ms = Date.parse('2026-04-01T00:00:00Z') + d * 86_400_000;
    const iso = new Date(ms).toISOString().slice(0, 10) + 'T00:00:00Z';
    const v = Math.round(
      2000 +
        300 * Math.cos((2 * Math.PI * d) / 7) +
        300 * Math.cos((2 * Math.PI * d) / 3) +
        300 * Math.cos((2 * Math.PI * d) / 5),
    );
    lines.push(ql(iso, 'MIXED', v));
  }
  const ascending = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'entropy',
    generatedAt: GEN,
  });
  assert.equal(ascending.sources[0]!.source, 'CONCENTRATED');
  const descending = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 14,
    sort: 'entropyDesc',
    generatedAt: GEN,
  });
  assert.equal(descending.sources[0]!.source, 'MIXED');
});

test('build: gap-fill happens for missing days inside tenure', () => {
  // Days 1, 8, 15: heavy; rest filled with 0 -> spectrum should peak
  // at the period-7 bin (bin k = 15/7 = 2 -- closest integer).
  const lines: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 10000),
    ql('2026-04-08T00:00:00Z', 'sparse', 10000),
    ql('2026-04-15T00:00:00Z', 'sparse', 10000),
  ];
  const r = buildDailyTokenSpectralEntropy(lines, {
    minTokens: 1,
    minTenureDays: 8,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.nTenureDays, 15);
  assert.equal(row.flat, false);
});

// ---- orthogonality witness vs lag-7 autocorrelation -----------------

test('orthogonality witness: pure cosine at non-7-day period defeats lag-7 but spectral entropy still detects it', async () => {
  // Pure 5-day-period cosine: lag-7 autocorrelation will not equal 1
  // (it picks up cos(2 pi * 7 / 5) = cos(14 pi / 5)) -- the periodicity
  // is invisible to a single-lag-7 scalar. Spectral entropy still
  // shoves all mass into the bin nearest f = N/5 and reports H_norm ~ 0.
  const N = 30; // 30 / 5 = 6 cycles, integer-aligned.
  const xs: number[] = [];
  for (let t = 0; t < N; t += 1) xs.push(Math.cos((2 * Math.PI * t) / 5));
  const power = periodogramOneSided(xs);
  const e = normalisedSpectralEntropy(power);
  assert.equal(e.peakBin, 6); // f = N/5 = 6 on N=30
  assert.ok(e.peakShare > 0.99, `expected ~1.0 spectral concentration, got ${e.peakShare}`);
  assert.ok(e.entropyNorm < 0.05, `expected near-zero entropy, got ${e.entropyNorm}`);
});

// ---- refinement: invariance laws -----------------------------------

test('refinement: H_norm is invariant under affine transform x -> a*x + b for a > 0', () => {
  // Mean-centring kills b; the periodogram scales by a^2 in every bin,
  // which factors out of the normalised distribution p[k] entirely,
  // leaving H_norm unchanged. This is structural.
  const xs: number[] = [];
  for (let i = 0; i < 30; i += 1) xs.push(Math.sin((2 * Math.PI * i) / 7) * 100 + i * 0.3);
  const e1 = normalisedSpectralEntropy(periodogramOneSided(xs));
  const ys = xs.map((x) => 17.25 * x + 999);
  const e2 = normalisedSpectralEntropy(periodogramOneSided(ys));
  assert.equal(e1.flat, false);
  assert.equal(e2.flat, false);
  assert.ok(
    Math.abs(e1.entropyNorm - e2.entropyNorm) < 1e-9,
    `affine-invariance: ${e1.entropyNorm} vs ${e2.entropyNorm}`,
  );
  assert.equal(e1.peakBin, e2.peakBin);
});
