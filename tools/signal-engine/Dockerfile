FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# API keys + DATABASE_URL are supplied at runtime (docker run --env-file .env,
# or the host platform's own env var config) — never baked into the image.
ENV PYTHONUNBUFFERED=1

CMD ["python", "examples/run_daemon.py", "--interval", "900"]
