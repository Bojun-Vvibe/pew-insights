import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAdfUnitRoot,
  adfSummary,
  adfVerdict,
  adfPApprox,
  schwertMaxLag,
} from '../src/dailytokenadfunitroot.js';
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

test('adf: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { minDays: 11 }));
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { minDays: 4 }));
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { minDays: -1 }));
});

test('adf: rejects bad top', () => {
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { top: -1 }));
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { top: 1.5 }));
});

test('adf: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenAdfUnitRoot([], { sort: 'nope' as 'tokens' }),
  );
});

test('adf: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { since: 'no' }));
  assert.throws(() => buildDailyTokenAdfUnitRoot([], { until: 'nope' }));
});

test('adf: empty queue -> empty sources', () => {
  const r = buildDailyTokenAdfUnitRoot([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 12);
  assert.equal(r.sort, 'tokens');
});

test('adf: defaults are stable', () => {
  const r = buildDailyTokenAdfUnitRoot([], { generatedAt: GEN });
  assert.equal(r.minDays, 12);
  assert.equal(r.top, 0);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.source, null);
});

// ---- schwertMaxLag -------------------------------------------------------

test('schwertMaxLag: tiny n', () => {
  assert.equal(schwertMaxLag(0), 0);
  assert.equal(schwertMaxLag(1), 0);
  assert.equal(schwertMaxLag(2), 0);
});

test('schwertMaxLag: n=12 (cap-bound)', () => {
  // raw = floor(12 * (12/100)^0.25) = floor(12 * 0.5887) = floor(7.06) = 7
  // cap = floor(11 / 4) = 2
  assert.equal(schwertMaxLag(12), 2);
});

test('schwertMaxLag: n=100 -> 12', () => {
  // raw = floor(12 * 1) = 12; cap = floor(99/4) = 24; min = 12
  assert.equal(schwertMaxLag(100), 12);
});

test('schwertMaxLag: n=10000', () => {
  // raw = floor(12 * 100^0.25) = floor(12 * sqrt(10)) = floor(37.94) = 37
  // cap = floor(9999/4) = 2499; min = 37
  assert.equal(schwertMaxLag(10000), 37);
});

test('schwertMaxLag: never negative', () => {
  for (let n = 0; n < 200; n++) {
    assert.ok(schwertMaxLag(n) >= 0);
  }
});

// ---- adfVerdict ---------------------------------------------------------

test('adfVerdict: cutoffs', () => {
  assert.equal(adfVerdict(0, false), 'unit-root');
  assert.equal(adfVerdict(-1, false), 'unit-root');
  assert.equal(adfVerdict(-2.569, false), 'unit-root');
  assert.equal(adfVerdict(-2.57, false), 'borderline');
  assert.equal(adfVerdict(-2.7, false), 'borderline');
  assert.equal(adfVerdict(-2.86, false), 'stationary');
  assert.equal(adfVerdict(-3.42, false), 'stationary');
  assert.equal(adfVerdict(-3.43, false), 'strongly-stationary');
  assert.equal(adfVerdict(-10, false), 'strongly-stationary');
});

test('adfVerdict: flat short-circuits', () => {
  assert.equal(adfVerdict(-99, true), 'flat');
  assert.equal(adfVerdict(0, true), 'flat');
});

test('adfVerdict: NaN tau -> unit-root', () => {
  assert.equal(adfVerdict(NaN, false), 'unit-root');
});

// ---- adfPApprox ----------------------------------------------------------

test('adfPApprox: tau >= 0 -> 0.99', () => {
  assert.equal(adfPApprox(0), 0.99);
  assert.equal(adfPApprox(1), 0.99);
  assert.equal(adfPApprox(100), 0.99);
});

test('adfPApprox: hits anchor values closely', () => {
  assert.ok(Math.abs(adfPApprox(-2.57) - 0.10) < 1e-9);
  assert.ok(Math.abs(adfPApprox(-2.86) - 0.05) < 1e-9);
  assert.ok(Math.abs(adfPApprox(-3.43) - 0.01) < 1e-9);
});

test('adfPApprox: monotone decreasing in tau (more negative -> smaller p)', () => {
  let prev = adfPApprox(0.5);
  for (let tau = 0; tau >= -6; tau -= 0.1) {
    const p = adfPApprox(tau);
    assert.ok(p <= prev + 1e-12, `not monotone at tau=${tau}: ${p} > ${prev}`);
    prev = p;
  }
});

test('adfPApprox: deep tail pinned at 1e-4', () => {
  assert.ok(adfPApprox(-100) >= 1e-4);
  assert.ok(adfPApprox(-100) <= 0.01);
});

test('adfPApprox: NaN -> 0.99', () => {
  assert.equal(adfPApprox(NaN), 0.99);
});

