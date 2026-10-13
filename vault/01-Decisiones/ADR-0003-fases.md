# ADR-0003 — Módulo 3 · Fases y avance real

- Estado: aceptada (propuestas P1–P9 confirmadas por el usuario el 2026-10-12) · Fecha: 2026-10-11
- Relacionados: [[ADR-0001-stack]], [[ADR-0002-modelo-datos-mvp]] (§2 y §3), [[Modulos]], [[Roles]], [[Funcionamiento-App]]
- Alcance: módulo 3 de [[Modulos]]. Contrato entre capas para `backend-engineer` y `frontend-engineer`.

## Contexto

Hoy el timeline muestra solo el **avance del plazo** (tiempo transcurrido). El módulo 3 añade fases por proyecto y un **avance real** (fases completadas). Escala y límites de servicio, como en ADR-0002: el frontend habla directo con Nhost GraphQL y la seguridad la impone Hasura; **no hay endpoints FastAPI nuevos** en este módulo.

Estado de cada punto:

| Etiqueta | Significado |
|---|---|
| **Decidido** | Lo fijó el usuario; no se cuestiona |
| **PROPUESTA** | Lo propone este ADR; el usuario debe confirmarlo (resumen en §10) |

**Decidido (usuario):**
- 7 fases fijas por proyecto: Levantamiento, Diseño, Configuración, Pruebas, Capacitación, Go-Live, Cierre. No se añaden, renombran, quitan ni reordenan; solo cambian fechas y estado.
- Fase condicional **Desarrollo** (intervienen desarrolladores), solo si el proyecto se basa en un desarrollo; lo marca el responsable al crear/editar el proyecto.
- El timeline muestra el avance real por fases (fases completadas / total) junto al avance del plazo.
- Proyectos existentes: 7 fases en Pendiente por migración idempotente, sin tocar sus fechas y sin Desarrollo.
- Todo proyecto nuevo nace con sus fases (trigger al insertar).

## Decisión

### 1. Modelo de datos y migración `db/002_fases.sql`

Idempotente, igual que `001`. `aplicar.py` ya ejecuta `db/[0-9]*.sql` en orden.

**Cambios en `proyectos`**
```sql
alter table public.proyectos
  add column if not exists requiere_desarrollo boolean not null default false;
```
- **PROPUESTA P1:** nombre `requiere_desarrollo`, default `false`.
- Es editable por el responsable (entra en `COLS_EDITABLES` de `aplicar.py`, por tanto en insert, select y update del rol `user`).

**Tabla `fases`**
```sql
create table if not exists public.fases (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  clave text not null check (clave in ('levantamiento','diseno','configuracion','desarrollo',
                                       'pruebas','capacitacion','go_live','cierre')),
  nombre text not null,
  orden int not null,
  fecha_inicio date,
  fecha_fin_plan date,
  estado public.estado_fase not null default 'pendiente',   -- enum pendiente|en_curso|completada
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (proyecto_id, orden),
  unique (proyecto_id, clave),
  check (fecha_fin_plan is null or fecha_inicio is null or fecha_fin_plan >= fecha_inicio)
);
create index if not exists fases_proyecto_idx on public.fases (proyecto_id, orden);
```
- El `create type estado_fase` va en un bloque `do $$ … exception when duplicate_object` como los de `001`.
- **PROPUESTA P8:** columnas `fecha_inicio` / `fecha_fin_plan` (mismo nombre que en `proyectos`; difiere del borrador `fecha_fin` de ADR-0002, que queda superado). `clave` es el identificador estable (el frontend nunca compara por `nombre`); queda lista para módulo 4.
- Plantilla fija (constante en la función SQL, no en una tabla): `orden` y `clave` son los de esta tabla. Los números dejan **un hueco en 4 cuando no hay Desarrollo**; así activar/desactivar no renumera nada y `unique(proyecto_id, orden)` se cumple siempre.

| orden | clave | nombre |
|---|---|---|
| 1 | levantamiento | Levantamiento |
| 2 | diseno | Diseño |
| 3 | configuracion | Configuración |
| 4 | desarrollo | Desarrollo (**solo si `requiere_desarrollo`**) |
| 5 | pruebas | Pruebas |
| 6 | capacitacion | Capacitación |
| 7 | go_live | Go-Live |
| 8 | cierre | Cierre |

