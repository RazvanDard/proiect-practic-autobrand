"""PDF invoice parser tailored to Romanian e-Factura (RO eFactura).

The sample invoice (``AD AUTO TOTAL SRL_20241747776_2024_03_01.pdf``) lays out
each invoice line in a table with the columns:

    Linia | Nume articol/Descriere articol | Tara provenienta |
    Pretul net al articolului | Moneda | Cantitate de baza |
    Cantitate facturata | UM | Cota TVA | Valoare neta

``pdfplumber`` is good enough to recover that table on this PDF; the parser is
intentionally defensive about whitespace and column alignment because the
layout shifts when fields are empty.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Sequence

import pdfplumber

from .models import InvoiceLineItem


_NUMBER_RE = re.compile(r"-?\d+[.,]?\d*")


def _parse_number(value: str | None) -> float:
    """Convert a localised number string (``1.234,56`` or ``1,234.56``) to float.

    :raises ValueError: If no digits can be found.
    """
    if not value:
        raise ValueError("empty number")
    text = value.strip()
    # If both separators present, the rightmost one wins as decimal.
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        # Treat lone comma as decimal separator (Romanian convention).
        text = text.replace(",", ".")
    match = _NUMBER_RE.search(text)
    if not match:
        raise ValueError(f"no number in {value!r}")
    return float(match.group(0).replace(",", "."))


def _split_code_and_name(cell: str) -> tuple[str, str]:
    """Split ``"172812F COMUTATOR PORNIRE FEBI 172812F"`` into code + name.

    The invoice template duplicates the SKU at the start and end of the
    description cell. We take the leading token as code and everything else
    (minus the trailing duplicate) as the product name.
    """
    cleaned = re.sub(r"\s+", " ", cell).strip()
    if not cleaned:
        return "", ""
    tokens = cleaned.split(" ")
    code = tokens[0]
    rest_tokens = tokens[1:]
    if rest_tokens and rest_tokens[-1] == code:
        rest_tokens = rest_tokens[:-1]
    return code, " ".join(rest_tokens).strip()


def _row_is_line_item(row: Sequence[str | None]) -> bool:
    """Heuristic: a real invoice line starts with an integer ``Linia`` value."""
    if not row:
        return False
    first = (row[0] or "").strip()
    return first.isdigit()


def _line_item_from_row(row: Sequence[str | None]) -> InvoiceLineItem | None:
    """Map one ``pdfplumber`` row to :class:`InvoiceLineItem` or ``None``.

    Robust against trailing empty cells and different column counts: we always
    address columns from the right where the numeric values live, because the
    left ``Nume articol`` cell sometimes wraps and shifts the indices.
    """
    cells = [(c or "").strip() for c in row]
    if not _row_is_line_item(cells):
        return None

    # Pad short rows so the indexed access below is safe.
    if len(cells) < 8:
        return None

    try:
        # Right-aligned columns: ...., pret_unitar, moneda, cant_baza, cant_factura, UM, cota_tva, valoare_neta
        valoare_neta_idx = len(cells) - 1  # noqa: F841 — kept for clarity
        cota_tva_idx = len(cells) - 2  # noqa: F841
        um_idx = len(cells) - 3  # noqa: F841
        cant_factura_idx = len(cells) - 4
        cant_baza_idx = len(cells) - 5  # noqa: F841
        moneda_idx = len(cells) - 6
        pret_idx = len(cells) - 7

        unit_price = _parse_number(cells[pret_idx])
        currency = cells[moneda_idx] or "RON"
        quantity = _parse_number(cells[cant_factura_idx])
    except (ValueError, IndexError):
        return None

    # The Nume articol cell sits at index 1 (Linia is 0); on this template
    # ``Tara provenienta`` (index 2) is usually empty.
    name_cell = cells[1]
    code, name = _split_code_and_name(name_cell)
    if not code and not name:
        return None

    return InvoiceLineItem(
        product_code=code,
        product_name=name or code,
        unit_price=unit_price,
        currency=currency.upper(),
        quantity=quantity,
    )


def parse_invoice_bytes(data: bytes) -> list[InvoiceLineItem]:
    """Extract every line item from a PDF given as raw bytes.

    :param data: Full PDF payload (as received from the upload endpoint).
    :returns: List of :class:`InvoiceLineItem` instances. Empty if no line is
        recognised — callers should treat that as a parse failure.
    """
    items: list[InvoiceLineItem] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                for row in table:
                    line = _line_item_from_row(row)
                    if line is not None:
                        items.append(line)
    if items:
        return items

    # Fallback: some scanners produce a single flowing text block instead of a
    # detected table. Try a regex over the raw text targeting the documented
    # layout: ``<linia> <code> <name...> <price> <currency> <qty> <qty> H<UM>``.
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    pattern = re.compile(
        r"^\s*(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(-?\d+[.,]\d+)\s+(RON|EUR|USD)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        try:
            items.append(
                InvoiceLineItem(
                    product_code=match.group(2),
                    product_name=re.sub(r"\s+", " ", match.group(3)).strip(),
                    unit_price=_parse_number(match.group(4)),
                    currency=match.group(5),
                    quantity=_parse_number(match.group(7)),
                )
            )
        except ValueError:
            continue
    return items


def items_to_csv(items: list[InvoiceLineItem]) -> str:
    """Serialise the extracted items as RFC 4180 CSV with a header row."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(
        ["product_code", "product_name", "unit_price", "currency", "quantity"]
    )
    for item in items:
        writer.writerow(
            [
                item.product_code,
                item.product_name,
                f"{item.unit_price:.2f}",
                item.currency,
                f"{item.quantity:g}",
            ]
        )
    return buffer.getvalue()


__all__ = ["parse_invoice_bytes", "items_to_csv"]
