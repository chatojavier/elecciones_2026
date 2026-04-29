# Auditoria tecnica: backlog de mejoras frontend y Netlify Functions

Fecha de auditoria: 2026-04-29

## Objetivo

Este documento convierte la auditoria tecnica del codebase en insumos listos para crear tickets de trabajo. El foco es mejorar mantenibilidad, buenas practicas de React/TypeScript, principios SOLID y robustez de Netlify Functions sin reescrituras masivas.

## Estado general

El codebase tiene una base sana:

- TypeScript esta configurado en modo estricto.
- La logica de dominio, comparacion, formato, freshness y API esta separada en `src/lib/*`.
- Las Netlify Functions ya comparten modulos internos en `netlify/functions/_shared/*`.
- Existe cobertura relevante de tests: al momento de la auditoria se verificaron 74 tests pasando en 9 archivos.

Los riesgos principales no son de estilo superficial. Estan concentrados en:

- Sincronizacion serverless publica y costosa.
- Concurrencia no globalizada contra ONPE.
- Contratos JSON aceptados con casts sin validacion runtime.
- `src/App.tsx` acumulando demasiadas responsabilidades.
- Tipos de scopes que permiten estados invalidos.

## Principios de trabajo recomendados

- No hacer una reescritura completa.
- Priorizar cambios pequenos y testeables.
- Proteger primero la superficie serverless y los limites con datos externos.
- Modularizar la capa React por extraccion incremental, sin cambiar comportamiento visible.
- Mantener `App.tsx` como orquestador de alto nivel, no como contenedor de toda la logica de UI, estado y efectos.
- Mantener compatibilidad con snapshots legacy mientras exista data previa en Blob storage.

## Objetivo arquitectonico de modularizacion React

La aplicacion ya tiene buena separacion en `src/lib/*`, pero la capa React esta insuficientemente modularizada porque `src/App.tsx` concentra render, estado, efectos, tracking, comportamiento responsive y reglas de comparacion.

El objetivo no es crear carpetas por estetica, sino reducir acoplamiento y hacer que cada modulo tenga una razon clara para cambiar. La estructura objetivo sugerida es:

```txt
src/
  components/
    hero/
    global-controls/
    quick-insights/
    regional-results/
    foreign-results/
    methodology/
  hooks/
    useElectionData.ts
    useFreshnessStatus.ts
    useComparisonControls.ts
    useMobileGlobalControls.ts
  lib/
    api.ts
    comparison.ts
    domain.ts
    sorting.ts
    trust.ts
    validation.ts
  styles/
    app.css
```

Reglas para esta modularizacion:

- Extraer primero unidades con responsabilidad clara, no dividir por tamano de archivo solamente.
- Mantener componentes presentacionales con props pequenas y orientadas a la vista.
- Mantener hooks para estado, efectos y coordinacion con APIs/browser.
- Mantener calculos puros en `src/lib/*`.
- Evitar introducir un estado global si no hay un problema real de props drilling o sincronizacion entre ramas lejanas.

## Tickets propuestos

### TICKET 1 - Proteger y limitar la Netlify Function de sincronizacion

**Prioridad:** P0

**Severidad auditada:** Alta

**Archivos principales:**

- `netlify/functions/sync.ts`
- `netlify/functions/_shared/snapshot.ts`
- `netlify/functions/_shared/storage.ts`
- `src/lib/api.ts`

**Problema**

`netlify/functions/sync.ts` ejecuta `runSync()` para cualquier request que llegue a la function. No valida metodo HTTP, origen, secreto, scheduled event ni ventana minima entre sincronizaciones.

**Riesgo practico**

Un cliente externo puede disparar sincronizaciones completas contra ONPE y escrituras a Netlify Blobs. Esto puede generar abuso, costos innecesarios, rate limits, timeouts o fallos por concurrencia.

**Alcance sugerido**

- Rechazar metodos distintos de `POST` con `405`.
- Diferenciar ejecucion programada de ejecucion manual desde UI.
- Agregar una ventana minima entre syncs manuales, por ejemplo 2 a 5 minutos.
- Agregar un lock simple en Blob storage para evitar syncs simultaneos.
- Devolver respuestas consistentes: `200`, `202`, `401`, `405`, `429`, `500`.
- Evitar exponer detalles internos innecesarios en errores publicos.

**Criterios de aceptacion**

