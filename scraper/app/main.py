"""FastAPI entrypoint exposing the scraper and PDF parser over HTTP.

Endpoints
---------
* ``GET  /health`` — liveness check (unauthenticated).
* ``POST /scrape`` — runs the Playwright scrape and returns the products.
* ``POST /parse-invoice`` — accepts a PDF ``multipart/form-data`` upload and
  returns extracted line items plus a CSV serialisation.

All protected endpoints require the ``X-Scraper-Secret`` header to match
:pyattr:`Settings.shared_secret`. Convex sets this header from its environment
when calling the service.
"""

from __future__ import annotations

import asyncio
import sys

# Playwright spawns Chromium as a subprocess. On Windows that only works on the
# ProactorEventLoop; uvicorn's default selector loop raises NotImplementedError
# inside ``subprocess_exec``. Setting the policy at import time ensures every
# worker the reloader spawns gets the right loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .config import SETTINGS
from .invoice import items_to_csv, parse_invoice_bytes
from .models import InvoiceParseResponse, ScrapeResponse
from .scraper import scrape_completion_timestamp, scrape_products


def require_secret(x_scraper_secret: str | None = Header(default=None)) -> None:
    """FastAPI dependency that enforces the shared-secret header.

    Convex calls this service over the public network in some deployments, so
    the secret is the only thing standing between the world and a Playwright
    process. Time-constant comparison would be nicer but a plain string check
    is sufficient given the secret is long-random.
    """
    if not x_scraper_secret or x_scraper_secret != SETTINGS.shared_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing X-Scraper-Secret header",
        )


app = FastAPI(
    title="Autobrand Practica — Scraper Service",
    version="1.0.0",
    description="Playwright scraper + PDF invoice parser used by the Convex backend.",
)

# Permissive CORS only matters when the React app calls the service directly
# (it currently doesn't; everything is proxied via Convex). Kept here for the
# occasional manual ``curl`` from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Cheap liveness probe used by Convex to verify the service is reachable."""
    return {"status": "ok"}


@app.post("/scrape", response_model=ScrapeResponse, tags=["scrape"], dependencies=[Depends(require_secret)])
async def scrape() -> ScrapeResponse:
    """Run a fresh Playwright scrape and return the discovered products.

    The Convex cron (``0 12-18 * * *``) calls this hourly. Manual invocations
    from the React "Scrape now" button hit the same Convex action which then
    proxies here. Failures bubble up as HTTP 500 so Convex surfaces them to the
    UI.
    """
    products = await scrape_products()
    return ScrapeResponse(products=products, scraped_at=scrape_completion_timestamp())


@app.post(
    "/parse-invoice",
    response_model=InvoiceParseResponse,
    tags=["invoice"],
    dependencies=[Depends(require_secret)],
)
async def parse_invoice(file: UploadFile = File(...)) -> InvoiceParseResponse:
    """Parse an uploaded PDF invoice and return its line items + CSV.

    :param file: Multipart-uploaded PDF document.
    :returns: Structured line items and a ready-to-download CSV string.
    :raises HTTPException: 400 if the upload is not a PDF, 422 if no line item
        could be recovered (most likely a non-eFactura layout).
    """
    if file.content_type and "pdf" not in file.content_type.lower():
        raise HTTPException(status_code=400, detail="expected a PDF upload")

    data = await file.read()
    items = parse_invoice_bytes(data)
    if not items:
        raise HTTPException(status_code=422, detail="no invoice lines recognised")

    return InvoiceParseResponse(line_items=items, csv=items_to_csv(items))
