import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyTokenUpperRecordsCount } from '../src/dailytokenupperrecordscount.js';

// Property-style anchors for the upper-records primitive.
// These verify the closed-form Renyi 1962 moments and the
// integer count algorithm against an explicit reference
// computation, on a variety of series shapes.

function harmonic(n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k += 1) s += 1 / k;
  return s;
}
function harmonic2(n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k += 1) s += 1 / (k * k);
  return s;
}

function naiveStrictRecords(values: number[]): number {
  let prev = values[0]!;
  let count = 1;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! > prev) {
      count += 1;
      prev = values[i]!;
    }
  }
  return count;
}

function naiveLooseRecords(values: number[]): number {
  let prev = values[0]!;
  let count = 1;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i]! >= prev) {
      count += 1;
      prev = values[i]!;
    }
  }
  return count;
}

// Mulberry32 — deterministic PRNG so the property-style
// suite is reproducible and CI-stable.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('upper-records property: matches naive scan on 50 random series', () => {
  const rand = mulberry32(20260503);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 5 + Math.floor(rand() * 40); // 5..44
    const series = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      // mix of continuous values and integer ties
      series[i] = Math.floor(rand() * 100);
    }
    // ensure not constant
    let mn = series[0]!;
    let mx = series[0]!;
    for (const v of series) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) {
      series[series.length - 1] = mx + 1;
    }
    const r = dailyTokenUpperRecordsCount(series);
    assert.equal(
      r.nUpperRecords,
      naiveStrictRecords(series),
      `trial ${trial}: strict count mismatch`,
    );
    assert.equal(
      r.nUpperRecordsLoose,
      naiveLooseRecords(series),
      `trial ${trial}: loose count mismatch`,
    );
  }
});

test('upper-records property: nUpperRecords is in {1, .., n}', () => {
  const rand = mulberry32(424242);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(rand() * 50);
    const series: number[] = [];
    for (let i = 0; i < n; i += 1) series.push(rand() * 1000 + i * 0.001);
    const r = dailyTokenUpperRecordsCount(series);
    assert.ok(
      r.nUpperRecords >= 1 && r.nUpperRecords <= n,
      `n=${n}, R=${r.nUpperRecords} not in [1, n]`,
    );
  }
});

test('upper-records property: strict <= loose always', () => {
  const rand = mulberry32(7);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 4 + Math.floor(rand() * 30);
    const series: number[] = [];
    for (let i = 0; i < n; i += 1) series.push(Math.floor(rand() * 5));
    let mn = series[0]!;
    let mx = series[0]!;
    for (const v of series) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) series[series.length - 1] = mx + 1;
    const r = dailyTokenUpperRecordsCount(series);
    assert.ok(
      r.nUpperRecords <= r.nUpperRecordsLoose,
      `strict ${r.nUpperRecords} > loose ${r.nUpperRecordsLoose}`,
    );
  }
});

test('upper-records property: lastRecordIndex >= argmaxIndex never (lastRecord is the LAST strict record, argmax is FIRST occurrence of max -- they should coincide when strict)', () => {
  // For STRICT records, the argmax (first occurrence of max) is
  // always the LAST strict record (no later strict record can
  // exceed the running max once max is reached).
  const rand = mulberry32(13);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 5 + Math.floor(rand() * 30);
    const series: number[] = [];
    for (let i = 0; i < n; i += 1) series.push(rand() * 100);
    const r = dailyTokenUpperRecordsCount(series);
    assert.equal(
      r.lastRecordIndex,
      r.argmaxIndex,
      `lastRecordIndex=${r.lastRecordIndex} argmaxIndex=${r.argmaxIndex}`,
    );
  }
});

test('upper-records property: closed-form mean H_n is exact', () => {
  for (const n of [4, 5, 8, 13, 21, 34, 50, 72, 100]) {
    const r = dailyTokenUpperRecordsCount(
      Array.from({ length: n }, (_, i) => i),
    );
    assert.ok(
      Math.abs(r.recordExpectedIid - harmonic(n)) < 1e-12,
      `n=${n}: H_n=${harmonic(n)} got ${r.recordExpectedIid}`,
    );
    assert.ok(
      Math.abs(r.recordVarIid - (harmonic(n) - harmonic2(n))) < 1e-12,
      `n=${n}: var mismatch`,
    );
  }
});

test('upper-records property: shuffled series have the same argmax value but different R', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const sortedAsc = dailyTokenUpperRecordsCount(base);
  const sortedDesc = dailyTokenUpperRecordsCount([...base].reverse());
  assert.equal(sortedAsc.maxValue, sortedDesc.maxValue);
  assert.equal(sortedAsc.nUpperRecords, 10);
  assert.equal(sortedDesc.nUpperRecords, 1);
});
