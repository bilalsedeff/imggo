# Simple PowerShell script using curl.exe for multipart upload
param(
    [Parameter(Mandatory=$true)]
    [string]$PatternId,

    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$true)]
    [string]$ImageFile
)

# Check if file exists
if (-not (Test-Path $ImageFile)) {
    Write-Error "Image file not found: $ImageFile"
    exit 1
}

Write-Host "Uploading image to pattern $PatternId..." -ForegroundColor Cyan
Write-Host "File: $ImageFile" -ForegroundColor Gray

# Generate idempotency key
$idempotencyKey = [guid]::NewGuid().ToString()

# Use curl.exe (available in Windows 10+)
$url = "http://localhost:3000/api/patterns/$PatternId/ingest"

curl.exe -X POST $url `
  -H "Authorization: Bearer $ApiKey" `
  -F "image=@$ImageFile" `
  -F "idempotency_key=$idempotencyKey" `
  -v

Write-Host "`nDone!" -ForegroundColor Green
