import { normalizeElectionSnapshot } from "./normalizeSnapshot";
import type {
  AggregateResult,
  CandidateResult,
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignCountryResult,
  ForeignResult,
  HealthStatus,
  OnpeDepartment,
  OnpeEnvelope,
  OnpeParticipant,
  OnpeProvince,
  OnpeTotals,
  ProjectedNationalSummary,
  ProvinceResult,
  RegionResult,
  ScopeResult
} from "./types";

type JsonRecord = Record<string, unknown>;
type CommonResultKind =
  | ScopeResult["kind"]
  | ProvinceResult["kind"]
  | ForeignCountryResult["kind"];

export class DataContractError extends Error {
  source: string;
  path: string;

  constructor(source: string, path: string, detail: string) {
    super(`[${source}] contrato inválido en ${path}: ${detail}`);
    this.name = "DataContractError";
    this.source = source;
    this.path = path;
  }
}

function joinPath(path: string, key: string) {
  return path === "$" ? key : `${path}.${key}`;
}

function fail(source: string, path: string, detail: string): never {
  throw new DataContractError(source, path, detail);
}

function asRecord(value: unknown, source: string, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(source, path, "se esperaba un objeto JSON");
  }

  return value as JsonRecord;
}

function readRequired(record: JsonRecord, key: string, source: string, path: string) {
  if (!Object.hasOwn(record, key)) {
    fail(source, joinPath(path, key), "campo requerido ausente");
  }

  return record[key];
}

function parseString(value: unknown, source: string, path: string) {
  if (typeof value !== "string") {
    fail(source, path, "se esperaba string");
  }

  return value;
}

function parseBoolean(value: unknown, source: string, path: string) {
  if (typeof value !== "boolean") {
    fail(source, path, "se esperaba boolean");
  }

  return value;
}

function parseFiniteNumber(value: unknown, source: string, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(source, path, "se esperaba number finito");
  }

  return value;
}

function parseIsoDateString(value: unknown, source: string, path: string) {
  const iso = parseString(value, source, path);

  if (Number.isNaN(Date.parse(iso))) {
    fail(source, path, "se esperaba fecha ISO válida");
  }

  return iso;
}

function parseNullableString(value: unknown, source: string, path: string) {
  if (value == null) {
    return null;
  }

  return parseString(value, source, path);
}

function parseNullableIsoDateString(value: unknown, source: string, path: string) {
  if (value == null) {
    return null;
  }

  return parseIsoDateString(value, source, path);
}

function parseNullableFiniteNumber(value: unknown, source: string, path: string) {
  if (value == null) {
    return null;
  }

  return parseFiniteNumber(value, source, path);
}

function parseStringOrNumber(value: unknown, source: string, path: string) {
  if (typeof value !== "string" && typeof value !== "number") {
    fail(source, path, "se esperaba string o number");
  }

  return value;
}

function parseLiteral<T extends string>(value: unknown, expected: T, source: string, path: string) {
  if (value !== expected) {
    fail(source, path, `se esperaba ${expected}`);
  }

  return expected;
}

function parseStringArray(value: unknown, source: string, path: string) {
  if (!Array.isArray(value)) {
    fail(source, path, "se esperaba arreglo");
  }

  return value.map((item, index) => parseString(item, source, `${path}[${index}]`));
}

function parseArray<T>(
  value: unknown,
  itemParser: (value: unknown, source: string, path: string) => T,
  source: string,
  path: string
) {
  if (!Array.isArray(value)) {
    fail(source, path, "se esperaba arreglo");
  }

  return value.map((item, index) => itemParser(item, source, `${path}[${index}]`));
}

function parseNumberRecord(value: unknown, source: string, path: string) {
  const record = asRecord(value, source, path);

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      parseFiniteNumber(entry, source, joinPath(path, key))
    ])
  );
}

function parseCandidateResult(
  value: unknown,
  source: string,
  path: string
): CandidateResult {
  const record = asRecord(value, source, path);

  return {
    code: parseString(readRequired(record, "code", source, path), source, joinPath(path, "code")),
    partyName: parseString(
      readRequired(record, "partyName", source, path),
      source,
      joinPath(path, "partyName")
    ),
    candidateName: parseString(
      readRequired(record, "candidateName", source, path),
      source,
      joinPath(path, "candidateName")
    ),
    votesValid: parseFiniteNumber(
      readRequired(record, "votesValid", source, path),
      source,
      joinPath(path, "votesValid")
    ),
    pctValid: parseFiniteNumber(
      readRequired(record, "pctValid", source, path),
      source,
      joinPath(path, "pctValid")
    ),
    pctEmitted: parseFiniteNumber(
      readRequired(record, "pctEmitted", source, path),
      source,
      joinPath(path, "pctEmitted")
    )
  };
}

