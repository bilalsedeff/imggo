# Comprehensive Pattern Testing Suite
# Tests all pattern formats (JSON, Text, XML) with random images

param(
    [string]$ApiKey = "imggo_test_UZ-MW3h-8u-yK2oN3GKgQM-I2aIlPXX2uxQ0pZZW",
    [string]$BaseUrl = "http://localhost:3000",
    [int]$TestCount = 20,
    [string]$ImageFolder = ".\test-photos\landscape-pattern"
)

# Pattern definitions with expected schemas
$patterns = @(
    @{
        Name = "deneme (JSON)"
        Id = "1927e053-7ca6-4ff5-8ad7-5fdc53131c6e"
        Format = "json"
        ExpectedKeys = @("robot_count", "robot_types", "pattern_name")
    },
    @{
        Name = "general pattern 3 (Text - Cups)"
        Id = "1222558c-a91a-4387-b930-500db278cb60"
        Format = "text"
        ExpectedHeadings = @("Cup Description", "Material", "Color", "Size", "Shape", "Design/Pattern", "Quantity", "Context/Setting")
    },
    @{
        Name = "general pattern 2 (Text - Garden)"
        Id = "eec8b9af-5a76-4fcd-9d57-24e14b7c6efb"
        Format = "text"
        ExpectedHeadings = @("Garden Objects", "Plant Types", "Garden Layout", "Decorative Features", "Weather Conditions")
    },
    @{
        Name = "general pattern (Text - Books)"
        Id = "a4ea1f52-8086-4ed6-bf1d-ffbfad903e0c"
        Format = "text"
        ExpectedHeadings = @("Book Title", "Author", "Genre", "Cover Design", "Publication Date", "Publisher", "Key Themes", "Notable Features")
    },
    @{
        Name = "football-xml (XML)"
        Id = "22091ae8-1a51-4879-8d9f-81bf420ebccf"
        Format = "xml"
        ExpectedRootTag = "imageAnalysis"
    }
)

# Get all test images
$images = Get-ChildItem -Path $ImageFolder -File | Where-Object { $_.Extension -match '\.(jpg|png|jpeg)$' } | Select-Object -ExpandProperty FullName

if ($images.Count -eq 0) {
    Write-Error "No images found in $ImageFolder"
    exit 1
}

Write-Host "`n🧪 COMPREHENSIVE PATTERN TESTING SUITE" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "📊 Test Configuration:" -ForegroundColor Yellow
Write-Host "   Patterns: $($patterns.Count)" -ForegroundColor White
Write-Host "   Images: $($images.Count)" -ForegroundColor White
Write-Host "   Tests: $TestCount" -ForegroundColor White
Write-Host "   Base URL: $BaseUrl" -ForegroundColor White
Write-Host "`n"

# Test results storage
$results = @()
$testNumber = 0

