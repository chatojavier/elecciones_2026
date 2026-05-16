import type {
  BaseScopeResult,
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignCountryResult,
  ForeignResult,
  HealthStatus,
  HealthStatusKind,
  NationalResult,
  RegionResult,
  OnpeDepartment,
  OnpeEnvelope,
  OnpeParticipant,
  OnpeProvince,
  OnpeTotals,
  ProvinceResult,
  ProjectedNationalSummary
} from "./types";

export class ContractValidationError extends Error {
  contract: string;
  path: string;

  constructor(contract: string, path: string, reason: string) {
    super(`Contrato ${contract} invalido en ${path}: ${reason}`);
    this.name = "ContractValidationError";
    this.contract = contract;
    this.path = path;
  }
}

function fail(contract: string, path: string, reason: string): never {
  throw new ContractValidationError(contract, path, reason);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, contract: string, path: string) {
  if (!isRecord(value)) {
    fail(contract, path, "se esperaba objeto");
  }
  return value;
}

function requireString(value: unknown, contract: string, path: string) {
  if (typeof value !== "string") {
    fail(contract, path, "se esperaba string");
  }
  return value;
}

function requireFiniteNumber(value: unknown, contract: string, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(contract, path, "se esperaba numero finito");
  }
  return value;
}

function requireBoolean(value: unknown, contract: string, path: string) {
  if (typeof value !== "boolean") {
    fail(contract, path, "se esperaba boolean");
  }
  return value;
}

function requireArray(value: unknown, contract: string, path: string) {
  if (!Array.isArray(value)) {
    fail(contract, path, "se esperaba arreglo");
  }
  return value;
}

function requireNullableString(value: unknown, contract: string, path: string) {
  if (value === null) {
    return null;
  }
  return requireString(value, contract, path);
}

function requireIsoDateString(value: unknown, contract: string, path: string) {
  const text = requireString(value, contract, path);
  if (Number.isNaN(Date.parse(text))) {
    fail(contract, path, "se esperaba fecha ISO valida");
  }
  return text;
}

function isHealthStatusKind(value: string): value is HealthStatusKind {
  return value === "healthy" || value === "degraded" || value === "unknown";
}

function parseCandidateResult(value: unknown, path: string) {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  return {
    code: requireString(record.code, contract, `${path}.code`),
    partyName: requireString(record.partyName, contract, `${path}.partyName`),
    candidateName: requireString(record.candidateName, contract, `${path}.candidateName`),
    votesValid: requireFiniteNumber(record.votesValid, contract, `${path}.votesValid`),
    pctValid: requireFiniteNumber(record.pctValid, contract, `${path}.pctValid`),
    pctEmitted: requireFiniteNumber(record.pctEmitted, contract, `${path}.pctEmitted`)
  };
}

function parseAggregateResult(value: unknown, path: string) {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const code = requireString(record.code, contract, `${path}.code`);
  if (code !== "otros") {
    fail(contract, `${path}.code`, "se esperaba 'otros'");
  }
  return {
    code: "otros" as const,
    label: requireString(record.label, contract, `${path}.label`),
    votesValid: requireFiniteNumber(record.votesValid, contract, `${path}.votesValid`),
    pctValid: requireFiniteNumber(record.pctValid, contract, `${path}.pctValid`),
    pctEmitted: requireFiniteNumber(record.pctEmitted, contract, `${path}.pctEmitted`)
  };
}

function parseProjectedVotes(value: unknown, path: string) {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const parsed: Record<string, number> = {};
  for (const [key, keyValue] of Object.entries(record)) {
    parsed[key] = requireFiniteNumber(keyValue, contract, `${path}.${key}`);
  }
  return parsed;
}

type ElectorateScopeKind =
  | NationalResult["kind"]
  | RegionResult["kind"]
  | ForeignResult["kind"]
  | ForeignContinentResult["kind"];

type ParsedElectorateScopeBase<TKind extends ElectorateScopeKind> = BaseScopeResult<TKind> & {
  electores: number;
  padronShare: number;
};

