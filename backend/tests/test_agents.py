def test_create_agent_success(client, user_token):
    response = client.post(
        "/agents",
        json={
            "name": "Math Wizard",
            "description": "Solves math problems step by step",
            "instruction_template": "You are a helpful math wizard.",
            "avatar_icon": "🧮"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Math Wizard"
    assert data["description"] == "Solves math problems step by step"
    assert data["avatar_icon"] == "🧮"
    assert data["is_public"] is False
    assert "id" in data

def test_create_duplicate_agent_name(client, user_token):
    # Create first agent
    client.post(
        "/agents",
        json={
            "name": "Unique Agent",
            "description": "Unique description",
            "instruction_template": "Instructions",
            "avatar_icon": "🤖"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    # Try creating with duplicate name
    response = client.post(
        "/agents",
        json={
            "name": "Unique Agent",
            "description": "Another description",
            "instruction_template": "Different instructions",
            "avatar_icon": "🤖"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 400
    assert "An agent with this name already exists" in response.json()["detail"]

def test_list_agents(client, user_token):
    # Ensure there is at least one agent (creating one)
    client.post(
        "/agents",
        json={
            "name": "Helper Agent",
            "description": "Description",
            "instruction_template": "Instructions",
            "avatar_icon": "🤖"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    
    response = client.get(
        "/agents",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    agents = response.json()
    assert len(agents) >= 1
    assert any(a["name"] == "Helper Agent" for a in agents)

def test_get_agent_by_id(client, user_token):
    # Create agent
    create_response = client.post(
        "/agents",
        json={
            "name": "Target Agent",
            "description": "Description",
            "instruction_template": "Instructions",
            "avatar_icon": "🤖"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    agent_id = create_response.json()["id"]
    
    # Retrieve agent
    response = client.get(
        f"/agents/{agent_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Target Agent"

def test_get_nonexistent_agent(client, user_token):
    response = client.get(
        "/agents/9999",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 404

def test_delete_agent_success(client, user_token):
    # Create agent
    create_response = client.post(
        "/agents",
        json={
            "name": "Deletable Agent",
            "description": "Description",
            "instruction_template": "Instructions",
            "avatar_icon": "🤖"
        },
        headers={"Authorization": f"Bearer {user_token}"}
    )
    agent_id = create_response.json()["id"]
    
    # Delete agent
    response = client.delete(
        f"/agents/{agent_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 204
    
    # Verify deletion
    verify_response = client.get(
        f"/agents/{agent_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert verify_response.status_code == 404
