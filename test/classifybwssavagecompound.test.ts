import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBwsSavageCompound } from '../src/classifybwssavagecompound.js';

test('compound bws+sav: empty inputs return empty report', () => {
  const r = classifyBwsSavageCompound([], []);
  assert.equal(r.rows.length, 0);
  assert.equal(r.atLeastOneDecisive, 0);
  assert.equal(r.bothDecisive, 0);
  assert.equal(r.jointAndAllDecisive, 0);
});

test('compound bws+sav: validates alpha range', () => {
  assert.throws(() => classifyBwsSavageCompound([], [], 0));
  assert.throws(() => classifyBwsSavageCompound([], [], 0.6));
  assert.throws(() => classifyBwsSavageCompound([], [], Number.NaN));
});

test('compound bws+sav: rejects duplicate sources', () => {
  assert.throws(() =>
    classifyBwsSavageCompound(
      [
        { source: 'a', savZ: 1, savPValue: 0.1 },
        { source: 'a', savZ: 2, savPValue: 0.05 },
      ],
      [],
    ),
  );
  assert.throws(() =>
    classifyBwsSavageCompound(
      [],
      [
        { source: 'b', bwsB: 1, bwsPValue: 0.1, bwsSign: 1 },
        { source: 'b', bwsB: 2, bwsPValue: 0.05, bwsSign: 1 },
      ],
    ),
  );
});

test('compound bws+sav: rejects invalid statistic values', () => {
  assert.throws(() =>
    classifyBwsSavageCompound(
      [{ source: 'a', savZ: Number.NaN, savPValue: 0.1 }],
      [],
    ),
  );
  assert.throws(() =>
    classifyBwsSavageCompound(
      [],
      [{ source: 'b', bwsB: -1, bwsPValue: 0.1, bwsSign: 1 }],
    ),
  );
  assert.throws(() =>
    classifyBwsSavageCompound(
      [],
      [{ source: 'b', bwsB: 1, bwsPValue: 0.1, bwsSign: 5 as never }],
    ),
  );
});

test('compound bws+sav: joint-location-and-scale-second when both decisive and signs +', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: 3.5, savPValue: 0.001 }],
    [{ source: 'a', bwsB: 10, bwsPValue: 0.001, bwsSign: 1 }],
  );
  assert.equal(r.rows[0]!.bucket, 'joint-location-and-scale-second');
  assert.equal(r.bothDecisive, 1);
  assert.equal(r.jointAndAllDecisive, 1);
});

test('compound bws+sav: joint-location-and-scale-first when both decisive and signs -', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: -3.5, savPValue: 0.001 }],
    [{ source: 'a', bwsB: 10, bwsPValue: 0.001, bwsSign: -1 }],
  );
  assert.equal(r.rows[0]!.bucket, 'joint-location-and-scale-first');
});

test('compound bws+sav: pure-location-second when only Savage decisive +', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: 3.0, savPValue: 0.01 }],
    [{ source: 'a', bwsB: 0.5, bwsPValue: 0.5, bwsSign: 1 }],
  );
  assert.equal(r.rows[0]!.bucket, 'pure-location-second');
});

test('compound bws+sav: pure-location-first when only Savage decisive -', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: -3.0, savPValue: 0.01 }],
    [{ source: 'a', bwsB: 0.5, bwsPValue: 0.5, bwsSign: -1 }],
  );
  assert.equal(r.rows[0]!.bucket, 'pure-location-first');
});

test('compound bws+sav: pure-scale-or-shape when only BWS decisive', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: 0.5, savPValue: 0.6 }],
    [{ source: 'a', bwsB: 12, bwsPValue: 0.0001, bwsSign: 0 }],
  );
  assert.equal(r.rows[0]!.bucket, 'pure-scale-or-shape');
});

test('compound bws+sav: no-decisive-departure when neither decisive', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: 0.5, savPValue: 0.6 }],
    [{ source: 'a', bwsB: 0.5, bwsPValue: 0.5, bwsSign: 0 }],
  );
  assert.equal(r.rows[0]!.bucket, 'no-decisive-departure');
});

test('compound bws+sav: sign-conflict when both decisive but signs disagree', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: -3.0, savPValue: 0.01 }],
    [{ source: 'a', bwsB: 10, bwsPValue: 0.001, bwsSign: 1 }],
  );
  assert.equal(r.rows[0]!.bucket, 'sign-conflict');
});

test('compound bws+sav: bwsSign 0 with savage + decisive routes to second-larger', () => {
  const r = classifyBwsSavageCompound(
    [{ source: 'a', savZ: 3.0, savPValue: 0.01 }],
    [{ source: 'a', bwsB: 10, bwsPValue: 0.001, bwsSign: 0 }],
  );
  assert.equal(r.rows[0]!.bucket, 'joint-location-and-scale-second');
});

test('compound bws+sav: surfaces sources missing on each side', () => {
  const r = classifyBwsSavageCompound(
    [
      { source: 'only-sav', savZ: 1, savPValue: 0.1 },
      { source: 'both', savZ: 1, savPValue: 0.1 },
    ],
    [
      { source: 'only-bws', bwsB: 1, bwsPValue: 0.1, bwsSign: 1 },
      { source: 'both', bwsB: 1, bwsPValue: 0.1, bwsSign: 1 },
    ],
  );
  assert.deepEqual(r.sourcesOnlyInSavage, ['only-sav']);
  assert.deepEqual(r.sourcesOnlyInBws, ['only-bws']);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.source, 'both');
});

test('compound bws+sav: bucket counts sum to row count', () => {
  const sav = [
    { source: 'a', savZ: 3.5, savPValue: 0.001 },
    { source: 'b', savZ: -3.5, savPValue: 0.001 },
    { source: 'c', savZ: 0.1, savPValue: 0.9 },
    { source: 'd', savZ: 3.0, savPValue: 0.01 },
  ];
  const bws = [
    { source: 'a', bwsB: 10, bwsPValue: 0.001, bwsSign: 1 as const },
    { source: 'b', bwsB: 10, bwsPValue: 0.001, bwsSign: -1 as const },
    { source: 'c', bwsB: 12, bwsPValue: 0.0001, bwsSign: 0 as const },
    { source: 'd', bwsB: 0.5, bwsPValue: 0.5, bwsSign: 1 as const },
  ];
  const r = classifyBwsSavageCompound(sav, bws);
  let s = 0;
  for (const v of Object.values(r.bucketCounts)) s += v;
  assert.equal(s, r.rows.length);
  assert.equal(r.bucketCounts['joint-location-and-scale-second'], 1);
  assert.equal(r.bucketCounts['joint-location-and-scale-first'], 1);
  assert.equal(r.bucketCounts['pure-scale-or-shape'], 1);
  assert.equal(r.bucketCounts['pure-location-second'], 1);
});

test('compound bws+sav: deterministic sort by source asc', () => {
  const sav = [
    { source: 'zebra', savZ: 1, savPValue: 0.1 },
    { source: 'apple', savZ: 1, savPValue: 0.1 },
    { source: 'mango', savZ: 1, savPValue: 0.1 },
  ];
  const bws = sav.map((r) => ({
    source: r.source,
    bwsB: 1,
    bwsPValue: 0.1,
    bwsSign: 1 as const,
  }));
  const r = classifyBwsSavageCompound(sav, bws);
  assert.deepEqual(
    r.rows.map((x) => x.source),
    ['apple', 'mango', 'zebra'],
  );
});
