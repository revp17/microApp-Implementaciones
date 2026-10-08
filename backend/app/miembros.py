"""Gestión mínima de miembros de un proyecto (ADR-0001: no guardamos secreto JWT).

El JWT del usuario se valida reenviándolo a Nhost (Auth /user y GraphQL con ese token).
El admin secret se usa solo aquí, en servidor, para resolver emails y escribir en proyecto_miembros.
"""
from typing import Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .config import settings

router = APIRouter(prefix="/proyectos/{proyecto_id}/miembros", tags=["miembros"])


class NuevoMiembro(BaseModel):
    email: str = Field(max_length=254)
    rol: Literal["colaborador", "cliente"]


async def _http(metodo: str, url: str, **kw) -> httpx.Response:
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            return await c.request(metodo, url, **kw)
    except httpx.HTTPError:
        raise HTTPException(502, "No se pudo contactar con Nhost")


async def _gql(query: str, variables: dict, token: str | None = None) -> dict:
    """GraphQL como el usuario (token) o como admin (token=None)."""
    headers = {"authorization": f"Bearer {token}"} if token else {"x-hasura-admin-secret": settings.nhost_admin_secret}
    r = await _http("POST", settings.graphql_url, json={"query": query, "variables": variables}, headers=headers)
    try:
        body = r.json()
    except ValueError:
        raise HTTPException(502, "Respuesta no válida de Nhost")
    if body.get("errors"):
        if token:  # con token de usuario, un error de GraphQL es JWT inválido/expirado
            raise HTTPException(401, "Sesión no válida")
        if "Uniqueness violation" in str(body["errors"]):  # alta concurrente del mismo miembro
            raise HTTPException(409, "Ese usuario ya es miembro del proyecto")
        raise HTTPException(502, "Error consultando la base de datos")
    return body["data"]


def _token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Falta el token de sesión")
    return authorization[7:].strip()


async def _contexto(proyecto_id: UUID, authorization: str | None, solo_responsable: bool):
    """Valida el token con Nhost y devuelve (user_id, miembros del proyecto)."""
    token = _token(authorization)
    r = await _http("GET", f"{settings.auth_url}/user", headers={"authorization": f"Bearer {token}"})
    if r.status_code != 200:
        raise HTTPException(401, "Sesión no válida")
    yo = r.json()["id"]
    d = await _gql(
        "query($id: uuid!) { proyectos_by_pk(id: $id) { miembros { user_id rol } } }",
        {"id": str(proyecto_id)},
        token,
    )
    if d["proyectos_by_pk"] is None:  # no existe o no soy miembro (Hasura no distingue)
        raise HTTPException(404, "Proyecto no encontrado")
    miembros = d["proyectos_by_pk"]["miembros"]
    if solo_responsable and not any(m["user_id"] == yo and m["rol"] == "responsable" for m in miembros):
        raise HTTPException(403, "Solo el responsable puede gestionar miembros")
    return yo, miembros


@router.get("")
async def listar(proyecto_id: UUID, authorization: str | None = Header(default=None)):
    _, miembros = await _contexto(proyecto_id, authorization, solo_responsable=False)
    d = await _gql(
        "query($ids: [uuid!]!) { users(where: {id: {_in: $ids}}) { id email } }",
        {"ids": [m["user_id"] for m in miembros]},
    )
    emails = {u["id"]: u["email"] for u in d["users"]}
    return [{"user_id": m["user_id"], "rol": m["rol"], "email": emails.get(m["user_id"])} for m in miembros]


@router.post("", status_code=201)
async def agregar(proyecto_id: UUID, body: NuevoMiembro, authorization: str | None = Header(default=None)):
    _, miembros = await _contexto(proyecto_id, authorization, solo_responsable=True)
    d = await _gql(
        "query($e: citext!) { users(where: {email: {_eq: $e}}) { id } }",
        {"e": body.email.strip().lower()},
    )
    if not d["users"]:
        raise HTTPException(404, "No hay ningún usuario registrado con ese correo")
    uid = d["users"][0]["id"]
    if any(m["user_id"] == uid for m in miembros):
        raise HTTPException(409, "Ese usuario ya es miembro del proyecto")
    await _gql(
        "mutation($p: uuid!, $u: uuid!, $r: rol_proyecto!) { insert_proyecto_miembros_one(object: {proyecto_id: $p, user_id: $u, rol: $r}) { user_id } }",
        {"p": str(proyecto_id), "u": uid, "r": body.rol},
    )
    return {"user_id": uid, "rol": body.rol}


@router.delete("/{user_id}", status_code=204)
async def quitar(proyecto_id: UUID, user_id: UUID, authorization: str | None = Header(default=None)):
    _, miembros = await _contexto(proyecto_id, authorization, solo_responsable=True)
    objetivo = next((m for m in miembros if m["user_id"] == str(user_id)), None)
    if objetivo is None:
        raise HTTPException(404, "Ese usuario no es miembro del proyecto")
    if objetivo["rol"] == "responsable" and sum(m["rol"] == "responsable" for m in miembros) == 1:
        raise HTTPException(400, "No se puede quitar al último responsable")
    await _gql(
        "mutation($p: uuid!, $u: uuid!) { delete_proyecto_miembros_by_pk(proyecto_id: $p, user_id: $u) { user_id } }",
        {"p": str(proyecto_id), "u": str(user_id)},
    )
