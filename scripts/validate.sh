#!/bin/bash

# TeamViewer Survey App - デプロイ前検証スクリプト
# 使用方法: ./scripts/validate.sh

set -e

REGION="ap-northeast-1"
ERRORS=0

echo "=========================================="
echo "TeamViewer Survey App - デプロイ前検証"
echo "=========================================="
echo ""

# 1. 必要なツールの確認
echo "1. 必要なツールの確認"
echo "------------------------------------------"

# AWS CLI
if command -v aws &> /dev/null; then
  AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
  echo "✓ AWS CLI: $AWS_VERSION"
else
  echo "✗ AWS CLI がインストールされていません"
  ERRORS=$((ERRORS + 1))
fi

# SAM CLI
if command -v sam &> /dev/null; then
  SAM_VERSION=$(sam --version | cut -d' ' -f4)
  echo "✓ SAM CLI: $SAM_VERSION"
else
  echo "✗ SAM CLI がインストールされていません"
  ERRORS=$((ERRORS + 1))
fi

# Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo "✓ Node.js: $NODE_VERSION"
else
  echo "✗ Node.js がインストールされていません"
  ERRORS=$((ERRORS + 1))
fi

# npm
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  echo "✓ npm: $NPM_VERSION"
else
  echo "✗ npm がインストールされていません"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 2. AWS認証情報の確認
echo "2. AWS認証情報の確認"
echo "------------------------------------------"

if aws sts get-caller-identity > /dev/null 2>&1; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
  echo "✓ AWS認証情報が有効です"
  echo "  アカウントID: $ACCOUNT_ID"
  echo "  ユーザー/ロール: $USER_ARN"
else
  echo "✗ AWS認証情報が無効です"
  echo "  aws configure を実行してください"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 3. 必要なファイルの確認
echo "3. 必要なファイルの確認"
echo "------------------------------------------"

FILES=(
  "package.json"
  "tsconfig.json"
  "template.yaml"
  "src/lambda/auth/index.ts"
  "src/lambda/survey/index.ts"
  "src/lambda/report/index.ts"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "✓ $FILE"
  else
    echo "✗ $FILE が見つかりません"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

# 4. 依存関係の確認
echo "4. 依存関係の確認"
echo "------------------------------------------"

if [ -d "node_modules" ]; then
  echo "✓ node_modules が存在します"
  
  # 主要な依存関係の確認
  DEPS=(
    "@aws-sdk/client-dynamodb"
    "@aws-sdk/lib-dynamodb"
    "jsonwebtoken"
  )
  
  for DEP in "${DEPS[@]}"; do
    if [ -d "node_modules/$DEP" ]; then
      echo "  ✓ $DEP"
    else
      echo "  ✗ $DEP がインストールされていません"
      ERRORS=$((ERRORS + 1))
    fi
  done
else
  echo "✗ node_modules が見つかりません"
  echo "  npm install を実行してください"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 5. TypeScriptのコンパイル確認
echo "5. TypeScriptのコンパイル確認"
echo "------------------------------------------"

if npm run build > /dev/null 2>&1; then
  echo "✓ TypeScriptのコンパイルが成功しました"
else
  echo "✗ TypeScriptのコンパイルに失敗しました"
  echo "  npm run build を実行して詳細を確認してください"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 6. SAMテンプレートの検証
echo "6. SAMテンプレートの検証"
echo "------------------------------------------"

if sam validate > /dev/null 2>&1; then
  echo "✓ SAMテンプレートが有効です"
else
  echo "✗ SAMテンプレートが無効です"
  echo "  sam validate を実行して詳細を確認してください"
  ERRORS=$((ERRORS + 1))
fi

echo ""

# 7. SSMパラメータの確認
echo "7. SSMパラメータの確認"
echo "------------------------------------------"

# 共通パスワード
if aws ssm get-parameter --name "teamviewer-survey-common-password" --region "$REGION" --with-decryption > /dev/null 2>&1; then
  echo "✓ 共通パスワードが設定されています"
else
  echo "⚠ 共通パスワードが設定されていません"
  echo "  ./scripts/setup-ssm-parameters.sh を実行してください"
fi

# 管理者パスワード
if aws ssm get-parameter --name "teamviewer-survey-admin-password" --region "$REGION" --with-decryption > /dev/null 2>&1; then
  echo "✓ 管理者パスワードが設定されています"
else
  echo "⚠ 管理者パスワードが設定されていません"
  echo "  ./scripts/setup-ssm-parameters.sh を実行してください"
fi

echo ""

# 8. テストの実行
echo "8. テストの実行"
echo "------------------------------------------"

if npm test > /dev/null 2>&1; then
  echo "✓ すべてのテストが成功しました"
else
  echo "⚠ テストに失敗しました"
  echo "  npm test を実行して詳細を確認してください"
fi

echo ""

# 結果のサマリー
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
  echo "✓ 検証が完了しました！デプロイの準備ができています。"
  echo ""
  echo "デプロイを実行するには:"
  echo "  ./scripts/deploy.sh          # 通常デプロイ"
  echo "  ./scripts/deploy.sh --guided # ガイド付きデプロイ（初回推奨）"
  exit 0
else
  echo "✗ $ERRORS 個のエラーが見つかりました"
  echo "上記のエラーを修正してから再度実行してください"
  exit 1
fi
