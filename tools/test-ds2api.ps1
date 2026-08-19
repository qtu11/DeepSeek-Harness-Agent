param([string]$Token = "")
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   KIEM TRA XAC THUC DS2API & DEEPSEEK WEB TOKEN     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

if ([string]::IsNullOrWhiteSpace($Token)) {
    if (Test-Path ".env") {
        $lines = Get-Content ".env"
        foreach ($line in $lines) {
            if ($line -match "^DS_USER_TOKEN=(.+)$") {
                $Token = $matches[1].Trim()
                break
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "[LOI] Khong tim thay DS_USER_TOKEN trong .env hoac tham so!" -ForegroundColor Red
    exit 1
}

Write-Host "Token dang kiem tra: $($Token.Substring(0, [Math]::Min(15, $Token.Length)))... (Do dai: $($Token.Length))"

# 1. Test truc tiep voi DeepSeek Web
Write-Host "`n[Buoc 1] Kiem tra xac thuc truc tiep voi may chu chat.deepseek.com..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
    "User-Agent"    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    "Origin"        = "https://chat.deepseek.com"
    "Referer"       = "https://chat.deepseek.com/"
    "x-client-platform" = "web"
    "x-client-version"  = "1.0.0"
    "x-app-version"     = "20241129.0"
}

$body = @{ target_path = "/api/v0/chat/completion" } | ConvertTo-Json

try {
    $res = Invoke-RestMethod -Uri "https://chat.deepseek.com/api/v0/chat/create_pow_challenge" -Method Post -Headers $headers -Body $body -TimeoutSec 10
    if ($res.code -eq 0) {
        Write-Host " -> XAC THUC THANH CONG! Token hop le 100%!" -ForegroundColor Green
    } elseif ($res.code -eq 40003) {
        Write-Host " -> THAT BAI: Ma loi 40003 - Authorization Failed (Token khong hop le hoac da het han)." -ForegroundColor Red
        exit 1
    } else {
        Write-Host " -> Phan hoi tu DeepSeek: Code $($res.code) - $($res.msg)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " -> Loi ket noi toi chat.deepseek.com: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Test qua ds2api noi bo
Write-Host "`n[Buoc 2] Khoi chay va kiem tra proxy ds2api noi bo tai cong 25001..." -ForegroundColor Yellow
$env:PORT = "25001"
$env:DS2API_AUTO_BUILD_WEBUI = "false"
$env:DS2API_CONFIG_PATH = "tools/ds2api/config.json"

$configJson = @"
{
  "accounts": [
    {
      "name": "DeepSeek Web Account",
      "token": "$Token"
    }
  ],
  "api_keys": [
    {
      "key": "sk-ds2api-dsh-local",
      "name": "Local Key"
    }
  ],
  "keys": ["sk-ds2api-dsh-local"],
  "model_aliases": {
    "deepseek-chat": "deepseek-v4-flash",
    "deepseek-reasoner": "deepseek-v4-pro",
    "deepseek-v4-flash": "deepseek-v4-flash",
    "deepseek-v4-pro": "deepseek-v4-pro"
  },
  "runtime": {
    "account_max_inflight": 2,
    "token_refresh_interval_hours": 6
  }
}
"@
[System.IO.File]::WriteAllText("tools\ds2api\config.json", $configJson, [System.Text.UTF8Encoding]::new($false))

$proc = Start-Process -FilePath ".\tools\ds2api\ds2api.exe" -WorkingDirectory "tools\ds2api" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 3

try {
    $reqHeaders = @{
        "Authorization" = "Bearer sk-ds2api-dsh-local"
        "Content-Type"  = "application/json"
    }
    $reqBody = @{
        model = "deepseek-chat"
        messages = @(
            @{ role = "user"; content = "Tra loi ngan gon 1 cau bang tieng Viet: Ban la ai?" }
        )
        stream = $false
    } | ConvertTo-Json

    $aiResp = Invoke-RestMethod -Uri "http://127.0.0.1:25001/v1/chat/completions" -Method Post -Headers $reqHeaders -Body $reqBody -TimeoutSec 30
    Write-Host " -> GOI THANH CONG! AI DA TRA LOI QUA DS2API:" -ForegroundColor Green
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Write-Host "    $($aiResp.choices[0].message.content)" -ForegroundColor Cyan
} catch {
    Write-Host " -> Loi khi goi ds2api: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Write-Host "======================================================" -ForegroundColor Cyan