function parseAggregateResult(
  value: unknown,
  source: string,
  path: string
): AggregateResult {
  const record = asRecord(value, source, path);

  return {
    code: parseLiteral(
      readRequired(record, "code", source, path),
      "otros",
      source,
      joinPath(path, "code")
    ),
    label: parseString(
      readRequired(record, "label", source, path),
      source,
      joinPath(path, "label")
    ),
    votesValid: parseFiniteNumber(
      readRequired(record, "votesValid", source, path),
      source,
      joinPath(path, "votesValid")
    ),
    pctValid: parseFiniteNumber(
      readRequired(record, "pctValid", source, path),
      source,
      joinPath(path, "pctValid")
    ),
    pctEmitted: parseFiniteNumber(
      readRequired(record, "pctEmitted", source, path),
      source,
      joinPath(path, "pctEmitted")
    )
  };
}

function parseCommonScopeFields<K extends CommonResultKind>(
  record: JsonRecord,
  expectedKind: K,
  source: string,
  path: string
): {
  scopeId: string;
  kind: K;
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
} {
  return {
    scopeId: parseString(
      readRequired(record, "scopeId", source, path),
      source,
      joinPath(path, "scopeId")
    ),
    kind: parseLiteral(
      readRequired(record, "kind", source, path),
      expectedKind,
      source,
      joinPath(path, "kind")
    ),
    label: parseString(
      readRequired(record, "label", source, path),
      source,
      joinPath(path, "label")
    ),
    actasContabilizadasPct: parseFiniteNumber(
      readRequired(record, "actasContabilizadasPct", source, path),
      source,
      joinPath(path, "actasContabilizadasPct")
    ),
    contabilizadas: parseFiniteNumber(
      readRequired(record, "contabilizadas", source, path),
      source,
      joinPath(path, "contabilizadas")
    ),
    totalActas: parseFiniteNumber(
      readRequired(record, "totalActas", source, path),
      source,
      joinPath(path, "totalActas")
    ),
    participacionCiudadanaPct: parseFiniteNumber(
      readRequired(record, "participacionCiudadanaPct", source, path),
      source,
      joinPath(path, "participacionCiudadanaPct")
    ),
    enviadasJee: parseFiniteNumber(
      readRequired(record, "enviadasJee", source, path),
      source,
      joinPath(path, "enviadasJee")
    ),
    pendientesJee: parseFiniteNumber(
      readRequired(record, "pendientesJee", source, path),
      source,
      joinPath(path, "pendientesJee")
    ),
    totalVotosEmitidos: parseFiniteNumber(
      readRequired(record, "totalVotosEmitidos", source, path),
      source,
      joinPath(path, "totalVotosEmitidos")
    ),
    totalVotosValidos: parseFiniteNumber(
      readRequired(record, "totalVotosValidos", source, path),
      source,
      joinPath(path, "totalVotosValidos")
    ),
    sourceUpdatedAt: parseIsoDateString(
      readRequired(record, "sourceUpdatedAt", source, path),
      source,
      joinPath(path, "sourceUpdatedAt")
    ),
    candidates: parseArray(
      readRequired(record, "candidates", source, path),
      parseCandidateResult,
      source,
      joinPath(path, "candidates")
    ),
    featuredCandidates: parseArray(
      readRequired(record, "featuredCandidates", source, path),
      parseCandidateResult,
      source,
      joinPath(path, "featuredCandidates")
    ),
    otros: parseAggregateResult(
      readRequired(record, "otros", source, path),
      source,
      joinPath(path, "otros")
    ),
    projectedVotes: parseNumberRecord(
      readRequired(record, "projectedVotes", source, path),
      source,
      joinPath(path, "projectedVotes")
    )
  };
}

function parseScopeResultValue<K extends ScopeResult["kind"]>(
  value: unknown,
  expectedKind: K,
  source: string,
  path: string
): Omit<ScopeResult, "kind"> & { kind: K } {
  const record = asRecord(value, source, path);

  return {
    ...parseCommonScopeFields(record, expectedKind, source, path),
    electores: parseFiniteNumber(
      readRequired(record, "electores", source, path),
      source,
      joinPath(path, "electores")
    ),
    padronShare: parseFiniteNumber(
      readRequired(record, "padronShare", source, path),
      source,
      joinPath(path, "padronShare")
    )
  };
}

