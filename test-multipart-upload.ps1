# PowerShell script for multipart image upload test
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

# Generate idempotency key (PowerShell GUID)
$idempotencyKey = [guid]::NewGuid().ToString()

# Prepare multipart form data
$boundary = [System.Guid]::NewGuid().ToString()
$fileBytes = [System.IO.File]::ReadAllBytes($ImageFile)
$fileName = [System.IO.Path]::GetFileName($ImageFile)
$mimeType = "image/$(([System.IO.Path]::GetExtension($ImageFile)).TrimStart('.'))"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"image`"; filename=`"$fileName`"",
    "Content-Type: $mimeType",
    "",
    [System.Text.Encoding]::UTF8.GetString($fileBytes),
    "--$boundary",
    "Content-Disposition: form-data; name=`"idempotency_key`"",
    "",
    $idempotencyKey,
    "--$boundary--"
)

$body = $bodyLines -join "`r`n"

# Make request
$url = "http://localhost:3000/api/patterns/$PatternId/ingest"
$headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type" = "multipart/form-data; boundary=$boundary"
}

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -Verbose

    Write-Host "`nSuccess!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10 | Write-Host

} catch {
    Write-Host "`nError:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        Write-Host $_.ErrorDetails.Message
    }
}
