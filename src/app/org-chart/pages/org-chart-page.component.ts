import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { provideNgDiagram } from 'ng-diagram';
import { LayoutAnimationService } from '../diagram/animation/layout-animation.service';
import { DiagramComponent } from '../diagram/diagram.component';
import { LayoutGate } from '../diagram/layout/layout-gate';
import { LayoutService } from '../diagram/layout/layout.service';
import { AddNodeService } from '../diagram/model/add-node.service';
import { ExpandCollapseService } from '../diagram/model/expand-collapse.service';
import { HierarchyService } from '../diagram/model/hierarchy.service';
import { ModelApplyService } from '../diagram/model/model-apply.service';
import { SortOrderService } from '../diagram/model/sort-order.service';
import { DiagramFocusService } from '../diagram/keyboard-navigation/diagram-focus.service';
import { DiagramKeyboardController } from '../diagram/keyboard-navigation/diagram-keyboard.controller';
import { provideDiagramModalFocusRestore } from '../diagram/keyboard-navigation/diagram-modal-focus-restore';
import { trackFocusInputModality } from '../diagram/keyboard-navigation/focus-input-modality';
import { KeyboardNavigationService } from '../diagram/keyboard-navigation/keyboard-navigation.service';
import { NodeFocusService } from '../diagram/keyboard-navigation/node-focus.service';
import { ConfirmDeleteDialogComponent } from '../diagram/node-deletion/confirm-delete-dialog.component';
import { provideNodeDeletion } from '../diagram/node-deletion/node-deletion.providers';
import { NodeVisibilityConfigService } from '../diagram/node-visibility/node-visibility-config.service';
import { NodeVisibilityService } from '../diagram/node-visibility/node-visibility.service';
import { ViewportBoundsDirective } from '../diagram/node-visibility/viewport-bounds.directive';
import { ViewportOverlayDirective } from '../diagram/node-visibility/viewport-overlay.directive';
import { AddButtonService } from '../diagram/node/components/add-button/add-button.service';
import { KeyboardShortcutsDialogComponent } from '../keyboard-shortcuts/keyboard-shortcuts-dialog.component';
import { KeyboardShortcutsHotkeyDirective } from '../keyboard-shortcuts/keyboard-shortcuts-hotkey.directive';
import { KeyboardShortcutsTriggerComponent } from '../keyboard-shortcuts/keyboard-shortcuts-trigger.component';
import { provideKeyboardShortcuts } from '../keyboard-shortcuts/keyboard-shortcuts.providers';
import { MinimapPanelComponent } from '../minimap-panel/minimap-panel.component';
import { NodeMutationService } from '../properties-sidebar/node-mutation.service';
import { PropertiesSidebarComponent } from '../properties-sidebar/properties-sidebar.component';
import { PropertiesSidebarService } from '../properties-sidebar/properties-sidebar.service';
import { ToolbarHorizontalComponent } from '../toolbar-horizontal/toolbar-horizontal.component';
import { TopNavbarComponent } from '../top-navbar/top-navbar.component';

@Component({
  selector: 'app-org-chart-page',
  imports: [
    DiagramComponent,
    PropertiesSidebarComponent,
    TopNavbarComponent,
    MinimapPanelComponent,
    ToolbarHorizontalComponent,
    ViewportBoundsDirective,
    ViewportOverlayDirective,
    KeyboardShortcutsTriggerComponent,
    KeyboardShortcutsDialogComponent,
    ConfirmDeleteDialogComponent,
  ],
  templateUrl: './org-chart-page.component.html',
  styleUrl: './org-chart-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(focusin)': 'onPageFocusIn($event)',
    '(focusout)': 'onPageFocusOut($event)',
  },
  hostDirectives: [KeyboardShortcutsHotkeyDirective],
  providers: [
    provideNgDiagram(),
    // To customize org-chart settings, uncomment and modify:
    // provideOrgChartConfig({ animation: { durationMs: 500 }, viewport: { zoomStep: 0.2 } }),
    PropertiesSidebarService,
    NodeMutationService,
    SortOrderService,
    ExpandCollapseService,
    LayoutGate,
    LayoutService,
    ModelApplyService,
    HierarchyService,
    AddNodeService,
    AddButtonService,
    LayoutAnimationService,
    NodeVisibilityService,
    NodeVisibilityConfigService,
    KeyboardNavigationService,
    NodeFocusService,
    DiagramFocusService,
    DiagramKeyboardController,
    ...provideKeyboardShortcuts(),
    ...provideNodeDeletion(),
    provideDiagramModalFocusRestore(),
  ],
})
export class OrgChartPageComponent {
  private readonly diagramFocus = inject(DiagramFocusService);

  constructor() {
    trackFocusInputModality();
  }

  onSkipToDiagram(event: Event): void {
    event.preventDefault();
    this.diagramFocus.focusEntryNode();
  }

  protected onPageFocusIn(event: FocusEvent): void {
    this.diagramFocus.handlePageFocusIn(event.target);
  }

  protected onPageFocusOut(event: FocusEvent): void {
    this.diagramFocus.handlePageFocusOut(event.relatedTarget);
  }
}
