"""Integración contra Nhost/Hasura REAL: permisos del módulo Proyectos y endpoint de miembros.

Se salta si faltan NHOST_SUBDOMAIN / NHOST_REGION / NHOST_ADMIN_SECRET.
Crea usuarios `zz-prueba-impl-*@example.com` directamente por SQL admin (el signup tiene límite de
peticiones, 429) y datos de prueba; los borra SIEMPRE al terminar.
Antes hay que haber aplicado la migración: `python db/aplicar.py`.
Ejecutar: cd backend && pytest tests/test_permisos_integracion.py -v
"""
import os
import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

SUB, REG, SECRET = (os.environ.get(k) for k in ("NHOST_SUBDOMAIN", "NHOST_REGION", "NHOST_ADMIN_SECRET"))
pytestmark = pytest.mark.skipif(not (SUB and REG and SECRET), reason="faltan variables NHOST_*")

PREFIJO = "zz-prueba-impl-"
PASSWORD = "Prueba-Impl-12345!"
AUTH = f"https://{SUB}.auth.{REG}.nhost.run/v1"
GQL = f"https://{SUB}.graphql.{REG}.nhost.run/v1"
SQL = f"https://{SUB}.hasura.{REG}.nhost.run/v2/query"
api = TestClient(app)


def admin_sql(sql):
    r = httpx.post(SQL, headers={"x-hasura-admin-secret": SECRET},
                   json={"type": "run_sql", "args": {"source": "default", "sql": sql}}, timeout=30)
    assert r.status_code == 200, r.text
    return (r.json().get("result") or [])[1:]


def gql(token, query, variables=None):
    r = httpx.post(GQL, headers={"authorization": f"Bearer {token}"},
                   json={"query": query, "variables": variables or {}}, timeout=30)
    return r.json()


def limpiar():
    # orden por FKs; solo toca datos de usuarios de prueba. El borrado de proyectos genera
    # eventos 'delete', por eso los eventos se borran al final.
    u = f"(select id from auth.users where email like '{PREFIJO}%')"
    ids = [f"'{x[0]}'" for x in admin_sql(f"select id from proyectos where creado_por in {u}")] or ["null"]
    admin_sql(f"""
      delete from proyectos where creado_por in {u};
      delete from clientes where creado_por in {u};
      delete from eventos where proyecto_id in ({','.join(ids)});
      delete from auth.user_roles where user_id in {u};
      delete from auth.users where email like '{PREFIJO}%';""")


def crear_usuario(nombre):
    email = f"{PREFIJO}{nombre}-{uuid.uuid4().hex[:6]}@example.com"
    uid = admin_sql(f"""
      insert into auth.users (email, password_hash, email_verified, default_role, locale)
      values ('{email}', crypt('{PASSWORD}', gen_salt('bf')), true, 'user', 'es') returning id""")[0][0]
    admin_sql(f"insert into auth.user_roles (user_id, role) values ('{uid}', 'user')")
    r = httpx.post(f"{AUTH}/signin/email-password", json={"email": email, "password": PASSWORD}, timeout=30)
    r.raise_for_status()
    return {"token": r.json()["session"]["accessToken"], "id": uid, "email": email}


def h(u):
    return {"authorization": f"Bearer {u['token']}"}


Q_CLIENTE = "mutation($n:String!){insert_clientes_one(object:{nombre:$n}){id creado_por}}"
Q_PROY = """mutation($c:uuid!,$n:String!){insert_proyectos_one(object:{cliente_id:$c,nombre:$n,sistema:"ERP X"}){
  id estado creado_por miembros{user_id rol}}}"""
Q_UPD = """mutation($id:uuid!,$e:estado_proyecto!){update_proyectos(where:{id:{_eq:$id}},_set:{estado:$e}){affected_rows}}"""


