/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { QuickInsightsSection, QuickInsightsSkeleton } from "../src/components/sections";

describe("QuickInsightsSection", () => {
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

  it("renders values and fires CTA callback", async () => {
    const onDetailClick = vi.fn();
    await act(async () => {
      root.render(
        <QuickInsightsSection
          quickInsightsTitle="A vs B"
          actasPeruValue="90%"
          actasExteriorValue="80%"
          deltaProyeccionValue="+10"
          candidateA={{ label: "A", code: "8", deltaValue: "+1.00 pp", item: null }}
          candidateB={{ label: "B", code: "10", deltaValue: "-1.00 pp", item: null }}
          current={{
            candidateAPercentageValue: "40%",
            candidateAVotesValue: "100 votos",
            candidateBPercentageValue: "30%",
            candidateBVotesValue: "90 votos",
            gapPpValue: "+10 pp",
            gapVotesValue: "+10 votos",
            gapRaw: 1
          }}
          projected={{
            candidateAPercentageValue: "42%",
            candidateAVotesValue: "110 votos",
            candidateBPercentageValue: "31%",
            candidateBVotesValue: "95 votos",
            gapPpValue: "+11 pp",
            gapVotesValue: "+15 votos",
            gapRaw: 1.2
          }}
          onDetailClick={onDetailClick}
        />
      );
    });
    expect(container.textContent).toContain("Comparativa rápida de candidatos");
    expect(container.textContent).toContain("Actas Perú: 90%");
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("B");
    await act(async () => {
      (container.querySelector(".quick-insights__cta") as HTMLAnchorElement).click();
    });
    expect(onDetailClick).toHaveBeenCalled();
  });

  it("renders skeleton", async () => {
    await act(async () => {
      root.render(<QuickInsightsSkeleton />);
    });
    expect(container.querySelector(".quick-insights--loading")).not.toBeNull();
  });
});
