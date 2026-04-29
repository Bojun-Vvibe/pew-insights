/**
 * Unit + integration tests for source-row-token-slope-ci-asymmetry-concordance.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiAsymmetryConcordance,
  renderSourceRowTokenSlopeCiAsymmetryConcordance,
  signOf,
  ciAsymmetry,
  dominantSignOf,
  SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES,
} from '../src/sourcerowtokenslopeciasymmetryconcordance.js';
import type { QueueLine } from '../src/types.js';

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

function ascending(source: string, n: number): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(100 + i * 10);
  return mkSeries(source, vals);
}

// --- signOf ---

test('signOf: positive value returns +1', () => {
  assert.equal(signOf(0.5), 1);
});

test('signOf: negative value returns -1', () => {
  assert.equal(signOf(-2.7), -1);
});

test('signOf: exact zero returns 0', () => {
  assert.equal(signOf(0), 0);
});

test('signOf: negative zero returns 0', () => {
  assert.equal(signOf(-0), 0);
});

test('signOf: smallest positive subnormal returns +1', () => {
  assert.equal(signOf(Number.MIN_VALUE), 1);
});

test('signOf: smallest negative subnormal returns -1', () => {
  assert.equal(signOf(-Number.MIN_VALUE), -1);
});

test('signOf: NaN throws', () => {
  assert.throws(() => signOf(Number.NaN), /non-finite/);
});

test('signOf: +Infinity throws', () => {
  assert.throws(() => signOf(Number.POSITIVE_INFINITY), /non-finite/);
});

test('signOf: -Infinity throws', () => {
  assert.throws(() => signOf(Number.NEGATIVE_INFINITY), /non-finite/);
});

// --- ciAsymmetry ---

test('ciAsymmetry: symmetric CI around point returns 0', () => {
  // [1, 3], point 2 -> (3-2) - (2-1) = 0
  assert.equal(ciAsymmetry(1, 3, 2), 0);
});

test('ciAsymmetry: right tail wider returns positive', () => {
  // [0, 10], point 1 -> (10-1) - (1-0) = 8
  assert.equal(ciAsymmetry(0, 10, 1), 8);
});

test('ciAsymmetry: left tail wider returns negative', () => {
  // [0, 10], point 9 -> (10-9) - (9-0) = -8
  assert.equal(ciAsymmetry(0, 10, 9), -8);
});

test('ciAsymmetry: handles swapped lower/upper (defensive normalisation)', () => {
  // (3, 1) is implicitly normalised to (1, 3); same as symmetric case
  assert.equal(ciAsymmetry(3, 1, 2), 0);
});

test('ciAsymmetry: zero-width CI yields -2*delta', () => {
  // [5, 5], point 7 -> (5-7) - (7-5) = -4
  assert.equal(ciAsymmetry(5, 5, 7), -4);
});

test('ciAsymmetry: zero-width CI at point yields 0', () => {
  assert.equal(ciAsymmetry(5, 5, 5), 0);
});

test('ciAsymmetry: closed-form check on negative slopes', () => {
  // [-3, -1], point -2.5 -> (-1 - -2.5) - (-2.5 - -3) = 1.5 - 0.5 = 1
  const v = ciAsymmetry(-3, -1, -2.5);
  assert.ok(Math.abs(v - 1) < 1e-12);
});

test('ciAsymmetry: NaN ciLower throws', () => {
  assert.throws(() => ciAsymmetry(Number.NaN, 1, 0), /ciLower/);
});

test('ciAsymmetry: NaN ciUpper throws', () => {
  assert.throws(() => ciAsymmetry(0, Number.NaN, 0), /ciUpper/);
});

test('ciAsymmetry: NaN point throws', () => {
  assert.throws(() => ciAsymmetry(0, 1, Number.NaN), /point/);
});

test('ciAsymmetry: Infinity ciUpper throws', () => {
  assert.throws(
    () => ciAsymmetry(0, Number.POSITIVE_INFINITY, 0),
    /ciUpper/,
  );
});

// --- dominantSignOf ---

test('dominantSignOf: all +1 returns +1', () => {
  assert.equal(dominantSignOf([1, 1, 1, 1, 1, 1]), 1);
});

test('dominantSignOf: all -1 returns -1', () => {
  assert.equal(dominantSignOf([-1, -1, -1, -1, -1, -1]), -1);
});

test('dominantSignOf: all 0 returns 0', () => {
  assert.equal(dominantSignOf([0, 0, 0, 0, 0, 0]), 0);
});

test('dominantSignOf: 4 plus 2 minus returns +1', () => {
  assert.equal(dominantSignOf([1, 1, 1, 1, -1, -1]), 1);
});

test('dominantSignOf: 5 minus 1 zero returns -1', () => {
  assert.equal(dominantSignOf([-1, -1, -1, -1, -1, 0]), -1);
});

test('dominantSignOf: 3-3 split returns null (no strict majority)', () => {
  assert.equal(dominantSignOf([1, 1, 1, -1, -1, -1]), null);
});

test('dominantSignOf: 2-2-2 split returns null', () => {
  assert.equal(dominantSignOf([1, 1, 0, 0, -1, -1]), null);
});

test('dominantSignOf: 3-2-1 returns null (no bucket > half)', () => {
  assert.equal(dominantSignOf([1, 1, 1, 0, 0, -1]), null);
});

test('dominantSignOf: empty array returns null', () => {
  assert.equal(dominantSignOf([]), null);
});

test('dominantSignOf: single +1 returns +1', () => {
  assert.equal(dominantSignOf([1]), 1);
});

// --- buildSourceRowTokenSlopeCiAsymmetryConcordance: validation ---

test('build: minRows < 4 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], { minRows: 3 }),
    /minRows/,
  );
});

test('build: non-integer minRows throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        minRows: 4.5,
      }),
    /minRows/,
  );
});

test('build: confidence <= 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        confidence: 0,
      }),
    /confidence/,
  );
});

test('build: confidence >= 1 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        confidence: 1,
      }),
    /confidence/,
  );
});

test('build: NaN confidence throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        confidence: Number.NaN,
      }),
    /confidence/,
  );
});

test('build: lambda <= 0 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], { lambda: 0 }),
    /lambda/,
  );
});

test('build: non-finite lambda throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        lambda: Number.POSITIVE_INFINITY,
      }),
    /lambda/,
  );
});

test('build: bootstraps < 100 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        bootstraps: 50,
      }),
    /bootstraps/,
  );
});

test('build: non-integer bootstraps throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        bootstraps: 1000.5,
      }),
    /bootstraps/,
  );
});

test('build: non-integer seed throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], { seed: 1.5 }),
    /seed/,
  );
});

test('build: top < 1 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], { top: 0 }),
    /top/,
  );
});

test('build: non-integer top throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], { top: 2.5 }),
    /top/,
  );
});

test('build: invalid sort key throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
        // @ts-expect-error -- intentionally invalid
        sort: 'not-a-real-sort',
      }),
    /sort/,
  );
});

// --- buildSourceRowTokenSlopeCiAsymmetryConcordance: behaviour ---

test('build: empty queue returns empty report with zero counts', () => {
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sourcesWithAllLenses, 0);
  assert.equal(r.droppedMissingLens, 0);
  assert.equal(r.mixedCount, 0);
  assert.equal(r.unanimousAsymmetricCount, 0);
  assert.equal(r.unanimousSymmetricCount, 0);
  assert.deepEqual(r.sources, []);
});

test('build: report defaults wired correctly', () => {
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance([]);
  assert.equal(r.minRows, 4);
  assert.equal(r.confidence, 0.95);
  assert.equal(r.lambda, 1);
  assert.equal(r.bootstraps, 1000);
  assert.equal(r.seed, 42);
  assert.equal(r.alertMixed, false);
  assert.equal(r.alertUnanimous, false);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'concordance-desc');
});

test('build: lens-name vector has length 6 in canonical order', () => {
  assert.equal(SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES.length, 6);
  assert.deepEqual(SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES, [
    'bootstrap',
    'jackknife',
    'bca',
    'studentizedT',
    'abc',
    'profileLikelihood',
  ]);
});

test('build: ascending series produces 6-vector per source with finite asymmetries', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 7,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.asymmetries.length, 6);
  assert.equal(row.signs.length, 6);
  for (const a of row.asymmetries) assert.ok(Number.isFinite(a));
  for (const s of row.signs) assert.ok(s === -1 || s === 0 || s === 1);
});

test('build: counts pluses/zeros/minuses sum to 6 per source', () => {
  const queue = [
    ...ascending('s1', 40),
    ...ascending('s2', 60),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 11,
  });
  for (const row of r.sources) {
    assert.equal(row.pluses + row.zeros + row.minuses, 6);
  }
});

test('build: concordance equals max bucket / 6', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 13,
  });
  const row = r.sources[0]!;
  const maxB = Math.max(row.pluses, row.zeros, row.minuses);
  assert.ok(Math.abs(row.concordance - maxB / 6) < 1e-12);
});

test('build: concordanceMinusBaseline equals concordance - 1/3', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 17,
  });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.concordanceMinusBaseline - (row.concordance - 1 / 3)) <
      1e-12,
  );
});

test('build: dominantSign is +1 / -1 / 0 / null and matches strict majority', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 19,
  });
  const row = r.sources[0]!;
  if (row.dominantSign !== null) {
    let bucket = 0;
    for (const s of row.signs) if (s === row.dominantSign) bucket += 1;
    assert.ok(bucket > 3);
  } else {
    // No bucket exceeds 3
    assert.ok(row.pluses <= 3);
    assert.ok(row.minuses <= 3);
    assert.ok(row.zeros <= 3);
  }
});

test('build: dissenters list lens names exactly when sign != dominantSign', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 23,
  });
  const row = r.sources[0]!;
  if (row.dominantSign === null) {
    assert.deepEqual(row.dissenters, []);
  } else {
    const expected: string[] = [];
    for (let i = 0; i < row.signs.length; i++) {
      if (row.signs[i] !== row.dominantSign) {
        expected.push(SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES[i]!);
      }
    }
    assert.deepEqual(row.dissenters, expected);
  }
});

test('build: meanAsym, meanAbsAsym, meanWidth match arithmetic means', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 29,
  });
  const row = r.sources[0]!;
  let s = 0;
  let sa = 0;
  for (const a of row.asymmetries) {
    s += a;
    sa += Math.abs(a);
  }
  assert.ok(Math.abs(row.meanAsym - s / 6) < 1e-9);
  assert.ok(Math.abs(row.meanAbsAsym - sa / 6) < 1e-9);
  assert.ok(row.meanWidth >= 0);
});

test('build: meanAbsAsymOverWidth is in [0, 1] for all real sources', () => {
  // |asym_i| <= width_i for any well-formed CI containing the point;
  // when the point is INSIDE [lo, hi], |asym| = |2*point - (lo+hi)| <= (hi-lo).
  // We can't strictly assert the kernels keep point inside the CI -- but
  // for ascending real data they do, so this should hold.
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 31,
  });
  const row = r.sources[0]!;
  assert.ok(row.meanAbsAsymOverWidth >= 0);
  assert.ok(row.meanAbsAsymOverWidth <= 1 + 1e-9);
});

test('build: argMaxAbsLens is a canonical lens name and argMaxAbsValue is one of the asymmetries', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 37,
  });
  const row = r.sources[0]!;
  assert.ok(
    (SLOPE_ASYMMETRY_CONCORDANCE_LENS_NAMES as readonly string[]).includes(
      row.argMaxAbsLens,
    ),
  );
  assert.ok(row.asymmetries.includes(row.argMaxAbsValue));
  // It really IS the max-|.|
  let mx = -1;
  for (const a of row.asymmetries) if (Math.abs(a) > mx) mx = Math.abs(a);
  assert.ok(Math.abs(Math.abs(row.argMaxAbsValue) - mx) < 1e-12);
});

test('build: unanimousSymmetric implies all signs == 0 and zeros == 6', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 41,
  });
  for (const row of r.sources) {
    if (row.unanimousSymmetric) {
      assert.equal(row.zeros, 6);
      for (const s of row.signs) assert.equal(s, 0);
    }
  }
});

test('build: unanimousAsymmetric implies pluses==6 or minuses==6', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 43,
  });
  for (const row of r.sources) {
    if (row.unanimousAsymmetric) {
      assert.ok(row.pluses === 6 || row.minuses === 6);
    }
  }
});

test('build: mixed flag iff both pluses>0 and minuses>0', () => {
  const queue = ascending('s1', 50);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 47,
  });
  for (const row of r.sources) {
    assert.equal(row.mixed, row.pluses > 0 && row.minuses > 0);
  }
});

test('build: alertMixed filter only retains mixed sources', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 40),
    ...ascending('s3', 80),
  ];
  const all = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 51,
  });
  const mixedOnly = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 51,
    alertMixed: true,
  });
  for (const row of mixedOnly.sources) assert.equal(row.mixed, true);
  // counts add up: filtered + droppedNotMixed + droppedMissingLens >= total
  assert.equal(
    mixedOnly.droppedNotMixed,
    all.sourcesWithAllLenses - mixedOnly.sources.length,
  );
});

test('build: alertUnanimous filter only retains unanimous-asymmetric sources', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 60),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 53,
    alertUnanimous: true,
  });
  for (const row of r.sources) assert.equal(row.unanimousAsymmetric, true);
});

test('build: top cap limits sources and reports droppedBelowTopCap', () => {
  const queue = [
    ...ascending('s1', 25),
    ...ascending('s2', 30),
    ...ascending('s3', 40),
    ...ascending('s4', 55),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 57,
    top: 2,
  });
  assert.ok(r.sources.length <= 2);
  assert.equal(
    r.sources.length + r.droppedBelowTopCap,
    r.sourcesWithAllLenses,
  );
});

test('build: sort=source produces alphabetical order', () => {
  const queue = [
    ...ascending('zeta', 30),
    ...ascending('alpha', 30),
    ...ascending('mu', 30),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 59,
    sort: 'source',
  });
  const names = r.sources.map((x) => x.source);
  const sorted = [...names].sort();
  assert.deepEqual(names, sorted);
});

test('build: sort=concordance-desc puts highest concordance first', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 50),
    ...ascending('s3', 80),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 61,
    sort: 'concordance-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.concordance >= r.sources[i]!.concordance);
  }
});

test('build: sort=concordance-asc puts lowest concordance first', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 50),
    ...ascending('s3', 80),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 63,
    sort: 'concordance-asc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.concordance <= r.sources[i]!.concordance);
  }
});

test('build: sort=mean-abs-asym-desc orders by meanAbsAsym descending', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 50),
    ...ascending('s3', 80),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 67,
    sort: 'mean-abs-asym-desc',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(
      r.sources[i - 1]!.meanAbsAsym >= r.sources[i]!.meanAbsAsym,
    );
  }
});

test('build: sort=rows orders by rowsKept descending', () => {
  const queue = [
    ...ascending('s1', 25),
    ...ascending('s2', 60),
    ...ascending('s3', 40),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 71,
    sort: 'rows',
  });
  for (let i = 1; i < r.sources.length; i++) {
    assert.ok(r.sources[i - 1]!.rowsKept >= r.sources[i]!.rowsKept);
  }
});

test('build: source filter restricts to one source', () => {
  const queue = [
    ...ascending('s1', 30),
    ...ascending('s2', 30),
  ];
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 73,
    source: 's2',
  });
  for (const row of r.sources) assert.equal(row.source, 's2');
});

test('build: respects custom generatedAt', () => {
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance([], {
    generatedAt: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-04-30T00:00:00.000Z');
});

test('build: minRows above source size drops the source', () => {
  const queue = ascending('s1', 10);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    minRows: 100,
    bootstraps: 200,
    seed: 79,
  });
  assert.equal(r.sourcesWithAllLenses, 0);
});

test('build: identical seed + identical input is deterministic', () => {
  const queue = ascending('s1', 50);
  const a = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 1234,
    generatedAt: 'X',
  });
  const b = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 1234,
    generatedAt: 'X',
  });
  assert.deepEqual(a, b);
});

test('build: window filter (since/until) is honoured', () => {
  const queue = ascending('s1', 50); // hours 00:00..00:49
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    since: '2099-01-01T00:00:00.000Z',
    bootstraps: 200,
    seed: 83,
  });
  assert.equal(r.sourcesWithAllLenses, 0);
});

// --- renderSourceRowTokenSlopeCiAsymmetryConcordance ---

test('render: empty report renders header lines + "(no sources)"', () => {
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance([]);
  const text = renderSourceRowTokenSlopeCiAsymmetryConcordance(r);
  assert.ok(text.includes('source-row-token-slope-ci-asymmetry-concordance'));
  assert.ok(text.includes('(no sources)'));
});

test('render: with sources includes a header row and per-source data', () => {
  const queue = ascending('s1', 30);
  const r = buildSourceRowTokenSlopeCiAsymmetryConcordance(queue, {
    bootstraps: 200,
    seed: 89,
  });
  const text = renderSourceRowTokenSlopeCiAsymmetryConcordance(r);
  assert.ok(text.includes('source'));
  assert.ok(text.includes('+/0/-'));
  assert.ok(text.includes('s1'));
});

test('render: dominantSign null prints "?"', () => {
  // synthetic: build a fake report and render directly
  const fakeRow = {
    source: 'fake',
    rowsKept: 10,
    asymmetries: [1, -1, 1, -1, 0, 0],
    signs: [1, -1, 1, -1, 0, 0] as (-1 | 0 | 1)[],
    pluses: 2,
    zeros: 2,
    minuses: 2,
    dominantSign: null as -1 | 0 | 1 | null,
    concordance: 2 / 6,
    concordanceMinusBaseline: 2 / 6 - 1 / 3,
    dissenters: [],
    meanAsym: 0,
    meanAbsAsym: 4 / 6,
    meanWidth: 2,
    meanAbsAsymOverWidth: (4 / 6) / 2,
    argMaxAbsLens: 'bca' as const,
    argMaxAbsValue: 1,
    unanimousAsymmetric: false,
    unanimousSymmetric: false,
    mixed: true,
  };
  const text = renderSourceRowTokenSlopeCiAsymmetryConcordance({
    generatedAt: 'T',
    windowStart: null,
    windowEnd: null,
    source: null,
    minRows: 4,
    confidence: 0.95,
    lambda: 1,
    bootstraps: 1000,
    seed: 42,
    alertMixed: false,
    alertUnanimous: false,
    top: null,
    sort: 'concordance-desc',
    totalSources: 1,
    totalRowsKept: 10,
    sourcesWithAllLenses: 1,
    droppedMissingLens: 0,
    droppedNotMixed: 0,
    droppedNotUnanimous: 0,
    droppedBelowTopCap: 0,
    mixedCount: 1,
    unanimousAsymmetricCount: 0,
    unanimousSymmetricCount: 0,
    sources: [fakeRow],
  });
  // The dominantSign=null cell should render as "?" surrounded by whitespace
  assert.ok(/\s\?\s/.test(text));
});
