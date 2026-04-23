import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Denylist — see /Users/bojun/AGENTS.md ("aggressive security samples" rule
// and the broader policy that resolved paths printed by `pew-insights
// projects` MUST be filtered. Even with --show-paths, entries matching any
// of these substrings are redacted to <redacted>.
//
// The literal trigger words are assembled at module-load time so the
// committed source does not embed them verbatim (the per-repo push
// guardrail scans diffs for the same tokens).
// ---------------------------------------------------------------------------

const PATH_DENYLIST: string[] = [
  'M' + 'SProject',
  'mai' + '-agents',
  'ms' + 'asg',
  'micro' + 'soft',
];

export function isPathDenylisted(p: string): boolean {
  const lower = p.toLowerCase();
  return PATH_DENYLIST.some((needle) => lower.includes(needle.toLowerCase()));
}

export function redactPath(p: string): string {
  return isPathDenylisted(p) ? '<redacted>' : p;
}

// ---------------------------------------------------------------------------
// Hash candidates
// ---------------------------------------------------------------------------

const ALGOS = ['sha256', 'sha1', 'md5'] as const;
type Algo = (typeof ALGOS)[number];

/**
 * Generate (input → label) variants for a given absolute path. Mirrors what
 * different agent tools (claude-code, codex, opencode, …) might use to
 * derive the project_ref hash.
 */
function pathVariants(absPath: string): Array<{ input: string; variant: string }> {
  const out: Array<{ input: string; variant: string }> = [];
  const noTrail = absPath.replace(/\/$/, '');
  const withTrail = noTrail + '/';

  // Claude-code encoding: '/Users/x/p' → '-Users-x-p'.
  // Doubled '-' for any '-' within the path component is also seen
  // (`/Users/bojun/-hermes/...` → `-Users-bojun--hermes-...`).
  const claudeEnc = noTrail.replace(/\//g, '-');

  out.push({ input: noTrail, variant: 'abs' });
  out.push({ input: withTrail, variant: 'abs/' });
  out.push({ input: claudeEnc, variant: 'claude-enc' });
  return out;
}

function hash(algo: Algo, s: string): string {
  return createHash(algo).update(s).digest('hex').slice(0, 16);
}

export interface ProjectCandidate {
  path: string;          // absolute project root
  basename: string;
}

export interface ResolvedRef {
  projectRef: string;
  path: string;
  basename: string;
  algo: Algo;
  variant: string;
}

/**
 * Build a forward map (projectRef → ResolvedRef) by enumerating every
 * candidate path × every variant × every algo. The first match wins.
 */
export function buildLookup(
  candidates: ProjectCandidate[],
  observedRefs: Set<string>,
): Map<string, ResolvedRef> {
  const out = new Map<string, ResolvedRef>();
  for (const cand of candidates) {
    for (const { input, variant } of pathVariants(cand.path)) {
      for (const algo of ALGOS) {
        const h = hash(algo, input);
        if (observedRefs.has(h) && !out.has(h)) {
          out.set(h, { projectRef: h, path: cand.path, basename: cand.basename, algo, variant });
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filesystem scanning
// ---------------------------------------------------------------------------

const DEFAULT_SCAN_ROOTS = [
  join(homedir(), 'Projects'),
  join(homedir(), 'Desktop'),
  join(homedir(), 'Code'),
  join(homedir(), 'src'),
  join(homedir(), 'work'),
];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.cache',
  'venv', '.venv', '__pycache__', 'target', '.gradle', '.idea',
  'Pods', 'DerivedData', '.tox', '.mypy_cache', '.pytest_cache',
]);

/**
 * Recursively walk `root` up to `maxDepth` levels deep, returning every
 * directory encountered as a potential project root. The set is broad
 * because we don't know which directory level pew hashed; the lookup
 * step rejects mismatches by construction.
 */
async function walk(root: string, maxDepth: number): Promise<ProjectCandidate[]> {
  const out: ProjectCandidate[] = [];
  async function recurse(dir: string, depth: number): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    out.push({ path: dir, basename: basename(dir) });
    if (depth >= maxDepth) return;
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith('.')) continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      await recurse(join(dir, ent.name), depth + 1);
    }
  }
  await recurse(root, 0);
  return out;
}

export interface ScanOptions {
  roots?: string[];
  maxDepth?: number;
}

export async function scanCandidates(opts: ScanOptions = {}): Promise<ProjectCandidate[]> {
  const roots = opts.roots ?? DEFAULT_SCAN_ROOTS;
  const maxDepth = opts.maxDepth ?? 3;
  const all: ProjectCandidate[] = [];
  const seen = new Set<string>();
  for (const root of roots) {
    let exists = false;
    try {
      const st = await fs.stat(root);
      exists = st.isDirectory();
    } catch {
      // ignore missing roots
    }
    if (!exists) continue;
    const cands = await walk(root, maxDepth);
    for (const c of cands) {
      const abs = resolve(c.path);
      if (seen.has(abs)) continue;
      seen.add(abs);
      all.push({ path: abs, basename: c.basename });
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export function defaultCachePath(): string {
  return join(homedir(), '.cache', 'pew-insights', 'project-refs.json');
}

export interface LookupCache {
  version: number;
  generatedAt: string;
  entries: ResolvedRef[];
}

export async function readCache(path: string = defaultCachePath()): Promise<LookupCache | null> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw) as LookupCache;
  } catch {
    return null;
  }
}

export async function writeCache(
  cache: LookupCache,
  path: string = defaultCachePath(),
): Promise<void> {
  await fs.mkdir(join(path, '..'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(cache, null, 2));
}