- `GET /.netlify/functions/sync` responde `405`.
- Dos requests manuales concurrentes no ejecutan dos `runSync()` completos.
- Si existe un sync reciente, la function responde con una respuesta controlada y no vuelve a consultar ONPE.
- La UI puede manejar el caso "sync ya reciente/en curso" sin mostrar error fatal.
- Hay tests para metodo invalido, sync reciente, lock activo, exito y error.

**Notas tecnicas**

- Si se usa un secreto, no exponerlo al cliente. Para refresh manual publico, preferir throttling/lock antes que un secreto client-side.
- El scheduled function de Netlify puede seguir usando la misma function si se detecta contexto programado de forma confiable. Si esto complica demasiado, separar en `sync.ts` publico limitado y `scheduled-sync.ts` programado.

---

### TICKET 2 - Implementar concurrencia global y timeout para requests ONPE

**Prioridad:** P0

**Severidad auditada:** Alta

**Archivos principales:**

- `netlify/functions/_shared/onpe.ts`
- `netlify/functions/_shared/snapshot.ts`
- `netlify/functions/_shared/config.ts`

**Problema**

`buildElectionSnapshot()` usa `Promise.all` para departamentos y continentes, y dentro de cada departamento limita provincias con `mapWithConcurrency(..., 6, ...)`. Ese limite es local por departamento, no global.

**Riesgo practico**

Un sync puede generar cientos de requests concurrentes hacia ONPE. Esto aumenta probabilidad de timeouts, HTML en vez de JSON, rate limits o bloqueo temporal.

**Alcance sugerido**

- Crear un helper compartido de concurrencia global para requests ONPE.
- Mover el control de concurrencia a `fetchOnpe` o a un wrapper comun.
- Agregar timeout por request con `AbortController`.
- Hacer configurable el limite global por variable de entorno, por ejemplo `ONPE_REQUEST_CONCURRENCY`.
- Hacer configurable el timeout, por ejemplo `ONPE_REQUEST_TIMEOUT_MS`.
- Mantener mensajes de error utiles pero sin filtrar headers/cookies.

**Criterios de aceptacion**

- No hay mas de N requests ONPE simultaneos durante un sync completo.
- Un request colgado falla con error controlado despues del timeout configurado.
- Los tests cubren cola global, timeout y propagacion de error.
- El comportamiento funcional del snapshot no cambia cuando ONPE responde correctamente.

**Notas tecnicas**

- Evitar duplicar controles de concurrencia por nivel geografico.
- El helper puede vivir en `netlify/functions/_shared/concurrency.ts` o dentro de `onpe.ts` si solo aplica a ONPE.

---

### TICKET 3 - Validar runtime los contratos JSON de snapshot, health y ONPE

**Prioridad:** P1

**Severidad auditada:** Media

**Archivos principales:**

- `src/lib/api.ts`
- `src/lib/normalizeSnapshot.ts`
- `src/lib/types.ts`
- `netlify/functions/_shared/onpe.ts`
- `netlify/functions/_shared/storage.ts`

**Problema**

La aplicacion usa casts como `as ElectionSnapshot`, `as HealthStatus` y `as OnpeEnvelope<T>` despues de leer JSON. TypeScript no valida esos datos en runtime.

**Riesgo practico**

Un cambio de contrato de ONPE, una respuesta parcial, o un Blob corrupto puede romper la UI o producir calculos incorrectos sin fallar temprano.

**Alcance sugerido**

- Definir validadores runtime minimos para:
  - `ElectionSnapshot`
  - `HealthStatus`
  - `OnpeEnvelope`
  - `OnpeTotals`
  - `OnpeParticipant`
  - `OnpeDepartment` / `OnpeProvince`
- Reemplazar casts directos en fronteras de datos por funciones `parse...`.
- Mantener `normalizeElectionSnapshot` para compatibilidad legacy, pero ejecutarlo despues de validar la estructura minima.
- Definir errores legibles para contrato invalido.

**Opciones de implementacion**

- Opcion A: incorporar Zod o Valibot.
- Opcion B: type guards manuales para evitar dependencia nueva.

**Recomendacion**

Para este repo, type guards manuales pueden ser suficientes si se validan campos criticos. Si el contrato crece, usar una libreria de schemas reduce duplicacion.

**Criterios de aceptacion**

- Un snapshot sin `national`, `foreign`, `regions` o fechas validas falla con error controlado.
- `health` invalido no rompe la UI; se usa fallback o se informa error controlado.
- ONPE envelope con `success=false`, `data=null` o shape invalida falla con mensaje claro.
- Tests cubren JSON invalido, shape incompleta y snapshot legacy valido.

