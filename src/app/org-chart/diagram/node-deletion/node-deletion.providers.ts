import { type Provider } from '@angular/core';
import { DeleteConfirmationFactory } from './delete-confirmation.factory';
import { NodeDeletionFocusService } from './node-deletion-focus.service';
import { NodeDeletionService } from './node-deletion.service';

/** Add these providers at one location only. All the callers must use one instance. */
export function provideNodeDeletion(): Provider[] {
  return [DeleteConfirmationFactory, NodeDeletionFocusService, NodeDeletionService];
}
