"""Integración contra Nhost/Hasura REAL: módulo 3 · Fases (ADR-0003 §6).

Se salta si faltan NHOST_SUBDOMAIN / NHOST_REGION / NHOST_ADMIN_SECRET.
Crea usuarios `zz-prueba-impl-*@example.com` por SQL admin y datos de prueba; los borra SIEMPRE al terminar.
Antes hay que haber aplicado la migración: `python db/aplicar.py`.
Ejecutar: cd backend && pytest tests/test_fases_integracion.py -v
"""
import os
import time
import uuid

import httpx
import pytest

# limpiar() borra todo lo creado por usuarios zz-prueba-impl-* (incluido el proyecto SQL de la prueba 9)
from tests.test_permisos_integracion import AUTH, PASSWORD, PREFIJO, admin_sql, gql, limpiar

SUB, REG, SECRET = (os.environ.get(k) for k in ("NHOST_SUBDOMAIN", "NHOST_REGION", "NHOST_ADMIN_SECRET"))
pytestmark = pytest.mark.skipif(not (SUB and REG and SECRET), reason="faltan variables NHOST_*")

MIGRACION = os.path.join(os.path.dirname(__file__), "..", "..", "db", "002_fases.sql")
MSG_HASURA_DESARROLLO = ("Check constraint violation. No se puede quitar la fase Desarrollo porque ya tiene fechas o avance. "
                         "Déjala en Pendiente y sin fechas e inténtalo de nuevo.")
ORDEN_7 = [1, 2, 3, 5, 6, 7, 8]
CLAVES_7 = ["levantamiento", "diseno", "configuracion", "pruebas", "capacitacion", "go_live", "cierre"]

Q_CLIENTE = "mutation($n:String!){insert_clientes_one(object:{nombre:$n}){id}}"
Q_PROY = """mutation($o:proyectos_insert_input!){insert_proyectos_one(object:$o){id requiere_desarrollo}}"""
Q_FASES = """query($id:uuid!){proyectos_by_pk(id:$id){requiere_desarrollo
  fases(order_by:{orden:asc}){id clave nombre orden estado fecha_inicio fecha_fin_plan}}}"""
Q_UPD_PROY = """mutation($id:uuid!,$s:proyectos_set_input!){update_proyectos_by_pk(pk_columns:{id:$id},_set:$s){id requiere_desarrollo}}"""
Q_UPD_FASE = """mutation($id:uuid!,$s:fases_set_input!){update_fases_by_pk(pk_columns:{id:$id},_set:$s){
  id estado fecha_inicio fecha_fin_plan actualizado_en}}"""


def crear_usuario(nombre):
    """Como en test_permisos_integracion, pero reintenta el signin si Nhost responde 429 (límite de peticiones)."""
    email = f"{PREFIJO}{nombre}-{uuid.uuid4().hex[:6]}@example.com"
    uid = admin_sql(f"""
      insert into auth.users (email, password_hash, email_verified, default_role, locale)
      values ('{email}', crypt('{PASSWORD}', gen_salt('bf')), true, 'user', 'es') returning id""")[0][0]
    admin_sql(f"insert into auth.user_roles (user_id, role) values ('{uid}', 'user')")
    for espera in (10, 20, 40, 60, 60, 60, 60, 0):
        r = httpx.post(f"{AUTH}/signin/email-password", json={"email": email, "password": PASSWORD}, timeout=30)
        if r.status_code != 429 or not espera:
            break
        time.sleep(espera)
    r.raise_for_status()
    return {"token": r.json()["session"]["accessToken"], "id": uid, "email": email}


def nuevo_proyecto(u, cliente_id, nombre, **extra):
    r = gql(u["token"], Q_PROY, {"o": {"cliente_id": cliente_id, "nombre": nombre, **extra}})
    assert "errors" not in r, r
    return r["data"]["insert_proyectos_one"]["id"]


def fases(u, pid):
    p = gql(u["token"], Q_FASES, {"id": pid})["data"]["proyectos_by_pk"]
    return p and p["fases"]


def fase(u, pid, clave):
    return next(f for f in fases(u, pid) if f["clave"] == clave)


