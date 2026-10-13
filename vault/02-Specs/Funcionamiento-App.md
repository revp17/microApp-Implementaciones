# Funcionamiento de la app (módulos Proyectos y Fases)

- **Versión:** v0.3 · **Fecha:** 2026-10-13
- **Módulos cubiertos:** Acceso (login/registro), Proyectos (pantalla principal con timeline, alta y detalle), Miembros del proyecto ([[Modulos]] n.º 1), Fases y avance real ([[Modulos]] n.º 3, [[ADR-0003-fases]])
- **Estado:** módulo 1 dado por hecho por el usuario (2026-10-11); módulo 3 probado en local por el usuario (2026-10-13)
- **Documento vivo:** se actualiza cuando el usuario lo indica, tras probar la app

## 1. Visión general

La app permite a un equipo crear proyectos de implementación de sistemas/ERP, registrar sus datos generales, decidir quién participa y con qué rol, seguir sus fases y ver de un vistazo el avance real (fases completadas) frente al avance del plazo. Hoy existen los módulos de Proyectos y Fases; el resto de módulos de [[Modulos]] aún no está construido. Cada persona ve únicamente los proyectos en los que es miembro.

```
Login / Registro ──► Pantalla principal (timeline) ──┬──► Nuevo proyecto ──► (vuelve al timeline)
   (verifica email)        ▲                         │
                           │                         └──► Detalle del proyecto ──► Fases ──► Miembros
                           └──────────────── "← Proyectos" ◄──────────────────────┘
```

## 2. Pantallas

### 2.1 Login / Registro
**Para qué sirve:** identificar a la persona antes de entrar a la app.
**Qué ve y qué puede hacer**
- Campos: Correo y Contraseña (mínimo 9 caracteres).
- Botón "Entrar" (modo Iniciar sesión) o "Registrarme" (modo Crear cuenta); un enlace alterna entre ambos modos.
- Al registrarse, aparece el aviso: "Cuenta creada. Revisa tu correo para verificarla y luego inicia sesión." No se entra hasta confirmar el correo.
- Una vez dentro, la cabecera muestra el correo del usuario y el botón "Salir", que cierra la sesión y vuelve al login.
- Si la sesión caduca o deja de ser válida, la app vuelve sola al login.

**Quién puede usarlo:** cualquier persona (el registro es abierto).
**Reglas importantes:** el correo debe verificarse antes de iniciar sesión; un usuario nuevo no ve ningún proyecto hasta que lo creen o lo agreguen a uno.

### 2.2 Pantalla principal (timeline de proyectos)
**Para qué sirve:** ver de un vistazo en qué punto del plazo está cada proyecto y acceder a él. Reemplaza a la antigua lista de tarjetas.
**Qué ve y qué puede hacer**
- Arriba: título "Proyectos", el filtro **Estatus** y el botón "Nuevo proyecto".
- **Estatus** (aparece cuando hay al menos un proyecto): Activos (Planificado y En curso, valor por defecto), Planificado, En curso, Pausado, Cerrado y Todos.
- **Tope de 3:** solo se muestran los 3 proyectos más recientes del estatus elegido. Si hay más, aparece "Mostrando los 3 más recientes de N proyectos." y el botón "Ver todos (N)"; al pulsarlo se ven todos (aviso "Mostrando los N proyectos.") y el botón pasa a "Ver solo los 3 más recientes". Al cambiar de estatus se vuelve al tope de 3.
- **Proyecto:** selector "Todos los proyectos" o uno concreto, que deja en el timeline solo ese proyecto. Ofrece únicamente los proyectos visibles con el estatus y el tope vigentes.
- **Timeline:** una fila por proyecto con su nombre (clic abre el detalle), etiqueta de estatus y cliente; bajo ellos, el avance real, el avance del plazo, la barra del plazo y el carril de fases.
- Mensajes: "Cargando…", "Aún no tienes proyectos. Crea el primero." y "No hay proyectos en estatus X. Cambia el filtro «Estatus» (arriba) a otro estatus o a «Todos» para ver el resto." cuando el filtro no encuentra ninguno.

