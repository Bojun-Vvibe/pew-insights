import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDailyTokenDanielsRankCorrelationTime } from '../dist/dailytokendanielsrankcorrelationtime.js';
import { buildDailyTokenWallisMoorePhaseFrequency } from '../dist/dailytokenwallismoorephasefrequency.js';
import {
  classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound,
  summarizeAxis210Axis209DanielsWallisMooreReport,
} from '../dist/classifyaxis210axis209danielswallismooreglobalrankalignmentvslocalphasesmoothnesscompound.js';

const path = join(homedir(), '.config', 'pew', 'queue.jsonl');
const raw = await readFile(path, 'utf8');
const queue = raw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

const dr = buildDailyTokenDanielsRankCorrelationTime(queue);
const wm = buildDailyTokenWallisMoorePhaseFrequency(queue);

const drRows = dr.sources.map((s) => ({
  source: s.source,
  drZ: s.drZ,
  drPValue: Math.max(s.drPValue, Number.MIN_VALUE),
}));
const wmRows = wm.sources.map((s) => ({
  source: s.source,
  wmZ: s.wmZ,
  wmPValue: Math.max(s.wmPValue, Number.MIN_VALUE),
}));

const report =
  classifyAxis210Axis209DanielsWallisMooreGlobalRankAlignmentVsLocalPhaseSmoothnessCompound(
    drRows,
    wmRows,
  );

console.log(summarizeAxis210Axis209DanielsWallisMooreReport(report));
console.log('---');
for (const row of report.rows) {
  console.log(
    `${row.source}: drZ=${row.drZ.toFixed(4)} drP=${row.drPValue.toExponential(3)} wmZ=${row.wmZ.toFixed(4)} wmP=${row.wmPValue.toExponential(3)} bucket=${row.bucket} qd=${row.jointSignQuadrant ?? '-'}`,
  );
}
