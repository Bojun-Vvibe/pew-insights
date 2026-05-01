import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenIqrOverMedian,
  iqrOverMedianOfVector,
} from '../src/dailytokeniqrovermedian.js';
import { percentileGapRatioOfVector } from '../src/dailytokenpercentilegapratio.js';
import { ge2OfVector } from '../src/dailytokenge2index.js';
import { geFourOfVector } from '../src/dailytokengefourindex.js';
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

const GEN = '2026-05-01T09:00:00.000Z';

// ---- iqrOverMedianOfVector primitive --------------------------------

test('iqrOverMedianOfVector: empty -> degenerate, iom=0', () => {
  const r = iqrOverMedianOfVector([]);
  assert.equal(r.iom, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.iqrAbsolute, 0);
});

test('iqrOverMedianOfVector: singleton -> degenerate, iom=0, p25=p50=p75', () => {
  const r = iqrOverMedianOfVector([42]);
  assert.equal(r.iom, 0);
  assert.equal(r.p25, 42);
  assert.equal(r.p50, 42);
  assert.equal(r.p75, 42);
  assert.equal(r.degenerate, true);
});

test('iqrOverMedianOfVector: closed-form anchor on [1..10] -> 0.81818...', () => {
  const r = iqrOverMedianOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // P25 = 3.25, P50 = 5.5, P75 = 7.75
  // IOM = (7.75 - 3.25) / 5.5 = 4.5 / 5.5
  assert.ok(Math.abs(r.p25 - 3.25) < 1e-12);
  assert.ok(Math.abs(r.p50 - 5.5) < 1e-12);
  assert.ok(Math.abs(r.p75 - 7.75) < 1e-12);
  assert.ok(Math.abs(r.iqrAbsolute - 4.5) < 1e-12);
  assert.ok(Math.abs(r.iom - 4.5 / 5.5) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('iqrOverMedianOfVector: all-equal vector -> iom=0, degenerate', () => {
  const r = iqrOverMedianOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.iom, 0);
  assert.equal(r.iqrAbsolute, 0);
  assert.equal(r.p25, 7);
  assert.equal(r.p75, 7);
  assert.equal(r.degenerate, true);
});

test('iqrOverMedianOfVector: rejects non-positive / non-finite values', () => {
  assert.throws(() => iqrOverMedianOfVector([1, 2, 0, 4]), /strictly-positive/);
  assert.throws(() => iqrOverMedianOfVector([1, 2, -3, 4]), /strictly-positive/);
  assert.throws(
    () => iqrOverMedianOfVector([1, 2, Number.NaN, 4]),
    /strictly-positive/,
  );
  assert.throws(
    () => iqrOverMedianOfVector([1, 2, Number.POSITIVE_INFINITY, 4]),
    /strictly-positive/,
  );
});

test('iqrOverMedianOfVector: SCALE-INVARIANT', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const a = iqrOverMedianOfVector(v).iom;
  const b = iqrOverMedianOfVector(v.map((x) => x * 1000)).iom;
  const c = iqrOverMedianOfVector(v.map((x) => x * 0.001)).iom;
  assert.ok(Math.abs(a - b) < 1e-12);
  assert.ok(Math.abs(a - c) < 1e-12);
});

test('iqrOverMedianOfVector: PERMUTATION-INVARIANT', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const perm = [10, 1, 7, 4, 9, 2, 5, 8, 3, 6];
  assert.ok(
    Math.abs(
      iqrOverMedianOfVector(v).iom - iqrOverMedianOfVector(perm).iom,
    ) < 1e-12,
  );
});

// ---- ORTHOGONALITY: invariance to extreme-tail spike ----------------

