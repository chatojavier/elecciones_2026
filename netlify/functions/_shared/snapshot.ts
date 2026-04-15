import scopesMetaJson from "../../../data/scopes.meta.json";
import {
  buildCandidateCatalog,
  buildProjectedNationalSummary,
  buildScopeResult,
  computeIsStale,
  getScopeMetaTotals
} from "../../../src/lib/domain";
import type {
  ElectionSnapshot,
  HealthStatus,
  ScopeMeta,
  ScopeResult
} from "../../../src/lib/types";
import { ONPE_ELECTION_ID } from "./config";
import {
  fetchDepartments,
  fetchForeignParticipants,
  fetchForeignTotals,
  fetchNationalParticipants,
  fetchNationalTotals,
  fetchRegionParticipants,
  fetchRegionTotals
} from "./onpe";
import {
  readHealth,
  readSnapshot,
  writeHealth,
  writeSnapshot
} from "./storage";

const scopesMeta = (scopesMetaJson.scopes as ScopeMeta[]).slice().sort((left, right) => {
  return left.displayOrder - right.displayOrder;
});

function getDepartmentMeta(scopeId: string) {
  const scope = scopesMeta.find(
    (item) => item.scopeId === scopeId && item.kind === "department"
  );

  if (!scope) {
    throw new Error(`No existe metadata local para el scope ${scopeId}`);
  }

  return scope;
}

function getForeignMeta() {
  const scope = scopesMeta.find((item) => item.kind === "foreign_total");

  if (!scope) {
    throw new Error("Falta el scope agregado de extranjero en scopes.meta.json");
  }

  return scope;
}

function buildPeruNationalProjectedVotes(regions: ScopeResult[], featuredCodes: string[]) {
  return featuredCodes.reduce<Record<string, number>>(
    (acc, code) => {
      acc[code] = regions.reduce((sum, region) => sum + (region.projectedVotes[code] ?? 0), 0);
      return acc;
    },
    {
      otros: regions.reduce((sum, region) => sum + (region.projectedVotes.otros ?? 0), 0)
    }
  );
}

export async function buildElectionSnapshot() {
  const departmentList = await fetchDepartments();

  if (departmentList.length !== 25) {
    throw new Error(`Se esperaban 25 departamentos y ONPE devolvió ${departmentList.length}`);
  }

  const [nationalTotals, nationalParticipants, foreignTotals, foreignParticipants] =
    await Promise.all([
      fetchNationalTotals(),
      fetchNationalParticipants(),
      fetchForeignTotals(),
      fetchForeignParticipants()
    ]);

  const candidateCatalog = buildCandidateCatalog(nationalParticipants);
  const { peruElectores, totalElectores } = getScopeMetaTotals(scopesMeta);
  const foreignMeta = getForeignMeta();
  const national = buildScopeResult({
    scopeId: "1",
    kind: "national",
    label: "PERÚ",
    electores: peruElectores,
    padronShare: Number(((peruElectores / totalElectores) * 100).toFixed(4)),
    totals: nationalTotals,
    participants: nationalParticipants,
    candidateCatalog
  });
  const featuredCandidateCodes = national.featuredCandidates.map((candidate) => candidate.code);

  const regionPayloads = await Promise.all(
    departmentList.map(async (department) => {
      const [totals, participants] = await Promise.all([
        fetchRegionTotals(department.ubigeo),
        fetchRegionParticipants(department.ubigeo)
      ]);

      return {
        meta: getDepartmentMeta(department.ubigeo),
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
        candidateCatalog,
        featuredCodes: featuredCandidateCodes
      })
    )
    .sort((left, right) => left.label.localeCompare(right.label, "es"));

  national.projectedVotes = buildPeruNationalProjectedVotes(regions, featuredCandidateCodes);

  const foreign = buildScopeResult({
    scopeId: foreignMeta.scopeId,
    kind: "foreign_total",
    label: foreignMeta.label,
    electores: foreignMeta.electores,
    padronShare: foreignMeta.padronShare,
    totals: foreignTotals,
    participants: foreignParticipants,
    candidateCatalog,
    featuredCodes: featuredCandidateCodes
  });

  const sourceLastUpdatedAt = [national, foreign, ...regions]
    .map((scope) => scope.sourceUpdatedAt)
    .sort()
    .at(-1);

  if (!sourceLastUpdatedAt) {
    throw new Error("No se pudo determinar la fecha de actualización de ONPE");
  }

  const generatedAt = new Date().toISOString();
  const projectedNational = buildProjectedNationalSummary(
    regions,
    foreign,
    totalElectores,
    featuredCandidateCodes
  );

  const snapshot: ElectionSnapshot = {
    generatedAt,
    sourceElectionId: ONPE_ELECTION_ID,
    sourceLastUpdatedAt,
    national,
    foreign,
    regions,
    projectedNational,
    featuredCandidateCodes,
    isStale: computeIsStale(sourceLastUpdatedAt)
  };

  return snapshot;
}

function healthFromSnapshot(snapshot: ElectionSnapshot): HealthStatus {
  const staleMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(snapshot.sourceLastUpdatedAt).getTime()) / 60000)
  );

  return {
    status: snapshot.isStale ? "degraded" : "healthy",
    source: "onpe",
    lastSyncAt: snapshot.generatedAt,
    lastSuccessAt: snapshot.generatedAt,
    staleMinutes,
    lastError: null
  };
}

export async function runSync() {
  try {
    const snapshot = await buildElectionSnapshot();
    const health = healthFromSnapshot(snapshot);

    await Promise.all([writeSnapshot(snapshot), writeHealth(health)]);

    return {
      snapshot,
      health
    };
  } catch (error) {
    const previousSnapshot = await readSnapshot();
    const previousHealth = await readHealth();
    const now = new Date().toISOString();

    const staleMinutes = previousSnapshot
      ? Math.max(
          0,
          Math.round((Date.now() - new Date(previousSnapshot.sourceLastUpdatedAt).getTime()) / 60000)
        )
      : null;

    const degradedHealth: HealthStatus = {
      status: "degraded",
      source: "onpe",
      lastSyncAt: now,
      lastSuccessAt: previousHealth?.lastSuccessAt ?? previousSnapshot?.generatedAt ?? null,
      staleMinutes,
      lastError: (error as Error).message
    };

    await writeHealth(degradedHealth);
    throw error;
  }
}
