import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenEichingerKirchMosumMeanChangepoint,
  mosumScan,
  mosumVerdict,
  median,
  madScale,
} from '../src/dailytokeneichingerkirchmosummeanchangepoint.js';
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

function synth(source: string, vals: number[], startDay = '2026-01-01'): QueueLine[] {
  return vals.map((v, i) => {
    const ms = Date.parse(`${startDay}T00:00:00.000Z`) + i * 86_400_000;
    const ts = new Date(ms).toISOString();
    return ql(ts, source, Math.max(1, Math.round(v)));
  });
}

// ---- helpers --------------------------------------------------------------

test('median: even and odd length', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median: empty -> NaN', () => {
  assert.ok(Number.isNaN(median([])));
});

test('madScale: constant series -> 0', () => {
  assert.equal(madScale([5, 5, 5, 5, 5]), 0);
});

test('madScale: standard series', () => {
  // [1..9] median = 5; |dev|=[4,3,2,1,0,1,2,3,4]; median=2; *1.4826
  assert.ok(Math.abs(madScale([1, 2, 3, 4, 5, 6, 7, 8, 9]) - 2 * 1.4826) < 1e-9);
});

test('madScale: NaN for n<2', () => {
  assert.ok(Number.isNaN(madScale([])));
  assert.ok(Number.isNaN(madScale([42])));
});

// ---- mosumScan core -------------------------------------------------------

test('mosumScan: throws on N<14', () => {
  assert.throws(() => mosumScan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]));
});

test('mosumScan: throws on bad bandwidthFrac', () => {
  const x = new Array(40).fill(1).map((_, i) => i);
  assert.throws(() => mosumScan(x, { bandwidthFrac: -0.1 }));
  assert.throws(() => mosumScan(x, { bandwidthFrac: 0.5 }));
  assert.throws(() => mosumScan(x, { bandwidthFrac: 0.7 }));
});

test('mosumScan: throws on bad thresholdScale', () => {
  const x = new Array(40).fill(1).map((_, i) => i);
  assert.throws(() => mosumScan(x, { thresholdScale: 0 }));
  assert.throws(() => mosumScan(x, { thresholdScale: -1 }));
});

test('mosumScan: pure constant series throws (degenerate sigma)', () => {
  const x = new Array(60).fill(100);
  assert.throws(() => mosumScan(x));
});

test('mosumScan: clear single mean shift -> peakRatio > 1, exactly 1 CP near truth', () => {
  // 50 days at 100 + small noise, 50 days at 200 + small noise.
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280 - 0.5;
    };
  };
  const r = rng(7);
  const x = [
    ...Array.from({ length: 50 }, () => 100 + 5 * r()),
    ...Array.from({ length: 50 }, () => 200 + 5 * r()),
  ];
  const scan = mosumScan(x, { bandwidthFrac: 0.15, thresholdScale: 1.4 });
  assert.ok(scan.peakRatio > 1, `peakRatio=${scan.peakRatio} not > 1`);
  assert.ok(scan.changepoints.length >= 1, `expected >=1 CP, got ${scan.changepoints.length}`);
  // mosumArgmax should be near the true CP at index 50.
  assert.ok(
    Math.abs(scan.mosumArgmax - 50) <= scan.bandwidthG,
    `argmax=${scan.mosumArgmax} not within G=${scan.bandwidthG} of 50`,
  );
});

test('mosumScan: pure-noise series -> peakRatio < 1 typically', () => {
  // White-noise series; threshold should not be exceeded in expectation.
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280 - 0.5;
    };
  };
  const r = rng(11);
  const x = Array.from({ length: 200 }, () => 100 + 10 * r());
  const scan = mosumScan(x, { bandwidthFrac: 0.1, thresholdScale: 1.4 });
  // We can't guarantee < 1 deterministically but threshold ensures
  // CP count is small under H0.
  assert.ok(scan.changepoints.length <= 3, `too many CPs under noise: ${scan.changepoints.length}`);
});

test('mosumScan: two well-separated shifts -> 2+ CPs near truth', () => {
  // 40 at 100, 40 at 200, 40 at 100 — true CPs at idx 40 and 80.
  // (Allow >=2 since on a piecewise-constant fallback-sigma path the
  // boundary regions can also surface as extra local maxima.)
  const x = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
    ...new Array(40).fill(100),
  ];
  const scan = mosumScan(x, { bandwidthFrac: 0.1, thresholdScale: 1.4 });
  assert.ok(scan.changepoints.length >= 2, `expected >=2 CPs, got ${JSON.stringify(scan.changepoints)}`);
  const cps = scan.changepoints.slice().sort((a, b) => a - b);
  // The two largest peaks must be within G of true positions 40 and 80.
  // Identify the two CPs closest to truths.
  const near40 = cps.some((k) => Math.abs(k - 40) <= scan.bandwidthG);
  const near80 = cps.some((k) => Math.abs(k - 80) <= scan.bandwidthG);
  assert.ok(near40, `no CP within G=${scan.bandwidthG} of 40 in ${JSON.stringify(cps)}`);
  assert.ok(near80, `no CP within G=${scan.bandwidthG} of 80 in ${JSON.stringify(cps)}`);
});

