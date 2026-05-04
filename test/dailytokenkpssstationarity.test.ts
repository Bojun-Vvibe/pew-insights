import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenKpssStationarity,
  kpssSummary,
  kpssVerdict,
  schwertBandwidth,
} from '../src/dailytokenkpssstationarity.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('kpss: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenKpssStationarity([], { minDays: 7 }));
  assert.throws(() => buildDailyTokenKpssStationarity([], { minDays: 4 }));
  assert.throws(() => buildDailyTokenKpssStationarity([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenKpssStationarity([], { minDays: -1 }));
});

test('kpss: rejects bad top', () => {
  assert.throws(() => buildDailyTokenKpssStationarity([], { top: -1 }));
  assert.throws(() => buildDailyTokenKpssStationarity([], { top: 1.5 }));
});

test('kpss: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenKpssStationarity([], { sort: 'nope' as 'tokens' }),
  );
});

test('kpss: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenKpssStationarity([], { since: 'no' }));
  assert.throws(() => buildDailyTokenKpssStationarity([], { until: 'nope' }));
});

test('kpss: empty queue -> empty sources', () => {
  const r = buildDailyTokenKpssStationarity([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 8);
  assert.equal(r.sort, 'tokens');
});

// ---- schwertBandwidth ----------------------------------------------------

test('schwertBandwidth: standard sizes', () => {
  // floor(4 * (n/100)^0.25)
  assert.equal(schwertBandwidth(0), 0);
  assert.equal(schwertBandwidth(1), 0);
  // n=8: 4 * 0.08^0.25 ~= 2.127 -> floor = 2
  assert.equal(schwertBandwidth(8), 2);
  assert.equal(schwertBandwidth(100), 4); // 4 * 1 = 4
  assert.equal(schwertBandwidth(10000), 12); // 4 * 100^0.25 = 4 * sqrt(10) ~ 12.649 -> 12
});

test('schwertBandwidth: tiny n still gives at least 1', () => {
  assert.equal(schwertBandwidth(2), 1);
  assert.equal(schwertBandwidth(3), 1);
});

// ---- kpssVerdict ---------------------------------------------------------

test('kpssVerdict: cutoffs', () => {
  assert.equal(kpssVerdict(0.0, false), 'stationary');
  assert.equal(kpssVerdict(0.346, false), 'stationary');
  assert.equal(kpssVerdict(0.347, false), 'borderline');
  assert.equal(kpssVerdict(0.4, false), 'borderline');
  assert.equal(kpssVerdict(0.463, false), 'nonstationary');
  assert.equal(kpssVerdict(0.7, false), 'nonstationary');
  assert.equal(kpssVerdict(0.739, false), 'strongly-nonstationary');
  assert.equal(kpssVerdict(10, false), 'strongly-nonstationary');
  assert.equal(kpssVerdict(0.5, true), 'flat');
});

// ---- kpssSummary pure helper ---------------------------------------------

test('kpssSummary: empty -> flat', () => {
  const s = kpssSummary([]);
  assert.equal(s.flat, true);
  assert.equal(s.eta, 0);
  assert.equal(s.bandwidth, 0);
  assert.equal(s.verdict, 'flat');
});

test('kpssSummary: constant -> flat', () => {
  const s = kpssSummary([5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(s.flat, true);
  assert.equal(s.verdict, 'flat');
  assert.equal(s.gammaZero, 0);
});

test('kpssSummary: zero-mean alternating -> stationary, low eta', () => {
  // Highly zero-mean, low partial-sum-squared / lrv ratio.
  const v = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1];
  const s = kpssSummary(v);
  assert.equal(s.flat, false);
  assert.ok(s.eta < 0.347, `expected eta<0.347, got ${s.eta}`);
  assert.equal(s.verdict, 'stationary');
  assert.ok(s.bandwidth >= 1);
  assert.ok(s.lrVariance > 0);
});

test('kpssSummary: monotonic ramp -> strongly nonstationary, large eta', () => {
  // Linear ramp 0..19 has huge integrated partial-sum-squared.
  const v = Array.from({ length: 20 }, (_, i) => i);
  const s = kpssSummary(v);
  assert.equal(s.flat, false);
  // KPSS should overwhelmingly reject — much larger than 0.739.
  assert.ok(s.eta > 0.739, `expected eta>0.739, got ${s.eta}`);
  assert.equal(s.verdict, 'strongly-nonstationary');
});

test('kpssSummary: mean-shift step -> nonstationary verdict', () => {
  // Two-level step.
  const v = [0, 0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 10];
  const s = kpssSummary(v);
  assert.equal(s.flat, false);
  assert.ok(s.eta >= 0.347, `expected eta>=0.347, got ${s.eta}`);
  // Step shift should at least be borderline; accept either non-stationary tier.
  assert.ok(
    s.verdict === 'borderline' ||
      s.verdict === 'nonstationary' ||
      s.verdict === 'strongly-nonstationary',
  );
});

test('kpssSummary: lrVariance >= gammaZero only when positive autocorr present', () => {
  // i.i.d.-like alternating series has negative lag-1 autocov, so
  // Bartlett-HAC lrv should be <= gamma0.
  const v = [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1];
  const s = kpssSummary(v);
  assert.ok(s.lrVariance <= s.gammaZero + 1e-12);
});

test('kpssSummary: positive lag-1 autocorr inflates lrVariance over gammaZero', () => {
  // AR(1)-flavoured: monotone-ish pattern with strong positive lag-1 cov.
  const v = [1, 2, 3, 2, 3, 4, 3, 4, 5, 4, 5, 6];
  const s = kpssSummary(v);
  assert.ok(
    s.lrVariance > s.gammaZero,
    `expected lrv > gamma0; got lrv=${s.lrVariance}, g0=${s.gammaZero}`,
  );
});

test('kpssSummary: scale invariance (eta unchanged under c*x)', () => {
  const v = [1, 3, 2, 4, 2, 5, 3, 6, 4, 7];
  const s1 = kpssSummary(v);
  const s2 = kpssSummary(v.map((x) => 1000 * x));
  assert.ok(Math.abs(s1.eta - s2.eta) < 1e-9, `${s1.eta} vs ${s2.eta}`);
  assert.equal(s1.verdict, s2.verdict);
});

test('kpssSummary: location invariance (eta unchanged under x + c)', () => {
  const v = [1, 3, 2, 4, 2, 5, 3, 6, 4, 7];
  const s1 = kpssSummary(v);
  const s2 = kpssSummary(v.map((x) => x + 9999));
  assert.ok(Math.abs(s1.eta - s2.eta) < 1e-9);
  assert.equal(s1.verdict, s2.verdict);
});

// ---- builder integration -------------------------------------------------

function makeRamp(src: string, startDay: string, n: number): QueueLine[] {
  const out: QueueLine[] = [];
  const startMs = Date.parse(`${startDay}T00:00:00.000Z`);
  for (let i = 0; i < n; i++) {
    const day = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, src, 100 + 10 * i));
  }
  return out;
}

