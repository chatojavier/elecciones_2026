export type ScopeKind = "national" | "department" | "foreign_total";
export type HealthStatusKind = "healthy" | "degraded" | "unknown";

export interface ScopeMeta {
  scopeId: string;
  kind: "department" | "foreign_total";
  label: string;
  electores: number;
  padronShare: number;
  displayOrder: number;
}

export interface OnpeEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface OnpeDepartment {
  ubigeo: string;
  nombre: string;
}

export interface OnpeTotals {
  actasContabilizadas: number;
  contabilizadas: number;
  totalActas: number;
  participacionCiudadana: number;
  actasEnviadasJee: number;
  enviadasJee: number;
  actasPendientesJee: number;
  pendientesJee: number;
  fechaActualizacion: number;
  idUbigeoDepartamento: number;
  idUbigeoProvincia: number;
  idUbigeoDistrito: number;
  idUbigeoDistritoElectoral: number;
  totalVotosEmitidos: number;
  totalVotosValidos: number;
  porcentajeVotosEmitidos: number;
  porcentajeVotosValidos: number;
}

export interface OnpeParticipant {
  nombreAgrupacionPolitica: string;
  codigoAgrupacionPolitica: string | number;
  nombreCandidato: string;
  dniCandidato: string;
  totalVotosValidos: number;
  porcentajeVotosValidos: number;
  porcentajeVotosEmitidos: number;
}

export interface CandidateCatalogItem {
  code: string;
  partyName: string;
  candidateName: string;
}

export interface CandidateResult {
  code: string;
  partyName: string;
  candidateName: string;
  votesValid: number;
  pctValid: number;
  pctEmitted: number;
}

export interface AggregateResult {
  code: "otros";
  label: string;
  votesValid: number;
  pctValid: number;
  pctEmitted: number;
}

export interface ScopeResult {
  scopeId: string;
  kind: ScopeKind;
  label: string;
  electores: number;
  padronShare: number;
  actasContabilizadasPct: number;
  contabilizadas: number;
  totalActas: number;
  participacionCiudadanaPct: number;
  enviadasJee: number;
  pendientesJee: number;
  totalVotosEmitidos: number;
  totalVotosValidos: number;
  sourceUpdatedAt: string;
  candidates: CandidateResult[];
  featuredCandidates: CandidateResult[];
  otros: AggregateResult;
  projectedVotes: Record<string, number>;
}

export interface ProjectedNationalSummary {
  totalElectores: number;
  projectedVotes: Record<string, number>;
  projectedPercentages: Record<string, number>;
}

export interface ElectionSnapshot {
  generatedAt: string;
  sourceElectionId: number;
  sourceLastUpdatedAt: string;
  national: ScopeResult;
  foreign: ScopeResult;
  regions: ScopeResult[];
  projectedNational: ProjectedNationalSummary;
  featuredCandidateCodes: string[];
  isStale: boolean;
}

export interface HealthStatus {
  status: HealthStatusKind;
  source: "onpe";
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  staleMinutes: number | null;
  lastError: string | null;
}
