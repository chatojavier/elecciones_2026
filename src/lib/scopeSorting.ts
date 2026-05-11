import {
  buildScopeComparisonItem,
  getScopeComparisonGap,
  type ComparisonMode,
  type ComparisonPair
} from "./comparison";
import type {
  ForeignContinentResult,
  ForeignCountryResult,
  ProvinceResult,
  RegionResult
} from "./types";

export type SortKey =
  | "electores"
  | "actas"
  | "participacion"
  | "candidate"
  | "projection"
  | "gap_2v3";

export type LeafScopeResult = ProvinceResult | ForeignCountryResult;

export function sortRegions(
  regions: RegionResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...regions];
  const getGapSortValue = (scope: RegionResult) =>
    getScopeComparisonGap(scope, comparisonPair, comparisonMode).gapVotes;

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.electores - left.electores;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.electores - left.electores;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "gap_2v3":
      default: {
        const leftGap = getGapSortValue(left);
        const rightGap = getGapSortValue(right);

        if (leftGap === rightGap) {
          return right.electores - left.electores;
        }

        return leftGap - rightGap;
      }
    }
  });

  return sorted;
}

export function sortLeafScopes(
  scopes: LeafScopeResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...scopes];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "gap_2v3":
      default: {
        const leftGap = getScopeComparisonGap(left, comparisonPair, comparisonMode).gapVotes;
        const rightGap = getScopeComparisonGap(right, comparisonPair, comparisonMode).gapVotes;

        if (leftGap === rightGap) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return leftGap - rightGap;
      }
    }
  });

  return sorted;
}

export function sortForeignContinents(
  continents: ForeignContinentResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  const sorted = [...continents];

  sorted.sort((left, right) => {
    switch (sortKey) {
      case "electores":
        return right.electores - left.electores;
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.actualPercentage === leftCandidate.actualPercentage) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.actualPercentage - leftCandidate.actualPercentage;
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);

        if (rightCandidate.projectedVotes === leftCandidate.projectedVotes) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return rightCandidate.projectedVotes - leftCandidate.projectedVotes;
      }
      case "actas":
        return right.actasContabilizadasPct - left.actasContabilizadasPct;
      case "participacion":
        return right.participacionCiudadanaPct - left.participacionCiudadanaPct;
      case "gap_2v3":
      default: {
        const leftGap = getScopeComparisonGap(left, comparisonPair, comparisonMode).gapVotes;
        const rightGap = getScopeComparisonGap(right, comparisonPair, comparisonMode).gapVotes;

        if (leftGap === rightGap) {
          return right.totalVotosValidos - left.totalVotosValidos;
        }

        return leftGap - rightGap;
      }
    }
  });

  return sorted;
}