function parseProvinceResultValue(
  value: unknown,
  source: string,
  path: string
): ProvinceResult {
  const record = asRecord(value, source, path);

  return {
    ...parseCommonScopeFields(record, "province", source, path),
    parentScopeId: parseString(
      readRequired(record, "parentScopeId", source, path),
      source,
      joinPath(path, "parentScopeId")
    )
  };
}

function parseForeignCountryResultValue(
  value: unknown,
  source: string,
  path: string
): ForeignCountryResult {
  const record = asRecord(value, source, path);

  return {
    ...parseCommonScopeFields(record, "foreign_country", source, path),
    parentScopeId: parseString(
      readRequired(record, "parentScopeId", source, path),
      source,
      joinPath(path, "parentScopeId")
    )
  };
}

function parseRegionResultValue(
  value: unknown,
  source: string,
  path: string
): RegionResult {
  const record = asRecord(value, source, path);

  return {
    ...parseScopeResultValue(record, "department", source, path),
    kind: "department",
    provinces: parseArray(
      readRequired(record, "provinces", source, path),
      parseProvinceResultValue,
      source,
      joinPath(path, "provinces")
    )
  };
}

function parseForeignContinentResultValue(
  value: unknown,
  source: string,
  path: string
): ForeignContinentResult {
  const record = asRecord(value, source, path);
  const countriesPath = joinPath(path, "countries");

  return {
    ...parseScopeResultValue(record, "foreign_continent", source, path),
    kind: "foreign_continent",
    countries: Object.hasOwn(record, "countries")
      ? parseArray(record.countries, parseForeignCountryResultValue, source, countriesPath)
      : []
  };
}

function parseForeignResultValue(
  value: unknown,
  source: string,
  path: string
): ForeignResult {
  const record = asRecord(value, source, path);
  const continentsPath = joinPath(path, "continents");

  return {
    ...parseScopeResultValue(record, "foreign_total", source, path),
    kind: "foreign_total",
    continents: Object.hasOwn(record, "continents")
      ? parseArray(record.continents, parseForeignContinentResultValue, source, continentsPath)
      : []
  };
}

function parseProjectedNationalSummaryValue(
  value: unknown,
  source: string,
  path: string
): ProjectedNationalSummary {
  const record = asRecord(value, source, path);

  return {
    totalElectores: parseFiniteNumber(
      readRequired(record, "totalElectores", source, path),
      source,
      joinPath(path, "totalElectores")
    ),
    totalProjectedValidVotes: parseFiniteNumber(
      readRequired(record, "totalProjectedValidVotes", source, path),
      source,
      joinPath(path, "totalProjectedValidVotes")
    ),
    projectedVotes: parseNumberRecord(
      readRequired(record, "projectedVotes", source, path),
      source,
      joinPath(path, "projectedVotes")
    ),
    projectedPercentages: parseNumberRecord(
      readRequired(record, "projectedPercentages", source, path),
      source,
      joinPath(path, "projectedPercentages")
    )
  };
}

export function parseElectionSnapshot(
  value: unknown,
  source = "snapshot",
  path = "$"
): ElectionSnapshot {
  const record = asRecord(value, source, path);

  const snapshot: ElectionSnapshot = {
    generatedAt: parseIsoDateString(
      readRequired(record, "generatedAt", source, path),
      source,
      joinPath(path, "generatedAt")
    ),
    sourceElectionId: parseFiniteNumber(
      readRequired(record, "sourceElectionId", source, path),
      source,
      joinPath(path, "sourceElectionId")
    ),
    sourceLastUpdatedAt: parseIsoDateString(
      readRequired(record, "sourceLastUpdatedAt", source, path),
      source,
      joinPath(path, "sourceLastUpdatedAt")
    ),
    national: parseScopeResultValue(
      readRequired(record, "national", source, path),
      "national",
      source,
      joinPath(path, "national")
    ),
    foreign: parseForeignResultValue(
      readRequired(record, "foreign", source, path),
      source,
      joinPath(path, "foreign")
    ),
    regions: parseArray(
      readRequired(record, "regions", source, path),
      parseRegionResultValue,
      source,
      joinPath(path, "regions")
    ),
    projectedNational: parseProjectedNationalSummaryValue(
      readRequired(record, "projectedNational", source, path),
      source,
      joinPath(path, "projectedNational")
    ),
    featuredCandidateCodes: parseStringArray(
      readRequired(record, "featuredCandidateCodes", source, path),
      source,
      joinPath(path, "featuredCandidateCodes")
    ),
    isStale: parseBoolean(
      readRequired(record, "isStale", source, path),
      source,
      joinPath(path, "isStale")
    )
  };

  return normalizeElectionSnapshot(snapshot);
}