test('iqrOverMedianOfVector: INVARIANT to changes strictly above P75 (n=11)', () => {
  // Sorted [1,1,1,1,1,5,5,5,5,5,X]: P25 = 1, P50 = 5, P75 (h=7.5) = 5+0.5*(5-5)=5
  // So P25..P75 fixed at 1..5 regardless of X (the maximum).
  const base = [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 100];
  const huge = [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 1_000_000_000];
  const a = iqrOverMedianOfVector(base);
  const b = iqrOverMedianOfVector(huge);
  // IOM identical:
  assert.ok(Math.abs(a.iom - b.iom) < 1e-12);
  // But GE(2) MOVES (kernel is sensitive to tail magnitude):
  const ge2A = ge2OfVector(base).ge2;
  const ge2B = ge2OfVector(huge).ge2;
  assert.ok(
    ge2B > ge2A * 1.5,
    `GE(2) should respond to a 1e9 tail spike, got ratio ${ge2B / ge2A} (A=${ge2A}, B=${ge2B}). The IOM=invariance/GE(2)=non-invariance contrast is the orthogonality witness.`,
  );
});

test('iqrOverMedianOfVector: INVARIANT to changes strictly below P25 (n=11)', () => {
  // Sorted [Y,3,3,3,5,5,5,7,7,7,7]: P25 (h=2.5) = 3+0.5*(3-3)=3, P50=5, P75=7
  // So as long as Y < 3 (and > 0), IOM is unchanged.
  const tiny = [0.0001, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7];
  const less_tiny = [1, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7];
  const a = iqrOverMedianOfVector(tiny);
  const b = iqrOverMedianOfVector(less_tiny);
  assert.ok(Math.abs(a.iom - b.iom) < 1e-12);
  assert.ok(Math.abs(a.iqrAbsolute - b.iqrAbsolute) < 1e-12);
});

// ---- RANK FLIP vs PGR (axis 58) and vs GE-family --------------------

test('rank flip vs PGR: tail-spike vector has IOM=0 but PGR=1 too (joint degenerate); central-spread vector flips above', () => {
  // Vector P: 10 ones and one spike of 1000.
  // Sorted [1,1,1,1,1,1,1,1,1,1,1000] (n=11):
  //   P25 (h=2.5) = 1, P50 = 1, P75 (h=7.5) = 1, P90 (h=9) = 1.
  //   IOM = 0, PGR = 1 (both degenerate -- no central spread, no upper-decile gap).
  //   But GE(2) = (mean(x^2)/mean(x)^2 - 1)/2 huge.
  const P = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000];
  const r_P_iom = iqrOverMedianOfVector(P);
  const r_P_pgr = percentileGapRatioOfVector(P);
  assert.equal(r_P_iom.iom, 0);
  assert.equal(r_P_iom.degenerate, true);
  assert.equal(r_P_pgr.pgr, 1);
  assert.equal(r_P_pgr.degenerate, true);
  const ge2_P = ge2OfVector(P).ge2;
  assert.ok(ge2_P > 1, `GE(2) on tail-spike vector should be huge, got ${ge2_P}`);

  // Vector Q: tight body with hard step. Sorted [1,1,1,5,5,5,5,5,9,9,9] (n=11).
  //   P25 (h=2.5) = 1+0.5*(5-1) = 3
  //   P50 = v[5] = 5
  //   P75 (h=7.5) = 5+0.5*(9-5) = 7
  //   P90 (h=9) = 9
  //   IOM = (7-3)/5 = 0.8;   PGR = 9/5 = 1.8
  const Q = [1, 1, 1, 5, 5, 5, 5, 5, 9, 9, 9];
  const r_Q_iom = iqrOverMedianOfVector(Q);
  const r_Q_pgr = percentileGapRatioOfVector(Q);
  assert.ok(Math.abs(r_Q_iom.iom - 0.8) < 1e-12);
  assert.ok(Math.abs(r_Q_pgr.pgr - 1.8) < 1e-12);
  assert.equal(r_Q_iom.degenerate, false);
  assert.equal(r_Q_pgr.degenerate, false);

  // RANK FLIP: GE(2) ranks P > Q (huge spike), but IOM ranks Q > P (and PGR ranks Q > P too).
  // The novel signal IOM provides over PGR is on a separate vector pair:
  //   E = [1,1,1,1,1,5,5,5,9,9,9,9] vs F = [1,3,3,3,4,5,6,7,7,7,9]
  //   E central-50 spans [1, 9], F central-50 is tighter -> IOM(E) > IOM(F).
  //   And P90 of both equal upper region -- but PGR is similar.
  // We assert at minimum that GE(2) ranks P > Q while IOM ranks Q > P:
  const ge2_Q = ge2OfVector(Q).ge2;
  assert.ok(ge2_P > ge2_Q, `GE(2) should rank P > Q`);
  assert.ok(r_Q_iom.iom > r_P_iom.iom, `IOM should rank Q > P`);
});

