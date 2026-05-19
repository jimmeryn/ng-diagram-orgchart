import { inject, Injectable } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import type { AddNodeAction } from '../model/add-node.service';
import { getIsHidden } from '../model/data-getters';
import { HierarchyService } from '../model/hierarchy.service';
import { SortOrderService } from '../model/sort-order.service';
import { getArrowStrategy, type ArrowKey, type NavDirection } from './arrow-keys';

const DIRECTION_TO_ADD_ACTION: Record<NavDirection, AddNodeAction | null> = {
  parent: null,
  firstChild: 'child',
  prevSibling: 'siblingBefore',
  nextSibling: 'siblingAfter',
};

/**
 * Translates arrow keys into navigation targets and add-node positions based on
 * layout orientation. Skips nodes hidden by a collapsed ancestor.
 */
@Injectable()
export class KeyboardNavigationService {
  private readonly modelService = inject(NgDiagramModelService);
  private readonly hierarchyService = inject(HierarchyService);
  private readonly sortOrderService = inject(SortOrderService);

  getNextNodeId(currentId: string, arrowKey: ArrowKey, isHorizontal: boolean): string | null {
    const direction = getArrowStrategy(isHorizontal).toDirection(arrowKey);
    if (!direction) return null;
    switch (direction) {
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

  getAddPositionForArrow(arrowKey: ArrowKey, isHorizontal: boolean): AddNodeAction | null {
    const direction = getArrowStrategy(isHorizontal).toDirection(arrowKey);
    return direction ? DIRECTION_TO_ADD_ACTION[direction] : null;
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
    const visibleSiblings = this.sortOrderService.getSortedChildren(parentId).filter((c) => {
      const node = this.modelService.getNodeById(c.id);
      return node && !getIsHidden(node);
    });
    const idx = visibleSiblings.findIndex((c) => c.id === currentId);
    if (idx < 0) return null;
    return visibleSiblings.at(idx + step)?.id ?? null;
  }
}