@pytest.fixture(scope="module")
def ctx():
    limpiar()
    try:
        # a: responsable · b: ajeno · c: colaborador · d: cliente · e: responsable de otro proyecto
        u = {n: crear_usuario(f"fases-{n}") for n in "abcde"}
        cli = gql(u["a"]["token"], Q_CLIENTE, {"n": "Cliente FASES PRUEBA"})["data"]["insert_clientes_one"]["id"]
        pid = nuevo_proyecto(u["a"], cli, "Proyecto FASES PRUEBA", fecha_inicio="2026-01-01", fecha_fin_plan="2026-12-31")
        admin_sql(f"""insert into proyecto_miembros (proyecto_id,user_id,rol) values
          ('{pid}','{u['c']['id']}','colaborador'), ('{pid}','{u['d']['id']}','cliente')""")
        cli_e = gql(u["e"]["token"], Q_CLIENTE, {"n": "Cliente E PRUEBA"})["data"]["insert_clientes_one"]["id"]
        pid_e = nuevo_proyecto(u["e"], cli_e, "Proyecto E PRUEBA")
        yield {**u, "cli": cli, "pid": pid, "pid_e": pid_e}
    finally:
        limpiar()


def test_1_proyecto_nuevo_nace_con_fases(ctx):
    a, pid = ctx["a"], ctx["pid"]
    fs = fases(a, pid)
    assert [f["orden"] for f in fs] == ORDEN_7
    assert [f["clave"] for f in fs] == CLAVES_7
    assert [f["nombre"] for f in fs] == ["Levantamiento", "Diseño", "Configuración", "Pruebas", "Capacitación", "Go-Live", "Cierre"]
    assert {f["estado"] for f in fs} == {"pendiente"}
    assert all(f["fecha_inicio"] is None and f["fecha_fin_plan"] is None for f in fs)
    # con requiere_desarrollo nace con 8; Desarrollo en orden 4
    pid2 = nuevo_proyecto(a, ctx["cli"], "Con desarrollo PRUEBA", requiere_desarrollo=True)
    fs = fases(a, pid2)
    assert [f["orden"] for f in fs] == list(range(1, 9))
    assert (fs[3]["clave"], fs[3]["nombre"], fs[3]["estado"]) == ("desarrollo", "Desarrollo", "pendiente")


def test_2_marcar_y_desmarcar_desarrollo(ctx):
    a = ctx["a"]
    pid = nuevo_proyecto(a, ctx["cli"], "Marcar PRUEBA")  # proyecto propio: no depende de otras pruebas
    r = gql(a["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": True}})
    assert r["data"]["update_proyectos_by_pk"]["requiere_desarrollo"] is True
    fs = fases(a, pid)
    assert [f["orden"] for f in fs] == list(range(1, 9)) and fs[3]["clave"] == "desarrollo"
    # re-marcar (sin cambio) no duplica
    gql(a["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": True, "sistema": "ERP Y"}})
    assert len(fases(a, pid)) == 8
    # desmarcar con Desarrollo Pendiente y sin fechas la borra
    r = gql(a["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": False}})
    assert "errors" not in r, r
    assert [f["orden"] for f in fases(a, pid)] == ORDEN_7


@pytest.mark.parametrize("cambio", [{"fecha_inicio": "2026-03-01"}, {"estado": "en_curso"}])
def test_3_desmarcar_bloqueado_con_avance(ctx, cambio):
    a = ctx["a"]
    pid = nuevo_proyecto(a, ctx["cli"], "Bloqueo PRUEBA", requiere_desarrollo=True)
    dev = fase(a, pid, "desarrollo")
    assert "errors" not in gql(a["token"], Q_UPD_FASE, {"id": dev["id"], "s": cambio})
    r = gql(a["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": False, "nombre": "Renombrado PRUEBA"}})
    assert "errors" in r, r
    # Texto real, fijado aquí para el mapeo del frontend. El trigger usa errcode check_violation para que
    # Hasura lo propague; con el P0001 por defecto solo llegaba "database query error".
    assert r["errors"][0]["message"] == MSG_HASURA_DESARROLLO
    assert r["errors"][0]["extensions"]["code"] == "permission-error"
    # rollback: el proyecto no cambió y la fase sigue
    assert admin_sql(f"select requiere_desarrollo::text, nombre from proyectos where id='{pid}'") == [["true", "Bloqueo PRUEBA"]]
    assert fase(a, pid, "desarrollo")["id"] == dev["id"]
    # restablecer: Pendiente y sin fechas → ahora sí se puede desmarcar
    gql(a["token"], Q_UPD_FASE, {"id": dev["id"], "s": {"estado": "pendiente", "fecha_inicio": None, "fecha_fin_plan": None}})
    assert "errors" not in gql(a["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": False}})
    assert len(fases(a, pid)) == 7