- **PROPUESTA P1:** Desarrollo va entre Configuración y Pruebas (orden 4).

**Funciones y triggers (todos `create or replace` / `drop trigger if exists` + `create`)**
1. `crear_fases_proyecto(p public.proyectos)`: inserta las 7 fases y, si `p.requiere_desarrollo`, también Desarrollo; todo con `on conflict (proyecto_id, orden) do nothing`.
2. `proyectos_crear_fases` — `after insert on proyectos`: llama a (1). Convive con `proyectos_agregar_creador`; el orden entre ambos es indiferente.
3. `proyectos_sync_desarrollo` — `after update of requiere_desarrollo on proyectos … when (old.requiere_desarrollo is distinct from new.requiere_desarrollo)`:
   - `false → true`: inserta Desarrollo (`on conflict do nothing`), estado Pendiente, sin fechas.
   - `true → false`: si la fase Desarrollo existe y está `pendiente` **y** sin `fecha_inicio` ni `fecha_fin_plan`, la borra; si tiene avance o fechas, `raise exception` con el mensaje de §3 y **todo el UPDATE del proyecto se revierte**.
   - **PROPUESTA P2:** bloquear (no borrar a la fuerza) para no perder fechas/avance registrados sin querer.
4. `fases_proteger` — `before update on fases`: si cambian `proyecto_id`, `clave`, `nombre` u `orden`, `raise exception 'Las fases no se pueden renombrar, mover ni reordenar'`. Defensa en profundidad (Hasura ya no expone esas columnas).
5. `fases_tocar` — `before update on fases`: `actualizado_en := now()`.
6. `fases_evento` — `after insert or update or delete on fases` (implementado como `fases_evento` insert/delete + `fases_evento_update` con `when (old.* is distinct from new.*)`, para no registrar updates sin cambios) → reutiliza `registrar_evento()` (la fila trae `proyecto_id`, así que `eventos.proyecto_id` queda bien). Se engancha *antes* del backfill: las 7×N altas del backfill quedan en `eventos` con `usuario_id` null (queda constancia de que las creó la migración). Aceptado.
7. **Backfill** al final del archivo: `select public.crear_fases_proyecto(p) from public.proyectos p;`. Re-ejecutable (no duplica por el `on conflict`) y no toca fechas ni estados de proyectos. Como todos los proyectos existentes tienen `requiere_desarrollo = false`, quedan con 7 fases Pendiente.
8. Tabla de borde: `fases` no tiene `delete` desde la app; el borrado solo ocurre por cascada de `proyectos` (que tampoco se elimina por la app) o por el trigger (3).

**Cambios en `db/aplicar.py` (backend-engineer)**
- `tablas` += `"fases"`.
- `COLS_EDITABLES` += `"requiere_desarrollo"`.
- Relaciones: `fases.proyecto` (objeto, FK `proyecto_id`) y `proyectos.fases` (array, FK `fases.proyecto_id`).
- Permisos de `fases`: ver §2.
- Actualizar `db/README.md` (módulo 3, permisos, comando de prueba).

### 2. Permisos Hasura (rol `user`)

Reutilizan las expresiones ya definidas en `aplicar.py` (`soy_miembro`, `soy_responsable`), aplicadas vía la relación `proyecto`.

| Operación | Quién | Filtro | Columnas |
|---|---|---|---|
| select `fases` | cualquier miembro (responsable, colaborador, **cliente**) | `{proyecto: soy_miembro}` | `id, proyecto_id, clave, nombre, orden, fecha_inicio, fecha_fin_plan, estado, creado_en, actualizado_en` |
| update `fases` | solo `responsable` | filter y check: `{proyecto: soy_responsable}` | **solo** `estado, fecha_inicio, fecha_fin_plan` |
| insert `fases` | nadie | — (sin permiso) | — |
| delete `fases` | nadie | — (sin permiso) | — |
| update `proyectos` | solo `responsable` (sin cambios) | `soy_responsable` | `COLS_EDITABLES` + `requiere_desarrollo` |