---

### TICKET 4 - Modularizar manejo de datos y freshness desde `App`

**Prioridad:** P1

**Severidad auditada:** Media

**Archivos principales:**

- `src/App.tsx`
- Nuevo sugerido: `src/hooks/useElectionData.ts`
- Nuevo sugerido: `src/hooks/useFreshnessStatus.ts`

**Problema**

`src/App.tsx` contiene fetch inicial, refresh manual, auto-refresh, mensajes de freshness, tracking relacionado y estado visual.

**Riesgo practico**

La mezcla de IO, reglas de freshness y render dificulta modificar el comportamiento sin introducir regresiones. Tambien hace que los tests de UI carguen demasiada logica indirecta.

**Alcance sugerido**

- Crear `src/hooks/` si aun no existe.
- Extraer un hook `useElectionData` con:
  - `snapshot`
  - `health`
  - `loading`
  - `refreshing`
  - `error`
  - `refreshFeedback`
  - `loadInitial`
  - `refreshManual`
  - `refreshAuto`
- Extraer `useFreshnessStatus` para derivar:
  - `appLastSuccessAt`
  - `appFetchAgeMinutes`
  - `sourceAgeMinutes`
  - `appFreshnessStatus`
  - `nextAutoRefreshInMinutes`
  - `sourceHasNewCut`
  - `statusNote`
  - payload comun de tracking

**Criterios de aceptacion**

- `App.tsx` reduce responsabilidades sin cambiar copy ni estructura visual.
- `App.tsx` queda como consumidor del hook y orquestador de secciones, no como propietario directo de toda la logica de carga/freshness.
- Tests existentes siguen pasando.
- Hay tests unitarios para el hook o helpers de freshness si se extrae logica nueva.
- No se pierde el comportamiento de conservar snapshot visible cuando falla refresh en background.

**Fuera de alcance**

- Cambios visuales.
- Cambios en el modelo de proyeccion.

---

### TICKET 5 - Modularizar controles de comparacion y estado responsive desde `App`

**Prioridad:** P1

**Severidad auditada:** Media

**Archivos principales:**

- `src/App.tsx`
- Nuevo sugerido: `src/hooks/useComparisonControls.ts`
- Nuevo sugerido: `src/hooks/useMobileGlobalControls.ts`
- Nuevo sugerido: `src/components/GlobalControls.tsx`

**Problema**

La seleccion de candidatos A/B, validacion, fallback, modo de comparacion, show others, reset, overlay movil y tracking viven dentro de `App`.

**Riesgo practico**

El componente principal queda acoplado a reglas de negocio, analytics, responsive behavior y markup. Esto afecta SRP y hace mas dificil extender controles sin tocar logica central.

**Alcance sugerido**

- Crear una carpeta `src/components/global-controls/`.
- Extraer `useComparisonControls(snapshot)` con:
  - opciones de candidatos
  - `comparisonPair`
  - validacion de candidato duplicado
  - ajuste automatico si cambia el snapshot
  - reset a defaults
  - labels derivados
- Extraer `useMobileGlobalControls(ref)` con:
  - deteccion mobile
  - sticky state
  - overlay open/close
  - bloqueo de scroll
- Mover markup de controles a `GlobalControls`.
- Mantener `GlobalControls` como componente presentacional: recibe estado, opciones y callbacks; no llama directamente a `fetch`, `refreshAppData` ni funciones de ONPE.

**Criterios de aceptacion**

- El cambio de candidato A/B conserva validaciones actuales.
- Cuando cambia el snapshot y falta un candidato, se mantiene el ajuste automatico existente.
- El overlay movil conserva comportamiento actual.
- La logica de comparacion queda testeable sin renderizar toda la app.
- Tests existentes de `App` siguen pasando o se distribuyen en tests de hook/componente.

---

### TICKET 5B - Extraer secciones presentacionales principales

**Prioridad:** P2

**Severidad auditada:** Media

**Archivos principales:**

- `src/App.tsx`
- Nuevo sugerido: `src/components/hero/Hero.tsx`
- Nuevo sugerido: `src/components/quick-insights/QuickInsights.tsx`
- Nuevo sugerido: `src/components/regional-results/RegionalResultsTable.tsx`
- Nuevo sugerido: `src/components/foreign-results/ForeignResultsTable.tsx`
- Nuevo sugerido: `src/components/leaf-scope-drilldown/LeafScopeDrilldown.tsx`