function parseResultCore(value: unknown, path: string) {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);

  return {
    scopeId: requireString(record.scopeId, contract, `${path}.scopeId`),
    label: requireString(record.label, contract, `${path}.label`),
    actasContabilizadasPct: requireFiniteNumber(
      record.actasContabilizadasPct,
      contract,
      `${path}.actasContabilizadasPct`
    ),
    contabilizadas: requireFiniteNumber(record.contabilizadas, contract, `${path}.contabilizadas`),
    totalActas: requireFiniteNumber(record.totalActas, contract, `${path}.totalActas`),
    participacionCiudadanaPct: requireFiniteNumber(
      record.participacionCiudadanaPct,
      contract,
      `${path}.participacionCiudadanaPct`
    ),
    enviadasJee: requireFiniteNumber(record.enviadasJee, contract, `${path}.enviadasJee`),
    pendientesJee: requireFiniteNumber(record.pendientesJee, contract, `${path}.pendientesJee`),
    totalVotosEmitidos: requireFiniteNumber(
      record.totalVotosEmitidos,
      contract,
      `${path}.totalVotosEmitidos`
    ),
    totalVotosValidos: requireFiniteNumber(
      record.totalVotosValidos,
      contract,
      `${path}.totalVotosValidos`
    ),
    sourceUpdatedAt: requireIsoDateString(record.sourceUpdatedAt, contract, `${path}.sourceUpdatedAt`),
    candidates: requireArray(record.candidates, contract, `${path}.candidates`).map((item, index) =>
      parseCandidateResult(item, `${path}.candidates[${index}]`)
    ),
    featuredCandidates: requireArray(
      record.featuredCandidates,
      contract,
      `${path}.featuredCandidates`
    ).map((item, index) => parseCandidateResult(item, `${path}.featuredCandidates[${index}]`)),
    otros: parseAggregateResult(record.otros, `${path}.otros`),
    projectedVotes: parseProjectedVotes(record.projectedVotes, `${path}.projectedVotes`)
  };
}

function parseElectorateScopeBase<TKind extends ElectorateScopeKind>(
  value: unknown,
  path: string,
  expectedKind: TKind
): ParsedElectorateScopeBase<TKind> {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const kind = requireString(record.kind, contract, `${path}.kind`);
  if (kind !== expectedKind) {
    fail(contract, `${path}.kind`, `se esperaba '${expectedKind}'`);
  }
  return {
    ...parseResultCore(record, path),
    electores: requireFiniteNumber(record.electores, contract, `${path}.electores`),
    padronShare: requireFiniteNumber(record.padronShare, contract, `${path}.padronShare`),
    kind: expectedKind
  };
}

function parseNationalResult(value: unknown, path: string): NationalResult {
  return parseElectorateScopeBase(value, path, "national");
}

function parseRegionResult(value: unknown, path: string): RegionResult {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const region = parseElectorateScopeBase(record, path, "department");
  const provinces = requireArray(record.provinces, contract, `${path}.provinces`).map(
    (item, index) => parseProvince(item, `${path}.provinces[${index}]`)
  );
  return {
    ...region,
    kind: "department",
    provinces
  };
}

function parseProvince(value: unknown, path: string): ProvinceResult {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const kind = requireString(record.kind, contract, `${path}.kind`);
  if (kind !== "province") {
    fail(contract, `${path}.kind`, "se esperaba 'province'");
  }
  return {
    ...parseResultCore(record, path),
    parentScopeId: requireString(record.parentScopeId, contract, `${path}.parentScopeId`),
    kind: "province" as const
  };
}

function parseForeignCountry(value: unknown, path: string): ForeignCountryResult {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const kind = requireString(record.kind, contract, `${path}.kind`);
  if (kind !== "foreign_country") {
    fail(contract, `${path}.kind`, "se esperaba 'foreign_country'");
  }
  return {
    ...parseResultCore(record, path),
    parentScopeId: requireString(record.parentScopeId, contract, `${path}.parentScopeId`),
    kind: "foreign_country"
  };
}

function parseForeignContinent(value: unknown, path: string): ForeignContinentResult {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const continent = parseElectorateScopeBase(record, path, "foreign_continent");
  const rawCountries = record.countries;
  const countries = rawCountries === undefined ? [] : requireArray(rawCountries, contract, `${path}.countries`);
  return {
    ...continent,
    kind: "foreign_continent",
    countries: countries.map((item, index) => parseForeignCountry(item, `${path}.countries[${index}]`))
  };
}

function parseForeignResult(value: unknown, path: string): ForeignResult {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  const foreign = parseElectorateScopeBase(record, path, "foreign_total");
  const rawContinents = record.continents;
  const continents = rawContinents === undefined ? [] : requireArray(rawContinents, contract, `${path}.continents`);
  return {
    ...foreign,
    kind: "foreign_total",
    continents: continents.map((item, index) => parseForeignContinent(item, `${path}.continents[${index}]`))
  };
}

