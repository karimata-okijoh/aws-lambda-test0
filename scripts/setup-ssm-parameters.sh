#!/bin/bash

# AWS Systems Manager Parameter Storeにパスワードを設定するスクリプト
# 使用方法: ./scripts/setup-ssm-parameters.sh

set -e

REGION="ap-northeast-1"

echo "TeamViewer Survey App - SSMパラメータ設定"
echo "=========================================="
echo ""

# 共通パスワードの設定
echo "共通パスワードを入力してください:"
read -s COMMON_PASSWORD

if [ -z "$COMMON_PASSWORD" ]; then
  echo "エラー: 共通パスワードが入力されていません"
  exit 1
fi

echo ""
echo "共通パスワードをSSMに保存中..."
aws ssm put-parameter \
  --name "teamviewer-survey-common-password" \
  --value "$COMMON_PASSWORD" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite \
  --description "TeamViewer Survey - Common Password for Users"

echo "✓ 共通パスワードの保存が完了しました"
echo ""

# 管理者パスワードの設定（デフォルト: supervisor1!）
echo "管理者パスワードを入力してください（デフォルト: supervisor1!）:"
read -s ADMIN_PASSWORD

if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD="supervisor1!"
  echo "デフォルトの管理者パスワードを使用します"
fi

echo ""
echo "管理者パスワードをSSMに保存中..."
aws ssm put-parameter \
  --name "teamviewer-survey-admin-password" \
  --value "$ADMIN_PASSWORD" \
  --type "SecureString" \
  --region "$REGION" \
  --overwrite \
  --description "TeamViewer Survey - Admin Password for karimata@okijoh.co.jp"

echo "✓ 管理者パスワードの保存が完了しました"
echo ""
echo "=========================================="
echo "SSMパラメータの設定が完了しました！"
echo ""
echo "設定されたパラメータ:"
echo "  - teamviewer-survey-common-password"
echo "  - teamviewer-survey-admin-password"
echo ""
echo "これらのパラメータはAWS SAMデプロイ時に自動的に読み込まれます。"
