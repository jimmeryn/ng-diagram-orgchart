import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { DropZone } from '../../../../drag-reorder/zone-detection/index';
import { PropertiesSidebarService } from '../../../../properties-sidebar/properties-sidebar.service';
import { LayoutGate } from '../../../layout/layout-gate';
import { LayoutService } from '../../../layout/layout.service';
import type { AddNodeAction } from '../../../model/add-node.service';
import { AddButtonPositionDirective } from './add-button-position.directive';
import { AddButtonService } from './add-button.service';

const ACTION_MAP: Record<DropZone, AddNodeAction> = {
  left: 'siblingBefore',
  right: 'siblingAfter',
  bottom: 'child',
};

const ARIA_LABEL_MAP: Record<DropZone, string> = {
  left: 'Add sibling before',
  right: 'Add sibling after',
  bottom: 'Add child node',
};

@Component({
  selector: 'app-add-button',
  templateUrl: './add-button.component.html',
  styleUrls: ['./add-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddButtonPositionDirective],
  host: {
    style: 'display: contents',
    '[class.layout-horizontal]': 'isHorizontal()',
  },
})
export class AddButtonComponent {
  private readonly addButtonService = inject(AddButtonService);
  private readonly sidebarService = inject(PropertiesSidebarService);
  private readonly layoutGate = inject(LayoutGate);
  private readonly layoutService = inject(LayoutService);

  nodeId = input.required<string>();
  position = input.required<DropZone>();

  protected isHorizontal = this.layoutService.isHorizontal;
  protected isDisabled = computed(() => !this.layoutGate.isIdle());
  protected ariaLabel = computed(() => ARIA_LABEL_MAP[this.position()]);

  async onAdd(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const newNodeId = await this.addButtonService.addNode(
      this.nodeId(),
      ACTION_MAP[this.position()],
    );
    if (newNodeId != null) this.sidebarService.expandSidebar();
  }
}
