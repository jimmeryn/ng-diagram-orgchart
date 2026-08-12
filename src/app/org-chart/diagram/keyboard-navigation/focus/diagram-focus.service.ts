import { computed, inject, Injectable, signal } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import { LayoutService } from '../../layout/layout.service';
import { NodeVisibilityService } from '../../node-visibility/node-visibility.service';
import {
  isInsideDiagram,
  NODE_HOST_SELECTOR,
  resolveDiagramFocus,
  retainsRememberedNode,
  type DiagramFocus,
} from './diagram-focus-level';
import { NavigationOrderService } from '../order/navigation-order.service';
import { NodeFocusService } from './node-focus.service';

/**
 * Owns which node is the diagram's tab stop, and focusing it.
 *
 * `entryNodeId` resumes at the node that last had focus, falling back to the
 * first node in tab order.
 */
@Injectable()
export class DiagramFocusService {
  private readonly navigation = inject(NavigationOrderService);
  private readonly layoutService = inject(LayoutService);
  private readonly nodeVisibility = inject(NodeVisibilityService);
  private readonly nodeFocus = inject(NodeFocusService);
  private readonly modelService = inject(NgDiagramModelService);

  private readonly lastFocusedNodeId = signal<string | null>(null);
  private readonly nodeWithFocus = signal<string | null>(null);
  private fallbackTarget: HTMLElement | null = null;
  private lastInputWasPointer = false;

  /** The node that currently contains focus — its host or one of its action buttons. */
  readonly nodeWithFocusId = this.nodeWithFocus.asReadonly();

  readonly entryNodeId = computed<string | null>(() => {
    this.modelService.nodes();
    this.modelService.edges();

    const tabOrder = this.navigation.getVisibleTreeOrder(this.layoutService.isHorizontal());
    const remembered = this.lastFocusedNodeId();
    if (remembered && tabOrder.includes(remembered)) return remembered;
    return tabOrder.at(0) ?? null;
  });

  handleNodeFocus(nodeId: string, from: EventTarget | null): void {
    this.lastFocusedNodeId.set(nodeId);
    if (isInsideDiagram(from)) return;
    this.nodeVisibility.ensureVisible(nodeId);
  }

  /**
   * Reacts to focus landing anywhere on the page: tracks which node contains focus, and
   * drops the remembered node once focus leaves the diagram and its properties panel.
   */
  handlePageFocusIn(target: EventTarget | null): void {
    const focus = resolveDiagramFocus(target);
    this.nodeWithFocus.set(this.resolveContainment(focus));
    if (retainsRememberedNode(target)) return;
    this.lastFocusedNodeId.set(null);
  }

  handlePagePointerDown(target: EventTarget | null): void {
    this.lastInputWasPointer = true;
    if (resolveDiagramFocus(target).level !== 'surface') return;
    this.releaseFocusedNode();
  }

  /** The node keeps the focus after a key press, so `Enter` can reach its buttons. */
  handlePageKeyDown(target: EventTarget | null): void {
    this.lastInputWasPointer = false;
    const focus = resolveDiagramFocus(target);
    if (focus.level === 'surface') return;
    this.nodeWithFocus.set(focus.nodeId);
  }

  /** Focuses a node on the app's behalf. Not a pointer press, so the node keeps the focus. */
  focusNode(nodeId: string): void {
    this.lastInputWasPointer = false;
    this.nodeFocus.focus(nodeId);
  }

  /** ng-diagram prevents the default blur on a press on the canvas. Blur the node host. */
  private releaseFocusedNode(): void {
    this.nodeWithFocus.set(null);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest(NODE_HOST_SELECTOR)) {
      focused.blur();
    }
  }

  /** Clears the focus-containment state when focus is lost to the document body. */
  handlePageFocusOut(relatedTarget: EventTarget | null): void {
    if (relatedTarget !== null) return;
    requestAnimationFrame(() => {
      if (!document.hasFocus()) return;
      if (document.activeElement !== document.body) return;
      this.nodeWithFocus.set(null);
    });
  }

  /**
   * Focus on a button always counts. The buttons must stay in the DOM while they have the
   * focus. Focus on the host counts only after keyboard input, because a pointer press
   * gives the host the focus and no later event removes it.
   */
  private resolveContainment(focus: DiagramFocus): string | null {
    if (focus.level === 'surface') return null;
    if (focus.level === 'node' && this.lastInputWasPointer) return null;
    return focus.nodeId;
  }

  setFallbackTarget(element: HTMLElement | null): void {
    this.fallbackTarget = element;
  }

  get diagramSurface(): HTMLElement | null {
    return this.fallbackTarget;
  }

  /** With no node to focus, the focus goes to the diagram and not to `document.body`. */
  focusEntryNode(): void {
    const nodeId = this.entryNodeId();
    if (!nodeId) {
      this.fallbackTarget?.focus({ preventScroll: true });
      return;
    }
    this.nodeVisibility.ensureVisible(nodeId);
    this.focusNode(nodeId);
  }

  recoverFocusIfLost(): void {
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;
      if (this.lastFocusedNodeId() === null) return;
      this.focusEntryNode();
    });
  }
}
