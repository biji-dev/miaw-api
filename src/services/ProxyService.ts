import { get as httpsGet } from 'node:https';
import {
  ProxyRotator,
  createProxyAgents,
  loadProxyList,
  maskProxyUrl,
  validateProxyConfig,
} from 'miaw-core';
import type {
  ProxyConfig,
  ProxyInfo,
  ProxyPoolEntry,
  ProxyRotationStrategy,
} from 'miaw-core';
import type { EffectiveProxyInfo, ProxySource } from '../types/index.js';

export type ProxyInput = ProxyConfig | string;
export type { EffectiveProxyInfo, ProxySource };

interface ProxyLogger {
  info(data: object, message: string): void;
  warn(data: object, message: string): void;
}

export interface ProxyPoolStatus {
  enabled: boolean;
  strategy: ProxyRotationStrategy | null;
  total: number;
  eligible: number;
  proxies: Array<{ url: string; weight: number; label?: string }>;
}

export interface ProxyTestResult {
  proxy: {
    url: string;
    protocol: string;
  };
  reachable: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  downloadProxied: boolean;
  error: {
    code: string | null;
    message: string;
  } | null;
}

interface ProxyPoolServiceOptions {
  filePath?: string;
  strategy: ProxyRotationStrategy;
  logger: ProxyLogger;
}

const PROXY_TEST_TARGET = 'https://web.whatsapp.com/';

export class ProxyPoolService {
  private readonly filePath?: string;
  private readonly logger: ProxyLogger;
  private rotator: ProxyRotator | null = null;

  /**
   * Raw pool entries, credentials included.
   *
   * `rotator.getStats()` masks its URLs because it exists to be printed, so a
   * label pin cannot be resolved from it - an agent needs the real credentials.
   */
  private entries: ProxyPoolEntry[] = [];

  private constructor(options: ProxyPoolServiceOptions) {
    this.filePath = options.filePath;
    this.logger = options.logger;
  }

  static async create(options: ProxyPoolServiceOptions): Promise<ProxyPoolService> {
    const service = new ProxyPoolService(options);
    if (!options.filePath) return service;

    service.rotator = await ProxyRotator.fromFile(options.filePath, {
      strategy: options.strategy,
      watch: true,
      onReload: (entries) => {
        service.entries = [...entries];
        service.logger.info(
          { proxyCount: entries.length },
          'Proxy pool reloaded from watched file'
        );
      },
      onError: (error) => {
        service.logger.warn(
          { error: error.message },
          'Proxy pool watch reload failed; retaining previous pool'
        );
      },
    });

    // onReload only fires on subsequent reloads, so seed the snapshot here.
    // Lenient on purpose: one malformed line must not stop the server booting,
    // which is already how the rotator treats the same file.
    try {
      service.entries = await loadProxyList(options.filePath, { strict: false });
    } catch (error) {
      options.logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Could not snapshot the proxy pool; label pins will be unresolvable until the next reload'
      );
    }

    return service;
  }

  get enabled(): boolean {
    return this.rotator !== null;
  }

  select(instanceId: string): ProxyPoolEntry | undefined {
    return this.rotator?.next(instanceId);
  }

  /**
   * Resolve a `label` pin against the pool.
   *
   * Throws rather than falling back to a direct connection: a label that cannot
   * be resolved must not silently leak the real egress IP, which is the whole
   * reason the pin exists.
   */
  selectByLabel(label: string, instanceId: string): ProxyPoolEntry {
    if (!this.rotator) {
      throw new Error(
        `Cannot resolve proxy label "${label}": no proxy pool is configured. Set MIAW_PROXY_FILE.`
      );
    }

    const matches = this.entries.filter((entry) => entry.label === label);
    if (matches.length === 0) {
      throw new Error(
        `Cannot resolve proxy label "${label}": no entry in the proxy pool carries it.`
      );
    }
    if (matches.length === 1) return matches[0];

    // Several entries share the label; pick deterministically so the instance
    // keeps a stable egress IP across restarts.
    const scoped = new ProxyRotator({ proxies: matches, strategy: 'deterministic' });
    try {
      return scoped.forInstance(instanceId);
    } finally {
      scoped.close();
    }
  }

  getStatus(): ProxyPoolStatus {
    if (!this.rotator) {
      return {
        enabled: false,
        strategy: null,
        total: 0,
        eligible: 0,
        proxies: [],
      };
    }

    const stats = this.rotator.getStats();
    return {
      enabled: true,
      strategy: stats.strategy,
      total: stats.total,
      eligible: stats.eligible,
      proxies: stats.proxies,
    };
  }

  async reload(): Promise<ProxyPoolStatus> {
    if (!this.filePath || !this.rotator) {
      throw new Error('Proxy pool is not configured');
    }

    const entries = await loadProxyList(this.filePath, { strict: true });
    this.rotator.setProxies(entries);
    this.entries = [...entries];
    this.logger.info(
      { proxyCount: entries.length },
      'Proxy pool reloaded on demand'
    );
    return this.getStatus();
  }

  close(): void {
    this.rotator?.close();
  }
}

