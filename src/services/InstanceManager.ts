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
import type { ProxyConfig } from 'miaw-core';
import { pino } from 'pino';
import {
  InstanceConfig,
  InstanceState,
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

interface InstanceManagerOptions {
  sessionPath: string;
  webhookSecret: string;
  webhookTimeout: number;
  webhookMaxRetries: number;
  webhookRetryDelay: number;
  proxyPool?: ProxyPoolService;
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
    const { proxy: effectiveProxy, source: proxySource } =
      this.resolveEffectiveProxy(storedConfig);
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
    };

    this.instances.set(instanceId, managed);

    // miaw-core 1.9.1 requests a pairing code immediately after constructing
    // its socket. Baileys rejects that pre-handshake request; retry once after
    // the transport is ready so headless pairing remains usable.
    if (storedConfig.clientOptions?.usePairingCode && storedConfig.clientOptions.phoneNumber) {
      this.schedulePairingCodeRetry(instanceId, client, storedConfig.clientOptions.phoneNumber);
    }

    this.logger.info({ instanceId }, 'Instance created');

    return state;
  }

  /**
   * Get instance state
   */
  getInstance(instanceId: string): InstanceState | null {
    const managed = this.instances.get(instanceId);
    return managed ? managed.state : null;
  }

  /**
   * List all instances
   */
  listInstances(): InstanceState[] {
    return Array.from(this.instances.values()).map((m) => m.state);
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
    this.logger.info({ instanceId }, 'Webhook updated');

    return managed.state;
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
    return describeProxy(managed.effectiveProxy, managed.proxySource);
  }

  replaceProxy(instanceId: string, proxy?: ProxyConfig | string): EffectiveProxyInfo {
    const managed = this.instances.get(instanceId);
    if (!managed) throw new Error(`Instance ${instanceId} not found`);
    if (managed.state.status !== 'disconnected') {
      throw new Error('Instance must be disconnected before changing its proxy');
    }
    if (proxy !== undefined && !validateProxyConfig(proxy)) {
      throw new Error(`Invalid proxy configuration: ${maskProxyUrl(proxy)}`);
    }

    const nextClientOptions = { ...(managed.config.clientOptions || {}) };
    if (proxy === undefined) {
      delete nextClientOptions.proxy;
    } else {
      nextClientOptions.proxy = proxy;
    }

    const nextConfig: InstanceConfig = {
      ...managed.config,
      clientOptions: nextClientOptions,
    };
    const { proxy: effectiveProxy, source: proxySource } =
      this.resolveEffectiveProxy(nextConfig);
    const nextClient = this.createClient(nextConfig, effectiveProxy);
    this.setupClientEvents(instanceId, nextClient);

    if (managed.pairingRetryTimeout) clearTimeout(managed.pairingRetryTimeout);
    managed.client.removeAllListeners();
    managed.client = nextClient;
    managed.config = nextConfig;
    managed.effectiveProxy = effectiveProxy;
    managed.proxySource = proxySource;
    managed.qrCode = undefined;
    managed.pairingCode = undefined;
    managed.pairingRetryTimeout = undefined;

    if (nextConfig.clientOptions?.usePairingCode && nextConfig.clientOptions.phoneNumber) {
      this.schedulePairingCodeRetry(
        instanceId,
        nextClient,
        nextConfig.clientOptions.phoneNumber
      );
    }

    this.logger.info(
      { instanceId, proxy: describeProxy(effectiveProxy, proxySource) },
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

  private resolveEffectiveProxy(config: InstanceConfig): {
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