@pytest.fixture(scope="module")
def ctx():
    limpiar()
    try:
        # a: responsable · b: atacante · c: colaborador · d: cliente · e: sin relación (para altas por API)
        u = {n: crear_usuario(n) for n in "abcde"}
        a = u["a"]
        cli = gql(a["token"], Q_CLIENTE, {"n": "Cliente PRUEBA"})["data"]["insert_clientes_one"]
        p = gql(a["token"], Q_PROY, {"c": cli["id"], "n": "Proyecto PRUEBA"})["data"]["insert_proyectos_one"]
        admin_sql(f"""insert into proyecto_miembros (proyecto_id,user_id,rol) values
          ('{p['id']}','{u['c']['id']}','colaborador'), ('{p['id']}','{u['d']['id']}','cliente')""")
        yield {**u, "cli": cli, "p": p, "pid": p["id"]}
    finally:
        limpiar()


def test_creacion(ctx):
    a = ctx["a"]
    assert ctx["cli"]["creado_por"] == a["id"]
    p = ctx["p"]
    assert p["creado_por"] == a["id"] and p["estado"] == "planificado"
    assert p["miembros"] == [{"user_id": a["id"], "rol": "responsable"}]


def test_creado_por_no_suplantable(ctx):
    a, b = ctx["a"], ctx["b"]
    r = gql(a["token"], "mutation($c:uuid!,$u:uuid!){insert_proyectos_one(object:{cliente_id:$c,nombre:\"x\",creado_por:$u}){id}}",
            {"c": ctx["cli"]["id"], "u": b["id"]})
    assert "errors" in r
    assert "errors" in gql(a["token"], "mutation($u:uuid!){insert_clientes_one(object:{nombre:\"x\",creado_por:$u}){id}}", {"u": b["id"]})
    assert "errors" in gql(a["token"], "mutation($id:uuid!,$u:uuid!){update_proyectos(where:{id:{_eq:$id}},_set:{creado_por:$u}){affected_rows}}",
                           {"id": ctx["pid"], "u": b["id"]})


def test_atacante_sin_acceso(ctx):
    b, pid = ctx["b"], ctx["pid"]
    assert gql(b["token"], "{proyectos{id}}")["data"]["proyectos"] == []
    assert gql(b["token"], "{clientes{id}}")["data"]["clientes"] == []
    assert gql(b["token"], "{eventos{id}}")["data"]["eventos"] == []
    assert gql(b["token"], "{proyecto_miembros{user_id}}")["data"]["proyecto_miembros"] == []
    assert gql(b["token"], Q_UPD, {"id": pid, "e": "cerrado"})["data"]["update_proyectos"]["affected_rows"] == 0
    assert "errors" in gql(b["token"], "mutation($id:uuid!){delete_proyectos(where:{id:{_eq:$id}}){affected_rows}}", {"id": pid})
    assert "errors" in gql(b["token"], Q_PROY, {"c": ctx["cli"]["id"], "n": "Intruso PRUEBA"})
    # no puede insertarse (ni a otro) como miembro: el rol user no tiene insert/update/delete en miembros
    for q in (
        "mutation($p:uuid!,$u:uuid!){insert_proyecto_miembros_one(object:{proyecto_id:$p,user_id:$u,rol:responsable}){user_id}}",
        "mutation($p:uuid!,$u:uuid!){update_proyecto_miembros(where:{proyecto_id:{_eq:$p}},_set:{rol:responsable}){affected_rows}}",
        "mutation($p:uuid!,$u:uuid!){delete_proyecto_miembros(where:{proyecto_id:{_eq:$p}}){affected_rows}}",
    ):
        assert "errors" in gql(b["token"], q, {"p": pid, "u": b["id"]})
    assert admin_sql(f"select count(*) from proyecto_miembros where proyecto_id='{pid}'") == [["3"]]


def test_cliente_ajeno_solo_creador_o_responsable(ctx):
    # colaborador y rol cliente ven el cliente (por ser miembros) pero no pueden colgarle proyectos
    for n in ("c", "d"):
        assert [x["id"] for x in gql(ctx[n]["token"], "{clientes{id}}")["data"]["clientes"]] == [ctx["cli"]["id"]]
        assert "errors" in gql(ctx[n]["token"], Q_PROY, {"c": ctx["cli"]["id"], "n": "Colado PRUEBA"})
    # el responsable sí puede (es responsable de un proyecto de ese cliente)
    r = gql(ctx["a"]["token"], Q_PROY, {"c": ctx["cli"]["id"], "n": "Segundo PRUEBA"})
    assert "errors" not in r