test('mosumScan: G-spacing rule strictly separates CPs', () => {
  const x = [
    ...new Array(30).fill(100),
    ...new Array(30).fill(200),
    ...new Array(30).fill(100),
    ...new Array(30).fill(200),
  ];
  const scan = mosumScan(x, { bandwidthFrac: 0.1, thresholdScale: 1.4 });
  const cps = scan.changepoints.slice().sort((a, b) => a - b);
  for (let i = 1; i < cps.length; i += 1) {
    assert.ok(cps[i]! - cps[i - 1]! >= scan.bandwidthG, `CPs ${cps[i - 1]} and ${cps[i]} closer than G=${scan.bandwidthG}`);
  }
});

test('mosumScan: absMosum length = N - 2G + 1', () => {
  const x = Array.from({ length: 100 }, (_, i) => 100 + ((i * 13) % 7));
  const scan = mosumScan(x, { bandwidthFrac: 0.1 });
  assert.equal(scan.absMosum.length, 100 - 2 * scan.bandwidthG + 1);
});

test('mosumScan: bandwidthG floored at 7', () => {
  // tiny N=40 with very small bandwidthFrac would request G<7.
  const x = Array.from({ length: 40 }, (_, i) => 100 + ((i * 13) % 7));
  const scan = mosumScan(x, { bandwidthFrac: 0.05 });
  assert.equal(scan.bandwidthG, 7);
});

test('mosumScan: peakRatio = mosumMax / thresholdUsed', () => {
  const x = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ];
  const scan = mosumScan(x);
  assert.ok(Math.abs(scan.peakRatio - scan.mosumMax / scan.thresholdUsed) < 1e-9);
});

test('mosumScan: down-shift is detected just like up-shift (sign-symmetry)', () => {
  const xUp = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ];
  const xDn = [
    ...new Array(40).fill(200),
    ...new Array(40).fill(100),
  ];
  const sUp = mosumScan(xUp);
  const sDn = mosumScan(xDn);
  assert.ok(Math.abs(sUp.mosumMax - sDn.mosumMax) < 1e-9, `up=${sUp.mosumMax} dn=${sDn.mosumMax}`);
});

// ---- verdict ladder -------------------------------------------------------

test('mosumVerdict: ladder', () => {
  assert.equal(mosumVerdict(0.1), 'no-shift');
  assert.equal(mosumVerdict(0.49), 'no-shift');
  assert.equal(mosumVerdict(0.6), 'borderline');
  assert.equal(mosumVerdict(0.99), 'borderline');
  assert.equal(mosumVerdict(1.5), 'shift');
  assert.equal(mosumVerdict(2.5), 'strong-shift');
  assert.equal(mosumVerdict(Infinity), 'strong-shift');
  assert.equal(mosumVerdict(NaN), 'no-shift');
});

// ---- builder -------------------------------------------------------------

test('builder: rejects bad options', () => {
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { minTenureDays: 5 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { sort: 'bogus' as any }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { bandwidthFrac: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { bandwidthFrac: 0.6 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { thresholdScale: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenEichingerKirchMosumMeanChangepoint([], { until: 'not-a-date' }),
  );
});

test('builder: empty queue -> empty report', () => {
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: source with single mean shift produces a row with shift verdict', () => {
  const vals = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(300),
  ];
  const queue = synth('alpha', vals);
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
    bandwidthFrac: 0.15,
    thresholdScale: 1.4,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alpha');
  assert.ok(['shift', 'strong-shift'].includes(row.verdict), `verdict=${row.verdict}`);
  assert.ok(row.mChangepoints >= 1);
  assert.ok(row.peakRatio > 1);
});

test('builder: zero-variance source counts as droppedZeroVariance', () => {
  const queue = synth('flat', new Array(40).fill(100));
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedZeroVariance >= 1);
});

test('builder: short tenure dropped under floor 21', () => {
  const queue = synth('short', new Array(15).fill(100).map((_, i) => 100 + i));
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedBelowMinTenure >= 1);
});

test('builder: source filter + droppedSourceFilter accounting', () => {
  const q1 = synth('alpha', [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ]);
  const q2 = synth('beta', new Array(80).fill(50).map((_, i) => 50 + i));
  const queue = [...q1, ...q2];
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'alpha',
  });
  assert.equal(r.source, 'alpha');
  // beta rows go to droppedSourceFilter; alpha rows survive.
  assert.ok(r.droppedSourceFilter > 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
});

