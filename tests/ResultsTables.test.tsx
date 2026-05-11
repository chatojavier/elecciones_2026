/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ForeignResultsTable, RegionalResultsTable } from "../src/components/sections";
import type { ComparisonPair } from "../src/lib/comparison";
import type { ForeignContinentResult, RegionResult } from "../src/lib/types";

function createRegion(): RegionResult {
  return {
    scopeId: "040000",
    kind: "department",
    label: "AREQUIPA",
    electores: 1000,
    padronShare: 10,
    actasContabilizadasPct: 80,
    contabilizadas: 80,
    totalActas: 100,
    participacionCiudadanaPct: 70,
    enviadasJee: 0,
    pendientesJee: 0,
    totalVotosEmitidos: 900,
    totalVotosValidos: 800,
    sourceUpdatedAt: "2026-05-11T12:00:00.000Z",
    candidates: [],
    featuredCandidates: [],
    otros: { code: "otros", label: "Otros", votesValid: 100, pctValid: 10, pctEmitted: 10 },
    projectedVotes: {},
    provinces: []
  };
}

function createContinent(): ForeignContinentResult {
  return {
    ...createRegion(),
    scopeId: "920000",
    kind: "foreign_continent",
    label: "EUROPA",
    countries: []
  };
}

describe("Results tables", () => {
  let container: HTMLDivElement;
  let root: Root;
  const pair: ComparisonPair = { candidateACode: "8", candidateBCode: "10" };

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

  it("wires regional controls", async () => {
    const onSortChange = vi.fn();
    const onSearchChange = vi.fn();
    const onRegionToggle = vi.fn();

    await act(async () => {
      root.render(
        <RegionalResultsTable
          regions={[createRegion()]}
          sortKey="gap_2v3"
          regionSearchQuery=""
          showOthers={false}
          selectedComparisonLabel="Brecha"
          comparisonMode="projected"
          comparisonPair={pair}
          comparisonOptionLabels={new Map([["8", "A"], ["10", "B"]])}
          expandedRegionId={null}
          onSortChange={onSortChange}
          onSearchChange={onSearchChange}
          onRegionToggle={onRegionToggle}
          getScopeComparisonDisplay={() => ({ votes: "+1", percentage: "+1 pp", detail: "A vs B" })}
        />
      );
    });
    await act(async () => {
      const select = container.querySelector("select") as HTMLSelectElement;
      select.value = "electores";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      (container.querySelector('input[type="search"]') as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
      (container.querySelector(".region-row-toggle") as HTMLButtonElement).click();
    });
    expect(onSortChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenCalled();
    expect(onRegionToggle).toHaveBeenCalled();
  });

  it("wires foreign controls", async () => {
    const onSearchChange = vi.fn();
    const onContinentToggle = vi.fn();
    await act(async () => {
      root.render(
        <ForeignResultsTable
          continents={[createContinent()]}
          foreignSearchQuery=""
          showOthers={false}
          selectedComparisonLabel="Brecha"
          comparisonMode="projected"
          comparisonPair={pair}
          comparisonOptionLabels={new Map([["8", "A"], ["10", "B"]])}
          expandedContinentId={null}
          onSearchChange={onSearchChange}
          onContinentToggle={onContinentToggle}
          getScopeComparisonDisplay={() => ({ votes: "+1", percentage: "+1 pp", detail: "A vs B" })}
          sortKey="gap_2v3"
        />
      );
    });
    await act(async () => {
      (container.querySelector('input[type="search"]') as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
      (container.querySelector(".region-row-toggle") as HTMLButtonElement).click();
    });
    expect(onSearchChange).toHaveBeenCalled();
    expect(onContinentToggle).toHaveBeenCalled();
  });
});
