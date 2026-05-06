import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPicardAueHorvathSpectralCusumChangepoint,
  spectralCusumRun,
  fourierCoefficients,
  periodogram,
  bandEnergy,
  slidingBandEnergy,
  picardCusum,
} from '../src/dailytokenpicardauehorvathspectralcusumchangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('spec-cusum: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { minTenureDays: 21.5 }),
  );
});

test('spec-cusum: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { minTokens: NaN }),
  );
});

test('spec-cusum: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { top: 1.5 }),
  );
});

test('spec-cusum: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], {
      sort: 'nope' as 'cMax',
    }),
  );
});

test('spec-cusum: rejects bad windowW', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { windowW: 3 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { windowW: 4.5 }),
  );
});

test('spec-cusum: rejects bad jLo / jHi', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { jLo: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { jHi: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { jLo: 5, jHi: 3 }),
  );
});

test('spec-cusum: rejects bad cThreshold', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { cThreshold: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { cThreshold: NaN }),
  );
});

test('spec-cusum: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { since: 'bad' }),
  );
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], { until: 'bad' }),
  );
});

test('spec-cusum: rejects bad onlyWithCps', () => {
  assert.throws(() =>
    buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], {
      onlyWithCps: 1 as unknown as boolean,
    }),
  );
});

// ---- empty / minimal -----------------------------------------------------

test('spec-cusum: empty queue returns empty rows', () => {
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.generatedAt, GEN);
});

test('spec-cusum: drops bad hour_start and non-positive tokens', () => {
  const q = [
    ql('not-a-date', 'a', 100),
    { ...ql('2026-01-01T00:00:00Z', 'a', 100), total_tokens: -5 },
  ];
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q as QueueLine[], {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 0);
});

// ---- numeric helpers -----------------------------------------------------

test('spec-cusum: fourierCoefficients basic shape', () => {
  const x = [0, 1, 0, -1, 0, 1, 0, -1];
  const { a, b, J } = fourierCoefficients(x);
  assert.equal(J, 3);
  assert.equal(a.length, J + 1);
  assert.equal(b.length, J + 1);
  // index 0 is reserved
  assert.equal(a[0], 0);
  assert.equal(b[0], 0);
  // each coefficient is finite
  for (let j = 1; j <= J; j += 1) {
    assert.ok(Number.isFinite(a[j]!));
    assert.ok(Number.isFinite(b[j]!));
  }
});

test('spec-cusum: periodogram is non-negative', () => {
  const x = Array.from({ length: 32 }, (_, i) => Math.sin((2 * Math.PI * 3 * i) / 32));
  const { I, J } = periodogram(x);
  assert.equal(J, 15);
  for (let j = 1; j <= J; j += 1) assert.ok(I[j]! >= 0);
});

test('spec-cusum: periodogram concentrates energy at the right frequency', () => {
  // x = cos(2 pi 4 t / n), n = 32 -> peak at j = 4.
  const n = 32;
  const x = Array.from({ length: n }, (_, t) => Math.cos((2 * Math.PI * 4 * t) / n));
  const { I, J } = periodogram(x);
  let argmax = 1;
  for (let j = 1; j <= J; j += 1) if (I[j]! > I[argmax]!) argmax = j;
  assert.equal(argmax, 4);
});

test('spec-cusum: bandEnergy averages the periodogram over the band', () => {
  const I = [0, 1, 1, 1, 1];
  assert.equal(bandEnergy(I, 1, 4), 1);
  assert.equal(bandEnergy(I, 2, 3), 1);
});

test('spec-cusum: bandEnergy validates indices', () => {
  const I = [0, 1, 2, 3];
  assert.throws(() => bandEnergy(I, 0, 2));
  assert.throws(() => bandEnergy(I, 2, 1));
  assert.throws(() => bandEnergy(I, 1, 5));
});

test('spec-cusum: slidingBandEnergy returns equal-length arrays', () => {
  const x = Array.from({ length: 40 }, (_, i) => Math.sin(i / 3));
  const { eCurve, tCenters } = slidingBandEnergy(x, 8, 1, 2);
  assert.equal(eCurve.length, tCenters.length);
  assert.ok(eCurve.length > 0);
  for (let i = 0; i < eCurve.length; i += 1) {
    assert.ok(Number.isFinite(eCurve[i]!));
    assert.ok(eCurve[i]! >= 0);
  }
});

