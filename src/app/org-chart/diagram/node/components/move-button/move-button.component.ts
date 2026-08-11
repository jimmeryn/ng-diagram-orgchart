import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MoveModeService } from '../../../../keyboard-move';

@Component({
  selector: 'app-move-button',
  templateUrl: './move-button.component.html',
  styleUrl: './move-button.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveButtonComponent {
  private readonly moveMode = inject(MoveModeService);

  nodeId = input.required<string>();

  /**
   * Stopping the press keeps the library from selecting the node as well, which would open the
   * properties panel over the mode that is starting.
   */
  protected onMove(event: MouseEvent): void {
    event.stopPropagation();
    this.moveMode.begin(this.nodeId());
  }
}
