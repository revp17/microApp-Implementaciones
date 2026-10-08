#!/usr/bin/env python3
"""Aplica db/*.sql y registra tablas, relaciones y permisos (rol `user`) en Hasura.
Idempotente. Requiere NHOST_SUBDOMAIN, NHOST_REGION, NHOST_ADMIN_SECRET en el entorno.
Uso: python db/aplicar.py
"""
import glob
import json
import os
import sys
import urllib.error
import urllib.request

sub, reg, secret = (os.environ.get(k) for k in ("NHOST_SUBDOMAIN", "NHOST_REGION", "NHOST_ADMIN_SECRET"))
if not (sub and reg and secret):
    sys.exit("Faltan NHOST_SUBDOMAIN / NHOST_REGION / NHOST_ADMIN_SECRET")
BASE = f"https://{sub}.hasura.{reg}.nhost.run"


def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "x-hasura-admin-secret": secret},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} en {path}: {e.read().decode()[:800]}")


def sql(texto):
    post("/v2/query", {"type": "run_sql", "args": {"source": "default", "sql": texto, "cascade": False}})


T = lambda n: {"schema": "public", "name": n}  # noqa: E731
ME = "X-Hasura-User-Id"
soy_miembro = {"miembros": {"user_id": {"_eq": ME}}}
soy_responsable = {"miembros": {"_and": [{"user_id": {"_eq": ME}}, {"rol": {"_eq": "responsable"}}]}}
cliente_visible = {"_or": [{"creado_por": {"_eq": ME}}, {"proyectos": soy_miembro}]}
# para colgar un proyecto nuevo de un cliente: lo creé yo o soy responsable en algún proyecto suyo
cliente_usable = {"_or": [{"creado_por": {"_eq": ME}}, {"proyectos": soy_responsable}]}
COLS_EDITABLES = ["nombre", "sistema", "fecha_inicio", "fecha_fin_plan", "estado"]


def perm(tipo, tabla, permission):
    return (
        {"type": f"pg_drop_{tipo}_permission", "args": {"source": "default", "table": T(tabla), "role": "user"}},
        {"type": f"pg_create_{tipo}_permission", "args": {"source": "default", "table": T(tabla), "role": "user", "permission": permission}},
    )


def rel_obj(tabla, nombre, columna):
    return {"type": "pg_create_object_relationship", "args": {"source": "default", "table": T(tabla), "name": nombre, "using": {"foreign_key_constraint_on": columna}}}


def rel_arr(tabla, nombre, tabla_remota, columna):
    return {"type": "pg_create_array_relationship", "args": {"source": "default", "table": T(tabla), "name": nombre, "using": {"foreign_key_constraint_on": {"table": T(tabla_remota), "column": columna}}}}


relaciones = [
    ("proyectos", "cliente", rel_obj("proyectos", "cliente", "cliente_id")),
    ("proyectos", "miembros", rel_arr("proyectos", "miembros", "proyecto_miembros", "proyecto_id")),
    ("clientes", "proyectos", rel_arr("clientes", "proyectos", "proyectos", "cliente_id")),
    ("proyecto_miembros", "proyecto", rel_obj("proyecto_miembros", "proyecto", "proyecto_id")),
]

permisos = []
# clientes: cualquiera autenticado crea; ve los suyos o los de sus proyectos.
permisos += perm("insert", "clientes", {"check": {}, "columns": ["nombre"], "set": {"creado_por": ME}})
permisos += perm("select", "clientes", {"filter": cliente_visible, "columns": ["id", "nombre", "creado_por", "creado_en"]})
# proyectos: crea cualquiera (con un cliente que pueda ver); ven los miembros; edita solo el responsable.
permisos += perm("insert", "proyectos", {
    "check": {"cliente": cliente_usable},
    "columns": ["cliente_id"] + COLS_EDITABLES,
    "set": {"creado_por": ME},
})
permisos += perm("select", "proyectos", {
    "filter": soy_miembro,
    "columns": ["id", "cliente_id", "creado_por", "creado_en"] + COLS_EDITABLES,
})
permisos += perm("update", "proyectos", {"filter": soy_responsable, "check": soy_responsable, "columns": COLS_EDITABLES})
# miembros y eventos: solo lectura para quienes son miembros del proyecto.
permisos += perm("select", "proyecto_miembros", {
    "filter": {"proyecto": soy_miembro},
    "columns": ["proyecto_id", "user_id", "rol"],
})
permisos += perm("select", "eventos", {
    "filter": {"_exists": {"_table": T("proyecto_miembros"), "_where": {"_and": [
        {"proyecto_id": {"_ceq": ["$", "proyecto_id"]}}, {"user_id": {"_eq": ME}},
        {"rol": {"_in": ["responsable", "colaborador"]}}]}}},
    "columns": ["id", "entidad", "entidad_id", "proyecto_id", "accion", "usuario_id", "antes", "despues", "creado_en"],
})


def bulk(args):
    """Ejecuta en bloque. Solo se toleran los errores esperables al re-ejecutar; cualquier otro aborta."""
    res = post("/v1/metadata", {"type": "bulk_keep_going", "args": args})
    for op, r in zip(args, res):
        if not (isinstance(r, dict) and "error" in r):
            continue
        code = r.get("code")
        es_drop = op["type"].startswith("pg_drop_")
        if code in ("already-tracked", "already-exists") and not es_drop:
            continue
        if es_drop and code == "permission-denied" and "does not exist" in r["error"]:
            continue  # el permiso aún no existía
        sys.exit(f"Error de metadata en {op['type']}: {json.dumps(r)[:600]}")


def main():
    for f in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "[0-9]*.sql"))):
        print("SQL:", os.path.basename(f))
        sql(open(f, encoding="utf-8").read())
    tablas = ["clientes", "proyectos", "proyecto_miembros", "eventos"]
    bulk([{"type": "pg_track_table", "args": {"source": "default", "table": T(t)}} for t in tablas])
    bulk([r for _, _, r in relaciones])
    bulk(list(permisos))
    print("Hasura: tablas, relaciones y permisos del rol `user` aplicados.")


main()
