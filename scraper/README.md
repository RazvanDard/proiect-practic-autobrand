# Scraper service

FastAPI + Playwright service that

1. logs into <https://www.web-scraping.dev/login>,
2. scrapes the consumables listing, and
3. parses Romanian e-Factura PDFs to line items + CSV.

The Convex backend calls this over HTTP. The React app never hits it directly.

## Setup

```bash
cd scraper
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
cp .env.example .env            # then edit secrets
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Smoke-test:

```bash
curl -s http://localhost:8000/health
curl -s -X POST http://localhost:8000/scrape \
     -H "X-Scraper-Secret: $SCRAPER_SHARED_SECRET" | jq '.products | length'
```

## Endpoints

| Method | Path             | Description                                          |
| ------ | ---------------- | ---------------------------------------------------- |
| GET    | `/health`        | Liveness probe (no auth).                            |
| POST   | `/scrape`        | Runs Playwright, returns products + timestamp.       |
| POST   | `/parse-invoice` | Multipart PDF -> `{ line_items, csv }`.              |

All protected endpoints require `X-Scraper-Secret: <SCRAPER_SHARED_SECRET>`.
