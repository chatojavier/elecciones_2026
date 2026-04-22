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

export interface ComparisonPair {
  candidateACode: string;
  candidateBCode: string;
}

export type ComparisonPairInitSource = "default_rank_2v3" | "fallback";

export interface ComparisonPairResolution {
  pair: ComparisonPair;
  initSource: ComparisonPairInitSource;
  status: "initialized" | "preserved" | "reassigned";
}

export interface ComparisonCandidateOption {
  code: string;
  label: string;
}

export interface ComparisonGap {
  gapVotes: number;
  gapPercentage: number;
}

export type SecondRoundStatusLevel = "stable" | "tight" | "very_tight" | "unknown";

export interface SecondRoundCandidate {
  code: string;
  label: string;
  projectedVotes: number;
  projectedPercentage: number;
}

export interface SecondRoundInsight {
  rank1: SecondRoundCandidate | null;
  rank2: SecondRoundCandidate | null;
  rank3: SecondRoundCandidate | null;
  gapVotes2v3: number | null;
  gapPp2v3: number | null;
  actasPeruPct: number;
  actasExteriorPct: number;
  deltaProyeccionVotes: number;
  statusLevel: SecondRoundStatusLevel;
}

type ComparableScope = ScopeResult | ProvinceResult | ForeignCountryResult;

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

