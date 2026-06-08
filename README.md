# Desarrollo local (Netlify + Functions)

## Requisitos

- Node.js 18+
- Dependencias instaladas con `npm install`

## Variables de entorno

Crea un archivo `.env` local con los valores necesarios para consultar ONPE:

```bash
ONPE_BASE_URL=
ONPE_ELECTION_ID=
ONPE_USER_AGENT=
ONPE_ACCEPT_LANGUAGE=en-GB,en-US;q=0.9,en;q=0.8
ONPE_REFERER=
ONPE_COOKIE=
ONPE_REQUEST_CONCURRENCY=16
ONPE_REQUEST_TIMEOUT_MS=10000
SYNC_LOCK_TTL_MS=600000
MANUAL_SYNC_MIN_INTERVAL_MS=300000
SYNC_MANUAL_SECRET=
VITE_USE_NETLIFY_FUNCTIONS=true
```

`ONPE_REQUEST_CONCURRENCY` aplica como limite global de requests ONPE concurrentes por proceso de Function, para todas las llamadas ejecutadas durante un `sync`.

`VITE_USE_NETLIFY_FUNCTIONS=true` fuerza al frontend a consumir `/.netlify/functions/*` durante desarrollo local.

Para segunda vuelta, configura además:

```bash
ONPE_SECOND_ROUND_BASE_URL=https://resultadosegundavuelta.onpe.gob.pe/presentacion-backend
ONPE_SECOND_ROUND_REFERER=https://resultadosegundavuelta.onpe.gob.pe/main/resumen
ONPE_SECOND_ROUND_ELECTION_ID=10
```

La app mantiene dos pipelines paralelos:

- Primera vuelta: `/.netlify/functions/snapshot`, `/.netlify/functions/sync`, `/.netlify/functions/health`
- Segunda vuelta: `/.netlify/functions/snapshot-second-round`, `/.netlify/functions/sync-second-round`, `/.netlify/functions/health-second-round`

## Comando único de desarrollo local

```bash
npm install
npm run dev:netlify
```

La app queda disponible en `http://localhost:8888` y Netlify CLI enruta Functions desde `netlify/functions`.

## Smoke tests manuales

Con `npm run dev:netlify` activo:

```bash
curl -i http://localhost:8888/.netlify/functions/health
curl -i http://localhost:8888/.netlify/functions/snapshot
curl -i http://localhost:8888/.netlify/functions/snapshot-second-round
curl -i http://localhost:8888/.netlify/functions/sync
curl -i http://localhost:8888/.netlify/functions/sync-second-round
curl -i -X POST http://localhost:8888/.netlify/functions/sync
curl -i -X POST http://localhost:8888/.netlify/functions/sync-second-round
```

Comportamiento esperado de `sync`:

- `GET /.netlify/functions/sync` retorna `405`.
- `POST /.netlify/functions/sync` retorna `200` cuando la sincronizacion termina y escribe un nuevo snapshot, `202` si ya hay una sincronizacion en curso, o `429` si ya existe un corte reciente.
- Mide la duracion total de `POST /.netlify/functions/sync` con los valores configurados y registra si entra en el presupuesto de runtime de Netlify. Si queda al limite, probar `ONPE_REQUEST_CONCURRENCY=24` antes de cerrar el ticket.

`sync.ts` adquiere el lock, ejecuta el trabajo de sincronizacion, escribe `snapshot` y `health` en Netlify Blobs, y libera el lock en `finally`. Si otra invocacion encuentra el lock activo, responde `sync_in_progress` con `retryAfterSeconds`.

## Invocación manual de la función programada

La función con `schedule` actual es `sync.ts` (no existe `scheduled-sync.ts` en este ticket).

```bash
npm run functions:invoke:sync
```

## Build y checks locales

```bash
npm test
npm run build
npm run netlify:build
npm run snapshot:dev
npm run snapshot:dev:second-round
```

## Limitaciones locales conocidas

- El almacenamiento de Blobs en local no replica exactamente el estado compartido de producción/deploy previews.
- Scheduled Functions no se ejecutan automáticamente con el mismo comportamiento operativo que en producción.
- Si `ONPE_COOKIE` expira o ONPE responde HTML/no JSON, `snapshot`/`sync` pueden fallar aunque la app y las Functions estén bien configuradas.
