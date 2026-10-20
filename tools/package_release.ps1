# Pulse Router — release build for itch.io or any static web host.
# Copies only what the game loads (page, styles, code, levels, sounds, logo, Three.js), switches
# src/app/config.js to production (test switches off) and writes a ZIP with index.html at its root.
#
#   powershell -ExecutionPolicy Bypass -File tools/package_release.ps1 -Output ..\Pulse-Router-Releases\pulse-router-1.1.0
param([Parameter(Mandatory = $true)][string]$Output)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dest = [IO.Path]::GetFullPath($Output)
$zip = "$dest.zip"
if ((Test-Path $dest) -or (Test-Path $zip)) { throw "Output already exists: $dest" }
if ($dest.StartsWith($root + '\')) { throw 'Write releases outside the project folder.' }

$include = @('index.html', 'styles', 'src', 'data\levels.json', 'assets\Audio\pulse', 'assets\images', 'vendor')
$utf8 = New-Object Text.UTF8Encoding($false)
try {
  foreach ($item in $include) {
    $from = Join-Path $root $item; $to = Join-Path $dest $item
    if (-not (Test-Path $from)) { throw "Missing: $item" }
    New-Item -ItemType Directory -Force (Split-Path $to) | Out-Null
    Copy-Item $from $to -Recurse
  }
  # Production config: no test switches.
  $cfgPath = Join-Path $dest 'src\app\config.js'
  $cfg = [IO.File]::ReadAllText($cfgPath)
  $cfg = $cfg.Replace("environment: 'development'", "environment: 'production'").Replace('unlockAllCircuits: true', 'unlockAllCircuits: false')
  if (-not $cfg.Contains("environment: 'production'")) { throw 'Could not switch config to production' }
  [IO.File]::WriteAllText($cfgPath, $cfg, $utf8)

  # ZIP with forward-slash entry names (itch.io rejects backslash paths).
  Add-Type -AssemblyName System.IO.Compression
  $files = Get-ChildItem $dest -Recurse -File | Sort-Object FullName
  $stream = [IO.File]::Open($zip, 'CreateNew')
  $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($f in $files) {
      $name = $f.FullName.Substring($dest.Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
      $out = $entry.Open(); $in = [IO.File]::OpenRead($f.FullName)
      try { $in.CopyTo($out) } finally { $in.Dispose(); $out.Dispose() }
    }
  } finally { $archive.Dispose(); $stream.Dispose() }
  "Release: $dest ($($files.Count) files)`nZIP: $zip ($([math]::Round((Get-Item $zip).Length / 1MB, 2)) MB)"
} catch {
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  if (Test-Path $zip) { Remove-Item $zip -Force }
  throw
}
