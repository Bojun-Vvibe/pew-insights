import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound,
} from '../src/classifynoetherturningpointlagtwovslagonetrendstructurecompound.js';

test('classifyNoether...: empty inputs => zero rows, zero counts', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.coherentRows, 0);
  assert.equal(r.crossLagFlipRows, 0);
  assert.equal(r.lagSpecificRows, 0);
});

test('classifyNoether...: alpha must be in (0, 0.5]', () => {
  assert.throws(
    () => classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound([], [], 0),
    /alpha/,
  );
  assert.throws(
    () => classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound([], [], 0.6),
    /alpha/,
  );
  assert.throws(
    () => classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound([], [], NaN),
    /alpha/,
  );
});

test('classifyNoether...: rejects duplicate sources', () => {
  assert.throws(
    () =>
      classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
        [
          { source: 's', noetherZ: 1, noetherPValue: 0.5 },
          { source: 's', noetherZ: 2, noetherPValue: 0.4 },
        ],
        [],
      ),
    /duplicate noether source/,
  );
});

test('classifyNoether...: rejects non-finite Z', () => {
  assert.throws(
    () =>
      classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
        [{ source: 's', noetherZ: NaN, noetherPValue: 0.5 }],
        [],
      ),
    /invalid noetherZ/,
  );
});

test('classifyNoether...: rejects pValue outside (0, 1]', () => {
  assert.throws(
    () =>
      classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
        [{ source: 's', noetherZ: 0, noetherPValue: 0 }],
        [],
      ),
    /invalid noetherZ/,
  );
});

test('classifyNoether...: only-in-X lists computed', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [
      { source: 'a', noetherZ: 1, noetherPValue: 0.5 },
      { source: 'b', noetherZ: 2, noetherPValue: 0.5 },
    ],
    [
      { source: 'a', tprZ: 1, tprPValue: 0.5 },
      { source: 'c', tprZ: 1, tprPValue: 0.5 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInNoether, ['b']);
  assert.deepEqual(r.sourcesOnlyInTurningPoint, ['c']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'a');
});

test('classifyNoether...: coherent-trend bucket (both decisive, both trend)', () => {
  // tprZ < 0 (lag-1 trend) AND noetherZ > 0 (lag-2 trend) AND both decisive
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: 3, noetherPValue: 0.001 }],
    [{ source: 's', tprZ: -3, tprPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-trend');
  assert.equal(r.coherentRows, 1);
  assert.equal(r.bucketCounts['coherent-trend'], 1);
  assert.equal(r.rows[0]!.lag1TrendSignal, 3);
  assert.equal(r.rows[0]!.lag2TrendSignal, 3);
});

test('classifyNoether...: coherent-cyclic bucket', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: -3, noetherPValue: 0.001 }],
    [{ source: 's', tprZ: 3, tprPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'coherent-cyclic');
  assert.equal(r.coherentRows, 1);
});

test('classifyNoether...: cross-lag-flip-trend-lag2-only', () => {
  // tprZ > 0 (lag-1 jagged/cyclic) AND noetherZ > 0 (lag-2 trend), both decisive
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: 3, noetherPValue: 0.001 }],
    [{ source: 's', tprZ: 3, tprPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'cross-lag-flip-trend-lag2-only');
  assert.equal(r.crossLagFlipRows, 1);
});

test('classifyNoether...: cross-lag-flip-trend-lag1-only', () => {
  // tprZ < 0 (lag-1 trend) AND noetherZ < 0 (lag-2 cyclic), both decisive
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: -3, noetherPValue: 0.001 }],
    [{ source: 's', tprZ: -3, tprPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'cross-lag-flip-trend-lag1-only');
  assert.equal(r.crossLagFlipRows, 1);
});

test('classifyNoether...: lag2-only bucket (noether decisive, tpr not)', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: 3, noetherPValue: 0.001 }],
    [{ source: 's', tprZ: 0.5, tprPValue: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'lag2-only');
  assert.equal(r.lagSpecificRows, 1);
});

test('classifyNoether...: lag1-only bucket (tpr decisive, noether not)', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: 0.3, noetherPValue: 0.7 }],
    [{ source: 's', tprZ: 3, tprPValue: 0.001 }],
  );
  assert.equal(r.rows[0]!.bucket, 'lag1-only');
});

test('classifyNoether...: no-evidence bucket', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: 0.3, noetherPValue: 0.7 }],
    [{ source: 's', tprZ: 0.5, tprPValue: 0.6 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-evidence');
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.atLeastOneDecisive, 0);
});

test('classifyNoether...: bothDecisive and atLeastOneDecisive counts', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [
      { source: 'a', noetherZ: 3, noetherPValue: 0.001 },
      { source: 'b', noetherZ: 0.3, noetherPValue: 0.7 },
      { source: 'c', noetherZ: 3, noetherPValue: 0.001 },
    ],
    [
      { source: 'a', tprZ: -3, tprPValue: 0.001 },
      { source: 'b', tprZ: 3, tprPValue: 0.001 },
      { source: 'c', tprZ: 0.5, tprPValue: 0.6 },
    ],
  );
  assert.equal(r.bothDecisive, 1); // 'a'
  assert.equal(r.atLeastOneDecisive, 3); // a, b, c all have at least one decisive
});

test('classifyNoether...: source-asc deterministic ordering', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [
      { source: 'zebra', noetherZ: 1, noetherPValue: 0.4 },
      { source: 'alpha', noetherZ: 1, noetherPValue: 0.4 },
      { source: 'mike', noetherZ: 1, noetherPValue: 0.4 },
    ],
    [
      { source: 'mike', tprZ: 1, tprPValue: 0.4 },
      { source: 'alpha', tprZ: 1, tprPValue: 0.4 },
      { source: 'zebra', tprZ: 1, tprPValue: 0.4 },
    ],
  );
  assert.deepEqual(
    r.rows.map((row) => row.source),
    ['alpha', 'mike', 'zebra'],
  );
});

test('classifyNoether...: lag-1 and lag-2 trend signals coded correctly', () => {
  const r = classifyNoetherTurningPointLagTwoVsLagOneTrendStructureCompound(
    [{ source: 's', noetherZ: -2.5, noetherPValue: 0.012 }],
    [{ source: 's', tprZ: 1.7, tprPValue: 0.089 }],
  );
  assert.equal(r.rows[0]!.lag1TrendSignal, -1.7);
  assert.equal(r.rows[0]!.lag2TrendSignal, -2.5);
});
