import {
  FEATURED_CANDIDATE_LIMIT,
  STALE_AFTER_MINUTES
} from "./constants";
import type {
  AggregateResult,
  AnyScopeResult,
  BaseScopeResult,
  CandidateCatalogItem,
  CandidateResult,
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignResult,
  ForeignCountryResult,
  NationalResult,
  OnpeParticipant,
  OnpeTotals,
  ProvinceResult,
  ProjectedNationalSummary,
  RegionResult,
  ScopeMeta,
} from "./types";

type ParentScopeKind =
  | NationalResult["kind"]
  | RegionResult["kind"]
  | ForeignResult["kind"]
  | ForeignContinentResult["kind"];

type ScopeInput<TKind extends ParentScopeKind = ParentScopeKind> = {
  scopeId: string;
  kind: TKind;
  label: string;
  electores: number;
  padronShare: number;
  totals: OnpeTotals;
  participants: OnpeParticipant[];
  candidateCatalog: Map<string, CandidateCatalogItem>;
  featuredCodes?: string[];
};

type ProvinceInput = {
  scopeId: string;
  parentScopeId: string;
  label: string;
  totals: OnpeTotals;
  participants: OnpeParticipant[];
  candidateCatalog: Map<string, CandidateCatalogItem>;
  featuredCodes: string[];
};

type ForeignCountryInput = {
  scopeId: string;
  parentScopeId: string;
  label: string;
  totals: OnpeTotals;
  participants: OnpeParticipant[];
  candidateCatalog: Map<string, CandidateCatalogItem>;
  featuredCodes: string[];
};

type BuiltScopeCore = Omit<BaseScopeResult, "scopeId" | "kind" | "label">;

type BuiltElectorateScopeBase<TKind extends ParentScopeKind> = BuiltScopeCore & {
  scopeId: string;
  kind: TKind;
  label: string;
  electores: number;
  padronShare: number;
};

type NationalInput = Omit<ScopeInput<"national">, "kind">;
type RegionInput = Omit<ScopeInput<"department">, "kind"> & {
  provinces: ProvinceResult[];
};
type ForeignContinentInput = Omit<ScopeInput<"foreign_continent">, "kind"> & {
  countries: ForeignCountryResult[];
};
type ForeignInput = Omit<ScopeInput<"foreign_total">, "kind"> & {
  continents: ForeignContinentResult[];
};

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function normalizeCode(code: string | number) {
  return String(code);
}

function projectVotesByCountedActas(votesValid: number, actasContabilizadasPct: number) {
  const completionRatio = Math.min(Math.max(actasContabilizadasPct / 100, 0), 1);

  if (completionRatio === 0) {
    return 0;
  }

  return Math.round(votesValid / completionRatio);
}

function compareCandidatesByVotes(left: CandidateResult, right: CandidateResult) {
  return right.votesValid - left.votesValid;
}

export function buildCandidateCatalog(
  participants: OnpeParticipant[]
): Map<string, CandidateCatalogItem> {
  return new Map(
    participants.map((participant) => [
      normalizeCode(participant.codigoAgrupacionPolitica),
      {
        code: normalizeCode(participant.codigoAgrupacionPolitica),
        partyName: participant.nombreAgrupacionPolitica,
        candidateName: participant.nombreCandidato
      }
    ])
  );
}

export function normalizeCandidate(
  participant: OnpeParticipant,
  candidateCatalog: Map<string, CandidateCatalogItem>
): CandidateResult {
  const code = normalizeCode(participant.codigoAgrupacionPolitica);
  const catalog = candidateCatalog.get(code);

  return {
    code,
    partyName: catalog?.partyName ?? participant.nombreAgrupacionPolitica,
    candidateName: catalog?.candidateName ?? participant.nombreCandidato,
    votesValid: participant.totalVotosValidos,
    pctValid: round(participant.porcentajeVotosValidos),
    pctEmitted: round(participant.porcentajeVotosEmitidos)
  };
}

export function createCandidatePlaceholder(
  code: string,
  candidateCatalog: Map<string, CandidateCatalogItem>
): CandidateResult {
  const catalog = candidateCatalog.get(code);

  return {
    code,
    partyName: catalog?.partyName ?? "Sin dato",
    candidateName: catalog?.candidateName ?? "Sin dato",
    votesValid: 0,
    pctValid: 0,
    pctEmitted: 0
  };
}

export function summarizeOthers(candidates: CandidateResult[]): AggregateResult {
  return candidates.reduce<AggregateResult>(
    (acc, candidate) => ({
      code: "otros",
      label: "Otros",
      votesValid: acc.votesValid + candidate.votesValid,
      pctValid: round(acc.pctValid + candidate.pctValid),
      pctEmitted: round(acc.pctEmitted + candidate.pctEmitted)
    }),
    {
      code: "otros",
      label: "Otros",
      votesValid: 0,
      pctValid: 0,
      pctEmitted: 0
    }
  );
}

