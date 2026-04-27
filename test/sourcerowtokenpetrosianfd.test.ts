import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenPetrosianFd } from '../src/sourcerowtokenpetrosianfd.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-28T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('petrosian-fd: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenPetrosianFd([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 16);
  assert.equal(r.sort, 'pfd-asc');
  assert.equal(r.generatedAt, GEN);
});

test('petrosian-fd: linear ramp -> Nd=0, PFD = 1 (no diff sign flips)', () => {
  const v = Array.from({ length: 64 }, (_, i) => i);
  const r = buildSourceRowTokenPetrosianFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Every diff is +1, no sign flips. Petrosian closed form gives
  // PFD = log10(M)/(log10(M) + log10(M/M)) = log10(M)/log10(M) = 1.
  assert.equal(row.Nd, 0);
  assert.ok(Math.abs(row.pfd - 1) < 1e-12, `pfd=${row.pfd} should be 1`);
  assert.ok(Math.abs(row.pfdRaw - 1) < 1e-12);
});

test('petrosian-fd: constant series dropped under zero-variance', () => {
  const v = new Array(32).fill(7);
  const r = buildSourceRowTokenPetrosianFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('petrosian-fd: below min-rows dropped', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = buildSourceRowTokenPetrosianFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('petrosian-fd: alternating series -> Nd = M-1 (max), PFD near upper end', () => {
  // v = [0, 100, 0, 100, ...]; diff sequence alternates +,-,+,-...
  // every adjacent pair in the diff sign sequence flips => Nd = M - 1.
  const v = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const r = buildSourceRowTokenPetrosianFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.M, 63);
  assert.equal(row.Nd, 62);
  // For M=63, Nd=62: M/(M+0.4*Nd) = 63/(63 + 24.8) = 63/87.8 ~ 0.7175
  // PFD = log10(63) / (log10(63) + log10(0.7175))
  //     = 1.7993 / (1.7993 + (-0.1442)) = 1.7993 / 1.6551 ~ 1.0871
  assert.ok(row.pfd > 1.08 && row.pfd < 1.10, `pfd=${row.pfd} expected ~1.09`);
});

test('petrosian-fd: oscillating series has higher PFD than monotone ramp', () => {
  const linear = Array.from({ length: 64 }, (_, i) => i);
  const osc = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const queue = [
    ...series(linear, 'lin'),
    ...series(osc, 'osc'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const lin = r.sources.find((s) => s.source === 'lin')!;
  const osc1 = r.sources.find((s) => s.source === 'osc')!;
  assert.ok(osc1.pfd > lin.pfd, `osc pfd=${osc1.pfd} should exceed lin pfd=${lin.pfd}`);
  // Sort: pfd-asc -> lin first
  assert.equal(r.sources[0]!.source, 'lin');
});

test('petrosian-fd: amplitude-invariant — multiplying v by 13 leaves Nd and PFD bit-identical', () => {
  // Orthogonality probe vs Katz/Higuchi/Hjorth (which all change under
  // amplitude scaling). PFD looks only at the sign of the diff, which
  // is invariant under any positive scalar multiplication.
  const base = [3, 7, 2, 5, 1, 9, 4, 8, 2, 6, 3, 7, 1, 5, 4, 9, 2, 6, 8, 3, 7, 1];
  const scaled = base.map((x) => x * 13);
  const queue = [
    ...series(base, 'base'),
    ...series(scaled, 'scaled'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'base')!;
  const b = r.sources.find((s) => s.source === 'scaled')!;
  assert.equal(a.Nd, b.Nd);
  assert.equal(a.M, b.M);
  assert.equal(a.pfd, b.pfd);
  assert.equal(a.pfdRaw, b.pfdRaw);
});

test('petrosian-fd: monotone ramp PFD=1 differs from ZCR-style sign-of-(v-mean) intuition', () => {
  // A monotone ramp has ZCR ~ 1/(N-1) (one mean-crossing in the middle)
  // but PFD = 1 (zero diff-sign-flips). This is the orthogonality
  // probe vs zero-crossing-rate: the two lenses look at different
  // sign sequences entirely.
  const v = Array.from({ length: 32 }, (_, i) => i + 5);
  const r = buildSourceRowTokenPetrosianFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.Nd, 0); // no diff sign flips
  assert.equal(row.pfd, 1); // PFD floor
});

test('petrosian-fd: zero diffs default to +1 (Esteller convention) — no spurious flips', () => {
  // A series with stretches of equal values (zero diffs) followed by
  // a monotone climb should NOT incur flips at the zero->positive
  // transition because both map to +1 under the default convention.
  const v = [
    1, 1, 1, 1, 1, 1, 1, 1, // 7 zero diffs (8 equal values)
    2, 3, 4, 5, 6, 7, 8, 9, // 8 positive diffs (1->2 plus 7 more)
    9, 9, 9, 9, // 4 zero diffs
  ];
  const r = buildSourceRowTokenPetrosianFd(series(v), {
    generatedAt: GEN,
    minRows: 16,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.Nd, 0);
  assert.equal(row.zeroDiffs, 11);
  assert.equal(row.pfd, 1);
});

test('petrosian-fd: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...series([1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 2], 'a'),
    ...series([5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1], 'b'),
    ...series([1, 4, 7, 2, 8, 3, 9, 1, 6, 2, 5, 8, 3, 7, 4, 9, 2, 6, 1, 8], 'c'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, { generatedAt: GEN, top: 2 });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('petrosian-fd: source filter drops unmatched rows', () => {
  const queue = [
    ...series([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 'keep'),
    ...series([5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1], 'drop'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 20);
});

test('petrosian-fd: invalid hour_start counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 1),
    ...series([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 's'),
  ];
  const r = buildSourceRowTokenPetrosianFd(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('petrosian-fd: negative tokens counted separately', () => {
  const q: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', -5),
    ...series([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 's'),
  ];
  const r = buildSourceRowTokenPetrosianFd(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('petrosian-fd: NaN tokens counted as droppedInvalidTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ...series([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 's'),
  ];
  const r = buildSourceRowTokenPetrosianFd(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('petrosian-fd: pfd-desc sort puts wiggliest first', () => {
  const queue = [
    ...series(Array.from({ length: 32 }, (_, i) => i), 'monotone'),
    ...series(Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 50)), 'wiggle'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    sort: 'pfd-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'wiggle');
  assert.equal(r.sources[1]!.source, 'monotone');
});

test('petrosian-fd: source sort respects lex order', () => {
  const queue = [
    ...series([1, 5, 2, 6, 3, 7, 4, 8, 1, 9, 2, 7, 3, 6, 4, 5, 1, 2], 'zeta'),
    ...series([1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2], 'alpha'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('petrosian-fd: rows sort places longest first', () => {
  const queue = [
    ...series(
      Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 1 : 5)),
      'long',
    ),
    ...series(
      Array.from({ length: 20 }, (_, i) => (i % 3 === 0 ? 1 : 5)),
      'short',
    ),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.sources[0]!.rowsKept, 40);
});

test('petrosian-fd: minRows < 4 throws', () => {
  assert.throws(
    () => buildSourceRowTokenPetrosianFd([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
});

test('petrosian-fd: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPetrosianFd([], {
        sort: 'bogus' as 'pfd-asc',
      }),
    /sort must be one of/,
  );
});

test('petrosian-fd: top < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenPetrosianFd([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('petrosian-fd: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenPetrosianFd([], { since: 'never' }),
    /invalid since/,
  );
});

test('petrosian-fd: window filters by [since, until)', () => {
  const queue = series(
    Array.from({ length: 32 }, (_, i) => i % 5),
    's',
  );
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    since: '2026-04-25T00:00:00Z',
    until: '2026-04-25T00:10:00Z', // first 10 minutes only
    minRows: 4,
  });
  // Should keep ~10 rows.
  assert.ok(r.totalRowsKept <= 10);
});

test('petrosian-fd: PFD reported is bounded in [1, 2] on real data', () => {
  // Generate a few synthetic series and confirm pfd stays in [1, 2].
  const queue = [
    ...series(Array.from({ length: 50 }, (_, i) => Math.sin(i / 3) * 100 + 200), 'sine'),
    ...series(Array.from({ length: 50 }, (_, i) => i * 2 + (i % 7)), 'drift'),
    ...series(Array.from({ length: 50 }, (_, i) => (i * 31 + 7) % 100), 'pseudo'),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, { generatedAt: GEN });
  for (const s of r.sources) {
    assert.ok(s.pfd >= 1 && s.pfd <= 2, `pfd=${s.pfd} out of [1, 2] for ${s.source}`);
  }
});

// ---------------------------------------------------------------
// Refinement (0.6.135): --zero-rule, --min-pfd, --max-pfd flags
// ---------------------------------------------------------------

test('petrosian-fd: zero-rule "skip" drops zero diffs from the stream', () => {
  // 24 values: alternating constant runs of length 3.
  // [a, a, a, b, b, b, a, a, a, b, b, b, ...]
  const v = [
    1, 1, 1, 5, 5, 5, 1, 1, 1, 5, 5, 5,
    1, 1, 1, 5, 5, 5, 1, 1, 1, 5, 5, 5,
  ];
  const rPos = buildSourceRowTokenPetrosianFd(series(v), {
    generatedAt: GEN,
    zeroRule: 'positive',
  });
  const rSkip = buildSourceRowTokenPetrosianFd(series(v), {
    generatedAt: GEN,
    zeroRule: 'skip',
  });
  // zero diffs: within each run-of-3 there are 2 zeros; 8 runs total -> 16 zeros.
  // 23 diffs total -> 7 non-zero (the run boundaries) under 'skip'.
  assert.equal(rPos.sources[0]!.zeroDiffs, 16);
  assert.equal(rPos.sources[0]!.M, 23);
  assert.equal(rSkip.sources[0]!.zeroDiffs, 16);
  assert.equal(rSkip.sources[0]!.M, 7);
  // PFD differs because Nd and M differ.
  assert.notEqual(rPos.sources[0]!.pfd, rSkip.sources[0]!.pfd);
});

test('petrosian-fd: zero-rule "previous" inherits prior sign', () => {
  // [1, 2, 2, 2, 1, ...] — diff sequence starts with +1 (no leading
  // zeros), then zeros inherit the most recent sign. M = N - 1
  // because no zeros are dropped under 'previous' here.
  const v = [
    1, 2, 2, 2, 1,
    2, 2, 2, 1, 2,
    2, 2, 1, 2, 2,
    2, 1, 2, 2, 2,
  ];
  const r = buildSourceRowTokenPetrosianFd(series(v), {
    generatedAt: GEN,
    zeroRule: 'previous',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.M, 19);
  assert.ok(r.sources[0]!.zeroDiffs > 0);
  // Sign stream: +1, 0->+1, 0->+1, -1, +1, 0->+1, 0->+1, -1, +1, ...
  // Flips occur only at the +1 -> -1 and -1 -> +1 boundaries.
  assert.ok(r.sources[0]!.Nd > 0);
});

test('petrosian-fd: zero-rule "previous" drops leading zeros', () => {
  // First diff is zero (1->1), then +1, then more.
  const v = [
    1, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    10, 11, 12, 13, 14, 15, 16, 17,
  ];
  const r = buildSourceRowTokenPetrosianFd(series(v), {
    generatedAt: GEN,
    zeroRule: 'previous',
  });
  // 17 diffs, 1 leading zero (no prior non-zero) -> dropped, M = 16.
  assert.equal(r.sources[0]!.M, 16);
  assert.equal(r.sources[0]!.zeroDiffs, 1);
  assert.equal(r.sources[0]!.Nd, 0);
});

test('petrosian-fd: invalid zero-rule throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPetrosianFd([], {
        zeroRule: 'bogus' as 'positive',
      }),
    /zeroRule must be one of/,
  );
});

test('petrosian-fd: --min-pfd filters out smooth sources', () => {
  const queue = [
    ...series(Array.from({ length: 32 }, (_, i) => i), 'monotone'),
    ...series(
      Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 50)),
      'wiggle',
    ),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    minPfd: 1.05,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'wiggle');
  assert.equal(r.droppedBelowMinPfd, 1);
});

test('petrosian-fd: --max-pfd filters out wiggly sources', () => {
  const queue = [
    ...series(Array.from({ length: 32 }, (_, i) => i), 'monotone'),
    ...series(
      Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 50)),
      'wiggle',
    ),
  ];
  const r = buildSourceRowTokenPetrosianFd(queue, {
    generatedAt: GEN,
    maxPfd: 1.02,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'monotone');
  assert.equal(r.droppedAboveMaxPfd, 1);
});

test('petrosian-fd: min-pfd outside [1, 2] throws', () => {
  assert.throws(
    () => buildSourceRowTokenPetrosianFd([], { minPfd: 0.5 }),
    /minPfd must be in/,
  );
  assert.throws(
    () => buildSourceRowTokenPetrosianFd([], { maxPfd: 2.5 }),
    /maxPfd must be in/,
  );
});

test('petrosian-fd: minPfd > maxPfd throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPetrosianFd([], {
        minPfd: 1.5,
        maxPfd: 1.2,
      }),
    /minPfd .* must be <= maxPfd/,
  );
});

test('petrosian-fd: report exposes zeroRule, minPfd, maxPfd, droppedBelowMinPfd, droppedAboveMaxPfd', () => {
  const r = buildSourceRowTokenPetrosianFd([], {
    generatedAt: GEN,
    zeroRule: 'skip',
    minPfd: 1.01,
    maxPfd: 1.99,
  });
  assert.equal(r.zeroRule, 'skip');
  assert.equal(r.minPfd, 1.01);
  assert.equal(r.maxPfd, 1.99);
  assert.equal(r.droppedBelowMinPfd, 0);
  assert.equal(r.droppedAboveMaxPfd, 0);
});
