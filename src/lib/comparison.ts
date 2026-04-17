import type {
  CandidateResult,
  ElectionSnapshot,
  ForeignCountryResult,
  ProvinceResult,
  ScopeResult
} from "./types";

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

export type SecondRoundStatusLevel = "stable" | "tight" | "very_tight" | "unknown";

export interface SecondRoundCandidate {
  code: string;
  label: string;
  projectedVotes: number;
  projectedPercentage: number;
}

export interface SecondRoundInsight {
  rank2: SecondRoundCandidate | null;
  rank3: SecondRoundCandidate | null;
  gapVotes2v3: number | null;
  gapPp2v3: number | null;
  actasPeruPct: number;
  actasExteriorPct: number;
  deltaProyeccionVotes: number;
  statusLevel: SecondRoundStatusLevel;
}

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function projectVotesByCountedActas(votesValid: number, actasContabilizadasPct: number) {
  const completionRatio = Math.min(Math.max(actasContabilizadasPct / 100, 0), 1);

  if (completionRatio === 0) {
    return 0;
  }

  return Math.round(votesValid / completionRatio);
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

function buildSecondRoundCandidateLabelMap(snapshot: ElectionSnapshot) {
  const labels = new Map<string, string>();
  const candidates = [
    ...snapshot.national.candidates,
    ...snapshot.foreign.candidates,
    ...snapshot.national.featuredCandidates,
    ...snapshot.foreign.featuredCandidates
  ];

  for (const candidate of candidates) {
    if (!labels.has(candidate.code)) {
      labels.set(candidate.code, candidate.candidateName);
    }
  }

  return labels;
}

function resolveSecondRoundStatusLevel(gapPp2v3: number | null): SecondRoundStatusLevel {
  if (gapPp2v3 === null) {
    return "unknown";
  }

  if (gapPp2v3 < 0.5) {
    return "very_tight";
  }

  if (gapPp2v3 < 1.5) {
    return "tight";
  }

  return "stable";
}

export function getScopeSecondRoundGapVotes(
  scope: {
    projectedVotes: Record<string, number>;
    candidates?: CandidateResult[];
    actasContabilizadasPct?: number;
  },
  rank2Code: string,
  rank3Code: string
) {
  const resolveProjectedVotes = (code: string) => {
    const projectedFromScope = scope.projectedVotes[code];
    if (typeof projectedFromScope === "number") {
      return projectedFromScope;
    }

    if (!scope.candidates || typeof scope.actasContabilizadasPct !== "number") {
      return 0;
    }

    const candidate = scope.candidates.find((item) => item.code === code);
    if (!candidate) {
      return 0;
    }

    return projectVotesByCountedActas(candidate.votesValid, scope.actasContabilizadasPct);
  };

  return resolveProjectedVotes(rank2Code) - resolveProjectedVotes(rank3Code);
}

function addProjectedVotesFromScope(
  projectedVotesByCode: Map<string, number>,
  scope: { candidates: CandidateResult[]; actasContabilizadasPct: number },
  fillMissingOnly = false
) {
  for (const candidate of scope.candidates) {
    if (candidate.code === "otros") {
      continue;
    }

    if (fillMissingOnly && projectedVotesByCode.has(candidate.code)) {
      continue;
    }

    const projectedVotes = projectVotesByCountedActas(candidate.votesValid, scope.actasContabilizadasPct);

    if (fillMissingOnly) {
      projectedVotesByCode.set(candidate.code, projectedVotes);
      continue;
    }

    projectedVotesByCode.set(
      candidate.code,
      (projectedVotesByCode.get(candidate.code) ?? 0) + projectedVotes
    );
  }
}

export function buildSecondRoundInsight(snapshot: ElectionSnapshot): SecondRoundInsight {
  const labelByCode = buildSecondRoundCandidateLabelMap(snapshot);
  const projectedVotesByCode = new Map<string, number>();
  const hasRegionalCandidateData = snapshot.regions.some((region) => region.candidates.length > 0);

  if (hasRegionalCandidateData) {
    for (const region of snapshot.regions) {
      addProjectedVotesFromScope(projectedVotesByCode, region);
    }

    addProjectedVotesFromScope(projectedVotesByCode, snapshot.foreign);
  } else {
    // Backward-compat fallback when canonical regional detail is unavailable.
    addProjectedVotesFromScope(projectedVotesByCode, snapshot.national);
    addProjectedVotesFromScope(projectedVotesByCode, snapshot.foreign);
  }

  // Legacy fallback for snapshots without candidates detail at all.
  if (projectedVotesByCode.size < 3) {
    for (const [code, projectedVotes] of Object.entries(snapshot.projectedNational.projectedVotes)) {
      if (code === "otros" || projectedVotesByCode.has(code)) {
        continue;
      }

      projectedVotesByCode.set(code, projectedVotes);
    }
  }

  // Prefer canonical projectedNational values when available for a candidate code.
  for (const [code, projectedVotes] of Object.entries(snapshot.projectedNational.projectedVotes)) {
    if (code === "otros" || projectedVotesByCode.has(code)) {
      continue;
    }

    projectedVotesByCode.set(code, projectedVotes);
  }

  const totalProjectedVotes = Array.from(projectedVotesByCode.values()).reduce(
    (sum, votes) => sum + votes,
    0
  );
  const percentageDenominator =
    snapshot.projectedNational.totalProjectedValidVotes > 0
      ? snapshot.projectedNational.totalProjectedValidVotes
      : totalProjectedVotes;

  const voteEntries = Array.from(projectedVotesByCode.entries())
    .map(([code, projectedVotes]) => {
      const projectedVotesFromSnapshot = snapshot.projectedNational.projectedVotes[code];
      const projectedPercentageFromSnapshot = snapshot.projectedNational.projectedPercentages[code];
      const resolvedProjectedVotes =
        typeof projectedVotesFromSnapshot === "number"
          ? projectedVotesFromSnapshot
          : projectedVotes;

      return {
        code,
        projectedVotes: resolvedProjectedVotes,
        projectedPercentage:
          typeof projectedPercentageFromSnapshot === "number"
            ? projectedPercentageFromSnapshot
            : calculatePercentage(resolvedProjectedVotes, percentageDenominator)
      };
    })
    .sort((left, right) => {
      if (right.projectedVotes !== left.projectedVotes) {
        return right.projectedVotes - left.projectedVotes;
      }

      return right.projectedPercentage - left.projectedPercentage;
    });

  const rank2Entry = voteEntries[1];
  const rank3Entry = voteEntries[2];

  const rank2 = rank2Entry
    ? {
      code: rank2Entry.code,
      label: labelByCode.get(rank2Entry.code) ?? "Sin dato",
      projectedVotes: rank2Entry.projectedVotes,
      projectedPercentage: rank2Entry.projectedPercentage
    }
    : null;
  const rank3 = rank3Entry
    ? {
      code: rank3Entry.code,
      label: labelByCode.get(rank3Entry.code) ?? "Sin dato",
      projectedVotes: rank3Entry.projectedVotes,
      projectedPercentage: rank3Entry.projectedPercentage
    }
    : null;

  const gapVotes2v3 = rank2 && rank3 ? rank2.projectedVotes - rank3.projectedVotes : null;
  const gapPp2v3 = rank2 && rank3 ? round(rank2.projectedPercentage - rank3.projectedPercentage) : null;
  const deltaProyeccionVotes =
    snapshot.projectedNational.totalProjectedValidVotes -
    (snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos);

  return {
    rank2,
    rank3,
    gapVotes2v3,
    gapPp2v3,
    actasPeruPct: snapshot.national.actasContabilizadasPct,
    actasExteriorPct: snapshot.foreign.actasContabilizadasPct,
    deltaProyeccionVotes,
    statusLevel: resolveSecondRoundStatusLevel(gapPp2v3)
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
  scope: ScopeResult | ProvinceResult | ForeignCountryResult,
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
