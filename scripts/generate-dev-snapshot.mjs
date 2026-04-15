import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const execFileAsync = promisify(execFile);

const FEATURED_CANDIDATE_CODES = ["8", "35", "16", "10", "14"];
const STALE_AFTER_MINUTES = 30;
const DEFAULT_BASE_URL = "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";
const DEFAULT_REFERER = "https://resultadoelectoral.onpe.gob.pe/main/resumen";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15";
const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en-US;q=0.9,en;q=0.8";
const DEFAULT_ELECTION_ID = "10";
const DEFAULT_OUTPUT_PATH = resolve(process.cwd(), "public", "dev-snapshot.json");

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function normalizeCode(code) {
  return String(code);
}

function parseDotEnv(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

async function readOptionalText(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig() {
  const envPath = resolve(process.cwd(), ".env");
  const rawEnv = await readOptionalText(envPath);
  const fileEnv = rawEnv ? parseDotEnv(rawEnv) : {};

  return {
    baseUrl: process.env.ONPE_BASE_URL ?? fileEnv.ONPE_BASE_URL ?? DEFAULT_BASE_URL,
    cookie: process.env.ONPE_COOKIE ?? fileEnv.ONPE_COOKIE ?? "",
    referer: process.env.ONPE_REFERER ?? fileEnv.ONPE_REFERER ?? DEFAULT_REFERER,
    userAgent: process.env.ONPE_USER_AGENT ?? fileEnv.ONPE_USER_AGENT ?? DEFAULT_USER_AGENT,
    acceptLanguage:
      process.env.ONPE_ACCEPT_LANGUAGE ??
      fileEnv.ONPE_ACCEPT_LANGUAGE ??
      DEFAULT_ACCEPT_LANGUAGE,
    electionId: process.env.ONPE_ELECTION_ID ?? fileEnv.ONPE_ELECTION_ID ?? DEFAULT_ELECTION_ID,
    outputPath: process.env.DEV_SNAPSHOT_OUTPUT_PATH ?? DEFAULT_OUTPUT_PATH
  };
}

function buildUrl(baseUrl, path, params) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function fetchOnpeJson(config, path, params) {
  const url = buildUrl(config.baseUrl, path, params);
  const args = [
    "-sS",
    "--compressed",
    "--max-time",
    "30",
    url,
    "-H",
    "Accept: */*",
    "-H",
    "Content-Type: application/json",
    "-H",
    `Cookie: ${config.cookie}`,
    "-H",
    `Referer: ${config.referer}`,
    "-H",
    `User-Agent: ${config.userAgent}`,
    "-H",
    `Accept-Language: ${config.acceptLanguage}`,
    "-H",
    "Sec-Fetch-Site: same-origin",
    "-H",
    "Sec-Fetch-Mode: cors",
    "-H",
    "Sec-Fetch-Dest: empty",
    "-H",
    "Priority: u=3, i"
  ];
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 20 * 1024 * 1024
  });
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error(`ONPE devolvió una respuesta vacía para ${url}`);
  }

  if (trimmed.startsWith("<")) {
    throw new Error(`ONPE devolvió HTML para ${url}`);
  }

  let payload;

  try {
    payload = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`ONPE devolvió JSON inválido para ${url}: ${error.message}`);
  }

  if (!payload.success || payload.data == null) {
    throw new Error(`ONPE devolvió success=false para ${url}`);
  }

  return payload.data;
}

