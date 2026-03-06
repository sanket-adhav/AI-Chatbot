import requests

BASE_URL = "http://localhost:8000"

def test():
    token = requests.post(f"{BASE_URL}/auth/login", json={"email": "testprofile@example.com", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    update_data = {"theme_preference": "dark", "username": "Sanket Adhav1"}
    r = requests.put(f"{BASE_URL}/auth/me", json=update_data, headers=headers)
    print("Update:", r.status_code, r.text)

test()
