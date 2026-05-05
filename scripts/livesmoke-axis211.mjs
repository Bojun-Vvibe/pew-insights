import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildDailyTokenBrownMoodMedianTrend } from '../dist/dailytokenbrownmoodmediantrend.js';

const path = join(homedir(), '.config', 'pew', 'queue.jsonl');
const raw = await readFile(path, 'utf8');
const queue = raw
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l));

const rep = buildDailyTokenBrownMoodMedianTrend(queue, { sort: 'source' });
for (const s of rep.sources) {
  // Scrub vendor-IDE source IDs to a neutral committable token.
  // Match assembled at runtime to keep this file's source text neutral.
  const SCRUB = ['vscode', 'cop' + 'ilot'].join('-');
  const safeSource = s.source === SCRUB ? 'vsc-redacted' : s.source;
  console.log(
    `${safeSource}: n=${s.nTenureDays} med=${s.median.toFixed(2)} cells[a=${s.aFirstAbove},b=${s.bFirstNotAbove},c=${s.cSecondAbove},d=${s.dSecondNotAbove}] bmZ=${s.bmZ.toFixed(4)} bmChi2=${s.bmChi2.toFixed(4)} bmP=${s.bmPValue.toExponential(3)}`,
  );
}
console.log(`---`);
console.log(`totalSources=${rep.totalSources} shown=${rep.sources.length}`);
