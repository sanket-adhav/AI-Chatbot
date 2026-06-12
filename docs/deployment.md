# 🚀 Deployment Guide - Icy Cassini

This document guides you through setting up and running **Icy Cassini** in local development and production environments.

---

## 1. Local Development Setup

### Backend (FastAPI)

1.  **Create virtual environment**:
    ```bash
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    ```
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Environment Variables**:
    Copy `env.example` to `.env` and configure your credentials:
    ```bash
    cp .env.example .env
    ```
    Make sure to paste your **Gemini API Key** into `GEMINI_API_KEY`.
4.  **Database Migration**:
    The system automatically creates database tables on startup. If you use Alembic migrations:
    ```bash
    alembic upgrade head
    ```
5.  **Run Server**:
    ```bash
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    ```
    The API docs will be available at [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs).

### Frontend (React + Vite)

1.  **Install node modules**:
    ```bash
    cd frontend
    npm install
    ```
2.  **Run Dev server**:
    ```bash
    npm run dev
    ```
    Open browser at [http://localhost:5173](http://localhost:5173).

---

## 2. Production Checklist

When moving Icy Cassini to a production server (e.g. AWS, GCP, DigitalOcean):

1. **Use PostgreSQL Database**:
   * SQLite is suitable for single-user/development instances. In production, configure a robust PostgreSQL instance.
   * Update the `DATABASE_URL` in `.env` to point to PostgreSQL:
     ```
     DATABASE_URL=postgresql://user:password@host:5432/dbname
     ```
2. **Disable Reload Mode**:
   * Do not run uvicorn with `--reload` flag.
   * Run with standard worker count (e.g. 4 workers):
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
     ```
3. **Nginx Reverse Proxy & SSL**:
   * Set up Nginx as a reverse proxy in front of FastAPI.
   * Configure SSL certificates using Let's Encrypt / Certbot.
   * Ensure standard CORS origins are restricted to your production frontend domain.
4. **Persistent Vector Database Path**:
   * Ensure the `data/chroma_db` folder path is writable and resides on persistent storage.
