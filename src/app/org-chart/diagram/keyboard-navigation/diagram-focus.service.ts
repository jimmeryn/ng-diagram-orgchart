import { computed, inject, Injectable, signal } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import { LayoutService } from '../layout/layout.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';
import { isInsideDiagram } from './diagram-focus-level';
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

  forgetNode(): void {
    this.lastFocusedNodeId.set(null);
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
