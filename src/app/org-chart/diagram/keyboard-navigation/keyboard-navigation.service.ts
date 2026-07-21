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
        return this.findSibling(currentId, -1, isHorizontal);
      case 'nextSibling':
        return this.findSibling(currentId, 1, isHorizontal);
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

  private findSibling(currentId: string, step: number, isHorizontal: boolean): string | null {
    const parentId = this.hierarchyService.getParentId(currentId);

    const siblingIds = parentId
      ? this.sortOrderService.getSortedChildren(parentId).map((c) => c.id)
      : this.orderedRootIds(isHorizontal);

    const visible = siblingIds.filter((id) => {
      const node = this.modelService.getNodeById(id);
      return node && !getIsHidden(node);
    });

    const idx = visible.indexOf(currentId);
    if (idx < 0) return null;

    const targetIdx = idx + step;
    if (targetIdx < 0 || targetIdx >= visible.length) return null;
    return visible[targetIdx];
  }

  private orderedRootIds(isHorizontal: boolean): string[] {
    const axis = isHorizontal ? 'y' : 'x';
    return this.hierarchyService
      .getRootIds()
      .map((id) => ({ id, pos: this.modelService.getNodeById(id)?.position[axis] ?? 0 }))
      .sort((a, b) => a.pos - b.pos || a.id.localeCompare(b.id))
      .map((r) => r.id);
  }
}