def test_4_responsable_edita_fase_y_queda_evento(ctx):
    a, pid = ctx["a"], ctx["pid"]
    f = fase(a, pid, "levantamiento")
    r = gql(a["token"], Q_UPD_FASE, {"id": f["id"], "s": {"estado": "completada", "fecha_inicio": "2026-01-05", "fecha_fin_plan": "2026-02-15"}})
    d = r["data"]["update_fases_by_pk"]
    assert (d["estado"], d["fecha_inicio"], d["fecha_fin_plan"]) == ("completada", "2026-01-05", "2026-02-15")
    ev = admin_sql(f"""select accion, usuario_id, proyecto_id from eventos
                       where entidad='fases' and entidad_id='{f['id']}' order by id""")
    assert ev[0][0] == "insert" and ev[-1] == ["update", a["id"], pid]
    # las altas de fases hechas por el trigger al crear el proyecto llevan el usuario creador
    altas = admin_sql(f"select distinct usuario_id from eventos where entidad='fases' and accion='insert' and proyecto_id='{pid}'")
    assert altas == [[a["id"]]]
    # un UPDATE sin cambios reales no genera evento ni mueve actualizado_en
    n = len(ev)
    r = gql(a["token"], Q_UPD_FASE, {"id": f["id"], "s": {"estado": "completada", "fecha_inicio": "2026-01-05"}})
    assert r["data"]["update_fases_by_pk"]["actualizado_en"] == d["actualizado_en"]
    assert admin_sql(f"select count(*) from eventos where entidad='fases' and entidad_id='{f['id']}'") == [[str(n)]]
    # el responsable ve los eventos de fases de su proyecto
    vistos = gql(a["token"], f'{{eventos(where:{{entidad:{{_eq:"fases"}},entidad_id:{{_eq:"{f["id"]}"}}}}){{accion}}}}')
    assert "update" in [e["accion"] for e in vistos["data"]["eventos"]]


def test_5_colaborador_y_cliente_solo_lectura(ctx):
    pid = ctx["pid"]
    f = fase(ctx["a"], pid, "diseno")
    for n in ("c", "d"):
        u = ctx[n]
        assert len(fases(u, pid)) == 7
        r = gql(u["token"], Q_UPD_FASE, {"id": f["id"], "s": {"estado": "completada"}})
        assert "errors" in r or r["data"]["update_fases_by_pk"] is None
        mut = {x["name"] for x in gql(u["token"], "{__schema{mutationType{fields{name}}}}")["data"]["__schema"]["mutationType"]["fields"]}
        assert "update_fases_by_pk" in mut
        assert not {m for m in mut if m.startswith(("insert_fases", "delete_fases"))}
    assert admin_sql(f"select estado::text from fases where id='{f['id']}'") == [["pendiente"]]


def test_6_ajeno_y_responsable_de_otro_proyecto(ctx):
    a, b, e, pid = ctx["a"], ctx["b"], ctx["e"], ctx["pid"]
    f = fase(a, pid, "configuracion")
    assert gql(b["token"], "{fases{id}}")["data"]["fases"] == []
    assert fases(b, pid) is None
    for u in (b, e):
        r = gql(u["token"], Q_UPD_FASE, {"id": f["id"], "s": {"estado": "en_curso"}})
        assert "errors" in r or r["data"]["update_fases_by_pk"] is None
        r = gql(u["token"], "mutation($p:uuid!){update_fases(where:{proyecto_id:{_eq:$p}},_set:{estado:completada}){affected_rows}}", {"p": pid})
        assert r["data"]["update_fases"]["affected_rows"] == 0
    # e ve solo las fases de su propio proyecto
    assert {x["proyecto_id"] for x in gql(e["token"], "{fases{proyecto_id}}")["data"]["fases"]} == {ctx["pid_e"]}
    assert admin_sql(f"select count(*) from fases where proyecto_id='{pid}' and estado <> 'pendiente' and clave='configuracion'") == [["0"]]


@pytest.mark.parametrize("campo,valor", [("proyecto_id", None), ("orden", 9), ("nombre", "Otro"), ("clave", "cierre")])
def test_7_columnas_protegidas_no_existen_en_set(ctx, campo, valor):
    a, pid = ctx["a"], ctx["pid"]
    f = fase(a, pid, "pruebas")
    valor = ctx["pid_e"] if campo == "proyecto_id" else valor
    r = gql(a["token"], Q_UPD_FASE, {"id": f["id"], "s": {campo: valor}})
    assert "errors" in r, r
    assert fase(a, pid, "pruebas") == f


def test_8_fin_anterior_a_inicio_falla(ctx):
    a, pid = ctx["a"], ctx["pid"]
    f = fase(a, pid, "capacitacion")
    r = gql(a["token"], Q_UPD_FASE, {"id": f["id"], "s": {"fecha_inicio": "2026-05-10", "fecha_fin_plan": "2026-05-01"}})
    assert "errors" in r, r
    assert fase(a, pid, "capacitacion")["fecha_inicio"] is None
    # y el trigger de protección también actúa en BD (sin pasar por Hasura)
    with pytest.raises(AssertionError, match="renombrar, mover ni reordenar"):
        admin_sql(f"update fases set nombre='X' where id='{f['id']}'")