export function parseHealthStatus(
  value: unknown,
  source = "health",
  path = "$"
): HealthStatus {
  const record = asRecord(value, source, path);

  return {
    status: (() => {
      const status = parseString(
        readRequired(record, "status", source, path),
        source,
        joinPath(path, "status")
      );

      if (status !== "healthy" && status !== "degraded" && status !== "unknown") {
        fail(source, joinPath(path, "status"), "se esperaba healthy, degraded o unknown");
      }

      return status;
    })(),
    source: parseLiteral(
      readRequired(record, "source", source, path),
      "onpe",
      source,
      joinPath(path, "source")
    ),
    lastSyncAt: parseNullableIsoDateString(
      readRequired(record, "lastSyncAt", source, path),
      source,
      joinPath(path, "lastSyncAt")
    ),
    lastSuccessAt: parseNullableIsoDateString(
      readRequired(record, "lastSuccessAt", source, path),
      source,
      joinPath(path, "lastSuccessAt")
    ),
    staleMinutes: parseNullableFiniteNumber(
      readRequired(record, "staleMinutes", source, path),
      source,
      joinPath(path, "staleMinutes")
    ),
    lastError: parseNullableString(
      readRequired(record, "lastError", source, path),
      source,
      joinPath(path, "lastError")
    )
  };
}

function parseOnpeDepartmentValue(
  value: unknown,
  source: string,
  path: string
): OnpeDepartment {
  const record = asRecord(value, source, path);

  return {
    ubigeo: parseString(
      readRequired(record, "ubigeo", source, path),
      source,
      joinPath(path, "ubigeo")
    ),
    nombre: parseString(
      readRequired(record, "nombre", source, path),
      source,
      joinPath(path, "nombre")
    )
  };
}

function parseOnpeProvinceValue(
  value: unknown,
  source: string,
  path: string
): OnpeProvince {
  const record = asRecord(value, source, path);

  return {
    ubigeo: parseString(
      readRequired(record, "ubigeo", source, path),
      source,
      joinPath(path, "ubigeo")
    ),
    nombre: parseString(
      readRequired(record, "nombre", source, path),
      source,
      joinPath(path, "nombre")
    )
  };
}

function parseOnpeTotalsValue(value: unknown, source: string, path: string): OnpeTotals {
  const record = asRecord(value, source, path);

  return {
    actasContabilizadas: parseFiniteNumber(
      readRequired(record, "actasContabilizadas", source, path),
      source,
      joinPath(path, "actasContabilizadas")
    ),
    contabilizadas: parseFiniteNumber(
      readRequired(record, "contabilizadas", source, path),
      source,
      joinPath(path, "contabilizadas")
    ),
    totalActas: parseFiniteNumber(
      readRequired(record, "totalActas", source, path),
      source,
      joinPath(path, "totalActas")
    ),
    participacionCiudadana: parseFiniteNumber(
      readRequired(record, "participacionCiudadana", source, path),
      source,
      joinPath(path, "participacionCiudadana")
    ),
    actasEnviadasJee: parseFiniteNumber(
      readRequired(record, "actasEnviadasJee", source, path),
      source,
      joinPath(path, "actasEnviadasJee")
    ),
    enviadasJee: parseFiniteNumber(
      readRequired(record, "enviadasJee", source, path),
      source,
      joinPath(path, "enviadasJee")
    ),
    actasPendientesJee: parseFiniteNumber(
      readRequired(record, "actasPendientesJee", source, path),
      source,
      joinPath(path, "actasPendientesJee")
    ),
    pendientesJee: parseFiniteNumber(
      readRequired(record, "pendientesJee", source, path),
      source,
      joinPath(path, "pendientesJee")
    ),
    fechaActualizacion: parseFiniteNumber(
      readRequired(record, "fechaActualizacion", source, path),
      source,
      joinPath(path, "fechaActualizacion")
    ),
    idUbigeoDepartamento: parseFiniteNumber(
      readRequired(record, "idUbigeoDepartamento", source, path),
      source,
      joinPath(path, "idUbigeoDepartamento")
    ),
    idUbigeoProvincia: parseFiniteNumber(
      readRequired(record, "idUbigeoProvincia", source, path),
      source,
      joinPath(path, "idUbigeoProvincia")
    ),
    idUbigeoDistrito: parseFiniteNumber(
      readRequired(record, "idUbigeoDistrito", source, path),
      source,
      joinPath(path, "idUbigeoDistrito")
    ),
    idUbigeoDistritoElectoral: parseFiniteNumber(
      readRequired(record, "idUbigeoDistritoElectoral", source, path),
      source,
      joinPath(path, "idUbigeoDistritoElectoral")
    ),
    totalVotosEmitidos: parseFiniteNumber(
      readRequired(record, "totalVotosEmitidos", source, path),
      source,
      joinPath(path, "totalVotosEmitidos")
    ),
    totalVotosValidos: parseFiniteNumber(
      readRequired(record, "totalVotosValidos", source, path),
      source,
      joinPath(path, "totalVotosValidos")
    ),
    porcentajeVotosEmitidos: parseFiniteNumber(
      readRequired(record, "porcentajeVotosEmitidos", source, path),
      source,
      joinPath(path, "porcentajeVotosEmitidos")
    ),
    porcentajeVotosValidos: parseFiniteNumber(
      readRequired(record, "porcentajeVotosValidos", source, path),
      source,
      joinPath(path, "porcentajeVotosValidos")
    )
  };
}

