# Word finishing pass: remap default fonts to Inter, update TOC, embed brand fonts, save.
# Usage: powershell -File word-pass.ps1 <in: out\book-raw.docx> <out: out\book-word.docx>
param([string]$In, [string]$Out)
$In = (Resolve-Path $In).Path; $Out = [IO.Path]::GetFullPath($Out)
$w = New-Object -ComObject Word.Application; $w.Visible = $false
try {
  $d = $w.Documents.Open($In, $false, $false)
  $bad = 'Calibri','Calibri Light','Times New Roman','Aptos'
  foreach ($s in $d.Styles) { try { if (($s.Type -eq 1 -or $s.Type -eq 2) -and $s.InUse -and ($bad -contains $s.Font.Name)) { $s.Font.Name = 'Inter' } } catch {} }
  foreach ($f in 'Calibri','Calibri Light','Times New Roman','Segoe UI Symbol') {
    foreach ($r in $d.StoryRanges) { $fd = $r.Find; $fd.ClearFormatting(); $fd.Font.Name = $f; $fd.Replacement.ClearFormatting(); $fd.Replacement.Font.Name = 'Inter'; $fd.Execute('', $false, $false, $false, $false, $false, $true, 1, $true, '', 2) | Out-Null }
  }
  foreach ($t in $d.TablesOfContents) { $t.Update() }
  $d.EmbedTrueTypeFonts = $true; $d.DoNotEmbedSystemFonts = $true; $d.SaveSubsetFonts = $false
  $d.SaveAs2($Out, 16); "pages: " + $d.ComputeStatistics(2); $d.Close()
} finally { $w.Quit() }
