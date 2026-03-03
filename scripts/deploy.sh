#!/bin/bash

# TeamViewer Survey App - 完全デプロイスクリプト
# 使用方法: ./scripts/deploy.sh [--guided]

set -e

GUIDED_MODE=false

# 引数の解析
if [ "$1" = "--guided" ]; then
  GUIDED_MODE=true
fi

echo "=========================================="
echo "TeamViewer Survey App - デプロイ開始"
echo "=========================================="
echo ""

# ステップ1: 依存関係のインストール
echo "ステップ1: 依存関係のインストール"
echo "------------------------------------------"
if [ ! -d "node_modules" ]; then
  echo "node_modulesが見つかりません。npm installを実行します..."
  npm install
else
  echo "✓ node_modulesが存在します"
fi
echo ""

# ステップ2: TypeScriptのビルド
echo "ステップ2: TypeScriptのビルド"
echo "------------------------------------------"
echo "Lambda関数のビルド中..."
npm run build

echo "フロントエンドのビルド中..."
npm run build:frontend

echo "✓ ビルドが完了しました"
echo ""

# ステップ3: SSMパラメータの確認
echo "ステップ3: SSMパラメータの確認"
echo "------------------------------------------"
REGION="ap-northeast-1"

# 共通パスワードの確認
if aws ssm get-parameter --name "teamviewer-survey-common-password" --region "$REGION" --with-decryption > /dev/null 2>&1; then
  echo "✓ 共通パスワードが設定されています"
else
  echo "⚠ 共通パスワードが設定されていません"
  echo "SSMパラメータを設定しますか？ (y/n)"
  read -r SETUP_SSM
  if [ "$SETUP_SSM" = "y" ]; then
    ./scripts/setup-ssm-parameters.sh
  else
    echo "エラー: SSMパラメータが必要です"
    exit 1
  fi
fi

# 管理者パスワードの確認
if aws ssm get-parameter --name "teamviewer-survey-admin-password" --region "$REGION" --with-decryption > /dev/null 2>&1; then
  echo "✓ 管理者パスワードが設定されています"
else
  echo "⚠ 管理者パスワードが設定されていません"
  echo "SSMパラメータを設定しますか？ (y/n)"
  read -r SETUP_SSM
  if [ "$SETUP_SSM" = "y" ]; then
    ./scripts/setup-ssm-parameters.sh
  else
    echo "エラー: SSMパラメータが必要です"
    exit 1
  fi
fi
echo ""

# ステップ4: SAMテンプレートの検証
echo "ステップ4: SAMテンプレートの検証"
echo "------------------------------------------"
sam validate
echo "✓ SAMテンプレートが有効です"
echo ""

# ステップ5: SAMビルド
echo "ステップ5: SAMビルド"
echo "------------------------------------------"
sam build
echo "✓ SAMビルドが完了しました"
echo ""

# ステップ6: SAMデプロイ
echo "ステップ6: SAMデプロイ"
echo "------------------------------------------"
if [ "$GUIDED_MODE" = true ]; then
  echo "ガイド付きデプロイを実行します..."
  sam deploy --guided
else
  echo "デプロイを実行します..."
  sam deploy
fi
echo ""

# ステップ7: デプロイ結果の表示
echo "=========================================="
echo "デプロイが完了しました！"
echo "=========================================="
echo ""

# API Gatewayエンドポイントの取得
STACK_NAME="teamviewer-survey-app"
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -n "$API_ENDPOINT" ]; then
  echo "API Endpoint: $API_ENDPOINT"
  echo ""
  echo "エンドポイント一覧:"
  echo "  - POST $API_ENDPOINT/auth/login"
  echo "  - GET  $API_ENDPOINT/survey"
  echo "  - POST $API_ENDPOINT/survey"
  echo "  - GET  $API_ENDPOINT/report"
  echo ""
fi

echo "ログの確認方法:"
echo "  - 認証Lambda: npm run logs:auth"
echo "  - アンケートLambda: npm run logs:survey"
echo "  - レポートLambda: npm run logs:report"
echo ""
echo "スタックの削除方法:"
echo "  sam delete --stack-name $STACK_NAME"
echo ""