- **Rol `cliente`:** ve las fases y el avance real en modo solo lectura (es información de seguimiento; ya ve fechas y estado del proyecto). **PROPUESTA P9:** el `colaborador` también es solo lectura en fases (ADR-0002 §3: sus updates son de tareas, módulo 4).
- **No suplantación:** `proyecto_id` no está entre las columnas actualizables y no hay insert, de modo que no se puede mover una fase a otro proyecto ni crear una para un proyecto ajeno. El filtro del update impide tocar fases de proyectos donde no se es responsable (resultado `null` / 0 filas). El trigger (4) lo repite en BD.
- **Desarrollo solo vía atributo:** como no hay insert ni delete en el rol `user`, la única forma de que exista o desaparezca la fase Desarrollo es el trigger (3), disparado por `proyectos.requiere_desarrollo`. Nada en el frontend la crea o borra.
- El rol `user` sigue sin ver `eventos` de `cliente` (sin cambios).

### 3. Reglas de negocio

**Estados y transiciones.** **PROPUESTA P3:** las 3 transiciones hacia delante y las correcciones hacia atrás se permiten sin restricción (`pendiente ⇄ en_curso ⇄ completada`, y `pendiente ⇄ completada`). Justificación: el responsable es un actor de confianza, los errores de captura deben poder corregirse, y un trigger de máquina de estados añade código sin proteger nada que Hasura ya no proteja. Lo que sí hay son **avisos en el frontend**, nunca bloqueos.

**Fase completada con fases anteriores sin completar.** **PROPUESTA P3b:** permitido, con aviso previo no bloqueante: «Hay fases anteriores sin completar: Levantamiento, Diseño. ¿Marcar igualmente como completada?» (confirmación en línea). Razón: en implementaciones reales las fases se solapan (p. ej. Capacitación mientras se cierran Pruebas) y bloquear obligaría a falsear estados. La orden `orden` no impone secuencia, solo presentación.

**Fechas de fase vs. proyecto.** **PROPUESTA P4:** no se bloquea; se avisa bajo la fila: «Estas fechas quedan fuera del plazo del proyecto (dd mmm aaaa – dd mmm aaaa)». Se compara solo si el proyecto tiene ambas fechas y la fase la fecha correspondiente. Sí es **error bloqueante** (también en BD): `fecha_fin_plan < fecha_inicio` de la propia fase. Las fases pueden solaparse entre sí sin aviso.

**Cierre del proyecto.** **PROPUESTA P6:** pasar el proyecto a `cerrado` **no modifica las fases** (no las completa automáticamente: se cerraría con datos falsos). El detalle muestra el aviso informativo «El proyecto está cerrado y tiene N fases sin completar» si aplica. Las fases siguen siendo editables por el responsable tras el cierre (corrección/historial); reabrir el proyecto es cambiar su estado.

**Atributo `requiere_desarrollo`.**
- Marcar (`false → true`): crea la fase Desarrollo Pendiente; el avance real pasa de total 7 a 8 (p. ej. 7/7 = 100 % pasa a 7/8 = 88 %). El frontend avisa antes de guardar: «Se añadirá la fase Desarrollo; el avance se recalculará sobre 8 fases.»
- Desmarcar (`true → false`): se quita solo si Desarrollo está Pendiente y sin fechas. Si no, el guardado falla con: «No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. Déjala en Pendiente y sin fechas e inténtalo de nuevo.» Para no depender del texto de Postgres, el frontend **deshabilita la casilla con ese mismo texto de ayuda** cuando la fase tiene fechas o estado distinto de Pendiente; el mensaje de BD es la red de seguridad.
- Si Hasura no propaga el texto del `raise exception` tal cual, el frontend lo mapea (detectar «Desarrollo») al mensaje anterior; el test de integración (§6) fija el comportamiento real.
- **Implementación (2026-10-12):** el `raise` usa `errcode = 'check_violation'` (23514). Con el código por defecto (P0001) Hasura solo devolvía «database query error»; con 23514 llega `"Check constraint violation. No se puede quitar la fase Desarrollo…"` (código `permission-error`) y el frontend lo mapea al mensaje de arriba. El borrado de Desarrollo es un `DELETE` condicional en una sola sentencia (sin carrera con un update concurrente de la fase).

