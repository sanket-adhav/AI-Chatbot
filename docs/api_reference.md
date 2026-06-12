# 📖 API Reference Manual - Icy Cassini

All API requests expect JSON request bodies and return JSON objects unless stated otherwise. Authenticated routes require an `Authorization: Bearer <token>` header.

---

## 1. Authentication Router (`/auth`)

### Register User
*   **Method**: `POST`
*   **Path**: `/auth/register`
*   **Request Body**:
    ```json
    {
      "username": "johndoe",
      "email": "john@example.com",
      "password": "securepassword123"
    }
    ```
*   **Response (201 Created)**: User details (excluding hashed password).

### User Login
*   **Method**: `POST`
*   **Path**: `/auth/login`
*   **Request Body**:
    ```json
    {
      "email": "john@example.com",
      "password": "securepassword123"
    }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "access_token": "jwt_access_token_string",
      "refresh_token": "jwt_refresh_token_string",
      "token_type": "bearer"
    }
    ```

### Fetch Current User Profile
*   **Method**: `GET`
*   **Path**: `/auth/me`
*   **Response (200 OK)**: Current user object.

### Update Profile Settings
*   **Method**: `PUT`
*   **Path**: `/auth/me`
*   **Request Body**: Any configuration fields to update (theme, password, username, prompt settings).

---

## 2. Conversations Router (`/conversations`)

### Create Chat Thread
*   **Method**: `POST`
*   **Path**: `/conversations`
*   **Request Body**:
    ```json
    {
      "title": "Topic discussion",
      "model_name": "gemini-1.5-flash",
      "system_prompt": "Optional agent instructions",
      "temperature": 0.7
    }
    ```

### List Threads
*   **Method**: `GET`
*   **Path**: `/conversations`
*   **Response (200 OK)**: List of thread metadata.

### Send Message (Synchronous)
*   **Method**: `POST`
*   **Path**: `/conversations/{conv_id}/messages`
*   **Request Body**:
    ```json
    {
      "content": "Why is the sky blue?"
    }
    ```

### Send Message (Real-Time SSE Stream)
*   **Method**: `POST`
*   **Path**: `/conversations/{conv_id}/messages/stream`
*   **Request Body**: Same as standard message.
*   **Response (200 OK)**: `text/event-stream` chunks containing tokens.

---

## 3. Folders Router (`/folders`)

### Create Folder
*   **Method**: `POST`
*   **Path**: `/folders`
*   **Request Body**:
    ```json
    {
      "name": "Personal Assistant"
    }
    ```

### List Folders
*   **Method**: `GET`
*   **Path**: `/folders`

---

## 4. Multi-Agent Router (`/agents`)

### Create Custom Agent
*   **Method**: `POST`
*   **Path**: `/agents`
*   **Request Body**:
    ```json
    {
      "name": "Code Reviewer",
      "description": "Analyzes pull requests",
      "instruction_template": "Examine the following code block for bugs...",
      "avatar_icon": "🔬"
    }
    ```

### List Agents
*   **Method**: `GET`
*   **Path**: `/agents`

---

## 5. RAG / Documents Ingestion (`/documents`)

### Upload PDF Ingestion
*   **Method**: `POST`
*   **Path**: `/documents/upload`
*   **Request Content-Type**: `multipart/form-data`
*   **Form Param**: `file` (PDF format only, max 5MB).
*   **Response (200 OK)**:
    ```json
    {
      "id": 12,
      "filename": "annual_report_2025.pdf",
      "status": "processing"
    }
    ```

### List Ingested Documents
*   **Method**: `GET`
*   **Path**: `/documents`

---

## 6. Admin Control Panel (`/admin`)

### Fetch Health & Core Metrics
*   **Method**: `GET`
*   **Path**: `/admin/stats`

### Patch System Settings (Maintenance Mode)
*   **Method**: `PATCH`
*   **Path**: `/admin/settings`
*   **Request Body**:
    ```json
    {
      "maintenance_mode": true
    }
    ```