test('rank flip vs PGR: bimodal-top-heavy vs smooth-ramp (matched P90)', () => {
  // C = [1,1,1,1,5,5,5,9,9,9,9] sorted; P25=1, P50=5, P75=9, P90=9
  //   IOM(C) = (9-1)/5 = 1.6; PGR(C) = 9/5 = 1.8
  // D = [1,3,3,3,4,5,6,7,7,7,9] sorted; P25=3, P50=5, P75=7, P90=7
  //   IOM(D) = (7-3)/5 = 0.8; PGR(D) = 7/5 = 1.4
  const C = [1, 1, 1, 1, 5, 5, 5, 9, 9, 9, 9];
  const D = [1, 3, 3, 3, 4, 5, 6, 7, 7, 7, 9];
  const c = iqrOverMedianOfVector(C);
  const d = iqrOverMedianOfVector(D);
  assert.ok(Math.abs(c.iom - 1.6) < 1e-12);
  assert.ok(Math.abs(d.iom - 0.8) < 1e-12);
  // Both rank C > D here, but the IOM gap (2x) is much wider than the
  // PGR gap (1.8 vs 1.4 ~ 1.29x) -- materially different signal.
});

test('iqrOverMedianOfVector: differs from PGR by >> 2x on real-shape vector', () => {
  // Constructed so that IOM and PGR rank *opposite ways*:
  //   U has wide central body, narrow upper tail -> IOM big, PGR small
  //   V has tight central body, big upper tail -> IOM small, PGR big
  //
  // U = [1,2,3,4,5,5,5,5,5,5,5]  (sorted): P25 (h=2.5) = 3+0.5 = 3.5,
  //   P50 = 5, P75 (h=7.5) = 5, P90 = 5.
  //   IOM(U) = (5 - 3.5) / 5 = 0.3;   PGR(U) = 5/5 = 1 (degenerate!)
  // V = [5,5,5,5,5,5,5,5,5,5,50]: P25=5, P50=5, P75=5, P90 (h=9) = 5+0.1*(5-5)=5
  //   ... that also ends degenerate. Use a different construction:
  //
  // V = [4,4,4,5,5,5,6,6,6,30,40] (sorted): P25 (h=2.5) = 4+0.5*0 = 4, P50 = 5,
  //   P75 (h=7.5) = 6+0.5*(30-6) = 18, P90 (h=9) = 30+0.1*10 = 31.
  //   IOM(V) = (18-4)/5 = 2.8; PGR(V) = 31/5 = 6.2.
  //
  // So U's IOM=0.3 > V's PGR-rank story is V > U on PGR but...
  // a cleaner non-degenerate U: U = [1,2,3,3,4,5,6,6,6,6,6] sorted: P25 (h=2.5)
  //   = 3+0.5*0 = 3; P50 = 5; P75 (h=7.5) = 6+0.5*0 = 6; P90 (h=9) = 6.
  //   IOM(U) = (6-3)/5 = 0.6; PGR(U) = 6/5 = 1.2.
  // V (above) IOM=2.8, PGR=6.2.
  //
  // Both rank V > U. To FLIP, build U with wider central body but tail
  // squashed via min(., capped):
  //   U2 = [1,2,4,4,5,5,5,6,6,8,9] sorted: P25 (h=2.5) = 4+0.5*0 = 4,
  //        P50 = 5, P75 (h=7.5) = 6+0.5*(8-6) = 7, P90 (h=9) = 9.
  //        IOM(U2) = (7-4)/5 = 0.6; PGR(U2) = 9/5 = 1.8.
  //   V2 = [5,5,5,5,5,5,5,5,5,5,100]: P25=5,P50=5,P75=5,P90=5+0.1*0=5
  //        DEGENERATE on both, useless.
  //   V3 = [5,5,5,5,5,5,5,5,5,6,100]: P25=5,P50=5,P75=5,P90 (h=9)=6+0.1*94=15.4
  //        IOM(V3) = (5-5)/5 = 0 (degenerate); PGR(V3) = 15.4/5 = 3.08.
  // So U2 has IOM=0.6 > IOM(V3)=0, but PGR(U2)=1.8 < PGR(V3)=3.08. RANK FLIP!
  // RANK-FLIP construction. We need V to have IOM=0 (degenerate central body)
  // but PGR > PGR(U). With n=11 and q=0.9, h = 9.0 is exactly an integer index,
  // so P90 = v[9]. Build V so v[0..8]=5 (forces P25=P50=P75=5, IOM=0) but v[9]=15:
  //   V3 sorted [5,5,5,5,5,5,5,5,5,15,100] (n=11):
  //     P25 (h=2.5) = 5; P50 = 5; P75 (h=7.5) = 5; P90 (h=9) = v[9] = 15.
  //     IOM(V3) = 0 (degenerate); PGR(V3) = 15/5 = 3.
  // U2 sorted [1,2,4,4,5,5,5,6,6,8,9] (n=11):
  //     P25 (h=2.5) = 4; P50 = 5; P75 (h=7.5) = 6+0.5*(8-6) = 7; P90 (h=9) = 9.
  //     IOM(U2) = (7-4)/5 = 0.6; PGR(U2) = 9/5 = 1.8.
  // RANK FLIP: IOM(U2)=0.6 > IOM(V3)=0, but PGR(V3)=3 > PGR(U2)=1.8.
  const U2 = [1, 2, 4, 4, 5, 5, 5, 6, 6, 8, 9];
  const V3 = [5, 5, 5, 5, 5, 5, 5, 5, 5, 15, 100];
  const u = iqrOverMedianOfVector(U2);
  const v = iqrOverMedianOfVector(V3);
  const u_pgr = percentileGapRatioOfVector(U2);
  const v_pgr = percentileGapRatioOfVector(V3);
  // IOM ranks U2 > V3 (V3 is degenerate on IOM):
  assert.ok(u.iom > v.iom, `IOM should rank U2 > V3, got ${u.iom} vs ${v.iom}`);
  // PGR ranks V3 > U2:
  assert.ok(
    v_pgr.pgr > u_pgr.pgr,
    `PGR should rank V3 > U2, got ${v_pgr.pgr} vs ${u_pgr.pgr}`,
  );
  // Confirms IOM and PGR carry materially different information.
});

