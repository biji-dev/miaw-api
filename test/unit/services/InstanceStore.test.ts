/**
 * Unit tests for the persistent instance store.
 *
 * The file is shared with `miaw-cli instance set-proxy`, so the format and the
 * durability guarantees are contracts, not implementation details.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InstanceStore,
  getInstanceStorePath,
} from '../../../src/services/InstanceStore.js';

describe('InstanceStore', () => {
  let dir: string;
  let file: string;
  let store: InstanceStore;
  const logger = { warn: vi.fn() };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miaw-store-'));
    file = getInstanceStorePath(dir);
    store = new InstanceStore(file, logger);
    logger.warn.mockClear();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('places the file beside the instance directories, not inside them', () => {
    // Core's clearSession() rm -rf's <sessionPath>/<id>/ on logout, so a record
    // stored inside would be destroyed by a routine logout.
    expect(getInstanceStorePath('/tmp/sessions')).toBe('/tmp/sessions/instances.json');
  });

  it('returns an empty config when the file does not exist', () => {
    expect(store.read()).toEqual({ version: 1, instances: {} });
    expect(store.list()).toEqual({});
  });

  it('round-trips a record in miaw-core\'s format', async () => {
    await store.upsert('bot-eu', {
      proxy: { label: 'eu', updatedAt: '2026-09-02T14:03:11.418Z' },
      webhookUrl: 'https://example.test/hook',
      webhookEvents: ['ready'],
    });

    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(raw.version).toBe(1);
    expect(raw.instances['bot-eu'].proxy).toEqual({
      label: 'eu',
      updatedAt: '2026-09-02T14:03:11.418Z',
    });
    expect(store.list()['bot-eu'].webhookUrl).toBe('https://example.test/hook');
    // Trailing newline, 2-space indent - byte-compatible with miaw-cli.
    expect(fs.readFileSync(file, 'utf-8').endsWith('}\n')).toBe(true);
  });

  it('preserves keys written by miaw-cli that it does not understand', async () => {
    fs.writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        instances: {
          'bot-eu': {
            proxy: { label: 'eu' },
            somethingTheCliOwns: { keep: true },
          },
        },
      })
    );

    await store.upsert('bot-eu', { webhookUrl: 'https://example.test/hook' });

    const record = store.list()['bot-eu'];
    expect(record.somethingTheCliOwns).toEqual({ keep: true });
    expect(record.proxy).toEqual({ label: 'eu' });
    expect(record.webhookUrl).toBe('https://example.test/hook');
  });

  it('deletes a key when the merged value is undefined', async () => {
    await store.upsert('bot', { proxy: { url: 'http://proxy.test:8080/' } });
    await store.upsert('bot', { proxy: undefined });
    expect(store.list().bot.proxy).toBeUndefined();
  });

  it('removes a record entirely, and tolerates a missing one', async () => {
    await store.upsert('bot', { webhookUrl: 'https://example.test/hook' });
    await store.remove('bot');
    expect(store.list()).toEqual({});
    await expect(store.remove('never-existed')).resolves.toBeUndefined();
  });

  it('throws on a corrupt file rather than reporting it empty', async () => {
    // Treating it as empty would drop every pin and connect directly, leaking
    // the real egress IP the pins exist to hide.
    fs.writeFileSync(file, '{ not json');
    expect(() => store.read()).toThrow('is not valid JSON');

    fs.writeFileSync(file, '[]');
    expect(() => store.read()).toThrow('must contain a JSON object');

    fs.writeFileSync(file, '{"version":1}');
    expect(() => store.read()).toThrow('missing an "instances" object');
  });

  it('writes owner-only and leaves no temporary file behind', async () => {
    await store.upsert('bot', { proxy: { url: 'http://user:pw@proxy.test:8080/' } });

    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  it('tightens a pre-existing file that another tool left readable', async () => {
    fs.writeFileSync(file, JSON.stringify({ version: 1, instances: {} }), {
      mode: 0o644,
    });
    await store.upsert('bot', { webhookUrl: 'https://example.test/hook' });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it('warns once when the file is readable by other users', () => {
    fs.writeFileSync(file, JSON.stringify({ version: 1, instances: {} }), {
      mode: 0o644,
    });
    store.read();
    store.read();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1]).toContain('chmod 600');
  });

  it('serializes concurrent writes instead of losing them', async () => {
    // miaw-core accepts last-writer-wins because pins are rare human actions;
    // a REST API serves them concurrently, so the store has to serialize.
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.upsert(`bot-${i}`, { webhookUrl: `https://example.test/${i}` })
      )
    );

    const stored = store.list();
    expect(Object.keys(stored)).toHaveLength(25);
    expect(stored['bot-24'].webhookUrl).toBe('https://example.test/24');
  });

  it('keeps serving writes after one of them fails', async () => {
    const boom = store.upsert('bot', {
      get proxy(): never {
        throw new Error('boom');
      },
    } as never);
    await expect(boom).rejects.toThrow('boom');

    await store.upsert('after', { webhookUrl: 'https://example.test/after' });
    expect(store.list().after.webhookUrl).toBe('https://example.test/after');
  });
});
