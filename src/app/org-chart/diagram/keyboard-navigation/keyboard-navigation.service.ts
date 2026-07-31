import { inject, Injectable } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import { getIsHidden } from '../model/data-getters';
import { HierarchyService } from '../model/hierarchy.service';
import { SortOrderService } from '../model/sort-order.service';
import { getArrowStrategy, type ArrowKey } from './arrow-keys';

/**
 * Translates arrow keys into navigation targets based on layout orientation.
 * Skips nodes hidden by a collapsed ancestor.
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

  /** Visible nodes depth-first: every node immediately followed by its subtree. */
  getVisibleTreeOrder(isHorizontal: boolean): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const stack = [...this.orderedRootIds(isHorizontal)].reverse();

    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const node = this.modelService.getNodeById(id);
      if (!node || getIsHidden(node)) continue;
      order.push(id);

      const children = this.sortOrderService.getSortedChildren(id);
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i].id);
    }

    return order;
  }

  getAdjacentNodeId(currentId: string, step: 1 | -1, isHorizontal: boolean): string | null {
    const order = this.getVisibleTreeOrder(isHorizontal);
    const index = order.indexOf(currentId);
    if (index < 0) return null;
    return order[index + step] ?? null;
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