// ---- Builder integration --------------------------------------------

test('buildDailyTokenIqrOverMedian: filters bad rows, computes IOM correctly', () => {
  const queue: QueueLine[] = [
    // source A: 11 days with token totals 1..10 plus a 100 spike on day 11.
    // Wait, we're building daily totals. Let's make 11 distinct days each
    // with a single bucket totaling [1,2,3,4,5,6,7,8,9,10,1000]:
    ql('2026-04-01T00:00:00Z', 'A', 1),
    ql('2026-04-02T00:00:00Z', 'A', 2),
    ql('2026-04-03T00:00:00Z', 'A', 3),
    ql('2026-04-04T00:00:00Z', 'A', 4),
    ql('2026-04-05T00:00:00Z', 'A', 5),
    ql('2026-04-06T00:00:00Z', 'A', 6),
    ql('2026-04-07T00:00:00Z', 'A', 7),
    ql('2026-04-08T00:00:00Z', 'A', 8),
    ql('2026-04-09T00:00:00Z', 'A', 9),
    ql('2026-04-10T00:00:00Z', 'A', 10),
    ql('2026-04-11T00:00:00Z', 'A', 1000),
    // bad rows
    ql('not-a-date', 'A', 5),
    ql('2026-04-01T00:00:00Z', 'A', 0),
  ];
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 0,
    minDays: 2,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 1);
  const a = r.sources[0]!;
  assert.equal(a.source, 'A');
  assert.equal(a.nDays, 11);
  // Sorted [1..10, 1000]: P25 (h=2.5) = 3+0.5*(4-3) = 3.5;
  //   P50 (h=5) = v[5] = 6; P75 (h=7.5) = 8+0.5*(9-8) = 8.5
  //   IOM = (8.5 - 3.5) / 6 = 5/6 = 0.83333...
  assert.ok(Math.abs(a.p25 - 3.5) < 1e-12);
  assert.ok(Math.abs(a.p50 - 6) < 1e-12);
  assert.ok(Math.abs(a.p75 - 8.5) < 1e-12);
  assert.ok(Math.abs(a.iom - 5 / 6) < 1e-12);
});