### 4. Avance real y relación con el avance del plazo

- **Avance real** = fases `completada` / total de fases del proyecto (7 u 8), redondeado: `Math.round(100 * completadas / total)`. **PROPUESTA P5:** las `en_curso` no suman (sin medias fases; criterio verificable y sin ambigüedad). 100 % solo si todas están completadas. Sin fases (total 0, caso defensivo): `pct = null` y no se dibuja.
- **Avance del plazo**: sin cambios (`calcularBarra`, `timeline.ts`). Sigue midiendo tiempo transcurrido.
- Son **dos medidas independientes**; no se combinan en una sola ni se calcula un «semáforo» en este módulo (ver §9). Se muestran juntas para que se pueda leer el desvío a ojo.
- Función pura nueva en `frontend/src/fases.ts` (sin React, sin dependencias; igual patrón que `timeline.ts`):

```ts
export const ESTADOS_FASE = ['pendiente', 'en_curso', 'completada'] as const
export type EstadoFase = (typeof ESTADOS_FASE)[number]
export interface Fase { id: string; clave: string; nombre: string; orden: number; estado: EstadoFase;
                        fecha_inicio: string | null; fecha_fin_plan: string | null }

/** completadas / total; pct null si no hay fases. */
export function avanceFases(fases: { estado: EstadoFase }[]):
  { completadas: number; enCurso: number; total: number; pct: number | null }

/** Fases anteriores (por orden) a `fase` que no están completadas; para el aviso de §3. */
export function previasSinCompletar(fases: Fase[], faseId: string): Fase[]

/** Avisos no bloqueantes de fechas de una fase frente al proyecto ([] si no hay). */
export function avisoFechasFase(f: Pick<Fase, 'fecha_inicio'|'fecha_fin_plan'>,
  p: { fecha_inicio: string|null; fecha_fin_plan: string|null }): string | null

/** 'fechas' si TODAS las fases tienen inicio y fin válidos; si no, 'iguales'. */
export function modoTramos(fases: Fase[]): 'fechas' | 'iguales'

/** Tramos de la barra de fases en % del eje común (0–100). */
export function tramosFases(fases: Fase[], barra: { izq: number; ancho: number } | null, eje: Eje | null):
  { id: string; nombre: string; estado: EstadoFase; izq: number; ancho: number }[]
```

### 5. Contrato entre capas (frontend ↔ Hasura)

**Tipos (`frontend/src/tipos.ts`)**
```ts
export interface Proyecto {            // + campos nuevos
  /* …existente… */
  requiere_desarrollo: boolean
  fases: Fase[]                        // ordenadas por orden asc (order_by en la consulta)
}
export const CAMPOS_PROYECTO = `id nombre sistema fecha_inicio fecha_fin_plan estado requiere_desarrollo
  cliente { id nombre } miembros { user_id rol }
  fases(order_by: {orden: asc}) { id clave nombre orden estado fecha_inicio fecha_fin_plan }`
```
`Proyectos.tsx` y `ProyectoDetalle.tsx` ya consumen `CAMPOS_PROYECTO`, así que reciben las fases sin más cambios de consulta. Un proyecto trae ≤ 8 fases; no se pagina.

**Operaciones**

| Operación | GraphQL | Quién | Notas |
|---|---|---|---|
| Listar proyectos + fases | `{ proyectos(order_by:{creado_en:desc}) { ${CAMPOS_PROYECTO} } }` | miembros | sin cambio salvo campos |
| Detalle | `proyectos_by_pk(id:$id) { ${CAMPOS_PROYECTO} }` | miembros | |
| Editar fase | `mutation($id: uuid!, $s: fases_set_input!) { update_fases_by_pk(pk_columns:{id:$id}, _set:$s) { id estado fecha_inicio fecha_fin_plan actualizado_en } }` | responsable | `$s` solo con `estado`, `fecha_inicio`, `fecha_fin_plan` (`''` → `null`). Respuesta `null` = sin permiso (mensaje «No tienes permiso para editar este proyecto», como ya se hace) |
| Crear proyecto | `insert_proyectos_one(object: {…, requiere_desarrollo})` | cualquiera | las fases las crea el trigger; **no** se envían |
| Editar proyecto | `update_proyectos_by_pk(… _set: {…, requiere_desarrollo})` | responsable | tras guardar **recargar el proyecto con una consulta nueva**: en la misma mutación el `returning` no ve las filas creadas/borradas por el trigger |

