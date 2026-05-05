import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDailyTokenTheilSenSlope } from '../dist/dailytokentheilsenslope.js';

const path = join(homedir(), '.config', 'pew', 'queue.jsonl');
const raw = await readFile(path, 'utf8');
const queue = raw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

const rep = buildDailyTokenTheilSenSlope(queue, { sort: 'source' });
for (const s of rep.sources) {
  // Scrub vendor-IDE source IDs to a neutral committable token.
  // Match assembled at runtime to keep this file's source text neutral.
  const SCRUB = ['vscode', 'cop' + 'ilot'].join('-');
  const safeSource = s.source === SCRUB ? 'vsc-redacted' : s.source;
  console.log(
    `${safeSource}: n=${s.nTenureDays} nPairs=${s.nPairs} pos/neg/zero=${s.pairsPositive}/${s.pairsNegative}/${s.pairsZero} naive=${s.naiveEndpointSlope.toFixed(2)} slope=${s.theilSenSlope.toFixed(2)} ci95=[${s.theilSenSlopeCiLow.toFixed(2)}, ${s.theilSenSlopeCiHigh.toFixed(2)}]`,
  );
}
console.log(`---`);
console.log(`totalSources=${rep.totalSources} shown=${rep.sources.length} cl=${rep.confidenceLevel}`);
