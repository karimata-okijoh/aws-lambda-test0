# TeamViewerアンケートアプリケーション

社内でのTeamViewer利用状況を収集・集計するためのサーバーレスWebアプリケーションです。

## 概要

- **アンケート期間**: 2026年3月15日～2026年6月27日
- **対象ユーザー**: @okijoh.co.jpドメインの20〜25名
- **管理者**: karimata@okijoh.co.jp

## 技術スタック

- **バックエンド**: AWS Lambda（Node.js 18.x）、TypeScript
- **フロントエンド**: HTML5、CSS3、TypeScript → JavaScript
- **データストア**: Amazon DynamoDB
- **認証**: JWT
- **テスト**: Jest、fast-check

## プロジェクト構造

```
.
├── src/
│   ├── lambda/          # Lambda関数
│   │   ├── auth.ts      # 認証Lambda
│   │   ├── survey.ts    # アンケートLambda
│   │   └── report.ts    # レポートLambda
│   ├── types/           # 型定義
│   │   └── index.ts     # コア型定義
│   └── utils/           # ユーティリティ
│       ├── constants.ts # 定数
│       ├── logger.ts    # ロギング
│       └── validators.ts # 入力検証
├── frontend/
│   ├── src/             # フロントエンドTypeScript
│   │   ├── login.ts     # ログインページ
│   │   ├── survey.ts    # アンケートページ
│   │   └── admin.ts     # 管理者ダッシュボード
│   ├── styles/          # CSS
│   │   └── main.css
│   ├── index.html       # ログインページ
│   ├── survey.html      # アンケートページ
│   └── admin.html       # 管理者ダッシュボード
├── package.json
├── tsconfig.json
├── tsconfig.frontend.json
└── jest.config.js
```

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### ビルド

```bash
# バックエンドのビルド
npm run build

# フロントエンドのビルド
npm run build:frontend
```

### テスト

```bash
# すべてのテストを実行
npm test

# プロパティベーステストのみ実行
npm run test:property

# カバレッジレポート生成
npm run test:coverage
```

### リント

```bash
npm run lint
```

## 環境変数

以下の環境変数を設定してください：

- `COMMON_PASSWORD`: 共通パスワード
- `ADMIN_PASSWORD`: 管理者パスワード
- `JWT_SECRET`: JWT署名用シークレット
- `SURVEY_START_DATE`: アンケート開始日（2026-03-15）
- `SURVEY_END_DATE`: アンケート終了日（2026-06-27）
- `DYNAMODB_SESSIONS_TABLE`: Sessionsテーブル名
- `DYNAMODB_RESPONSES_TABLE`: Responsesテーブル名

## 実装状況

- [x] タスク1: プロジェクト構造とコア型定義のセットアップ
- [ ] タスク2: 認証Lambda関数の実装
- [ ] タスク3: DynamoDBテーブル定義とデータアクセス層の実装
- [ ] タスク4: アンケートLambda関数の実装
- [ ] タスク5: チェックポイント - バックエンドの動作確認
- [ ] タスク6: レポートLambda関数の実装
- [ ] タスク7: エラーハンドリングとロギングの実装
- [ ] タスク8: フロントエンド - ログインページの実装
- [ ] タスク9: フロントエンド - アンケートページの実装
- [ ] タスク10: フロントエンド - 管理者ダッシュボードの実装
- [ ] タスク11: チェックポイント - フロントエンドの動作確認
- [ ] タスク12: インフラストラクチャとデプロイ設定
- [ ] タスク13: 統合テストとエンドツーエンドテスト
- [ ] タスク14: 最終チェックポイント - 全体の動作確認

## ライセンス

MIT
