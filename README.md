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
SYNC_LOCK_TTL_MS=600000
MANUAL_SYNC_MIN_INTERVAL_MS=300000
SYNC_MANUAL_SECRET=
SYNC_BACKGROUND_SECRET=
VITE_USE_NETLIFY_FUNCTIONS=true
```

`VITE_USE_NETLIFY_FUNCTIONS=true` fuerza al frontend a consumir `/.netlify/functions/*` durante desarrollo local.

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
curl -i http://localhost:8888/.netlify/functions/sync
curl -i -X POST http://localhost:8888/.netlify/functions/sync
```

Comportamiento esperado de `sync`:

- `GET /.netlify/functions/sync` retorna `405`.
- `POST /.netlify/functions/sync` retorna `202` cuando inicia o detecta una sincronización en background, o `429` si ya existe un corte reciente.

`sync.ts` adquiere el lock y dispara `sync-background.ts`; el trabajo pesado escribe `snapshot` y `health` en Netlify Blobs. Si `SYNC_BACKGROUND_SECRET` no está definido, la función usa `SITE_ID`/`NETLIFY_SITE_ID` como secreto interno.

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
```

## Limitaciones locales conocidas

- El almacenamiento de Blobs en local no replica exactamente el estado compartido de producción/deploy previews.
- Scheduled Functions no se ejecutan automáticamente con el mismo comportamiento operativo que en producción.
- Si `ONPE_COOKIE` expira o ONPE responde HTML/no JSON, `snapshot`/`sync` pueden fallar aunque la app y las Functions estén bien configuradas.
