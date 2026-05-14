# Trims near-white margins from splash PNG so native Android splash shows a larger logo.
# Run after replacing resources/android/android-splash.png:  powershell -File scripts/trim-splash-whitespace.ps1

$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\resources\android\android-splash.png'

if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "Missing source: $src"
}

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $src))
try {
    $w = $bmp.Width
    $h = $bmp.Height
    $threshold = 248 # treat very light greys as background
    $minX = $w
    $maxX = 0
    $minY = $h
    $maxY = 0

    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $bmp.GetPixel($x, $y)
            if ($c.R -lt $threshold -or $c.G -lt $threshold -or $c.B -lt $threshold) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }

    if ($minX -gt $maxX) {
        Write-Error 'No non-white content found; check image or threshold.'
    }

    $pad = [Math]::Max(8, [int]([Math]::Min($w, $h) * 0.02))
    $minX = [Math]::Max(0, $minX - $pad)
    $minY = [Math]::Max(0, $minY - $pad)
    $maxX = [Math]::Min($w - 1, $maxX + $pad)
    $maxY = [Math]::Min($h - 1, $maxY + $pad)
    $cw = $maxX - $minX + 1
    $ch = $maxY - $minY + 1

    $rect = New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    try {
        $out = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\resources\android\splash_robot_artwork.png'))
        $cropped.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Trimmed to ${cw}x${ch} (from ${w}x${h}). Wrote $out"
    } finally {
        $cropped.Dispose()
    }
} finally {
    $bmp.Dispose()
}
