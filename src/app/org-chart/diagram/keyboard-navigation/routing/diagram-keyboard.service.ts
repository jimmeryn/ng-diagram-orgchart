import { inject, Injectable } from '@angular/core';
import { NgDiagramSelectionService } from 'ng-diagram';
import { MoveModeService } from '../../../keyboard-move';
import { PropertiesSidebarService } from '../../../properties-sidebar/properties-sidebar.service';
import { LayoutService } from '../../layout/layout.service';
import { ExpandCollapseService } from '../../model/expand-collapse.service';
import { ModelApplyService } from '../../model/model-apply.service';
import { NodeDeletionService } from '../../node-deletion/node-deletion.service';
import { NodeVisibilityService } from '../../node-visibility/node-visibility.service';
import { isArrowKey, type ArrowKey } from '../order/arrow-keys';
import {
  resolveDiagramFocus,
  type FocusedNode,
  type FocusedNodeAction,
  type NodeFocusContext,
} from '../focus/diagram-focus-level';
import { type KeyBinding } from './key-bindings.interface';
import {
  isDeleteKey,
  isModelMutatingShortcut,
  isModifierEnter,
  swallow,
  swallowFromLibrary,
} from './key-events';
import { NavigationOrderService } from '../order/navigation-order.service';
import { getNodeActions } from '../focus/node-actions';
import { NodeFocusService } from '../focus/node-focus.service';

/**
 * Routes diagram keydown events to the action for whatever holds the focus. Keeps
 * `DiagramComponent` free of keyboard logic.
 *
 * One binding table per level, in the order `handle` tries them: an active move mode answers
 * every key, then a focused node, then one of that node's action buttons. Anything else is left
 * to the library.
 */
@Injectable()
export class DiagramKeyboardService {
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly layoutService = inject(LayoutService);
  private readonly navigation = inject(NavigationOrderService);
  private readonly nodeVisibility = inject(NodeVisibilityService);
  private readonly nodeFocus = inject(NodeFocusService);
  private readonly sidebar = inject(PropertiesSidebarService);
  private readonly expandCollapse = inject(ExpandCollapseService);
  private readonly modelApply = inject(ModelApplyService);
  private readonly nodeDeletion = inject(NodeDeletionService);
  private readonly moveMode = inject(MoveModeService);

  /**
   * While a node is being moved, every key that would change the model has to be stopped before
   * the library sees it. `Ctrl`/`Cmd`+`X` is the worst of them: it copies and then deletes the
   * selection with its children, and the selection is the node being moved.
   */
  private readonly moveModeBindings: readonly KeyBinding<void>[] = [
    { match: (e) => e.key === 'Escape', run: (e) => this.cancelMove(e) },
    { match: isModifierEnter, run: swallow },
    { match: (e) => e.key === 'Enter', run: (e) => this.confirmMove(e) },
    { match: (e) => e.key === 'Tab', run: (e) => this.stepMove(e) },
    { match: (e) => isArrowKey(e.key) && !e.shiftKey, run: (e) => this.stepMoveByArrow(e) },
    { match: (e) => isArrowKey(e.key) && e.shiftKey, run: swallow },
    { match: isDeleteKey, run: swallowFromLibrary },
    { match: isModelMutatingShortcut, run: swallowFromLibrary },
    { match: (e) => e.key === ' ', run: swallow },
    { match: (e) => e.key === '?', run: swallowFromLibrary },
  ];

  private readonly nodeBindings: readonly KeyBinding<FocusedNode>[] = [
    { match: (e) => e.key === 'Tab', run: (e, f) => this.moveFocus(e, f.nodeId) },
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, f) => this.moveFocusInDirection(e, f),
    },
    { match: isModifierEnter, run: (e, f) => this.selectAndOpenSidebar(e, f) },
    { match: (e) => e.key === 'Enter', run: (e, f) => this.selectAndDescend(e, f) },
    { match: (e) => e.key === 'Escape', run: (e) => this.clearSelection(e) },
    { match: (e) => e.key === ' ', run: (e, f) => this.toggleExpand(e, f) },
    { match: isDeleteKey, run: (e, f) => this.requestDelete(e, f) },
  ];

  private readonly nodeActionBindings: readonly KeyBinding<FocusedNodeAction>[] = [
    { match: (e) => e.key === 'Tab', run: (e, f) => this.moveFocusWithinActions(e, f) },
    {
      match: (e) => e.shiftKey && isArrowKey(e.key),
      run: (e, f) => this.moveFocusInDirection(e, f),
    },
    // A bare arrow would nudge the selected node across the canvas.
    { match: (e) => isArrowKey(e.key), run: swallowFromLibrary },
    { match: isModifierEnter, run: (e, f) => this.selectAndOpenSidebar(e, f) },
    { match: (e) => e.key === 'Escape', run: (e, f) => this.ascendToNode(e, f) },
    { match: isDeleteKey, run: (e, f) => this.requestDelete(e, f) },
  ];

  handle(event: KeyboardEvent): void {
    if (this.moveMode.isActive()) {
      this.run(this.moveModeBindings, event, undefined);
      return;
    }

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
    swallowFromLibrary(event);
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
    swallow(event);
    this.selectionService.select([focus.nodeId]);
    this.nodeFocus.focusFirstAction(focus.nodeId);
  }

  private selectAndOpenSidebar(event: KeyboardEvent, focus: NodeFocusContext): void {
    swallow(event);
    this.selectionService.select([focus.nodeId]);
    this.sidebar.expandSidebar(focus.host);
  }

  private clearSelection(event: KeyboardEvent): void {
    const { nodes, edges } = this.selectionService.selection();
    if (nodes.length === 0 && edges.length === 0) return;
    swallow(event);
    this.selectionService.deselectAll();
  }

  private async toggleExpand(event: KeyboardEvent, focus: FocusedNode): Promise<void> {
    swallow(event);
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
    swallow(event);
    const step = event.shiftKey ? -1 : 1;
    const index = actions.indexOf(focus.action);
    const nextIndex = (index + step + actions.length) % actions.length;
    actions[nextIndex].focus({ preventScroll: true });
  }

  private ascendToNode(event: KeyboardEvent, focus: FocusedNodeAction): void {
    swallow(event);
    focus.host.focus({ preventScroll: true });
  }

  /** Always stop the key. If it gets through, the library deletes the selection unconfirmed. */
  private requestDelete(event: KeyboardEvent, focus: NodeFocusContext): void {
    swallowFromLibrary(event);
    this.nodeDeletion.requestDelete(focus.nodeId, focus.host);
  }

  private cancelMove(event: KeyboardEvent): void {
    swallow(event);
    this.moveMode.cancel();
  }

  private async confirmMove(event: KeyboardEvent): Promise<void> {
    swallow(event);
    await this.moveMode.confirm();
  }

  private stepMove(event: KeyboardEvent): void {
    swallow(event);
    this.moveMode.step(event.shiftKey ? -1 : 1);
  }

  /** The arrow has to be stopped as well, or the library nudges the moved node by a pixel. */
  private stepMoveByArrow(event: KeyboardEvent): void {
    swallowFromLibrary(event);
    this.moveMode.stepByArrow(event.key as ArrowKey);
  }
}
