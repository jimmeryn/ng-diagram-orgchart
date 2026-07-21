import { inject, Injectable } from '@angular/core';
import { NgDiagramSelectionService } from 'ng-diagram';
import { AddNodeService, type AddNodeAction } from '../../../model/add-node.service';
import { NodeVisibilityService } from '../../../node-visibility/node-visibility.service';

@Injectable()
export class AddButtonService {
  private readonly addNodeService = inject(AddNodeService);
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly nodeVisibilityService = inject(NodeVisibilityService);

  async addNode(nodeId: string, action: AddNodeAction): Promise<string | undefined> {
    const newNodeId = await this.addNodeService.addNode(nodeId, action);
    if (newNodeId == null) return undefined;
    this.selectionService.select([newNodeId]);
    requestAnimationFrame(() => {
      this.nodeVisibilityService.ensureVisible(newNodeId);
    });
    return newNodeId;
  }
}
