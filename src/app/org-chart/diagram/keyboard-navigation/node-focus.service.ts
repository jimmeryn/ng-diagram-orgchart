import { Injectable, signal } from '@angular/core';

/**
 * Coordinates programmatic focus for org-chart node hosts.
 *
 * Callers publish a focus request by node id; the matching `NodeComponent`
 * reacts via an effect and calls `focus()` on its host element. A monotonic
 * nonce is included so that repeated requests for the same id re-fire the
 * effect (signals only emit on value change).
 */
@Injectable()
export class NodeFocusService {
  private readonly request = signal<{ id: string; nonce: number } | null>(null);
  private counter = 0;
  readonly current = this.request.asReadonly();

  focus(id: string): void {
    this.request.set({ id, nonce: ++this.counter });
  }
}