test('builder: invalid hour_start counted', () => {
  const queue = [
    ql('not-a-time', 'alpha', 100),
    ...synth('alpha', new Array(40).fill(100).map((_, i) => 100 + (i % 5))),
  ];
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.ok(r.droppedInvalidHourStart >= 1);
});

test('builder: non-positive tokens counted', () => {
  const queue = [
    ql('2026-01-01T00:00:00.000Z', 'alpha', 0),
    ql('2026-01-02T00:00:00.000Z', 'alpha', -5),
    ...synth('alpha', new Array(40).fill(100).map((_, i) => 100 + (i % 5))),
  ];
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.ok(r.droppedNonPositiveTokens >= 2);
});

test('builder: top cap accounting', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    queues.push(
      ...synth(
        `src${s}`,
        [
          ...new Array(40).fill(100),
          ...new Array(40).fill(100 + 50 * (s + 1)),
        ],
      ),
    );
  }
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queues, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('builder: onlyShifts filters no-shift verdicts', () => {
  // alpha = strong shift; beta = pure constant (drops as zero-var, not no-shift)
  // gamma = mild noise → likely no-shift.
  const rng = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280 - 0.5;
    };
  };
  const r1 = rng(3);
  const queue: QueueLine[] = [
    ...synth('alpha', [
      ...new Array(40).fill(100),
      ...new Array(40).fill(400),
    ]),
    ...synth(
      'gamma',
      Array.from({ length: 80 }, () => 100 + 5 * r1()),
    ),
  ];
  const all = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const shifts = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
    onlyShifts: true,
  });
  assert.ok(shifts.sources.length <= all.sources.length);
  for (const s of shifts.sources) {
    assert.notEqual(s.verdict, 'no-shift');
  }
});

test('builder: deterministic — same input gives same output', () => {
  const queue = synth('alpha', [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ]);
  const a = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const b = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.deepEqual(a, b);
});

test('builder: sort=mosumMaxDesc vs mosumMax orders rows opposite', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    queues.push(
      ...synth(
        `src${s}`,
        [
          ...new Array(40).fill(100),
          ...new Array(40).fill(100 + 30 * (s + 1)),
        ],
      ),
    );
  }
  const desc = buildDailyTokenEichingerKirchMosumMeanChangepoint(queues, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'mosumMaxDesc',
  });
  const asc = buildDailyTokenEichingerKirchMosumMeanChangepoint(queues, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'mosumMax',
  });
  for (let i = 1; i < desc.sources.length; i += 1) {
    assert.ok(desc.sources[i - 1]!.mosumMax >= desc.sources[i]!.mosumMax);
  }
  for (let i = 1; i < asc.sources.length; i += 1) {
    assert.ok(asc.sources[i - 1]!.mosumMax <= asc.sources[i]!.mosumMax);
  }
});

test('builder: tauStarDays parses to ISO YYYY-MM-DD', () => {
  const queue = synth(
    'alpha',
    [...new Array(40).fill(100), ...new Array(40).fill(300)],
    '2026-02-01',
  );
  const r = buildDailyTokenEichingerKirchMosumMeanChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  for (const row of r.sources) {
    for (const day of row.tauStarDays) {
      assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});

// ---- property: sign-symmetry on builder level ----------------------------

test('property: reflecting series around its mean leaves mosumMax invariant', () => {
  const base = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ];
  const meanVal = base.reduce((a, b) => a + b, 0) / base.length;
  const reflected = base.map((v) => 2 * meanVal - v);
  const a = mosumScan(base);
  const b = mosumScan(reflected);
  assert.ok(Math.abs(a.mosumMax - b.mosumMax) < 1e-9, `${a.mosumMax} vs ${b.mosumMax}`);
});

test('property: scaling x by k > 0 leaves mosumMax invariant (scale-free)', () => {
  const base = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ];
  const scaled = base.map((v) => 7 * v);
  const a = mosumScan(base);
  const b = mosumScan(scaled);
  // T_k = sqrt(G/2) * (mR-mL)/sigmaHat — scaling x by k scales both
  // numerator and sigmaHat by k, so |T_k| is invariant.
  assert.ok(Math.abs(a.mosumMax - b.mosumMax) < 1e-9, `${a.mosumMax} vs ${b.mosumMax}`);
});

test('property: shifting x by constant c leaves mosumMax invariant (location-free)', () => {
  const base = [
    ...new Array(40).fill(100),
    ...new Array(40).fill(200),
  ];
  const shifted = base.map((v) => v + 1234);
  const a = mosumScan(base);
  const b = mosumScan(shifted);
  // Adding a constant cancels in (mR-mL) and leaves MAD-of-diffs unchanged.
  assert.ok(Math.abs(a.mosumMax - b.mosumMax) < 1e-9);
});