**Cómo leer cada fila**
- **Nota superior:** "Avance real: fases completadas. Avance del plazo: tiempo transcurrido del plan."
- **Avance real (cifra principal):** "Avance real N%" = fases Completadas / total de fases (7, u 8 con Desarrollo), redondeado. Las fases En curso no suman. Debajo: "X de T fases completadas" y, si hay, "En curso: …".
- **Carril de fases:** franja fina bajo la barra del plazo, un tramo por fase en su orden. Pendiente = hueco con borde gris, En curso = azul, Completada = verde. Al pasar el ratón se ve el nombre y estado de cada fase.
  - Si **todas** las fases tienen inicio y fin, cada tramo se dibuja en sus fechas sobre el eje común (los solapes se superponen).
  - Si alguna no tiene fechas (o el proyecto no las tiene), las fases se reparten en **partes iguales** sobre la barra del proyecto (o sobre todo el ancho si el proyecto no tiene fechas): muestra secuencia y estado, no tiempo.
- **Barra:** va de la fecha de inicio a la de fin planificado; el relleno muestra el tiempo transcurrido. Una línea roja marca **"Hoy · fecha"** (la fecha de hoy aparece arriba, sobre el eje).
- **Fechas:** bajo la barra se muestran "Inicio: …" y "Fin plan: …" con fecha completa (p. ej. 5 mar 2026).
- **Avance del plazo (%)** (secundario): mide el **tiempo transcurrido del plan, no el avance del trabajo**. Junto al % se ve "Día X de Y" (solo mientras el plazo corre) y "Quedan N días" o "Vence hoy".
- **Antes de empezar:** 0 % y "Inicia en N días".
- **Con retraso** (pasó la fecha de fin y el proyecto no está cerrado): 100 %, barra en rojo, "N días de retraso" y un tramo rayado desde el fin hasta hoy.
- **Cerrado:** en lugar de las cifras muestra "Cerrado" y "X de T fases completadas", sin porcentaje ni días.
- **Eje común:** todas las filas visibles comparten escala de tiempo (marcas por mes), de modo que se pueden comparar entre sí; el eje siempre incluye la fecha de hoy.
- **Sin fechas o fechas invertidas:** el proyecto aparece igualmente como una fila, sin barra del plazo pero con avance real y carril de fases (partes iguales), con el aviso "Sin fechas planificadas · abre el proyecto para definirlas" o "El fin es anterior al inicio · abre el proyecto para corregirlo".

**Quién puede usarlo:** cualquier usuario con sesión; solo ve proyectos donde es miembro (cualquier rol).
**Reglas importantes**
- El orden es del proyecto más reciente (por fecha de creación) al más antiguo.
- El estado visual de la barra (antes / en plazo / con retraso) depende solo de las fechas y de si el proyecto está Cerrado; un proyecto Pausado o Planificado se dibuja según sus fechas.
- El estatus elegido se conserva al abrir un detalle y volver.
- El sistema/ERP ya no aparece aquí; solo en el detalle del proyecto.
- No hay búsqueda por texto.

### 2.3 Nuevo proyecto
**Para qué sirve:** dar de alta un proyecto, con un cliente existente o uno nuevo.
**Qué ve y qué puede hacer**
- **Cliente:** lista de clientes visibles para la persona, más la opción "+ Nuevo cliente…" (pide el nombre, obligatorio, máx. 200).
- **Nombre del proyecto** (obligatorio, máx. 200), **Sistema / ERP** (opcional, máx. 200), **Inicio** y **Fin planificado** (opcionales; el fin no puede ser anterior al inicio), **Estado** (Planificado por defecto) y la casilla **"La implementación se basa en un desarrollo (añade la fase Desarrollo)"** (ayuda: "Marca esta opción si intervienen desarrolladores."), desmarcada por defecto.
- Botones "Crear proyecto" y "Cancelar".
- Si falla la creación del proyecto tras crear el cliente nuevo, al reintentar se reutiliza ese cliente (no se duplica).
- **Al guardar** se vuelve a la pantalla principal y el proyecto nuevo queda siempre visible: si es Planificado o En curso, el estatus pasa a "Activos" (salvo que ya se viera); si es Pausado o Cerrado, el estatus pasa a ese estado; además el selector "Proyecto" vuelve a "Todos los proyectos" y el tope vuelve a 3 (sin "Ver todos" expandido). Al cambiar el filtro de estatus manualmente, el selector "Proyecto" también vuelve a "Todos los proyectos".

