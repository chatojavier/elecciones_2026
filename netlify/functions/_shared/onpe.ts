import {
  parseOnpeDepartments,
  parseOnpeEnvelope,
  parseOnpeParticipants,
  parseOnpeProvinces,
  parseOnpeTotals
} from "../../../src/lib/contracts";
import type {
  OnpeDepartment,
  OnpeParticipant,
  OnpeProvince,
  OnpeTotals
} from "../../../src/lib/types";
import {
  FIRST_ROUND_ONPE_SOURCE,
  ONPE_ACCEPT_LANGUAGE,
  ONPE_COOKIE,
  ONPE_REQUEST_CONCURRENCY,
  ONPE_REQUEST_TIMEOUT_MS,
  ONPE_USER_AGENT,
  type OnpeSourceConfig
} from "./config";
import { createConcurrencyLimiter } from "./concurrency";

function buildUrl(source: OnpeSourceConfig, path: string, params: Record<string, string | number>) {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
  return `${source.baseUrl}${path}?${search.toString()}`;
}

function buildOnpeHeaders(source: OnpeSourceConfig) {
  return {
    Accept: "*/*",
    "Accept-Language": ONPE_ACCEPT_LANGUAGE,
    "Content-Type": "application/json",
    Referer: source.referer,
    "User-Agent": ONPE_USER_AGENT,
    Cookie: ONPE_COOKIE,
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Priority: "u=3, i"
  };
}

const runOnpeRequest = createConcurrencyLimiter(ONPE_REQUEST_CONCURRENCY);

