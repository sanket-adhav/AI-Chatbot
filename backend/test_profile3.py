import requests

BASE_URL = "http://localhost:8000"

def test():
    # Login again
    token = requests.post(f"{BASE_URL}/auth/login", json={"email": "testprofile@example.com", "password": "password123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test with system_prompt empty string
    update_data = {"theme_preference": "dark", "username": "Sanket Adhav2", "system_prompt": ""}
    r = requests.put(f"{BASE_URL}/auth/me", json=update_data, headers=headers)
    print("Update with empty string:", r.status_code, r.text)

test()