def test_9_migracion_idempotente(ctx):
    a = ctx["a"]
    pid = admin_sql(f"""insert into proyectos (cliente_id, nombre, fecha_inicio, fecha_fin_plan, creado_por)
      values ('{ctx['cli']}', 'Migrado PRUEBA', '2025-03-01', '2025-09-30', '{a['id']}') returning id""")[0][0]
    admin_sql(f"delete from fases where proyecto_id='{pid}'")  # simula un proyecto anterior a 002
    assert admin_sql(f"select count(*) from fases where proyecto_id='{pid}'") == [["0"]]
    texto = open(MIGRACION, encoding="utf-8").read()
    for _ in range(2):
        admin_sql(texto)
    filas = admin_sql(f"select orden, clave, estado::text from fases where proyecto_id='{pid}' order by orden")
    assert [int(x[0]) for x in filas] == ORDEN_7
    assert [x[1] for x in filas] == CLAVES_7 and {x[2] for x in filas} == {"pendiente"}
    assert admin_sql(f"select fecha_inicio::text, fecha_fin_plan::text, estado::text, requiere_desarrollo::text from proyectos where id='{pid}'") \
        == [["2025-03-01", "2025-09-30", "planificado", "false"]]
    # ningún proyecto de prueba quedó con fases duplicadas o de menos (no se inspeccionan proyectos reales)
    assert admin_sql(f"""select count(*) from proyectos p
                         where p.creado_por in (select id from auth.users where email like '{PREFIJO}%')
                           and (select count(*) from fases f where f.proyecto_id=p.id)
                               <> case when p.requiere_desarrollo then 8 else 7 end""") == [["0"]]


# ---- Cobertura adicional (auditoría de seguridad B-3); usa los mismos 5 usuarios, sin nuevos inicios de sesión.

def test_10_cliente_no_ve_eventos_de_fases(ctx):
    assert gql(ctx["d"]["token"], '{eventos(where:{entidad:{_eq:"fases"}}){id}}')["data"]["eventos"] == []
    # el colaborador sí (como en proyectos)
    assert gql(ctx["c"]["token"], f'{{eventos(where:{{entidad:{{_eq:"fases"}},proyecto_id:{{_eq:"{ctx["pid"]}"}}}}){{id}}}}')["data"]["eventos"] != []


def test_11_solo_el_responsable_cambia_requiere_desarrollo(ctx):
    pid = ctx["pid"]
    for n in ("c", "d", "b", "e"):
        r = gql(ctx[n]["token"], Q_UPD_PROY, {"id": pid, "s": {"requiere_desarrollo": True}})
        assert "errors" in r or r["data"]["update_proyectos_by_pk"] is None, (n, r)
    assert admin_sql(f"select requiere_desarrollo::text from proyectos where id='{pid}'") == [["false"]]
    assert admin_sql(f"select count(*) from fases where proyecto_id='{pid}' and clave='desarrollo'") == [["0"]]


def test_12_update_fases_many_ajeno_no_afecta(ctx):
    b, pid = ctx["b"], ctx["pid"]
    mut = {x["name"] for x in gql(b["token"], "{__schema{mutationType{fields{name}}}}")["data"]["__schema"]["mutationType"]["fields"]}
    if "update_fases_many" not in mut:
        pytest.skip("update_fases_many no existe en esta versión de Hasura")
    r = gql(b["token"], """mutation($p:uuid!){update_fases_many(updates:[{where:{proyecto_id:{_eq:$p}},
        _set:{estado:completada}}]){affected_rows}}""", {"p": pid})
    assert "errors" not in r, r
    assert [x["affected_rows"] for x in r["data"]["update_fases_many"]] == [0]
    assert admin_sql(f"select count(*) from fases where proyecto_id='{pid}' and estado='completada' and clave<>'levantamiento'") == [["0"]]


def test_13_insert_proyecto_con_fases_anidadas_falla(ctx):
    a = ctx["a"]
    r = gql(a["token"], Q_PROY, {"o": {"cliente_id": ctx["cli"], "nombre": "Anidado PRUEBA",
                                       "fases": {"data": [{"clave": "desarrollo", "nombre": "X", "orden": 4}]}}})
    assert "errors" in r, r
    assert admin_sql(f"select count(*) from proyectos where nombre='Anidado PRUEBA' and creado_por='{a['id']}'") == [["0"]]
