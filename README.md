# TeamViewer Survey App

TeamViewerの利用状況を収集・集計するためのサーバーレスアンケートシステムです。

## 概要

社内ツールとして、20〜25名の社員がTeamViewerの利用状況（午前中、午後、18時以降の3つの時間帯）を1週間単位で入力できるWebアプリケーションです。AWS Lambdaの無料枠内で動作するように設計されています。

**アンケート期間**: 2026年3月2日～2026年6月27日

## 主要機能

- ✅ ドメイン制限付きユーザー認証（@okijoh.co.jp）
- ✅ 1週間単位の表形式でのアンケート回答入力
- ✅ 各日付×時間帯のセルをクリックで使用/未使用を切り替え
- ✅ 週単位のナビゲーション（前の週/次の週）
- ✅ 回答の表示・編集機能
- ✅ 管理者専用の集計レポート生成
- ✅ レスポンシブWebインターフェース

## 技術スタック

- **フロントエンド**: HTML5, CSS3, TypeScript → JavaScript
- **バックエンド**: AWS Lambda（Node.js 18.x）、TypeScript
- **データストア**: Amazon DynamoDB
- **認証**: JWT
- **デプロイ**: AWS SAM
- **テスト**: Jest、fast-check（プロパティベーステスト）

## クイックスタート

### 前提条件

以下のツールがインストールされていることを確認してください：

- [AWS CLI](https://aws.amazon.com/cli/) (v2.x以上)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (v1.x以上)
- [Node.js](https://nodejs.org/) (v18.x以上)
- [npm](https://www.npmjs.com/) (v9.x以上)

### インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd teamviewer-survey-app

# 依存関係のインストール
npm install
```

### デプロイ

#### 方法1: 自動デプロイ（推奨）

完全なデプロイフローを自動実行：

```bash
# 初回デプロイ（ガイド付き）
npm run deploy:full:guided

# 2回目以降のデプロイ
npm run deploy:full
```

#### 方法2: 手動デプロイ

段階的にデプロイを実行：

```bash
# 1. デプロイ前の検証
npm run deploy:validate

# 2. SSMパラメータの設定
npm run deploy:setup

# 3. ビルドとデプロイ
npm run deploy:guided  # 初回
npm run deploy         # 2回目以降
```

詳細なデプロイ手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

## 開発

### ビルド

```bash
# Lambda関数のビルド
npm run build

# フロントエンドのビルド
npm run build:frontend

# 両方をビルド
npm run build:all
```

### テスト

```bash
# すべてのテストを実行
npm test

# プロパティベーステストのみ
npm run test:property

# カバレッジレポート付き
npm run test:coverage

# パフォーマンステスト（デプロイ後に実行）
API_ENDPOINT=https://your-api-gateway-url npm run test:performance
```

パフォーマンステストの詳細は [PERFORMANCE_TEST.md](./PERFORMANCE_TEST.md) を参照してください。

### コード品質

```bash
# ESLintでコードをチェック
npm run lint

# ビルド成果物を削除
npm run clean
```

## プロジェクト構造

```
teamviewer-survey-app/
├── src/
│   ├── lambda/              # Lambda関数
│   │   ├── auth/           # 認証Lambda
│   │   ├── survey/         # アンケートLambda
│   │   └── report/         # レポートLambda
│   ├── types/              # TypeScript型定義
│   ├── utils/              # ユーティリティ関数
│   └── frontend/           # フロントエンドコード
├── scripts/                # デプロイスクリプト
│   ├── deploy.sh          # 完全デプロイ（Bash）
│   ├── deploy.ps1         # 完全デプロイ（PowerShell）
│   ├── validate.sh        # 検証スクリプト（Bash）
│   ├── validate.ps1       # 検証スクリプト（PowerShell）
│   ├── setup-ssm-parameters.sh    # SSM設定（Bash）
│   └── setup-ssm-parameters.ps1   # SSM設定（PowerShell）
├── template.yaml          # AWS SAMテンプレート
├── package.json
├── tsconfig.json
├── DEPLOYMENT.md          # 詳細なデプロイガイド
└── README.md
```

## デプロイされるリソース

### Lambda関数

- **AuthFunction**: 認証処理（`/auth/login`）
- **SurveyFunction**: アンケート回答の保存・取得（`/survey`）
- **ReportFunction**: 集計レポート生成（`/report`）

### DynamoDBテーブル

- **SessionsTable**: セッション管理（TTL有効）
- **ResponsesTable**: アンケート回答データ

### API Gateway

- `POST /auth/login` - 認証
- `GET /survey` - 回答取得
- `POST /survey` - 回答送信
- `GET /report` - レポート生成（管理者専用）

## ログの確認

```bash
# 各Lambda関数のログを確認
npm run logs:auth      # 認証Lambda
npm run logs:survey    # アンケートLambda
npm run logs:report    # レポートLambda
npm run logs:all       # すべてのLambda
```

## トラブルシューティング

問題が発生した場合は、以下を実行してください：

```bash
# デプロイ前の環境検証
npm run deploy:validate
```

詳細なトラブルシューティング方法は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

## コスト見積もり

AWS Lambda無料枠内で動作するように設計されています：

- **Lambda**: 月間100万リクエスト、40万GB秒まで無料
- **DynamoDB**: 月間25GBのストレージ、25ユニットの読み書きキャパシティまで無料
- **API Gateway**: 月間100万APIコールまで無料（最初の12ヶ月）

20〜25名の利用であれば、無料枠内で運用可能です。

## セキュリティ

- すべての通信はHTTPS経由
- DynamoDBテーブルは暗号化済み
- パスワードはSSM Parameter Store（SecureString）で管理
- IAMロールは最小権限の原則に従って設定

## ライセンス

MIT

## サポート

問題や質問がある場合は、[DEPLOYMENT.md](./DEPLOYMENT.md)のトラブルシューティングセクションを参照してください。