def test_colaborador_y_cliente_solo_lectura(ctx):
    pid = ctx["pid"]
    for n in ("c", "d"):
        t = ctx[n]["token"]
        assert pid in [x["id"] for x in gql(t, "{proyectos{id}}")["data"]["proyectos"]]
        assert len(gql(t, f"{{proyecto_miembros(where:{{proyecto_id:{{_eq:\"{pid}\"}}}}){{user_id}}}}")["data"]["proyecto_miembros"]) == 3
        assert gql(t, Q_UPD, {"id": pid, "e": "cerrado"})["data"]["update_proyectos"]["affected_rows"] == 0
    # eventos: el colaborador los ve, el rol cliente no
    assert gql(ctx["c"]["token"], "{eventos{id}}")["data"]["eventos"] != []
    assert gql(ctx["d"]["token"], "{eventos{id}}")["data"]["eventos"] == []


def test_responsable_edita_y_queda_trazado(ctx):
    a, pid = ctx["a"], ctx["pid"]
    assert gql(a["token"], Q_UPD, {"id": pid, "e": "en_curso"})["data"]["update_proyectos"]["affected_rows"] == 1
    ev = gql(a["token"], f'{{eventos(where:{{entidad_id:{{_eq:"{pid}"}}}},order_by:{{id:asc}}){{accion usuario_id}}}}')["data"]["eventos"]
    assert [e["accion"] for e in ev] == ["insert", "update"] and ev[1]["usuario_id"] == a["id"]
    # límites de longitud
    assert "errors" in gql(a["token"], "mutation($id:uuid!){update_proyectos(where:{id:{_eq:$id}},_set:{nombre:\"%s\"}){affected_rows}}" % ("x" * 201), {"id": pid})
    assert admin_sql(f"select estado::text from proyectos where id='{pid}'") == [["en_curso"]]


def test_endpoint_miembros(ctx):
    a, b, c, e, pid = ctx["a"], ctx["b"], ctx["c"], ctx["e"], ctx["pid"]
    url = f"/proyectos/{pid}/miembros"
    # sin token / token falso
    assert api.get(url).status_code == 401
    assert api.get(url, headers={"authorization": "Bearer basura"}).status_code == 401
    # no miembro: ni siquiera sabe si el proyecto existe
    assert api.get(url, headers=h(b)).status_code == 404
    assert api.post(url, json={"email": e["email"], "rol": "colaborador"}, headers=h(b)).status_code == 404
    # colaborador: puede listar (con emails) pero no gestionar
    lista = api.get(url, headers=h(c)).json()
    assert {m["email"] for m in lista} == {a["email"], c["email"], ctx["d"]["email"]}
    assert api.post(url, json={"email": e["email"], "rol": "colaborador"}, headers=h(c)).status_code == 403
    assert api.delete(f"{url}/{c['id']}", headers=h(c)).status_code == 403
    # responsable: alta, duplicado, correo inexistente, rol inválido
    assert api.post(url, json={"email": e["email"].upper(), "rol": "colaborador"}, headers=h(a)).status_code == 201
    assert api.post(url, json={"email": e["email"], "rol": "cliente"}, headers=h(a)).status_code == 409
    assert api.post(url, json={"email": "no-existe-zz@example.com", "rol": "cliente"}, headers=h(a)).status_code == 404
    assert api.post(url, json={"email": b["email"], "rol": "responsable"}, headers=h(a)).status_code == 422
    # e (ya miembro) ve el proyecto por Hasura
    assert pid in [x["id"] for x in gql(e["token"], "{proyectos{id}}")["data"]["proyectos"]]
    # baja
    assert api.delete(f"{url}/{e['id']}", headers=h(a)).status_code == 204
    assert api.delete(f"{url}/{e['id']}", headers=h(a)).status_code == 404
    assert gql(e["token"], "{proyectos{id}}")["data"]["proyectos"] == []
    # el último responsable no se puede quitar
    r = api.delete(f"{url}/{a['id']}", headers=h(a))
    assert r.status_code == 400
    assert admin_sql(f"select count(*) from proyecto_miembros where proyecto_id='{pid}' and rol='responsable'") == [["1"]]
