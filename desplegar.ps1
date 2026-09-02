#Requires -Version 5.1
<#
.SYNOPSIS
    Publica oasis_kafe.html en la web de Oasis Kafe.

.DESCRIPTION
    Un solo comando hace todo el proceso:
      1. Se sincroniza con GitHub.
      2. Copia oasis_kafe.html a docs/index.html (la pagina que sirve Cloudflare)
         y a oasis_kafe_donostia.html (la copia del repositorio).
      3. Hace commit y push a GitHub.
      4. Espera a que Cloudflare publique y COMPRUEBA que la web sirve
         exactamente tu archivo, comparando el hash MD5.

.EXAMPLE
    .\desplegar.ps1
    .\desplegar.ps1 -Mensaje "Nuevos precios de tartas"
    .\desplegar.ps1 -SinVerificar
#>
[CmdletBinding()]
param(
    [string] $Mensaje,
    [switch] $SinVerificar
)

$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot
Set-Location -LiteralPath $raiz

$FUENTE   = Join-Path $raiz 'oasis_kafe.html'
$DESTINOS = @('docs/index.html', 'oasis_kafe_donostia.html')
$WEB      = 'https://oasis-kafe.pages.dev'

function Paso  ($t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok    ($t) { Write-Host "   OK  $t" -ForegroundColor Green }
function Aviso ($t) { Write-Host "   !   $t" -ForegroundColor Yellow }
function Fallo ($t) { Write-Host "`n   X   $t`n" -ForegroundColor Red; exit 1 }

# Ejecuta git y aborta si falla.
function Git-O ([string[]] $Args) {
    $salida = & git @Args 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ($salida | Out-String) -ForegroundColor DarkGray
        Fallo "Fallo el comando: git $($Args -join ' ')"
    }
    return $salida
}

Write-Host "`n  OASIS KAFE - publicar web" -ForegroundColor White

if (-not (Test-Path -LiteralPath $FUENTE)) {
    Fallo "No encuentro oasis_kafe.html en esta carpeta."
}

# ---- 1. Sincronizar con GitHub -------------------------------------------
Paso 'Sincronizando con GitHub'
Git-O @('fetch','origin','--quiet') | Out-Null

$detras = [int](& git rev-list --count HEAD..origin/main)
$delante = [int](& git rev-list --count origin/main..HEAD)

if ($detras -gt 0 -and $delante -gt 0) {
    Fallo "Tu copia y GitHub han cambiado por separado ($delante local / $detras remoto).`n       Resuelvelo a mano con 'git pull' antes de publicar."
}
if ($detras -gt 0) {
    Aviso "GitHub tiene $detras cambio(s) mas nuevo(s). Descargandolos..."
    Git-O @('pull','--ff-only','origin','main') | Out-Null
}
Ok 'Al dia con GitHub'

# ---- 2. Copiar el HTML a sus destinos ------------------------------------
Paso 'Copiando tu archivo'
foreach ($d in $DESTINOS) {
    Copy-Item -LiteralPath $FUENTE -Destination (Join-Path $raiz $d) -Force
    Write-Host "   -> $d"
}
$hashLocal = (Get-FileHash -LiteralPath $FUENTE -Algorithm MD5).Hash.ToLower()
$tam = (Get-Item -LiteralPath $FUENTE).Length
Ok ("MD5 {0}  ({1:N0} bytes)" -f $hashLocal, $tam)

# ---- 3. Hay algo que publicar? -------------------------------------------
$rutas = @('oasis_kafe.html') + $DESTINOS
$cambios = & git status --porcelain -- $rutas
if (-not $cambios) {
    Aviso 'No hay cambios: la web ya tiene esta version. Nada que publicar.'
    Write-Host ""
    exit 0
}

# ---- 4. Commit y push ----------------------------------------------------
if (-not $Mensaje) {
    $Mensaje = "Actualizacion de la web - $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
}
Paso 'Publicando en GitHub'
Git-O (@('add','--') + $rutas) | Out-Null
Git-O @('commit','-m',$Mensaje,'--quiet') | Out-Null
Git-O @('push','origin','main','--quiet') | Out-Null
$sha = (& git rev-parse --short HEAD).Trim()
Ok "Commit $sha subido  -  `"$Mensaje`""

# ---- 5. Verificar que la web ya sirve tu archivo -------------------------
if ($SinVerificar) {
    Ok 'Hecho. Cloudflare publicara en aprox. 1 minuto.'
    Write-Host ""
    exit 0
}

Paso 'Esperando a que Cloudflare publique'
$tmp    = Join-Path $env:TEMP 'oasis-verificacion.html'
$limite = (Get-Date).AddMinutes(3)
$listo  = $false

while ((Get-Date) -lt $limite) {
    Start-Sleep -Seconds 8
    try {
        Invoke-WebRequest -Uri $WEB -OutFile $tmp -UseBasicParsing -TimeoutSec 45 `
                          -Headers @{ 'Cache-Control' = 'no-cache' }
        $hashWeb = (Get-FileHash -LiteralPath $tmp -Algorithm MD5).Hash.ToLower()
        if ($hashWeb -eq $hashLocal) { $listo = $true; break }
        Write-Host '   ... todavia sirve la version anterior' -ForegroundColor DarkGray
    } catch {
        Write-Host '   ... reintentando' -ForegroundColor DarkGray
    }
}
Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue

Write-Host ""
if ($listo) {
    Ok "PUBLICADO - $WEB ya sirve tu version exacta."
} else {
    Aviso "El commit subio bien, pero tras 3 minutos la web aun no lo refleja."
    Aviso "Suele tardar un poco mas. Comprueba en https://dash.cloudflare.com"
}
Write-Host ""
