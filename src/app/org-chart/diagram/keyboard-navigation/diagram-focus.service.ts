import { computed, inject, Injectable, signal } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import { LayoutService } from '../layout/layout.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';
import { isInsideDiagram, resolveDiagramFocus, retainsRememberedNode } from './diagram-focus-level';
import { KeyboardNavigationService } from './keyboard-navigation.service';
import { NodeFocusService } from './node-focus.service';

/**
 * Owns which node is the diagram's tab stop, and focusing it.
 *
 * `entryNodeId` resumes at the node that last had focus, falling back to the
 * first node in tab order.
 */
@Injectable()
export class DiagramFocusService {
  private readonly navigation = inject(KeyboardNavigationService);
  private readonly layoutService = inject(LayoutService);
  private readonly nodeVisibility = inject(NodeVisibilityService);
  private readonly nodeFocus = inject(NodeFocusService);
  private readonly modelService = inject(NgDiagramModelService);

  private readonly lastFocusedNodeId = signal<string | null>(null);
  private readonly nodeWithFocus = signal<string | null>(null);

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
    this.nodeWithFocus.set(focus.level === 'surface' ? null : focus.nodeId);
    if (retainsRememberedNode(target)) return;
    this.lastFocusedNodeId.set(null);
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

  focusEntryNode(): void {
    const nodeId = this.entryNodeId();
    if (!nodeId) return;
    this.nodeVisibility.ensureVisible(nodeId);
    this.nodeFocus.focus(nodeId);
  }

  recoverFocusIfLost(): void {
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body) return;
      if (this.lastFocusedNodeId() === null) return;
      this.focusEntryNode();
    });
  }
}
