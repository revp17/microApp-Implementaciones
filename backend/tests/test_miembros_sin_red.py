from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
PID = "00000000-0000-0000-0000-000000000000"


def test_miembros_requiere_token():
    # Se rechaza antes de contactar con Nhost
    assert client.get(f"/proyectos/{PID}/miembros").status_code == 401
    assert client.post(f"/proyectos/{PID}/miembros", json={"email": "a@b.c", "rol": "colaborador"}).status_code == 401
    assert client.delete(f"/proyectos/{PID}/miembros/{PID}").status_code == 401


def test_miembros_no_permite_asignar_responsable():
    r = client.post(f"/proyectos/{PID}/miembros", json={"email": "a@b.c", "rol": "responsable"}, headers={"authorization": "Bearer x"})
    assert r.status_code == 422
