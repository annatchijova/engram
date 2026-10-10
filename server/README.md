# ENGRAM server — Nivel 1 read adapter

Read-only FastAPI gateway over MNEME (`/home/labestiadevigia/mneme` by
default). No mutating endpoint exists here — see `app.py`'s module
docstring for why that's deliberate for Nivel 1.

## Run

```sh
pip install -r requirements.txt

# 1. seed a demo field (only needs to be done once; uses MNEME's real
#    authorized API — bootstrap/store/reinforce/supersede/quarantine)
python3 seed_demo_field.py

# 2. start the adapter
ENGRAM_READ_TOKEN=devtoken123 \
ENGRAM_CLIENT_ORIGIN=https://localhost:8081 \
python3 -m uvicorn app:app --port 8000
```

`ENGRAM_CLIENT_ORIGIN` must match exactly where `npm run dev` serves the
client from (IWSDK's dev server defaults to `https://localhost:8081`, not
`http://` — the scheme matters for CORS). `ENGRAM_READ_TOKEN` must match
`client/.env`'s `VITE_ENGRAM_READ_TOKEN`.

Re-run `seed_demo_field.py --reset` to wipe `data/demo_field.db` and seed a
fresh field; without `--reset` it refuses to touch a non-empty field.