test('spec-cusum: picardCusum is non-negative and zero on constant input', () => {
  const e = [1, 1, 1, 1, 1, 1];
  const C = picardCusum(e);
  assert.equal(C.length, 5);
  for (const c of C) assert.ok(c >= 0);
  for (const c of C) assert.ok(c < 1e-9);
});

test('spec-cusum: picardCusum peaks at the true changepoint of a step', () => {
  // mean shift at index 5: 1,1,1,1,1, 5,5,5,5,5
  const e = [1, 1, 1, 1, 1, 5, 5, 5, 5, 5];
  const C = picardCusum(e);
  let argmax = 0;
  for (let i = 0; i < C.length; i += 1) if (C[i]! > C[argmax]!) argmax = i;
  // CUSUM index argmax corresponds to split between e[argmax] and e[argmax+1].
  assert.equal(argmax, 4);
});

// ---- spectralCusumRun core ----------------------------------------------

test('spec-cusum: spectralCusumRun rejects bad shape', () => {
  assert.throws(() => spectralCusumRun([1, 2, 3], { windowW: 10, jLo: 1, jHi: 1, cThreshold: 1 }));
  assert.throws(() => spectralCusumRun([1, 2, 3, 4], { windowW: 3, jLo: 1, jHi: 1, cThreshold: 1 }));
  assert.throws(() => spectralCusumRun([1, 2, 3, 4], { windowW: 4, jLo: 0, jHi: 1, cThreshold: 1 }));
  assert.throws(() => spectralCusumRun([1, 2, 3, 4], { windowW: 4, jLo: 2, jHi: 1, cThreshold: 1 }));
  assert.throws(() => spectralCusumRun([1, 2, 3, 4], { windowW: 4, jLo: 1, jHi: 1, cThreshold: -1 }));
});

test('spec-cusum: detects a sub-band power flip', () => {
  // First 60 samples: low-frequency sinusoid (period 20).
  // Next 60 samples: high-frequency sinusoid (period 4).
  // Sub-band j_lo=1, j_hi=4 of W=20 captures only low-frequency power,
  // so band-energy drops sharply at index 60 -> CUSUM should fire near 60.
  const n = 120;
  const x = new Array<number>(n);
  for (let i = 0; i < 60; i += 1) x[i] = Math.sin((2 * Math.PI * i) / 20);
  for (let i = 60; i < n; i += 1) x[i] = Math.sin((2 * Math.PI * i) / 4);
  const result = spectralCusumRun(x, {
    windowW: 20,
    jLo: 1,
    jHi: 4,
    cThreshold: 1.5,
  });
  assert.ok(result.cMax > 0);
  assert.ok(result.tauStarBest >= 40 && result.tauStarBest <= 80);
  // sigmaE should be strictly positive on a varying signal.
  assert.ok(result.sigmaE > 0);
});

test('spec-cusum: returns no CPs on stationary white-noise-like signal', () => {
  const n = 80;
  // deterministic pseudo-noise (Mulberry32-like)
  let s = 0x12345678;
  const x = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    x[i] = (((t ^ (t >>> 14)) >>> 0) % 1000) / 1000;
  }
  const result = spectralCusumRun(x, {
    windowW: 16,
    jLo: 1,
    jHi: 4,
    cThreshold: 5.0,
  });
  // High threshold + stationary noise -> very few CPs.
  assert.ok(result.tauStar.length <= 1);
});

// ---- builder integration ------------------------------------------------