test('kpss builder: ramp source -> nonstationary verdict', () => {
  const queue = makeRamp('rampy', '2026-04-01', 12);
  const r = buildDailyTokenKpssStationarity(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'rampy');
  assert.equal(row.flat, false);
  // Bartlett-HAC at small n inflates lrv heavily on monotone ramps; the
  // verdict still rejects H0 at the 5% level but may not clear 1%.
  assert.ok(
    row.verdict === 'nonstationary' || row.verdict === 'strongly-nonstationary',
    `expected (strongly-)nonstationary, got ${row.verdict} (eta=${row.eta})`,
  );
  assert.ok(row.eta >= 0.463);
});

test('kpss builder: short source dropped as sparse', () => {
  // 5 days < default minDays=8.
  const queue = makeRamp('shorty', '2026-04-01', 5);
  const r = buildDailyTokenKpssStationarity(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('kpss builder: sort by eta', () => {
  // Two sources: one ramp (high eta), one zero-mean alternating (low eta).
  const ramp = makeRamp('a-ramp', '2026-04-01', 12);
  const altQ: QueueLine[] = [];
  const startMs = Date.parse('2026-04-01T00:00:00.000Z');
  for (let i = 0; i < 12; i++) {
    const day = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
    // Centered around 100 with +/-10 alternation -> low eta.
    altQ.push(ql(`${day}T00:00:00.000Z`, 'b-alt', 100 + (i % 2 === 0 ? 10 : -10)));
  }
  const r = buildDailyTokenKpssStationarity([...ramp, ...altQ], {
    generatedAt: GEN,
    sort: 'eta',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a-ramp');
  assert.equal(r.sources[1]!.source, 'b-alt');
  assert.ok(r.sources[0]!.eta > r.sources[1]!.eta);
});

test('kpss builder: sort by verdict (categorical)', () => {
  const ramp = makeRamp('a-ramp', '2026-04-01', 12);
  const altQ: QueueLine[] = [];
  const startMs = Date.parse('2026-04-01T00:00:00.000Z');
  for (let i = 0; i < 12; i++) {
    const day = new Date(startMs + i * 86_400_000).toISOString().slice(0, 10);
    altQ.push(ql(`${day}T00:00:00.000Z`, 'b-alt', 100 + (i % 2 === 0 ? 10 : -10)));
  }
  const r = buildDailyTokenKpssStationarity([...ramp, ...altQ], {
    generatedAt: GEN,
    sort: 'verdict',
  });
  assert.equal(r.sources[0]!.source, 'a-ramp');
});

test('kpss builder: top cap', () => {
  const a = makeRamp('aa', '2026-04-01', 12);
  const b = makeRamp('bb', '2026-04-01', 10);
  const r = buildDailyTokenKpssStationarity([...a, ...b], {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('kpss builder: invalid hour_start counted', () => {
  const q: QueueLine[] = [ql('not-a-date', 'x', 10), ...makeRamp('y', '2026-04-01', 10)];
  const r = buildDailyTokenKpssStationarity(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('kpss builder: zero/negative tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'x', 0),
    ql('2026-04-01T00:00:00.000Z', 'x', -5),
    ...makeRamp('y', '2026-04-01', 10),
  ];
  const r = buildDailyTokenKpssStationarity(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
});

test('kpss builder: source filter', () => {
  const a = makeRamp('aa', '2026-04-01', 10);
  const b = makeRamp('bb', '2026-04-01', 10);
  const r = buildDailyTokenKpssStationarity([...a, ...b], {
    generatedAt: GEN,
    source: 'aa',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'aa');
  assert.equal(r.droppedSourceFilter, 10);
});

test('kpss builder: deterministic across runs', () => {
  const q = makeRamp('det', '2026-04-01', 12);
  const r1 = buildDailyTokenKpssStationarity(q, { generatedAt: GEN });
  const r2 = buildDailyTokenKpssStationarity(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});
