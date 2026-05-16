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

type SortableScope = RegionResult | ForeignContinentResult | LeafScopeResult;

interface SortAccessors<TScope extends SortableScope> {
  tieBreaker: (scope: TScope) => number;
  electores?: (scope: TScope) => number;
}

function compareDesc(leftValue: number, rightValue: number) {
  return rightValue - leftValue;
}

function withTieBreaker<TScope extends SortableScope>(
  primaryCompare: number,
  left: TScope,
  right: TScope,
  tieBreaker: (scope: TScope) => number
) {
  if (primaryCompare !== 0) {
    return primaryCompare;
  }

  return compareDesc(tieBreaker(left), tieBreaker(right));
}

function createScopeComparator<TScope extends SortableScope>(
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair,
  accessors: SortAccessors<TScope>
) {
  const compareGap = (left: TScope, right: TScope) => {
    const leftGap = getScopeComparisonGap(left, comparisonPair, comparisonMode).gapVotes;
    const rightGap = getScopeComparisonGap(right, comparisonPair, comparisonMode).gapVotes;

    return withTieBreaker(leftGap - rightGap, left, right, accessors.tieBreaker);
  };

  return (left: TScope, right: TScope) => {
    switch (sortKey) {
      case "electores":
        if (accessors.electores) {
          return compareDesc(accessors.electores(left), accessors.electores(right));
        }

        return compareGap(left, right);
      case "actas":
        return compareDesc(left.actasContabilizadasPct, right.actasContabilizadasPct);
      case "participacion":
        return compareDesc(left.participacionCiudadanaPct, right.participacionCiudadanaPct);
      case "candidate": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        const primaryCompare = compareDesc(
          leftCandidate.actualPercentage,
          rightCandidate.actualPercentage
        );

        return withTieBreaker(primaryCompare, left, right, accessors.tieBreaker);
      }
      case "projection": {
        const leftCandidate = buildScopeComparisonItem(left, comparisonPair.candidateACode);
        const rightCandidate = buildScopeComparisonItem(right, comparisonPair.candidateACode);
        const primaryCompare = compareDesc(leftCandidate.projectedVotes, rightCandidate.projectedVotes);

        return withTieBreaker(primaryCompare, left, right, accessors.tieBreaker);
      }
      case "gap_2v3":
      default:
        return compareGap(left, right);
    }
  };
}

function sortScopes<TScope extends SortableScope>(
  scopes: TScope[],
  comparator: (left: TScope, right: TScope) => number
) {
  const sorted = [...scopes];
  sorted.sort(comparator);

  return sorted;
}

export function sortRegions(
  regions: RegionResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  return sortScopes(
    regions,
    createScopeComparator(sortKey, comparisonMode, comparisonPair, {
      tieBreaker: (scope) => scope.electores,
      electores: (scope) => scope.electores
    })
  );
}

export function sortLeafScopes(
  scopes: LeafScopeResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  return sortScopes(
    scopes,
    createScopeComparator(sortKey, comparisonMode, comparisonPair, {
      tieBreaker: (scope) => scope.totalVotosValidos
    })
  );
}

export function sortForeignContinents(
  continents: ForeignContinentResult[],
  sortKey: SortKey,
  comparisonMode: ComparisonMode,
  comparisonPair: ComparisonPair
) {
  return sortScopes(
    continents,
    createScopeComparator(sortKey, comparisonMode, comparisonPair, {
      tieBreaker: (scope) => scope.totalVotosValidos,
      electores: (scope) => scope.electores
    })
  );
}
