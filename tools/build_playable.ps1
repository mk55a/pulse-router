# Pulse Router — playable ad build. Produces one self-contained HTML file per variant and ad network:
# the game code (bundled from src/playable/main.js), Three.js and the logo are all inlined, sounds
# are synthesised in the page, and nothing is loaded from the network except what the network
# itself requires (mraid.js injected by MRAID SDKs; Google's ExitApi script).
#
#   powershell -ExecutionPolicy Bypass -File tools/build_playable.ps1 -Output ..\Pulse-Router-Releases\playable-1.0
#   optional: -StoreUrl https://play.google.com/store/apps/details?id=...   -Networks applovin,meta
#             -Variants fixit,chain   (variants are defined in src/playable/variants.js)
# Output: one folder per variant, holding pulse-router-<variant>-<network>.html (+ .zip where needed).
#
# Bundling: every module becomes a function whose exports go into a table, in dependency order.
# Supported syntax (all this codebase uses): `import { a, b } from './x.js';` and
# `export function|async function|const|let|class name`. Anything else stops the build.
param(
  [Parameter(Mandatory = $true)][string]$Output,
  [string]$StoreUrl = 'https://mk55a.itch.io/pulse-router',
  [string[]]$Networks = @('applovin', 'unity', 'ironsource', 'vungle', 'mintegral', 'tiktok', 'google', 'meta', 'preview'),
  [string[]]$Variants = @('tutorial', 'fixit', 'chain')
)
$known = @('applovin', 'unity', 'ironsource', 'vungle', 'mintegral', 'tiktok', 'google', 'meta', 'preview')
foreach ($n in $Networks) { if ($n -notin $known) { throw "Unknown network: $n (known: $($known -join ', '))" } }
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$variantSource = [IO.File]::ReadAllText((Join-Path $root 'src/playable/variants.js'))
foreach ($v in $Variants) { if ($variantSource -notmatch "(?m)^  $v`: Object\.freeze\(") { throw "Unknown variant: $v (see src/playable/variants.js)" } }
$out = [IO.Path]::GetFullPath($Output)
if (Test-Path $out) { throw "Output already exists: $out" }
if ($out.StartsWith($root + '\')) { throw 'Write builds outside the project folder.' }
$utf8 = New-Object Text.UTF8Encoding($false)
$read = { param($p) [IO.File]::ReadAllText($p, $utf8) }

# ---------- Bundle the ES modules ----------
$importRx = New-Object Text.RegularExpressions.Regex("^[ \t]*import[ \t]*\{([^}]*)\}[ \t]*from[ \t]*'([^']+)';?[ \t]*\r?$", 'Multiline')
$exportRx = New-Object Text.RegularExpressions.Regex('^([ \t]*)export[ \t]+(async[ \t]+function|function|const|let|class)[ \t]+([A-Za-z_$][\w$]*)', 'Multiline')
$strayRx = New-Object Text.RegularExpressions.Regex('^[ \t]*(import|export)[ \t({*]', 'Multiline')
$modules = [ordered]@{}   # path -> wrapped code, in dependency order
$visiting = @{}
function Resolve-Spec($fromFile, $spec) {
  if (-not $spec.StartsWith('.')) { throw "Only relative imports are supported: $spec (in $fromFile)" }
  $full = [IO.Path]::GetFullPath((Join-Path (Split-Path (Join-Path $root $fromFile)) $spec))
  $full.Substring($root.Length + 1).Replace('\', '/')
}
# Depth-first: a module is emitted after everything it imports.
function Walk($rel) {
  if ($modules.Contains($rel)) { return }
  if ($visiting[$rel]) { throw "Import cycle at $rel" }
  $visiting[$rel] = $true
  $code = & $read (Join-Path $root $rel)
  $deps = New-Object System.Collections.Generic.List[string]
  $names = New-Object System.Collections.Generic.List[string]
  $code = $importRx.Replace($code, [Text.RegularExpressions.MatchEvaluator] { param($m)
    $dep = Resolve-Spec $rel $m.Groups[2].Value
    $deps.Add($dep)
    "const {$($m.Groups[1].Value)} = __pr['$dep'];"
  })
  $code = $exportRx.Replace($code, [Text.RegularExpressions.MatchEvaluator] { param($m)
    $names.Add($m.Groups[3].Value)
    $m.Groups[1].Value + $m.Groups[2].Value + ' ' + $m.Groups[3].Value
  })
  if ($strayRx.IsMatch($code)) { throw "Unsupported import/export form in ${rel}: " + $strayRx.Match($code).Value }
  if ($code -match 'import\.meta|import\(') { throw "Dynamic import or import.meta in $rel" }
  # Whole-line comments and blank lines go; code is otherwise untouched.
  $code = [regex]::Replace($code, '^[ \t]*//.*\r?\n', '', 'Multiline')
  $code = [regex]::Replace($code, '^[ \t]*\r?\n', '', 'Multiline')
  foreach ($d in $deps) { Walk $d }
  $visiting.Remove($rel)
  $modules[$rel] = "__pr['$rel'] = (function () {`n$code`nreturn { $($names -join ', ') };`n})();"
}
Walk 'src/playable/main.js'
$bundle = "(function () {`n'use strict';`nconst __pr = {};`n" + (($modules.Values) -join "`n") + "`n})();"
if ($bundle -match '</script') { throw 'Bundle contains </script' }

# ---------- Inline Three.js and the logo ----------
$threeNames = @('three.min.js', 'CopyShader.js', 'LuminosityHighPassShader.js', 'EffectComposer.js', 'RenderPass.js', 'ShaderPass.js', 'MaskPass.js', 'UnrealBloomPass.js')
$three = ($threeNames | ForEach-Object { $t = & $read (Join-Path $root "vendor/three/$_"); if ($t -match '</script') { throw "$_ contains </script" }; "<script>$t</script>" }) -join "`n"
$logo = 'data:image/svg+xml;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root 'assets/images/pulse-router-logo.svg')))
$page = & $read (Join-Path $root 'playable/index.html')
$page = [regex]::Replace($page, '[ \t]*<script type="module" src="[^"]+"></script>\r?\n', '')

New-Item -ItemType Directory -Force $out | Out-Null
$report = @()
foreach ($variant in $Variants) {
$dir = Join-Path $out $variant
New-Item -ItemType Directory -Force $dir | Out-Null
foreach ($net in $Networks) {
  # Unity Ads injects MRAID itself and asks for no mraid.js tag; the other MRAID networks expect one.
  $head = switch ($net) {
    { $_ -in 'applovin', 'ironsource', 'vungle' } { '<script src="mraid.js"></script>' }
    'google' { '<meta name="ad.orientation" content="portrait,landscape"><meta name="ad.size" content="width=320,height=480"><script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>' }
    default { '' }
  }
  $globals = "<script>globalThis.PR_NETWORK=$(ConvertTo-Json $net);globalThis.PR_VARIANT=$(ConvertTo-Json $variant);globalThis.PR_STORE_URL=$(ConvertTo-Json $StoreUrl);globalThis.PR_LOGO=$(ConvertTo-Json $logo);</script>"
  $html = $page.Replace('<!--PR_HEAD-->', $head).Replace('<!--PR_SCRIPTS-->', "$globals`n$three`n<script>$bundle</script>")
  $name = "pulse-router-$variant-$net.html"
  [IO.File]::WriteAllText((Join-Path $dir $name), $html, $utf8)
  $bytes = (Get-Item (Join-Path $dir $name)).Length
  # Google and TikTok expect a ZIP with index.html at the top; TikTok also wants config.json
  # (playable_orientation 0 = both orientations).
  $entries = switch ($net) {
    'google' { [ordered]@{ 'index.html' = $html } }
    'tiktok' { [ordered]@{ 'index.html' = $html; 'config.json' = '{"playable_orientation":0}' } }
    default { $null }
  }
  if ($entries) {
    Add-Type -AssemblyName System.IO.Compression
    $zipPath = Join-Path $dir "pulse-router-$variant-$net.zip"
    $zs = [IO.File]::Open($zipPath, 'CreateNew'); $za = New-Object IO.Compression.ZipArchive($zs, [IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($k in $entries.Keys) { $e = $za.CreateEntry($k, [IO.Compression.CompressionLevel]::Optimal); $w = New-Object IO.StreamWriter($e.Open(), $utf8); $w.Write($entries[$k]); $w.Dispose() }
    } finally { $za.Dispose(); $zs.Dispose() }
    $report += '{0,-12} {1,8:N0} KB  {2}  (+ ZIP {3:N0} KB)' -f $net, ($bytes / 1KB), "$variant/$name", ((Get-Item $zipPath).Length / 1KB)
  } else { $report += '{0,-12} {1,8:N0} KB  {2}' -f $net, ($bytes / 1KB), "$variant/$name" }
}
}
"Bundled $($modules.Count) modules; store URL: $StoreUrl"
$report
