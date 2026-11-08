# Generate display copies; preserve originals for downloads and lightboxes.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path $PSScriptRoot -Parent
$outputRoot = Join-Path $projectRoot 'images/optimized'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$sources = @('images/G2.jpg', 'images/G3.jpg', 'images/G4.jpg', 'upload/1.jpg', 'upload/2.jpg', 'upload/3.jpg', 'upload/4.jpg', 'upload/slider-new-1-1.jpg')
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
foreach ($source in $sources) {
    $original = [System.Drawing.Image]::FromFile((Join-Path $projectRoot $source))
    try {
        # Do not silently rotate camera images that require EXIF orientation.
        if ($original.PropertyIdList -contains 274) {
            $orientation = [BitConverter]::ToUInt16($original.GetPropertyItem(274).Value, 0)
            switch ($orientation) {
                2 { $original.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
                3 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
                4 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipX) }
                5 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
                6 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
                7 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
                8 { $original.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
            }
        }
        foreach ($width in @(550, 1100)) {
            if ($original.Width -lt $width) { continue }
            $height = [int][Math]::Round($original.Height * $width / $original.Width)
            $bitmap = New-Object System.Drawing.Bitmap($width, $height)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $parameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
            try {
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.DrawImage($original, 0, 0, $width, $height)
                $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)
                $name = [System.IO.Path]::GetFileNameWithoutExtension($source)
                $bitmap.Save((Join-Path $outputRoot "$name-$width.jpg"), $codec, $parameters)
            } finally {
                $parameters.Dispose()
                $graphics.Dispose()
                $bitmap.Dispose()
            }
        }
    } finally { $original.Dispose() }
}
