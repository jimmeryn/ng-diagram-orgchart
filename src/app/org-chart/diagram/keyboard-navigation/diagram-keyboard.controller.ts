import { inject, Injectable } from '@angular/core';
import { NgDiagramSelectionService } from 'ng-diagram';
import { PropertiesSidebarService } from '../../properties-sidebar/properties-sidebar.service';
import { LayoutService } from '../layout/layout.service';
import { ExpandCollapseService } from '../model/expand-collapse.service';
import { ModelApplyService } from '../model/model-apply.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';
import { isArrowKey, type ArrowKey } from './arrow-keys';
import {
  resolveDiagramFocus,
  type FocusedNode,
  type FocusedNodeAction,
  type NodeFocusContext,
} from './diagram-focus-level';
import { KeyboardNavigationService } from './keyboard-navigation.service';
import { getNodeActions } from './node-actions';
import { NodeFocusService } from './node-focus.service';

interface KeyBinding<TFocus> {
  match(event: KeyboardEvent): boolean;
  run(event: KeyboardEvent, focus: TFocus): void | Promise<void>;
}

/**
 * Routes diagram keydown events to the appropriate action for the focused
 * node or node action button. Keeps DiagramComponent free of keyboard logic.
 *
 * Node level:
 * - Tab / Shift+Tab: move focus between nodes in reporting order
 * - Shift + Arrow:   move focus between visible nodes (direction-based)
 * - Ctrl/Cmd+Enter:  select the focused node and open the properties sidebar
 * - Enter:           select the focused node and move focus to its first action button
 * - Escape:          clear the selection
 * - Space:           toggle the focused node's expand/collapse state
 *
 * Node action level:
 * - Tab / Shift+Tab: move focus between the node's own action buttons
 * - Shift + Arrow:   move focus between visible nodes (direction-based)
 * - Arrow (bare):    blocked, so the library doesn't move the selected node
 * - Ctrl/Cmd+Enter:  select the node and open the properties sidebar
 * - Escape:          move focus back to the node host
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

  private readonly nodeBindings: readonly KeyBinding<FocusedNode>[] = [
    { match: (e) => e.key === 'Tab', run: (e, f) => this.moveFocus(e, f.nodeId) },
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, f) => this.moveFocusInDirection(e, f),
    },
    {
      match: (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey),
      run: (e, f) => this.selectAndOpenSidebar(e, f),
    },
    { match: (e) => e.key === 'Enter', run: (e, f) => this.selectAndDescend(e, f) },
    { match: (e) => e.key === 'Escape', run: (e) => this.clearSelection(e) },
    { match: (e) => e.key === ' ', run: (e, f) => this.toggleExpand(e, f) },
  ];

  private readonly nodeActionBindings: readonly KeyBinding<FocusedNodeAction>[] = [
    { match: (e) => e.key === 'Tab', run: (e, f) => this.moveFocusWithinActions(e, f) },
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, f) => this.moveFocusInDirection(e, f),
    },
    { match: (e) => isArrowKey(e.key), run: (e) => this.blockCanvasArrows(e) },
    {
      match: (e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey),
      run: (e, f) => this.selectAndOpenSidebar(e, f),
    },
    { match: (e) => e.key === 'Escape', run: (e, f) => this.ascendToNode(e, f) },
  ];

  handle(event: KeyboardEvent): void {
    const focus = resolveDiagramFocus(event.target);
    switch (focus.level) {
      case 'node':
        this.run(this.nodeBindings, event, focus);
        break;
      case 'nodeAction':
        this.run(this.nodeActionBindings, event, focus);
        break;
    }
  }

  private run<TFocus>(
    bindings: readonly KeyBinding<TFocus>[],
    event: KeyboardEvent,
    focus: TFocus,
  ): void {
    const binding = bindings.find((b) => b.match(event));
    if (binding) void binding.run(event, focus);
  }

  private moveFocus(event: KeyboardEvent, nodeId: string): void {
    const targetId = this.navigation.getAdjacentNodeId(
      nodeId,
      event.shiftKey ? -1 : 1,
      this.layoutService.isHorizontal(),
    );
    if (!targetId) return;
    event.preventDefault();
    this.nodeVisibility.ensureVisible(targetId);
    this.nodeFocus.focus(targetId);
  }

  private moveFocusInDirection(event: KeyboardEvent, focus: NodeFocusContext): void {
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

  private selectAndDescend(event: KeyboardEvent, focus: FocusedNode): void {
    event.preventDefault();
    this.selectionService.select([focus.nodeId]);
    this.nodeFocus.focusFirstAction(focus.nodeId);
  }

  private selectAndOpenSidebar(event: KeyboardEvent, focus: NodeFocusContext): void {
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

  private moveFocusWithinActions(event: KeyboardEvent, focus: FocusedNodeAction): void {
    const actions = getNodeActions(focus.host);
    if (actions.length === 0) return;
    event.preventDefault();
    const step = event.shiftKey ? -1 : 1;
    const index = actions.indexOf(focus.action);
    const nextIndex = (index + step + actions.length) % actions.length;
    actions[nextIndex].focus({ preventScroll: true });
  }

  private ascendToNode(event: KeyboardEvent, focus: FocusedNodeAction): void {
    event.preventDefault();
    focus.host.focus({ preventScroll: true });
  }

  private blockCanvasArrows(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
