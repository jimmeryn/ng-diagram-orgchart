import { computed, inject, Injectable } from '@angular/core';
import { NgDiagramModelService, NgDiagramSelectionService } from 'ng-diagram';
import { findRootNode } from '../layout/visible-set';
import { isOrgChartNode } from '../model/guards';
import { NodeFocusService } from './node-focus.service';

/**
 * Identifies the single org-chart node that should receive focus when the
 * diagram is entered from outside (skip-link, future shortcuts): the selected
 * org-chart node when one is selected, otherwise the root. Used so keyboard
 * users land on a node ready to act on, not on an inert container.
 */
@Injectable()
export class FocusableNodeService {
  private readonly selectionService = inject(NgDiagramSelectionService);
  private readonly modelService = inject(NgDiagramModelService);
  private readonly nodeFocusService = inject(NodeFocusService);

  readonly currentId = computed<string | null>(() => {
    const selectedOrgNodes = this.selectionService.selection().nodes.filter(isOrgChartNode);
    const firstSelected = selectedOrgNodes.at(0);
    if (firstSelected) return firstSelected.id;
    const root = findRootNode(this.modelService.nodes(), this.modelService.edges());
    return root?.id ?? null;
  });

  focusCurrent(): void {
    const id = this.currentId();
    if (id != null) this.nodeFocusService.focus(id);
  }
}