test('spec-cusum: builder respects minTenureDays floor of 21', () => {
  const q: QueueLine[] = [];
  // only 10 days of data -> dropped below min tenure
  for (let d = 1; d <= 10; d += 1) {
    const ymd = `2026-01-${String(d).padStart(2, '0')}T00:00:00.000Z`;
    q.push(ql(ymd, 'a', 1000));
  }
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('spec-cusum: builder runs end-to-end on a synthetic two-regime source', () => {
  const q: QueueLine[] = [];
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const n = 60;
  for (let d = 0; d < n; d += 1) {
    const iso = new Date(start + d * 86_400_000).toISOString();
    // first half: low-frequency oscillation; second half: high-frequency.
    const v =
      d < 30
        ? 1000 + 500 * Math.sin((2 * Math.PI * d) / 14)
        : 1000 + 500 * Math.sin((2 * Math.PI * d) / 3);
    q.push(ql(iso, 'a', Math.max(1, Math.floor(v))));
  }
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, {
    generatedAt: GEN,
    cThreshold: 1.0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nTenureDays, 60);
  assert.ok(row.cMax > 0);
  assert.ok(row.bandSize >= 1);
  assert.ok(row.windowW >= 4);
  // best CP should land in the middle third.
  assert.ok(row.tauStarBest >= 15 && row.tauStarBest <= 45);
  // tauStarBestDay is a valid YYYY-MM-DD.
  assert.match(row.tauStarBestDay, /^\d{4}-\d{2}-\d{2}$/);
});

test('spec-cusum: builder filters to onlyWithCps', () => {
  const q: QueueLine[] = [];
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  for (let d = 0; d < 30; d += 1) {
    const iso = new Date(start + d * 86_400_000).toISOString();
    // pure constant series gets dropped by zero-variance gate.
    // Use a single tiny perturbation so variance is non-zero but no CP fires.
    const v = d === 15 ? 1001 : 1000;
    q.push(ql(iso, 'flat', v));
  }
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, {
    generatedAt: GEN,
    cThreshold: 100, // huge threshold -> no CPs
    onlyWithCps: true,
  });
  assert.equal(r.sources.length, 0);
});

test('spec-cusum: builder respects sort=tokens and top', () => {
  const q: QueueLine[] = [];
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  for (let d = 0; d < 30; d += 1) {
    const iso = new Date(start + d * 86_400_000).toISOString();
    q.push(ql(iso, 'big', 10_000 + d * 1000));
    q.push(ql(iso, 'small', 1000 + d * 50));
  }
  const r = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, {
    generatedAt: GEN,
    sort: 'tokens',
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedTopSources, 1);
});

test('spec-cusum: builder is deterministic across two runs', () => {
  const q: QueueLine[] = [];
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  for (let d = 0; d < 40; d += 1) {
    const iso = new Date(start + d * 86_400_000).toISOString();
    q.push(ql(iso, 'a', 1000 + Math.floor(500 * Math.sin(d / 3))));
  }
  const r1 = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, { generatedAt: GEN });
  const r2 = buildDailyTokenPicardAueHorvathSpectralCusumChangepoint(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

// ---- property invariants -----------------------------------------------

test('spec-cusum: cMax is invariant under additive constant shift', () => {
  // Spectral CUSUM operates on local mean-centred windows; adding a constant
  // to x must not change cMax.
  const n = 80;
  const x = Array.from({ length: n }, (_, i) =>
    i < 40 ? 100 + Math.sin(i / 2) : 100 + 5 * Math.sin(i / 2),
  );
  const xShift = x.map((v) => v + 1_000_000);
  const r1 = spectralCusumRun(x, { windowW: 16, jLo: 1, jHi: 4, cThreshold: 1.5 });
  const r2 = spectralCusumRun(xShift, { windowW: 16, jLo: 1, jHi: 4, cThreshold: 1.5 });
  // The local mean-centring makes cMax exactly identical (modulo float roundoff).
  assert.ok(Math.abs(r1.cMax - r2.cMax) < 1e-6);
});

test('spec-cusum: cMax scales as alpha^2 under scalar multiplication', () => {
  // I(omega) is quadratic in x, so band energy and hence the difference
  // |left - right| inside CUSUM both scale as alpha^2.
  const n = 80;
  const x = Array.from({ length: n }, (_, i) =>
    i < 40 ? Math.sin(i / 2) : 5 * Math.sin(i / 2),
  );
  const x2 = x.map((v) => 3 * v);
  const r1 = spectralCusumRun(x, { windowW: 16, jLo: 1, jHi: 4, cThreshold: 1.5 });
  const r2 = spectralCusumRun(x2, { windowW: 16, jLo: 1, jHi: 4, cThreshold: 1.5 });
  // Ratio should be 9 = 3^2.
  if (r1.cMax > 0) {
    const ratio = r2.cMax / r1.cMax;
    assert.ok(Math.abs(ratio - 9) < 1e-6, `expected 9, got ${ratio}`);
  }
});
