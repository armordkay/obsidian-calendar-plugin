import { getScrollContainer, scrollTimelineControl } from "./scroll";

function setup() {
  document.body.innerHTML = `<div class="view-content" style="overflow-y:auto">
    <div class="calendar-deadlines-root" style="overflow-y:hidden">
      <div class="deadline-scroll" style="line-height:20px;overflow:visible">
        <button class="deadline-task"><span>Task title</span></button>
        <button class="deadline-marker"><svg><path /></svg></button>
        <button class="deadline-date">Date</button><div class="gap"></div>
      </div>
    </div></div>`;
  const panel = document.querySelector<HTMLElement>(".view-content");
  const container = document.querySelector<HTMLElement>(".deadline-scroll");
  Object.defineProperties(panel, { scrollHeight: { value: 2000 }, clientHeight: { value: 600, configurable: true } });
  Object.defineProperties(container, { scrollHeight: { value: 1000 }, clientHeight: { value: 1000 } });
  container.addEventListener("wheel", scrollTimelineControl, { capture: true, passive: false });
  const click = jest.fn();
  container.querySelector(".deadline-task").addEventListener("click", click);
  function wheel(selector: string, options: WheelEventInit = {}) {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 50, ...options });
    container.querySelector(selector).dispatchEvent(event);
    return event;
  }
  return { panel, container, wheel, click };
}

it.each([".deadline-task", ".deadline-task span", ".deadline-marker path", ".deadline-date"])(
  "scrolls only the Obsidian panel over %s while retaining task clicks", selector => {
    const { panel, container, wheel, click } = setup();
    expect(wheel(selector).defaultPrevented).toBe(true);
    expect(panel.scrollTop).toBe(50);
    wheel(selector, { deltaY: -20 });
    expect(panel.scrollTop).toBe(30);
    expect(container.scrollTop).toBe(0);
    container.querySelector<HTMLButtonElement>(".deadline-task").click();
    expect(click).toHaveBeenCalledTimes(1);
  }
);

it("normalizes line and page wheels and preserves fractional trackpad deltas", () => {
  const { panel, wheel } = setup();
  wheel("span", { deltaY: 2, deltaMode: WheelEvent.DOM_DELTA_LINE });
  expect(panel.scrollTop).toBe(40);
  wheel("span", { deltaY: 1, deltaMode: WheelEvent.DOM_DELTA_PAGE });
  expect(panel.scrollTop).toBe(640);
  wheel("span", { deltaY: 0.5 });
  expect(panel.scrollTop).toBe(640.5);
});

it("finds the panel for date navigation even when it is already at a scroll boundary", () => {
  const { panel, container } = setup();
  panel.scrollTop = 1400;
  expect(getScrollContainer(container.parentElement)).toBe(panel);
  expect(getScrollContainer(container.parentElement, 50)).toBeNull();
  expect(getScrollContainer(container.parentElement, -50)).toBe(panel);
});

it("leaves zoom, horizontal gestures, gaps and non-scrollable panels to the browser", () => {
  const { panel, container, wheel } = setup();
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { deltaX: 100 }, { deltaY: 0 }]) {
    expect(wheel("span", options).defaultPrevented).toBe(false);
  }
  expect(wheel(".gap").defaultPrevented).toBe(false);
  expect(panel.scrollTop).toBe(0);
  expect(container.scrollTop).toBe(0);
  Object.defineProperty(panel, "clientHeight", { value: 2000 });
  expect(wheel("span").defaultPrevented).toBe(false);
});
