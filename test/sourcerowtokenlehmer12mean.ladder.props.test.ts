import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer8Mean } from '../src/sourcerowtokenlehmer8mean.js';
import { buildSourceRowTokenLehmer9Mean } from '../src/sourcerowtokenlehmer9mean.js';
import { buildSourceRowTokenLehmer10Mean } from '../src/sourcerowtokenlehmer10mean.js';
import { buildSourceRowTokenLehmer11Mean } from '../src/sourcerowtokenlehmer11mean.js';
import { buildSourceRowTokenLehmer12Mean } from '../src/sourcerowtokenlehmer12mean.js';
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

const GEN = '2026-04-29T15:00:00.000Z';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- refinement: full integer Lehmer ladder L_8 .. L_12 monotonicity ----------
//
// End-to-end Lehmer-monotonicity pin spanning the ladder L_8 (v0.6.197)
// through L_12 (v0.6.201). For every adjacent rung we assert
// L_k <= L_{k+1} (numerical-tolerance guarded). Strictly stronger
// than the per-builder pairwise checks because it exercises FIVE
// builders against a SINGLE shared input series and verifies every
// adjacent step *and* the transitive chain end-to-end.
test('ladder property: L_8 <= L_9 <= L_10 <= L_11 <= L_12 holds at every adjacent step over 80 random integer series', () => {
  const r = rng(0xb1c2d3e5);
  let trialsRun = 0;
  for (let trial = 0; trial < 80; trial += 1) {
    const n = 3 + Math.floor(r() * 27);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(r() * 5000));
    if (xs.every((x) => x === 0)) continue;
    const queue = mkSeries(`ladder${trial}`, xs);
    const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
    const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
    const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
    const r11 = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
    const r12 = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
    if (
      r8.sources.length === 0 ||
      r9.sources.length === 0 ||
      r10.sources.length === 0 ||
      r11.sources.length === 0 ||
      r12.sources.length === 0
    )
      continue;
    const L8 = r8.sources[0]!.lehmer8Mean;
    const L9 = r9.sources[0]!.lehmer9Mean;
    const L10 = r10.sources[0]!.lehmer10Mean;
    const L11 = r11.sources[0]!.lehmer11Mean;
    const L12 = r12.sources[0]!.lehmer12Mean;
    const eps = 1e-9 * Math.max(1, L12);
    assert.ok(
      L8 <= L9 + eps,
      `L_8 <= L_9 expected: L_8=${L8}, L_9=${L9}, xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      L9 <= L10 + eps,
      `L_9 <= L_10 expected: L_9=${L9}, L_10=${L10}, xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      L10 <= L11 + eps,
      `L_10 <= L_11 expected: L_10=${L10}, L_11=${L11}, xs=${JSON.stringify(xs)}`,
    );
    assert.ok(
      L11 <= L12 + eps,
      `L_11 <= L_12 expected: L_11=${L11}, L_12=${L12}, xs=${JSON.stringify(xs)}`,
    );
    // Final transitive chain — strictly weaker than the four pairwise
    // checks above but pinned for documentation purposes.
    assert.ok(
      L8 <= L12 + eps,
      `L_8 <= L_12 (transitive) expected: L_8=${L8}, L_12=${L12}, xs=${JSON.stringify(xs)}`,
    );
    trialsRun += 1;
  }
  assert.ok(
    trialsRun >= 50,
    `expected at least 50 trials with non-empty results (got ${trialsRun})`,
  );
});

// ---------- refinement: constant positive series collapses entire ladder ----------
test('ladder property: constant positive series collapses L_8 = L_9 = L_10 = L_11 = L_12 = c', () => {
  for (const c of [1, 7, 100, 4242, 1_000_000]) {
    const xs = Array.from({ length: 10 }, () => c);
    const queue = mkSeries(`const-${c}`, xs);
    const r8 = buildSourceRowTokenLehmer8Mean(queue, { generatedAt: GEN });
    const r9 = buildSourceRowTokenLehmer9Mean(queue, { generatedAt: GEN });
    const r10 = buildSourceRowTokenLehmer10Mean(queue, { generatedAt: GEN });
    const r11 = buildSourceRowTokenLehmer11Mean(queue, { generatedAt: GEN });
    const r12 = buildSourceRowTokenLehmer12Mean(queue, { generatedAt: GEN });
    const eps = 1e-6 * Math.max(1, c);
    assert.ok(Math.abs(r8.sources[0]!.lehmer8Mean - c) < eps);
    assert.ok(Math.abs(r9.sources[0]!.lehmer9Mean - c) < eps);
    assert.ok(Math.abs(r10.sources[0]!.lehmer10Mean - c) < eps);
    assert.ok(Math.abs(r11.sources[0]!.lehmer11Mean - c) < eps);
    assert.ok(Math.abs(r12.sources[0]!.lehmer12Mean - c) < eps);
    // Adjacent gaps collapse too.
    assert.ok(r12.sources[0]!.l12L11Gap < eps);
    assert.ok(r11.sources[0]!.l11L10Gap < eps);
  }
});