**Quién puede usarlo:** cualquier usuario con sesión.
**Reglas importantes:** quien crea el proyecto queda automáticamente como **responsable**. Todo proyecto nace con sus **7 fases** en Pendiente (Levantamiento, Diseño, Configuración, Pruebas, Capacitación, Go-Live, Cierre), más **Desarrollo** entre Configuración y Pruebas si se marcó la casilla. Un cliente existente solo puede usarse si lo creó la persona o es responsable de algún proyecto de ese cliente. Un proyecto sin fechas se crea sin problema, pero no tendrá barra en el timeline.

### 2.4 Detalle / edición de proyecto
**Para qué sirve:** consultar y modificar los datos generales de un proyecto.
**Qué ve y qué puede hacer**
- Nombre, cliente (solo lectura), Sistema / ERP, Inicio, Fin planificado y Estado: **Planificado, En curso, Pausado, Cerrado**, y la casilla de Desarrollo.
- Botón "Guardar" y aviso "Cambios guardados" (solo responsable).
- Quien no es responsable ve los campos bloqueados y el texto "Solo lectura: únicamente el responsable puede editar."
- **Casilla de Desarrollo:** al marcarla y guardar se pide confirmar "Se añadirá la fase Desarrollo; el avance se recalculará sobre 8 fases." ("Guardar y añadir la fase"). Al desmarcarla, la fase se quita solo si está Pendiente y sin fechas; si no, la casilla no deja desmarcarse y muestra "No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. Déjala en Pendiente y sin fechas e inténtalo de nuevo."
- Al guardar un cambio de la casilla se recarga el proyecto: los cambios **sin guardar** en filas de Fases se descartan.
- Debajo aparecen las secciones Fases (2.5) y Miembros; "← Proyectos" vuelve a la pantalla principal, que se refresca con los cambios.

**Quién puede usarlo:** ver, todos los miembros; editar, solo el responsable.
**Reglas importantes:** el cliente de un proyecto no se puede cambiar desde la pantalla; los proyectos no se pueden eliminar. Cambiar las fechas o el estado actualiza la barra del timeline.

### 2.5 Fases del proyecto
**Para qué sirve:** registrar fechas y estado de cada fase de la implementación y ver el avance real.
**Qué ve y qué puede hacer**
- Cabecera "Fases" con "Avance real: N % (X de T fases completadas)".
- Una fila por fase, en orden fijo: nombre, **Estado** (Pendiente / En curso / Completada), **Inicio**, **Fin planificado** y un botón **"Guardar"** por fila (activo solo si hay cambios). Tras guardar: "Cambios guardados" y el avance se recalcula.
- **Error (bloquea):** "El fin no puede ser anterior al inicio".
- **Avisos (no bloquean):**
  - Fechas fuera del plazo del proyecto: "Estas fechas quedan fuera del plazo del proyecto (inicio – fin)".
  - Completar una fase con anteriores sin completar: "Hay fases anteriores sin completar: …. ¿Marcar igualmente como completada?" con "Sí, marcar como completada" / "Cancelar".
  - Proyecto cerrado: "El proyecto está cerrado y tiene N fases sin completar" (las fases siguen editables).
- Quien no es responsable ve las filas bloqueadas y "Solo lectura: únicamente el responsable puede editar."
- Sin fases (no debería ocurrir): "Este proyecto aún no tiene fases."

**Quién puede usarlo:** ver, todos los miembros (también el rol cliente); editar, solo el responsable.
**Reglas importantes**
- Las fases son fijas: no se crean, borran, renombran ni reordenan. Solo cambian fechas y estado. Desarrollo solo aparece o desaparece con la casilla del proyecto.
- Los estados se pueden cambiar libremente en cualquier sentido (para corregir errores) y las fases pueden solaparse.
- Cerrar el proyecto no completa las fases automáticamente.
- Cada cambio de fase queda registrado en el historial (sin pantalla aún).

