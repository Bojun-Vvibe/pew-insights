/**
 * Unit + integration tests for source-row-token-slope-ci-rank-correlation.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiRankCorrelation,
  renderSourceRowTokenSlopeCiRankCorrelation,
  spearmanRho,
  kendallTauBFull,
  midRanks,
  SLOPE_RANK_LENS_NAMES,
} from '../src/sourcerowtokenslopecirankcorrelation.js';
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

function ascending(source: string, n: number, slope = 10, base = 100): QueueLine[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(base + i * slope);
  return mkSeries(source, vals);
}

// --- midRanks ---

test('midRanks: distinct ascending values get 1..n', () => {
  assert.deepEqual(midRanks([1, 2, 3, 4]), [1, 2, 3, 4]);
});

test('midRanks: distinct descending values get n..1', () => {
  assert.deepEqual(midRanks([4, 3, 2, 1]), [4, 3, 2, 1]);
});

test('midRanks: simple tie averages ranks', () => {
  // values 1, 2, 2, 3 -> ranks 1, 2.5, 2.5, 4
  assert.deepEqual(midRanks([1, 2, 2, 3]), [1, 2.5, 2.5, 4]);
});

test('midRanks: all-tied vector', () => {
  assert.deepEqual(midRanks([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
});

test('midRanks: triple tie at top', () => {
  // 1, 5, 5, 5 -> ranks 1, 3, 3, 3
  assert.deepEqual(midRanks([1, 5, 5, 5]), [1, 3, 3, 3]);
});

test('midRanks: empty array', () => {
  assert.deepEqual(midRanks([]), []);
});

test('midRanks: single element', () => {
  assert.deepEqual(midRanks([42]), [1]);
});

// --- spearmanRho ---

test('spearmanRho: identical vectors -> 1', () => {
  assert.equal(spearmanRho([1, 2, 3, 4], [1, 2, 3, 4]), 1);
});

test('spearmanRho: perfect monotonic agreement (different scales) -> 1', () => {
  assert.equal(spearmanRho([1, 2, 3, 4], [10, 20, 30, 40]), 1);
});

test('spearmanRho: perfect anti-correlation -> -1', () => {
  assert.equal(spearmanRho([1, 2, 3, 4], [4, 3, 2, 1]), -1);
});

test('spearmanRho: all-tied X -> 0 (zero-info, not NaN)', () => {
  const r = spearmanRho([5, 5, 5, 5], [1, 2, 3, 4]);
  assert.equal(r, 0);
  assert.ok(Number.isFinite(r));
});

test('spearmanRho: n < 2 -> 0', () => {
  assert.equal(spearmanRho([], []), 0);
  assert.equal(spearmanRho([1], [2]), 0);
});

test('spearmanRho: throws on length mismatch', () => {
  assert.throws(() => spearmanRho([1, 2], [1, 2, 3]), /length mismatch/);
});

test('spearmanRho: in [-1, 1] for noisy data', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const ys = [2, 1, 4, 3, 6, 5, 8, 7];
  const r = spearmanRho(xs, ys);
  assert.ok(r >= -1 && r <= 1);
  assert.ok(r > 0.5, `expected high positive rho, got ${r}`);
});

// --- kendallTauBFull ---

test('kendallTauBFull: identical -> tau 1, all concordant', () => {
  const k = kendallTauBFull([1, 2, 3, 4], [1, 2, 3, 4]);
  assert.equal(k.tauB, 1);
  assert.equal(k.concordant, 6);
  assert.equal(k.discordant, 0);
});

test('kendallTauBFull: reversed -> tau -1, all discordant', () => {
  const k = kendallTauBFull([1, 2, 3, 4], [4, 3, 2, 1]);
  assert.equal(k.tauB, -1);
  assert.equal(k.discordant, 6);
  assert.equal(k.concordant, 0);
});

test('kendallTauBFull: counts sum to n*(n-1)/2', () => {
  const k = kendallTauBFull([1, 2, 2, 3, 4], [2, 1, 3, 3, 5]);
  const n = 5;
  const P = (n * (n - 1)) / 2;
  assert.equal(
    k.concordant + k.discordant + k.tiedX + k.tiedY + k.tiedBoth,
    P,
  );
});

test('kendallTauBFull: tie-on-X bucket', () => {
  // x = [1,1,2], y = [1,2,3] -> pairs (i,j): (0,1) tx, (0,2) C, (1,2) C
  const k = kendallTauBFull([1, 1, 2], [1, 2, 3]);
  assert.equal(k.tiedX, 1);
  assert.equal(k.concordant, 2);
  assert.equal(k.discordant, 0);
});

test('kendallTauBFull: tie-on-Y bucket', () => {
  const k = kendallTauBFull([1, 2, 3], [1, 1, 2]);
  assert.equal(k.tiedY, 1);
});

test('kendallTauBFull: tied-both bucket', () => {
  const k = kendallTauBFull([5, 5, 1], [3, 3, 7]);
  assert.equal(k.tiedBoth, 1);
});

test('kendallTauBFull: all-tied X -> tau 0 (zero denom)', () => {
  const k = kendallTauBFull([7, 7, 7], [1, 2, 3]);
  assert.equal(k.tauB, 0);
});

test('kendallTauBFull: throws on length mismatch', () => {
  assert.throws(() => kendallTauBFull([1, 2], [1]), /length mismatch/);
});

test('kendallTauBFull: tau-b in [-1, 1]', () => {
  const k = kendallTauBFull([1, 3, 2, 4, 5, 6], [2, 1, 4, 3, 5, 6]);
  assert.ok(k.tauB >= -1 && k.tauB <= 1);
});

// --- buildSourceRowTokenSlopeCiRankCorrelation: structural ---

function bigQueue(): QueueLine[] {
  // 5 sources with monotonic increasing token series of varying slopes
  const out: QueueLine[] = [];
  out.push(...ascending('alpha', 12, 5));
  out.push(...ascending('beta', 14, 10));
  out.push(...ascending('gamma', 16, 15));
  out.push(...ascending('delta', 18, 20));
  out.push(...ascending('epsilon', 20, 25));
  return out;
}

test('build: emits 15 pair rows (C(6,2))', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  assert.equal(r.pairs.length, 15);
});

test('build: all pairs have lensA index < lensB index', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    sort: 'pair',
  });
  for (const p of r.pairs) {
    const ai = SLOPE_RANK_LENS_NAMES.indexOf(p.lensA);
    const bi = SLOPE_RANK_LENS_NAMES.indexOf(p.lensB);
    assert.ok(ai < bi, `pair ${p.lensA}~${p.lensB}: ${ai} < ${bi}`);
  }
});

test('build: every pair n equals sourcesWithAllLenses', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  for (const p of r.pairs) {
    assert.equal(p.n, r.sourcesWithAllLenses);
  }
});

test('build: spearman, kendall, agreement all in [-1, 1]', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  for (const p of r.pairs) {
    assert.ok(p.spearman >= -1 && p.spearman <= 1, `spearman ${p.spearman}`);
    assert.ok(p.kendallTauB >= -1 && p.kendallTauB <= 1, `kendall ${p.kendallTauB}`);
    assert.ok(p.agreement >= -1 && p.agreement <= 1, `agreement ${p.agreement}`);
    assert.ok(p.flipFraction >= 0 && p.flipFraction <= 1);
    assert.ok(p.topKOverlap >= 0 && p.topKOverlap <= 1);
  }
});

test('build: monotonic series across sources -> high agreement (lenses agree on rank order)', () => {
  // All 5 sources are clean monotone with strictly different slopes -> 
  // every lens should rank them identically.
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 200,
    seed: 1,
  });
  // Every pair should be at or near 1 -- mean agreement should be very high
  assert.ok(r.meanSpearman > 0.8, `meanSpearman=${r.meanSpearman}`);
  assert.ok(r.meanKendall > 0.7, `meanKendall=${r.meanKendall}`);
});

test('build: consensusRanks length == sourcesWithAllLenses', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  assert.equal(r.consensusRanks.length, r.sourcesWithAllLenses);
});

test('build: consensusRanks sorted ascending', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  for (let i = 1; i < r.consensusRanks.length; i++) {
    assert.ok(
      r.consensusRanks[i]!.consensusRank >= r.consensusRanks[i - 1]!.consensusRank,
    );
  }
});

test('build: top source by consensus is the one with steepest slope', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 200,
    seed: 1,
  });
  // epsilon has slope 25 -- should top consensus
  assert.equal(r.consensusRanks[0]!.source, 'epsilon');
});

test('build: pair sort=pair returns canonical i<j order', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    sort: 'pair',
  });
  let prevI = -1;
  let prevJ = -1;
  for (const p of r.pairs) {
    const i = SLOPE_RANK_LENS_NAMES.indexOf(p.lensA);
    const j = SLOPE_RANK_LENS_NAMES.indexOf(p.lensB);
    if (i === prevI) assert.ok(j > prevJ);
    else assert.ok(i > prevI);
    prevI = i;
    prevJ = j;
  }
});

test('build: agreement-desc sort actually sorts descending', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    sort: 'agreement-desc',
  });
  for (let i = 1; i < r.pairs.length; i++) {
    assert.ok(r.pairs[i]!.agreement <= r.pairs[i - 1]!.agreement);
  }
});

test('build: alertWeak filters out high-agreement pairs', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    alertWeak: 0.5,
  });
  // bigQueue has uniformly high agreement; everything should be filtered
  for (const p of r.pairs) {
    assert.ok(p.agreement < 0.5);
  }
});

test('build: minAgreementPair.agreement <= maxAgreementPair.agreement', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  assert.ok(r.minAgreementPair !== null);
  assert.ok(r.maxAgreementPair !== null);
  assert.ok(r.minAgreementPair!.agreement <= r.maxAgreementPair!.agreement);
});

test('build: throws on minRows < 4', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      minRows: 3,
      bootstraps: 100,
      seed: 1,
    }),
  );
});

test('build: throws on confidence out of (0,1)', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      confidence: 0,
      bootstraps: 100,
      seed: 1,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      confidence: 1,
      bootstraps: 100,
      seed: 1,
    }),
  );
});

test('build: throws on lambda <= 0', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      lambda: 0,
      bootstraps: 100,
      seed: 1,
    }),
  );
});

test('build: throws on bootstraps < 100', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      bootstraps: 99,
      seed: 1,
    }),
  );
});

test('build: throws on non-integer seed', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      bootstraps: 100,
      seed: 1.5,
    }),
  );
});

test('build: throws on invalid sort', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      bootstraps: 100,
      seed: 1,
      sort: 'bogus' as 'agreement-desc',
    }),
  );
});

test('build: throws on topK < 1', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      bootstraps: 100,
      seed: 1,
      topK: 0,
    }),
  );
});

test('build: throws on alertWeak out of [-1,1]', () => {
  assert.throws(() =>
    buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
      bootstraps: 100,
      seed: 1,
      alertWeak: 1.5,
    }),
  );
});

test('build: explicit generatedAt is preserved', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    generatedAt: '2026-04-30T12:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2026-04-30T12:00:00.000Z');
});

test('build: topK clamped to n', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    topK: 100,
  });
  assert.equal(r.topK, r.sourcesWithAllLenses);
});

test('build: topKOverlap == 1 when lenses agree on top set (clean monotone)', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 200,
    seed: 1,
    topK: 3,
  });
  // bigQueue has perfectly distinguishable slopes -- all lenses should
  // agree on the top-3, so every pair has topKOverlap == 1.
  for (const p of r.pairs) {
    assert.equal(p.topKOverlap, 1, `${p.lensA}~${p.lensB} topKOverlap=${p.topKOverlap}`);
  }
});

test('build: empty queue -> 15 pair rows with n=0 and zero metrics', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation([], {
    bootstraps: 100,
    seed: 1,
  });
  assert.equal(r.pairs.length, 15);
  assert.equal(r.sourcesWithAllLenses, 0);
  for (const p of r.pairs) {
    assert.equal(p.n, 0);
    assert.equal(p.spearman, 0);
    assert.equal(p.kendallTauB, 0);
    assert.equal(p.flips, 0);
  }
});

test('build: each pair flips == discordant', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  for (const p of r.pairs) {
    assert.equal(p.flips, p.discordant);
  }
});

test('build: kendall pair-count buckets sum to n*(n-1)/2', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  const n = r.sourcesWithAllLenses;
  const P = (n * (n - 1)) / 2;
  for (const p of r.pairs) {
    assert.equal(
      p.concordant + p.discordant + p.tiedX + p.tiedY + p.tiedBoth,
      P,
    );
  }
});

test('build: medianSpearman within [-1, 1]', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  assert.ok(r.medianSpearman >= -1 && r.medianSpearman <= 1);
  assert.ok(r.medianKendall >= -1 && r.medianKendall <= 1);
});

// --- renderer ---

test('renderer: header is plain-text and includes report name', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  const txt = renderSourceRowTokenSlopeCiRankCorrelation(r);
  assert.ok(txt.includes('source-row-token-slope-ci-rank-correlation'));
  assert.ok(txt.includes('meanSpearman'));
});

test('renderer: showConsensus=true emits the consensus block', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  const txt = renderSourceRowTokenSlopeCiRankCorrelation(r, { showConsensus: true });
  assert.ok(txt.includes('consensus ranks'));
  assert.ok(txt.includes('epsilon'));
});

test('renderer: empty pairs yields "(no pairs)"', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
    alertWeak: -1, // filters everything out
  });
  const txt = renderSourceRowTokenSlopeCiRankCorrelation(r);
  assert.ok(txt.includes('(no pairs)'));
});

test('renderer: prints all 15 pair rows by default', () => {
  const r = buildSourceRowTokenSlopeCiRankCorrelation(bigQueue(), {
    bootstraps: 100,
    seed: 1,
  });
  const txt = renderSourceRowTokenSlopeCiRankCorrelation(r);
  // Each pair line begins with the lens name padded; count by lens letter.
  const lines = txt.split('\n').filter((l) => /^bootstrap|^jackknife|^bca|^studentizedT|^abc|^profileLikelihood/.test(l));
  assert.equal(lines.length, 15);
});
