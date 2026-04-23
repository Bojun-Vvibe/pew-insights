import { homedir } from 'node:os';
import { join } from 'node:path';

export interface PewPaths {
  home: string;
  configJson: string;
  deviceJson: string;
  lastRunJson: string;
  lastSuccessJson: string;
  trailingLock: string;
  queueJsonl: string;
  queueStateJson: string;
  sessionQueueJsonl: string;
  sessionQueueStateJson: string;
  cursorsJson: string;
  sessionCursorsJson: string;
  runsDir: string;
}

/**
 * Resolve the pew state directory.
 *
 * Precedence: explicit override > $PEW_HOME > ~/.config/pew
 */
export function resolvePewPaths(override?: string): PewPaths {
  const home =
    override ??
    process.env['PEW_HOME'] ??
    join(homedir(), '.config', 'pew');

  return {
    home,
    configJson: join(home, 'config.json'),
    deviceJson: join(home, 'device.json'),
    lastRunJson: join(home, 'last-run.json'),
    lastSuccessJson: join(home, 'last-success.json'),
    trailingLock: join(home, 'trailing.lock'),
    queueJsonl: join(home, 'queue.jsonl'),
    queueStateJson: join(home, 'queue.state.json'),
    sessionQueueJsonl: join(home, 'session-queue.jsonl'),
    sessionQueueStateJson: join(home, 'session-queue.state.json'),
    cursorsJson: join(home, 'cursors.json'),
    sessionCursorsJson: join(home, 'session-cursors.json'),
    runsDir: join(home, 'runs'),
  };
}
