export type ScopeKind =
  | "national"
  | "department"
  | "province"
  | "foreign_total"
  | "foreign_continent"
  | "foreign_country";
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

export interface OnpeProvince {
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
  kind: "national" | "department" | "foreign_total" | "foreign_continent";
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

export interface ProvinceResult {
  scopeId: string;
  parentScopeId: string;
  kind: "province";
  label: string;
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

export interface ForeignCountryResult {
  scopeId: string;
  parentScopeId: string;
  kind: "foreign_country";
  label: string;
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

export interface RegionResult extends ScopeResult {
  kind: "department";
  provinces: ProvinceResult[];
}

export interface ForeignContinentResult extends ScopeResult {
  kind: "foreign_continent";
  countries: ForeignCountryResult[];
}

export interface ForeignResult extends ScopeResult {
  kind: "foreign_total";
  continents: ForeignContinentResult[];
}

export interface ProjectedNationalSummary {
  totalElectores: number;
  totalProjectedValidVotes: number;
  projectedVotes: Record<string, number>;
  projectedPercentages: Record<string, number>;
}

export interface ElectionSnapshot {
  generatedAt: string;
  sourceElectionId: number;
  sourceLastUpdatedAt: string;
  national: ScopeResult;
  foreign: ForeignResult;
  regions: RegionResult[];
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
