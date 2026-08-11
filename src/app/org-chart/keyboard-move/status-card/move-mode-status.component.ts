import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MoveModeService } from '../move-mode.service';

/**
 * States the move in words, on screen.
 *
 * Deliberately no `role` and no `aria-live`: this template is the seam a later announcer slice
 * hooks into, and adding either here would make that slice a rewrite instead of an addition.
 */
@Component({
  selector: 'app-move-mode-status',
  templateUrl: './move-mode-status.component.html',
  styleUrl: './move-mode-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveModeStatusComponent {
  private readonly moveMode = inject(MoveModeService);

  protected readonly message = this.moveMode.message;
  protected readonly isActive = this.moveMode.isActive;
  protected readonly isPickingSide = this.moveMode.isPickingSide;
}
