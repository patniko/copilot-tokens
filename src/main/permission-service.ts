import Store from 'electron-store';
import { normalize, resolve } from 'node:path';

export interface PermissionRule {
  kind: string;         // 'write' | 'shell' | 'read'
  pathPrefix: string;   // normalized absolute path that's always allowed
}

interface PermissionStoreSchema {
  permissionRules: PermissionRule[];
}

const store = new Store<PermissionStoreSchema>({
  name: 'permissions',
  defaults: {
    permissionRules: [],
  },
});

function normPath(p: string): string {
  return normalize(resolve(p)).replace(/\/+$/, '');
}

function isUnder(filePath: string, prefix: string): boolean {
  const nFile = normPath(filePath);
  const nPrefix = normPath(prefix);
  return nFile === nPrefix || nFile.startsWith(nPrefix + '/');
}

/**
 * Extract a path from a permission request based on its kind.
 */
function extractPath(request: Record<string, unknown>): string | null {
  const raw = request.path ?? request.file ?? request.filePath ?? null;
  return raw ? String(raw) : null;
}

export type EvalResult = 'allow' | 'ask';

export class PermissionService {
  /**
   * Evaluate whether a permission request should be auto-allowed or needs user approval.
   */
  evaluate(request: Record<string, unknown>, cwd: string): EvalResult {
    const kind = String(request.kind ?? '');

    // URL and MCP: always auto-approve
    if (kind === 'url' || kind === 'mcp') return 'allow';

    const filePath = extractPath(request);

    // Read under CWD: always auto-approve
    if (kind === 'read') {
      if (filePath && cwd && isUnder(filePath, cwd)) return 'allow';
    }

    // Check persisted "always allow" rules
    const rules = this.getRules();
    for (const rule of rules) {
      if (rule.kind !== kind) continue;

      // Shell rules: match if CWD is under the rule prefix (shell doesn't have a single path)
      if (kind === 'shell') {
        if (cwd && isUnder(cwd, rule.pathPrefix)) return 'allow';
      }

      // File-path rules (read / write)
      if (filePath && isUnder(filePath, rule.pathPrefix)) return 'allow';
    }

    return 'ask';
  }

  /** Add a persistent "always allow" rule. */
  addRule(rule: PermissionRule): void {
    const rules = this.getRules();
    const norm: PermissionRule = { kind: rule.kind, pathPrefix: normPath(rule.pathPrefix) };
    // Don't duplicate
    const exists = rules.some(r => r.kind === norm.kind && r.pathPrefix === norm.pathPrefix);
    if (!exists) {
      rules.push(norm);
      store.set('permissionRules', rules);
    }
  }

  /** Get all stored rules. */
  getRules(): PermissionRule[] {
    return store.get('permissionRules');
  }

  /** Remove a rule by index. */
  removeRule(index: number): void {
    const rules = this.getRules();
    rules.splice(index, 1);
    store.set('permissionRules', rules);
  }

  /** Clear all rules. */
  clearRules(): void {
    store.set('permissionRules', []);
  }
}