### 2.6 Miembros del proyecto
**Para qué sirve:** definir quién participa en el proyecto y con qué rol.
**Qué ve y qué puede hacer**
- Lista de miembros con correo, rol y "(tú)" junto al propio usuario.
- El responsable además ve: botón "Quitar" (en colaboradores y clientes) y un formulario con correo + rol (Colaborador / Cliente) + botón "Añadir".

**Quién puede usarlo:** ver, todos los miembros; añadir y quitar, solo el responsable.
**Reglas importantes**
- La persona debe estar **ya registrada** en la app con ese correo.
- Solo se asignan los roles colaborador y cliente; no hay cambio de rol ni se agregan más responsables desde la pantalla.
- Un miembro no puede añadirse dos veces.
- No se puede quitar al último responsable (en pantalla el botón "Quitar" no aparece para los responsables).

## 3. Roles y acciones

| Acción | Responsable | Colaborador | Cliente |
|---|---|---|---|
| Crear cliente y proyecto (queda como responsable) | Sí | Sí* | Sí* |
| Ver el proyecto, su timeline y sus datos | Sí | Sí | Sí |
| Editar datos y estado del proyecto (incl. casilla Desarrollo) | Sí | No | No |
| Ver fases y avance real | Sí | Sí | Sí |
| Editar fechas y estado de las fases | Sí | No | No |
| Ver miembros (con correo) | Sí | Sí | Sí |
| Añadir / quitar miembros | Sí | No | No |
| Ver historial de cambios (registrado, sin pantalla aún) | Sí | Sí | No |

\* Crear no depende del rol dentro de un proyecto: cualquier usuario con sesión puede crear los suyos.

## 4. Mensajes comunes

| Mensaje | Qué significa |
|---|---|
| Sesión expirada / Sesión no válida / Falta el token de sesión | La sesión caducó; hay que iniciar sesión de nuevo |
| Proyecto no encontrado | No existe o la persona no es miembro (no se distingue) |
| No tienes permiso para editar este proyecto | Se intentó guardar sin ser responsable |
| Solo el responsable puede gestionar miembros | Un colaborador/cliente intentó añadir o quitar |
| No hay ningún usuario registrado con ese correo | El correo no tiene cuenta; la persona debe registrarse primero |
| Ese usuario ya es miembro del proyecto | Alta duplicada |
| Ese usuario no es miembro del proyecto | Se intentó quitar a alguien que ya no está |
| No se puede quitar al último responsable | El proyecto debe conservar al menos un responsable |
| No se pudo contactar con Nhost / Respuesta no válida de Nhost / Error consultando la base de datos | Falla temporal del servicio; reintentar |
| Error NNN | Error del servidor sin detalle |
| Aún no tienes proyectos. Crea el primero. | La persona no es miembro de ningún proyecto |
| No hay proyectos en estatus X. Cambia el filtro «Estatus»… | Hay proyectos, pero ninguno con el estatus elegido; el texto indica cómo ver los demás (otro estatus o «Todos») |
| Mostrando los 3 más recientes de N proyectos. | Hay más proyectos que el tope; usar "Ver todos (N)" |
| Sin fechas planificadas · abre el proyecto para definirlas | El proyecto no tiene inicio y/o fin; no se puede dibujar la barra |
| El fin es anterior al inicio · abre el proyecto para corregirlo | Las fechas están invertidas; no se puede dibujar la barra |
| El fin no puede ser anterior al inicio | Fechas de una fase invertidas; no se puede guardar la fila |
| Estas fechas quedan fuera del plazo del proyecto (…) | Aviso: la fase sale del rango del proyecto; se puede guardar |
| Hay fases anteriores sin completar: … ¿Marcar igualmente como completada? | Aviso con confirmación; las fases no imponen secuencia |
| Se añadirá la fase Desarrollo; el avance se recalculará sobre 8 fases. | Confirmación al marcar la casilla de Desarrollo |
| No se puede quitar la fase Desarrollo porque ya tiene fechas o avance… | Para quitar Desarrollo, dejarla en Pendiente y sin fechas primero |
| El proyecto está cerrado y tiene N fases sin completar | Informativo; las fases no se completan solas al cerrar |
| Este proyecto aún no tiene fases. | Caso anómalo; no debería ocurrir |

