"""WeasyPrint-based PDF rendering for reports.

HTML + print CSS templates live in ``backend/app/templates``. Charts render
server-side via matplotlib and are inlined as base64 PNG ``<img>`` tags.
"""
from __future__ import annotations

import base64
import io
from datetime import date
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)


def _bar_chart_png(categories: dict[str, float], title: str) -> str:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 3.2), dpi=150)
    if categories:
        keys = list(categories.keys())
        vals = [categories[k] for k in keys]
        ax.bar(keys, vals, color="#6366f1")
        ax.tick_params(axis="x", labelrotation=30, labelsize=8)
        ax.set_ylabel("Amount", fontsize=9)
    ax.set_title(title, fontsize=11, loc="left")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def render_report_pdf(
    *,
    username: str,
    start: date,
    end: date,
    total_income: float,
    total_expenses: float,
    by_category: dict[str, float],
    summary_prose: str | None = None,
) -> bytes:
    """Render a report to a PDF byte string."""
    chart_png = _bar_chart_png(by_category, "Spending by category")
    template = _env.get_template("report.html")
    html = template.render(
        username=username,
        start=start.isoformat(),
        end=end.isoformat(),
        total_income=total_income,
        total_expenses=total_expenses,
        net=total_income - total_expenses,
        by_category=by_category,
        chart_png=chart_png,
        summary_prose=summary_prose,
    )

    # Import lazily: WeasyPrint pulls in cairo/pango on import.
    from weasyprint import HTML

    return HTML(string=html).write_pdf()
