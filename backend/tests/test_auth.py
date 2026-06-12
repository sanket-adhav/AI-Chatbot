def test_register_success(client):
    response = client.post(
        "/auth/register",
        json={"username": "newuser", "email": "newuser@example.com", "password": "newpassword123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["email"] == "newuser@example.com"
    assert "id" in data

def test_register_duplicate_username(client, test_user):
    response = client.post(
        "/auth/register",
        json={"username": test_user.username, "email": "unique@example.com", "password": "password123"}
    )
    assert response.status_code == 409
    assert "Username already taken" in response.json()["detail"]

def test_register_duplicate_email(client, test_user):
    response = client.post(
        "/auth/register",
        json={"username": "uniqueuser", "email": test_user.email, "password": "password123"}
    )
    assert response.status_code == 409
    assert "Email already registered" in response.json()["detail"]

def test_login_success(client, test_user):
    response = client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_login_failure(client, test_user):
    response = client.post(
        "/auth/login",
        json={"email": test_user.email, "password": "wrongpassword"}
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]

def test_get_profile_success(client, user_token, test_user):
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email
    assert data["username"] == test_user.username

def test_get_profile_unauthorized(client):
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_update_profile_success(client, user_token, test_user):
    response = client.put(
        "/auth/me",
        json={"username": "updatedname", "theme_preference": "ocean"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "updatedname"
    assert data["theme_preference"] == "ocean"
