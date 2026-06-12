def test_analytics_summary(client, user_token):
    response = client.get(
        "/analytics/summary?days=7",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_messages" in data
    assert "total_conversations" in data
    assert "total_tokens" in data

def test_analytics_daily(client, user_token):
    response = client.get(
        "/analytics/daily?days=7",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_analytics_agents(client, user_token):
    response = client.get(
        "/analytics/agents?days=7",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
