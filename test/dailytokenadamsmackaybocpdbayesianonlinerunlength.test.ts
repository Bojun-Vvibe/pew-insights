import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength,
  bocpdRun,
  studentTLogPdf,
  logGamma,
  median,
  mad,
  sigmaHatMadDiff,
} from '../src/dailytokenadamsmackaybocpdbayesianonlinerunlength.js';
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

test('bocpd: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { minTenureDays: 21.5 }),
  );
});

test('bocpd: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { minTokens: NaN }),
  );
});

test('bocpd: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { top: 1.5 }),
  );
});

test('bocpd: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], {
      sort: 'nope' as 'mChangepoints',
    }),
  );
});

test('bocpd: rejects bad hazardLambda', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { hazardLambda: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { hazardLambda: NaN }),
  );
});

test('bocpd: rejects bad upmKappa', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { upmKappa: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { upmKappa: -1 }),
  );
});

test('bocpd: rejects bad upmAlpha', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { upmAlpha: 0 }),
  );
});

test('bocpd: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { until: 'no' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('median: odd, even, empty', () => {
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('mad: zero on constant, positive on spread', () => {
  assert.equal(mad([5, 5, 5, 5]), 0);
  assert.ok(mad([1, 2, 3, 4, 5]) > 0);
});

test('sigmaHatMadDiff: zero on constant', () => {
  assert.equal(sigmaHatMadDiff([10, 10, 10, 10, 10]), 0);
});

// ---- logGamma / studentTLogPdf -------------------------------------------

test('logGamma: matches known values', () => {
  // Gamma(1) = 1 -> logGamma(1) = 0
  assert.ok(Math.abs(logGamma(1)) < 1e-9);
  // Gamma(2) = 1 -> logGamma(2) = 0
  assert.ok(Math.abs(logGamma(2)) < 1e-9);
  // Gamma(3) = 2 -> logGamma(3) = ln 2
  assert.ok(Math.abs(logGamma(3) - Math.log(2)) < 1e-9);
  // Gamma(0.5) = sqrt(pi) -> logGamma(0.5) = 0.5 ln pi
  assert.ok(Math.abs(logGamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-7);
});

test('studentTLogPdf: peaks at the mean', () => {
  const lp0 = studentTLogPdf(5, 5, 1, 4);
  const lpL = studentTLogPdf(3, 5, 1, 4);
  const lpR = studentTLogPdf(7, 5, 1, 4);
  assert.ok(lp0 > lpL);
  assert.ok(lp0 > lpR);
});

test('studentTLogPdf: symmetric around the mean', () => {
  const a = studentTLogPdf(3, 5, 2, 5);
  const b = studentTLogPdf(7, 5, 2, 5);
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('studentTLogPdf: invalid args yield -infinity', () => {
  assert.equal(studentTLogPdf(0, 0, 0, 5), Number.NEGATIVE_INFINITY);
  assert.equal(studentTLogPdf(0, 0, 1, 0), Number.NEGATIVE_INFINITY);
});

// ---- bocpd core ----------------------------------------------------------

test('bocpdRun: throws on bad args', () => {
  assert.throws(() => bocpdRun([], { hazard: 0.01, upmPrior: { mu: 0, kappa: 1, alpha: 1, beta: 1 } }));
  assert.throws(() => bocpdRun([1, 2, 3], { hazard: 0, upmPrior: { mu: 0, kappa: 1, alpha: 1, beta: 1 } }));
  assert.throws(() => bocpdRun([1, 2, 3], { hazard: 1, upmPrior: { mu: 0, kappa: 1, alpha: 1, beta: 1 } }));
  assert.throws(() => bocpdRun([1, 2, 3], { hazard: 0.5, upmPrior: { mu: 0, kappa: 0, alpha: 1, beta: 1 } }));
  assert.throws(() => bocpdRun([1, 2, 3], { hazard: 0.5, upmPrior: { mu: 0, kappa: 1, alpha: 0, beta: 1 } }));
  assert.throws(() => bocpdRun([1, 2, 3], { hazard: 0.5, upmPrior: { mu: 0, kappa: 1, alpha: 1, beta: 0 } }));
});

test('bocpdRun: posteriors sum to 1', () => {
  const x = [10, 11, 9, 10, 12, 200, 201, 199, 200, 198];
  const r = bocpdRun(x, {
    hazard: 1 / 50,
    upmPrior: { mu: 100, kappa: 1, alpha: 1, beta: 100 },
  });
  for (const post of r.posteriors) {
    let s = 0;
    for (const p of post.p) s += p;
    assert.ok(Math.abs(s - 1) < 1e-9, `sum=${s}`);
  }
});

test('bocpdRun: detects sharp single mean shift', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = bocpdRun(x, {
    hazard: 1 / 50,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  });
  assert.ok(r.tauStar.length >= 1, `expected >=1 CP, got ${r.tauStar.length}`);
  let nearest = Infinity;
  for (const t of r.tauStar) {
    const d = Math.abs(t - 30);
    if (d < nearest) nearest = d;
  }
  assert.ok(nearest <= 3, `nearest CP distance ${nearest}`);
});

test('bocpdRun: zero CPs on a stable series with strong informative prior', () => {
  const x: number[] = [];
  for (let i = 0; i < 50; i += 1) x.push(10);
  const r = bocpdRun(x, {
    hazard: 1 / 1000,
    upmPrior: { mu: 10, kappa: 100, alpha: 100, beta: 100 },
  });
  // The rMap on a constant series should never collapse back to 0 after t=1.
  // Constant data is strongly explained by the growing segment.
  assert.equal(r.tauStar.length, 0);
  assert.ok(r.maxRunLengthMap >= 40);
});

test('bocpdRun: deterministic on identical inputs', () => {
  const x = [1, 2, 3, 4, 5, 100, 101, 102, 103, 104];
  const opts = {
    hazard: 1 / 50,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  };
  const a = bocpdRun(x, opts);
  const b = bocpdRun(x, opts);
  assert.deepEqual(a.tauStar, b.tauStar);
  assert.equal(a.cpProbability, b.cpProbability);
  assert.equal(a.posteriorEntropy, b.posteriorEntropy);
});

test('bocpdRun: tauStar is strictly ascending', () => {
  const x: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) x.push(0);
    else if (i < 60) x.push(50);
    else x.push(100);
  }
  const r = bocpdRun(x, {
    hazard: 1 / 30,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  });
  for (let i = 1; i < r.tauStar.length; i += 1) {
    assert.ok(r.tauStar[i]! > r.tauStar[i - 1]!);
  }
});

test('bocpdRun: cpProbability bounded in [0, 1]', () => {
  const x = [1, 2, 3, 4, 5, 100, 101, 102, 103, 104, 1000, 1001, 1002];
  const r = bocpdRun(x, {
    hazard: 1 / 30,
    upmPrior: { mu: 100, kappa: 1, alpha: 2, beta: 100 },
  });
  assert.ok(r.cpProbability >= 0);
  assert.ok(r.cpProbability <= 1);
});

test('bocpdRun: posteriorEntropy non-negative', () => {
  const x = [1, 2, 3, 4, 5, 100, 101, 102, 103, 104];
  const r = bocpdRun(x, {
    hazard: 1 / 30,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  });
  assert.ok(r.posteriorEntropy >= 0);
  // Upper bound: log(n) for n=10
  assert.ok(r.posteriorEntropy <= Math.log(11) + 1e-9);
});

test('bocpdRun: posteriors length equals n', () => {
  const x = [1, 2, 3, 4, 5, 100, 101, 102];
  const r = bocpdRun(x, {
    hazard: 1 / 50,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  });
  assert.equal(r.posteriors.length, x.length);
});

test('bocpdRun: rMap reset after detected CP', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = bocpdRun(x, {
    hazard: 1 / 50,
    upmPrior: { mu: 50, kappa: 1, alpha: 2, beta: 100 },
  });
  if (r.tauStar.length > 0) {
    const tau = r.tauStar[0]!;
    // CP rule: rMap[tau] < rMap[tau-1].
    assert.ok(r.posteriors[tau]!.rMap < r.posteriors[tau - 1]!.rMap);
  }
});

