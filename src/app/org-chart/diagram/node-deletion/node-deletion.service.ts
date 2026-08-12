import { computed, inject, Injectable, signal } from '@angular/core';
import { NodeMutationService } from '../../properties-sidebar/node-mutation.service';
import { LayoutGate } from '../layout/layout-gate';
import { type DeleteConfirmation } from './delete-confirmation';
import { DeleteConfirmationFactory } from './delete-confirmation.factory';
import { NodeDeletionFocusService } from './node-deletion-focus.service';

export interface DeleteRequest {
  readonly nodeId: string;
  readonly confirmation: DeleteConfirmation;
  readonly cancelFocusTarget: HTMLElement | null;
}

type DeletionPhase = 'idle' | 'confirming' | 'resolving';

/** The one path that deletes a node from inside the app. */
@Injectable()
export class NodeDeletionService {
  private readonly layoutGate = inject(LayoutGate);
  private readonly nodeMutationService = inject(NodeMutationService);
  private readonly confirmations = inject(DeleteConfirmationFactory);
  private readonly focusService = inject(NodeDeletionFocusService);

  private readonly phase = signal<DeletionPhase>('idle');
  private readonly request = signal<DeleteRequest | null>(null);
  private readonly returnFocus = signal<HTMLElement | null>(null);

  readonly pending = this.request.asReadonly();
  readonly returnFocusTarget = this.returnFocus.asReadonly();
  readonly isOpen = computed(() => this.phase() === 'confirming');
  readonly isActivated = computed(() => this.phase() === 'resolving');

  /** @param cancelFocusTarget A node host. An action button leaves the DOM while the dialog is open. */
  requestDelete(nodeId: string, cancelFocusTarget: HTMLElement | null): void {
    if (this.phase() !== 'idle') return;
    if (!this.layoutGate.isIdle()) return;

    const confirmation = this.confirmations.create(nodeId);
    if (!confirmation) return;

    this.request.set({ nodeId, confirmation, cancelFocusTarget });
    this.returnFocus.set(null);
    this.phase.set('confirming');
  }

  /**
   * Leaving `confirming` first is a latch. The dialog closes on a later render, so its buttons
   * stay usable and a second click gets here.
   *
   * The layout gate is not tested again. It was idle at open time and `showModal()` makes the
   * page inert, so a second test can only drop a confirmed deletion.
   */
  async confirm(): Promise<void> {
    if (this.phase() !== 'confirming') return;
    const pending = this.request();
    if (!pending) return;
    this.phase.set('resolving');

    this.returnFocus.set(this.focusService.diagramSurface);
    const successorId = this.focusService.resolveSuccessor(pending.nodeId);

    try {
      await this.nodeMutationService.removeNode(pending.nodeId);
      this.focusService.focusSuccessor(successorId);
    } finally {
      this.request.set(null);
      this.phase.set('idle');
    }
  }

  /** The dialog reports every close. `confirm` has already left `confirming`, so it stops here. */
  cancel(): void {
    if (this.phase() !== 'confirming') return;
    this.returnFocus.set(this.request()?.cancelFocusTarget ?? null);
    this.request.set(null);
    this.phase.set('idle');
  }
}
