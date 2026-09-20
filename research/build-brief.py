#!/usr/bin/env python3
"""Render the compliance brief + pitch to white-background HTML (and PDF via headless Chrome).
Usage: ~/.venvs/md/bin/python build-brief.py   (needs `pip install markdown` in that venv)
Outputs research/dist/<name>.html and, if Chrome is present, <name>.pdf. No network access."""
import html, pathlib, re, shutil, subprocess, sys, time
import markdown
HERE = pathlib.Path(__file__).resolve().parent
DIST = HERE / "dist"; DIST.mkdir(exist_ok=True)
CSS = """
@page { size: Letter; margin: 0.9in 0.85in; }
html, body { background: #ffffff; color: #1a1a1a; }
body { font: 11pt/1.5 Georgia, "Times New Roman", serif; max-width: 7.2in; margin: 0 auto; padding: 0.4in 0; }
h1 { font: 700 20pt/1.2 Georgia, serif; margin: 0 0 0.3em; letter-spacing: -0.01em; }
h2 { font: 700 14.5pt/1.25 Georgia, serif; margin: 1.6em 0 0.5em; padding-top: 0.4em; border-top: 1px solid #d8d8d8; page-break-before: auto; }
h3 { font: 700 12pt/1.3 Georgia, serif; margin: 1.3em 0 0.4em; }
h4 { font: 700 11pt/1.3 Georgia, serif; margin: 1.1em 0 0.3em; }
p { margin: 0 0 0.75em; orphans: 3; widows: 3; }
a { color: #0b3d91; text-decoration: none; word-break: break-word; }
blockquote { margin: 0.8em 0; padding: 0.5em 0.9em; border-left: 3px solid #b9b9b9; background: #f6f6f4; color: #222; }
blockquote p:last-child { margin-bottom: 0; }
code { font: 9.5pt/1.4 Menlo, Consolas, monospace; background: #f2f2ef; padding: 0 0.25em; border-radius: 2px; }
pre { font: 9pt/1.4 Menlo, Consolas, monospace; background: #f2f2ef; padding: 0.6em 0.8em; overflow-x: auto; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 0.8em 0 1em; font-size: 9.5pt; page-break-inside: auto; }
th, td { border: 1px solid #c9c9c9; padding: 0.35em 0.5em; vertical-align: top; text-align: left; }
th { background: #ececea; font-weight: 700; }
tr { page-break-inside: avoid; }
hr { border: 0; border-top: 1px solid #d8d8d8; margin: 1.5em 0; }
ul, ol { margin: 0 0 0.8em 1.4em; padding: 0; }
li { margin: 0.15em 0; }
strong { font-weight: 700; }\ndel { text-decoration: line-through; color: #8a1c1c; }
.doc-note { font: 9pt/1.4 Helvetica, Arial, sans-serif; color: #555; border-bottom: 1px solid #d8d8d8; padding-bottom: 0.5em; margin-bottom: 1.2em; }
@media print { a { color: #0b3d91; } body { padding: 0; max-width: none; } }
"""
def render(src: pathlib.Path, title_hint: str, note: "str|None" = None):
    text = src.read_text(encoding="utf-8")
    body = markdown.markdown(text, extensions=["tables", "fenced_code", "sane_lists", "toc"],
                             extension_configs={"toc": {"toc_depth": "2-3"}}, output_format="html5")
    # python-markdown has no ~~strikethrough~~; the brief uses it to SHOW struck statutory text
    body = re.sub(r"~~(.+?)~~", r"<del>\1</del>", body, flags=re.S)  # source wraps mid-strike
    # title = first H1 in the source, else the hint
    title = next((l.lstrip("# ").strip() for l in text.splitlines() if l.startswith("# ")), title_hint)
    if note is None:
        note = ("Rendered from the Markdown source in the public repository "
                "github.com/ZJHeepfixer/nullecho (research/). Not legal advice; see the notice in the text.")
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title>
<style>{CSS}</style></head><body>{("<div class=\"doc-note\">" + html.escape(note) + "</div>") if note else ""}{body}</body></html>"""
    out = DIST / (src.stem + ".html"); out.write_text(doc, encoding="utf-8"); return out
def to_pdf(html_path: pathlib.Path):
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if not pathlib.Path(chrome).exists(): print("no Chrome; HTML only:", html_path); return None
    pdf = html_path.with_suffix(".pdf"); pdf.unlink(missing_ok=True)
    prof = DIST / ".chrome-profile"
    p = subprocess.Popen([chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                          f"--user-data-dir={prof}", f"--print-to-pdf={pdf}", "--no-pdf-header-footer",
                          "--virtual-time-budget=8000", html_path.as_uri()], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):  # Chrome may not exit on its own; wait for the file, then stop it
        if pdf.exists() and pdf.stat().st_size > 0 and p.poll() is not None: break
        if pdf.exists() and pdf.stat().st_size > 0: time.sleep(1.5); p.kill(); break
        time.sleep(0.5)
    else: p.kill()
    shutil.rmtree(prof, ignore_errors=True)
    return pdf if pdf.exists() else None
if __name__ == "__main__":
    for name, hint in [("ALGORITHMIC-PRICING-COMPLIANCE-BRIEF.md", "Compliance Brief"), ("BRIEF-PITCH.md", "Brief Pitch")]:
        h = render(HERE / name, hint); pdf = to_pdf(h)
        print(h.name, h.stat().st_size, "bytes;", (pdf.name + " " + str(pdf.stat().st_size) + " bytes") if pdf else "no pdf")
