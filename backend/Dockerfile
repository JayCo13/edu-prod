# ============================================================
# VLearning Backend — Multi-stage Dockerfile
# ============================================================
# Stages:
#   1. base   → Install Python deps
#   2. api    → Run Uvicorn (FastAPI)
#   3. worker → Run Celery worker
# ============================================================

# ── Stage: base ─────────────────────────────────────────────
FROM python:3.13-slim AS base

WORKDIR /app

# System deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# ── Stage: api ──────────────────────────────────────────────
FROM base AS api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Stage: worker ───────────────────────────────────────────
FROM base AS worker

CMD ["celery", "-A", "app.worker.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
