/**
 * Persistent Instance Store
 *
 * Owns all access to `<sessionPath>/instances.json` - the same file
 * `miaw-cli instance set-proxy` writes. miaw-core ships this store but seals it
 * behind a single-entry `exports` map, so the format is reimplemented here
 * rather than imported. Keep the two in sync: format changes must stay
 * byte-compatible with `miaw-core/src/cli/utils/instance-config.ts`.
 *
 * Why one central file rather than `<sessionPath>/<id>/instance.json`: core's
 * `AuthHandler.clearSession()` does `rm -rf` on the instance directory during
 * logout, so anything stored inside is destroyed by a routine logout. A record
 * must also be writable before the instance exists, so a pairing can come from
 * the final egress IP.
 *
 * Secrets: a `url` pin embeds proxy credentials, so the file is written 0600.
 * Prefer `label` pins, which store none.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  InstanceConfigFile,
  StoredInstanceRecord,
} from '../types/index.js';

/** File name inside the session directory. Fixed by miaw-core. */
const CONFIG_FILENAME = 'instances.json';

/** On-disk schema version. Shared with miaw-core. */
const CONFIG_VERSION = 1 as const;

interface StoreLogger {
  warn(data: object, message: string): void;
}

/** Paths already warned about, so a read loop does not repeat itself. */
const permissionWarned = new Set<string>();

export function getInstanceStorePath(sessionPath: string): string {
  return path.join(sessionPath, CONFIG_FILENAME);
}

export class InstanceStore {
  private readonly filePath: string;
  private readonly logger?: StoreLogger;

  /** Serializes read-modify-write. miaw-core accepts last-writer-wins because
   *  pins are rare human operations; a REST API serves them concurrently. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(filePath: string, logger?: StoreLogger) {
    this.filePath = filePath;
    this.logger = logger;
  }

  get path(): string {
    return this.filePath;
  }

  /**
   * Read the whole file.
   *
   * A missing file is normal and yields an empty config. Anything else
   * **throws**: treating a corrupt file as empty would drop every pin and
   * connect directly, leaking the real egress IP - the exact failure this file
   * exists to prevent.
   */
  read(): InstanceConfigFile {
    if (!fs.existsSync(this.filePath)) {
      return { version: CONFIG_VERSION, instances: {} };
    }

    this.warnOnLoosePermissions();

    let raw: string;
    try {
      raw = fs.readFileSync(this.filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Cannot read ${this.filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `${this.filePath} is not valid JSON. Fix or delete it - refusing to continue, because treating it as empty would connect without the pinned proxy.`
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${this.filePath} must contain a JSON object.`);
    }

    const candidate = parsed as Partial<InstanceConfigFile>;
    if (typeof candidate.instances !== 'object' || candidate.instances === null) {
      throw new Error(`${this.filePath} is missing an "instances" object.`);
    }

    return {
      version: CONFIG_VERSION,
      instances: candidate.instances as Record<string, StoredInstanceRecord>,
    };
  }

  /** Every stored record, keyed by instanceId. */
  list(): Record<string, StoredInstanceRecord> {
    return this.read().instances;
  }

  /**
   * Merge `record` into the stored entry for `instanceId`.
   *
   * Keys absent from `record` are left untouched, so a field miaw-cli owns
   * survives a write from here. Passing `undefined` for a key deletes it.
   */
  async upsert(
    instanceId: string,
    record: Partial<StoredInstanceRecord>
  ): Promise<void> {
    return this.serialize(() => {
      const config = this.read();
      const existing = config.instances[instanceId] ?? {};
      const merged: StoredInstanceRecord = { ...existing };

      for (const [key, value] of Object.entries(record)) {
        if (value === undefined) delete merged[key];
        else merged[key] = value;
      }

      config.instances[instanceId] = merged;
      this.write(config);
    });
  }

  /** Remove an instance's record entirely. Missing is not an error. */
  async remove(instanceId: string): Promise<void> {
    return this.serialize(() => {
      const config = this.read();
      if (!(instanceId in config.instances)) return;
      delete config.instances[instanceId];
      this.write(config);
    });
  }

  /**
   * Run `task` after every previously queued task, whether they resolved or
   * threw. Callers still see their own rejection.
   */
  private serialize(task: () => void): Promise<void> {
    const run = this.queue.then(task, task);
    // Swallow on the chain only; the returned promise keeps its rejection.
    this.queue = run.catch(() => undefined);
    return run;
  }

  /**
   * tmp + rename, so a crash mid-write cannot leave a half-written file that
   * the next read would reject.
   */
  private write(config: InstanceConfigFile): void {
    const dir = path.dirname(this.filePath);
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;

    fs.mkdirSync(dir, { recursive: true });

    try {
      fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, {
        mode: 0o600,
      });
      fs.renameSync(tmpPath, this.filePath);
      try {
        // rename keeps the tmp file's mode, but a pre-existing target may have
        // been created looser by an older version or another tool.
        fs.chmodSync(this.filePath, 0o600);
      } catch {
        // No-op on platforms without POSIX permissions.
      }
    } finally {
      try {
        fs.rmSync(tmpPath, { force: true });
      } catch {
        // Already renamed away, or unremovable - nothing useful to do.
      }
    }
  }

  /** Warn once per path when the file is group- or world-readable. */
  private warnOnLoosePermissions(): void {
    if (permissionWarned.has(this.filePath)) return;
    try {
      const { mode } = fs.statSync(this.filePath);
      if (mode & 0o077) {
        permissionWarned.add(this.filePath);
        this.logger?.warn(
          { path: this.filePath },
          `${this.filePath} is readable by other users and may contain proxy credentials. Fix with: chmod 600 ${this.filePath}`
        );
      }
    } catch {
      // Ignore - the caller is about to surface any real read error.
    }
  }
}
