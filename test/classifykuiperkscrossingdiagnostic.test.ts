import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyKuiperKsCrossingDiagnostic,
  type KuiperRowForKsJoin,
  type KsRowForKuiperJoin,
} from '../src/classifykuiperkscrossingdiagnostic.js';

function kp(
  source: string,
  kpV: number,
  kpP: number,
): KuiperRowForKsJoin {
  return { source, kpV, kpP };
}
function ks(
  source: string,
  ksD: number,
  ksP: number,
): KsRowForKuiperJoin {
  return { source, ksD, ksP };
}

// ---------- input validation ----------

test('classify: rejects duplicate kuiper source', () => {
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic(
        [kp('A', 0.5, 0.1), kp('A', 0.6, 0.05)],
        [ks('A', 0.3, 0.1)],
      ),
    /duplicate kuiper source/,
  );
});

test('classify: rejects duplicate ks source', () => {
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic(
        [kp('A', 0.5, 0.1)],
        [ks('A', 0.3, 0.1), ks('A', 0.4, 0.05)],
      ),
    /duplicate ks source/,
  );
});

test('classify: rejects kpV out of [0, 2]', () => {
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic([kp('A', 2.5, 0.1)], []),
    /kpV must be finite in \[0, 2\]/,
  );
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic([kp('A', -0.1, 0.1)], []),
    /kpV must be finite in \[0, 2\]/,
  );
});

test('classify: rejects ksD out of [0, 1]', () => {
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic([], [ks('A', 1.5, 0.1)]),
    /ksD must be finite in \[0, 1\]/,
  );
});

test('classify: rejects p out of [0, 1]', () => {
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic([kp('A', 0.5, 1.1)], []),
    /kpP must be finite in \[0, 1\]/,
  );
  assert.throws(
    () =>
      classifyKuiperKsCrossingDiagnostic([], [ks('A', 0.5, -0.1)]),
    /ksP must be finite in \[0, 1\]/,
  );
});

// ---------- shape classification ----------

test('classify: clean one-sided shift (ratio = 1.0) -> one-sided', () => {
  // kpV = 0.6, ksD = 0.6 -> ratio = 1.0 -> 'one-sided'.
  // Both reject at p=0.01.
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.01)],
    [ks('A', 0.6, 0.01)],
  );
  assert.equal(r.rows[0]!.shape, 'one-sided');
  assert.equal(r.rows[0]!.bucket, 'both-reject-one-sided');
  assert.equal(r.rows[0]!.shapeRatio, 1);
});

test('classify: balanced two-sided crossing (ratio = 2.0) -> balanced-crossing', () => {
  // kpV = 0.6, ksD = 0.3 -> ratio = 2.0.
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.01)],
    [ks('A', 0.3, 0.04)],
  );
  assert.equal(r.rows[0]!.shape, 'balanced-crossing');
  assert.equal(r.rows[0]!.bucket, 'both-reject-balanced-crossing');
  assert.equal(r.rows[0]!.shapeRatio, 2);
  assert.equal(r.balancedCrossings, 1);
});

test('classify: mixed crossing (ratio in [1.25, 1.75)) -> mixed-crossing', () => {
  // ratio = 1.5
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.01)],
    [ks('A', 0.4, 0.02)],
  );
  assert.equal(r.rows[0]!.shape, 'mixed-crossing');
  assert.equal(r.rows[0]!.bucket, 'both-reject-mixed-crossing');
  assert.ok(Math.abs(r.rows[0]!.shapeRatio! - 1.5) < 1e-12);
});

test('classify: ratio just below 1.25 -> one-sided', () => {
  // ratio = 1.2
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.01)],
    [ks('A', 0.5, 0.01)],
  );
  assert.equal(r.rows[0]!.shape, 'one-sided');
  assert.equal(r.rows[0]!.bucket, 'both-reject-one-sided');
});

test('classify: ratio at 1.75 -> balanced-crossing', () => {
  // kpV/ksD = 1.76 (just above the 1.75 boundary)
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.88, 0.01)],
    [ks('A', 0.5, 0.02)],
  );
  assert.equal(r.rows[0]!.shape, 'balanced-crossing');
});

// ---------- significance buckets ----------

test('classify: kuiper-only (kp rejects, ks ns)', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.04)],
    [ks('A', 0.3, 0.10)],
  );
  assert.equal(r.rows[0]!.bucket, 'kuiper-only');
  assert.equal(r.kuiperOnly, 1);
  assert.equal(r.bothReject, 0);
});

test('classify: ks-only (ks rejects, kp ns)', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.5, 0.06)],
    [ks('A', 0.5, 0.04)],
  );
  assert.equal(r.rows[0]!.bucket, 'ks-only');
  assert.equal(r.ksOnly, 1);
});