// ---- builder integration -------------------------------------------------

test('buildBocpd: empty queue returns zero rows', () => {
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildBocpd: drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`, 'src-a', 5));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.ok(r.droppedSparseSources >= 1);
  assert.equal(r.sources.length, 0);
});

test('buildBocpd: drops sources below tenure floor', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'src', 1000));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 100,
    generatedAt: GEN,
  });
  assert.ok(r.droppedBelowMinTenure >= 1);
});

test('buildBocpd: surfaces a row for a 30-day source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    const v = i < 15 ? 1000 : 5000;
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'src', v));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    minTenureDays: 21,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src');
  assert.equal(row.nTenureDays, 30);
  assert.ok(row.cpProbability >= 0 && row.cpProbability <= 1);
  assert.ok(row.posteriorEntropy >= 0);
});

test('buildBocpd: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'src', 1000));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.ok(r.droppedZeroVariance >= 1);
});

test('buildBocpd: onlyWithCps filter drops zero-CP rows', () => {
  // build a queue with one stable + one shifty source
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'stable', 1000 + (i % 2)));
    queue.push(ql(`2026-01-${dd}T01:00:00Z`, 'shifty', i < 15 ? 1000 : 50_000));
  }
  const all = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    minTenureDays: 21,
    onlyWithCps: false,
    generatedAt: GEN,
  });
  const filtered = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    minTenureDays: 21,
    onlyWithCps: true,
    generatedAt: GEN,
  });
  assert.ok(filtered.sources.length <= all.sources.length);
  for (const r of filtered.sources) assert.ok(r.mChangepoints > 0);
});

test('buildBocpd: top cap reports droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 30; i += 1) {
      const dd = String(i + 1).padStart(2, '0');
      const v = i < 15 ? 1000 + s * 100 : 5000 + s * 100;
      queue.push(ql(`2026-01-${dd}T00:00:00Z`, `src-${s}`, v));
    }
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    minTenureDays: 21,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('buildBocpd: deterministic output', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'src', i < 15 ? 1000 : 5000));
  }
  const a = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  const b = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.deepEqual(a, b);
});

test('buildBocpd: source filter restricts rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'a', 1000 + i * 10));
    queue.push(ql(`2026-01-${dd}T01:00:00Z`, 'b', 1000 + i * 10));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    source: 'a',
    generatedAt: GEN,
  });
  assert.ok(r.droppedSourceFilter > 0);
  for (const row of r.sources) assert.equal(row.source, 'a');
});

test('buildBocpd: drops invalid hour_start', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src', 1000),
    ...Array.from({ length: 30 }, (_, i) =>
      ql(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'src', 1000 + i * 10),
    ),
  ];
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.ok(r.droppedInvalidHourStart >= 1);
});

test('buildBocpd: drops non-positive tokens', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'src', -10),
    ql('2026-01-02T00:00:00Z', 'src', 0),
    ...Array.from({ length: 30 }, (_, i) =>
      ql(`2026-02-${String(i + 1).padStart(2, '0')}T00:00:00Z`, 'src', 1000 + i * 10),
    ),
  ];
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.ok(r.droppedNonPositiveTokens >= 2);
});

test('buildBocpd: window since/until filters', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'src', 1000 + i * 10));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    since: '2026-01-15T00:00:00Z',
    generatedAt: GEN,
  });
  // <15 days remaining -> dropped below tenure
  assert.ok(r.sources.length === 0 || r.sources[0]!.nTenureDays <= 16);
});

test('buildBocpd: sort by cpProbabilityDesc puts strongest CP first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const dd = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-01-${dd}T00:00:00Z`, 'big-shift', i < 15 ? 1000 : 100_000));
    queue.push(ql(`2026-01-${dd}T01:00:00Z`, 'small-shift', i < 15 ? 1000 : 1100));
  }
  const r = buildDailyTokenAdamsMackayBocpdBayesianOnlineRunLength(queue, {
    minTokens: 1000,
    sort: 'cpProbabilityDesc',
    generatedAt: GEN,
  });
  if (r.sources.length === 2) {
    assert.ok(r.sources[0]!.cpProbability >= r.sources[1]!.cpProbability);
  }
});
