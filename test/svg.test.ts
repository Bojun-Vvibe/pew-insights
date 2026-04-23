import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline, barChart, pieChart } from '../src/svg.ts';

test('sparkline: empty input renders empty SVG', () => {
  const out = sparkline([]);
  assert.match(out, /<svg[^>]*viewBox="0 0 240 40"/);
  assert.doesNotMatch(out, /<polyline/);
});

test('sparkline: deterministic output for fixed input', () => {
  const out = sparkline([1, 2, 3, 4, 5], { width: 100, height: 20, pad: 0 });
  // First and last anchor x should be 0 and 100 with 5 points.
  assert.match(out, /points="0,20 25,15 50,10 75,5 100,0"/);
});

test('sparkline: flat series renders flat line', () => {
  const out = sparkline([5, 5, 5], { width: 60, height: 20, pad: 0 });
  // (5-5)/(0||1) → all y at 20-20 = 0? Actually (v-min)/range with range=0||1=1 → 0,
  // y = pad + innerH - 0 * innerH = 20. So all y=20.
  assert.match(out, /points="0,20 30,20 60,20"/);
});

test('sparkline: fill produces a polygon', () => {
  const out = sparkline([1, 2], { fill: '#ccc' });
  assert.match(out, /<polygon[^>]*fill="#ccc"/);
});

test('barChart: empty input renders empty SVG', () => {
  const out = barChart([]);
  assert.match(out, /<svg[\s\S]*<\/svg>/);
  assert.doesNotMatch(out, /<rect/);
});

test('barChart: bars proportional to max value', () => {
  const out = barChart(
    [
      { label: 'a', value: 100 },
      { label: 'b', value: 50 },
    ],
    { width: 400, barHeight: 20, pad: 0, labelWidth: 100, valueWidth: 60 },
  );
  // trackX = 100 + 0 = 100; trackW = 400 - 100 - 60 - 0 = 240.
  // First bar = 240, second = 120.
  assert.match(out, /<rect x="100" y="3" width="240"/);
  assert.match(out, /<rect x="100" y="23" width="120"/);
});

test('barChart: escapes labels', () => {
  const out = barChart([{ label: '<script>', value: 1 }]);
  assert.match(out, /&lt;script&gt;/);
  assert.doesNotMatch(out, /<script>/);
});

test('pieChart: empty / zero-total input renders empty SVG', () => {
  assert.doesNotMatch(pieChart([]), /<path/);
  assert.doesNotMatch(pieChart([{ label: 'x', value: 0 }]), /<path/);
});

test('pieChart: single positive slice renders as full circle', () => {
  const out = pieChart([{ label: 'only', value: 10 }], { size: 100, legendWidth: 100 });
  assert.match(out, /<circle/);
  assert.doesNotMatch(out, /<path/);
});

test('pieChart: multiple slices produce N paths and legend entries', () => {
  const out = pieChart(
    [
      { label: 'a', value: 1 },
      { label: 'b', value: 1 },
      { label: 'c', value: 2 },
    ],
    { size: 100 },
  );
  const pathCount = (out.match(/<path/g) ?? []).length;
  assert.equal(pathCount, 3);
  assert.match(out, /a \(25\.0%\)/);
  assert.match(out, /b \(25\.0%\)/);
  assert.match(out, /c \(50\.0%\)/);
});

test('pieChart: deterministic for same input', () => {
  const a = pieChart([
    { label: 'x', value: 30 },
    { label: 'y', value: 70 },
  ]);
  const b = pieChart([
    { label: 'x', value: 30 },
    { label: 'y', value: 70 },
  ]);
  assert.equal(a, b);
});
