# /// script
# requires-python = ">=3.10"
# dependencies = ["markdown>=3.5", "weasyprint>=62"]
# ///
"""Gera os PDFs da documentação a partir de docs/.

- docs/pdf/zona-sul-urgente-manual.pdf: manual do sistema, para o cliente (docs/documentacao/usuario/).
- docs/pdf/zona-sul-urgente-documentacao-tecnica.pdf: para o desenvolvedor (usuário + técnico + backlog +
  changelog + commits).

Uso (na raiz do projeto): uv run scripts/gerar_pdf.py
"""

import html
import subprocess
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import markdown
from weasyprint import HTML

RAIZ = Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"
USUARIO = sorted((DOCS / "documentacao" / "usuario").glob("*.md"))
TECNICO = sorted((DOCS / "documentacao" / "tecnico").glob("*.md"))
# Mesma fonte do logotipo do site (Montserrat ExtraBold, OFL).
FONTE_LOGO = RAIZ / "System-Zona-Sul-Urgente-Web-Frontend" / "assets" / "fonts" / "montserrat-latin-800-normal.woff"

PDFS = [
    {
        "arquivo": DOCS / "pdf" / "zona-sul-urgente-manual.pdf",
        "titulo": "Manual do sistema",
        "capitulos": USUARIO,
        "commits": False,
        "publico": "Para a redação: o que é o portal, o site, o painel, notícias, Instagram e IA, equipe e dúvidas comuns.",
    },
    {
        "arquivo": DOCS / "pdf" / "zona-sul-urgente-documentacao-tecnica.pdf",
        "titulo": "Documentação técnica",
        "capitulos": USUARIO + TECNICO + [DOCS / "backlog.md", DOCS / "changelog.md"],
        "commits": True,
        "publico": "Para quem mantém o sistema: manual, arquitetura, desenvolvimento, variáveis, backlog e histórico.",
    },
]

AZUL = "#024baa"
AZUL_ESCURO = "#013a85"
VERMELHO = "#fd3132"
CINZA = "#64748b"


def css(titulo: str) -> str:
    fonte_logo = (
        f'@font-face {{ font-family: "Montserrat"; font-weight: 800; src: url("{FONTE_LOGO.as_uri()}"); }}'
        if FONTE_LOGO.exists()
        else ""
    )
    corpo = '"Ubuntu Sans", "Inter", "DejaVu Sans", sans-serif'
    return fonte_logo + f"""
@page {{
  size: A4;
  margin: 2cm 1.8cm;
  @bottom-left {{ content: "Zona Sul Urgente · {titulo}"; font-family: {corpo}; font-size: 8.5pt; color: {CINZA}; }}
  @bottom-right {{ content: counter(page); font-family: {corpo}; font-size: 8.5pt; color: {CINZA}; }}
}}
@page capa {{ margin: 0; background: {AZUL}; @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}
body {{ font-family: {corpo}; font-size: 10pt; line-height: 1.55; color: #0f172a; }}
.capa {{ page: capa; page-break-after: always; height: 29.7cm; padding: 0 2.2cm; color: #fff;
  display: flex; flex-direction: column; justify-content: center; }}
.logo {{ font-family: "Montserrat", {corpo}; font-weight: 800; text-transform: uppercase; line-height: 1; }}
.logo span {{ display: table; }}
.logo .zs {{ background: {AZUL_ESCURO}; font-size: 30pt; padding: 8pt 12pt 6pt; }}
.logo .ur {{ background: {VERMELHO}; font-size: 40pt; padding: 8pt 12pt 6pt; }}
.capa .faixa {{ width: 2cm; height: 4pt; background: {VERMELHO}; border-radius: 2pt; margin: 1.2cm 0 0.6cm; }}
.capa .subtitulo {{ font-size: 20pt; font-weight: 500; }}
.capa .descricao {{ color: #dbeafe; margin-top: 0.8cm; max-width: 13cm; }}
.capa .data {{ color: #bfdbfe; margin-top: 1.5cm; font-size: 9pt; }}
.sumario {{ page-break-after: always; }}
.sumario ol {{ padding-left: 14pt; }}
.sumario li {{ margin: 5pt 0; font-size: 11pt; }}
.capitulo {{ page-break-before: always; }}
h1 {{ font-weight: 700; font-size: 20pt; color: {AZUL}; margin: 0 0 12pt; padding-bottom: 6pt;
  border-bottom: 3px solid {VERMELHO}; }}
h2 {{ font-weight: 700; font-size: 13.5pt; margin-top: 18pt; }}
h2::before {{ content: ""; display: inline-block; width: 6pt; height: 6pt; border-radius: 1pt; background: {VERMELHO};
  margin-right: 6pt; vertical-align: middle; }}
h3 {{ font-weight: 700; font-size: 11pt; }}
table {{ border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 8.8pt; page-break-inside: auto; }}
tr {{ page-break-inside: avoid; }}
th {{ background: #eff6ff; font-weight: 700; text-align: left; border-bottom: 2px solid {AZUL}; }}
th, td {{ border: 1px solid #e2e8f0; padding: 4pt 6pt; vertical-align: top; }}
code {{ font-family: "DejaVu Sans Mono", monospace; font-size: 8.3pt; background: #f1f5f9; padding: 0 2pt; border-radius: 2pt; }}
pre {{ background: #f1f5f9; padding: 8pt; border-radius: 6pt; border-left: 3px solid {AZUL}; white-space: pre-wrap; }}
pre code {{ background: none; padding: 0; }}
blockquote {{ margin: 8pt 0; padding: 6pt 10pt; background: #fff7ed; border-left: 3px solid {VERMELHO}; }}
blockquote p {{ margin: 0; }}
a {{ color: {AZUL}; text-decoration: none; }}
ul li::marker {{ color: {VERMELHO}; }}
.commits td:first-child, .commits td:nth-child(2) {{ font-family: "DejaVu Sans Mono", monospace; white-space: nowrap; }}
"""


