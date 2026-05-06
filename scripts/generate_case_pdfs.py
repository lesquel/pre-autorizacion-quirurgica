from __future__ import annotations

from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, ListFlowable, ListItem


ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = ROOT / "docs" / "casos-prueba"
OUTPUT_DIR = ROOT / "docs" / "casos-prueba-pdf"


def split_sections(content: str) -> tuple[str, str, str]:
    match = re.search(
        r"## Informe medico\s*(.*?)\s*## Poliza del paciente\s*(.*?)\s*## Decision esperada\s*(.*)",
        content,
        flags=re.DOTALL,
    )
    if not match:
        raise ValueError("No se pudo separar informe, poliza y decision.")
    return match.group(1).strip(), match.group(2).strip(), match.group(3).strip()


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "CustomTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#1F3C88"),
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "CustomH2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1F3C88"),
            spaceBefore=8,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "CustomH3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#333333"),
            spaceBefore=6,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "CustomBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            spaceAfter=4,
        ),
    }


def parse_lines_to_story(title: str, body: str):
    styles = build_styles()
    story = [Paragraph(title, styles["title"]), Spacer(1, 0.2 * cm)]
    bullet_buffer: list[ListItem] = []

    def flush_bullets():
        nonlocal bullet_buffer
        if bullet_buffer:
            story.append(
                ListFlowable(
                    bullet_buffer,
                    bulletType="bullet",
                    start="circle",
                    leftIndent=16,
                )
            )
            story.append(Spacer(1, 0.15 * cm))
            bullet_buffer = []

    for raw_line in body.splitlines():
        line = raw_line.strip()
        if not line:
            flush_bullets()
            continue

        if line.startswith("### "):
            flush_bullets()
            story.append(Paragraph(line[4:], styles["h3"]))
            continue

        if line.startswith("## "):
            flush_bullets()
            story.append(Paragraph(line[3:], styles["h2"]))
            continue

        if line.startswith("- "):
            bullet_text = line[2:].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            bullet_buffer.append(ListItem(Paragraph(bullet_text, styles["body"])))
            continue

        flush_bullets()
        safe_line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(safe_line, styles["body"]))

    flush_bullets()
    return story


def create_pdf(output_path: Path, title: str, body: str):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=title,
    )
    story = parse_lines_to_story(title, body)
    doc.build(story)


def main():
    case_files = sorted(CASES_DIR.glob("caso-*.md"))
    if not case_files:
        raise SystemExit("No se encontraron casos para procesar.")

    for case_file in case_files:
        content = case_file.read_text(encoding="utf-8")
        informe, poliza, _decision = split_sections(content)
        case_slug = case_file.stem
        case_output_dir = OUTPUT_DIR / case_slug

        create_pdf(case_output_dir / "informe-medico.pdf", "Informe medico", informe)
        create_pdf(case_output_dir / "poliza-paciente.pdf", "Poliza del paciente", poliza)

    print(f"PDFs generados en: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
