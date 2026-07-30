export interface FocusedNode {
  readonly level: 'node';
  readonly nodeId: string;
  readonly host: HTMLElement;
}

export type DiagramFocus = { readonly level: 'surface' } | FocusedNode;

/**
 * Resolves which diagram focus level an event came from.
 *
 * Anything inside a node host — the host itself or a control within it —
 * resolves to that node; anything else inside the diagram is the surface.
 */
export function resolveDiagramFocus(target: EventTarget | null): DiagramFocus {
  const host = target instanceof Element ? target.closest<HTMLElement>('[data-org-node-id]') : null;
  const nodeId = host?.dataset['orgNodeId'];
  if (!host || !nodeId) return { level: 'surface' };
  return { level: 'node', nodeId, host };
}

const DIAGRAM_SELECTOR = 'main.diagram';

const MEMORY_RETAINING_REGIONS = `${DIAGRAM_SELECTOR}, app-properties-sidebar`;

/**
 * Whether focus landing on this target should preserve the diagram's remembered
 * node. Focus moving into the properties panel keeps it, so tabbing back out of
 * the panel returns to the node the panel was opened from.
 */
export function retainsRememberedNode(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(MEMORY_RETAINING_REGIONS) !== null;
}

/**
 * Whether the given event target lies inside the diagram's main region.
 */
export function isInsideDiagram(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(DIAGRAM_SELECTOR) !== null;
}