def commits_recentes(limite: int = 40) -> str:
    try:
        saida = subprocess.run(
            ["git", "log", f"-{limite}", "--date=short", "--format=%h%x1f%ad%x1f%an%x1f%s"],
            cwd=RAIZ, capture_output=True, text=True, check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""
    linhas = [linha.split("\x1f") for linha in saida.strip().splitlines() if linha]
    if not linhas:
        return ""
    corpo = "".join(
        "<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in campos) + "</tr>" for campos in linhas
    )
    return (
        '<section class="capitulo"><h1>Commits recentes</h1>'
        f"<p>Últimos {len(linhas)} commits do repositório.</p>"
        '<table class="commits"><tr><th>Commit</th><th>Data</th><th>Autor</th><th>Mensagem</th></tr>'
        f"{corpo}</table></section>"
    )


def gerar(pdf: dict, agora: str) -> None:
    secoes, titulos = [], []
    for arquivo in pdf["capitulos"]:
        texto = arquivo.read_text(encoding="utf-8")
        primeira = next((linha for linha in texto.splitlines() if linha.startswith("# ")), arquivo.stem)
        titulos.append(primeira.lstrip("# ").strip())
        corpo = markdown.markdown(texto, extensions=["tables", "fenced_code", "sane_lists"])
        secoes.append(f'<section class="capitulo">{corpo}</section>')

    commits = commits_recentes() if pdf["commits"] else ""
    if commits:
        titulos.append("Commits recentes")

    sumario = "".join(f"<li>{html.escape(t)}</li>" for t in titulos)
    documento = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Zona Sul Urgente · {pdf['titulo']}</title><style>{css(pdf['titulo'])}</style></head><body>
<div class="capa"><div class="logo"><span class="zs">Zona Sul</span><span class="ur">Urgente</span></div>
<div class="faixa"></div><div class="subtitulo">{pdf['titulo']}</div>
<div class="descricao">Portal de notícias da Zona Sul do Rio de Janeiro: site para o leitor e painel da redação.
{pdf['publico']}</div>
<div class="data">Atualizada em {agora}</div></div>
<div class="sumario"><h1>Sumário</h1><ol>{sumario}</ol></div>
{''.join(secoes)}{commits}</body></html>"""

    pdf["arquivo"].parent.mkdir(parents=True, exist_ok=True)
    HTML(string=documento, base_url=str(RAIZ)).write_pdf(pdf["arquivo"])
    print(f"PDF gerado: {pdf['arquivo'].relative_to(RAIZ)}")


def main() -> None:
    agora = datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y %H:%M")
    for pdf in PDFS:
        gerar(pdf, agora)


if __name__ == "__main__":
    main()