function parseProjectedNational(value: unknown, path: string): ProjectedNationalSummary {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, path);
  return {
    totalElectores: requireFiniteNumber(record.totalElectores, contract, `${path}.totalElectores`),
    totalProjectedValidVotes: requireFiniteNumber(
      record.totalProjectedValidVotes,
      contract,
      `${path}.totalProjectedValidVotes`
    ),
    projectedVotes: parseProjectedVotes(record.projectedVotes, `${path}.projectedVotes`),
    projectedPercentages: parseProjectedVotes(
      record.projectedPercentages,
      `${path}.projectedPercentages`
    )
  };
}

export function parseElectionSnapshot(value: unknown): ElectionSnapshot {
  const contract = "ElectionSnapshot";
  const record = asRecord(value, contract, "root");
  return {
    generatedAt: requireIsoDateString(record.generatedAt, contract, "generatedAt"),
    sourceElectionId: requireFiniteNumber(record.sourceElectionId, contract, "sourceElectionId"),
    sourceLastUpdatedAt: requireIsoDateString(
      record.sourceLastUpdatedAt,
      contract,
      "sourceLastUpdatedAt"
    ),
    national: parseNationalResult(record.national, "national"),
    foreign: parseForeignResult(record.foreign, "foreign"),
    regions: requireArray(record.regions, contract, "regions").map((item, index) =>
      parseRegionResult(item, `regions[${index}]`)
    ),
    projectedNational: parseProjectedNational(record.projectedNational, "projectedNational"),
    featuredCandidateCodes: requireArray(
      record.featuredCandidateCodes,
      contract,
      "featuredCandidateCodes"
    ).map((item, index) => requireString(item, contract, `featuredCandidateCodes[${index}]`)),
    isStale: requireBoolean(record.isStale, contract, "isStale")
  };
}

export function parseHealthStatus(value: unknown): HealthStatus {
  const contract = "HealthStatus";
  const record = asRecord(value, contract, "root");
  const status = requireString(record.status, contract, "status");
  if (!isHealthStatusKind(status)) {
    fail(contract, "status", "se esperaba healthy|degraded|unknown");
  }
  const source = requireString(record.source, contract, "source");
  if (source !== "onpe") {
    fail(contract, "source", "se esperaba 'onpe'");
  }
  const staleMinutesValue = record.staleMinutes;
  const staleMinutes =
    staleMinutesValue === null
      ? null
      : requireFiniteNumber(staleMinutesValue, contract, "staleMinutes");

  return {
    status,
    source: "onpe",
    lastSyncAt:
      record.lastSyncAt === null
        ? null
        : requireIsoDateString(record.lastSyncAt, contract, "lastSyncAt"),
    lastSuccessAt:
      record.lastSuccessAt === null
        ? null
        : requireIsoDateString(record.lastSuccessAt, contract, "lastSuccessAt"),
    staleMinutes,
    lastError: requireNullableString(record.lastError, contract, "lastError")
  };
}

export function parseOnpeEnvelope<T>(
  value: unknown,
  dataParser: (value: unknown, path: string) => T,
  context: string
): OnpeEnvelope<T> {
  const contract = `ONPE invalido para ${context}`;
  const record = asRecord(value, contract, "root");
  const success = requireBoolean(record.success, contract, "success");
  if (!success) {
    fail(contract, "success", "se esperaba true");
  }
  const message = typeof record.message === "string" ? record.message : "";
  if (record.data == null) {
    fail(contract, "data", "se esperaba valor no nulo");
  }
  return {
    success,
    message,
    data: dataParser(record.data, "data")
  };
}

