import { type ComparisonMode, type ComparisonPair } from "./comparison";
import { formatTitleCase } from "./format";

export function getComparisonColumnLabel(comparisonMode: ComparisonMode) {
  return `Brecha A vs B (${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"})`;
}

export function getComparisonPairDetail(
  pair: ComparisonPair,
  labelByCode: Map<string, string>,
  comparisonMode: ComparisonMode
) {
  const labelA = formatTitleCase(labelByCode.get(pair.candidateACode) ?? "Sin dato");
  const labelB = formatTitleCase(labelByCode.get(pair.candidateBCode) ?? "Sin dato");

  return `${labelA} vs ${labelB} · ${comparisonMode === "projected" ? "Proyectado" : "Actual ONPE"}`;
}