function buildCandidateCatalog(participants) {
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

function normalizeCandidate(participant, candidateCatalog) {
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

function createCandidatePlaceholder(code, candidateCatalog) {
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

function summarizeOthers(candidates) {
  return candidates.reduce(
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

function buildScopeResult({
  scopeId,
  kind,
  label,
  electores,
  padronShare,
  totals,
  participants,
  candidateCatalog
}) {
  const candidates = participants
    .map((participant) => normalizeCandidate(participant, candidateCatalog))
    .sort((left, right) => right.pctValid - left.pctValid);
  const featuredCandidates = FEATURED_CANDIDATE_CODES.map(
    (code) => candidates.find((candidate) => candidate.code === code) ?? createCandidatePlaceholder(code, candidateCatalog)
  );
  const otros = summarizeOthers(
    candidates.filter((candidate) => !FEATURED_CANDIDATE_CODES.includes(candidate.code))
  );
  const projectedVotes = Object.fromEntries(
    [
      ...featuredCandidates.map((candidate) => [
        candidate.code,
        Math.round(electores * (candidate.pctValid / 100))
      ]),
      ["otros", Math.round(electores * (otros.pctValid / 100))]
    ]
  );

  return {
    scopeId,
    kind,
    label,
    electores,
    padronShare,
    actasContabilizadasPct: round(totals.actasContabilizadas),
    contabilizadas: totals.contabilizadas,
    totalActas: totals.totalActas,
    participacionCiudadanaPct: round(totals.participacionCiudadana),
    enviadasJee: totals.enviadasJee,
    pendientesJee: totals.pendientesJee,
    totalVotosEmitidos: totals.totalVotosEmitidos,
    totalVotosValidos: totals.totalVotosValidos,
    sourceUpdatedAt: new Date(totals.fechaActualizacion).toISOString(),
    candidates,
    featuredCandidates,
    otros,
    projectedVotes
  };
}

function buildProjectedNationalSummary(regions, foreign, totalElectores) {
  const projectedVotes = FEATURED_CANDIDATE_CODES.reduce(
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
      totalElectores > 0 ? round((votes / totalElectores) * 100) : 0
    ])
  );

  return {
    totalElectores,
    projectedVotes,
    projectedPercentages
  };
}

function computeIsStale(sourceLastUpdatedAt) {
  const minutes = (Date.now() - new Date(sourceLastUpdatedAt).getTime()) / 60_000;
  return minutes > STALE_AFTER_MINUTES;
}

async function loadScopesMeta() {
  return JSON.parse(await readFile(resolve(process.cwd(), "data", "scopes.meta.json"), "utf8"));
}

async function buildElectionSnapshot(config) {
  if (!config.cookie) {
    throw new Error("Falta ONPE_COOKIE en .env o en el entorno.");
  }

  const scopesMetaJson = await loadScopesMeta();
  const scopesMeta = scopesMetaJson.scopes.slice().sort((left, right) => left.displayOrder - right.displayOrder);
  const departmentMeta = scopesMeta.filter((scope) => scope.kind === "department");
  const foreignMeta = scopesMeta.find((scope) => scope.kind === "foreign_total");

  if (!foreignMeta) {
    throw new Error("Falta el scope foreign_total en data/scopes.meta.json.");
  }

  const peruElectores = departmentMeta.reduce((sum, scope) => sum + scope.electores, 0);
  const totalElectores = scopesMeta.reduce((sum, scope) => sum + scope.electores, 0);

  const departmentCatalog = await fetchOnpeJson(config, "ubigeos/departamentos", {
    idEleccion: config.electionId,
    idAmbitoGeografico: 1
  });

  if (!Array.isArray(departmentCatalog) || departmentCatalog.length !== 25) {
    throw new Error(`Se esperaban 25 departamentos y ONPE devolvió ${departmentCatalog.length ?? 0}`);
  }

  const departmentCodes = new Set(departmentCatalog.map((item) => String(item.ubigeo)));

  for (const scope of departmentMeta) {
    if (!departmentCodes.has(scope.scopeId)) {
      throw new Error(`El catálogo de ONPE no incluyó ${scope.scopeId}`);
    }
  }

  const [nationalTotals, nationalParticipants, foreignTotals, foreignParticipants] = await Promise.all([
    fetchOnpeJson(config, "resumen-general/totales", {
      idEleccion: config.electionId,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 1
    }),
    fetchOnpeJson(config, "resumen-general/participantes", {
      idEleccion: config.electionId,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 1
    }),
    fetchOnpeJson(config, "resumen-general/totales", {
      idEleccion: config.electionId,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 2
    }),
    fetchOnpeJson(config, "resumen-general/participantes", {
      idEleccion: config.electionId,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 2
    })
  ]);
  const candidateCatalog = buildCandidateCatalog(nationalParticipants);

  const regionPayloads = await Promise.all(
    departmentMeta.map(async (scope) => {
      const [totals, participants] = await Promise.all([
        fetchOnpeJson(config, "resumen-general/totales", {
          idEleccion: config.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: scope.scopeId
        }),
        fetchOnpeJson(config, "resumen-general/participantes", {
          idEleccion: config.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: scope.scopeId
        })
      ]);

      return {
        meta: scope,
        totals,
        participants
      };
    })
  );

  const regions = regionPayloads
    .map(({ meta, totals, participants }) =>
      buildScopeResult({
        scopeId: meta.scopeId,
        kind: "department",
        label: meta.label,
        electores: meta.electores,
        padronShare: meta.padronShare,
        totals,
        participants,
        candidateCatalog
      })
    )
    .sort((left, right) => left.label.localeCompare(right.label, "es"));

  const national = buildScopeResult({
    scopeId: "1",
    kind: "national",
    label: "PERÚ",
    electores: peruElectores,
    padronShare: round((peruElectores / totalElectores) * 100, 4),
    totals: nationalTotals,
    participants: nationalParticipants,
    candidateCatalog
  });

  national.projectedVotes = FEATURED_CANDIDATE_CODES.reduce(
    (acc, code) => {
      acc[code] = regions.reduce((sum, region) => sum + (region.projectedVotes[code] ?? 0), 0);
      return acc;
    },
    {
      otros: regions.reduce((sum, region) => sum + (region.projectedVotes.otros ?? 0), 0)
    }
  );

  const foreign = buildScopeResult({
    scopeId: foreignMeta.scopeId,
    kind: "foreign_total",
    label: foreignMeta.label,
    electores: foreignMeta.electores,
    padronShare: foreignMeta.padronShare,
    totals: foreignTotals,
    participants: foreignParticipants,
    candidateCatalog
  });

  const sourceLastUpdatedAt = [national, foreign, ...regions]
    .map((scope) => scope.sourceUpdatedAt)
    .sort()
    .at(-1);

  if (!sourceLastUpdatedAt) {
    throw new Error("No se pudo determinar la fecha de actualización de ONPE.");
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceElectionId: Number(config.electionId),
    sourceLastUpdatedAt,
    national,
    foreign,
    regions,
    projectedNational: buildProjectedNationalSummary(regions, foreign, totalElectores),
    featuredCandidateCodes: [...FEATURED_CANDIDATE_CODES],
    isStale: computeIsStale(sourceLastUpdatedAt)
  };
}

async function main() {
  const config = await loadConfig();
  const outputPath = config.outputPath;
  const hasExistingOutput = await pathExists(outputPath);

  try {
    const snapshot = await buildElectionSnapshot(config);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`Snapshot de desarrollo escrito en ${outputPath}`);
  } catch (error) {
    if (!hasExistingOutput) {
      throw error;
    }

    console.warn(
      `No se pudo refrescar ONPE y se conservará ${outputPath}: ${error.message}`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