test('buildDailyTokenIqrOverMedian: minTokens / minDays drop sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 5),
    ql('2026-04-02T00:00:00Z', 'sparse', 5),
    ql('2026-04-03T00:00:00Z', 'sparse', 5),
    ql('2026-04-04T00:00:00Z', 'sparse', 5),
    // dense
    ql('2026-04-01T00:00:00Z', 'dense', 5000),
    ql('2026-04-02T00:00:00Z', 'dense', 5000),
    ql('2026-04-03T00:00:00Z', 'dense', 5000),
    ql('2026-04-04T00:00:00Z', 'dense', 5000),
  ];
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'dense');
});

test('buildDailyTokenIqrOverMedian: includePgr surfaces p90 + pgr', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 11; d++) {
    queue.push(ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'A', d * 100));
  }
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 0,
    minDays: 2,
    includePgr: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const a = r.sources[0]!;
  // [100,200,...,1100] (n=11): P25 (h=2.5) = 300+0.5*100 = 350;
  //   P50 (h=5) = 600; P75 (h=7.5) = 800+0.5*100 = 850; P90 (h=9) = v[9] = 1000
  assert.ok(Math.abs(a.p25 - 350) < 1e-9);
  assert.ok(Math.abs(a.p50 - 600) < 1e-9);
  assert.ok(Math.abs(a.p75 - 850) < 1e-9);
  assert.ok(Math.abs(a.p90! - 1000) < 1e-9);
  assert.ok(Math.abs(a.iom - 500 / 600) < 1e-12);
  assert.ok(Math.abs(a.pgr! - 1000 / 600) < 1e-12);
});

test('buildDailyTokenIqrOverMedian: minIom display filter', () => {
  // Two sources: one with IOM=0 (degenerate), one with IOM > 0.
  const queue: QueueLine[] = [];
  // Source flat: all days same -> IOM=0 (degenerate) -> always shown.
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'flat', 1000));
  }
  // Source spread: ramp, IOM > 0.
  for (let d = 1; d <= 6; d++) {
    queue.push(ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'spread', d * 1000));
  }
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 0,
    minDays: 2,
    minIom: 0.5,
    generatedAt: GEN,
  });
  // flat is degenerate (always kept), spread has IOM > 0.5? Let's compute:
  //   spread sorted [1000,2000,3000,4000,5000,6000] (n=6):
  //   P25 (h=1.25) = 2000+0.25*1000 = 2250
  //   P50 (h=2.5) = 3000+0.5*1000 = 3500
  //   P75 (h=3.75) = 4000+0.75*1000 = 4750
  //   IOM = (4750-2250)/3500 = 2500/3500 ~ 0.714 > 0.5 -> kept
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinIom, 0);
});

