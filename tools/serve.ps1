# Local static server for machines without Python (development only, 127.0.0.1 only).
#   powershell -ExecutionPolicy Bypass -File tools/serve.ps1 -Root . -Port 8091
# PUT /__save/data/levels.json writes the level file (tools/gen_levels.html) and
# PUT /__save/assets/Audio/pulse/pr_*.wav writes a sound (tools/gen_sounds.html). No other path.
param([string]$Root, [int]$Port = 8080)
$root = (Resolve-Path $Root).Path
$types = @{ '.html'='text/html'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.json'='application/json'; '.css'='text/css'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml'; '.wav'='audio/wav'; '.mp3'='audio/mpeg'; '.ogg'='audio/ogg'; '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf'; '.glb'='model/gltf-binary'; '.webp'='image/webp'; '.txt'='text/plain' }
$saveTarget = [IO.Path]::GetFullPath((Join-Path $root 'data\levels.json'))
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$Port/")
$l.Start()
Write-Output "Serving $root at http://127.0.0.1:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $req = $ctx.Request
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ($req.HttpMethod -eq 'PUT') {
      $origin = $req.Headers['Origin']
      $local = $req.IsLocal -and (-not $origin -or $origin -eq "http://127.0.0.1:$Port")
      if ($local -and $rel -eq '__save/data/levels.json') {
        $reader = New-Object IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd(); $reader.Close()
        $null = $body | ConvertFrom-Json  # refuse anything that is not JSON
        [IO.File]::WriteAllText($saveTarget, $body, (New-Object Text.UTF8Encoding($false)))
        $ctx.Response.StatusCode = 204
      } elseif ($local -and $rel -cmatch '^__save/assets/Audio/pulse/(pr_[a-z0-9_]{1,40}\.wav)$') {
        # Sound files from tools/gen_sounds.html: only pr_*.wav in assets/Audio/pulse, only real WAV data.
        $ms = New-Object IO.MemoryStream; $req.InputStream.CopyTo($ms); $bytes = $ms.ToArray()
        if ($bytes.Length -lt 44 -or $bytes.Length -gt 2MB -or [Text.Encoding]::ASCII.GetString($bytes, 0, 4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes, 8, 4) -ne 'WAVE') { $ctx.Response.StatusCode = 400 }
        else { [IO.File]::WriteAllBytes((Join-Path $root ('assets\Audio\pulse\' + $Matches[1])), $bytes); $ctx.Response.StatusCode = 204 }
      } else { $ctx.Response.StatusCode = 403 }
      continue
    }
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
    $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      if ($req.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else { $ctx.Response.StatusCode = 404 }
  } catch { $ctx.Response.StatusCode = 500 }
  finally { $ctx.Response.Close() }
}