No existen mutaciones `insert_fases*` ni `delete_fases*` para el rol `user` (no aparecen en el esquema). Errores: texto del mensaje de Hasura mostrado con `mensajeError`, como en el resto de la app.

**Formato:** fechas `YYYY-MM-DD` (tipo `date`, sin zona horaria), interpretadas en hora local por `parseFecha`; igual que proyectos.

**`CamposProyecto.tsx` / `ProyectoNuevo.tsx` / `ProyectoDetalle.tsx`**
- `Datos` += `requiere_desarrollo: boolean`. `set(k)` actual solo sirve para string; añadir un manejador propio para la casilla (o restringir `k` a las claves string).
- Casilla debajo de «Estado»: **«La implementación se basa en un desarrollo (añade la fase Desarrollo)»**, texto de ayuda: «Marca esta opción si intervienen desarrolladores.»
- `aInput` incluye `requiere_desarrollo`. `ProyectoNuevo` inicia en `false`. `ProyectoDetalle` la carga de `p.requiere_desarrollo`.
- En el detalle la casilla está deshabilitada si no es responsable (como el resto) o si Desarrollo ya tiene fechas/avance (texto de ayuda de §3).
- Al guardar el proyecto en el detalle, si cambió la casilla: confirmar el aviso de §3 al marcarla, y recargar el proyecto completo (consulta nueva) para refrescar la sección Fases.

**Sección «Fases» en el detalle** (componente nuevo `Fases.tsx`, bajo el formulario del proyecto y sobre Miembros)
- Cabecera: «Fases» + resumen «Avance real: N % (X de T fases completadas)».
- Una fila por fase, en orden: nombre (no editable), `estado` (select: Pendiente / En curso / Completada), `Inicio`, `Fin planificado` (`type=date`, `min` = inicio) y botón «Guardar» **por fila** (habilitado solo si hay cambios). Tras guardar: «Cambios guardados» en la fila y el avance se recalcula con el estado local (sin recargar todo).
- Responsable: edita. Colaborador y cliente: ven la fila como texto/campos deshabilitados y el texto «Solo lectura: únicamente el responsable puede editar.» (mismo patrón que el proyecto).
- Validaciones en cliente (la BD las repite): fin ≥ inicio («El fin no puede ser anterior al inicio»). Avisos amarillos no bloqueantes: fechas fuera del plazo del proyecto (P4) y fase completada con previas sin completar (P3b, confirmación antes de guardar).
- Proyecto con `requiere_desarrollo` activo: la fila Desarrollo aparece entre Configuración y Pruebas con la etiqueta «Desarrollo». Sin él, no hay fila.
- Si `fases` viene vacío (no debería): «Este proyecto aún no tiene fases.» sin acciones.