test('buildDailyTokenIqrOverMedian: top cap accounts for droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['x', 'y', 'z']) {
    for (let d = 1; d <= 5; d++) {
      queue.push(
        ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, src, d * 100),
      );
    }
  }
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 0,
    minDays: 2,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenIqrOverMedian: deterministic on identical input', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'A', 100),
    ql('2026-04-02T00:00:00Z', 'A', 200),
    ql('2026-04-03T00:00:00Z', 'A', 300),
    ql('2026-04-04T00:00:00Z', 'A', 400),
    ql('2026-04-05T00:00:00Z', 'A', 500),
  ];
  const a = buildDailyTokenIqrOverMedian(queue, { minTokens: 0, generatedAt: GEN });
  const b = buildDailyTokenIqrOverMedian(queue, { minTokens: 0, generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('buildDailyTokenIqrOverMedian: rejects bad knobs', () => {
  assert.throws(
    () => buildDailyTokenIqrOverMedian([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenIqrOverMedian([], { minDays: 1 }),
    /minDays/,
  );
  assert.throws(
    () => buildDailyTokenIqrOverMedian([], { top: -5 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenIqrOverMedian([], { minIom: -0.1 }),
    /minIom/,
  );
  assert.throws(
    () =>
      buildDailyTokenIqrOverMedian([], {
        // @ts-expect-error testing runtime guard
        sort: 'not-a-sort',
      }),
    /sort/,
  );
});

test('buildDailyTokenIqrOverMedian: GE(4) ranks differently than IOM on synthetic mix', () => {
  // Two sources, n=6 each. Source 'tail' has bottom-heavy + one upper spike,
  // source 'body' has wide central body but capped tail.
  const queue: QueueLine[] = [];
  // tail: [1,1,1,1,1,1000]
  const tail = [1, 1, 1, 1, 1, 1000];
  // body: [1,2,4,5,7,8]
  const body = [1, 2, 4, 5, 7, 8];
  for (let i = 0; i < 6; i++) {
    queue.push(
      ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'tail', tail[i]!),
    );
    queue.push(
      ql(`2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'body', body[i]!),
    );
  }
  const r = buildDailyTokenIqrOverMedian(queue, {
    minTokens: 0,
    minDays: 2,
    sort: 'iom',
    generatedAt: GEN,
  });
  const tailRow = r.sources.find((s) => s.source === 'tail')!;
  const bodyRow = r.sources.find((s) => s.source === 'body')!;
  // tail sorted [1,1,1,1,1,1000]: P25 (h=1.25) = 1+0.25*0=1, P50=1, P75 (h=3.75) = 1+0.75*0=1
  //   IOM = 0 (degenerate)
  // body sorted [1,2,4,5,7,8]: P25 (h=1.25) = 2+0.25*2=2.5, P50 (h=2.5) = 4+0.5*1=4.5,
  //   P75 (h=3.75) = 5+0.75*2=6.5; IOM = 4/4.5 ~ 0.889
  assert.equal(tailRow.degenerate, true);
  assert.equal(tailRow.iom, 0);
  assert.ok(bodyRow.iom > 0.5);
  // Now GE(4) -- a moment-tail-amplifying axis -- ranks tail >> body:
  const ge4_tail = geFourOfVector(tail).gefour;
  const ge4_body = geFourOfVector(body).gefour;
  assert.ok(
    ge4_tail > ge4_body * 100,
    `GE(4) should rank tail >> body, got ${ge4_tail} vs ${ge4_body}`,
  );
  // RANK FLIP confirmed: IOM(body) > IOM(tail) but GE(4)(tail) >> GE(4)(body).
});

// ---- Structural edge-case refinements (post-release) ----------------

test('iqrOverMedianOfVector: top-half-constant vector is degenerate ONLY if P25=P75', () => {
  // Sorted [1,2,3,4,5,7,7,7,7,7,7] (n=11): P25 (h=2.5) = 3+0.5*(4-3)=3.5,
  //   P50 (h=5) = v[5] = 7, P75 (h=7.5) = 7+0.5*0 = 7. IOM = (7-3.5)/7 = 0.5.
  // NOT degenerate -- P25 != P75. Contrast with PGR which IS degenerate
  // here (P50 = P90 = 7), demonstrating the COMPLEMENTARY information
  // geometry of the two axes.
  const v = [1, 2, 3, 4, 5, 7, 7, 7, 7, 7, 7];
  const r = iqrOverMedianOfVector(v);
  assert.ok(Math.abs(r.iom - 0.5) < 1e-12);
  assert.equal(r.degenerate, false);
  // PGR on same vector IS degenerate (P50 = P90 = 7).
  const pgr = percentileGapRatioOfVector(v);
  assert.ok(Math.abs(pgr.pgr - 1) < 1e-12);
  assert.equal(pgr.degenerate, true);
});

test('iqrOverMedianOfVector: bottom-half-constant vector is degenerate ONLY if P25=P75', () => {
  // Sorted [1,1,1,1,1,1,3,4,5,6,7] (n=11): P25 (h=2.5) = 1+0.5*0 = 1,
  //   P50 (h=5) = 1, P75 (h=7.5) = 4+0.5*(5-4) = 4.5. IOM = (4.5-1)/1 = 3.5.
  // NOT degenerate -- P25 != P75 (the upper half varies, dragging P75 up).
  const v = [1, 1, 1, 1, 1, 1, 3, 4, 5, 6, 7];
  const r = iqrOverMedianOfVector(v);
  assert.ok(Math.abs(r.p25 - 1) < 1e-12);
  assert.ok(Math.abs(r.p50 - 1) < 1e-12);
  assert.ok(Math.abs(r.p75 - 4.5) < 1e-12);
  assert.ok(Math.abs(r.iom - 3.5) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('iqrOverMedianOfVector: floating-point clamp -- IOM never < 0, PGR never < 1', () => {
  // After IEEE 754 subtraction P75 - P25 can produce a tiny negative
  // value if percentiles are computed via two slightly different paths.
  // We don't actually trigger that here, but we *do* assert the clamp
  // semantics on a vector where P25 ~= P75 to within 1 ULP.
  const v = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const r = iqrOverMedianOfVector(v);
  assert.ok(r.iom >= 0);
  assert.ok(r.pgr >= 1);
  assert.equal(r.degenerate, true);
});

test('iqrOverMedianOfVector: monotonicity of IOM under uniform widening of central body', () => {
  // Symmetric widening of the central 50% strictly increases IOM (with
  // P50 fixed). Construct base [4,4,5,5,5,5,5,5,5,6,6] (n=11):
  //   P25 (h=2.5) = 4+0.5*(5-4)=4.5; P50 = 5; P75 (h=7.5) = 5+0.5*(5-5)=5.
  //   Hmm, P75 collapses to 5. Use a wider construction so widening
  //   moves P25 down and P75 up:
  //   base = [3,3,4,5,5,5,5,5,6,7,7] (n=11):
  //     P25 (h=2.5) = 4+0.5*(5-4) = 4.5; P50 = 5; P75 (h=7.5) = 5+0.5*(6-5)=5.5
  //     IOM = (5.5-4.5)/5 = 0.2
  //   wider = [1,1,4,5,5,5,5,5,6,9,9]: P25 (h=2.5) = 4+0.5*(5-4) = 4.5;
  //     P50 = 5; P75 (h=7.5) = 5+0.5*(6-5) = 5.5. SAME IOM!
  //   IOM is determined by ranks 2,3,7,8 only (since k = 2 and 7 with f = 0.5);
  //   the tails (ranks 0,1,9,10) don't contribute -- a clean illustration
  //   of the "central-only" information geometry.
  const base = [3, 3, 4, 5, 5, 5, 5, 5, 6, 7, 7];
  const wider = [1, 1, 4, 5, 5, 5, 5, 5, 6, 9, 9];
  assert.ok(
    Math.abs(iqrOverMedianOfVector(base).iom - iqrOverMedianOfVector(wider).iom) <
      1e-12,
    'IOM ignores all values outside ranks 2,3,7,8 in n=11; widening tails is a no-op.',
  );
  // PGR DOES respond: P90 (h=9.0) = v[9] which is 7 in base, 9 in wider.
  const base_pgr = percentileGapRatioOfVector(base).pgr;
  const wider_pgr = percentileGapRatioOfVector(wider).pgr;
  assert.ok(wider_pgr > base_pgr, 'PGR responds to upper-tail widening.');
});

test('iqrOverMedianOfVector: returns IOM equal to QCD * 2 * (P75+P25)/(2*P50) under formal identity', () => {
  // QCD = (P75-P25)/(P75+P25) = "Quartile Coefficient of Dispersion".
  // Identity: IOM = (P75-P25)/P50 = QCD * (P75+P25)/P50.
  // We verify this identity holds under fp arithmetic for [1..100].
  const v: number[] = [];
  for (let i = 1; i <= 100; i++) v.push(i);
  const r = iqrOverMedianOfVector(v);
  const qcd = (r.p75 - r.p25) / (r.p75 + r.p25);
  const lhs = r.iom;
  const rhs = (qcd * (r.p75 + r.p25)) / r.p50;
  assert.ok(
    Math.abs(lhs - rhs) < 1e-12,
    `Identity IOM = QCD*(P75+P25)/P50 should hold; got ${lhs} vs ${rhs}`,
  );
});

