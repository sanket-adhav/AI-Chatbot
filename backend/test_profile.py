import requests

BASE_URL = "http://localhost:8000"

def test():
    # 1. Register
    reg_data = {
        "username": "testuser_profile",
        "email": "testprofile@example.com",
        "password": "password123"
    }
    r = requests.post(f"{BASE_URL}/auth/register", json=reg_data)
    print("Register:", r.status_code, r.text)

    # 2. Login
    login_data = {"email": "testprofile@example.com", "password": "password123"}
    r = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print("Login:", r.status_code, r.text)
    if r.status_code != 200:
        return
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Avatar Upload
    files = {"file": ("test.png", b"fake_png_data_here", "image/png")}
    r = requests.post(f"{BASE_URL}/auth/avatar", files=files, headers=headers)
    print("Avatar:", r.status_code, r.text)

    # 4. Update Profile
    update_data = {"theme_preference": "light", "avatar_url": "/uploads/test.png"}
    r = requests.put(f"{BASE_URL}/auth/me", json=update_data, headers=headers)
    print("Update:", r.status_code, r.text)

test()