# Generate random test combinations
1..$TestCount | ForEach-Object {
    $testNumber++
    
    # Randomly select pattern and image
    $pattern = $patterns | Get-Random
    $image = $images | Get-Random
    $imageName = Split-Path -Leaf $image
    
    Write-Host "`n[$testNumber/$TestCount] Testing: $($pattern.Name)" -ForegroundColor Cyan
    Write-Host "   Image: $imageName" -ForegroundColor Gray
    Write-Host "   Pattern ID: $($pattern.Id)" -ForegroundColor Gray
    
    # Upload image
    $endpoint = "$BaseUrl/api/patterns/$($pattern.Id)/ingest"
    
    try {
        $startTime = Get-Date
        
        # Execute curl command (use curl.exe explicitly, not PowerShell alias)
        $curlOutput = & curl.exe -X POST $endpoint `
            -H "Authorization: Bearer $ApiKey" `
            -F "image=@$image" `
            -w "`n__STATUS__%{http_code}__" `
            -s 2>&1
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        # Parse response
        $outputStr = $curlOutput -join "`n"
        if ($outputStr -match "__STATUS__(\d+)__") {
            $httpCode = $matches[1]
            $body = ($outputStr -split "__STATUS__")[0]
        } else {
            $httpCode = "error"
            $body = $outputStr
        }
        
        $testResult = @{
            TestNumber = $testNumber
            Pattern = $pattern.Name
            PatternId = $pattern.Id
            Format = $pattern.Format
            Image = $imageName
            HttpCode = $httpCode
            Duration = [math]::Round($duration, 0)
            Success = $false
            ValidationErrors = @()
            Preview = ""
        }
        
        if ($httpCode -eq "200") {
            Write-Host "   ✅ HTTP 200 OK ($([math]::Round($duration, 0))ms)" -ForegroundColor Green
            
            # Validate response based on format
            switch ($pattern.Format) {
                "json" {
                    try {
                        $json = $body | ConvertFrom-Json
                        $testResult.Preview = ($json | ConvertTo-Json -Depth 2).Substring(0, [Math]::Min(200, ($json | ConvertTo-Json -Depth 2).Length))
                        
                        # Extract manifest from response structure
                        $manifest = $null
                        if ($json.PSObject.Properties.Name.Contains("data") -and 
                            $json.data.PSObject.Properties.Name.Contains("manifest")) {
                            $manifest = $json.data.manifest
                        } elseif ($json.PSObject.Properties.Name.Contains("manifest")) {
                            $manifest = $json.manifest
                        } else {
                            $manifest = $json
                        }
                        
                        # Check expected keys in manifest
                        $missingKeys = @()
                        foreach ($key in $pattern.ExpectedKeys) {
                            if (-not $manifest.PSObject.Properties.Name.Contains($key)) {
                                $missingKeys += $key
                            }
                        }
                        
                        if ($missingKeys.Count -eq 0) {
                            Write-Host "   ✅ JSON Valid - All expected keys present in manifest" -ForegroundColor Green
                            $testResult.Success = $true
                        } else {
                            Write-Host "   ❌ Missing keys in manifest: $($missingKeys -join ', ')" -ForegroundColor Red
                            $testResult.ValidationErrors += "Missing keys: $($missingKeys -join ', ')"
                        }
                    } catch {
                        Write-Host "   ❌ Invalid JSON: $_" -ForegroundColor Red
                        $testResult.ValidationErrors += "Invalid JSON: $_"
                    }
                }
                
                "text" {
                    $testResult.Preview = $body.Substring(0, [Math]::Min(200, $body.Length))
                    
                    # Check for preamble (should start with #)
                    if ($body.Trim() -notmatch "^#") {
                        Write-Host "   ❌ Text doesn't start with markdown heading" -ForegroundColor Red
                        $testResult.ValidationErrors += "Doesn't start with # (preamble detected)"
                    } else {
                        Write-Host "   ✅ Starts with markdown heading (no preamble)" -ForegroundColor Green
                    }
                    
                    # Check expected headings
                    $missingHeadings = @()
                    foreach ($heading in $pattern.ExpectedHeadings) {
                        if ($body -notmatch [regex]::Escape($heading)) {
                            $missingHeadings += $heading
                        }
                    }
                    
                    if ($missingHeadings.Count -eq 0) {
                        Write-Host "   ✅ All expected headings present" -ForegroundColor Green
                        $testResult.Success = $true
                    } else {
                        Write-Host "   ⚠️  Missing headings: $($missingHeadings -join ', ')" -ForegroundColor Yellow
                        $testResult.ValidationErrors += "Missing headings: $($missingHeadings -join ', ')"
                    }
                }
                
                "xml" {
                    $testResult.Preview = $body.Substring(0, [Math]::Min(200, $body.Length))
                    
                    try {
                        [xml]$xml = $body
                        
                        # Check root tag
                        if ($xml.DocumentElement.LocalName -eq $pattern.ExpectedRootTag) {
                            Write-Host "   ✅ XML Valid - Root tag matches" -ForegroundColor Green
                            $testResult.Success = $true
                        } else {
                            Write-Host "   ❌ Wrong root tag: Expected '$($pattern.ExpectedRootTag)', got '$($xml.DocumentElement.LocalName)'" -ForegroundColor Red
                            $testResult.ValidationErrors += "Wrong root tag"
                        }
                    } catch {
                        Write-Host "   ❌ Invalid XML: $_" -ForegroundColor Red
                        $testResult.ValidationErrors += "Invalid XML: $_"
                    }
                }
            }
        } else {
            Write-Host "   ❌ HTTP $httpCode" -ForegroundColor Red
            $testResult.ValidationErrors += "HTTP error: $httpCode"
            $testResult.Preview = $body.Substring(0, [Math]::Min(200, $body.Length))
        }
        
        $results += [PSCustomObject]$testResult
        
    } catch {
        Write-Host "   ❌ Exception: $_" -ForegroundColor Red
        $results += [PSCustomObject]@{
            TestNumber = $testNumber
            Pattern = $pattern.Name
            PatternId = $pattern.Id
            Format = $pattern.Format
            Image = $imageName
            HttpCode = "error"
            Duration = 0
            Success = $false
            ValidationErrors = @("Exception: $_")
            Preview = ""
        }
    }
    
    # Rate limiting pause
    Start-Sleep -Milliseconds 500
}

