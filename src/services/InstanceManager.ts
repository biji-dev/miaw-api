/**
 * Instance Manager Service
 * Manages multiple MiawClient instances
 */

import { EventEmitter } from 'events';
import {
  MiawClient,
  MiawClientOptions,
  ConnectionState,
  maskProxyUrl,
  validateProxyConfig,
} from 'miaw-core';
import { pino } from 'pino';
import {
  InstanceConfig,
  InstanceProxyPin,
  InstanceState,
  ProxyAssignment,
  StoredInstanceRecord,
  WebhookEvent,
  WebhookPayload,
} from '../types/index.js';
import {
  describeProxy,
  type EffectiveProxyInfo,
  type ProxyInput,
  type ProxyPoolService,
  type ProxySource,
} from './ProxyService.js';
import type { InstanceStore } from './InstanceStore.js';

interface InstanceManagerOptions {
  sessionPath: string;
  webhookSecret: string;
  webhookTimeout: number;
  webhookMaxRetries: number;
  webhookRetryDelay: number;
  proxyPool?: ProxyPoolService;
  store?: InstanceStore;
}

export interface ReplaceProxyOptions {
  /** Swap on a live instance: disconnect, restage, reconnect. */
  force?: boolean;
  /** Write the assignment to instances.json. Defaults to true. */
  persist?: boolean;
}

interface ManagedInstance {
  config: InstanceConfig;
  client: MiawClient;
  state: InstanceState;
  disconnectTimeout?: NodeJS.Timeout;
  qrCode?: string;
  pairingCode?: string;
  pairingRetryTimeout?: NodeJS.Timeout;
  effectiveProxy?: ProxyInput;
  proxySource: ProxySource;
  /** In-memory truth for the assignment; mirrored to instances.json. */
  pin?: InstanceProxyPin;
  persisted: boolean;
}

/**
 * Convert a caller-supplied proxy into the pin shape stored on disk.
 *
 * Credentials are folded into the URL exactly as miaw-core's `buildProxyUrl`
 * does (`url.username = ...`), so a pin written here is byte-identical to one
 * written by `miaw-cli instance set-proxy` and percent-encoding is handled by
 * the URL parser rather than by hand.
 */
function pinFromProxy(proxy: ProxyAssignment): InstanceProxyPin {
  const updatedAt = new Date().toISOString();

  if (typeof proxy === 'object' && 'label' in proxy) {
    return { label: proxy.label, updatedAt };
  }

  const raw = typeof proxy === 'string' ? proxy : proxy.url;
  const url = new URL(raw);
  if (typeof proxy !== 'string') {
    if (proxy.username) url.username = proxy.username;
    if (proxy.password) url.password = proxy.password;
  }
  return { url: url.toString(), updatedAt };
}

function isLabelRef(proxy: ProxyAssignment): proxy is { label: string } {
  return typeof proxy === 'object' && 'label' in proxy;
}

/**
 * Manages MiawClient instances
 */
export class InstanceManager extends EventEmitter {
  private instances: Map<string, ManagedInstance> = new Map();
  private options: InstanceManagerOptions;
  private logger: pino.Logger;

  constructor(options: InstanceManagerOptions) {
    super();
    this.options = options;
    this.logger = pino({ level: 'info' });
  }

