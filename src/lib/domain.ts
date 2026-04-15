import {
  FEATURED_CANDIDATE_CODES,
  STALE_AFTER_MINUTES
} from "./constants";
import type {
  AggregateResult,
  CandidateCatalogItem,
  CandidateResult,
  ElectionSnapshot,
  OnpeParticipant,
  OnpeTotals,
  ProjectedNationalSummary,
  ScopeMeta,
  ScopeResult
} from "./types";

type ScopeInput = {
  scopeId: string;
  kind: ScopeResult["kind"];
  label: string;
  electores: number;
  padronShare: number;
  totals: OnpeTotals;
  participants: OnpeParticipant[];
  candidateCatalog: Map<string, CandidateCatalogItem>;
};

function round(value: number, digits = 3) {
  return Number(value.toFixed(digits));
}

function normalizeCode(code: string | number) {
  return String(code);
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

export function buildScopeResult(input: ScopeInput): ScopeResult {
  const featuredCodes: string[] = [...FEATURED_CANDIDATE_CODES];
  const candidates = input.participants
    .map((participant) => normalizeCandidate(participant, input.candidateCatalog))
    .sort((left, right) => right.pctValid - left.pctValid);

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
        Math.round(input.electores * (candidate.pctValid / 100))
      ]),
      ["otros", Math.round(input.electores * (others.pctValid / 100))]
    ]
  );

  return {
    scopeId: input.scopeId,
    kind: input.kind,
    label: input.label,
    electores: input.electores,
    padronShare: input.padronShare,
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

export function buildProjectedNationalSummary(
  regions: ScopeResult[],
  foreign: ScopeResult,
  totalElectores: number
): ProjectedNationalSummary {
  const projectedVotes = FEATURED_CANDIDATE_CODES.reduce<Record<string, number>>(
    (acc, code) => {
      acc[code] =
        regions.reduce((sum, region) => sum + (region.projectedVotes[code] ?? 0), 0) +
        (foreign.projectedVotes[code] ?? 0);
      return acc;
    },
    {
      otros:
        regions.reduce((sum, region) => sum + (region.projectedVotes.otros ?? 0), 0) +
        (foreign.projectedVotes.otros ?? 0)
    }
  );

  const projectedPercentages = Object.fromEntries(
    Object.entries(projectedVotes).map(([code, votes]) => [
      code,
      round((votes / totalElectores) * 100)
    ])
  );

  return {
    totalElectores,
    projectedVotes,
    projectedPercentages
  };
}

export function computeIsStale(isoDate: string) {
  const minutes = (Date.now() - new Date(isoDate).getTime()) / 60000;
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
