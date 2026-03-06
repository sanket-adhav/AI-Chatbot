# Project Implementation & Feature Log

This document serves as a detailed ledger of all the technical features, functionalities, and integrations that have been built into the **Icy Cassini AI Chatbot Platform**. 

---

## 🏗️ 1. Core Architecture Integrations
- **FastAPI Backend Server**: High-performance asynchronous Python API server running on Uvicorn.
- **React Frontend**: Single-page application built with Vite for incredibly fast Hot Module Replacement (HMR) during development.
- **SQLAlchemy ORM**: Relational database mapper linking Python objects to database tables securely.
- **Alembic Migrations**: Version control system for database schemas, allowing smooth upgrades of tables and columns (SQLite default).
- **ChromaDB Vector Store**: Local, persistent semantic search database used for storing mathematical embeddings of document text.
- **Google Generative AI (Gemini)**: Core AI engine powering conversational logic (`gemini-2.5-flash`), vision (`gemini-2.5-flash`), and embeddings (`models/gemini-embedding-001`).

---

## 🔐 2. Authentication & Security Layer
- **JWT (JSON Web Token) Auth**: Secure, stateless authentication system.
- **Password Hashing**: Uses `passlib` (bcrypt) to safely salt and hash user passwords before saving them to the database.
- **Session Lifetimes**: Implementation of short-lived Access Tokens and long-lived Refresh Tokens.
- **Data Isolation**: All database queries and ChromaDB vector lookups strictly filter by `user_id` to ensure absolute tenant isolation so users cannot see each other's data or documents.
- **Rate Limiting**: Integrated `slowapi` to prevent API abuse (e.g., limiting login attempts, heavy generation limits).

---

## 🤖 3. Multi-Agent AI System
- **Custom AI Personas**: Users and admins can create customized AI agents defined by strict system instructions.
- **Pre-Seeded Agents**: Backend automatically seeds the database on startup with base agents (e.g., "Helpful Assistant", "Code Expert", "Creative Writer").
- **Agent Context Binding**: Instructions are prepended dynamically to the LLM context window based on the chosen agent for a specific conversation.

---

## 💬 4. Conversational Engine & Memory
- **Persistent Chat History**: Every message sent and received is logged in the `messages` table linked to a specific `conversation_id`.
- **Server-Sent Events (SSE)**: Streaming endpoint that pipelines Gemini's chunked responses directly to the frontend to create a real-time "typing" effect.
- **Context Window Management**: The backend retrieves past messages in the active thread and formats them into Gemini's specific `[{"role": "user", "parts": [...]}, {"role": "model", ...}]` history format for continuous conversation.

---

## 📚 5. Document Understanding (RAG System)
A complete Retrieval-Augmented Generation pipeline implemented entirely in-house:
- **PDF Upload Endpoint**: Accepts `.pdf` files and temporarily saves them to the server.
- **Background Processing Task**: FastAPI `BackgroundTasks` are used so the user doesn't have to wait for the whole file to process:
  1. **Text Extraction**: Uses `pypdf` to rip raw text from the document pages.
  2. **Semantic Chunking**: Uses Langchain's `RecursiveCharacterTextSplitter` to chop the book into 800-character chunks with a 150-character overlap (to preserve context across paragraph breaks).
  3. **Vector Embeddings**: Sends each chunk to `models/gemini-embedding-001` to get an array of float numbers representing the semantic meaning.
  4. **Vector Storage**: Saves the embedding and the original text chunk into ChromaDB alongside the user's ID.
- **Knowledge Base Settings UI**: Frontend modal dedicated to viewing processing status, uploading new PDFs, and deleting old ones.
- **Dynamic Context Injection (Toggle)**: Users can click the "Knowledge Base" toggle in the chat input. When active, the backend intercepts the user's prompt, searches ChromaDB for the Top 4 most relevant chunks from their uploaded PDFs, and silently injects that context as an instruction to the AI before answering.

---

## 🎙️ 6. Multi-Modal Inputs (Vision & Voice)
- **Image Upload & Analysis**: 
  - Users can attach `.png`, `.jpg`, `.webp` files in the chat input dropdown.
  - The image is read as a Base64 string and sent to the `gemini-2.5-flash` vision capabilities alongside the text prompt allowing the AI to "see" and describe the image.
- **Voice Dictation (Speech-to-Text)**:
  - Integrates the browser's native `SpeechRecognition` web API.
  - Users click the microphone icon, speak out loud, and their speech is continuously transcribed in real-time into the input text area.

---

## 🗂️ 7. Organization & Theming
- **Folder Management**: Users can create folders and move existing conversations into them to keep the sidebar organized.
- **Search Capability**: An endpoint that performs full-text `ILIKE` searches across past conversation messages to help users find old chats.
- **Theming Engine**: CSS Variable-driven theme system. The user's preference (Dark Base, Light Base, Ocean Blue, Emerald) is saved to their profile in the backend database and automatically applied upon login.

---

## 📥 8. Export Capabilities
- **Export to JSON**: Dumps the entire history of a specific conversation as raw structured JSON data for developers.
- **Export to PDF**: Backend uses `ReportLab` to stitch together an aesthetically pleasing, downloadable PDF document of a chat thread, complete with timestamps and role distinctions.

---

## 🎨 9. Frontend UX/UI Patterns
- **Glassmorphism**: Extensive use of backdrop-filters, subtle borders, and blur effects for a premium native-app feel.
- **Unified Action Menu**: Merged file attachments, voice dictation, and document toggling into a single animated slide-up dropdown to keep the chat interface clean and distraction-free.
- **Dynamic CSS Animations**: Implementations of `spin`, `pulseRecording`, `slideUp`, and `dropdownFadeIn` keyframes for micro-interactions that make the app feel responsive.
