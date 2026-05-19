import { inject, Injectable } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import type { AddNodeAction } from '../model/add-node.service';
import { getIsHidden } from '../model/data-getters';
import { HierarchyService } from '../model/hierarchy.service';
import { SortOrderService } from '../model/sort-order.service';

type NavIntent = 'parent' | 'firstChild' | 'prevSibling' | 'nextSibling';

/**
 * Maps Shift+Arrow keys to the next focusable org-chart node, given the current
 * node and layout orientation. Skips nodes that are hidden by a collapsed
 * ancestor.
 */
@Injectable()
export class KeyboardNavigationService {
  private readonly modelService = inject(NgDiagramModelService);
  private readonly hierarchyService = inject(HierarchyService);
  private readonly sortOrderService = inject(SortOrderService);

  getNextNodeId(currentId: string, arrowKey: string, isHorizontal: boolean): string | null {
    const intent = this.mapArrowToIntent(arrowKey, isHorizontal);
    if (!intent) return null;

    switch (intent) {
      case 'parent':
        return this.findVisibleParent(currentId);
      case 'firstChild':
        return this.findFirstVisibleChild(currentId);
      case 'prevSibling':
        return this.findSibling(currentId, -1);
      case 'nextSibling':
        return this.findSibling(currentId, 1);
    }
  }

  /**
   * Maps Alt+Arrow to an add-node position relative to the focused node,
   * mirroring the Shift+Arrow navigation directions.
   */
  getAddPositionForArrow(arrowKey: string, isHorizontal: boolean): AddNodeAction | null {
    if (isHorizontal) {
      switch (arrowKey) {
        case 'ArrowRight':
          return 'child';
        case 'ArrowUp':
          return 'siblingBefore';
        case 'ArrowDown':
          return 'siblingAfter';
        default:
          return null;
      }
    }
    switch (arrowKey) {
      case 'ArrowDown':
        return 'child';
      case 'ArrowLeft':
        return 'siblingBefore';
      case 'ArrowRight':
        return 'siblingAfter';
      default:
        return null;
    }
  }

  private mapArrowToIntent(key: string, isHorizontal: boolean): NavIntent | null {
    if (isHorizontal) {
      switch (key) {
        case 'ArrowLeft':
          return 'parent';
        case 'ArrowRight':
          return 'firstChild';
        case 'ArrowUp':
          return 'prevSibling';
        case 'ArrowDown':
          return 'nextSibling';
        default:
          return null;
      }
    }
    switch (key) {
      case 'ArrowUp':
        return 'parent';
      case 'ArrowDown':
        return 'firstChild';
      case 'ArrowLeft':
        return 'prevSibling';
      case 'ArrowRight':
        return 'nextSibling';
      default:
        return null;
    }
  }

  private findVisibleParent(currentId: string): string | null {
    const parentId = this.hierarchyService.getParentId(currentId);
    if (!parentId) return null;
    const parent = this.modelService.getNodeById(parentId);
    if (!parent || getIsHidden(parent)) return null;
    return parentId;
  }

  private findFirstVisibleChild(currentId: string): string | null {
    const children = this.sortOrderService.getSortedChildren(currentId);
    for (const child of children) {
      const node = this.modelService.getNodeById(child.id);
      if (node && !getIsHidden(node)) return child.id;
    }
    return null;
  }

  private findSibling(currentId: string, step: number): string | null {
    const parentId = this.hierarchyService.getParentId(currentId);
    if (!parentId) return null;
    const visibleSiblings = this.sortOrderService
      .getSortedChildren(parentId)
      .filter((c) => {
        const node = this.modelService.getNodeById(c.id);
        return node && !getIsHidden(node);
      });
    const idx = visibleSiblings.findIndex((c) => c.id === currentId);
    if (idx < 0) return null;
    return visibleSiblings.at(idx + step)?.id ?? null;
  }
}
