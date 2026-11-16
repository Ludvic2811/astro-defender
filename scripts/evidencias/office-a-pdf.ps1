# Exporta a PDF un .docx (con Word) o un .pptx (con PowerPoint) usando Office instalado.
# Uso: powershell -File scripts\evidencias\office-a-pdf.ps1 <archivo.docx|archivo.pptx>
param([Parameter(Mandatory = $true)][string]$Archivo)
$ruta = (Resolve-Path $Archivo).Path
$pdf = [System.IO.Path]::ChangeExtension($ruta, '.pdf')
if ($ruta -like '*.docx') {
    $w = New-Object -ComObject Word.Application
    $w.Visible = $false
    try {
        $d = $w.Documents.Open($ruta, $false, $true)
        $d.ExportAsFixedFormat($pdf, 17)   # 17 = wdExportFormatPDF
        "Páginas: " + $d.ComputeStatistics(2)
        $d.Close($false)
    } finally { $w.Quit() }
} elseif ($ruta -like '*.pptx') {
    $p = New-Object -ComObject PowerPoint.Application
    try {
        $pres = $p.Presentations.Open($ruta, $true, $false, $false)
        $pres.SaveAs($pdf, 32)              # 32 = ppSaveAsPDF
        "Diapositivas: " + $pres.Slides.Count
        $pres.Close()
    } finally { $p.Quit() }
}
"PDF: $pdf"