function buildCandidateLabelMap(snapshot: ElectionSnapshot) {
  const labels = new Map<string, string>();
  const hasFullNationalCandidates = snapshot.national.candidates.length > 0;
  const hasFullForeignCandidates = snapshot.foreign.candidates.length > 0;
  const useFullCandidates = hasFullNationalCandidates && hasFullForeignCandidates;
  const candidates = useFullCandidates
    ? [...snapshot.national.candidates, ...snapshot.foreign.candidates]
    : [...snapshot.national.featuredCandidates, ...snapshot.foreign.featuredCandidates];

  for (const candidate of candidates) {
    if (candidate.code === "otros" || labels.has(candidate.code)) {
      continue;
    }

    labels.set(candidate.code, candidate.candidateName);
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

function findScopeCandidate(scope: ComparableScope, code: string) {
  return scope.candidates.find((item) => item.code === code) ??
    scope.featuredCandidates.find((item) => item.code === code) ??
    null;
}

function resolveScopeProjectedVotes(scope: ComparableScope, code: string) {
  const projectedFromScope = scope.projectedVotes[code];
  if (typeof projectedFromScope === "number") {
    return projectedFromScope;
  }

  const candidate = findScopeCandidate(scope, code);
  if (!candidate) {
    return 0;
  }

  return projectVotesByCountedActas(candidate.votesValid, scope.actasContabilizadasPct);
}

function getScopeActualVotesByCode(scope: ComparableScope, code: string) {
  if (code === "otros") {
    return scope.otros.votesValid;
  }

  return findScopeCandidate(scope, code)?.votesValid ?? 0;
}

function getScopeActualPercentageByCode(scope: ComparableScope, code: string) {
  if (code === "otros") {
    return scope.otros.pctValid;
  }

  return findScopeCandidate(scope, code)?.pctValid ?? 0;
}

function getScopeProjectedTotalVotes(scope: ComparableScope) {
  return Object.values(scope.projectedVotes).reduce((sum, votes) => sum + votes, 0);
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

function buildProjectedVoteEntries(snapshot: ElectionSnapshot): SecondRoundCandidate[] {
  const labelByCode = buildCandidateLabelMap(snapshot);
  const projectedVotesByCode = new Map<string, number>();
  const hasRegionalCandidateData = snapshot.regions.some((region) => region.candidates.length > 0);

  if (hasRegionalCandidateData) {
    for (const region of snapshot.regions) {
      addProjectedVotesFromScope(projectedVotesByCode, region);
    }

    addProjectedVotesFromScope(projectedVotesByCode, snapshot.foreign);
  } else {
    addProjectedVotesFromScope(projectedVotesByCode, snapshot.national);
    addProjectedVotesFromScope(projectedVotesByCode, snapshot.foreign);
  }

  if (projectedVotesByCode.size < 3) {
    for (const [code, projectedVotes] of Object.entries(snapshot.projectedNational.projectedVotes)) {
      if (code === "otros" || projectedVotesByCode.has(code)) {
        continue;
      }

      projectedVotesByCode.set(code, projectedVotes);
    }
  }

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

  return Array.from(projectedVotesByCode.entries())
    .map(([code, projectedVotes]) => {
      const projectedVotesFromSnapshot = snapshot.projectedNational.projectedVotes[code];
      const projectedPercentageFromSnapshot = snapshot.projectedNational.projectedPercentages[code];
      const resolvedProjectedVotes =
        typeof projectedVotesFromSnapshot === "number"
          ? projectedVotesFromSnapshot
          : projectedVotes;

      return {
        code,
        label: labelByCode.get(code) ?? "Sin dato",
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
}

function buildSelectableProjectedVoteEntries(snapshot: ElectionSnapshot) {
  const labelByCode = buildCandidateLabelMap(snapshot);

  return buildProjectedVoteEntries(snapshot).filter((candidate) => labelByCode.has(candidate.code));
}

function chooseFallbackCode(
  candidates: ComparisonCandidateOption[],
  excludedCodes: string[]
) {
  const excluded = new Set(excludedCodes.filter(Boolean));

  return candidates.find((candidate) => !excluded.has(candidate.code))?.code ?? "";
}

function resolvePairInitSource(
  rankedCandidates: SecondRoundCandidate[],
  pair: ComparisonPair
): ComparisonPairInitSource {
  const rank2 = rankedCandidates[1];
  const rank3 = rankedCandidates[2];

  if (
    rank2 &&
    rank3 &&
    pair.candidateACode === rank2.code &&
    pair.candidateBCode === rank3.code
  ) {
    return "default_rank_2v3";
  }

  return "fallback";
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

export function buildComparisonCandidateOptions(
  snapshot: ElectionSnapshot
): ComparisonCandidateOption[] {
  return buildSelectableProjectedVoteEntries(snapshot).map((candidate) => ({
    code: candidate.code,
    label: candidate.label
  }));
}

export function resolveDefaultComparisonPair(
  snapshot: ElectionSnapshot
): ComparisonPairResolution {
  const rankedCandidates = buildSelectableProjectedVoteEntries(snapshot);
  const defaultRank2 = rankedCandidates[1];
  const defaultRank3 = rankedCandidates[2];
  const fallbackA = rankedCandidates[0];
  const fallbackB = rankedCandidates[1];

  const pair: ComparisonPair =
    defaultRank2 && defaultRank3
      ? {
        candidateACode: defaultRank2.code,
        candidateBCode: defaultRank3.code
      }
      : {
        candidateACode: fallbackA?.code ?? "",
        candidateBCode: fallbackB?.code ?? ""
      };

  return {
    pair,
    initSource: resolvePairInitSource(rankedCandidates, pair),
    status: "initialized"
  };
}

export function reconcileComparisonPair(
  snapshot: ElectionSnapshot,
  pair: ComparisonPair
): ComparisonPairResolution {
  const candidates = buildComparisonCandidateOptions(snapshot);
  const candidateCodes = new Set(candidates.map((candidate) => candidate.code));
  const hasA = candidateCodes.has(pair.candidateACode);
  const hasB = candidateCodes.has(pair.candidateBCode);
  const isDistinct = Boolean(pair.candidateACode) && pair.candidateACode !== pair.candidateBCode;

  if (hasA && hasB && isDistinct) {
    return {
      pair,
      initSource: resolvePairInitSource(buildSelectableProjectedVoteEntries(snapshot), pair),
      status: "preserved"
    };
  }

  let candidateACode = hasA ? pair.candidateACode : "";
  let candidateBCode = hasB ? pair.candidateBCode : "";

  if (!candidateACode || candidateACode === candidateBCode) {
    candidateACode = chooseFallbackCode(candidates, [candidateBCode]);
  }

  if (!candidateBCode || candidateACode === candidateBCode) {
    candidateBCode = chooseFallbackCode(candidates, [candidateACode]);
  }

  const resolvedPair = {
    candidateACode,
    candidateBCode
  };

  return {
    pair: resolvedPair,
    initSource: resolvePairInitSource(buildSelectableProjectedVoteEntries(snapshot), resolvedPair),
    status: "reassigned"
  };
}

export function buildSecondRoundInsight(snapshot: ElectionSnapshot): SecondRoundInsight {
  const voteEntries = buildProjectedVoteEntries(snapshot);
  const rank1 = voteEntries[0] ?? null;
  const rank2 = voteEntries[1] ?? null;
  const rank3 = voteEntries[2] ?? null;
  const gapVotes2v3 = rank2 && rank3 ? rank2.projectedVotes - rank3.projectedVotes : null;
  const gapPp2v3 = rank2 && rank3 ? round(rank2.projectedPercentage - rank3.projectedPercentage) : null;
  const deltaProyeccionVotes =
    snapshot.projectedNational.totalProjectedValidVotes -
    (snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos);

  return {
    rank1,
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

function getNationalActualVotesByCode(snapshot: ElectionSnapshot, code: string) {
  if (code === "otros") {
    return snapshot.national.otros.votesValid + snapshot.foreign.otros.votesValid;
  }

  const nationalCandidates =
    snapshot.national.candidates.length > 0
      ? snapshot.national.candidates
      : snapshot.national.featuredCandidates;
  const foreignCandidates =
    snapshot.foreign.candidates.length > 0
      ? snapshot.foreign.candidates
      : snapshot.foreign.featuredCandidates;

  return [...nationalCandidates, ...foreignCandidates]
    .filter((candidate) => candidate.code === code)
    .reduce((sum, candidate) => sum + candidate.votesValid, 0);
}

function getNationalProjectedVotesByCode(snapshot: ElectionSnapshot, code: string) {
  if (typeof snapshot.projectedNational.projectedVotes[code] === "number") {
    return snapshot.projectedNational.projectedVotes[code] ?? 0;
  }

  const rankedCandidate = buildProjectedVoteEntries(snapshot).find((candidate) => candidate.code === code);

  return rankedCandidate?.projectedVotes ?? 0;
}

function getCandidateLabel(snapshot: ElectionSnapshot, code: string) {
  if (code === "otros") {
    return "Otros";
  }

  return buildCandidateLabelMap(snapshot).get(code) ?? "Sin dato";
}

export function buildNationalComparisonItem(
  snapshot: ElectionSnapshot,
  code: string
): ComparisonItem {
  const totalCurrentValidVotes = snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos;
  const totalProjectedValidVotes = snapshot.projectedNational.totalProjectedValidVotes;
  const actualVotes = getNationalActualVotesByCode(snapshot, code);
  const projectedVotes = getNationalProjectedVotesByCode(snapshot, code);

  return createComparisonItem({
    code,
    label: getCandidateLabel(snapshot, code),
    actualVotes,
    actualPercentage: calculatePercentage(actualVotes, totalCurrentValidVotes),
    projectedVotes,
    projectedPercentage:
      typeof snapshot.projectedNational.projectedPercentages[code] === "number"
        ? snapshot.projectedNational.projectedPercentages[code] ?? 0
        : calculatePercentage(projectedVotes, totalProjectedValidVotes)
  });
}

export function buildNationalComparisonItems(snapshot: ElectionSnapshot) {
  return [
    ...snapshot.national.featuredCandidates.map((candidate) =>
      buildNationalComparisonItem(snapshot, candidate.code)
    ),
    buildNationalComparisonItem(snapshot, "otros")
  ];
}

export function buildNationalComparisonPairItems(
  snapshot: ElectionSnapshot,
  pair: ComparisonPair
) {
  return [pair.candidateACode, pair.candidateBCode]
    .filter(Boolean)
    .map((code) => buildNationalComparisonItem(snapshot, code));
}

export function buildComparisonOthersBar(
  snapshot: ElectionSnapshot,
  excludedCodes: string[]
) {
  const baseOthersBar = buildNationalComparisonItem(snapshot, "otros");
  const codesToExclude = excludedCodes.filter(
    (code) => code && code !== "otros" && !snapshot.featuredCandidateCodes.includes(code)
  );

  if (codesToExclude.length === 0) {
    return baseOthersBar;
  }

  const actualVotes = Math.max(
    0,
    baseOthersBar.actualVotes -
      codesToExclude.reduce((sum, code) => sum + getNationalActualVotesByCode(snapshot, code), 0)
  );
  const projectedVotes = Math.max(
    0,
    baseOthersBar.projectedVotes -
      codesToExclude.reduce((sum, code) => sum + getNationalProjectedVotesByCode(snapshot, code), 0)
  );

  if (actualVotes === 0 && projectedVotes === 0) {
    return null;
  }

  const totalCurrentValidVotes = snapshot.national.totalVotosValidos + snapshot.foreign.totalVotosValidos;
  const totalProjectedValidVotes = snapshot.projectedNational.totalProjectedValidVotes;

  return createComparisonItem({
    code: "otros",
    label: "Otros",
    actualVotes,
    actualPercentage: calculatePercentage(actualVotes, totalCurrentValidVotes),
    projectedVotes,
    projectedPercentage: calculatePercentage(projectedVotes, totalProjectedValidVotes)
  });
}

export function buildScopeComparisonItem(
  scope: ComparableScope,
  selectedCode: string
): ComparisonItem {
  return createComparisonItem({
    code: selectedCode,
    label: selectedCode === "otros" ? "Otros" : findScopeCandidate(scope, selectedCode)?.candidateName ?? "Sin dato",
    actualVotes: getScopeActualVotesByCode(scope, selectedCode),
    actualPercentage: getScopeActualPercentageByCode(scope, selectedCode),
    projectedVotes: resolveScopeProjectedVotes(scope, selectedCode),
    projectedPercentage:
      selectedCode === "otros"
        ? calculateProjectedPercentage(scope.projectedVotes, "otros")
        : calculateProjectedPercentage(
            {
              ...scope.projectedVotes,
              [selectedCode]: resolveScopeProjectedVotes(scope, selectedCode)
            },
            selectedCode
          )
  });
}

export function getScopeComparisonGap(
  scope: ComparableScope,
  pair: ComparisonPair,
  comparisonMode: ComparisonMode
): ComparisonGap {
  const candidateAVotes =
    comparisonMode === "projected"
      ? resolveScopeProjectedVotes(scope, pair.candidateACode)
      : getScopeActualVotesByCode(scope, pair.candidateACode);
  const candidateBVotes =
    comparisonMode === "projected"
      ? resolveScopeProjectedVotes(scope, pair.candidateBCode)
      : getScopeActualVotesByCode(scope, pair.candidateBCode);
  const totalVotes =
    comparisonMode === "projected" ? getScopeProjectedTotalVotes(scope) : scope.totalVotosValidos;
  const gapVotes = candidateAVotes - candidateBVotes;
  const gapPercentage = totalVotes > 0 ? Number(((gapVotes / totalVotes) * 100).toFixed(3)) : 0;

  return {
    gapVotes,
    gapPercentage
  };
}
