import { inject, Injectable } from '@angular/core';
import { NgDiagramSelectionService } from 'ng-diagram';
import { PropertiesSidebarService } from '../../properties-sidebar/properties-sidebar.service';
import { LayoutService } from '../layout/layout.service';
import { ExpandCollapseService } from '../model/expand-collapse.service';
import { ModelApplyService } from '../model/model-apply.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';
import { AddButtonService } from '../node/components/add-button/add-button.service';
import { isArrowKey, type ArrowKey } from './arrow-keys';
import { resolveDiagramFocus, type FocusedNode } from './diagram-focus-level';
import { KeyboardNavigationService } from './keyboard-navigation.service';
import { NodeFocusService } from './node-focus.service';

interface NodeKeyBinding {
  match(event: KeyboardEvent): boolean;
  run(event: KeyboardEvent, focus: FocusedNode): void | Promise<void>;
}

/**
 * Routes diagram keydown events to the appropriate action for the focused
 * node. Keeps DiagramComponent free of keyboard logic.
 *
 * - Tab / Shift+Tab: move focus between nodes in reporting order
 * - Shift + Arrow:   move focus between visible nodes (direction-based)
 * - Alt   + Arrow:   add a sibling/child relative to the focused node
 * - Ctrl/Cmd+Enter:  select the focused node and open the properties sidebar
 * - Enter:           select the focused node
 * - Escape:          clear the selection
 * - Space:           toggle the focused node's expand/collapse state
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

  private readonly nodeBindings: readonly NodeKeyBinding[] = [
    { match: (e) => e.key === 'Tab', run: (e, f) => this.moveFocus(e, f) },
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, f) => this.moveFocusInDirection(e, f),
    },
    { match: (e) => e.altKey && isArrowKey(e.key), run: (e, f) => this.addRelative(e, f) },
    {
      match: (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey),
      run: (e, f) => this.selectAndOpenSidebar(e, f),
    },
    { match: (e) => e.key === 'Enter', run: (e, f) => this.select(e, f) },
    { match: (e) => e.key === 'Escape', run: (e) => this.clearSelection(e) },
    { match: (e) => e.key === ' ', run: (e, f) => this.toggleExpand(e, f) },
  ];

  handle(event: KeyboardEvent): void {
    const focus = resolveDiagramFocus(event.target);
    if (focus.level === 'surface') return;
    const binding = this.nodeBindings.find((b) => b.match(event));
    if (binding) void binding.run(event, focus);
  }

  private moveFocus(event: KeyboardEvent, focus: FocusedNode): void {
    const targetId = this.navigation.getAdjacentNodeId(
      focus.nodeId,
      event.shiftKey ? -1 : 1,
      this.layoutService.isHorizontal(),
    );
    if (!targetId) return;
    event.preventDefault();
    this.nodeVisibility.ensureVisible(targetId);
    this.nodeFocus.focus(targetId);
  }

  private moveFocusInDirection(event: KeyboardEvent, focus: FocusedNode): void {
    event.preventDefault();
    event.stopPropagation();
    const targetId = this.navigation.getNextNodeId(
      focus.nodeId,
      event.key as ArrowKey,
      this.layoutService.isHorizontal(),
    );
    if (!targetId) return;
    this.nodeVisibility.ensureVisible(targetId);
    this.nodeFocus.focus(targetId);
  }

  private select(event: KeyboardEvent, focus: FocusedNode): void {
    event.preventDefault();
    this.selectionService.select([focus.nodeId]);
  }

  private selectAndOpenSidebar(event: KeyboardEvent, focus: FocusedNode): void {
    event.preventDefault();
    this.selectionService.select([focus.nodeId]);
    this.sidebar.expandSidebar(focus.host);
  }

  private clearSelection(event: KeyboardEvent): void {
    const { nodes, edges } = this.selectionService.selection();
    if (nodes.length === 0 && edges.length === 0) return;
    event.preventDefault();
    this.selectionService.deselectAll();
  }

  private async toggleExpand(event: KeyboardEvent, focus: FocusedNode): Promise<void> {
    event.preventDefault();
    const result = this.expandCollapse.prepareToggle(focus.nodeId);
    if (!result) return;
    await this.modelApply.applyWithLayout(result.changes, {
      visibility: { subtreeIds: result.toggledSubtreeIds, collapsing: result.collapsing },
    });
    this.nodeVisibility.ensureVisible(focus.nodeId);
  }

  private async addRelative(event: KeyboardEvent, focus: FocusedNode): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const action = this.navigation.getAddPositionForArrow(
      event.key as ArrowKey,
      this.layoutService.isHorizontal(),
    );
    if (!action) return;
    const newNodeId = await this.addButton.addNode(focus.nodeId, action);
    if (newNodeId != null) this.nodeFocus.focus(newNodeId);
  }
}