**Problema**

Aunque se extraigan hooks, `App.tsx` seguiria teniendo demasiado markup si conserva hero, resumen rapido, controles, tabla regional, tabla exterior y metodologia en el mismo archivo.

**Riesgo practico**

Cambios visuales o de copy en una seccion obligan a trabajar dentro de un archivo muy grande, con mayor probabilidad de conflictos y regresiones accidentales.

**Alcance sugerido**

- Extraer componentes presentacionales por seccion.
- Mantener callbacks y datos preparados entrando por props.
- Evitar que estos componentes conozcan endpoints o detalles de Netlify Functions.
- Mantener CSS existente inicialmente; no hacer rediseño visual en este ticket.
- Crear tests enfocados solo donde haya logica condicional relevante.

**Criterios de aceptacion**

- `App.tsx` queda como composicion de secciones y hooks.
- Cada seccion principal vive en su propio modulo.
- Los componentes extraidos no importan `fetchAppData`, `refreshAppData`, `runSync` ni APIs serverless.
- No cambia el HTML/copy visible salvo ajustes minimos inevitables.
- Tests existentes siguen pasando.

---

### TICKET 6 - Consolidar sorting de regiones, provincias y exterior

**Prioridad:** P2

**Severidad auditada:** Media

**Archivos principales:**

- `src/App.tsx`
- Nuevo sugerido: `src/lib/sorting.ts`
- Posible test nuevo: `tests/sorting.test.ts`

**Problema**

`sortRegions`, `sortLeafScopes` y `sortForeignContinents` duplican ramas para `candidate`, `projection`, `actas`, `participacion` y `gap_2v3`.

**Riesgo practico**

Agregar o corregir un criterio de orden obliga a modificar varias funciones similares. Es facil que regiones, provincias y exterior diverjan.

**Alcance sugerido**

- Crear un comparator comun basado en accessors.
- Mantener diferencias justificadas:
  - regiones usan `electores` como tie-breaker cuando existe.
  - leaf scopes pueden usar `totalVotosValidos`.
  - continentes pueden no tener electores reales.
- Exportar funciones especificas pero implementadas con helper comun:
  - `sortRegions`
  - `sortLeafScopes`
  - `sortForeignContinents`

**Criterios de aceptacion**

- El orden actual no cambia para casos cubiertos por tests.
- Hay tests para cada `SortKey`.
- Agregar un nuevo criterio de orden requiere tocar un punto central, no tres switches duplicados.

---

### TICKET 7 - Refinar tipos de scopes como union discriminada real

**Prioridad:** P2

**Severidad auditada:** Media

**Archivos principales:**

- `src/lib/types.ts`
- `src/lib/domain.ts`
- `src/lib/comparison.ts`
- `netlify/functions/_shared/snapshot.ts`

**Problema**

`ScopeResult.kind` permite `"department"` y `"foreign_continent"`, pero `ScopeResult` no contiene `provinces` ni `countries`. Esos campos aparecen en interfaces derivadas.

**Riesgo practico**

El sistema de tipos permite representar scopes invalidos. Esto reduce el valor de una discriminated union y obliga a casts o optional chaining innecesarios.

**Alcance sugerido**

- Crear `BaseScopeResult`.
- Definir tipos concretos:
  - `NationalResult`
  - `RegionResult`
  - `ForeignResult`
  - `ForeignContinentResult`
  - `ProvinceResult`
  - `ForeignCountryResult`
- Definir union:
  - `AnyScopeResult`
  - `ComparableScope`
  - `LeafScopeResult`
- Ajustar funciones que hoy reciben `ScopeResult` generico.

**Criterios de aceptacion**

- No se puede construir un `foreign_continent` sin `countries` a nivel TypeScript.
- No se puede construir un `department` sin `provinces` cuando el tipo esperado es `RegionResult`.
- Se eliminan casts u optional chaining innecesarios relacionados con `countries`.
- Tests existentes siguen pasando.

**Nota**

Este ticket puede tocar varios archivos. Conviene hacerlo despues de tickets de validacion y extraccion para reducir conflictos.

---

### TICKET 8 - Mejorar accesibilidad del overlay movil de controles

**Prioridad:** P3

**Severidad auditada:** Baja

**Archivos principales:**

- `src/App.tsx`
- Futuro si se extrae: `src/components/GlobalControls.tsx`

**Problema**