test('classify: neither-reject (both ns)', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.2, 0.4)],
    [ks('A', 0.15, 0.5)],
  );
  assert.equal(r.rows[0]!.bucket, 'neither-reject');
  assert.equal(r.bothReject, 0);
  assert.equal(r.kuiperOnly, 0);
  assert.equal(r.ksOnly, 0);
});

test('classify: degenerate when both stats are zero', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0, 1)],
    [ks('A', 0, 1)],
  );
  assert.equal(r.rows[0]!.shape, 'degenerate');
  assert.equal(r.rows[0]!.bucket, 'degenerate');
  assert.equal(r.rows[0]!.shapeRatio, null);
});

test('classify: alpha boundary -- p exactly 0.05 still rejects', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.6, 0.05)],
    [ks('A', 0.6, 0.05)],
  );
  assert.equal(r.rows[0]!.bucket, 'both-reject-one-sided');
  assert.equal(r.bothReject, 1);
});

// ---------- joining + ordering ----------

test('classify: rows sorted by source ascending', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('zeta', 0.5, 0.1), kp('alpha', 0.5, 0.1), kp('mike', 0.5, 0.1)],
    [ks('zeta', 0.4, 0.1), ks('alpha', 0.4, 0.1), ks('mike', 0.4, 0.1)],
  );
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['alpha', 'mike', 'zeta'],
  );
});

test('classify: surfaces sources only in kp / only in ks', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.5, 0.1), kp('B', 0.5, 0.1)],
    [ks('B', 0.4, 0.1), ks('C', 0.4, 0.1)],
  );
  assert.deepEqual(r.sourcesOnlyInKp, ['A']);
  assert.deepEqual(r.sourcesOnlyInKs, ['C']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'B');
});

test('classify: empty inputs yield empty report', () => {
  const r = classifyKuiperKsCrossingDiagnostic([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothReject, 0);
  assert.equal(r.kuiperOnly, 0);
  assert.equal(r.ksOnly, 0);
  assert.equal(r.balancedCrossings, 0);
  assert.deepEqual(r.sourcesOnlyInKp, []);
  assert.deepEqual(r.sourcesOnlyInKs, []);
});

test('classify: bucketCounts sums to row count', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [
      kp('A', 0.6, 0.01), // both reject one-sided
      kp('B', 0.6, 0.04), // kuiper-only
      kp('C', 0.5, 0.10), // ks-only or neither
      kp('D', 0.2, 0.5), // neither
    ],
    [
      ks('A', 0.6, 0.01),
      ks('B', 0.3, 0.10),
      ks('C', 0.5, 0.04),
      ks('D', 0.2, 0.4),
    ],
  );
  const total = Object.values(r.bucketCounts).reduce((a, b) => a + b, 0);
  assert.equal(total, r.rows.length);
  assert.equal(total, 4);
});

test('classify: shapeRatio clamped to [1, 2]', () => {
  // ksD slightly above kpV (impossible mathematically
  // but possible via floating-point or upstream bug);
  // we clamp ratio to 1.
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.4999999, 0.1)],
    [ks('A', 0.5, 0.1)],
  );
  assert.equal(r.rows[0]!.shapeRatio, 1);
});

test('classify: shapeRatio precise for mixed case', () => {
  // ratio = 1.4
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0.7, 0.04)],
    [ks('A', 0.5, 0.04)],
  );
  assert.ok(Math.abs(r.rows[0]!.shapeRatio! - 1.4) < 1e-12);
  assert.equal(r.rows[0]!.shape, 'mixed-crossing');
  assert.equal(r.rows[0]!.bucket, 'both-reject-mixed-crossing');
});

test('classify: balancedCrossings counts all buckets with balanced shape', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [
      kp('A', 0.8, 0.01), // both reject balanced
      kp('B', 0.4, 0.20), // both ns balanced
      kp('C', 0.6, 0.04), // kuiper-only balanced
    ],
    [
      ks('A', 0.4, 0.04),
      ks('B', 0.2, 0.20),
      ks('C', 0.3, 0.10),
    ],
  );
  // All three have ratio = 2.0 -> balanced-crossing.
  assert.equal(r.balancedCrossings, 3);
});

test('classify: degenerate row does not count toward any reject bucket', () => {
  const r = classifyKuiperKsCrossingDiagnostic(
    [kp('A', 0, 1), kp('B', 0.7, 0.01)],
    [ks('A', 0, 1), ks('B', 0.5, 0.01)],
  );
  assert.equal(r.bucketCounts.degenerate, 1);
  assert.equal(r.bothReject, 1);
});