**Timeline (`LineaTiempo.tsx` + `timeline.ts`/`fases.ts`)**
- **Cifra principal:** «Avance real N %» con subtexto «X de T fases completadas». Debajo, en secundario, lo que ya existe: «Avance del plazo P % · Día X de Y · Quedan N días». **PROPUESTA P7.** Se cambia el texto de la nota superior: «**Avance real**: fases completadas. **Avance del plazo**: tiempo transcurrido del plan.»
- **Cerrado:** en lugar de la cifra principal sigue mostrando «Cerrado», más el subtexto «X de T fases completadas».
- **Barra del plazo:** sin cambios (relleno por tiempo, línea «Hoy», tramo de retraso).
- **Carril de fases:** franja nueva de ~10 px **debajo** de la barra del plazo, mismo eje x, un segmento por fase (los huecos de 2 px entre ellos son separación visual, no tiempo). Color por estado: Pendiente `slate-200`, En curso `blue-400`, Completada `green-600`. Cada segmento lleva `title` y la descripción accesible lista «Levantamiento: Completada; Diseño: En curso; …». No se rotula dentro de los tramos (no caben); el nombre de la(s) fase(s) En curso se escribe en el subtexto: «En curso: Configuración».
- **Cómo se dibuja (`modoTramos` / `tramosFases`):**
  1. **Modo `fechas`:** solo si **todas** las fases tienen inicio y fin válidos **y** existe eje común. Cada segmento va de `posicion(inicio)` a `posicion(fin)` en el eje (ancho mínimo 1 %, recortado a 0–100). Los solapes se dibujan encimados; gana la de mayor `orden`.
  2. **Modo `iguales`:** en cualquier otro caso (alguna fase sin fechas, o proyecto sin fechas). Las T fases se reparten en **ancho igual** sobre el tramo de la barra del proyecto (`tramoBarra`); si el proyecto no es dibujable (sin fechas), sobre el ancho completo de la fila. Es una representación de *secuencia y estado*, no de tiempo; se indica con un `title` «Las fases no tienen fechas: reparto en partes iguales».
  - Todo-o-nada (no se mezclan modos) para que la lectura sea predecible.
- La fila sin fechas de proyecto conserva su aviso actual y suma el carril en modo `iguales` y el avance real.
- El carril no altera el eje común (`rangoEje` sigue usando solo fechas de proyectos); fechas de fase fuera del rango se recortan en el borde.
- `Proyectos.tsx`: sin cambios de selección/recorte. El filtro por estatus no considera fases.

### 6. Pruebas requeridas

**Integración SQL + Hasura** — `backend/tests/test_fases_integracion.py` (mismo patrón que `test_permisos_integracion.py`: usuarios `zz-prueba-impl-*` por SQL admin, limpieza al terminar, se salta sin `NHOST_*`):
1. Proyecto nuevo (vía Hasura, usuario A) nace con 7 fases Pendiente, `orden` 1,2,3,5,6,7,8 y sin Desarrollo; con `requiere_desarrollo: true` nace con 8 (orden 4 = Desarrollo).
2. Marcar `requiere_desarrollo` en un proyecto existente crea Desarrollo; desmarcar con fase Pendiente y sin fechas la borra.
3. Desmarcar con Desarrollo con fechas o En curso falla, el proyecto **no** cambia (rollback) y se anota el texto real del error.
4. Responsable actualiza `estado` y fechas de una fase; queda un evento `fases/update` con su `usuario_id`.
5. Colaborador y cliente: leen fases; el update devuelve `null`/error; no hay `insert_fases_one` ni `delete_fases_by_pk` en el esquema del rol `user`.
6. Ajeno (no miembro): no ve fases ni puede actualizarlas; responsable de otro proyecto no puede actualizar fases del primero.
7. Intento de enviar `proyecto_id`, `orden`, `nombre` o `clave` en `_set` es rechazado por el esquema (campo inexistente).
8. `fecha_fin_plan < fecha_inicio` en una fase falla (CHECK).
9. **Migración:** crear proyecto por SQL sin fases, ejecutar `002_fases.sql` (o su backfill) dos veces: 7 fases exactas, sin duplicados, fechas del proyecto intactas.

**Funciones puras** — `frontend/pruebas/fases.test.mjs` (mismo comando que `timeline.test.mjs`: `node --test`): `avanceFases` (0/7, 3/7→43, 7/8→88, 8/8→100, vacío→null, en_curso no suma); `previasSinCompletar` (con hueco de orden en 4); `avisoFechasFase` (dentro, fuera, proyecto sin fechas, fase con una sola fecha); `modoTramos` (todas con fechas → `fechas`; una sin fecha → `iguales`; vacío); `tramosFases` (iguales suman el ancho de la barra; con fechas recortan a 0–100; ancho mínimo 1).

**Manual (QA):** crear proyecto con/sin Desarrollo; desmarcar con y sin fechas; ver timeline con fases sin fechas, con fechas y proyecto sin fechas; rol cliente en solo lectura.