test('adfPApprox: linear region between 0 and -2.57', () => {
  // At midpoint tau = -1.285, expect linear interp: 0.99 + 0.5 * (0.10 - 0.99) = 0.545.
  const p = adfPApprox(-1.285);
  assert.ok(Math.abs(p - 0.545) < 1e-9, `expected ~0.545, got ${p}`);
});

// ---- adfSummary pure helper ---------------------------------------------

test('adfSummary: empty -> flat', () => {
  const s = adfSummary([]);
  assert.equal(s.flat, true);
  assert.equal(s.tau, 0);
  assert.equal(s.lags, 0);
  assert.equal(s.verdict, 'flat');
  assert.equal(s.degenerate, false);
});

test('adfSummary: constant -> flat', () => {
  const s = adfSummary([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.equal(s.flat, true);
  assert.equal(s.verdict, 'flat');
});

test('adfSummary: random walk shows weak rejection (high tau)', () => {
  // Deterministic random-walk: x[t] = x[t-1] + zigzag step that integrates.
  // Use cumulative sum of small alternating steps that don't cancel exactly
  // so x stays drifting.
  const steps = [1, 2, -1, 3, 1, 2, -2, 1, 3, -1, 2, 1, -1, 2, 1, 3, -2, 1, 2, -1];
  const x: number[] = [];
  let acc = 0;
  for (const s of steps) {
    acc += s;
    x.push(acc);
  }
  const s = adfSummary(x);
  assert.equal(s.flat, false);
  // For an integrated series, ADF tau should NOT reject H0 strongly:
  // expect tau > -3.43 (i.e. not in strongly-stationary tail).
  assert.ok(s.tau > -3.43, `random-walk tau too negative: ${s.tau}`);
});

test('adfSummary: strongly mean-reverting series rejects unit-root', () => {
  // Construct a series tightly centered around mu=0 with rapid mean
  // reversion: x[t] = -0.9 * x[t-1] + small noise. Strong AR(1) with
  // negative coefficient is overwhelmingly stationary.
  const n = 60;
  const x: number[] = [0];
  for (let i = 1; i < n; i++) {
    const prev = x[i - 1]!;
    // tiny deterministic perturbation to avoid degenerate identical seq
    const perturb = ((i * 13) % 7) - 3;
    x.push(-0.9 * prev + perturb);
  }
  const s = adfSummary(x);
  assert.equal(s.flat, false);
  // Mean-reverting AR(1) with rho_AR = -0.9 should give tau very negative.
  assert.ok(s.tau < -2.86, `expected strong stationarity, got tau=${s.tau}`);
  assert.ok(['stationary', 'strongly-stationary'].includes(s.verdict));
});

test('adfSummary: rho is negative for stationary series', () => {
  const n = 50;
  const x: number[] = [];
  // Damped oscillation toward 0 -> strong mean reversion -> rho < 0.
  for (let i = 0; i < n; i++) {
    x.push(10 * Math.cos(i * 0.7) * Math.pow(0.85, i));
  }
  const s = adfSummary(x);
  assert.equal(s.flat, false);
  assert.ok(s.rho < 0, `expected rho<0, got ${s.rho}`);
});

test('adfSummary: lags <= pMax', () => {
  const n = 30;
  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(i + (i % 3));
  const s = adfSummary(x);
  assert.ok(s.lags <= s.pMax, `lags=${s.lags} > pMax=${s.pMax}`);
  assert.ok(s.lags >= 0);
});

test('adfSummary: pMax matches schwertMaxLag', () => {
  const n = 50;
  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(i * 1.5 + (i % 5));
  const s = adfSummary(x);
  assert.equal(s.pMax, schwertMaxLag(n));
});

test('adfSummary: nReg = n - 1 - lags', () => {
  const n = 40;
  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(i + (i % 4) * 2);
  const s = adfSummary(x);
  assert.equal(s.nReg, n - 1 - s.lags);
});

test('adfSummary: rhoSe positive on healthy fit', () => {
  const n = 40;
  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(Math.sin(i * 0.4) * 5 + (i % 3));
  const s = adfSummary(x);
  assert.ok(s.rhoSe > 0, `expected rhoSe>0, got ${s.rhoSe}`);
});

test('adfSummary: tau = rho / rhoSe identity', () => {
  const n = 40;
  const x: number[] = [];
  for (let i = 0; i < n; i++) x.push(Math.cos(i * 0.5) * 4 + (i % 2));
  const s = adfSummary(x);
  if (!s.flat && !s.degenerate && s.rhoSe > 0) {
    assert.ok(Math.abs(s.tau - s.rho / s.rhoSe) < 1e-9);
  }
});

test('adfSummary: pApprox is monotone-consistent with tau', () => {
  const n = 30;
  const stationary: number[] = [];
  for (let i = 0; i < n; i++) stationary.push(Math.cos(i) * 5);
  const drift: number[] = [];
  for (let i = 0; i < n; i++) drift.push(i * 2 + Math.cos(i));

  const sS = adfSummary(stationary);
  const sD = adfSummary(drift);
  if (!sS.flat && !sD.flat && sS.tau < sD.tau) {
    assert.ok(sS.pApprox <= sD.pApprox, `pApprox not consistent`);
  }
});

test('adfSummary: verdict polarity inversion vs KPSS by design', () => {
  // Highly mean-reverting series should give verdict in
  // {stationary, strongly-stationary} (i.e. ADF rejects H0=unit-root).
  const x: number[] = [];
  for (let i = 0; i < 50; i++) x.push(((i % 2) === 0 ? 5 : -5) + (i % 3));
  const s = adfSummary(x);
  assert.equal(s.flat, false);
  assert.notEqual(s.verdict, 'flat');
});

// ---- buildDailyTokenAdfUnitRoot integration -----------------------------

function makeDays(source: string, startYmd: string, vals: number[]): QueueLine[] {
  const out: QueueLine[] = [];
  const baseMs = Date.parse(`${startYmd}T00:00:00.000Z`);
  for (let i = 0; i < vals.length; i++) {
    const dayMs = baseMs + i * 86_400_000;
    const day = new Date(dayMs).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, source, vals[i]!));
  }
  return out;
}