  /**
   * Create a new instance
   */
  async createInstance(config: InstanceConfig): Promise<InstanceState> {
    const { instanceId } = config;

    if (this.instances.has(instanceId)) {
      throw new Error(`Instance ${instanceId} already exists`);
    }

    this.logger.info({ instanceId }, 'Creating instance');

    const storedConfig = this.cloneConfig(config);

    // A proxy supplied at creation becomes a pin, so it is persisted and
    // resolved by exactly the same path as one set later through the API.
    let pin: InstanceProxyPin | undefined;
    const supplied = storedConfig.clientOptions?.proxy;
    if (supplied !== undefined) {
      if (!validateProxyConfig(supplied)) {
        throw new Error(`Invalid proxy configuration: ${maskProxyUrl(supplied)}`);
      }
      pin = pinFromProxy(supplied);
      delete storedConfig.clientOptions?.proxy;
    }

    const { proxy: effectiveProxy, source: proxySource } =
      this.resolveEffectiveProxy(storedConfig, pin);
    const client = this.createClient(storedConfig, effectiveProxy);

    // Set up event handlers
    this.setupClientEvents(instanceId, client);

    // Create state
    const state: InstanceState = {
      instanceId,
      status: 'disconnected',
      webhookEvents: config.webhookEvents || [],
      webhookUrl: config.webhookUrl,
      webhookEnabled: !!config.webhookUrl,
      authMode: config.clientOptions?.usePairingCode ? 'pairing_code' : 'qr',
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    const managed: ManagedInstance = {
      config: storedConfig,
      client,
      state,
      effectiveProxy,
      proxySource,
      pin,
      persisted: false,
    };

    this.instances.set(instanceId, managed);
    await this.persist(instanceId);

    // miaw-core 1.10.0 still requests a pairing code immediately after constructing
    // its socket. Baileys rejects that pre-handshake request; retry once after
    // the transport is ready so headless pairing remains usable.
    if (storedConfig.clientOptions?.usePairingCode && storedConfig.clientOptions.phoneNumber) {
      this.schedulePairingCodeRetry(instanceId, client, storedConfig.clientOptions.phoneNumber);
    }

    this.logger.info({ instanceId }, 'Instance created');

    return this.toPublicState(managed);
  }

  /**
   * Rebuild instances from the persistent store at boot.
   *
   * Clients are constructed but never connected - reconnecting N paired
   * sessions in a burst is a thundering herd against WhatsApp, so that is the
   * caller's explicit decision. One unusable record must not stop the server,
   * so failures are isolated and logged.
   */
  async restore(records: Record<string, StoredInstanceRecord>): Promise<string[]> {
    const restored: string[] = [];

    for (const [instanceId, record] of Object.entries(records)) {
      if (this.instances.has(instanceId)) continue;

      try {
        const config: InstanceConfig = {
          instanceId,
          webhookUrl: record.webhookUrl,
          webhookEvents: record.webhookEvents,
          clientOptions: record.clientOptions,
        };
        const pin = record.proxy;
        const { proxy: effectiveProxy, source: proxySource } =
          this.resolveEffectiveProxy(config, pin);
        const client = this.createClient(config, effectiveProxy);
        this.setupClientEvents(instanceId, client);

        this.instances.set(instanceId, {
          config,
          client,
          state: {
            instanceId,
            status: 'disconnected',
            webhookEvents: config.webhookEvents || [],
            webhookUrl: config.webhookUrl,
            webhookEnabled: !!config.webhookUrl,
            authMode: config.clientOptions?.usePairingCode ? 'pairing_code' : 'qr',
            createdAt: new Date(),
            lastActivity: new Date(),
          },
          effectiveProxy,
          proxySource,
          pin,
          persisted: true,
        });

        restored.push(instanceId);
        this.logger.info(
          { instanceId, proxy: describeProxy(effectiveProxy, proxySource) },
          'Instance restored from store'
        );
      } catch (error) {
        // Refusing one instance beats booting it onto the wrong egress IP.
        this.logger.error(
          { instanceId, error: error instanceof Error ? error.message : String(error) },
          'Could not restore instance; skipping it'
        );
      }
    }

    return restored;
  }

  /**
   * Get instance state
   */
  getInstance(instanceId: string): InstanceState | null {
    const managed = this.instances.get(instanceId);
    return managed ? this.toPublicState(managed) : null;
  }

  /**
   * List all instances
   */
  listInstances(): InstanceState[] {
    return Array.from(this.instances.values()).map((m) => this.toPublicState(m));
  }

  /**
   * Delete instance
   */
  async deleteInstance(instanceId: string): Promise<void> {
    const managed = this.instances.get(instanceId);

    if (!managed) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    this.logger.info({ instanceId }, 'Deleting instance');

    // Disconnect if connected
    if (managed.state.status === 'connected') {
      await managed.client.disconnect();
    }

    // Remove event listeners
    managed.client.removeAllListeners();
    if (managed.pairingRetryTimeout) clearTimeout(managed.pairingRetryTimeout);

    // Delete from map
    this.instances.delete(instanceId);

    if (this.options.store) {
      try {
        await this.options.store.remove(instanceId);
      } catch (error) {
        this.logger.warn(
          { instanceId, error: error instanceof Error ? error.message : String(error) },
          'Could not remove the stored instance record'
        );
      }
    }

    this.logger.info({ instanceId }, 'Instance deleted');
  }

  /**
   * Update an instance's webhook settings without recreating it.
   * Only the fields present in `updates` are changed; passing
   * `webhookUrl: null` clears the webhook and disables delivery.
   */
  updateWebhook(
    instanceId: string,
    updates: { webhookUrl?: string | null; webhookEvents?: WebhookEvent[] }
  ): InstanceState {
    const managed = this.instances.get(instanceId);

    if (!managed) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const patch: Partial<InstanceState> = {};

    if ('webhookUrl' in updates) {
      const url = updates.webhookUrl || undefined;
      patch.webhookUrl = url;
      patch.webhookEnabled = !!url;
    }

    if ('webhookEvents' in updates) {
      patch.webhookEvents = updates.webhookEvents || [];
    }

    this.updateState(instanceId, patch);
    void this.persist(instanceId);
    this.logger.info({ instanceId }, 'Webhook updated');

    return this.toPublicState(managed);
  }

  /**
   * Get MiawClient for instance
   */
  getClient(instanceId: string): MiawClient | null {
    const managed = this.instances.get(instanceId);
    return managed ? managed.client : null;
  }

  getProxy(instanceId: string): EffectiveProxyInfo {
    const managed = this.instances.get(instanceId);
    if (!managed) throw new Error(`Instance ${instanceId} not found`);
    return this.describeManagedProxy(managed);
  }

  /**
   * Change an instance's proxy.
   *
   * miaw-core stages a proxy for the next connect() rather than touching a live
   * socket, so the order below is load-bearing and comes straight from core's
   * failover recipe: **disconnect first, then setProxy(), then connect()**.
   * Staging before the teardown would let an auto-reconnect fire on the old
   * egress; changing a connected session's IP is read by WhatsApp as account
   * takeover, which is why `force` is required to do it at all.
   *
   * Disconnecting first also sidesteps a core reporting gap: `setProxy(null)`
   * on a live client makes `getProxyInfo()` return null while the socket is
   * still on the old proxy. We never enter that window.
   *
   * @param proxy - a URL, a ProxyConfig, a `{ label }` pool reference, or
   *   null/undefined to clear the assignment and fall back to pool or direct.
   */
  async replaceProxy(
    instanceId: string,
    proxy?: ProxyAssignment | null,
    options: ReplaceProxyOptions = {}
  ): Promise<EffectiveProxyInfo> {
    const managed = this.instances.get(instanceId);
    if (!managed) throw new Error(`Instance ${instanceId} not found`);

    const force = options.force ?? false;
    const persist = options.persist ?? true;
    const wasActive = managed.state.status !== 'disconnected';

    if (wasActive && !force) {
      throw new Error('Instance must be disconnected before changing its proxy');
    }

    let nextPin: InstanceProxyPin | undefined;
    if (proxy !== undefined && proxy !== null) {
      if (!isLabelRef(proxy) && !validateProxyConfig(proxy)) {
        throw new Error(`Invalid proxy configuration: ${maskProxyUrl(proxy)}`);
      }
      nextPin = pinFromProxy(proxy);
    }

    // The pin is the single source of truth, so no stale clientOptions.proxy
    // can shadow it later.
    const nextClientOptions = { ...(managed.config.clientOptions || {}) };
    delete nextClientOptions.proxy;
    const nextConfig: InstanceConfig = {
      ...managed.config,
      clientOptions: nextClientOptions,
    };

    // Resolving before any teardown means an unresolvable label fails while the
    // instance is still intact.
    const { proxy: effectiveProxy, source: proxySource } =
      this.resolveEffectiveProxy(nextConfig, nextPin);

    if (managed.pairingRetryTimeout) {
      clearTimeout(managed.pairingRetryTimeout);
      managed.pairingRetryTimeout = undefined;
    }
    if (wasActive) {
      await managed.client.disconnect();
    }

    const staged = managed.client.setProxy(effectiveProxy ?? null);
    if (!staged.success) {
      if (staged.error?.includes('custom agent')) {
        // The only case staging cannot serve: a client built with its own
        // agent/fetchAgent never consults options.proxy. Unreachable today -
        // this API never passes those - so rebuilding is a narrow fallback.
        this.rebuildClient(instanceId, managed, nextConfig, effectiveProxy);
      } else {
        throw new Error(staged.error || 'Invalid proxy configuration');
      }
    }

    managed.config = nextConfig;
    managed.effectiveProxy = effectiveProxy;
    managed.proxySource = proxySource;
    managed.pin = nextPin;
    managed.qrCode = undefined;
    managed.pairingCode = undefined;

    if (nextConfig.clientOptions?.usePairingCode && nextConfig.clientOptions.phoneNumber) {
      this.schedulePairingCodeRetry(
        instanceId,
        managed.client,
        nextConfig.clientOptions.phoneNumber
      );
    }

    if (persist) {
      await this.persist(instanceId);
    } else if (managed.persisted) {
      // Drop the stored pin rather than leave a stale one to win on the next
      // restart, which would silently move the instance to another egress IP.
      await this.forgetPin(instanceId);
    }

    if (wasActive) {
      await managed.client.connect();
    }

    this.logger.info(
      {
        instanceId,
        proxy: describeProxy(effectiveProxy, proxySource),
        reconnected: wasActive,
      },
      'Instance proxy replaced'
    );

    return this.getProxy(instanceId);
  }

  getAuthChallenge(instanceId: string, type: 'qr' | 'pairing_code'): string | null {
    const managed = this.instances.get(instanceId);
    if (!managed) throw new Error(`Instance ${instanceId} not found`);
    return type === 'qr' ? managed.qrCode || null : managed.pairingCode || null;
  }

  /**
   * Update instance state
   */
  private updateState(instanceId: string, updates: Partial<InstanceState>): void {
    const managed = this.instances.get(instanceId);
    if (managed) {
      managed.state = { ...managed.state, ...updates, lastActivity: new Date() };
    }
  }

  private cloneConfig(config: InstanceConfig): InstanceConfig {
    return {
      ...config,
      clientOptions: config.clientOptions
        ? { ...config.clientOptions }
        : undefined,
      webhookEvents: config.webhookEvents
        ? [...config.webhookEvents]
        : undefined,
    };
  }

  /** State as the API reports it: the proxy is computed on read, never cached. */
  private toPublicState(managed: ManagedInstance): InstanceState {
    return { ...managed.state, proxy: this.describeManagedProxy(managed) };
  }

  private describeManagedProxy(managed: ManagedInstance): EffectiveProxyInfo {
    return describeProxy(
      managed.effectiveProxy,
      managed.proxySource,
      managed.client.getProxyInfo(),
      managed.persisted
    );
  }

  /**
   * Mirror an instance to the store.
   *
   * Never throws: losing a write is worth a warning, not a failed request. The
   * record is merged, so keys written by `miaw-cli` that this API does not know
   * about survive.
   */
  private async persist(instanceId: string): Promise<void> {
    const store = this.options.store;
    const managed = this.instances.get(instanceId);
    if (!store || !managed) return;

    const clientOptions = { ...(managed.config.clientOptions || {}) };
    delete clientOptions.proxy;

    try {
      await store.upsert(instanceId, {
        proxy: managed.pin,
        webhookUrl: managed.state.webhookUrl,
        webhookEvents: managed.state.webhookEvents,
        clientOptions: Object.keys(clientOptions).length ? clientOptions : undefined,
      });
      managed.persisted = true;
    } catch (error) {
      this.logger.warn(
        { instanceId, error: error instanceof Error ? error.message : String(error) },
        'Could not persist the instance record'
      );
    }
  }

  /**
   * Remove only the stored proxy pin, keeping the rest of the record.
   *
   * Used when a caller asks for an in-memory-only change: leaving the old pin
   * behind would restore the wrong egress IP on the next boot.
   */
  private async forgetPin(instanceId: string): Promise<void> {
    const store = this.options.store;
    const managed = this.instances.get(instanceId);
    if (!store || !managed) return;

    try {
      await store.upsert(instanceId, { proxy: undefined });
    } catch (error) {
      this.logger.warn(
        { instanceId, error: error instanceof Error ? error.message : String(error) },
        'Could not drop the stored proxy pin'
      );
    }
    managed.persisted = false;
  }

  /**
   * Replace the underlying client outright.
   *
   * Only reachable when setProxy() refuses because the client owns a custom
   * agent. Kept as a fallback rather than deleted so that path stays correct if
   * this API ever passes one.
   */
  private rebuildClient(
    instanceId: string,
    managed: ManagedInstance,
    config: InstanceConfig,
    proxy?: ProxyInput
  ): void {
    const nextClient = this.createClient(config, proxy);
    managed.client.removeAllListeners();
    this.setupClientEvents(instanceId, nextClient);
    managed.client = nextClient;
  }

  /**
   * Resolve one instance's egress, highest precedence first:
   * explicit clientOptions.proxy, the stored pin (url or label), the pool, direct.
   *
   * This deliberately omits miaw-core's `MIAW_PROXY` step. Reading a global
   * environment proxy here would silently outrank every per-instance
   * assignment - see docs/SECURITY.md.
   */
  private resolveEffectiveProxy(
    config: InstanceConfig,
    pin?: InstanceProxyPin
  ): {
    proxy?: ProxyInput;
    source: ProxySource;
  } {
    const explicit = config.clientOptions?.proxy;
    if (explicit !== undefined) {
      if (!validateProxyConfig(explicit)) {
        throw new Error(`Invalid proxy configuration: ${maskProxyUrl(explicit)}`);
      }
      return { proxy: explicit, source: 'explicit' };
    }

    if (pin?.url) {
      if (!validateProxyConfig(pin.url)) {
        throw new Error(`Invalid proxy configuration: ${maskProxyUrl(pin.url)}`);
      }
      return { proxy: pin.url, source: 'explicit' };
    }

    if (pin?.label) {
      if (!this.options.proxyPool) {
        throw new Error(
          `Cannot resolve proxy label "${pin.label}": no proxy pool is configured. Set MIAW_PROXY_FILE.`
        );
      }
      // Throws when unresolvable, on purpose - falling back to a direct
      // connection would leak the egress IP the pin exists to hide.
      return {
        proxy: this.options.proxyPool.selectByLabel(pin.label, config.instanceId),
        source: 'pin-label',
      };
    }

    const pooled = this.options.proxyPool?.select(config.instanceId);
    return pooled
      ? { proxy: pooled, source: 'pool' }
      : { source: 'none' };
  }

  private createClient(config: InstanceConfig, proxy?: ProxyInput): MiawClient {
    const clientOptions: MiawClientOptions = {
      ...config.clientOptions,
      instanceId: config.instanceId,
      sessionPath: this.options.sessionPath,
      debug: config.clientOptions?.debug ?? false,
      ...(proxy !== undefined ? { proxy } : {}),
    };
    return new MiawClient(clientOptions);
  }

  private schedulePairingCodeRetry(instanceId: string, client: MiawClient, phoneNumber: string): void {
    const managed = this.instances.get(instanceId);
    if (!managed) return;

    managed.pairingRetryTimeout = setTimeout(() => {
      const current = this.instances.get(instanceId);
      if (!current || current.pairingCode) return;

      const socket = (client as unknown as {
        socket?: { requestPairingCode: (phone: string) => Promise<string> };
      }).socket;
      if (!socket) return;

      void socket.requestPairingCode(phoneNumber)
        .then((code) => {
          const active = this.instances.get(instanceId);
          if (!active || active.pairingCode) return;
          active.pairingCode = code;
          this.emitWebhook(instanceId, 'pairing_code', { code });
        })
        .catch((error: unknown) => {
          this.logger.warn({ instanceId, error }, 'Delayed pairing-code request failed');
        });
    }, 3000);
    managed.pairingRetryTimeout.unref();
  }

  /**
   * Set up MiawClient event handlers
   */
  private setupClientEvents(instanceId: string, client: MiawClient): void {
    // Connection state changes
    client.on('connection', (state: ConnectionState) => {
      this.logger.info({ instanceId, state }, 'Connection state changed');
      this.updateState(instanceId, { status: state });

      // Emit webhook event
      this.emitWebhook(instanceId, 'connection', { state });

      if (state === 'connected') {
        this.updateState(instanceId, { connectedAt: new Date() });
        void client.getOwnProfile().then((profile) => {
          if (profile?.phone) this.updateState(instanceId, { phoneNumber: profile.phone });
        }).catch((error: unknown) => {
          this.logger.debug({ instanceId, error }, 'Unable to read own profile after connect');
        });
      }
    });

    client.on('ready', () => {
      const managed = this.instances.get(instanceId);
      if (managed) {
        managed.qrCode = undefined;
        managed.pairingCode = undefined;
        if (managed.pairingRetryTimeout) clearTimeout(managed.pairingRetryTimeout);
      }
      this.emitWebhook(instanceId, 'ready', {
        instanceId,
        connectedAt: Date.now(),
      });
    });

    // QR code
    client.on('qr', (qr: string) => {
      this.logger.info({ instanceId }, 'QR code received');
      this.updateState(instanceId, { status: 'qr_required' });
      const managed = this.instances.get(instanceId);
      if (managed) managed.qrCode = qr;
      this.emitWebhook(instanceId, 'qr', { qr });
    });

    client.on('pairing_code', (code: string) => {
      const managed = this.instances.get(instanceId);
      if (managed) managed.pairingCode = code;
      this.emitWebhook(instanceId, 'pairing_code', { code });
    });

    // Reconnecting
    client.on('reconnecting', (attempt: number) => {
      this.logger.info({ instanceId, attempt }, 'Reconnecting');
      this.updateState(instanceId, { status: 'reconnecting' });
      this.emitWebhook(instanceId, 'reconnecting', { attempt });
    });

    // Disconnected
    client.on('disconnected', (reason?: string, statusCode?: number) => {
      this.logger.info({ instanceId, reason, statusCode }, 'Disconnected');
      this.updateState(instanceId, { status: 'disconnected' });
      this.emitWebhook(instanceId, 'disconnected', { reason, statusCode });
    });

    // Error
    client.on('error', (error: Error) => {
      this.logger.error({ instanceId, error: error.message }, 'Instance error');
      this.emitWebhook(instanceId, 'error', { error: error.message });
    });

    // Message received
    client.on('message', (message: any) => {
      this.logger.debug({ instanceId, messageId: message.id }, 'Message received');
      this.emitWebhook(instanceId, 'message', message);
    });

    // Message edited
    client.on('message_edit', (edit: any) => {
      this.logger.debug({ instanceId, messageId: edit.messageId }, 'Message edited');
      this.emitWebhook(instanceId, 'message_edit', edit);
    });

    // Message deleted
    client.on('message_delete', (deletion: any) => {
      this.logger.debug({ instanceId, messageId: deletion.messageId }, 'Message deleted');
      this.emitWebhook(instanceId, 'message_delete', deletion);
    });

    // Message reaction
    client.on('message_reaction', (reaction: any) => {
      this.logger.debug({ instanceId, messageId: reaction.messageId }, 'Message reaction');
      this.emitWebhook(instanceId, 'message_reaction', reaction);
    });

    client.on('message_receipt', (receipt) => {
      this.emitWebhook(instanceId, 'message_receipt', receipt);
    });

    client.on('poll_vote', (vote) => {
      this.emitWebhook(instanceId, 'poll_vote', vote);
    });

    // Presence update
    client.on('presence', (update: any) => {
      this.logger.debug({ instanceId, jid: update.jid }, 'Presence update');
      this.emitWebhook(instanceId, 'presence', update);
    });

    // Session saved
    client.on('session_saved', () => {
      this.logger.debug({ instanceId }, 'Session saved');
      this.emitWebhook(instanceId, 'session_saved', {});
    });
  }

  /**
   * Emit webhook event (actual delivery handled by WebhookDispatcher)
   */
  private emitWebhook(instanceId: string, event: WebhookEvent, data: any): void {
    const managed = this.instances.get(instanceId);
    if (!managed) return;

    // Check if webhook is enabled and event is subscribed
    if (!managed.state.webhookEnabled || !managed.state.webhookUrl) {
      return;
    }

    if (managed.state.webhookEvents.length > 0 && !managed.state.webhookEvents.includes(event)) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      instanceId,
      timestamp: Date.now(),
      data,
    };

    // Emit to be handled by WebhookDispatcher
    this.emit('webhook', managed.state.webhookUrl, payload);
  }

  /**
   * Cleanup all instances
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing InstanceManager');

    const disconnectPromises = Array.from(this.instances.values()).map(async (managed) => {
      if (managed.state.status === 'connected') {
        try {
          await managed.client.disconnect();
        } catch (err) {
          this.logger.error({ instanceId: managed.config.instanceId, err }, 'Error disconnecting');
        }
      }
      managed.client.removeAllListeners();
    });

    await Promise.all(disconnectPromises);
    this.instances.clear();
    this.removeAllListeners();
  }
}
