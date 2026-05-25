"""
Convert "Final report second draft v1.md" -> .docx -> .pdf

Endringer fra convert_to_word.py (v1):
- Dropper --number-sections fra pandoc, slik at de manuelle kapittelnumrene
  i markdown ("1. Innledning", "2. Litteratur", ...) ikke får et ekstra
  pandoc-generert prefiks ("2. 1. Innledning"). "Sammendrag" og "Takk til"
  forblir unummerert fordi md-en ikke har nummer på dem.
- Post-prosesserer docx-en: setter Normal-stilen og alle heading-styles
  til Times New Roman 12 pt med 1,5 linjeavstand.
- Forfatter-metadata: "Jørgen Rene" (uten aksent).

Run:  python convert_to_word_v2.py
"""

from pathlib import Path
import re
import pypandoc
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_LINE_SPACING

BASE = Path(__file__).parent
SRC = BASE / "Final report second draft v1.md"
DST_DOCX = BASE / "Final report second draft v1.docx"
DST_PDF = BASE / "Final report second draft v1.pdf"

raw = SRC.read_text(encoding="utf-8")

# Strip leading H1 + author/course lines (passes them as pandoc metadata).
pattern = re.compile(
    r"^# NautiCost:.*?\n+"
    r"(\*\*LOG650.*?\*\*\n+)"
    r"(\*\*Gruppe.*?\*\*\n+)",
    re.DOTALL | re.MULTILINE,
)
body = pattern.sub("", raw, count=1)

TMP = BASE / "_tmp_for_pandoc_v2.md"
TMP.write_text(body, encoding="utf-8")

try:
    pypandoc.convert_file(
        str(TMP),
        "docx",
        outputfile=str(DST_DOCX),
        extra_args=[
            "--standalone",
            "--toc",
            "--toc-depth=3",
            # NB: ingen --number-sections — markdown har egne numre.
            f"--resource-path={BASE}",
            "--metadata=title:NautiCost — Datadreven kostnadsestimering for yachthavneanløp i Skandinavia",
            "--metadata=subtitle:LOG650 Forskningsprosjekt, vår 2026 — Gruppe 11, Jørgen Rene (individuell)",
            "--metadata=author:Jørgen Rene",
            "--metadata=date:2026-05-25",
        ],
    )
finally:
    TMP.unlink(missing_ok=True)


# --- Post-prosessering: TNR 12 pt, 1,5 linjeavstand ----------------------
FONT_NAME = "Times New Roman"
BODY_SIZE = Pt(12)
LINE_SPACING = 1.5

doc = Document(DST_DOCX)


def _apply_run_font(run, size=BODY_SIZE):
    run.font.name = FONT_NAME
    run.font.size = size
    # Sett også east-asian font slik at Word ikke overstyrer
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rFonts"
    )
    if rfonts is None:
        from docx.oxml.ns import qn
        rfonts = rpr.makeelement(qn("w:rFonts"), {})
        rpr.insert(0, rfonts)
    from docx.oxml.ns import qn
    rfonts.set(qn("w:ascii"), FONT_NAME)
    rfonts.set(qn("w:hAnsi"), FONT_NAME)
    rfonts.set(qn("w:cs"), FONT_NAME)
    rfonts.set(qn("w:eastAsia"), FONT_NAME)


def _set_paragraph_spacing(paragraph, line_spacing=LINE_SPACING):
    pf = paragraph.paragraph_format
    pf.line_spacing = line_spacing
    pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE


# 1) Oppdater stiler (Normal + headings + sitater + figur/tabell-tekst)
HEADING_COLOR = RGBColor(0x1F, 0x1F, 0x1F)  # nesten-svart, mye sterkere enn pandocs blå
heading_specs = {
    # name -> (size_pt, bold)
    "Heading 1": (Pt(20), True),
    "Heading 2": (Pt(18), True),
    "Heading 3": (Pt(14), True),
    "Heading 4": (Pt(13), True),
    "Heading 5": (Pt(12), True),
    "Heading 6": (Pt(12), True),
    "Title": (Pt(24), True),
    "Subtitle": (Pt(14), False),
    "TOC Heading": (Pt(18), True),
}
body_specs = {
    "Caption": (Pt(11), False),
    "Quote": (BODY_SIZE, False),
    "Intense Quote": (BODY_SIZE, False),
    "List Paragraph": (BODY_SIZE, False),
    "Normal": (BODY_SIZE, False),
    "Body Text": (BODY_SIZE, False),
}

