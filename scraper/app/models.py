"""Pydantic models that describe the JSON shapes exchanged with Convex.

Convex actions consume these payloads verbatim and copy them into the database
(after upserting on the ``name`` unique index). Keeping the contract here keeps
the wire format honest with what the scraper actually emits.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScrapedProduct(BaseModel):
    """A single product extracted from the consumables listing.

    :ivar name: Product display name — also the unique key in the database.
    :ivar price: Price in the original currency (USD on web-scraping.dev).
    :ivar currency: ISO 4217 code, normalised by :pyfunc:`app.scraper.normalize_price`.
    :ivar description: Short marketing blurb shown on the listing card.
    :ivar image_url: Absolute URL of the product thumbnail.
    :ivar product_url: Detail page URL for the product (useful for the UI).
    """

    name: str
    price: float
    currency: str
    description: str
    image_url: str
    product_url: str | None = None


class ScrapeResponse(BaseModel):
    """Response envelope for ``POST /scrape``.

    :ivar products: Products extracted from every paginated listing page.
    :ivar scraped_at: ISO-8601 timestamp the scrape finished (UTC).
    """

    products: list[ScrapedProduct]
    scraped_at: str


class InvoiceLineItem(BaseModel):
    """A single billable row extracted from a PDF invoice.

    The Romanian e-Factura layout exposes both a product code and a free-form
    name in the same cell; the parser splits them apart for clarity.

    :ivar product_code: SKU / catalogue identifier (e.g. ``172812F``).
    :ivar product_name: Human-readable description shown next to the code.
    :ivar unit_price: Price per unit in :pyattr:`currency`.
    :ivar currency: ISO 4217 currency code from the invoice line.
    :ivar quantity: Billed quantity (can be negative on credit notes).
    """

    product_code: str
    product_name: str
    unit_price: float
    currency: str
    quantity: float


class InvoiceParseResponse(BaseModel):
    """Response envelope for ``POST /parse-invoice``.

    :ivar line_items: Every invoice row that survived parsing.
    :ivar csv: CSV serialisation of :pyattr:`line_items` ready to be returned to
        the browser. Including it here means the React app does not need to do
        its own CSV assembly.
    """

    line_items: list[InvoiceLineItem] = Field(default_factory=list)
    csv: str
