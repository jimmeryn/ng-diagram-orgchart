import { inject, Injectable } from '@angular/core';
import { NgDiagramModelService } from 'ng-diagram';
import { isOccupiedNodeData } from '../model/guards';
import { type OrgChartNodeData } from '../model/interfaces';
import { buildDeleteConfirmation, type DeleteConfirmation } from './delete-confirmation';

/** Reads a node from the model and gives its delete confirmation text. */
@Injectable()
export class DeleteConfirmationFactory {
  private readonly modelService = inject(NgDiagramModelService);

  /** Null if the node is not in the model. */
  create(nodeId: string): DeleteConfirmation | null {
    const node = this.modelService.getNodeById<OrgChartNodeData>(nodeId);
    if (!node) return null;

    const data = node.data;
    return buildDeleteConfirmation({
      name: isOccupiedNodeData(data) ? data.fullName : null,
      role: data.role ?? null,
    });
  }
}
