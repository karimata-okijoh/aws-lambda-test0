# TeamViewer Survey App - 完全デプロイスクリプト (PowerShell)
# 使用方法: .\scripts\deploy.ps1 [-Guided]

param(
    [switch]$Guided
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "TeamViewer Survey App - デプロイ開始" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# ステップ1: 依存関係のインストール
Write-Host "ステップ1: 依存関係のインストール" -ForegroundColor Yellow
Write-Host "------------------------------------------"
if (-not (Test-Path "node_modules")) {
    Write-Host "node_modulesが見つかりません。npm installを実行します..."
    npm install
} else {
    Write-Host "✓ node_modulesが存在します" -ForegroundColor Green
}
Write-Host ""

# ステップ2: TypeScriptのビルド
Write-Host "ステップ2: TypeScriptのビルド" -ForegroundColor Yellow
Write-Host "------------------------------------------"
Write-Host "Lambda関数のビルド中..."
npm run build

Write-Host "フロントエンドのビルド中..."
npm run build:frontend

Write-Host "✓ ビルドが完了しました" -ForegroundColor Green
Write-Host ""

# ステップ3: SSMパラメータの確認
Write-Host "ステップ3: SSMパラメータの確認" -ForegroundColor Yellow
Write-Host "------------------------------------------"
$Region = "ap-northeast-1"

# 共通パスワードの確認
$commonPasswordExists = $false
try {
    $result = aws ssm get-parameter --name "teamviewer-survey-common-password" --region $Region --with-decryption 2>&1
    if ($LASTEXITCODE -eq 0) {
        $commonPasswordExists = $true
        Write-Host "✓ 共通パスワードが設定されています" -ForegroundColor Green
    }
} catch {
    # エラーを無視
}

if (-not $commonPasswordExists) {
    Write-Host "⚠ 共通パスワードが設定されていません" -ForegroundColor Yellow
    $setupSSM = Read-Host "SSMパラメータを設定しますか？ (y/n)"
    if ($setupSSM -eq "y") {
        & ".\scripts\setup-ssm-parameters.ps1"
    } else {
        Write-Host "エラー: SSMパラメータが必要です" -ForegroundColor Red
        exit 1
    }
}

# 管理者パスワードの確認
$adminPasswordExists = $false
try {
    $result = aws ssm get-parameter --name "teamviewer-survey-admin-password" --region $Region --with-decryption 2>&1
    if ($LASTEXITCODE -eq 0) {
        $adminPasswordExists = $true
        Write-Host "✓ 管理者パスワードが設定されています" -ForegroundColor Green
    }
} catch {
    # エラーを無視
}

if (-not $adminPasswordExists) {
    Write-Host "⚠ 管理者パスワードが設定されていません" -ForegroundColor Yellow
    $setupSSM = Read-Host "SSMパラメータを設定しますか？ (y/n)"
    if ($setupSSM -eq "y") {
        & ".\scripts\setup-ssm-parameters.ps1"
    } else {
        Write-Host "エラー: SSMパラメータが必要です" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# ステップ4: SAMテンプレートの検証
Write-Host "ステップ4: SAMテンプレートの検証" -ForegroundColor Yellow
Write-Host "------------------------------------------"
sam validate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SAMテンプレートが有効です" -ForegroundColor Green
}
Write-Host ""

# ステップ5: SAMビルド
Write-Host "ステップ5: SAMビルド" -ForegroundColor Yellow
Write-Host "------------------------------------------"
sam build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SAMビルドが完了しました" -ForegroundColor Green
}
Write-Host ""

# ステップ6: SAMデプロイ
Write-Host "ステップ6: SAMデプロイ" -ForegroundColor Yellow
Write-Host "------------------------------------------"
if ($Guided) {
    Write-Host "ガイド付きデプロイを実行します..."
    sam deploy --guided
} else {
    Write-Host "デプロイを実行します..."
    sam deploy
}
Write-Host ""

# ステップ7: デプロイ結果の表示
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "デプロイが完了しました！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# API Gatewayエンドポイントの取得
$StackName = "teamviewer-survey-app"
try {
    $ApiEndpoint = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text 2>$null

    if ($ApiEndpoint -and $LASTEXITCODE -eq 0) {
        Write-Host "API Endpoint: $ApiEndpoint" -ForegroundColor Green
        Write-Host ""
        Write-Host "エンドポイント一覧:"
        Write-Host "  - POST ${ApiEndpoint}/auth/login"
        Write-Host "  - GET  ${ApiEndpoint}/survey"
        Write-Host "  - POST ${ApiEndpoint}/survey"
        Write-Host "  - GET  ${ApiEndpoint}/report"
        Write-Host ""
    }
} catch {
    Write-Host "API Endpointの取得に失敗しました" -ForegroundColor Yellow
}

Write-Host "ログの確認方法:"
Write-Host "  - 認証Lambda: npm run logs:auth"
Write-Host "  - アンケートLambda: npm run logs:survey"
Write-Host "  - レポートLambda: npm run logs:report"
Write-Host ""
Write-Host "スタックの削除方法:"
Write-Host "  sam delete --stack-name ${StackName}" -ForegroundColor Gray
Write-Host ""
