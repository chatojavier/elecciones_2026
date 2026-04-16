import type { ElectionSnapshot, ProvinceResult, ScopeResult } from "./types";

export type ComparisonMode = "current" | "projected";

export interface ComparisonItem {
  code: string;
  label: string;
  actualVotes: number;
  actualPercentage: number;
  projectedVotes: number;
  projectedPercentage: number;
  deltaVotes: number;
  deltaPercentage: number;
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function calculatePercentage(votes: number, totalVotes: number) {
  if (totalVotes === 0) {
    return 0;
  }

  return round((votes / totalVotes) * 100);
}

function calculateProjectedPercentage(projectedVotes: Record<string, number>, code: string) {
  const totalProjectedVotes = Object.values(projectedVotes).reduce((sum, votes) => sum + votes, 0);

  return calculatePercentage(projectedVotes[code] ?? 0, totalProjectedVotes);
}

function createComparisonItem(input: {
  code: string;
  label: string;
  actualVotes: number;
  actualPercentage: number;
  projectedVotes: number;
  projectedPercentage: number;
}): ComparisonItem {
  return {
    ...input,
    deltaVotes: input.projectedVotes - input.actualVotes,
    deltaPercentage: round(input.projectedPercentage - input.actualPercentage)
  };
}

export function buildNationalComparisonItems(snapshot: ElectionSnapshot) {
  const totalCurrentValidVotes = snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos;
  const foreignFeaturedByCode = new Map(
    snapshot.foreign.featuredCandidates.map((candidate) => [candidate.code, candidate])
  );
  const featuredItems = snapshot.national.featuredCandidates.map((candidate) => {
    const foreignCandidate = foreignFeaturedByCode.get(candidate.code);
    const actualVotes = candidate.votesValid + (foreignCandidate?.votesValid ?? 0);

    return createComparisonItem({
      code: candidate.code,
      label: candidate.candidateName,
      actualVotes,
      actualPercentage: calculatePercentage(actualVotes, totalCurrentValidVotes),
      projectedVotes: snapshot.projectedNational.projectedVotes[candidate.code] ?? 0,
      projectedPercentage: snapshot.projectedNational.projectedPercentages[candidate.code] ?? 0
    });
  });

  return [
    ...featuredItems,
    createComparisonItem({
      code: "otros",
      label: "Otros",
      actualVotes: snapshot.national.otros.votesValid + snapshot.foreign.otros.votesValid,
      actualPercentage: calculatePercentage(
        snapshot.national.otros.votesValid + snapshot.foreign.otros.votesValid,
        totalCurrentValidVotes
      ),
      projectedVotes: snapshot.projectedNational.projectedVotes.otros ?? 0,
      projectedPercentage: snapshot.projectedNational.projectedPercentages.otros ?? 0
    })
  ];
}

export function buildScopeComparisonItem(
  scope: ScopeResult | ProvinceResult,
  selectedCode: string
): ComparisonItem {
  if (selectedCode === "otros") {
    return createComparisonItem({
      code: "otros",
      label: "Otros",
      actualVotes: scope.otros.votesValid,
      actualPercentage: scope.otros.pctValid,
      projectedVotes: scope.projectedVotes.otros ?? 0,
      projectedPercentage: calculateProjectedPercentage(scope.projectedVotes, "otros")
    });
  }

  const candidate = scope.featuredCandidates.find((item) => item.code === selectedCode);

  return createComparisonItem({
    code: selectedCode,
    label: candidate?.candidateName ?? "Sin dato",
    actualVotes: candidate?.votesValid ?? 0,
    actualPercentage: candidate?.pctValid ?? 0,
    projectedVotes: scope.projectedVotes[selectedCode] ?? 0,
    projectedPercentage: calculateProjectedPercentage(scope.projectedVotes, selectedCode)
  });
}
