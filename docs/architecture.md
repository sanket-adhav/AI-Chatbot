# 🏗️ System Architecture - Icy Cassini

This document outlines the software architecture and structural patterns of **Icy Cassini**, a production-grade multi-agent AI Chatbot platform built with FastAPI and React.

---

## 1. Modular Architectural Blueprint

The application follows a decoupled, multi-tier architectural style:

```
[ Frontend Client (React) ] ──(HTTP / SSE Stream)──> [ API Layer (FastAPI Routers) ]
                                                              │
                                                              ▼
                                                    [ Service Layer (Logic) ]
                                                              │
                                                    ┌─────────┴─────────┐
                                                    ▼                   ▼
                                            [ Repository Layer ]   [ External Services ]
                                                    │                   │
                                                    ▼                   ▼
                                            [ SQLite Database ]     [ Gemini API ]
                                                                    [ ChromaDB (RAG) ]
```

### 📂 File Structure Directory Layout
*   `frontend/`: Client UI built with React, Vite, and Tailwind CSS.
*   `backend/`:
    *   `app/api/v1/`: HTTP Controllers mapped by resource.
    *   `app/core/`: Application settings, security utilities, and database sessions.
    *   `app/models/`: SQLAlchemy ORM database entities.
    *   `app/schemas/`: Pydantic payload models and validation schemas.
    *   `app/repositories/`: Data-access layer separating DB querying from business logic.
    *   `app/services/`: Modular logic for Chat processing, Gemini completions, and Vector database retrievals.
    *   `app/workers/`: Ingestion tasks executed asynchronously.

---

## 2. Ingestion & RAG (Retrieval-Augmented Generation) Pipeline

```
                                  ┌───────────────────────────┐
                                  │   PDF Document Uploaded   │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │ Background Ingestion Task │
                                  └─────────────┬─────────────┘
                                                │
                               ┌────────────────┴────────────────┐
                               ▼                                 ▼
                     [ Semantic Chunking ]            [ Gemini Embeddings API ]
                               │                                 │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │   ChromaDB Vector Store   │
                                  └───────────────────────────┘
```

1. **Document Upload**: Users upload PDF files via the documents controller.
2. **Background Task Processing**: PDF text extraction occurs asynchronously using `pypdf`.
3. **Chunking & Embeddings**:
   * The text is split into semantic paragraphs using standard delimiters.
   * Chunks are sent to the Gemini Embeddings API (`models/gemini-embedding-001`) to generate 768-dimensional dense vector embeddings.
4. **Vector Database**: Embeddings, raw chunk text, and user ownership metadata are upserted into ChromaDB.
5. **Context Retrieval**:
   * During chat sessions, the user's prompt is embedded.
   * Chroma is queried, strictly filtering chunks by the authenticated user's ID.
   * Relevant chunks are concatenated and injected into the LLM system context as reference material.

---

## 3. SSE (Server-Sent Events) Stream Dispatching

To provide a premium user experience, LLM token generations are streamed to the frontend in real time:

* **Event Stream**: The chat endpoint returns a standard EventSource-compatible `StreamingResponse` with `text/event-stream` media-type.
* **Token Buffer**: As Gemini produces tokens, they are written to the connection stream buffer.
* **Security & Tokens**: Prompt and completion token counts are calculated, validated, and saved in the SQL database for admin usage tracking.

---

## 4. Platform Maintenance Mode Middleware

An HTTP middleware intercepts all incoming non-admin traffic when maintenance mode is toggled:
* Checks the current global settings table in SQLite.
* Toggled globally via `/api/admin/settings`.
* If enabled, returns `503 Service Unavailable` with a structured message to user clients, while allowing administrators full control.
