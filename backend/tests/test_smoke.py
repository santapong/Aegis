def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["version"]
    assert body["features"]["ai"] in {"configured", "not_configured"}
    assert body["features"]["stripe"] in {"configured", "not_configured"}


def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_register_login_me_flow(client):
    # Register
    r = client.post(
        "/api/auth/register",
        json={
            "email": "smoke@example.com",
            "username": "smokeuser",
            "password": "pw-at-least-8",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "smoke@example.com"

    # Login
    r = client.post(
        "/api/auth/login",
        json={
            "email": "smoke@example.com",
            "password": "pw-at-least-8",
        },
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    assert token

    # Authorized /me
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "smoke@example.com"


def test_login_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "wrong@example.com",
            "username": "wronguser",
            "password": "pw-at-least-8",
        },
    )
    r = client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "nope-wrong-pw"},
    )
    assert r.status_code == 401