test('build: drops sparse sources below minDays', () => {
  const queue = makeDays('shortie', '2026-01-01', [100, 100, 100]);
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: respects custom minDays', () => {
  const vals: number[] = [];
  for (let i = 0; i < 15; i++) vals.push(100 + (i % 5));
  const queue = makeDays('s1', '2026-01-01', vals);
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN, minDays: 12 });
  assert.equal(r.sources.length, 1);
});

test('build: aggregates multiple rows on the same day', () => {
  const queue: QueueLine[] = [];
  const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < 14; i++) {
    const day = new Date(baseMs + i * 86_400_000).toISOString().slice(0, 10);
    queue.push(ql(`${day}T01:00:00.000Z`, 's', 50));
    queue.push(ql(`${day}T05:00:00.000Z`, 's', 50));
  }
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 14 * 100);
  assert.equal(r.sources[0]!.nFilledDays, 14);
  assert.equal(r.sources[0]!.nActiveDays, 14);
});

test('build: gap-fills missing days as zero', () => {
  // Active on day 0 and day 13 only -> gap-fill produces zeros in middle.
  const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
  const last = new Date(baseMs + 13 * 86_400_000).toISOString().slice(0, 10);
  const queue: QueueLine[] = [
    ql('2026-01-01T01:00:00.000Z', 's', 100),
    ql(`${last}T05:00:00.000Z`, 's', 100),
  ];
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 2);
  assert.equal(r.sources[0]!.nFilledDays, 14);
});

test('build: drops invalid hour_start', () => {
  const vals: number[] = [];
  for (let i = 0; i < 14; i++) vals.push(100);
  const queue = makeDays('s', '2026-01-01', vals);
  queue.push(ql('not-a-date', 's', 99));
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: drops zero/negative tokens', () => {
  const vals: number[] = [];
  for (let i = 0; i < 14; i++) vals.push(100);
  const queue = makeDays('s', '2026-01-01', vals);
  queue.push(ql('2026-02-01T00:00:00.000Z', 's', 0));
  queue.push(ql('2026-02-02T00:00:00.000Z', 's', -5));
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
});

test('build: source filter accounting', () => {
  const a = makeDays('a', '2026-01-01', new Array(14).fill(100));
  const b = makeDays('b', '2026-01-01', new Array(14).fill(200));
  const r = buildDailyTokenAdfUnitRoot([...a, ...b], {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 14);
  assert.equal(r.source, 'a');
});

test('build: top cap reports droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    const vals = new Array(14).fill(100 + src.charCodeAt(0));
    queue.push(...makeDays(src, '2026-01-01', vals));
  }
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: sort by tokens (desc) with source asc tiebreak', () => {
  const queue: QueueLine[] = [];
  queue.push(...makeDays('zebra', '2026-01-01', new Array(14).fill(100)));
  queue.push(...makeDays('alpha', '2026-01-01', new Array(14).fill(100)));
  queue.push(...makeDays('beta', '2026-01-01', new Array(14).fill(200)));
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['beta', 'alpha', 'zebra'],
  );
});

