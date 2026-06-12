import pytest
from unittest.mock import patch

def test_list_documents(client, user_token):
    response = client.get(
        "/documents",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_upload_document_success(client, user_token):
    # Mock the background worker task to avoid running it during the test
    with patch("app.api.v1.documents.process_document_background") as mock_process:
        pdf_data = b"%PDF-1.4 mock pdf content"
        files = {"file": ("test_doc.pdf", pdf_data, "application/pdf")}
        
        response = client.post(
            "/documents/upload",
            files=files,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test_doc.pdf"
        assert data["status"] == "processing"
        assert "id" in data
        mock_process.assert_called_once()

def test_upload_document_invalid_type(client, user_token):
    files = {"file": ("test_doc.txt", b"plain text", "text/plain")}
    response = client.post(
        "/documents/upload",
        files=files,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 400
    assert "Only PDF files are supported" in response.json()["detail"]

def test_delete_document_success(client, user_token):
    with patch("app.api.v1.documents.process_document_background"):
        # Upload a doc first
        files = {"file": ("test_doc.pdf", b"%PDF-1.4 content", "application/pdf")}
        upload_resp = client.post(
            "/documents/upload",
            files=files,
            headers={"Authorization": f"Bearer {user_token}"}
        )
        doc_id = upload_resp.json()["id"]

        # Delete it
        with patch("app.api.v1.documents.delete_by_document_id") as mock_vector_delete:
            delete_resp = client.delete(
                f"/documents/{doc_id}",
                headers={"Authorization": f"Bearer {user_token}"}
            )
            assert delete_resp.status_code == 200
            assert delete_resp.json()["message"] == "Document deleted successfully"
            mock_vector_delete.assert_called_once_with(doc_id)
