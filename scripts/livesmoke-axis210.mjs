import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDailyTokenDanielsRankCorrelationTime } from '../dist/dailytokendanielsrankcorrelationtime.js';

const path = join(homedir(), '.config', 'pew', 'queue.jsonl');
const raw = await readFile(path, 'utf8');
const queue = raw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

const rep = buildDailyTokenDanielsRankCorrelationTime(queue, { sort: 'source' });
for (const s of rep.sources) {
  console.log(
    `${s.source}: n=${s.nTenureDays} drRho=${s.drRho.toFixed(4)} drZ=${s.drZ.toFixed(4)} drP=${s.drPValue.toExponential(3)}`,
  );
}
console.log(`---`);
console.log(`totalSources=${rep.totalSources} shown=${rep.sources.length}`);
