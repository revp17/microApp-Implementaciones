# Funcionamiento de la app (módulo Proyectos)

- **Versión:** v0.1 · **Fecha:** 2026-10-09
- **Módulos cubiertos:** Acceso (login/registro), Proyectos, Miembros del proyecto ([[Modulos]] n.º 1)
- **Estado:** en prueba por el usuario
- **Documento vivo:** se actualiza cuando el usuario lo indica, tras probar la app

## 1. Visión general

La app permite a un equipo crear proyectos de implementación de sistemas/ERP, registrar sus datos generales y decidir quién participa y con qué rol. Hoy solo existe el módulo de Proyectos; el resto de módulos de [[Modulos]] aún no está construido. Cada persona ve únicamente los proyectos en los que es miembro.

```
Login / Registro ──► Lista de proyectos ──┬──► Nuevo proyecto ──► (vuelve a la lista)
   (verifica email)        ▲              │
                           │              └──► Detalle del proyecto ──► Miembros
                           └─────────────────── "← Proyectos" ◄──────────┘
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

### 2.2 Lista de proyectos
**Para qué sirve:** ver todos los proyectos en los que participa la persona y acceder a ellos.
**Qué ve y qué puede hacer**
- Una tarjeta por proyecto, del más reciente al más antiguo: nombre, estado, cliente, sistema y fechas (inicio → fin planificado; "?" si falta una).
- Botón "Nuevo proyecto". Clic en una tarjeta abre el detalle.
- Mensajes: "Cargando…" y "Aún no tienes proyectos. Crea el primero."

**Quién puede usarlo:** cualquier usuario con sesión; solo ve proyectos donde es miembro (cualquier rol).
**Reglas importantes:** no hay búsqueda ni filtros.

### 2.3 Nuevo proyecto
**Para qué sirve:** dar de alta un proyecto, con un cliente existente o uno nuevo.
**Qué ve y qué puede hacer**
- **Cliente:** lista de clientes visibles para la persona, más la opción "+ Nuevo cliente…" (pide el nombre, obligatorio, máx. 200).
- **Nombre del proyecto** (obligatorio, máx. 200), **Sistema / ERP** (opcional, máx. 200), **Inicio** y **Fin planificado** (opcionales; el fin no puede ser anterior al inicio), **Estado** (Planificado por defecto).
- Botones "Crear proyecto" y "Cancelar".
- Si falla la creación del proyecto tras crear el cliente nuevo, al reintentar se reutiliza ese cliente (no se duplica).

**Quién puede usarlo:** cualquier usuario con sesión.
**Reglas importantes:** quien crea el proyecto queda automáticamente como **responsable**. Un cliente existente solo puede usarse si lo creó la persona o es responsable de algún proyecto de ese cliente.

### 2.4 Detalle / edición de proyecto
**Para qué sirve:** consultar y modificar los datos generales de un proyecto.
**Qué ve y qué puede hacer**
- Nombre, cliente (solo lectura), Sistema / ERP, Inicio, Fin planificado y Estado: **Planificado, En curso, Pausado, Cerrado**.
- Botón "Guardar" y aviso "Cambios guardados" (solo responsable).
- Quien no es responsable ve los campos bloqueados y el texto "Solo lectura: únicamente el responsable puede editar."
- Debajo aparece la sección Miembros; "← Proyectos" vuelve a la lista.

**Quién puede usarlo:** ver, todos los miembros; editar, solo el responsable.
**Reglas importantes:** el cliente de un proyecto no se puede cambiar desde la pantalla; los proyectos no se pueden eliminar.

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
| Ver el proyecto y sus datos | Sí | Sí | Sí |
| Editar datos y estado del proyecto | Sí | No | No |
| Ver miembros (con correo) | Sí | Sí | Sí |
| Añadir / quitar miembros | Sí | No | No |
| Ver historial de cambios (registrado, sin pantalla aún) | Sí | Sí | No |

\* Crear no depende del rol dentro de un proyecto: cualquier usuario con sesión puede crear los suyos.

## 4. Mensajes de error comunes

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

Los errores de registro/login (correo ya usado, contraseña incorrecta, correo sin verificar) los devuelve el servicio de acceso con su propio texto, que se muestra tal cual.

## 5. Limitaciones conocidas / fuera de alcance

- No existen aún: Alcance, Fases, Tareas, Requerimientos, Riesgos, Cambios, Pruebas, Capacitación, Go-Live, Cierre ni Alertas por email.
- No hay pantalla de historial de cambios (se registra pero no se muestra) ni aprobaciones del cliente.
- El rol cliente ve los correos de todo el equipo del proyecto.
- Registro abierto: cualquiera puede crear cuenta, clientes y proyectos propios (riesgo aceptado por ahora, ver [[ADR-0002-modelo-datos-mvp]]).
- Un responsable puede saber si un correo está registrado (error 404 en el alta).
- No hay cambio de rol de un miembro, ni más de un responsable desde la pantalla, ni eliminación de proyectos o clientes.
- No hay edición de clientes ni búsqueda/filtros en la lista.
- Un colaborador o cliente ve en el selector clientes de sus proyectos, pero solo podrá usarlos para un proyecto nuevo si es responsable en alguno de ese cliente (si no, la creación falla con un mensaje técnico del servicio).

## 6. Detalle técnico

- **Frontend** (React, navegador): todas las pantallas; proyectos y clientes se leen/escriben directo contra Nhost (GraphQL) con la sesión del usuario.
- **Nhost:** autenticación (con verificación de correo), base de datos PostgreSQL y permisos por fila (Hasura) que deciden quién ve y edita.
- **Backend FastAPI:** solo la gestión de miembros (listar, añadir, quitar); valida la sesión contra Nhost y usa credenciales de servidor para resolver correos.
- Detalle de datos y permisos: [[ADR-0002-modelo-datos-mvp]] y [[Roles]].

## 7. Registro de cambios

| Versión | Fecha | Qué cambió | Origen |
|---|---|---|---|
| v0.1 | 2026-10-09 | Primera versión: login/registro, proyectos, miembros, roles y errores | prueba del usuario |