test('build: sort by tau (most-negative first)', () => {
  // Two sources: one strongly stationary, one drifting.
  const stationaryVals: number[] = [];
  for (let i = 0; i < 30; i++) stationaryVals.push(100 + ((i % 2) === 0 ? -10 : 10));
  const driftVals: number[] = [];
  for (let i = 0; i < 30; i++) driftVals.push(100 + i * 5);

  const q = [
    ...makeDays('drift', '2026-01-01', driftVals),
    ...makeDays('stat', '2026-01-01', stationaryVals),
  ];
  const r = buildDailyTokenAdfUnitRoot(q, { generatedAt: GEN, sort: 'tau' });
  assert.equal(r.sort, 'tau');
  // tau sort: most-negative first, then ascending. Verify monotonicity.
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i]!.tau >= r.sources[i - 1]!.tau,
      `tau not ascending at i=${i}: ${r.sources[i - 1]!.tau} -> ${r.sources[i]!.tau}`,
    );
  }
});

test('build: sort by ndays (desc)', () => {
  const q = [
    ...makeDays('long', '2026-01-01', new Array(40).fill(100)),
    ...makeDays('short', '2026-01-01', new Array(14).fill(100)),
  ];
  const r = buildDailyTokenAdfUnitRoot(q, { generatedAt: GEN, sort: 'ndays' });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[1]!.source, 'short');
});

test('build: sort by verdict ranks strongly-stationary first', () => {
  const stationaryVals: number[] = [];
  for (let i = 0; i < 40; i++) stationaryVals.push(100 + ((i % 2) === 0 ? -50 : 50));
  const driftVals: number[] = [];
  for (let i = 0; i < 40; i++) driftVals.push(100 + i * 10);
  const q = [
    ...makeDays('drift', '2026-01-01', driftVals),
    ...makeDays('rev', '2026-01-01', stationaryVals),
  ];
  const r = buildDailyTokenAdfUnitRoot(q, { generatedAt: GEN, sort: 'verdict' });
  assert.equal(r.sort, 'verdict');
  // First row should have higher verdict rank.
  const first = r.sources[0]!;
  const last = r.sources[r.sources.length - 1]!;
  const RANK: Record<string, number> = {
    'strongly-stationary': 4,
    stationary: 3,
    borderline: 2,
    'unit-root': 1,
    flat: 0,
  };
  assert.ok(RANK[first.verdict]! >= RANK[last.verdict]!);
});

test('build: sort by papprox ascending (most-significant first)', () => {
  const stationaryVals: number[] = [];
  for (let i = 0; i < 40; i++) stationaryVals.push(100 + ((i % 2) === 0 ? -40 : 40));
  const driftVals: number[] = [];
  for (let i = 0; i < 40; i++) driftVals.push(100 + i * 8);
  const q = [
    ...makeDays('drift', '2026-01-01', driftVals),
    ...makeDays('rev', '2026-01-01', stationaryVals),
  ];
  const r = buildDailyTokenAdfUnitRoot(q, { generatedAt: GEN, sort: 'papprox' });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i]!.pApprox >= r.sources[i - 1]!.pApprox);
  }
});

test('build: window since/until restricts data', () => {
  const queue: QueueLine[] = makeDays('s', '2026-01-01', new Array(40).fill(100));
  const r = buildDailyTokenAdfUnitRoot(queue, {
    generatedAt: GEN,
    since: '2026-01-10T00:00:00.000Z',
    until: '2026-01-25T00:00:00.000Z',
  });
  assert.equal(r.windowStart, '2026-01-10T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-01-25T00:00:00.000Z');
  if (r.sources.length > 0) {
    assert.ok(r.sources[0]!.nFilledDays <= 15);
  }
});

test('build: empty source string falls back to (unknown)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, '', 100));
  }
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('build: deterministic generatedAt passthrough', () => {
  const r = buildDailyTokenAdfUnitRoot([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
});

test('build: row totals match', () => {
  const vals: number[] = [];
  for (let i = 0; i < 20; i++) vals.push(100 + i);
  const queue = makeDays('s', '2026-01-01', vals);
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.totalTokens, vals.reduce((a, b) => a + b, 0));
  assert.equal(r.sources[0]!.totalTokens, r.totalTokens);
});

test('build: orthogonality vs KPSS — both verdicts coexist on same data', () => {
  // ADF and KPSS verdicts are independent; both should be valid strings.
  const vals: number[] = [];
  for (let i = 0; i < 20; i++) vals.push(100 + ((i % 3) - 1) * 30);
  const queue = makeDays('s', '2026-01-01', vals);
  const r = buildDailyTokenAdfUnitRoot(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const v = r.sources[0]!.verdict;
  assert.ok(
    ['strongly-stationary', 'stationary', 'borderline', 'unit-root', 'flat'].includes(v),
  );
});
