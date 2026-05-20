"""Playwright-driven scraper for ``web-scraping.dev``.

The site is a deliberately scraper-friendly playground; the consumables
category lists products across paginated pages. We log in once and then walk
``?page=N`` until a page returns no cards. Login is required by the brief even
though the listing itself is publicly readable.

Selectors target the documented stable hooks (``[data-testid]`` and class
prefixes ``product-*``) so a CSS refresh on the site is unlikely to break us
silently.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from .config import SETTINGS
from .models import ScrapedProduct

LOGIN_URL = "https://www.web-scraping.dev/login"
PRODUCTS_URL = "https://www.web-scraping.dev/products?category=consumables"


def _normalize_price(text: str) -> tuple[float, str]:
    """Split a ``$24.99`` style label into ``(amount, currency)``.

    :param text: Raw price label as rendered on the card.
    :returns: ``(amount, ISO-4217 code)``. Unknown symbols default to ``USD``
        because the demo site only uses dollars.
    :raises ValueError: If no number can be extracted.
    """
    match = re.search(r"([\d,]+\.\d{1,2}|\d+)", text)
    if not match:
        raise ValueError(f"no numeric value in price text: {text!r}")
    amount = float(match.group(1).replace(",", ""))
    currency = "USD" if "$" in text else "USD"
    if "€" in text or "EUR" in text.upper():
        currency = "EUR"
    elif "LEI" in text.upper() or "RON" in text.upper():
        currency = "RON"
    return amount, currency


async def _login(page: Page) -> None:
    """Submit the demo login form.

    web-scraping.dev accepts any non-empty credentials and sets an
    ``auth-session`` cookie. We use whatever the operator put in
    :pyattr:`Settings.scraping_dev_username` / ``_password`` so the request log
    on the demo site is identifiable.
    """
    await page.goto(LOGIN_URL, wait_until="domcontentloaded")
    # The form uses native HTML — fields are <input name="username"/"password">.
    await page.locator('input[name="username"], #username').first.fill(
        SETTINGS.scraping_dev_username
    )
    await page.locator('input[name="password"], #password').first.fill(
        SETTINGS.scraping_dev_password
    )
    async with page.expect_navigation(wait_until="domcontentloaded"):
        await page.locator('button[type="submit"], form button').first.click()


async def _extract_products_on_page(page: Page) -> list[ScrapedProduct]:
    """Extract every product card visible on the current listing page."""
    cards = page.locator("div.row.product")
    count = await cards.count()
    if count == 0:
        # Fallback: some templates render cards inside ``div.product``.
        cards = page.locator("div.product")
        count = await cards.count()

    products: list[ScrapedProduct] = []
    for i in range(count):
        card = cards.nth(i)

        name_loc = card.locator("h3 a, h3, .product-title a, .product-title").first
        name = (await name_loc.inner_text()).strip()

        # Description sits in a paragraph below the title.
        desc_loc = card.locator(".product-description, .description, p").first
        description = ""
        if await desc_loc.count() > 0:
            description = (await desc_loc.inner_text()).strip()

        price_loc = card.locator(".product-price, .price").first
        price_text = (await price_loc.inner_text()).strip() if await price_loc.count() else ""
        try:
            price, currency = _normalize_price(price_text)
        except ValueError:
            continue

        img_loc = card.locator("img").first
        image_src = await img_loc.get_attribute("src") if await img_loc.count() else None
        image_url = urljoin(PRODUCTS_URL, image_src) if image_src else ""

        link_loc = card.locator("h3 a, a.product-link, a").first
        href = await link_loc.get_attribute("href") if await link_loc.count() else None
        product_url = urljoin(PRODUCTS_URL, href) if href else None

        if not name or not image_url:
            continue

        products.append(
            ScrapedProduct(
                name=name,
                price=price,
                currency=currency,
                description=description,
                image_url=image_url,
                product_url=product_url,
            )
        )
    return products


async def _walk_pages(page: Page, max_pages: int = 10) -> list[ScrapedProduct]:
    """Iterate ``?page=N`` until a page yields no cards or ``max_pages`` is hit.

    Returned list is deduplicated on the product name (case-insensitive) so the
    Convex upsert never receives same-name collisions from within one scrape.
    """
    seen: dict[str, ScrapedProduct] = {}
    for n in range(1, max_pages + 1):
        url = f"{PRODUCTS_URL}&page={n}"
        await page.goto(url, wait_until="domcontentloaded")
        batch = await _extract_products_on_page(page)
        if not batch:
            break
        for product in batch:
            key = product.name.lower()
            seen.setdefault(key, product)
        if len(batch) < 5:  # listing pages on this site show ~5 cards per page
            # Defensive: site might still serve a partial last page.
            continue
    return list(seen.values())


async def scrape_products() -> list[ScrapedProduct]:
    """End-to-end scrape: launch Chromium, log in, walk pages, return products.

    A fresh browser context is created for each call so cookies/session leak
    between scheduled runs is impossible.

    :returns: Deduplicated list of products from the consumables category.
    """
    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(headless=SETTINGS.headless)
        try:
            context: BrowserContext = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36 proba-practica-autobrand"
                ),
            )
            page = await context.new_page()
            await _login(page)
            return await _walk_pages(page)
        finally:
            await browser.close()


def scrape_completion_timestamp() -> str:
    """Helper returning the current UTC timestamp in ISO-8601 form."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


__all__ = ["scrape_products", "scrape_completion_timestamp"]
