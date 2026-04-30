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
import type {
  OnpeDepartment,
  OnpeEnvelope,
  OnpeParticipant,
  OnpeProvince,
  OnpeTotals
} from "../../../src/lib/types";

let activeOnpeRequests = 0;
const onpeRequestQueue: Array<() => void> = [];

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

function pumpOnpeQueue() {
  while (
    activeOnpeRequests < ONPE_REQUEST_CONCURRENCY &&
    onpeRequestQueue.length > 0
  ) {
    activeOnpeRequests += 1;
    onpeRequestQueue.shift()?.();
  }
}

async function acquireOnpeRequestSlot() {
  if (
    activeOnpeRequests < ONPE_REQUEST_CONCURRENCY &&
    onpeRequestQueue.length === 0
  ) {
    activeOnpeRequests += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    onpeRequestQueue.push(resolve);
  });
}

function releaseOnpeRequestSlot() {
  activeOnpeRequests = Math.max(0, activeOnpeRequests - 1);
  pumpOnpeQueue();
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      ("code" in error && error.code === "ABORT_ERR"))
  );
}

async function fetchOnpe<T>(path: string, params: Record<string, string | number>) {
  await acquireOnpeRequestSlot();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ONPE_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path, params), {
      headers: buildOnpeHeaders(),
      signal: controller.signal
    }).catch((error) => {
      if (isAbortError(error)) {
        throw new Error(`ONPE timeout después de ${ONPE_REQUEST_TIMEOUT_MS}ms para ${path}`);
      }

      throw error;
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

    let payload: OnpeEnvelope<T>;

    try {
      payload = JSON.parse(trimmed) as OnpeEnvelope<T>;
    } catch (error) {
      throw new Error(
        `ONPE devolvió JSON inválido para ${path}: ${(error as Error).message}`
      );
    }

    if (!payload.success || payload.data == null) {
      throw new Error(`ONPE devolvió success=false para ${path}`);
    }

    return payload.data;
  } finally {
    clearTimeout(timeoutId);
    releaseOnpeRequestSlot();
  }
}

export function fetchDepartments() {
  return fetchOnpe<OnpeDepartment[]>("/ubigeos/departamentos", {
    idEleccion: ONPE_ELECTION_ID,
    idAmbitoGeografico: 1
  });
}

export function fetchForeignContinents() {
  return fetchOnpe<OnpeDepartment[]>("/ubigeos/departamentos", {
    idEleccion: ONPE_ELECTION_ID,
    idAmbitoGeografico: 2
  });
}

export function fetchNationalTotals() {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ambito_geografico",
    idAmbitoGeografico: 1
  });
}

export function fetchNationalParticipants() {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ambito_geografico",
    idAmbitoGeografico: 1
  });
}

export function fetchForeignTotals() {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ambito_geografico",
    idAmbitoGeografico: 2
  });
}

export function fetchForeignParticipants() {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ambito_geografico",
    idAmbitoGeografico: 2
  });
}

export function fetchRegionTotals(departmentUbigeo: string) {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_01",
    idAmbitoGeografico: 1,
    idUbigeoDepartamento: departmentUbigeo
  });
}

export function fetchRegionParticipants(departmentUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_01",
    idAmbitoGeografico: 1,
    idUbigeoDepartamento: departmentUbigeo
  });
}

export function fetchForeignContinentTotals(continentUbigeo: string) {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_01",
    idAmbitoGeografico: 2,
    idUbigeoDepartamento: continentUbigeo
  });
}

export function fetchForeignContinentParticipants(continentUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_01",
    idAmbitoGeografico: 2,
    idUbigeoDepartamento: continentUbigeo
  });
}

export function fetchProvinces(departmentUbigeo: string) {
  return fetchOnpe<OnpeProvince[]>("/ubigeos/provincias", {
    idEleccion: ONPE_ELECTION_ID,
    idAmbitoGeografico: 1,
    idUbigeoDepartamento: departmentUbigeo
  });
}

export function fetchForeignCountries(continentUbigeo: string) {
  return fetchOnpe<OnpeProvince[]>("/ubigeos/provincias", {
    idEleccion: ONPE_ELECTION_ID,
    idAmbitoGeografico: 2,
    idUbigeoDepartamento: continentUbigeo
  });
}

export function fetchProvinceTotals(departmentUbigeo: string, provinceUbigeo: string) {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_02",
    idAmbitoGeografico: 1,
    idUbigeoDepartamento: departmentUbigeo,
    idUbigeoProvincia: provinceUbigeo
  });
}

export function fetchProvinceParticipants(departmentUbigeo: string, provinceUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_02",
    idAmbitoGeografico: 1,
    idUbigeoDepartamento: departmentUbigeo,
    idUbigeoProvincia: provinceUbigeo
  });
}

export function fetchForeignCountryTotals(continentUbigeo: string, countryUbigeo: string) {
  return fetchOnpe<OnpeTotals>("/resumen-general/totales", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_02",
    idAmbitoGeografico: 2,
    idUbigeoDepartamento: continentUbigeo,
    idUbigeoProvincia: countryUbigeo
  });
}

export function fetchForeignCountryParticipants(continentUbigeo: string, countryUbigeo: string) {
  return fetchOnpe<OnpeParticipant[]>("/resumen-general/participantes", {
    idEleccion: ONPE_ELECTION_ID,
    tipoFiltro: "ubigeo_nivel_02",
    idAmbitoGeografico: 2,
    idUbigeoDepartamento: continentUbigeo,
    idUbigeoProvincia: countryUbigeo
  });
}
