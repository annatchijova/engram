# ENGRAM MNEME adapter — Fly.io deployment image.
#
# MNEME is a sibling repo on the dev machine (not a PyPI package), so the
# image clones it from its public GitHub mirror at a pinned commit rather
# than vendoring a copy here — one source of truth, reproducible build.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Pinned to the commit the local sibling checkout was built against when
# this image was written (server/README.md documents how to re-pin).
ARG MNEME_COMMIT=124739ee9b3d99800c26b1ce6ccd320800810975
RUN git clone https://github.com/annatchijova/mneme.git /mneme \
    && cd /mneme && git checkout "$MNEME_COMMIT"

ENV MNEME_REPO_PATH=/mneme
ENV MNEME_DB_PATH=/app/data/demo_field.db

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py seed_demo_field.py ./

EXPOSE 8080

# The field reseeds fresh on every boot (idempotent — refuses to touch a
# non-empty field) rather than relying on a persistent volume: a live
# demo quarantine/export resets on redeploy or restart. Named tradeoff,
# not hidden — see server/README.md.
CMD ["sh", "-c", "python3 seed_demo_field.py; exec uvicorn app:app --host 0.0.0.0 --port 8080"]