El overlay movil usa `role="dialog"`, pero no declara `aria-modal`, no gestiona foco inicial, no restaura foco al cerrar y no maneja Escape.

**Riesgo practico**

Usuarios de teclado o lectores de pantalla pueden quedar con una experiencia ambigua al abrir los filtros.

**Alcance sugerido**

- Agregar `aria-modal="true"` cuando el overlay esta abierto.
- Mover foco al primer control del dialog al abrir.
- Restaurar foco al boton que abrio el overlay al cerrar.
- Cerrar con Escape.
- Verificar que el body scroll lock se mantiene.

**Criterios de aceptacion**

- Al abrir overlay, el foco entra al dialog.
- Escape cierra el overlay.
- Al cerrar, el foco vuelve al boton de filtros.
- Tests cubren open, close y Escape.

---

### TICKET 9 - Estabilizar payloads derivados usados por efectos de analytics

**Prioridad:** P3

**Severidad auditada:** Baja

**Archivos principales:**

- `src/App.tsx`
- Futuro si se extrae: hooks de analytics/freshness/comparison

**Problema**

Objetos como `quickInsightsTrackingBase` y `appFreshnessPayload` se crean en cada render y se usan como dependencias de `useEffect`.

**Riesgo practico**

Los guards por `ref` evitan duplicados visibles, pero los efectos se ejecutan mas de lo necesario y quedan mas dificiles de razonar con exhaustive deps.

**Alcance sugerido**

- Usar `useMemo` para payloads derivados o construirlos dentro del efecto.
- Mantener dependencias primitivas cuando sea posible.
- Mantener los guards por key para evitar doble tracking.

**Criterios de aceptacion**

- No cambia la cantidad de eventos emitidos en tests existentes.
- Los efectos tienen dependencias estables y explicables.
- No se agregan `eslint-disable` ni supresiones artificiales.

## Orden recomendado de ejecucion

1. **TICKET 1** - Proteger y limitar `sync`.
2. **TICKET 2** - Concurrencia global y timeout ONPE.
3. **TICKET 3** - Validacion runtime de contratos JSON.
4. **TICKET 4** - Modularizar datos/freshness desde `App`.
5. **TICKET 5** - Modularizar comparacion y controles mobile.
6. **TICKET 5B** - Extraer secciones presentacionales principales.
7. **TICKET 6** - Consolidar sorting.
8. **TICKET 7** - Refinar tipos de scopes.
9. **TICKET 8** - Accesibilidad del overlay movil.
10. **TICKET 9** - Estabilizar payloads de analytics.

## Agrupacion sugerida por epicas

### Epica A - Robustez serverless y datos externos

- TICKET 1
- TICKET 2
- TICKET 3

Objetivo: reducir riesgo operativo, fallos por contrato y abuso de endpoints.

### Epica B - Modularizacion de la capa React

- TICKET 4
- TICKET 5
- TICKET 5B
- TICKET 8
- TICKET 9

Objetivo: separar estado, efectos, presentacion, comportamiento responsive y tracking para que `App.tsx` sea un orquestador de alto nivel y los componentes sean reutilizables/testeables.

### Epica C - Modelo de dominio y extensibilidad

- TICKET 6
- TICKET 7

Objetivo: reducir duplicacion y mejorar contratos TypeScript internos.

## Definicion de terminado global

Para considerar cerrada esta iniciativa:

- `npm test` o equivalente local pasa completo.
- `npm run build` pasa completo.
- No se introducen cambios visuales no intencionales.
- La UI mantiene carga inicial, refresh manual, auto-refresh, busqueda, ordenamiento y comparacion A/B.
- Las Netlify Functions devuelven errores consistentes.
- Los nuevos validadores o helpers tienen tests unitarios.
- La documentacion de variables de entorno nuevas queda actualizada si se agregan `ONPE_REQUEST_CONCURRENCY`, `ONPE_REQUEST_TIMEOUT_MS` u otras.

## Riesgos y dependencias

- Si ONPE cambia shape o bloquea concurrencia agresiva, TICKET 2 y TICKET 3 deben priorizarse antes de refactors React.
- Si hay snapshots legacy en Blob storage, TICKET 3 debe preservar normalizacion backward-compatible.
- TICKET 7 puede generar muchos cambios de tipos. Conviene hacerlo despues de extraer parte de `App` para evitar un diff demasiado amplio.
- Si se decide agregar una libreria de validacion, revisar impacto en bundle client-side. Validadores usados solo en Netlify Functions pueden vivir fuera del bundle de UI.
