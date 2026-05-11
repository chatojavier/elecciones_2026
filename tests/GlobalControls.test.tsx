/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { GlobalControls, type GlobalControlsProps } from "../src/components/global-controls";

describe("GlobalControls", () => {
  let container: HTMLDivElement;
  let root: Root;
  const props: GlobalControlsProps = {
    isMobileControlsSticky: false,
    showMobileControlsSummary: true,
    showInlineGlobalControlsRow: true,
    showMobileControlsOverlay: false,
    isMobileControlsOverlayOpen: false,
    mobileSummary: {
      candidateA: "A: Candidata A",
      candidateB: "B: Candidato B",
      comparisonMode: "Proyectado",
      others: "Otros Off"
    },
    onMobileControlsToggle: vi.fn(),
    comparisonCandidateOptions: [
      { code: "8", label: "CANDIDATA A" },
      { code: "10", label: "CANDIDATO B" }
    ],
    comparisonPair: { candidateACode: "8", candidateBCode: "10" },
    comparisonInvalidSelector: null,
    comparisonNotice: null,
    comparisonNoticeClassName: "global-controls__notice",
    onComparisonCandidateChange: vi.fn(),
    comparisonMode: "projected",
    onComparisonModeChange: vi.fn(),
    showOthers: false,
    onShowOthersToggle: vi.fn(),
    onGlobalReset: vi.fn()
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    props.onMobileControlsToggle = vi.fn();
    props.onComparisonCandidateChange = vi.fn();
    props.onComparisonModeChange = vi.fn();
    props.onShowOthersToggle = vi.fn();
    props.onGlobalReset = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders controls and wires callbacks", async () => {
    await act(async () => {
      root.render(<GlobalControls {...props} />);
    });

    const selectA = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    const selectB = container.querySelector('select[aria-label="Candidato B"]') as HTMLSelectElement;
    const mode = container.querySelector('select[aria-label="Comparar"]') as HTMLSelectElement;
    expect(selectA.value).toBe("8");
    expect(selectB.value).toBe("10");

    await act(async () => {
      selectA.value = "10";
      selectA.dispatchEvent(new Event("change", { bubbles: true }));
      mode.value = "current";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
      (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Off") as HTMLButtonElement).click();
      (Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reset") as HTMLButtonElement).click();
      (container.querySelector(".global-controls__mobile-toggle") as HTMLButtonElement).click();
    });

    expect(props.onComparisonCandidateChange).toHaveBeenCalledWith("candidate_a", "10");
    expect(props.onComparisonModeChange).toHaveBeenCalledWith("current");
    expect(props.onShowOthersToggle).toHaveBeenCalled();
    expect(props.onGlobalReset).toHaveBeenCalled();
    expect(props.onMobileControlsToggle).toHaveBeenCalled();
    expect(container.textContent).toContain("A: Candidata A");
    expect(container.textContent).toContain("Otros Off");
  });

  it("shows duplicate validation and overlay only when enabled", async () => {
    await act(async () => {
      root.render(
        <GlobalControls
          {...props}
          comparisonInvalidSelector="candidate_a"
          comparisonNotice="Selecciona dos candidatos distintos."
          comparisonNoticeClassName="global-controls__notice global-controls__notice--error"
          showMobileControlsOverlay={true}
        />
      );
    });

    const selectA = container.querySelector('select[aria-label="Candidato A"]') as HTMLSelectElement;
    expect(selectA.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Selecciona dos candidatos distintos.");
    expect(container.querySelector('.global-controls__mobile-overlay[role="dialog"]')).not.toBeNull();
  });
});
