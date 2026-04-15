import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = "https://resultadoelectoral.onpe.gob.pe/presentacion-backend";
const DEFAULT_REFERER = "https://resultadoelectoral.onpe.gob.pe/main/resumen";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15";
const DEFAULT_ACCEPT_LANGUAGE = "en-GB,en-US;q=0.9,en;q=0.8";

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

async function loadConfig() {
  let fileEnv = {};

  try {
    fileEnv = parseDotEnv(await readFile(".env", "utf8"));
  } catch {
    fileEnv = {};
  }

  return {
    baseUrl: process.env.ONPE_BASE_URL ?? fileEnv.ONPE_BASE_URL ?? DEFAULT_BASE_URL,
    cookie: process.env.ONPE_COOKIE ?? fileEnv.ONPE_COOKIE ?? "",
    referer: process.env.ONPE_REFERER ?? fileEnv.ONPE_REFERER ?? DEFAULT_REFERER,
    userAgent: process.env.ONPE_USER_AGENT ?? fileEnv.ONPE_USER_AGENT ?? DEFAULT_USER_AGENT,
    acceptLanguage:
      process.env.ONPE_ACCEPT_LANGUAGE ??
      fileEnv.ONPE_ACCEPT_LANGUAGE ??
      DEFAULT_ACCEPT_LANGUAGE,
    electionId: process.env.ONPE_ELECTION_ID ?? fileEnv.ONPE_ELECTION_ID ?? "10"
  };
}

async function fetchViaCurl(config) {
  const url = new URL(
    "ubigeos/departamentos",
    config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`
  );
  url.searchParams.set("idEleccion", config.electionId);
  url.searchParams.set("idAmbitoGeografico", "1");

  const { stdout } = await execFileAsync(
    "curl",
    [
      "-sS",
      "--compressed",
      "--max-time",
      "30",
      url.toString(),
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
    ],
    {
      maxBuffer: 10 * 1024 * 1024
    }
  );

  return stdout.trim();
}

async function main() {
  const config = await loadConfig();

  if (!config.cookie) {
    console.error("Falta ONPE_COOKIE en .env o en el entorno.");
    process.exit(1);
  }

  const body = await fetchViaCurl(config);

  if (!body) {
    console.error("ONPE devolvió una respuesta vacía.");
    process.exit(1);
  }

  if (body.startsWith("<")) {
    console.error("ONPE devolvió HTML. La sesión sigue bloqueada por Cloudflare.");
    process.exit(1);
  }

  let payload;

  try {
    payload = JSON.parse(body);
  } catch (error) {
    console.error(`ONPE devolvió JSON inválido: ${error.message}`);
    process.exit(1);
  }

  if (!payload.success || !Array.isArray(payload.data)) {
    console.error("ONPE respondió un payload inesperado.");
    process.exit(1);
  }

  console.log(`Sesión ONPE válida. Departamentos disponibles: ${payload.data.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
