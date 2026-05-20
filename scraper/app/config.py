"""Runtime configuration loaded from environment variables.

Centralises every env-derived value the service needs so the rest of the code
never reads ``os.environ`` directly. Values are loaded once at import time.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Immutable view of the service configuration.

    :ivar shared_secret: Bearer token required on every protected endpoint. The
        Convex actions (and the React app via Convex) pass it in the
        ``X-Scraper-Secret`` header.
    :ivar scraping_dev_username: Credentials used by the Playwright session to
        log into ``web-scraping.dev``.
    :ivar scraping_dev_password: See :pyattr:`scraping_dev_username`.
    :ivar headless: ``True`` to run Chromium headless. Toggle to ``False`` when
        debugging locally to watch the browser.
    :ivar port: HTTP port the FastAPI app binds to.
    """

    shared_secret: str
    scraping_dev_username: str
    scraping_dev_password: str
    headless: bool
    port: int


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def load_settings() -> Settings:
    """Read environment variables and return a :class:`Settings` instance."""
    return Settings(
        shared_secret=os.environ.get("SCRAPER_SHARED_SECRET", "dev-secret"),
        scraping_dev_username=os.environ.get("SCRAPING_DEV_USERNAME", "user123"),
        scraping_dev_password=os.environ.get("SCRAPING_DEV_PASSWORD", "password"),
        headless=_as_bool(os.environ.get("HEADLESS"), True),
        port=int(os.environ.get("PORT", "8000")),
    )


SETTINGS = load_settings()