function buildScopeResultBase(input: {
  totals: OnpeTotals;
  participants: OnpeParticipant[];
  candidateCatalog: Map<string, CandidateCatalogItem>;
  featuredCodes?: string[];
}): BuiltScopeCore {
  const candidates = input.participants
    .map((participant) => normalizeCandidate(participant, input.candidateCatalog))
    .sort(compareCandidatesByVotes);
  const featuredCodes =
    input.featuredCodes && input.featuredCodes.length > 0
      ? [...input.featuredCodes]
      : candidates.slice(0, FEATURED_CANDIDATE_LIMIT).map((candidate) => candidate.code);

  const byCode = new Map(candidates.map((candidate) => [candidate.code, candidate]));

  const featuredCandidates = featuredCodes.map((code) =>
    byCode.get(code) ?? createCandidatePlaceholder(code, input.candidateCatalog)
  );

  const others = summarizeOthers(
    candidates.filter((candidate) => !featuredCodes.includes(candidate.code))
  );

  const projectedVotes = Object.fromEntries(
    [
      ...featuredCandidates.map((candidate) => [
        candidate.code,
        projectVotesByCountedActas(candidate.votesValid, input.totals.actasContabilizadas)
      ]),
      [
        "otros",
        projectVotesByCountedActas(others.votesValid, input.totals.actasContabilizadas)
      ]
    ]
  );

  return {
    actasContabilizadasPct: round(input.totals.actasContabilizadas),
    contabilizadas: input.totals.contabilizadas,
    totalActas: input.totals.totalActas,
    participacionCiudadanaPct: round(input.totals.participacionCiudadana),
    enviadasJee: input.totals.enviadasJee,
    pendientesJee: input.totals.pendientesJee,
    totalVotosEmitidos: input.totals.totalVotosEmitidos,
    totalVotosValidos: input.totals.totalVotosValidos,
    sourceUpdatedAt: new Date(input.totals.fechaActualizacion).toISOString(),
    candidates,
    featuredCandidates,
    otros: others,
    projectedVotes
  };
}

function buildElectorateScopeBase<TKind extends ParentScopeKind>(
  input: ScopeInput<TKind>
): BuiltElectorateScopeBase<TKind> {
  return {
    scopeId: input.scopeId,
    kind: input.kind,
    label: input.label,
    electores: input.electores,
    padronShare: input.padronShare,
    ...buildScopeResultBase(input)
  };
}

export function buildNationalResult(input: NationalInput): NationalResult {
  return {
    ...buildElectorateScopeBase({
      ...input,
      kind: "national"
    }),
    kind: "national"
  };
}

export function buildRegionResult(input: RegionInput): RegionResult {
  return {
    ...buildElectorateScopeBase({
      ...input,
      kind: "department"
    }),
    kind: "department",
    provinces: input.provinces
  };
}

export function buildForeignContinentResult(
  input: ForeignContinentInput
): ForeignContinentResult {
  return {
    ...buildElectorateScopeBase({
      ...input,
      kind: "foreign_continent"
    }),
    kind: "foreign_continent",
    countries: input.countries
  };
}

export function buildForeignResult(input: ForeignInput): ForeignResult {
  return {
    ...buildElectorateScopeBase({
      ...input,
      kind: "foreign_total"
    }),
    kind: "foreign_total",
    continents: input.continents
  };
}

export function buildProvinceResult(input: ProvinceInput): ProvinceResult {
  return {
    scopeId: input.scopeId,
    parentScopeId: input.parentScopeId,
    kind: "province",
    label: input.label,
    ...buildScopeResultBase(input)
  };
}

export function buildForeignCountryResult(
  input: ForeignCountryInput
): ForeignCountryResult {
  return {
    scopeId: input.scopeId,
    parentScopeId: input.parentScopeId,
    kind: "foreign_country",
    label: input.label,
    ...buildScopeResultBase(input)
  };
}

export function sumProjectedVotes(
  scopes: Array<Pick<AnyScopeResult, "projectedVotes">>,
  featuredCodes: string[]
) {
  return featuredCodes.reduce<Record<string, number>>(
    (acc, code) => {
      acc[code] = scopes.reduce((sum, scope) => sum + (scope.projectedVotes[code] ?? 0), 0);
      return acc;
    },
    {
      otros: scopes.reduce((sum, scope) => sum + (scope.projectedVotes.otros ?? 0), 0)
    }
  );
}

export function buildProjectedNationalSummary(
  regions: RegionResult[],
  foreign: ForeignResult,
  totalElectores: number,
  featuredCodes: string[]
): ProjectedNationalSummary {
  const projectedVotes = sumProjectedVotes([...regions, foreign], featuredCodes);
  const totalProjectedValidVotes = Object.values(projectedVotes).reduce(
    (sum, votes) => sum + votes,
    0
  );

  const projectedPercentages = Object.fromEntries(
    Object.entries(projectedVotes).map(([code, votes]) => [
      code,
      totalProjectedValidVotes > 0 ? round((votes / totalProjectedValidVotes) * 100) : 0
    ])
  );

  return {
    totalElectores,
    totalProjectedValidVotes,
    projectedVotes,
    projectedPercentages
  };
}

export function computeIsStale(isoDate: string, now = Date.now()) {
  const minutes = (now - new Date(isoDate).getTime()) / 60000;
  return minutes > STALE_AFTER_MINUTES;
}

export function summarizeSourceFreshness(snapshot: ElectionSnapshot) {
  const diffMs = Date.now() - new Date(snapshot.sourceLastUpdatedAt).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export function getScopeMetaTotals(scopes: ScopeMeta[]) {
  const peruScopes = scopes.filter((scope) => scope.kind === "department");
  const peruElectores = peruScopes.reduce((sum, scope) => sum + scope.electores, 0);
  const totalElectores = scopes.reduce((sum, scope) => sum + scope.electores, 0);

  return {
    peruElectores,
    totalElectores
  };
}
