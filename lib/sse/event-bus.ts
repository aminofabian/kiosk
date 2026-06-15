/**
 * In-memory event bus for Server-Sent Events (SSE).
 *
 * Subscribers register for channels and receive events published to those channels.
 * Channels follow the pattern: `scope:id`
 *
 * Examples:
 *   `business:abc123`  — all events for a business
 *   `staff:user-1`     — events intended for a specific department staff user
 *   `cashier:user-2`   — events intended for a specific cashier
 *   `queue:abc123`     — queue count changes for a business
 */

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

type Subscriber = (event: SSEEvent) => void;

class EventBus {
  private subscribers = new Map<string, Set<Subscriber>>();

  /** Subscribe to a channel. Returns an unsubscribe function. */
  subscribe(channel: string, fn: Subscriber): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(fn);

    return () => this.unsubscribe(channel, fn);
  }

  /** Unsubscribe from a channel. */
  unsubscribe(channel: string, fn: Subscriber): void {
    const set = this.subscribers.get(channel);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) {
      this.subscribers.delete(channel);
    }
  }

  /** Publish an event to all subscribers of a channel. */
  publish(channel: string, event: SSEEvent): void {
    const set = this.subscribers.get(channel);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        // Don't let one broken subscriber break the others
      }
    }
  }

  /** Publish to multiple channels at once. */
  publishMany(channels: string[], event: SSEEvent): void {
    for (const channel of channels) {
      this.publish(channel, event);
    }
  }

  /** Get subscriber count for a channel (for debugging). */
  subscriberCount(channel: string): number {
    return this.subscribers.get(channel)?.size ?? 0;
  }

  /** Get total subscribers across all channels. */
  totalSubscribers(): number {
    let count = 0;
    for (const set of this.subscribers.values()) {
      count += set.size;
    }
    return count;
  }
}

/** Singleton event bus instance. */
export const eventBus = new EventBus();
