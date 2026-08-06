import { inject, Injectable } from '@angular/core';
import { DiagramFocusService } from '../keyboard-navigation/diagram-focus.service';
import { NodeFocusService } from '../keyboard-navigation/node-focus.service';
import { HierarchyService } from '../model/hierarchy.service';
import { SortOrderService } from '../model/sort-order.service';
import { NodeVisibilityService } from '../node-visibility/node-visibility.service';

/**
 * Where the focus goes when a node is deleted.
 *
 * Keep the two steps apart. A focus request lands one change-detection pass later, and a
 * collapsed root's first child cannot take the focus until the deletion makes it visible.
 */
@Injectable()
export class NodeDeletionFocusService {
  private readonly hierarchy = inject(HierarchyService);
  private readonly sortOrder = inject(SortOrderService);
  private readonly nodeVisibility = inject(NodeVisibilityService);
  private readonly nodeFocus = inject(NodeFocusService);
  private readonly diagramFocus = inject(DiagramFocusService);

  get diagramSurface(): HTMLElement | null {
    return this.diagramFocus.diagramSurface;
  }

  /** Step 1, before the deletion. */
  resolveSuccessor(nodeId: string): string | null {
    const parentId = this.hierarchy.getParentId(nodeId);
    if (parentId) return parentId;
    return this.sortOrder.getSortedChildren(nodeId).at(0)?.id ?? null;
  }

  /** Step 2, after the deletion. */
  focusSuccessor(successorId: string | null): void {
    if (!successorId) {
      this.diagramFocus.focusEntryNode();
      return;
    }
    this.nodeVisibility.ensureVisible(successorId);
    this.nodeFocus.focus(successorId);
  }
}