export function parseOnpeTotals(value: unknown, path = "root"): OnpeTotals {
  const contract = "ONPE";
  const record = asRecord(value, contract, path);
  return {
    actasContabilizadas: requireFiniteNumber(
      record.actasContabilizadas,
      contract,
      `${path}.actasContabilizadas`
    ),
    contabilizadas: requireFiniteNumber(record.contabilizadas, contract, `${path}.contabilizadas`),
    totalActas: requireFiniteNumber(record.totalActas, contract, `${path}.totalActas`),
    participacionCiudadana: requireFiniteNumber(
      record.participacionCiudadana,
      contract,
      `${path}.participacionCiudadana`
    ),
    actasEnviadasJee: requireFiniteNumber(record.actasEnviadasJee, contract, `${path}.actasEnviadasJee`),
    enviadasJee: requireFiniteNumber(record.enviadasJee, contract, `${path}.enviadasJee`),
    actasPendientesJee: requireFiniteNumber(
      record.actasPendientesJee,
      contract,
      `${path}.actasPendientesJee`
    ),
    pendientesJee: requireFiniteNumber(record.pendientesJee, contract, `${path}.pendientesJee`),
    fechaActualizacion: requireFiniteNumber(
      record.fechaActualizacion,
      contract,
      `${path}.fechaActualizacion`
    ),
    idUbigeoDepartamento: requireFiniteNumber(
      record.idUbigeoDepartamento,
      contract,
      `${path}.idUbigeoDepartamento`
    ),
    idUbigeoProvincia: requireFiniteNumber(
      record.idUbigeoProvincia,
      contract,
      `${path}.idUbigeoProvincia`
    ),
    idUbigeoDistrito: requireFiniteNumber(record.idUbigeoDistrito, contract, `${path}.idUbigeoDistrito`),
    idUbigeoDistritoElectoral: requireFiniteNumber(
      record.idUbigeoDistritoElectoral,
      contract,
      `${path}.idUbigeoDistritoElectoral`
    ),
    totalVotosEmitidos: requireFiniteNumber(
      record.totalVotosEmitidos,
      contract,
      `${path}.totalVotosEmitidos`
    ),
    totalVotosValidos: requireFiniteNumber(
      record.totalVotosValidos,
      contract,
      `${path}.totalVotosValidos`
    ),
    porcentajeVotosEmitidos: requireFiniteNumber(
      record.porcentajeVotosEmitidos,
      contract,
      `${path}.porcentajeVotosEmitidos`
    ),
    porcentajeVotosValidos: requireFiniteNumber(
      record.porcentajeVotosValidos,
      contract,
      `${path}.porcentajeVotosValidos`
    )
  };
}

export function parseOnpeParticipant(value: unknown, path = "root"): OnpeParticipant {
  const contract = "ONPE";
  const record = asRecord(value, contract, path);
  const partyCode = record.codigoAgrupacionPolitica;
  if (typeof partyCode !== "string" && typeof partyCode !== "number") {
    fail(contract, `${path}.codigoAgrupacionPolitica`, "se esperaba string o numero");
  }

  return {
    nombreAgrupacionPolitica: requireString(
      record.nombreAgrupacionPolitica,
      contract,
      `${path}.nombreAgrupacionPolitica`
    ),
    codigoAgrupacionPolitica: partyCode,
    nombreCandidato: requireString(record.nombreCandidato, contract, `${path}.nombreCandidato`),
    dniCandidato: requireString(record.dniCandidato, contract, `${path}.dniCandidato`),
    totalVotosValidos: requireFiniteNumber(
      record.totalVotosValidos,
      contract,
      `${path}.totalVotosValidos`
    ),
    porcentajeVotosValidos: requireFiniteNumber(
      record.porcentajeVotosValidos,
      contract,
      `${path}.porcentajeVotosValidos`
    ),
    porcentajeVotosEmitidos: requireFiniteNumber(
      record.porcentajeVotosEmitidos,
      contract,
      `${path}.porcentajeVotosEmitidos`
    )
  };
}

export function parseOnpeParticipants(value: unknown, path = "root"): OnpeParticipant[] {
  const contract = "ONPE";
  return requireArray(value, contract, path).map((item, index) =>
    parseOnpeParticipant(item, `${path}[${index}]`)
  );
}

export function parseOnpeDepartment(value: unknown, path = "root"): OnpeDepartment {
  const contract = "ONPE";
  const record = asRecord(value, contract, path);
  return {
    ubigeo: requireString(record.ubigeo, contract, `${path}.ubigeo`),
    nombre: requireString(record.nombre, contract, `${path}.nombre`)
  };
}

export function parseOnpeDepartments(value: unknown, path = "root"): OnpeDepartment[] {
  const contract = "ONPE";
  return requireArray(value, contract, path).map((item, index) =>
    parseOnpeDepartment(item, `${path}[${index}]`)
  );
}

export function parseOnpeProvince(value: unknown, path = "root"): OnpeProvince {
  const contract = "ONPE";
  const record = asRecord(value, contract, path);
  return {
    ubigeo: requireString(record.ubigeo, contract, `${path}.ubigeo`),
    nombre: requireString(record.nombre, contract, `${path}.nombre`)
  };
}

export function parseOnpeProvinces(value: unknown, path = "root"): OnpeProvince[] {
  const contract = "ONPE";
  return requireArray(value, contract, path).map((item, index) =>
    parseOnpeProvince(item, `${path}[${index}]`)
  );
}