### 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El `raise exception` del trigger llega a Hasura con un texto poco claro | Mensaje confuso al desmarcar | Casilla deshabilitada con ayuda + mapeo de mensaje + test 3 |
| `returning` de la mutación del proyecto no ve fases tocadas por trigger | UI desactualizada | Recargar el proyecto con consulta nueva tras guardar |
| `eventos` crece (≈8 altas por proyecto + cada cambio) | Volumen | Aceptable a la escala de ADR-0002 |
| Avance real subjetivo (nadie completa fases a tiempo) | Cifra engañosa | Se muestra junto al plazo; alertas de desvío quedan para después |
| Desmarcar `requiere_desarrollo` queda bloqueado | Fricción | Es deliberado (P2); el responsable resetea la fase primero |
| Fases solapadas en modo `fechas` dificultan la lectura | Visual | Modo documentado; aceptable en MVP |

### 8. Consecuencias

- Cero endpoints nuevos; la regla de «Desarrollo» vive en un único trigger, no duplicada en el frontend.
- El conjunto de fases queda inmodificable por diseño de permisos, no solo por UI.
- `eventos` registra los cambios de fases con el mismo mecanismo que `proyectos`.
- Hay que actualizar [[Funcionamiento-App]] tras la implementación (nueva sección de fases, cambio del timeline, mensajes nuevos) y marcar el módulo 3 en [[Modulos]].

### 9. A revisar al crecer

- **Tareas (módulo 4)** colgarán de `fases.id` (`tareas.fase_id` ya previsto en ADR-0002); el avance real podría pasar a ponderarse por tareas en lugar de fases completadas.
- **Plantillas de fases editables** por proyecto o cliente (hoy constante en `crear_fases_proyecto`); la columna `clave` permite migrar sin romper.
- **Alertas** (módulo 12): fase con fecha fin vencida y no completada; desvío avance real vs. plazo.
- Más fases condicionales (otro atributo booleano) si aparecen; evaluar una tabla de plantilla si son más de dos.
- Dependencias entre fases / secuencia obligatoria (hoy solo aviso).
- Pantalla de historial de `eventos`.

## 10. Propuestas pendientes de confirmar (resumen)

| # | Propuesta |
|---|---|
| P1 | Atributo `proyectos.requiere_desarrollo boolean default false`; fase Desarrollo con orden 4 (entre Configuración y Pruebas; hueco en el orden si no existe) |
| P2 | Desmarcar con Desarrollo con fechas/avance: **bloqueo con mensaje**; solo se borra si está Pendiente y sin fechas |
| P3 | Transiciones de estado libres; completar con previas sin completar **permitido con aviso** (P3b) |
| P4 | Fechas de fase fuera del rango del proyecto: **aviso**, no bloqueo; `fin < inicio` sí bloquea |
| P5 | Avance real = completadas / total (7 u 8), `en_curso` no suma, redondeo al entero |
| P6 | Cerrar el proyecto no toca las fases; siguen editables por el responsable |
| P7 | Timeline: avance real como cifra principal, plazo secundario; carril de fases bajo la barra; modo por fechas (todas con fechas) o partes iguales |
| P8 | Columnas `fecha_inicio`/`fecha_fin_plan` y `clave` estable en `fases` (reemplaza `fecha_fin` del borrador de ADR-0002) |
| P9 | Colaborador y cliente: solo lectura de fases (el cliente sí las ve) |

## Reparto de la implementación

- **`backend-engineer`:** `db/002_fases.sql`, cambios en `db/aplicar.py`, `db/README.md`, `backend/tests/test_fases_integracion.py`. No hay código FastAPI.
- **`frontend-engineer`:** `fases.ts`, `Fases.tsx`, `tipos.ts`, `CamposProyecto`/`ProyectoNuevo`/`ProyectoDetalle`, `LineaTiempo`, `frontend/pruebas/fases.test.mjs`.
- **En paralelo**, con este contrato; integra y verifica de extremo a extremo `developer` antes de QA. Cualquier cambio del contrato (nombres de columnas, relaciones, mutaciones) se consulta al arquitecto y se actualiza aquí.
- El implementador **decide**: estructura interna de componentes, estilos Tailwind, textos menores. **Consulta** antes de cambiar: nombres de columnas/relaciones, permisos, triggers, reglas de §3 y §4, o el uso de FastAPI.
