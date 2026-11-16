"""Utilidades para generar el reporte técnico en Word con python-docx.
Tipografía Century Gothic, texto negro, títulos en negritas, figuras numeradas."""
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FUENTE = "Century Gothic"
NEGRO = RGBColor(0, 0, 0)


def _fuente(run_or_style, tam=None, negrita=None):
    f = run_or_style.font
    f.name = FUENTE
    f.color.rgb = NEGRO
    if tam:
        f.size = Pt(tam)
    if negrita is not None:
        f.bold = negrita
    el = run_or_style.element if hasattr(run_or_style, "element") else run_or_style._element
    rpr = el.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(a), FUENTE)


class Reporte:
    def __init__(self, tam_texto=9.5):
        self.doc = Document()
        self.fig = 0
        self.tab = 0
        s = self.doc.sections[0]
        s.page_width, s.page_height = Cm(21.59), Cm(27.94)  # carta
        s.left_margin = s.right_margin = Cm(1.9)
        s.top_margin = s.bottom_margin = Cm(1.7)
        st = self.doc.styles
        _fuente(st["Normal"], tam_texto)
        st["Normal"].paragraph_format.space_after = Pt(3)
        st["Normal"].paragraph_format.line_spacing = 1.08
        for nombre, tam, antes, despues in (("Title", 20, 0, 4), ("Heading 1", 12.5, 8, 3), ("Heading 2", 10.5, 5, 2)):
            _fuente(st[nombre], tam, True)
            pf = st[nombre].paragraph_format
            pf.space_before, pf.space_after, pf.keep_with_next = Pt(antes), Pt(despues), True
        self.ancho = s.page_width - s.left_margin - s.right_margin

    # ---------------------------------------------------------------- texto
    def titulo(self, texto, nivel=1):
        h = self.doc.add_heading(texto, level=nivel)
        for r in h.runs:
            _fuente(r, None, True)
        return h

    def p(self, texto="", negrita_inicial=None, alin=WD_ALIGN_PARAGRAPH.JUSTIFY, tam=None):
        par = self.doc.add_paragraph()
        par.alignment = alin
        if negrita_inicial:
            r = par.add_run(negrita_inicial)
            _fuente(r, tam, True)
        r = par.add_run(texto)
        _fuente(r, tam, False)
        return par

    def vinetas(self, items, tam=None):
        for it in items:
            par = self.doc.add_paragraph(style="List Bullet")
            par.paragraph_format.space_after = Pt(1)
            if isinstance(it, tuple):
                r = par.add_run(it[0]); _fuente(r, tam, True)
                r = par.add_run(it[1]); _fuente(r, tam, False)
            else:
                r = par.add_run(it); _fuente(r, tam, False)

    # ---------------------------------------------------------------- figuras
    def _pie(self, texto, prefijo):
        par = self.doc.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
        par.paragraph_format.space_after = Pt(6)
        r = par.add_run(prefijo); _fuente(r, 8, True)
        r = par.add_run(texto); _fuente(r, 8, False)

    def figura(self, ruta, pie, ancho_cm=None):
        self.fig += 1
        par = self.doc.add_paragraph()
        par.alignment = WD_ALIGN_PARAGRAPH.CENTER
        par.paragraph_format.space_after = Pt(1)
        par.paragraph_format.keep_with_next = True
        par.add_run().add_picture(str(ruta), width=Cm(ancho_cm) if ancho_cm else self.ancho)
        self._pie(pie, f"Figura {self.fig}. ")
        return self.fig

    def figuras_lado(self, rutas_pies, ancho_total_cm=17.6):
        """Varias imágenes en una fila (tabla sin bordes), cada una con su pie numerado."""
        n = len(rutas_pies)
        t = self.doc.add_table(rows=2, cols=n)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        w = ancho_total_cm / n
        nums = []
        for i, (ruta, pie) in enumerate(rutas_pies):
            self.fig += 1
            nums.append(self.fig)
            c = t.cell(0, i)
            c.width = Cm(w)
            par = c.paragraphs[0]
            par.alignment = WD_ALIGN_PARAGRAPH.CENTER
            par.add_run().add_picture(str(ruta), width=Cm(w - 0.3))
            c2 = t.cell(1, i)
            c2.width = Cm(w)
            pp = c2.paragraphs[0]
            pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = pp.add_run(f"Figura {self.fig}. "); _fuente(r, 7.5, True)
            r = pp.add_run(pie); _fuente(r, 7.5, False)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(2)
        return nums

    # ---------------------------------------------------------------- tablas
    def tabla(self, encabezado, filas, pie=None, anchos_cm=None, tam=8):
        if pie:
            self.tab += 1
            par = self.doc.add_paragraph()
            par.paragraph_format.keep_with_next = True
            par.paragraph_format.space_after = Pt(2)
            r = par.add_run(f"Tabla {self.tab}. "); _fuente(r, 8, True)
            r = par.add_run(pie); _fuente(r, 8, False)
        t = self.doc.add_table(rows=1, cols=len(encabezado))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, h in enumerate(encabezado):
            c = t.rows[0].cells[i]
            c.text = ""
            r = c.paragraphs[0].add_run(h); _fuente(r, tam, True)
            sombra = OxmlElement("w:shd")
            sombra.set(qn("w:val"), "clear"); sombra.set(qn("w:color"), "auto"); sombra.set(qn("w:fill"), "E8EEF6")
            c._tc.get_or_add_tcPr().append(sombra)
        for fila in filas:
            cells = t.add_row().cells
            for i, v in enumerate(fila):
                cells[i].text = ""
                negrita = isinstance(v, tuple)
                r = cells[i].paragraphs[0].add_run(v[0] if negrita else str(v)); _fuente(r, tam, negrita)
        for fila in t.rows:
            for i, c in enumerate(fila.cells):
                for par in c.paragraphs:
                    par.paragraph_format.space_after = Pt(0)
                if anchos_cm:
                    c.width = Cm(anchos_cm[i])
        self.doc.add_paragraph().paragraph_format.space_after = Pt(1)
        return t

    def salto(self):
        self.doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def guardar(self, ruta):
        self.doc.save(str(ruta))
