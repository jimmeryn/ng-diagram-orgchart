import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  NgDiagramModelService,
  NgDiagramPortComponent,
  NgDiagramSelectionService,
  NgDiagramViewportService,
  type NgDiagramNodeTemplate,
  type Node,
} from 'ng-diagram';
import { DragReorderService } from '../../drag-reorder/drag-reorder.service';
import { ORG_CHART_CONFIG } from '../../org-chart.config';
import { NodeFocusService } from '../keyboard-navigation/node-focus.service';
import { LayoutService } from '../layout/layout.service';
import { getHasChildren, getIsCollapsed, getIsHidden } from '../model/data-getters';
import { isOccupiedNodeData, isOrgChartNode, isVacantNode } from '../model/guards';
import { getColorForRole, type OrgChartNodeData } from '../model/interfaces';
import { AddButtonComponent } from './components/add-button/add-button.component';
import { CompactNodeComponent } from './components/compact-node/compact-node.component';
import { DropIndicatorComponent } from './components/drop-indicator/drop-indicator.component';
import { FullNodeComponent } from './components/full-node/full-node.component';
import { ToggleExpandButtonComponent } from './components/toggle-expand-button/toggle-expand-button.component';
import { VacantNodeComponent } from './components/vacant-node/vacant-node.component';

type NodeVariant = 'vacant' | 'compact' | 'full';

/**
 * Custom org-chart node template.
 *
 * Renders one of three visual variants depending on vacancy and zoom level:
 * - **vacant** – no `fullName` set; shows a placeholder card.
 * - **compact** – zoom < 100%; header only, no stats/capacity.
 * - **full** – zoom >= 100%; complete card with stats and capacity bar.
 *
 * Delegates expand/collapse, drag indicators, and add-node buttons to child components.
 */
@Component({
  imports: [
    NgDiagramPortComponent,
    VacantNodeComponent,
    CompactNodeComponent,
    FullNodeComponent,
    ToggleExpandButtonComponent,
    DropIndicatorComponent,
    AddButtonComponent,
  ],
  templateUrl: './node.component.html',
  styleUrls: ['./node.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ng-diagram-port-hoverable-over-node]': 'true',
    '[class.variant-vacant]': 'variant() === "vacant"',
    '[class.selected]': 'node().selected',
    '[class.is-hidden]': 'isHidden()',
    '[style.visibility]': 'isHidden() ? "hidden" : null',
    '[style.pointer-events]': 'isHidden() ? "none" : null',
    '[attr.role]': '"treeitem"',
    '[attr.tabindex]': 'isFocusable() ? 0 : -1',
    '[attr.aria-selected]': 'node().selected',
    '[attr.aria-expanded]': 'ariaExpanded()',
    '[attr.aria-label]': 'ariaLabel()',
    '(mouseenter)': 'isNodeHovered.set(true)',
    '(mouseleave)': 'isNodeHovered.set(false)',
    '(focus)': 'onHostFocus()',
  },
})
export class NodeComponent implements NgDiagramNodeTemplate<OrgChartNodeData> {
  private readonly config = inject(ORG_CHART_CONFIG);
  private readonly layoutService = inject(LayoutService);
  private readonly viewportService = inject(NgDiagramViewportService);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly dragReorderService = inject(DragReorderService);
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly nodeFocusService = inject(NodeFocusService);
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      if (this.nodeFocusService.current()?.id === this.node().id) {
        this.host.nativeElement.focus();
      }
    });
  }

  node = input.required<Node<OrgChartNodeData>>();

  protected isNodeHovered = signal(false);

  protected isHorizontal = this.layoutService.isHorizontal;

  protected nodeId = computed(() => this.node().id);
  protected isHidden = computed(() => getIsHidden(this.node()));
  protected variant = computed<NodeVariant>(() => {
    if (isVacantNode(this.node())) return 'vacant';
    return this.viewportService.scale() < this.config.viewport.compactScaleThreshold
      ? 'compact'
      : 'full';
  });
  protected color = computed(() => getColorForRole(this.node().data.role));
  protected occupiedData = computed(() => {
    const data = this.node().data;
    if (!isOccupiedNodeData(data)) {
      return undefined;
    }
    return data;
  });

  protected hasChildren = computed(() => !!getHasChildren(this.node()));
  protected isInDropRange = computed(
    () =>
      this.dragReorderService.isReorderActive() &&
      this.dragReorderService.isNodeInDropRange(this.nodeId()),
  );

  protected isRoot = computed(() => {
    // Update computed each time edge changes
    this.modelService.edges();
    const id = this.nodeId();
    const connectedEdges = this.modelService.getConnectedEdges(id);
    return !connectedEdges.some((e) => e.target === id);
  });
  protected showAddButtons = computed(
    () => this.isNodeHovered() && !this.dragReorderService.isReorderActive(),
  );

  protected readonly isFocusable = computed(() => {
    if (this.node().selected) return true;
    const orgSelectedNodes = this.selectionService.selection().nodes.filter(isOrgChartNode);
    return orgSelectedNodes.length === 0 && this.isRoot();
  });

  protected readonly ariaExpanded = computed<boolean | null>(() => {
    if (!this.hasChildren()) return null;
    return !getIsCollapsed(this.node());
  });

  protected onHostFocus(): void {
    if (!this.node().selected) {
      this.selectionService.select([this.node().id]);
    }
  }

  protected readonly ariaLabel = computed(() => {
    const node = this.node();
    const data = node.data;
    if (data.type === 'vacant') {
      return data.role ? `Vacant position, ${data.role}` : 'Vacant position';
    }
    const parts: string[] = [data.fullName];
    if (data.role) parts.push(data.role);
    if (data.reports > 0) {
      parts.push(`${data.reports} ${data.reports === 1 ? 'report' : 'reports'}`);
    }
    return parts.join(', ');
  });
}
