import {
  ONPE_ACCEPT_LANGUAGE,
  ONPE_BASE_URL,
  ONPE_COOKIE,
  ONPE_ELECTION_ID,
  ONPE_REFERER,
  ONPE_USER_AGENT
} from "./config";
import type {
  OnpeDepartment,
  OnpeEnvelope,
  OnpeParticipant,
  OnpeTotals
} from "../../../src/lib/types";

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

async function fetchOnpe<T>(path: string, params: Record<string, string | number>) {
  const response = await fetch(buildUrl(path, params), {
    headers: buildOnpeHeaders()
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
