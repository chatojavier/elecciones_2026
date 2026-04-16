import scopesMetaJson from "../../../data/scopes.meta.json";
import {
  buildCandidateCatalog,
  buildForeignCountryResult,
  buildProjectedNationalSummary,
  buildProvinceResult,
  buildScopeResult,
  computeIsStale,
  getScopeMetaTotals,
  sumProjectedVotes
} from "../../../src/lib/domain";
import type {
  ElectionSnapshot,
  ForeignContinentResult,
  ForeignResult,
  HealthStatus,
  RegionResult,
  ScopeMeta,
  ScopeResult
} from "../../../src/lib/types";
import { ONPE_ELECTION_ID } from "./config";
import {
  fetchDepartments,
  fetchForeignContinents,
  fetchForeignContinentParticipants,
  fetchForeignContinentTotals,
  fetchForeignCountries,
  fetchForeignCountryParticipants,
  fetchForeignCountryTotals,
  fetchForeignParticipants,
  fetchForeignTotals,
  fetchNationalParticipants,
  fetchNationalTotals,
  fetchProvinceParticipants,
  fetchProvinceTotals,
  fetchProvinces,
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
const PROVINCE_REQUEST_CONCURRENCY = 6;

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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

export async function buildElectionSnapshot() {
  const [departmentList, foreignContinentList] = await Promise.all([
    fetchDepartments(),
    fetchForeignContinents()
  ]);

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

  if (foreignContinentList.length === 0 && foreignTotals.contabilizadas > 0) {
    throw new Error(
      `ONPE devolvió 0 continentes pero el total extranjero tiene ${foreignTotals.contabilizadas} actas contabilizadas`
    );
  }

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

  const [regionPayloads, foreignContinentPayloads] = await Promise.all([
    Promise.all(
      departmentList.map(async (department) => {
        const meta = getDepartmentMeta(department.ubigeo);
        const [totals, participants, provinceCatalog] = await Promise.all([
          fetchRegionTotals(department.ubigeo),
          fetchRegionParticipants(department.ubigeo),
          fetchProvinces(department.ubigeo)
        ]);

        const provinces = (
          await mapWithConcurrency(
            provinceCatalog,
            PROVINCE_REQUEST_CONCURRENCY,
            async (province) => {
              const [provinceTotals, provinceParticipants] = await Promise.all([
                fetchProvinceTotals(department.ubigeo, province.ubigeo),
                fetchProvinceParticipants(department.ubigeo, province.ubigeo)
              ]);

              return buildProvinceResult({
                scopeId: province.ubigeo,
                parentScopeId: meta.scopeId,
                label: province.nombre,
                totals: provinceTotals,
                participants: provinceParticipants,
                candidateCatalog,
                featuredCodes: featuredCandidateCodes
              });
            }
          )
        ).sort((left, right) => left.label.localeCompare(right.label, "es"));

        const region: RegionResult = {
          ...buildScopeResult({
            scopeId: meta.scopeId,
            kind: "department",
            label: meta.label,
            electores: meta.electores,
            padronShare: meta.padronShare,
            totals,
            participants,
            candidateCatalog,
            featuredCodes: featuredCandidateCodes
          }),
          kind: "department",
          provinces
        };

        region.projectedVotes = sumProjectedVotes(provinces, featuredCandidateCodes);

        return region;
      })
    ),
    Promise.all(
      foreignContinentList.map(async (continent) => {
        const [totals, participants, countryCatalog] = await Promise.all([
          fetchForeignContinentTotals(continent.ubigeo),
          fetchForeignContinentParticipants(continent.ubigeo),
          fetchForeignCountries(continent.ubigeo)
        ]);

        const countries = (
          await mapWithConcurrency(
            countryCatalog,
            PROVINCE_REQUEST_CONCURRENCY,
            async (country) => {
              const [countryTotals, countryParticipants] = await Promise.all([
                fetchForeignCountryTotals(continent.ubigeo, country.ubigeo),
                fetchForeignCountryParticipants(continent.ubigeo, country.ubigeo)
              ]);

              return buildForeignCountryResult({
                scopeId: country.ubigeo,
                parentScopeId: continent.ubigeo,
                label: country.nombre,
                totals: countryTotals,
                participants: countryParticipants,
                candidateCatalog,
                featuredCodes: featuredCandidateCodes
              });
            }
          )
        ).sort((left, right) => left.label.localeCompare(right.label, "es"));

        if (countries.length === 0 && totals.contabilizadas > 0) {
          throw new Error(
            `Continente ${continent.nombre} tiene ${totals.contabilizadas} actas contabilizadas pero ONPE devolvió 0 países`
          );
        }

        const foreignContinent: ForeignContinentResult = {
          ...buildScopeResult({
            scopeId: continent.ubigeo,
            kind: "foreign_continent",
            label: continent.nombre,
            electores: 0,
            padronShare: 0,
            totals,
            participants,
            candidateCatalog,
            featuredCodes: featuredCandidateCodes
          }),
          kind: "foreign_continent",
          countries
        };

        foreignContinent.projectedVotes = sumProjectedVotes(countries, featuredCandidateCodes);

        return foreignContinent;
      })
    )
  ]);

  const regions = regionPayloads.sort((left, right) => left.label.localeCompare(right.label, "es"));
  const continents = foreignContinentPayloads.sort((left, right) =>
    left.label.localeCompare(right.label, "es")
  );

  national.projectedVotes = sumProjectedVotes(regions, featuredCandidateCodes);

  const foreign: ForeignResult = {
    ...buildScopeResult({
      scopeId: foreignMeta.scopeId,
      kind: "foreign_total",
      label: foreignMeta.label,
      electores: foreignMeta.electores,
      padronShare: foreignMeta.padronShare,
      totals: foreignTotals,
      participants: foreignParticipants,
      candidateCatalog,
      featuredCodes: featuredCandidateCodes
    }),
    kind: "foreign_total",
    continents
  };

  foreign.projectedVotes = sumProjectedVotes(continents, featuredCandidateCodes);

  const sourceLastUpdatedAt = [
    national,
    foreign,
    ...regions,
    ...regions.flatMap((region) => region.provinces),
    ...continents,
    ...continents.flatMap((continent) => continent.countries)
  ]
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
