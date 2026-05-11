/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { FeaturedComparisonSection } from "../src/components/sections";
import type { ComparisonItem } from "../src/lib/comparison";

describe("FeaturedComparisonSection", () => {
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

  it("renders central comparison bars", async () => {
    const items: ComparisonItem[] = [
      {
        code: "8",
        label: "A",
        actualVotes: 100,
        actualPercentage: 40,
        projectedVotes: 120,
        projectedPercentage: 42,
        deltaVotes: 20,
        deltaPercentage: 2
      },
      {
        code: "10",
        label: "B",
        actualVotes: 90,
        actualPercentage: 35,
        projectedVotes: 95,
        projectedPercentage: 36,
        deltaVotes: 5,
        deltaPercentage: 1
      }
    ];

    await act(async () => {
      root.render(<FeaturedComparisonSection items={items} />);
    });

    expect(container.querySelector("#comparativa-central")).not.toBeNull();
    expect(container.textContent).toContain("Candidatos seleccionados, total elección");
    expect(container.querySelectorAll(".featured-bar")).toHaveLength(2);
  });
});
