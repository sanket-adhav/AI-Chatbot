import requests
import json

base = "http://localhost:8000"

# 1. Register/Login
r = requests.post(f"{base}/auth/register", json={"username": "tester987", "email": "tester987@test.com", "password": "password"})
if r.status_code == 400:
    r = requests.post(f"{base}/auth/login", data={"username": "tester987@test.com", "password": "password"})
token = r.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

# 2. Get Agent
r = requests.get(f"{base}/agents", headers=headers)
agent_id = r.json()[0]["id"]

# 3. Create Conv
r = requests.post(f"{base}/conversations", headers=headers, json={"title": "Test Chat", "agent_id": agent_id})
print("Create Conv Response:", r.status_code, r.text)
conv_id = r.json()["id"]

# 4. Send Message (Stream)
s = requests.Session()
req = requests.Request('POST', f"{base}/conversations/{conv_id}/messages/stream", headers=headers, json={"content": "Hello! Are you there?"})
prepared = req.prepare()
resp = s.send(prepared, stream=True)
print("Stream Status:", resp.status_code)
for line in resp.iter_lines():
    if line:
        print(line.decode('utf-8'))
