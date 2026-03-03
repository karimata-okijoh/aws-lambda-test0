# TeamViewer Survey App - デプロイ前検証スクリプト (PowerShell)
# 使用方法: .\scripts\validate.ps1

$ErrorActionPreference = "Continue"
$Region = "ap-northeast-1"
$Errors = 0

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TeamViewer Survey App - デプロイ前検証" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 必要なツールの確認
Write-Host "1. 必要なツールの確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

# AWS CLI
if (Get-Command aws -ErrorAction SilentlyContinue) {
    $awsVersion = (aws --version 2>&1) -replace ".*aws-cli/([\d.]+).*", '$1'
    Write-Host "✓ AWS CLI: $awsVersion" -ForegroundColor Green
} else {
    Write-Host "✗ AWS CLI がインストールされていません" -ForegroundColor Red
    $Errors++
}

# SAM CLI
if (Get-Command sam -ErrorAction SilentlyContinue) {
    $samVersion = (sam --version) -replace ".*version ([\d.]+).*", '$1'
    Write-Host "✓ SAM CLI: $samVersion" -ForegroundColor Green
} else {
    Write-Host "✗ SAM CLI がインストールされていません" -ForegroundColor Red
    $Errors++
}

# Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js がインストールされていません" -ForegroundColor Red
    $Errors++
}

# npm
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "✓ npm: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "✗ npm がインストールされていません" -ForegroundColor Red
    $Errors++
}

Write-Host ""

# 2. AWS認証情報の確認
Write-Host "2. AWS認証情報の確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    $accountId = $identity.Account
    $userArn = $identity.Arn
    Write-Host "✓ AWS認証情報が有効です" -ForegroundColor Green
    Write-Host "  アカウントID: $accountId"
    Write-Host "  ユーザー/ロール: $userArn"
} catch {
    Write-Host "✗ AWS認証情報が無効です" -ForegroundColor Red
    Write-Host "  aws configure を実行してください"
    $Errors++
}

Write-Host ""

# 3. 必要なファイルの確認
Write-Host "3. 必要なファイルの確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

$files = @(
    "package.json",
    "tsconfig.json",
    "template.yaml",
    "src/lambda/auth/index.ts",
    "src/lambda/survey/index.ts",
    "src/lambda/report/index.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file が見つかりません" -ForegroundColor Red
        $Errors++
    }
}

Write-Host ""

# 4. 依存関係の確認
Write-Host "4. 依存関係の確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

if (Test-Path "node_modules") {
    Write-Host "✓ node_modules が存在します" -ForegroundColor Green
    
    # 主要な依存関係の確認
    $deps = @(
        "@aws-sdk/client-dynamodb",
        "@aws-sdk/lib-dynamodb",
        "jsonwebtoken"
    )
    
    foreach ($dep in $deps) {
        $depPath = "node_modules/$dep"
        if (Test-Path $depPath) {
            Write-Host "  ✓ $dep" -ForegroundColor Green
        } else {
            Write-Host "  ✗ $dep がインストールされていません" -ForegroundColor Red
            $Errors++
        }
    }
} else {
    Write-Host "✗ node_modules が見つかりません" -ForegroundColor Red
    Write-Host "  npm install を実行してください"
    $Errors++
}

Write-Host ""

# 5. TypeScriptのコンパイル確認
Write-Host "5. TypeScriptのコンパイル確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ TypeScriptのコンパイルが成功しました" -ForegroundColor Green
    } else {
        Write-Host "✗ TypeScriptのコンパイルに失敗しました" -ForegroundColor Red
        Write-Host "  npm run build を実行して詳細を確認してください"
        $Errors++
    }
} catch {
    Write-Host "✗ TypeScriptのコンパイルに失敗しました" -ForegroundColor Red
    Write-Host "  npm run build を実行して詳細を確認してください"
    $Errors++
}

Write-Host ""

# 6. SAMテンプレートの検証
Write-Host "6. SAMテンプレートの検証" -ForegroundColor Yellow
Write-Host "------------------------------------------"

try {
    sam validate 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ SAMテンプレートが有効です" -ForegroundColor Green
    } else {
        Write-Host "✗ SAMテンプレートが無効です" -ForegroundColor Red
        Write-Host "  sam validate を実行して詳細を確認してください"
        $Errors++
    }
} catch {
    Write-Host "✗ SAMテンプレートが無効です" -ForegroundColor Red
    Write-Host "  sam validate を実行して詳細を確認してください"
    $Errors++
}

Write-Host ""

# 7. SSMパラメータの確認
Write-Host "7. SSMパラメータの確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"

# 共通パスワード
try {
    aws ssm get-parameter --name "teamviewer-survey-common-password" --region $Region --with-decryption 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 共通パスワードが設定されています" -ForegroundColor Green
    } else {
        Write-Host "⚠ 共通パスワードが設定されていません" -ForegroundColor Yellow
        Write-Host "  .\scripts\setup-ssm-parameters.ps1 を実行してください"
    }
} catch {
    Write-Host "⚠ 共通パスワードが設定されていません" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-ssm-parameters.ps1 を実行してください"
}

# 管理者パスワード
try {
    aws ssm get-parameter --name "teamviewer-survey-admin-password" --region $Region --with-decryption 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 管理者パスワードが設定されています" -ForegroundColor Green
    } else {
        Write-Host "⚠ 管理者パスワードが設定されていません" -ForegroundColor Yellow
        Write-Host "  .\scripts\setup-ssm-parameters.ps1 を実行してください"
    }
} catch {
    Write-Host "⚠ 管理者パスワードが設定されていません" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup-ssm-parameters.ps1 を実行してください"
}

Write-Host ""

# 8. テストの実行
Write-Host "8. テストの実行" -ForegroundColor Yellow
Write-Host "------------------------------------------"

try {
    npm test 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ すべてのテストが成功しました" -ForegroundColor Green
    } else {
        Write-Host "⚠ テストに失敗しました" -ForegroundColor Yellow
        Write-Host "  npm test を実行して詳細を確認してください"
    }
} catch {
    Write-Host "⚠ テストに失敗しました" -ForegroundColor Yellow
    Write-Host "  npm test を実行して詳細を確認してください"
}

Write-Host ""

# 結果のサマリー
Write-Host "==========================================" -ForegroundColor Cyan
if ($Errors -eq 0) {
    Write-Host "✓ 検証が完了しました！デプロイの準備ができています。" -ForegroundColor Green
    Write-Host ""
    Write-Host "デプロイを実行するには:"
    Write-Host "  .\scripts\deploy.ps1          # 通常デプロイ"
    Write-Host "  .\scripts\deploy.ps1 -Guided  # ガイド付きデプロイ（初回推奨）"
    exit 0
} else {
    Write-Host "✗ $Errors 個のエラーが見つかりました" -ForegroundColor Red
    Write-Host "上記のエラーを修正してから再度実行してください"
    exit 1
}
