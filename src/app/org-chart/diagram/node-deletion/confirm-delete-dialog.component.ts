import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ModalDialogComponent } from '../../shared/modal-dialog/modal-dialog.component';
import { NodeDeletionService } from './node-deletion.service';

/**
 * Put this component outside `<main>`. Its keydown handler takes the keys of the dialog.
 *
 * Cancel gets the focus, because the app has no working undo.
 */
@Component({
  selector: 'app-confirm-delete-dialog',
  imports: [ModalDialogComponent],
  templateUrl: './confirm-delete-dialog.component.html',
  styleUrl: './confirm-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
})
export class ConfirmDeleteDialogComponent {
  protected readonly deletion = inject(NodeDeletionService);
  protected readonly confirmation = computed(() => this.deletion.pending()?.confirmation ?? null);
}
