import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer6Mean } from '../src/sourcerowtokenlehmer6mean.js';
import { buildSourceRowTokenLehmer7Mean } from '../src/sourcerowtokenlehmer7mean.js';
import { buildSourceRowTokenLehmer8Mean } from '../src/sourcerowtokenlehmer8mean.js';
import { buildSourceRowTokenLehmer9Mean } from '../src/sourcerowtokenlehmer9mean.js';
import { buildSourceRowTokenLehmer10Mean } from '../src/sourcerowtokenlehmer10mean.js';
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
      `2026-04-28T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

const GEN = '2026-04-29T13:00:00.000Z';

// Linear-congruential RNG so we get reproducible but varied input
// distributions on every CI run.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- refinement: full integer Lehmer ladder L_6 .. L_10 monotonicity ----------
//
// End-to-end Lehmer-monotonicity pin spanning the entire integer ladder
// from L_6 (v0.6.190) through L_10 (v0.6.199) on synthetic data. For
// every adjacent rung we assert L_k <= L_{k+1} (numerical-tolerance
// guarded). This is a strictly stronger contract than the per-rung
// monotonicity tests already shipped for each individual builder,
// because it exercises all five builders against a SINGLE shared input
// series and verifies the chain holds end-to-end.
//
// We use 80 trials of size n in [3, 30) drawn from U{0, ..., 4999}
// (integer tokens, matching the queue.jsonl shape). All-zero series
// are skipped to avoid the undefined-mean degenerate case.
test(
  'ladder property: L_6 <= L_7 <= L_8 <= L_9 <= L_10 holds at every adjacent step over 80 random integer series',
  () => {
    const r = rng(0xa1b2c3d4);
    let trialsRun = 0;
    for (let trial = 0; trial < 80; trial += 1) {
      const n = 3 + Math.floor(r() * 27);
      const xs: number[] = [];
      for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 5000));
      if (xs.every((x) => x === 0)) continue;
      const queue = mkSeries(`ladder${trial}`, xs);
      const r6 = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
      const r7 = buildSourceRowTokenLehmer7Mean(queue, { generatedAt: GEN });
      const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
      const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
      const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
      if (
        r6.sources.length === 0 ||
        r7.sources.length === 0 ||
        r8.sources.length === 0 ||
        r9.sources.length === 0 ||
        r10.sources.length === 0
      )
        continue;
      const L6 = r6.sources[0]!.lehmer6Mean;
      const L7 = r7.sources[0]!.lehmer7Mean;
      const L8 = r8.sources[0]!.lehmer8Mean;
      const L9 = r9.sources[0]!.lehmer9Mean;
      const L10 = r10.sources[0]!.lehmer10Mean;
      const eps = 1e-9 * Math.max(1, L10);
      assert.ok(
        L6 <= L7 + eps,
        `L_6 <= L_7 expected: L_6=${L6}, L_7=${L7}, xs=${JSON.stringify(xs)}`,
      );
      assert.ok(
        L7 <= L8 + eps,
        `L_7 <= L_8 expected: L_7=${L7}, L_8=${L8}, xs=${JSON.stringify(xs)}`,
      );
      assert.ok(
        L8 <= L9 + eps,
        `L_8 <= L_9 expected: L_8=${L8}, L_9=${L9}, xs=${JSON.stringify(xs)}`,
      );
      assert.ok(
        L9 <= L10 + eps,
        `L_9 <= L_10 expected: L_9=${L9}, L_10=${L10}, xs=${JSON.stringify(xs)}`,
      );
      // Final transitive chain — strictly weaker than the four pairwise
      // checks above but pinned for documentation purposes.
      assert.ok(
        L6 <= L10 + eps,
        `L_6 <= L_10 (transitive) expected: L_6=${L6}, L_10=${L10}, xs=${JSON.stringify(xs)}`,
      );
      trialsRun += 1;
    }
    assert.ok(
      trialsRun >= 50,
      `expected at least 50 trials with non-empty results (got ${trialsRun}); RNG seed should yield ample non-degenerate samples`,
    );
  },
);

// ---------- refinement: equality case — constant positive series collapses the entire ladder ----------
//
// On a constant positive series x_i = c > 0 for all i, every Lehmer
// rung degenerates to c (L_p = c for all p). Pin this on the full
// ladder L_6 .. L_10 across multiple constants.
test(
  'ladder property: constant positive series collapses L_6 = L_7 = L_8 = L_9 = L_10 = c',
  () => {
    for (const c of [1, 7, 100, 4242, 1_000_000]) {
      const xs = Array.from({ length: 10 }, () => c);
      const queue = mkSeries(`const-${c}`, xs);
      const r6 = buildSourceRowTokenLehmer6Mean(queue, { generatedAt: GEN });
      const r7 = buildSourceRowTokenLehmer7Mean(queue, { generatedAt: GEN });
      const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
      const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
      const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
      const eps = 1e-6 * Math.max(1, c);
      assert.ok(Math.abs(r6.sources[0]!.lehmer6Mean - c) < eps);
      assert.ok(Math.abs(r7.sources[0]!.lehmer7Mean - c) < eps);
      assert.ok(Math.abs(r8.sources[0]!.lehmer8Mean - c) < eps);
      assert.ok(Math.abs(r9.sources[0]!.lehmer9Mean - c) < eps);
      assert.ok(Math.abs(r10.sources[0]!.lehmer10Mean - c) < eps);
      // Adjacent gaps should also collapse (modulo float noise).
      assert.ok(r10.sources[0]!.l10L9Gap < eps);
      assert.ok(r9.sources[0]!.l9L8Gap < eps);
    }
  },
);
