import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MODAL_FOCUS_RESTORE } from './modal-focus-restore';

let nextId = 0;

/**
 * `showModal()` gives the dialog role, the modal semantics and a focus trap. Do not add these
 * again.
 *
 * The parent component must react to `closed`. If it does not react, its `open` value and the
 * state of the dialog become different after the first Escape key or backdrop click.
 *
 * Do not put the content in an `@if` block. A closed `<dialog>` has `display: none` from the
 * browser stylesheet, and it is not in the accessibility tree.
 *
 * The listener for `close` is on the `<dialog>` element, because that event does not go up the
 * DOM tree.
 */
@Component({
  selector: 'app-modal-dialog',
  templateUrl: './modal-dialog.component.html',
  styleUrl: './modal-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    style: 'display: contents',
    '(keydown)': 'onKeydown($event)',
    '(click)': 'onBackdropClick($event)',
  },
})
export class ModalDialogComponent {
  private readonly document = inject(DOCUMENT);
  private readonly focusRestore = inject(MODAL_FOCUS_RESTORE, { optional: true });
  private readonly uid = nextId++;

  readonly open = input.required<boolean>();
  readonly heading = input.required<string>();
  readonly describedBy = input<string | null>(null);
  /**
   * The element that gets the focus when the dialog closes. The default is the element that has
   * the focus when the dialog opens.
   *
   * Always give the trigger element, because Safari does not put the focus on a `<button>` after
   * a click.
   */
  readonly opener = input<HTMLElement | null>(null);
  readonly closed = output<void>();

  private readonly dialogEl = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');
  private readonly headingEl = viewChild.required<ElementRef<HTMLElement>>('headingEl');

  protected readonly headingId = `modal-dialog-${this.uid}-heading`;

  private restoreTarget: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const el = this.dialogEl().nativeElement;
      if (this.open()) {
        if (el.open) return;
        const captured =
          untracked(this.opener) ?? (this.document.activeElement as HTMLElement | null);
        this.restoreTarget = this.focusRestore?.normalize(captured) ?? captured;
        el.showModal();
        this.headingEl().nativeElement.focus({ preventScroll: true });
      } else if (el.open) {
        el.close();
      }
    });
  }

  protected onClose(): void {
    const target = this.restoreTarget;
    this.restoreTarget = null;
    if (target?.isConnected) {
      target.focus({ preventScroll: true });
    } else {
      this.focusRestore?.recover();
    }
    this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') event.stopPropagation();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogEl().nativeElement && event.detail !== 0) {
      this.dialogEl().nativeElement.close();
    }
  }
}
