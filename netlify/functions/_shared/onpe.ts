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
  ONPE_ACCEPT_LANGUAGE,
  ONPE_BASE_URL,
  ONPE_COOKIE,
  ONPE_ELECTION_ID,
  ONPE_REQUEST_CONCURRENCY,
  ONPE_REQUEST_TIMEOUT_MS,
  ONPE_REFERER,
  ONPE_USER_AGENT
} from "./config";
import { createConcurrencyLimiter } from "./concurrency";

function buildUrl(path: string, params: Record<string, string | number>) {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
  return `${ONPE_BASE_URL}${path}?${search.toString()}`;
}

function buildOnpeHeaders() {
  return {
    Accept: "*/*",
    "Accept-Language": ONPE_ACCEPT_LANGUAGE,
    "Content-Type": "application/json",
    Referer: ONPE_REFERER,
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
      const response = await fetch(buildUrl(path, params), {
        headers: buildOnpeHeaders(),
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

export function fetchDepartments() {
  return fetchOnpe<OnpeDepartment[]>(
    "/ubigeos/departamentos",
    {
      idEleccion: ONPE_ELECTION_ID,
      idAmbitoGeografico: 1
    },
    parseOnpeDepartments
  );
}

export function fetchForeignContinents() {
  return fetchOnpe<OnpeDepartment[]>(
    "/ubigeos/departamentos",
    {
      idEleccion: ONPE_ELECTION_ID,
      idAmbitoGeografico: 2
    },
    parseOnpeDepartments
  );
}

export function fetchNationalTotals() {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 1
    },
    parseOnpeTotals
  );
}

export function fetchNationalParticipants() {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 1
    },
    parseOnpeParticipants
  );
}

export function fetchForeignTotals() {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 2
    },
    parseOnpeTotals
  );
}

export function fetchForeignParticipants() {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ambito_geografico",
      idAmbitoGeografico: 2
    },
    parseOnpeParticipants
  );
}

export function fetchRegionTotals(departmentUbigeo: string) {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_01",
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: departmentUbigeo
    },
    parseOnpeTotals
  );
}

export function fetchRegionParticipants(departmentUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_01",
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: departmentUbigeo
    },
    parseOnpeParticipants
  );
}

export function fetchForeignContinentTotals(continentUbigeo: string) {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_01",
      idAmbitoGeografico: 2,
      idUbigeoDepartamento: continentUbigeo
    },
    parseOnpeTotals
  );
}

export function fetchForeignContinentParticipants(continentUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_01",
      idAmbitoGeografico: 2,
      idUbigeoDepartamento: continentUbigeo
    },
    parseOnpeParticipants
  );
}

export function fetchProvinces(departmentUbigeo: string) {
  return fetchOnpe<OnpeProvince[]>(
    "/ubigeos/provincias",
    {
      idEleccion: ONPE_ELECTION_ID,
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: departmentUbigeo
    },
    parseOnpeProvinces
  );
}

export function fetchForeignCountries(continentUbigeo: string) {
  return fetchOnpe<OnpeProvince[]>(
    "/ubigeos/provincias",
    {
      idEleccion: ONPE_ELECTION_ID,
      idAmbitoGeografico: 2,
      idUbigeoDepartamento: continentUbigeo
    },
    parseOnpeProvinces
  );
}

export function fetchProvinceTotals(departmentUbigeo: string, provinceUbigeo: string) {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_02",
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: departmentUbigeo,
      idUbigeoProvincia: provinceUbigeo
    },
    parseOnpeTotals
  );
}

export function fetchProvinceParticipants(departmentUbigeo: string, provinceUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_02",
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: departmentUbigeo,
      idUbigeoProvincia: provinceUbigeo
    },
    parseOnpeParticipants
  );
}

export function fetchForeignCountryTotals(continentUbigeo: string, countryUbigeo: string) {
  return fetchOnpe<OnpeTotals>(
    "/resumen-general/totales",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_02",
      idAmbitoGeografico: 2,
      idUbigeoDepartamento: continentUbigeo,
      idUbigeoProvincia: countryUbigeo
    },
    parseOnpeTotals
  );
}

export function fetchForeignCountryParticipants(continentUbigeo: string, countryUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>(
    "/resumen-general/participantes",
    {
      idEleccion: ONPE_ELECTION_ID,
      tipoFiltro: "ubigeo_nivel_02",
      idAmbitoGeografico: 2,
      idUbigeoDepartamento: continentUbigeo,
      idUbigeoProvincia: countryUbigeo
    },
    parseOnpeParticipants
  );
}
