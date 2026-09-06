# Build context is nlp-service/ (this service is standalone — its own
# requirements.txt, not part of the pnpm workspace):
#   docker build -f nlp-service/Dockerfile -t engofy-nlp nlp-service
#
# Python is pinned to the version CI exercises (.github/workflows/app.yaml
# nlp-service job). The spaCy offset math is a stable contract for the NestJS
# spacy_parse stage — bump deliberately and re-run the pytest suite.
ARG PYTHON_IMAGE='3.14-slim-trixie'

# ------------------------------------------------------------------------------
# Build — resolve deps into a venv (incl. the pinned en_core_web_sm model wheel
# referenced by URL in requirements.txt, so no runtime `spacy download`)
# ------------------------------------------------------------------------------
FROM python:${PYTHON_IMAGE} AS build

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

# ------------------------------------------------------------------------------
# Runtime — internal-only FastAPI service, never published to host / edge
# (stack.prod.yaml declares no ports: for it; only the overlay reaches :8000)
# ------------------------------------------------------------------------------
FROM python:${PYTHON_IMAGE} AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY --from=build /opt/venv /opt/venv
COPY app.py ./

EXPOSE 8000

# Non-root. The venv (/opt/venv) is world-readable as pip installs it, so a
# numeric UID that is absent from /etc/passwd can still run it.
USER 1000:1000

# The model is resident from `import spacy` at module load, so /health does no
# extra work. start-period covers a cold container's model load.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status == 200 else 1)"]

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
