# App Web de Resultados ONPE + Proyección Nacional

## Resumen
Construir una app web pública, read-only, desplegada en Netlify, que consuma data electoral desde ONPE mediante un sync server-side y la combine con metadata local de regiones para mostrar:
- resumen nacional
- tabla por región
- top 5 candidatos destacados
- categoría agregada `Otros`
- actas procesadas
- proyección nacional basada en electores por región

La app no dependerá del Google Sheet en runtime. El Sheet queda como herramienta operativa separada si quieres seguir usándolo, pero la web tendrá su propia fuente de verdad publicada.

## Cambios de implementación
### Arquitectura
- Usar `React + Vite + TypeScript` para el frontend público.
- Usar `Netlify Functions` para el backend liviano.
- Usar una `Scheduled Function` para refrescar datos cada 15 minutos y `Netlify Blobs` para persistir el último snapshot bueno.
  Inferencia técnica: esto evita llamar ONPE desde el navegador, que hoy no es confiable por `cf_clearance`/HTML de bloqueo y por el comportamiento ya observado del helper.
- Exponer un endpoint público `GET /.netlify/functions/snapshot` que sirva el snapshot ya normalizado desde Blobs.
- Mantener un endpoint `GET /.netlify/functions/health` con `lastSyncAt`, `status`, `source`, `staleMinutes` y último error resumido.

### Modelo de datos
- Extraer del flujo actual dos fuentes:
  - `live election snapshot`: adaptado del helper actual `fetch_onpe_snapshot.py` a una función server-side en TypeScript.
  - `regional metadata`: archivo versionado local con `region`, `electores`, `% padron`, orden visual y flags especiales.
- Crear un contrato normalizado:
  - `ElectionSnapshot`
  - `RegionResult`
  - `CandidateResult`
  - `NationalSummary`
- `RegionResult` incluirá:
  - `regionId`
  - `label`
  - `electores`
  - `padronShare`
  - `actasProcessed`
  - `candidates[]`
  - `trackedCandidates[]`
  - `otros`
  - `projectedVotes`
- `NationalSummary` incluirá:
  - `actasProcessed`
  - `trackedCandidates`
  - `otros`
  - `projectedVotes`
  - `projectedPercentages`
  - `generatedAt`
  - `isStale`
- Fijar `trackedCandidateCodes = ['8','35','16','10','14']`.
- Mostrar todos los candidatos en la capa de ingestión, pero en UI agrupar los no rastreados como `Otros`.

### Lógica de negocio
- Normalizar ONPE por región usando el mismo mapping ya validado por catálogo de departamentos.
- No confiar en `response_ids` de `totales`; usar query-to-region mapping, tal como ya aprendimos del helper actual.
- Mantener `Peruanos en el extranjero` como ámbito separado.
- Calcular proyección regional como:
  - `projectedVotes[candidate] = electores * porcentajeVotosValidos`
- Calcular proyección nacional como:
  - suma de votos proyectados regionales / total electorado
- Calcular `Otros` como:
  - `1 - suma(porcentajes de los 5 tracked)` por región y nacional
- Si ONPE devuelve HTML, JSON inválido o cookie vencida:
  - no sobreescribir el blob vigente
  - conservar el último snapshot bueno
  - marcar `health.status = degraded`
  - exponer timestamp de frescura en UI

### UX del MVP
- Home con tres bloques:
  - `Actas procesadas nacionales`
  - `Top 5 + Otros` en barras comparativas
  - `Tabla regional`
- Tabla regional con columnas:
  - Región
  - Electores
  - % padrón
  - Actas procesadas
  - Top 5
  - Otros
  - votos proyectados por candidato seleccionado
- Filtros:
  - ordenar por electores, actas, candidato, proyección
  - resaltar un candidato
  - mostrar/ocultar `Otros`
- Diseño:
  - enfoque editorial/data-journalism, no dashboard genérico
  - tipografía con personalidad, color coding consistente por candidato
  - estado visible de “última actualización” y “fuente ONPE”

## Interfaces y configuración pública
- Variables de entorno Netlify:
  - `ONPE_COOKIE`
  - `ONPE_CF_CLEARANCE`
  - `ONPE_USER_AGENT`
  - `ONPE_REFERER`
- Archivos/versionado:
  - `/src` para app y visualización
  - `/netlify/functions` para sync, snapshot y health
  - `/data/regions.meta.json` para electores, `% padrón` y orden de regiones
- Endpoint público:
  - `GET /.netlify/functions/snapshot`
- Endpoint operativo:
  - `GET /.netlify/functions/health`

## Plan de pruebas
- Validar normalización de 26 ámbitos: 25 regiones + extranjero.
- Validar join completo entre snapshot ONPE y `regions.meta.json`; fallo si falta una región o sobra una.
- Validar agrupación `Top 5 + Otros`:
  - `top5 + otros = 100%` por región, salvo tolerancia mínima por redondeo.
- Validar proyección:
  - regional = `electores * porcentaje`
  - nacional = suma regional / total electorado
- Validar resiliencia:
  - ONPE devuelve HTML
  - cookie vencida
  - timeout parcial
  - candidatos faltantes en una respuesta
- Validar UI:
  - carga inicial
  - stale state
  - orden y filtros
  - mobile y desktop
- Validar que el snapshot público nunca quede vacío aunque falle una corrida nueva.

## Supuestos y defaults
- La app será pública y read-only en el MVP.
- No habrá mapa ni panel admin en v1.
- La fuente operativa primaria será ONPE vía sync server-side, no Google Sheet.
- Los 5 candidatos destacados se mantienen como códigos `8, 35, 16, 10, 14`.
- La metadata de `electores` y `% padrón` se congela en un archivo local derivado de la hoja/JNE, para no depender del layout cambiante del Sheet.
- La actualización del cookie de ONPE seguirá siendo manual cuando expire; eso se resuelve cambiando secrets en Netlify.
- Se usará `Netlify Scheduled Functions` para el cron y `Netlify Blobs` para persistencia, ambos soportados oficialmente por Netlify:
  - [Scheduled Functions](https://docs.netlify.com/functions/scheduled-functions/)
  - [Netlify Blobs](https://docs.netlify.com/storage/blobs/overview/)