Los errores de registro/login (correo ya usado, contraseña incorrecta, correo sin verificar) los devuelve el servicio de acceso con su propio texto, que se muestra tal cual.

## 5. Limitaciones conocidas / fuera de alcance

- No existen aún: Alcance, Tareas, Requerimientos, Riesgos, Cambios, Pruebas, Capacitación, Go-Live, Cierre ni Alertas por email.
- El **avance real** cuenta solo fases Completadas (las En curso no suman); no pondera por tareas (módulo 4) ni genera alertas de desvío (módulo 12).
- Las fases son una plantilla fija; no hay fases personalizadas ni dependencias entre fases.
- El carril de fases solo se dibuja "por fechas" si todas las fases tienen fechas; si no, en partes iguales.
- **El sistema/ERP no aparece en la pantalla principal**, solo en el detalle del proyecto.
- La pantalla principal muestra como máximo 3 proyectos por estatus salvo que se use "Ver todos"; no hay búsqueda por texto ni ordenación elegible.
- Un proyecto sin fechas no tiene barra; hay que abrirlo para definirlas.
- No hay pantalla de historial de cambios (se registra pero no se muestra) ni aprobaciones del cliente.
- El rol cliente ve los correos de todo el equipo del proyecto.
- Registro abierto: cualquiera puede crear cuenta, clientes y proyectos propios (riesgo aceptado por ahora, ver [[ADR-0002-modelo-datos-mvp]]).
- Un responsable puede saber si un correo está registrado (error 404 en el alta).
- No hay cambio de rol de un miembro, ni más de un responsable desde la pantalla, ni eliminación de proyectos o clientes.
- No hay edición de clientes.
- Un colaborador o cliente ve en el selector clientes de sus proyectos, pero solo podrá usarlos para un proyecto nuevo si es responsable en alguno de ese cliente (si no, la creación falla con un mensaje técnico del servicio).

## 6. Detalle técnico

- **Frontend** (React, navegador): todas las pantallas; proyectos, clientes y fases se leen/escriben directo contra Nhost (GraphQL) con la sesión del usuario. El timeline, el avance real y el carril se calculan en el navegador.
- **Base de datos:** las fases las crea y mantiene la propia BD (triggers de `db/002_fases.sql`): al crear un proyecto y al marcar/desmarcar Desarrollo.
- **Nhost:** autenticación (con verificación de correo), base de datos PostgreSQL y permisos por fila (Hasura) que deciden quién ve y edita.
- **Backend FastAPI:** solo la gestión de miembros (listar, añadir, quitar); valida la sesión contra Nhost y usa credenciales de servidor para resolver correos.
- Detalle de datos y permisos: [[ADR-0002-modelo-datos-mvp]], [[ADR-0003-fases]] y [[Roles]].

## 7. Registro de cambios

| Versión | Fecha | Qué cambió | Origen |
|---|---|---|---|
| v0.1 | 2026-10-09 | Primera versión: login/registro, proyectos, miembros, roles y errores | prueba del usuario |
| v0.2 | 2026-10-11 | La pantalla principal pasa a ser un timeline (barra por proyecto, "Hoy", avance del plazo, días restantes/retraso); filtro de Estatus (Activos por defecto), selector de Proyecto, tope de 3 con "Ver todos"; se elimina la lista de tarjetas; proyectos sin fechas como fila con aviso; tras crear un proyecto se garantiza que se vea; nuevos mensajes de estado vacío | prueba del usuario |
| v0.3 | 2026-10-13 | Módulo 3 Fases: 7 fases fijas + Desarrollo condicional (casilla en alta y detalle); sección Fases en el detalle con guardado por fila y avisos; timeline con avance real como cifra principal, avance del plazo secundario y carril de fases; nuevos mensajes | prueba del usuario (local) |
