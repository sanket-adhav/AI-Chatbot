# 🤖 Icy Cassini - Production-Ready AI Chatbot Platform

A production-grade, multi-agent AI chatbot platform built using **React**, **FastAPI**, **Gemini API**, and **ChromaDB**. This project offers a highly polished UI, user authentication, persistent conversational memory, multi-modal chat, and a robust **Retrieval-Augmented Generation (RAG)** system.

---

## 🌟 Key Features

### 🖥️ Frontend (React & Vite)
- **Beautiful & Responsive UI**: Glassmorphism elements, CSS animations, and a polished dark/light mode experience.
- **SaaS Analytics Dashboard V3**: 
  - **Animated Counters**: Numbers that count up on load for a premium feel.
  - **High-Fidelity Charts**: Gradient area charts for token usage, bar charts for agent activity, and line charts for response time trends.
  - **Custom Tooltips**: Rich tooltips showing messages, tokens, and estimated costs simultaneously.
  - **System Health Monitor**: Real-time status tracking for API, Database, and Error rates.
- **Export Capabilities**: Export conversations as JSON or highly styled PDF documents (using `html2canvas` & `jsPDF`).
- **Knowledge Base Settings**: Dedicated interface to upload, track processing status of, and delete private PDF documents.
- **Advanced Chat Features**:
  - **Multi-Modal Input**: Support for text, voice dictation, and image uploads.
  - **Folder Organization**: Group conversations into nested folders for better management.
  - **Search**: Instant search across all historical conversation titles.
- **Customizable Themes**: Multiple themes (Dark, Light, Ocean, Emerald) with persistent user preference storage.

### ⚙️ Backend (FastAPI & Python)
- **Gemini AI Integration**: Supports `gemini-1.5-pro` and `gemini-1.5-flash` with dynamic model switching.
- **Advanced Telemetry**: Detailed tracking of prompt tokens, completion tokens, response times, and RAG usage per message.
- **Retrieval-Augmented Generation (RAG)**:
  - **Semantic Chunking**: Intelligent document splitting for better context retrieval.
  - **ChromaDB**: User-isolated vector storage for privacy and speed.
  - **Background Tasks**: Non-blocking document processing and embedding generation.
- **Secure Authentication**: Robust JWT-based auth system with persistent session management.
- **Data Architecture**: PostgreSQL/SQLAlchemy backend with Alembic migrations for schema versioning.
- **Rate Limitings & Security**: Protection against API abuse and strict user data isolation.

---

## 🏗️ Architecture Stack

### Backend
- **Framework:** FastAPI
- **Database:** PostgreSQL (SQLAlchemy), Alembic (Migrations)
- **Vector DB:** ChromaDB
- **AI Gateway:** Google Generative AI (`google-generativeai`)
- **Doc Processing:** `pypdf`, `langchain-text-splitters`

### Frontend
- **Framework:** React + Vite
- **Charting:** Recharts
- **Animations:** Custom CSS Transitions, `react-countup`
- **PDF Generation:** `html2canvas`, `jspdf`
- **API Client:** Axios (Custom interceptors for JWT)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.12+)
- PostgreSQL Database
- A [Google Gemini API Key](https://aistudio.google.com/)

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Set up a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Configure your `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   GEMINI_API_KEY=your_gemini_api_key_here
   SECRET_KEY=your_jwt_secret_token
   ```
4. Run migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

---

## 📊 Analytics & Telemetry
Icy Cassini provides real-time insights into your AI usage. Every message records:
- **Token Count**: Precise breakdown of prompt and completion tokens.
- **Cost Estimation**: Real-time dollar costing based on usage.
- **Latency**: End-to-end response time tracking.
- **Agent Performance**: Comparative analysis of different agent usage.

---

## 📚 Using the Knowledge Base (RAG)
1. **Upload**: Open Settings > Knowledge Base and upload any PDF.
2. **Process**: The system extracts text and generates embeddings in the background.
3. **Toggle**: Enable "Use Knowledge Base" in the chat action menu.
4. **Interact**: The agent will now use your documents as its primary source of truth!
