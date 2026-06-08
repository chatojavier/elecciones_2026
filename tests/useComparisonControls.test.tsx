/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useComparisonControls } from "../src/components/global-controls";
import type { ElectionSnapshot } from "../src/lib/types";

const { trackEventMock } = vi.hoisted(() => ({
  trackEventMock: vi.fn()
}));

vi.mock("../src/lib/analytics", () => ({
  trackEvent: trackEventMock
}));

function createSnapshot(overrides: Partial<ElectionSnapshot> = {}): ElectionSnapshot {
  return {
    generatedAt: "2026-04-15T12:05:00.000Z",
    sourceElectionId: 10,
    sourceLastUpdatedAt: "2026-04-15T12:00:00.000Z",
    national: {
      scopeId: "1",
      kind: "national",
      label: "PERÚ",
      electores: 1000,
      padronShare: 1,
      actasContabilizadasPct: 80,
      contabilizadas: 80,
      totalActas: 100,
      participacionCiudadanaPct: 70,
      enviadasJee: 0,
      pendientesJee: 0,
      totalVotosEmitidos: 900,
      totalVotosValidos: 800,
      sourceUpdatedAt: "2026-04-15T12:00:00.000Z",
      candidates: [],
      featuredCandidates: [
        { code: "8", partyName: "A", candidateName: "CANDIDATA A", votesValid: 400, pctValid: 40, pctEmitted: 35 },
        { code: "10", partyName: "B", candidateName: "CANDIDATO B", votesValid: 300, pctValid: 30, pctEmitted: 26 },
        { code: "12", partyName: "C", candidateName: "CANDIDATA C", votesValid: 200, pctValid: 20, pctEmitted: 18 }
      ],
      otros: { code: "otros", label: "Otros", votesValid: 100, pctValid: 10, pctEmitted: 9 },
      projectedVotes: { "8": 1200, "10": 780, "12": 760, otros: 260 }
    },
    foreign: {
      scopeId: "2",
      kind: "foreign_total",
      label: "EXTRANJERO",
      electores: 100,
      padronShare: 1,
      actasContabilizadasPct: 70,
      contabilizadas: 70,
      totalActas: 100,
      participacionCiudadanaPct: 65,
      enviadasJee: 0,
      pendientesJee: 0,
      totalVotosEmitidos: 120,
      totalVotosValidos: 100,
      sourceUpdatedAt: "2026-04-15T12:00:00.000Z",
      candidates: [],
      featuredCandidates: [
        { code: "8", partyName: "A", candidateName: "CANDIDATA A", votesValid: 45, pctValid: 45, pctEmitted: 37 },
        { code: "10", partyName: "B", candidateName: "CANDIDATO B", votesValid: 30, pctValid: 30, pctEmitted: 25 },
        { code: "12", partyName: "C", candidateName: "CANDIDATA C", votesValid: 25, pctValid: 25, pctEmitted: 20 }
      ],
      otros: { code: "otros", label: "Otros", votesValid: 0, pctValid: 0, pctEmitted: 0 },
      projectedVotes: { "8": 120, "10": 70, "12": 58, otros: 35 },
      continents: []
    },
    regions: [],
    projectedNational: {
      totalElectores: 1100,
      totalProjectedValidVotes: 3000,
      projectedVotes: { "8": 1200, "10": 780, "12": 760, otros: 260 },
      projectedPercentages: { "8": 40, "10": 26, "12": 25.333, otros: 8.667 }
    },
    featuredCandidateCodes: ["8", "10", "12"],
    isStale: false,
    ...overrides,
    round: overrides.round ?? "first"
  };
}

describe("useComparisonControls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hook: ReturnType<typeof useComparisonControls> | null = null;
  let snapshot: ElectionSnapshot | null = null;
  const onResetSort = vi.fn();

  function Harness() {
    hook = useComparisonControls(snapshot, { onResetSort });
    return null;
  }

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    snapshot = createSnapshot();
    trackEventMock.mockReset();
    onResetSort.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("initializes, validates, reconciles and tracks control events", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(hook?.comparisonPair).toEqual({ candidateACode: "10", candidateBCode: "12" });
    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_pair_initialized",
      expect.objectContaining({ init_source: "default_rank_2v3" })
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      "global_controls_impression",
      expect.objectContaining({ snapshot_generated_at: snapshot?.generatedAt })
    );

    await act(async () => {
      hook?.handleComparisonCandidateChange("candidate_a", "8");
    });
    expect(hook?.comparisonPair).toEqual({ candidateACode: "8", candidateBCode: "12" });
    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_candidate_change",
      expect.objectContaining({ candidate_a_code: "8", candidate_b_code: "12" })
    );

    await act(async () => {
      hook?.handleComparisonCandidateChange("candidate_b", "8");
    });
    expect(hook?.comparisonInvalidSelector).toBe("candidate_b");
    expect(hook?.comparisonNotice).toBe("Selecciona dos candidatos distintos.");
    expect(trackEventMock).toHaveBeenCalledWith(
      "comparison_validation_error",
      expect.objectContaining({ candidate_a_code: "8", candidate_b_code: "8" })
    );

    await act(async () => {
      hook?.handleComparisonModeChange("current");
      hook?.handleShowOthersToggle();
    });
    expect(trackEventMock).toHaveBeenCalledWith(
      "global_control_change",
      expect.objectContaining({ control_name: "comparison_mode", next_value: "current" })
    );
    expect(trackEventMock).toHaveBeenCalledWith(
      "global_control_change",
      expect.objectContaining({ control_name: "show_others", next_value: true })
    );

    await act(async () => {
      hook?.handleGlobalReset();
    });
    expect(hook?.comparisonMode).toBe("projected");
    expect(hook?.showOthers).toBe(false);
    expect(onResetSort).toHaveBeenCalledTimes(1);

    snapshot = createSnapshot({
      generatedAt: "2026-04-15T12:06:00.000Z"
    });
    await act(async () => {
      root.render(<Harness />);
    });
    expect(hook?.comparisonNotice).not.toBe("Actualizamos la comparación con el mejor candidato disponible.");

    snapshot = createSnapshot({
      generatedAt: "2026-04-15T12:07:00.000Z",
      projectedNational: {
        totalElectores: 1100,
        totalProjectedValidVotes: 2400,
        projectedVotes: { "8": 1200, "10": 780, otros: 420 },
        projectedPercentages: { "8": 50, "10": 32.5, otros: 17.5 }
      },
      featuredCandidateCodes: ["8", "10"]
    });
    await act(async () => {
      root.render(<Harness />);
    });
    expect(hook?.comparisonNotice).toBe("Actualizamos la comparación con el mejor candidato disponible.");
  });
});
