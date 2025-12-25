/**
 * Webhook Dispatcher Service
 * Handles delivery of webhook events with retry mechanism
 */

import pino from 'pino';
import crypto from 'crypto';

interface WebhookDispatcherOptions {
  secret: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface WebhookDelivery {
  url: string;
  payload: any;
  attempt: number;
  nextRetryTime?: number;
}

/**
 * Manages webhook delivery with retry mechanism
 */
export class WebhookDispatcher {
  private options: WebhookDispatcherOptions;
  private logger: pino.Logger;
  private deliveryQueue: Map<string, WebhookDelivery>;
  private processingInterval?: NodeJS.Timeout;

  constructor(options: WebhookDispatcherOptions) {
    this.options = options;
    this.logger = pino({ level: 'info' });
    this.deliveryQueue = new Map();
    this.startProcessing();
  }

  /**
   * Queue webhook for delivery
   */
  async queue(url: string, payload: any): Promise<void> {
    const deliveryId = this.generateDeliveryId(payload);

    this.deliveryQueue.set(deliveryId, {
      url,
      payload,
      attempt: 0,
    });

    this.logger.debug(
      { deliveryId, url, event: payload.event },
      'Webhook queued'
    );
  }

  /**
   * Process queued webhooks
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Check every second
  }

  /**
   * Process delivery queue
   */
  private async processQueue(): Promise<void> {
    const now = Date.now();

    for (const [deliveryId, delivery] of this.deliveryQueue.entries()) {
      // Check if it's time to retry
      if (delivery.nextRetryTime && delivery.nextRetryTime > now) {
        continue;
      }

      // Attempt delivery
      const success = await this.deliver(delivery);

      if (success) {
        this.deliveryQueue.delete(deliveryId);
      } else if (delivery.attempt >= this.options.maxRetries) {
        // Max retries reached, give up
        this.logger.warn(
          { deliveryId, attempt: delivery.attempt },
          'Webhook delivery failed, max retries reached'
        );
        this.deliveryQueue.delete(deliveryId);
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(delivery.attempt);
        delivery.nextRetryTime = Date.now() + retryDelay;
        this.deliveryQueue.set(deliveryId, delivery);
      }
    }
  }

  /**
   * Deliver webhook to URL
   */
  private async deliver(delivery: WebhookDelivery): Promise<boolean> {
    delivery.attempt++;

    this.logger.debug(
      {
        deliveryId: this.generateDeliveryId(delivery.payload),
        attempt: delivery.attempt,
        url: delivery.url,
      },
      'Delivering webhook'
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const signature = this.generateSignature(delivery.payload);

      const response = await fetch(delivery.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'User-Agent': 'Miaw-Webhook/1.0',
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        this.logger.info(
          {
            deliveryId: this.generateDeliveryId(delivery.payload),
            attempt: delivery.attempt,
            status: response.status,
          },
          'Webhook delivered successfully'
        );
        return true;
      }

      this.logger.warn(
        {
          deliveryId: this.generateDeliveryId(delivery.payload),
          attempt: delivery.attempt,
          status: response.status,
        },
        'Webhook delivery failed with non-OK status'
      );
      return false;
    } catch (err: any) {
      this.logger.warn(
        {
          deliveryId: this.generateDeliveryId(delivery.payload),
          attempt: delivery.attempt,
          error: err.message,
        },
        'Webhook delivery failed'
      );
      return false;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delays = [0, 60000, 300000, 900000, 3600000]; // 0, 1min, 5min, 15min, 1hour
    return delays[Math.min(attempt, delays.length - 1)];
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: any): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.options.secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(payload: any): string {
    return `${payload.event}-${payload.instanceId}-${payload.timestamp}`;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.deliveryQueue.size;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.deliveryQueue.clear();
  }
}
