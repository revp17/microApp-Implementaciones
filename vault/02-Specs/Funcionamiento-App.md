# Funcionamiento de la app (módulo Proyectos)

- **Versión:** v0.2 · **Fecha:** 2026-10-11
- **Módulos cubiertos:** Acceso (login/registro), Proyectos (pantalla principal con timeline, alta y detalle), Miembros del proyecto ([[Modulos]] n.º 1)
- **Estado:** módulo 1 dado por hecho por el usuario (2026-10-11)
- **Documento vivo:** se actualiza cuando el usuario lo indica, tras probar la app

## 1. Visión general

La app permite a un equipo crear proyectos de implementación de sistemas/ERP, registrar sus datos generales, decidir quién participa y con qué rol, y ver de un vistazo cómo avanza el plazo de cada proyecto. Hoy solo existe el módulo de Proyectos; el resto de módulos de [[Modulos]] aún no está construido. Cada persona ve únicamente los proyectos en los que es miembro.

```
Login / Registro ──► Pantalla principal (timeline) ──┬──► Nuevo proyecto ──► (vuelve al timeline)
   (verifica email)        ▲                         │
                           │                         └──► Detalle del proyecto ──► Miembros
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
- **Timeline:** una fila por proyecto con su nombre (clic abre el detalle), etiqueta de estatus y cliente; bajo ellos, el avance del plazo y la barra.
- Mensajes: "Cargando…", "Aún no tienes proyectos. Crea el primero." y "No hay proyectos en estatus X." cuando el filtro no encuentra ninguno.

**Cómo leer cada fila**
- **Barra:** va de la fecha de inicio a la de fin planificado; el relleno muestra el tiempo transcurrido. Una línea roja marca **"Hoy · fecha"** (la fecha de hoy aparece arriba, sobre el eje).
- **Fechas:** bajo la barra se muestran "Inicio: …" y "Fin plan: …" con fecha completa (p. ej. 5 mar 2026).
- **Avance del plazo (%):** mide el **tiempo transcurrido del plan, no el avance del trabajo** (aún no existen fases ni tareas). Junto al % se ve "Día X de Y" (solo mientras el plazo corre) y "Quedan N días" o "Vence hoy".
- **Antes de empezar:** 0 % y "Inicia en N días".
- **Con retraso** (pasó la fecha de fin y el proyecto no está cerrado): 100 %, barra en rojo, "N días de retraso" y un tramo rayado desde el fin hasta hoy.
- **Cerrado:** en lugar del % muestra "Cerrado", sin porcentaje ni días.
- **Eje común:** todas las filas visibles comparten escala de tiempo (marcas por mes), de modo que se pueden comparar entre sí; el eje siempre incluye la fecha de hoy.
- **Sin fechas o fechas invertidas:** el proyecto aparece igualmente como una fila, sin barra, con el aviso "Sin fechas planificadas · abre el proyecto para definirlas" o "El fin es anterior al inicio · abre el proyecto para corregirlo".

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
- **Nombre del proyecto** (obligatorio, máx. 200), **Sistema / ERP** (opcional, máx. 200), **Inicio** y **Fin planificado** (opcionales; el fin no puede ser anterior al inicio), **Estado** (Planificado por defecto).
- Botones "Crear proyecto" y "Cancelar".
- Si falla la creación del proyecto tras crear el cliente nuevo, al reintentar se reutiliza ese cliente (no se duplica).
- **Al guardar** se vuelve a la pantalla principal y el proyecto nuevo queda siempre visible: si es Planificado o En curso, el estatus pasa a "Activos" (salvo que ya se viera); si es Pausado o Cerrado, el estatus pasa a ese estado; además el selector "Proyecto" vuelve a "Todos los proyectos" y se quita el tope de 3.

**Quién puede usarlo:** cualquier usuario con sesión.
**Reglas importantes:** quien crea el proyecto queda automáticamente como **responsable**. Un cliente existente solo puede usarse si lo creó la persona o es responsable de algún proyecto de ese cliente. Un proyecto sin fechas se crea sin problema, pero no tendrá barra en el timeline.

### 2.4 Detalle / edición de proyecto
**Para qué sirve:** consultar y modificar los datos generales de un proyecto.
**Qué ve y qué puede hacer**
- Nombre, cliente (solo lectura), Sistema / ERP, Inicio, Fin planificado y Estado: **Planificado, En curso, Pausado, Cerrado**.
- Botón "Guardar" y aviso "Cambios guardados" (solo responsable).
- Quien no es responsable ve los campos bloqueados y el texto "Solo lectura: únicamente el responsable puede editar."
- Debajo aparece la sección Miembros; "← Proyectos" vuelve a la pantalla principal, que se refresca con los cambios.

**Quién puede usarlo:** ver, todos los miembros; editar, solo el responsable.
**Reglas importantes:** el cliente de un proyecto no se puede cambiar desde la pantalla; los proyectos no se pueden eliminar. Cambiar las fechas o el estado actualiza la barra del timeline.

### 2.5 Miembros del proyecto
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
| Editar datos y estado del proyecto | Sí | No | No |
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
| No hay proyectos en estatus X. | Hay proyectos, pero ninguno con el estatus elegido en el filtro |
| Mostrando los 3 más recientes de N proyectos. | Hay más proyectos que el tope; usar "Ver todos (N)" |
| Sin fechas planificadas · abre el proyecto para definirlas | El proyecto no tiene inicio y/o fin; no se puede dibujar la barra |
| El fin es anterior al inicio · abre el proyecto para corregirlo | Las fechas están invertidas; no se puede dibujar la barra |

Los errores de registro/login (correo ya usado, contraseña incorrecta, correo sin verificar) los devuelve el servicio de acceso con su propio texto, que se muestra tal cual.

## 5. Limitaciones conocidas / fuera de alcance

- No existen aún: Alcance, Fases, Tareas, Requerimientos, Riesgos, Cambios, Pruebas, Capacitación, Go-Live, Cierre ni Alertas por email.
- **El "Avance del plazo" mide solo el tiempo transcurrido del plan, no el avance real del trabajo**; no puede reflejar fases ni tareas hasta que existan.
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

- **Frontend** (React, navegador): todas las pantallas; proyectos y clientes se leen/escriben directo contra Nhost (GraphQL) con la sesión del usuario. El timeline y sus porcentajes se calculan en el navegador a partir de las fechas.
- **Nhost:** autenticación (con verificación de correo), base de datos PostgreSQL y permisos por fila (Hasura) que deciden quién ve y edita.
- **Backend FastAPI:** solo la gestión de miembros (listar, añadir, quitar); valida la sesión contra Nhost y usa credenciales de servidor para resolver correos.
- Detalle de datos y permisos: [[ADR-0002-modelo-datos-mvp]] y [[Roles]].

## 7. Registro de cambios

| Versión | Fecha | Qué cambió | Origen |
|---|---|---|---|
| v0.1 | 2026-10-09 | Primera versión: login/registro, proyectos, miembros, roles y errores | prueba del usuario |
| v0.2 | 2026-10-11 | La pantalla principal pasa a ser un timeline (barra por proyecto, "Hoy", avance del plazo, días restantes/retraso); filtro de Estatus (Activos por defecto), selector de Proyecto, tope de 3 con "Ver todos"; se elimina la lista de tarjetas; proyectos sin fechas como fila con aviso; tras crear un proyecto se garantiza que se vea; nuevos mensajes de estado vacío | prueba del usuario |
