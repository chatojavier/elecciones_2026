/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRef } from "react";

import { useMobileGlobalControls } from "../src/components/global-controls";

describe("useMobileGlobalControls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hook: ReturnType<typeof useMobileGlobalControls> | null = null;
  let restoreInnerWidth: number;

  function Harness() {
    const sectionRef = useRef<HTMLElement | null>(null);
    hook = useMobileGlobalControls(sectionRef);
    return <section id="target" ref={sectionRef}>x</section>;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    restoreInnerWidth = window.innerWidth;
    document.body.style.overflow = "";
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: restoreInnerWidth });
    document.body.style.overflow = "";
  });

  it("handles responsive summary, sticky and overlay lock", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    await act(async () => {
      root.render(<Harness />);
    });
    expect(hook?.showInlineGlobalControlsRow).toBe(true);
    expect(hook?.showMobileControlsSummary).toBe(false);

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(hook?.showInlineGlobalControlsRow).toBe(false);
    expect(hook?.showMobileControlsSummary).toBe(true);

    await act(async () => {
      hook?.handleMobileControlsToggle();
    });
    expect(hook?.showMobileControlsOverlay).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => {
      hook?.handleMobileControlsToggle();
    });
    expect(hook?.showMobileControlsOverlay).toBe(false);
    expect(document.body.style.overflow).toBe("");

    await act(async () => {
      hook?.handleMobileControlsToggle();
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(hook?.showMobileControlsOverlay).toBe(false);

    const section = container.querySelector("#target") as HTMLElement;
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      top: 4
    } as DOMRect);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(hook?.isMobileControlsSticky).toBe(true);
  });
});