for style in doc.styles:
    name = style.name
    try:
        font = style.font
        font.name = FONT_NAME
        if name in heading_specs:
            size, bold = heading_specs[name]
            font.size = size
            font.bold = bold
            font.color.rgb = HEADING_COLOR
        elif name in body_specs:
            size, bold = body_specs[name]
            font.size = size
            font.bold = bold
        elif name.startswith("TOC"):
            font.size = BODY_SIZE
        else:
            font.size = BODY_SIZE
    except (AttributeError, NotImplementedError):
        pass

# 2) Oppdater hver paragraph (line spacing + run-fonter)
for paragraph in doc.paragraphs:
    _set_paragraph_spacing(paragraph)
    for run in paragraph.runs:
        _apply_run_font(run)

# 3) Også for tabellinnhold
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                _set_paragraph_spacing(paragraph)
                for run in paragraph.runs:
                    _apply_run_font(run)

doc.save(DST_DOCX)


# --- TOC + PDF via Word COM i én sesjon ---------------------------------
toc_pdf_done = False
try:
    import win32com.client
    import pythoncom
    print()
    print("Oppdaterer TOC og eksporterer PDF via Word COM …")
    # Word COM tåler dårlig OneDrive-stier med æøå — kopiér til ASCII-temp først
    import shutil, tempfile
    tmpdir = tempfile.mkdtemp(prefix="nauticost_")
    tmp_docx = Path(tmpdir) / "report.docx"
    tmp_pdf = Path(tmpdir) / "report.pdf"
    shutil.copy2(DST_DOCX, tmp_docx)
    pythoncom.CoInitialize()
    word_app = win32com.client.Dispatch("Word.Application")
    word_app.Visible = False
    word_app.DisplayAlerts = False
    wdoc = word_app.Documents.Open(str(tmp_docx))
    for toc in wdoc.TablesOfContents:
        toc.Update()
    wdoc.Fields.Update()
    wdoc.Save()
    wdFormatPDF = 17
    wdoc.SaveAs2(str(tmp_pdf), FileFormat=wdFormatPDF)
    wdoc.Close(False)
    word_app.Quit()
    pythoncom.CoUninitialize()
    # Kopier tilbake
    shutil.copy2(tmp_docx, DST_DOCX)
    shutil.copy2(tmp_pdf, DST_PDF)
    shutil.rmtree(tmpdir, ignore_errors=True)
    print(f"  TOC oppdatert. PDF: {DST_PDF.name} ({DST_PDF.stat().st_size // 1024} KB)")
    toc_pdf_done = True

    # Post-fix: rename "Table of Contents" → "Innholdsfortegnelse" direkte i docx-XML
    try:
        import zipfile, shutil, tempfile
        tmp_path = DST_DOCX.with_suffix(".docx.tmp")
        with zipfile.ZipFile(DST_DOCX, "r") as zin:
            with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    if item.filename == "word/document.xml":
                        data = data.replace(b"Table of Contents", b"Innholdsfortegnelse")
                    zout.writestr(item, data)
        shutil.move(str(tmp_path), str(DST_DOCX))
        print("  TOC-overskrift: 'Table of Contents' → 'Innholdsfortegnelse'.")
    except Exception as e:
        print(f"  Kunne ikke omdøpe TOC-overskrift i XML: {e}")
except Exception as e:
    print(f"  Kunne ikke oppdatere TOC/PDF via Word COM: {e}")
    print("  Åpne docx i Word og høyreklikk på innholdsfortegnelsen → 'Oppdater felt'.")

# Sanity check
doc = Document(DST_DOCX)
print(f"Skrev {DST_DOCX.name}")
print(f"  Avsnitt: {len(doc.paragraphs)}")
print(f"  Tabeller: {len(doc.tables)}")
print(f"  Bilder: {len(doc.inline_shapes)}")
print(f"  Størrelse: {DST_DOCX.stat().st_size // 1024} KB")
print()
print("Første 8 avsnitt (style + tekst):")
for p in doc.paragraphs[:10]:
    style = p.style.name
    text = p.text[:80]
    if text:
        print(f"  [{style}] {text}")


# --- Fallback: PDF-eksport via docx2pdf hvis COM-sti feilet -------------
if not toc_pdf_done:
    try:
        from docx2pdf import convert as docx_to_pdf
        print()
        print(f"Fallback PDF via docx2pdf: {DST_PDF.name} …")
        docx_to_pdf(str(DST_DOCX), str(DST_PDF))
        print(f"  Skrev {DST_PDF.name} ({DST_PDF.stat().st_size // 1024} KB)")
    except Exception as e:
        print(f"  Fallback feilet også: {e}")
        print("  Åpne docx-en i Word og lagre som PDF manuelt.")
