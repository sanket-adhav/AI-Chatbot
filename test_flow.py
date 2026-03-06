import requests
import json

base = "http://localhost:8000"

def run():
    print("Testing backend flow...")
    r = requests.post(f"{base}/auth/register", json={"username": "tester987", "email": "tester987@test.com", "password": "password"})
    if r.status_code == 400:
        print("Already registered, logging in...")
        r = requests.post(f"{base}/auth/login", data={"username": "tester987@test.com", "password": "password"})
    
    if r.status_code != 200:
        print("Auth failed", r.text)
        return
        
    token = r.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(f"{base}/agents", headers=headers)
    if not r.ok or not r.json():
        print("Failed to get agents")
        return
    agent_id = r.json()[0]["id"]

    r = requests.post(f"{base}/conversations", headers=headers, json={"title": "Test Error Flow", "agent_id": agent_id})
    print("Create Conv Response", r.status_code, r.text)
    if not r.ok: return
    conv_id = r.json()["id"]

    print("Sending message to conversation", conv_id)
    s = requests.Session()
    req = requests.Request('POST', f"{base}/conversations/{conv_id}/messages/stream", headers=headers, json={"content": "Hello!"})
    prepared = req.prepare()
    resp = s.send(prepared, stream=True)
    
    print("Stream Status:", resp.status_code)
    for line in resp.iter_lines():
        if line:
            print("STREAM:", line.decode("utf-8"))

run()
