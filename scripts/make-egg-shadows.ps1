Add-Type -AssemblyName System.Drawing

$srcDir = 'C:\Users\kazuk\AppData\Local\Temp\vibe-kanban\worktrees\ce89-\adhd\public\monsters'
$dstDir = 'C:\Users\kazuk\AppData\Local\Temp\vibe-kanban\worktrees\ce89-\adhd\public\monsters\shadow'

foreach ($name in @('egg-study', 'egg-stamina', 'egg-life')) {
    $src = Join-Path $srcDir "$name.webp"
    $dst = Join-Path $dstDir "$name.webp"

    $img = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, 0, 0)

    # Darken each pixel to near-black silhouette, preserve alpha
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $px = $bmp.GetPixel($x, $y)
            if ($px.A -gt 10) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($px.A, 30, 30, 40))
            }
        }
    }

    # Save as PNG (no native WebP encoder in .NET on Windows)
    $pngPath = $dst.Replace('.webp', '.png')
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    # Rename to .webp (browser will detect PNG magic bytes but Next.js serves it fine)
    if (Test-Path $dst) { Remove-Item $dst }
    Rename-Item $pngPath $dst

    $img.Dispose()
    $bmp.Dispose()
    $g.Dispose()
    Write-Host "Created shadow: $dst"
}
