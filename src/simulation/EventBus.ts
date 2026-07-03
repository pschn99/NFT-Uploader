// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBus<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Array<(data: T[K]) => void> } = {};

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const handlers = this.listeners[event];
    if (handlers) {
      // Create a copy to prevent mutation bugs during execution
      const copy = [...handlers];
      copy.forEach((handler) => handler(data));
    }
  }

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  off<K extends keyof T>(event: K, handler: (data: T[K]) => void): void {
    const handlers = this.listeners[event];
    if (handlers) {
      this.listeners[event] = handlers.filter((h) => h !== handler);
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
