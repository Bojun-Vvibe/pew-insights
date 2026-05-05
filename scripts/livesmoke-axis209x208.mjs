import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDailyTokenWallisMoorePhaseFrequency } from '../dist/dailytokenwallismoorephasefrequency.js';
import { buildDailyTokenSpearmanFootruleTime } from '../dist/dailytokenspearmanfootruletime.js';
import {
  classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound,
  summarizeAxis209Axis208WallisMooreSpearmanFootruleReport,
} from '../dist/classifyaxis209axis208wallismoorespearmanfootrulephasesmoothnessvsrankalignmentcompound.js';

const path = join(homedir(), '.config', 'pew', 'queue.jsonl');
const raw = await readFile(path, 'utf8');
const queue = raw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

const wm = buildDailyTokenWallisMoorePhaseFrequency(queue);
const sf = buildDailyTokenSpearmanFootruleTime(queue);

const wmRows = wm.sources.map((s) => ({
  source: s.source,
  wmZ: s.wmZ,
  wmPValue: Math.max(s.wmPValue, Number.MIN_VALUE),
}));
const sfRows = sf.sources.map((s) => ({
  source: s.source,
  sfZ: s.sfZ,
  sfPValue: Math.max(s.sfPValue, Number.MIN_VALUE),
}));

const report =
  classifyAxis209Axis208WallisMooreSpearmanFootrulePhaseSmoothnessVsRankAlignmentCompound(
    wmRows,
    sfRows,
  );

console.log(summarizeAxis209Axis208WallisMooreSpearmanFootruleReport(report));
console.log('---');
for (const row of report.rows) {
  console.log(
    `${row.source}: wmZ=${row.wmZ.toFixed(4)} wmP=${row.wmPValue.toExponential(3)} sfZ=${row.sfZ.toFixed(4)} sfP=${row.sfPValue.toExponential(3)} bucket=${row.bucket} qd=${row.jointSignQuadrant ?? '-'}`,
  );
}
