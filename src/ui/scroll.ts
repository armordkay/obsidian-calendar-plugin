/** Find the actual Obsidian scroll panel, skipping clipped calendar wrappers. */
export function getScrollContainer(start: HTMLElement, deltaY = 0): HTMLElement | null {
  let container = start;
  while (container) {
    const overflow = container.ownerDocument.defaultView.getComputedStyle(container).overflowY;
    const scrollable = /^(auto|scroll|overlay)$/.test(overflow) ||
      (container === container.ownerDocument.scrollingElement && overflow !== "hidden" && overflow !== "clip");
    const limit = container.scrollHeight - container.clientHeight;
    if (scrollable && limit > 0 && (!deltaY || (deltaY > 0 ? container.scrollTop < limit : container.scrollTop > 0))) return container;
    container = container.parentElement;
  }
  return null;
}

/** Keep wheel scrolling over timeline buttons reliable in embedded webviews. */
export function scrollTimelineControl(event: WheelEvent): void {
  if (event.ctrlKey || event.metaKey || !event.deltaY ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  const region = event.currentTarget as HTMLElement;
  const target = event.target as Element;
  if (!target.closest?.("button")) return;

  const container = getScrollContainer(region.parentElement, event.deltaY);
  if (!container) return;

  const view = region.ownerDocument.defaultView;
  const lineHeight = parseFloat(view.getComputedStyle(region).lineHeight) || 16;
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight :
    event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? container.clientHeight : 1;

  // Handle once at the scroll region, before the event reaches a clickable child.
  // Cancelling the native action prevents a second scroll in webviews where it works.
  event.preventDefault();
  event.stopPropagation();
  container.scrollTop += event.deltaY * unit;
}