export function describeProxy(
  proxy: ProxyInput | undefined,
  source: ProxySource,
  live?: ProxyInfo | null,
  persisted = false
): EffectiveProxyInfo {
  if (!proxy) {
    return {
      source: 'none',
      url: null,
      protocol: null,
      downloadProxied: false,
      active: false,
      appliesOnNextConnect: false,
      persisted: false,
      liveProxy: null,
    };
  }

  const rawUrl = typeof proxy === 'string' ? proxy : proxy.url;
  let protocol = 'unknown';
  try {
    protocol = new URL(rawUrl).protocol.replace(':', '');
  } catch {
    // Invalid proxy inputs are rejected before this helper is called.
  }

  // core's `pending` is the egress the open socket is still using - the
  // opposite of what the name suggests - so it is surfaced as `liveProxy`.
  const active = live?.active ?? false;

  return {
    source,
    url: maskProxyUrl(proxy),
    protocol,
    downloadProxied: protocol === 'http' || protocol === 'https',
    active,
    appliesOnNextConnect: !active,
    persisted,
    liveProxy: live?.pending ? { ...live.pending } : null,
  };
}

/**
 * Probe a proxy and reject when it is unreachable.
 *
 * Opt-in: callers pass `validate: true`. The probe target is fixed and the
 * error text is already credential-scrubbed by `testProxy`.
 */
export async function assertProxyReachable(
  proxy: ProxyInput,
  timeoutMs?: number,
  requester?: ProxyRequester
): Promise<void> {
  const result = await testProxy(proxy, timeoutMs, requester);
  if (result.reachable) return;
  throw new Error(
    `Proxy is not reachable: ${result.error?.message ?? 'no response'}`
  );
}

export async function testProxy(
  proxy: ProxyInput,
  timeoutMs = 10_000,
  requester: ProxyRequester = requestThroughProxy
): Promise<ProxyTestResult> {
  const rawUrl = typeof proxy === 'string' ? proxy : proxy.url;
  const maskedUrl = maskProxyUrl(proxy);

  if (!validateProxyConfig(proxy)) {
    throw new Error('Invalid proxy configuration');
  }

  const protocol = new URL(rawUrl).protocol.replace(':', '');
  const downloadProxied = protocol === 'http' || protocol === 'https';

  let agents: Awaited<ReturnType<typeof createProxyAgents>> | undefined;
  const startedAt = performance.now();

  try {
    agents = await createProxyAgents(proxy);
    const statusCode = await requester(agents.wsAgent, timeoutMs);
    const latencyMs = Math.round(performance.now() - startedAt);

    if (statusCode === 407) {
      return {
        proxy: { url: maskedUrl, protocol },
        reachable: false,
        latencyMs,
        statusCode,
        downloadProxied,
        error: {
          code: 'EPROXYAUTH',
          message: '407 Proxy Authentication Required',
        },
      };
    }

    return {
      proxy: { url: maskedUrl, protocol },
      reachable: true,
      latencyMs,
      statusCode,
      downloadProxied,
      error: null,
    };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : null;
    return {
      proxy: { url: maskedUrl, protocol },
      reachable: false,
      latencyMs: null,
      statusCode: null,
      downloadProxied,
      error: {
        code,
        message: sanitizeProxyError(error, proxy),
      },
    };
  } finally {
    agents?.wsAgent.destroy();
    try {
      await closeDispatcher(agents?.downloadDispatcher);
    } catch {
      // Cleanup failure must not replace the probe result.
    }
  }
}

export type ProxyRequester = (
  agent: Awaited<ReturnType<typeof createProxyAgents>>['wsAgent'],
  timeoutMs: number
) => Promise<number>;

function requestThroughProxy(
  agent: Awaited<ReturnType<typeof createProxyAgents>>['wsAgent'],
  timeoutMs: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpsGet(PROXY_TEST_TARGET, { agent }, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });

    request.setTimeout(timeoutMs, () => {
      const error = Object.assign(new Error(`Proxy test timed out after ${timeoutMs}ms`), {
        code: 'ETIMEDOUT',
      });
      request.destroy(error);
    });
    request.once('error', reject);
  });
}

function sanitizeProxyError(error: unknown, proxy: ProxyInput): string {
  let message = error instanceof Error ? error.message : String(error);
  const rawUrl = typeof proxy === 'string' ? proxy : proxy.url;
  const maskedUrl = maskProxyUrl(proxy);

  message = message.split(rawUrl).join(maskedUrl);
  if (typeof proxy !== 'string' && proxy.password) {
    message = message.split(proxy.password).join('****');
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      message = message
        .split(parsed.password).join('****')
        .split(decodeURIComponent(parsed.password)).join('****');
    }
  } catch {
    // Invalid inputs are handled before a network probe.
  }

  return message.replace(
    /([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)[^@\s/]+@/gi,
    '$1****@'
  );
}

async function closeDispatcher(dispatcher: unknown): Promise<void> {
  if (!dispatcher || typeof dispatcher !== 'object') return;
  if ('close' in dispatcher && typeof dispatcher.close === 'function') {
    await dispatcher.close();
    return;
  }
  if ('destroy' in dispatcher && typeof dispatcher.destroy === 'function') {
    dispatcher.destroy();
  }
}