function parseOnpeParticipantValue(
  value: unknown,
  source: string,
  path: string
): OnpeParticipant {
  const record = asRecord(value, source, path);

  return {
    nombreAgrupacionPolitica: parseString(
      readRequired(record, "nombreAgrupacionPolitica", source, path),
      source,
      joinPath(path, "nombreAgrupacionPolitica")
    ),
    codigoAgrupacionPolitica: parseStringOrNumber(
      readRequired(record, "codigoAgrupacionPolitica", source, path),
      source,
      joinPath(path, "codigoAgrupacionPolitica")
    ),
    nombreCandidato: parseString(
      readRequired(record, "nombreCandidato", source, path),
      source,
      joinPath(path, "nombreCandidato")
    ),
    dniCandidato: parseString(
      readRequired(record, "dniCandidato", source, path),
      source,
      joinPath(path, "dniCandidato")
    ),
    totalVotosValidos: parseFiniteNumber(
      readRequired(record, "totalVotosValidos", source, path),
      source,
      joinPath(path, "totalVotosValidos")
    ),
    porcentajeVotosValidos: parseFiniteNumber(
      readRequired(record, "porcentajeVotosValidos", source, path),
      source,
      joinPath(path, "porcentajeVotosValidos")
    ),
    porcentajeVotosEmitidos: parseFiniteNumber(
      readRequired(record, "porcentajeVotosEmitidos", source, path),
      source,
      joinPath(path, "porcentajeVotosEmitidos")
    )
  };
}

export function parseOnpeDepartments(
  value: unknown,
  source = "onpe",
  path = "$"
): OnpeDepartment[] {
  return parseArray(value, parseOnpeDepartmentValue, source, path);
}

export function parseOnpeProvinces(
  value: unknown,
  source = "onpe",
  path = "$"
): OnpeProvince[] {
  return parseArray(value, parseOnpeProvinceValue, source, path);
}

export function parseOnpeParticipants(
  value: unknown,
  source = "onpe",
  path = "$"
): OnpeParticipant[] {
  return parseArray(value, parseOnpeParticipantValue, source, path);
}

export function parseOnpeTotals(
  value: unknown,
  source = "onpe",
  path = "$"
): OnpeTotals {
  return parseOnpeTotalsValue(value, source, path);
}

export function parseOnpeEnvelope<T>(
  value: unknown,
  parseData: (value: unknown, source?: string, path?: string) => T,
  source = "onpe",
  path = "$"
): OnpeEnvelope<T> {
  const record = asRecord(value, source, path);
  const success = parseBoolean(
    readRequired(record, "success", source, path),
    source,
    joinPath(path, "success")
  );
  const message =
    record.message === undefined
      ? ""
      : parseString(record.message, source, joinPath(path, "message"));

  if (!success) {
    fail(source, path, `ONPE devolvió success=false (${message})`);
  }

  if (record.data == null) {
    fail(source, joinPath(path, "data"), "ONPE no devolvió data");
  }

  return {
    success,
    message,
    data: parseData(record.data, source, joinPath(path, "data"))
  };
}
