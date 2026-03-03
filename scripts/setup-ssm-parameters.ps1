# AWS Systems Manager Parameter Storeにパスワードを設定するスクリプト (PowerShell)
# 使用方法: .\scripts\setup-ssm-parameters.ps1

$ErrorActionPreference = "Stop"
$Region = "ap-northeast-1"

Write-Host "TeamViewer Survey App - SSMパラメータ設定" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 共通パスワードの設定
Write-Host "共通パスワードを入力してください:"
$commonPasswordSecure = Read-Host -AsSecureString
$commonPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($commonPasswordSecure)
)

if ([string]::IsNullOrWhiteSpace($commonPassword)) {
    Write-Host "エラー: 共通パスワードが入力されていません" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "共通パスワードをSSMに保存中..."
aws ssm put-parameter `
    --name "teamviewer-survey-common-password" `
    --value $commonPassword `
    --type "SecureString" `
    --region $Region `
    --overwrite `
    --description "TeamViewer Survey - Common Password for Users"

Write-Host "✓ 共通パスワードの保存が完了しました" -ForegroundColor Green
Write-Host ""

# 管理者パスワードの設定（デフォルト: supervisor1!）
Write-Host "管理者パスワードを入力してください（デフォルト: supervisor1!）:"
$adminPasswordSecure = Read-Host -AsSecureString
$adminPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPasswordSecure)
)

if ([string]::IsNullOrWhiteSpace($adminPassword)) {
    $adminPassword = "supervisor1!"
    Write-Host "デフォルトの管理者パスワードを使用します"
}

Write-Host ""
Write-Host "管理者パスワードをSSMに保存中..."
aws ssm put-parameter `
    --name "teamviewer-survey-admin-password" `
    --value $adminPassword `
    --type "SecureString" `
    --region $Region `
    --overwrite `
    --description "TeamViewer Survey - Admin Password for karimata@okijoh.co.jp"

Write-Host "✓ 管理者パスワードの保存が完了しました" -ForegroundColor Green
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "SSMパラメータの設定が完了しました！" -ForegroundColor Cyan
Write-Host ""
Write-Host "設定されたパラメータ:"
Write-Host "  - teamviewer-survey-common-password"
Write-Host "  - teamviewer-survey-admin-password"
Write-Host ""
Write-Host "これらのパラメータはAWS SAMデプロイ時に自動的に読み込まれます。"