async function fetchOnpe<T>(
  source: OnpeSourceConfig,
  path: string,
  params: Record<string, string | number>,
  parseData: (value: unknown, path: string) => T
) {
  return runOnpeRequest(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, ONPE_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildUrl(source, path, params), {
        headers: buildOnpeHeaders(source),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`ONPE respondió ${response.status} para ${path}`);
      }

      const text = await response.text();
      const trimmed = text.trim();

      if (!trimmed) {
        throw new Error(`ONPE devolvió una respuesta vacía para ${path}`);
      }

      if (trimmed.startsWith("<")) {
        throw new Error(`ONPE devolvió HTML para ${path}`);
      }

      let rawPayload: unknown;

      try {
        rawPayload = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(
          `ONPE devolvió JSON inválido para ${path}: ${(error as Error).message}`
        );
      }

      return parseOnpeEnvelope(rawPayload, parseData, path).data;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(`ONPE excedió timeout de ${ONPE_REQUEST_TIMEOUT_MS}ms para ${path}`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

export interface OnpeClient {
  source: OnpeSourceConfig;
  fetchDepartments: () => Promise<OnpeDepartment[]>;
  fetchForeignContinents: () => Promise<OnpeDepartment[]>;
  fetchNationalTotals: () => Promise<OnpeTotals>;
  fetchNationalParticipants: () => Promise<OnpeParticipant[]>;
  fetchForeignTotals: () => Promise<OnpeTotals>;
  fetchForeignParticipants: () => Promise<OnpeParticipant[]>;
  fetchRegionTotals: (departmentUbigeo: string) => Promise<OnpeTotals>;
  fetchRegionParticipants: (departmentUbigeo: string) => Promise<OnpeParticipant[]>;
  fetchForeignContinentTotals: (continentUbigeo: string) => Promise<OnpeTotals>;
  fetchForeignContinentParticipants: (continentUbigeo: string) => Promise<OnpeParticipant[]>;
  fetchProvinces: (departmentUbigeo: string) => Promise<OnpeProvince[]>;
  fetchForeignCountries: (continentUbigeo: string) => Promise<OnpeProvince[]>;
  fetchProvinceTotals: (departmentUbigeo: string, provinceUbigeo: string) => Promise<OnpeTotals>;
  fetchProvinceParticipants: (departmentUbigeo: string, provinceUbigeo: string) => Promise<OnpeParticipant[]>;
  fetchForeignCountryTotals: (continentUbigeo: string, countryUbigeo: string) => Promise<OnpeTotals>;
  fetchForeignCountryParticipants: (
    continentUbigeo: string,
    countryUbigeo: string
  ) => Promise<OnpeParticipant[]>;
}

export function createOnpeClient(source: OnpeSourceConfig): OnpeClient {
  return {
    source,
    fetchDepartments: () =>
      fetchOnpe<OnpeDepartment[]>(
        source,
        "/ubigeos/departamentos",
        {
          idEleccion: source.electionId,
          idAmbitoGeografico: 1
        },
        parseOnpeDepartments
      ),
    fetchForeignContinents: () =>
      fetchOnpe<OnpeDepartment[]>(
        source,
        "/ubigeos/departamentos",
        {
          idEleccion: source.electionId,
          idAmbitoGeografico: 2
        },
        parseOnpeDepartments
      ),
    fetchNationalTotals: () =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ambito_geografico",
          idAmbitoGeografico: 1
        },
        parseOnpeTotals
      ),
    fetchNationalParticipants: () =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ambito_geografico",
          idAmbitoGeografico: 1
        },
        parseOnpeParticipants
      ),
    fetchForeignTotals: () =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ambito_geografico",
          idAmbitoGeografico: 2
        },
        parseOnpeTotals
      ),
    fetchForeignParticipants: () =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ambito_geografico",
          idAmbitoGeografico: 2
        },
        parseOnpeParticipants
      ),
    fetchRegionTotals: (departmentUbigeo: string) =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: departmentUbigeo
        },
        parseOnpeTotals
      ),
    fetchRegionParticipants: (departmentUbigeo: string) =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: departmentUbigeo
        },
        parseOnpeParticipants
      ),
    fetchForeignContinentTotals: (continentUbigeo: string) =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 2,
          idUbigeoDepartamento: continentUbigeo
        },
        parseOnpeTotals
      ),
    fetchForeignContinentParticipants: (continentUbigeo: string) =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_01",
          idAmbitoGeografico: 2,
          idUbigeoDepartamento: continentUbigeo
        },
        parseOnpeParticipants
      ),
    fetchProvinces: (departmentUbigeo: string) =>
      fetchOnpe<OnpeProvince[]>(
        source,
        "/ubigeos/provincias",
        {
          idEleccion: source.electionId,
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: departmentUbigeo
        },
        parseOnpeProvinces
      ),
    fetchForeignCountries: (continentUbigeo: string) =>
      fetchOnpe<OnpeProvince[]>(
        source,
        "/ubigeos/provincias",
        {
          idEleccion: source.electionId,
          idAmbitoGeografico: 2,
          idUbigeoDepartamento: continentUbigeo
        },
        parseOnpeProvinces
      ),
    fetchProvinceTotals: (departmentUbigeo: string, provinceUbigeo: string) =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_02",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: departmentUbigeo,
          idUbigeoProvincia: provinceUbigeo
        },
        parseOnpeTotals
      ),
    fetchProvinceParticipants: (departmentUbigeo: string, provinceUbigeo: string) =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_02",
          idAmbitoGeografico: 1,
          idUbigeoDepartamento: departmentUbigeo,
          idUbigeoProvincia: provinceUbigeo
        },
        parseOnpeParticipants
      ),
    fetchForeignCountryTotals: (continentUbigeo: string, countryUbigeo: string) =>
      fetchOnpe<OnpeTotals>(
        source,
        "/resumen-general/totales",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_02",
          idAmbitoGeografico: 2,
          idUbigeoDepartamento: continentUbigeo,
          idUbigeoProvincia: countryUbigeo
        },
        parseOnpeTotals
      ),
    fetchForeignCountryParticipants: (continentUbigeo: string, countryUbigeo: string) =>
      fetchOnpe<OnpeParticipant[]>(
        source,
        "/resumen-general/participantes",
        {
          idEleccion: source.electionId,
          tipoFiltro: "ubigeo_nivel_02",
          idAmbitoGeografico: 2,
          idUbigeoDepartamento: continentUbigeo,
          idUbigeoProvincia: countryUbigeo
        },
        parseOnpeParticipants
      )
  };
}

const defaultClient = createOnpeClient(FIRST_ROUND_ONPE_SOURCE);

export const fetchDepartments = defaultClient.fetchDepartments;
export const fetchForeignContinents = defaultClient.fetchForeignContinents;
export const fetchNationalTotals = defaultClient.fetchNationalTotals;
export const fetchNationalParticipants = defaultClient.fetchNationalParticipants;
export const fetchForeignTotals = defaultClient.fetchForeignTotals;
export const fetchForeignParticipants = defaultClient.fetchForeignParticipants;
export const fetchRegionTotals = defaultClient.fetchRegionTotals;
export const fetchRegionParticipants = defaultClient.fetchRegionParticipants;
export const fetchForeignContinentTotals = defaultClient.fetchForeignContinentTotals;
export const fetchForeignContinentParticipants = defaultClient.fetchForeignContinentParticipants;
export const fetchProvinces = defaultClient.fetchProvinces;
export const fetchForeignCountries = defaultClient.fetchForeignCountries;
export const fetchProvinceTotals = defaultClient.fetchProvinceTotals;
export const fetchProvinceParticipants = defaultClient.fetchProvinceParticipants;
export const fetchForeignCountryTotals = defaultClient.fetchForeignCountryTotals;
export const fetchForeignCountryParticipants = defaultClient.fetchForeignCountryParticipants;
