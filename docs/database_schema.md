# 🗄️ Database Schema - Icy Cassini

The relational database schema is mapped using SQLAlchemy ORM. The default engine resolves to a local SQLite database file, but supports standard SQL engines (such as PostgreSQL) out-of-the-box.

---

## 👥 Table: `users`
Stores user profile information, auth details, and application UI states.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Auto-incrementing identifier. |
| `username` | String | Unique, Not Null | Unique username for client handle. |
| `email` | String | Unique, Not Null | Unique email used for registration/login. |
| `hashed_password` | String | Not Null | Hashed password string (bcrypt). |
| `role` | String | Default: `'user'` | Role (e.g. `'user'` or `'admin'`). |
| `created_at` | DateTime | Default: `now()` | Date and time when user registered. |
| `last_login` | DateTime | Nullable | Records the last successful authentication timestamp. |
| `is_suspended` | Boolean | Default: `False` | Toggled by administrative actions. |
| `theme_preference` | String | Default: `'dark'` | Theme preference (dark, light, ocean, emerald, sunset). |
| `avatar_url` | String | Nullable | Link to uploaded avatar image. |
| `system_prompt` | Text | Nullable | Global system instruction override. |

---

## 🤖 Table: `agents`
Custom prompt contexts and instructions mapping to chatbot personalities.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Unique identifier. |
| `name` | String | Not Null | Custom name of the agent. |
| `description` | String | Nullable | Brief user-facing role explanation. |
| `instruction_template` | Text | Not Null | Main prompt guidelines injected into conversation. |
| `avatar_icon` | String | Nullable | Emoji or icon string representing agent avatar. |
| `is_public` | Boolean | Default: `False` | Visibility to other system users. |
| `created_at` | DateTime | Default: `now()` | Creation date. |
| `user_id` | Integer | Foreign Key (`users.id`) | Relates to agent creator. |

---

## 💬 Table: `conversations`
Represents individual messaging threads.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Thread identifier. |
| `title` | String | Not Null | User-editable conversation title. |
| `model_name` | String | Default: `'gemini-1.5-flash'` | Model model string choice (flash, pro). |
| `system_prompt` | Text | Nullable | Specific instructions override for this chat. |
| `temperature` | Float | Default: `0.7` | Temperature coefficient. |
| `created_at` | DateTime | Default: `now()` | Thread initiation timestamp. |
| `is_pinned` | Boolean | Default: `False` | Pin state in sidebar panel. |
| `user_id` | Integer | Foreign Key (`users.id`) | Owner user reference. |
| `folder_id` | Integer | Foreign Key (`folders.id`), Nullable | Reference grouping folders. |

---

## ✉️ Table: `messages`
Stores individual prompt inputs and generated text tokens.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Message identifier. |
| `role` | String | Not Null | Message author role (`'user'` or `'assistant'`). |
| `content` | Text | Not Null | Raw text string contents. |
| `prompt_tokens` | Integer | Default: `0` | Inbound token length context. |
| `completion_tokens` | Integer | Default: `0` | Outbound response tokens. |
| `total_tokens` | Integer | Default: `0` | Aggregated count. |
| `response_time_ms` | Integer | Default: `0` | Performance metric. |
| `created_at` | DateTime | Default: `now()` | Timestamp. |
| `image_url` | String | Nullable | Vision analysis local URL file path. |
| `model_name` | String | Nullable | Generation engine identifier. |
| `conversation_id` | Integer | Foreign Key (`conversations.id`) | Thread relational link. |

---

## 📄 Table: `documents`
Uploaded reference books, pdf manuals and files parsed for RAG.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Unique document identifier. |
| `filename` | String | Not Null | Original file name. |
| `file_path` | String | Not Null | Real path on file storage system (`data/uploads/documents/...`). |
| `status` | String | Default: `'processing'` | Parsing state (`'processing'`, `'ready'`, `'failed'`). |
| `created_at` | DateTime | Default: `now()` | Upload date. |
| `user_id` | Integer | Foreign Key (`users.id`) | Creator reference. |

---

## 📁 Table: `folders`
Organizes conversations in user layouts.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Unique folder ID. |
| `name` | String | Not Null | Layout folder folder label. |
| `created_at` | DateTime | Default: `now()` | Creation date. |
| `user_id` | Integer | Foreign Key (`users.id`) | Owner reference. |

---

## 🛠️ Table: `system_settings`
Global deployment toggles.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Unique settings ID (normally single row `id=1`). |
| `maintenance_mode` | Boolean | Default: `False` | Suspends non-admin traffic. |
| `allowed_models` | String | Default: `'gemini-1.5-flash,gemini-1.5-pro'` | CSV models selector. |

---

## 📜 Table: `audit_logs`
Logs security-sensitive database actions.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key | Unique audit index. |
| `user_id` | Integer | Foreign Key (`users.id`), Nullable | Acting user context. |
| `action` | String | Not Null | Event label (e.g. `'user_suspended'`, `'delete_user'`). |
| `description` | Text | Nullable | Additional context values. |
| `timestamp` | DateTime | Default: `now()` | Event date. |
