import { inject, Injectable } from '@angular/core';
import { NgDiagramSelectionService } from 'ng-diagram';
import { PropertiesSidebarService } from '../../properties-sidebar/properties-sidebar.service';
import { LayoutService } from '../layout/layout.service';
import { ExpandCollapseService } from '../model/expand-collapse.service';
import { isOrgChartNode } from '../model/guards';
import { ModelApplyService } from '../model/model-apply.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';
import { AddButtonService } from '../node/components/add-button/add-button.service';
import { isArrowKey, type ArrowKey } from './arrow-keys';
import { KeyboardNavigationService } from './keyboard-navigation.service';
import { NodeFocusService } from './node-focus.service';

interface KeyBinding {
  match(event: KeyboardEvent): boolean;
  run(event: KeyboardEvent, nodeId: string): void | Promise<void>;
}

/**
 * Routes diagram keydown events to the appropriate action when a single
 * org-chart node is selected. Keeps DiagramComponent free of keyboard logic.
 *
 * Shortcuts:
 * - Shift + Arrow: move selection between visible nodes
 * - Alt   + Arrow: add a sibling/child relative to the focused node
 * - Enter:         open the properties sidebar
 * - Space:         toggle the focused node's expand/collapse state
 */
@Injectable()
export class DiagramKeyboardController {
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly layoutService = inject(LayoutService);
  private readonly navigation = inject(KeyboardNavigationService);
  private readonly nodeVisibility = inject(NodeVisibilityService);
  private readonly nodeFocus = inject(NodeFocusService);
  private readonly sidebar = inject(PropertiesSidebarService);
  private readonly expandCollapse = inject(ExpandCollapseService);
  private readonly modelApply = inject(ModelApplyService);
  private readonly addButton = inject(AddButtonService);

  private readonly bindings: readonly KeyBinding[] = [
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, id) => this.moveSelection(e, id),
    },
    {
      match: (e) => e.altKey && isArrowKey(e.key),
      run: (e, id) => this.addRelative(e, id),
    },
    {
      match: (e) => e.key === 'Enter',
      run: (e) => this.openSidebar(e),
    },
    {
      match: (e) => e.key === ' ',
      run: (e, id) => this.toggleExpand(e, id),
    },
  ];

  handle(event: KeyboardEvent): void {
    const id = this.singleSelectedOrgNodeId();
    if (!id) return;
    const binding = this.bindings.find((b) => b.match(event));
    if (binding) void binding.run(event, id);
  }

  private singleSelectedOrgNodeId(): string | null {
    const nodes = this.selectionService.selection().nodes.filter(isOrgChartNode);
    return nodes.length === 1 ? (nodes.at(0)?.id ?? null) : null;
  }

  private moveSelection(event: KeyboardEvent, currentId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const targetId = this.navigation.getNextNodeId(
      currentId,
      event.key as ArrowKey,
      this.layoutService.isHorizontal(),
    );
    if (!targetId) return;
    this.selectionService.select([targetId]);
    this.nodeVisibility.ensureVisible(targetId);
    this.nodeFocus.focus(targetId);
  }

  private openSidebar(event: KeyboardEvent): void {
    event.preventDefault();
    const opener = event.target instanceof HTMLElement ? event.target : null;
    this.sidebar.expandSidebar(opener);
  }

  private async toggleExpand(event: KeyboardEvent, nodeId: string): Promise<void> {
    event.preventDefault();
    const result = this.expandCollapse.prepareToggle(nodeId);
    if (!result) return;
    await this.modelApply.applyWithLayout(result.changes, {
      visibility: { subtreeIds: result.toggledSubtreeIds, collapsing: result.collapsing },
    });
    this.nodeVisibility.ensureVisible(nodeId);
  }

  private async addRelative(event: KeyboardEvent, nodeId: string): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const action = this.navigation.getAddPositionForArrow(
      event.key as ArrowKey,
      this.layoutService.isHorizontal(),
    );
    if (action) await this.addButton.addNode(nodeId, action);
  }
}
