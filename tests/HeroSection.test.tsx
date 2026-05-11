/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { HeroSection } from "../src/components/sections";

describe("HeroSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders copy and callbacks", async () => {
    const onRefreshClick = vi.fn();
    const onPrimaryCtaClick = vi.fn();
    const onSecondaryCtaClick = vi.fn();

    await act(async () => {
      root.render(
        <HeroSection
          appLastSuccessAt="2026-05-11T12:00:00.000Z"
          clockNow={new Date("2026-05-11T12:10:00.000Z").getTime()}
          nextAutoRefreshInMinutes={5}
          sourceLastUpdatedAt="2026-05-11T12:05:00.000Z"
          appFreshnessStatus="Desactualizado"
          refreshing={false}
          statusNote="nota"
          snapshotGeneratedAt="2026-05-11T12:06:00.000Z"
          onRefreshClick={onRefreshClick}
          onPrimaryCtaClick={onPrimaryCtaClick}
          onSecondaryCtaClick={onSecondaryCtaClick}
        />
      );
    });

    expect(container.textContent).toContain("Conteo de votos y proyección nacional");
    expect(container.querySelector('a[href="#lectura-regional"]')).not.toBeNull();
    expect(container.querySelector('a[href="#metodologia"]')).not.toBeNull();
    expect(container.querySelector("#estado-actualizacion .status-badge")?.className).toContain("is-stale");
    expect((Array.from(container.querySelectorAll("button"))[0] as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      (container.querySelector('a[href="#lectura-regional"]') as HTMLAnchorElement).click();
      (container.querySelector('a[href="#metodologia"]') as HTMLAnchorElement).click();
      (container.querySelector(".refresh-button") as HTMLButtonElement).click();
    });

    expect(onPrimaryCtaClick).toHaveBeenCalled();
    expect(onSecondaryCtaClick).toHaveBeenCalled();
    expect(onRefreshClick).toHaveBeenCalled();
  });
});