# Generate comprehensive report
Write-Host "`n`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "📊 TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan

$successCount = ($results | Where-Object { $_.Success }).Count
$failCount = $TestCount - $successCount
$successRate = [math]::Round(($successCount / $TestCount) * 100, 1)

Write-Host "`n📈 Overall Statistics:" -ForegroundColor Yellow
Write-Host "   Total Tests: $TestCount" -ForegroundColor White
Write-Host "   ✅ Passed: $successCount ($successRate%)" -ForegroundColor Green
Write-Host "   ❌ Failed: $failCount" -ForegroundColor Red
Write-Host "   ⏱️  Avg Duration: $([math]::Round(($results | Measure-Object -Property Duration -Average).Average, 0))ms" -ForegroundColor White

# Results by format
Write-Host "`n📋 Results by Format:" -ForegroundColor Yellow
$formats = $results | Group-Object -Property Format
foreach ($format in $formats) {
    $formatSuccess = ($format.Group | Where-Object { $_.Success }).Count
    $formatTotal = $format.Group.Count
    $formatRate = [math]::Round(($formatSuccess / $formatTotal) * 100, 1)
    
    $color = if ($formatRate -eq 100) { "Green" } elseif ($formatRate -ge 80) { "Yellow" } else { "Red" }
    Write-Host "   $($format.Name.ToUpper()): $formatSuccess/$formatTotal ($formatRate%)" -ForegroundColor $color
}

# Failed tests detail
$failedTests = $results | Where-Object { -not $_.Success }
if ($failedTests.Count -gt 0) {
    Write-Host "`n❌ Failed Tests Detail:" -ForegroundColor Red
    foreach ($test in $failedTests) {
        Write-Host "`n   Test #$($test.TestNumber): $($test.Pattern)" -ForegroundColor Red
        Write-Host "   Image: $($test.Image)" -ForegroundColor Gray
        Write-Host "   HTTP: $($test.HttpCode)" -ForegroundColor Gray
        Write-Host "   Errors:" -ForegroundColor Red
        foreach ($validationError in $test.ValidationErrors) {
            Write-Host "      - $validationError" -ForegroundColor Red
        }
        if ($test.Preview) {
            Write-Host "   Preview: $($test.Preview.Substring(0, [Math]::Min(100, $test.Preview.Length)))..." -ForegroundColor Gray
        }
    }
}

# Success examples
Write-Host "`n✅ Successful Test Examples:" -ForegroundColor Green
$successfulTests = $results | Where-Object { $_.Success } | Select-Object -First 5
foreach ($test in $successfulTests) {
    Write-Host "`n   Test #$($test.TestNumber): $($test.Pattern)" -ForegroundColor Green
    Write-Host "   Image: $($test.Image)" -ForegroundColor Gray
    Write-Host "   Duration: $($test.Duration)ms" -ForegroundColor Gray
    Write-Host "   Preview: $($test.Preview.Substring(0, [Math]::Min(150, $test.Preview.Length)))..." -ForegroundColor Gray
}

# Export detailed results to JSON
$reportPath = "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$results | ConvertTo-Json -Depth 5 | Out-File -FilePath $reportPath -Encoding utf8
Write-Host "`n📄 Detailed report saved to: $reportPath" -ForegroundColor Cyan

# Final verdict
Write-Host "`n" + ("=" * 80) -ForegroundColor Cyan
if ($successRate -eq 100) {
    Write-Host "🎉 ALL TESTS PASSED! Perfect implementation!" -ForegroundColor Green
} elseif ($successRate -ge 90) {
    Write-Host "✅ Excellent! $successRate% success rate" -ForegroundColor Green
} elseif ($successRate -ge 75) {
    Write-Host "⚠️  Good but needs improvement: $successRate% success rate" -ForegroundColor Yellow
} else {
    Write-Host "❌ Critical issues detected: Only $successRate% success rate" -ForegroundColor Red
}
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "`n"
