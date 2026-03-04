# TeamViewer Survey App - デプロイガイド

このドキュメントでは、TeamViewerアンケートアプリケーションをAWS環境にデプロイする手順を説明します。

## 前提条件

以下のツールがインストールされていることを確認してください：

- [AWS CLI](https://aws.amazon.com/cli/) (v2.x以上)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (v1.x以上)
- [Node.js](https://nodejs.org/) (v18.x以上)
- [npm](https://www.npmjs.com/) (v9.x以上)

## デプロイ手順

### クイックスタート（推奨）

完全なデプロイフローを自動実行するスクリプトを用意しています：

**Windows (PowerShell):**
```powershell
# 初回デプロイ（ガイド付き）
npm run deploy:full:guided

# 2回目以降のデプロイ
npm run deploy:full
```

**Linux/Mac (Bash):**
```bash
# 初回デプロイ（ガイド付き）
npm run deploy:full:guided

# 2回目以降のデプロイ
npm run deploy:full
```

このスクリプトは以下を自動的に実行します：
1. 依存関係のインストール確認
2. TypeScriptのビルド
3. SSMパラメータの確認と設定
4. SAMテンプレートの検証
5. SAMビルドとデプロイ
6. デプロイ結果の表示

### 手動デプロイ手順

段階的にデプロイを実行したい場合は、以下の手順に従ってください。

### 1. 依存関係のインストール

```bash
npm install
```

### 2. TypeScriptのビルド

```bash
# Lambda関数とフロントエンドの両方をビルド
npm run build:all

# または個別にビルド
npm run build              # Lambda関数のみ
npm run build:frontend     # フロントエンドのみ
```

このコマンドは以下を実行します：
- Lambda関数のTypeScriptコードをJavaScriptにトランスパイル
- `dist/lambda/` ディレクトリに出力
- フロントエンドのTypeScriptもJavaScriptにトランスパイル
- `dist/frontend/` ディレクトリに出力

### 3. デプロイ前の検証（オプション）

デプロイ前に環境を検証することをお勧めします：

**Windows (PowerShell):**
```powershell
npm run deploy:validate
```

**Linux/Mac (Bash):**
```bash
npm run deploy:validate
```

このスクリプトは以下を確認します：
- 必要なツール（AWS CLI、SAM CLI、Node.js、npm）のインストール
- AWS認証情報の有効性
- 必要なファイルの存在
- 依存関係のインストール状況
- TypeScriptのコンパイル
- SAMテンプレートの妥当性
- SSMパラメータの設定状況
- テストの実行

### 4. SSMパラメータの設定

AWS Systems Manager Parameter Storeにパスワードを設定します：

**Windows (PowerShell):**
```powershell
npm run deploy:setup
```

**Linux/Mac (Bash):**
```bash
npm run deploy:setup
```

プロンプトに従って以下を入力してください：
- **共通パスワード**: 社員がログインする際に使用するパスワード
- **管理者パスワード**: 管理者（karimata@okijoh.co.jp）専用のパスワード（デフォルト: Okijoh!admin）

### 5. AWS SAMのビルド

```bash
npm run deploy:build
```

このコマンドは：
- TypeScriptのビルドを実行
- Lambda関数のパッケージングを実行
- 依存関係を `.aws-sam/build/` ディレクトリにコピー

### 6. AWS SAMのデプロイ

初回デプロイの場合（ガイド付き）：

```bash
npm run deploy:guided
```

プロンプトで以下を設定してください：
- **Stack Name**: `teamviewer-survey-app`（デフォルト）
- **AWS Region**: `ap-northeast-1`（東京リージョン）
- **Confirm changes before deploy**: `Y`
- **Allow SAM CLI IAM role creation**: `Y`
- **Save arguments to configuration file**: `Y`

2回目以降のデプロイ：

```bash
npm run deploy
```

### 7. デプロイの確認

デプロイが完了すると、以下の出力が表示されます：

```
Outputs
---------------------------------------------------------
Key                 ApiEndpoint
Description         API Gateway endpoint URL
Value               https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/
---------------------------------------------------------
```

このエンドポイントURLをメモしてください。フロントエンドの設定で使用します。

## デプロイされるリソース

### Lambda関数

1. **AuthFunction** (`/auth/login`)
   - 認証処理
   - メモリ: 512MB
   - タイムアウト: 30秒
   - Runtime: Node.js 18.x

2. **SurveyFunction** (`/survey`)
   - アンケート回答の保存・取得
   - メモリ: 512MB
   - タイムアウト: 30秒
   - Runtime: Node.js 18.x

3. **ReportFunction** (`/report`)
   - 集計レポート生成（管理者専用）
   - メモリ: 512MB
   - タイムアウト: 30秒
   - Runtime: Node.js 18.x

### DynamoDBテーブル

1. **SessionsTable** (`teamviewer-survey-sessions`)
   - セッション管理
   - パーティションキー: `sessionId` (String)
   - TTL有効（`expiresAt`属性）
   - 暗号化: 有効

2. **ResponsesTable** (`teamviewer-survey-responses`)
   - アンケート回答データ
   - パーティションキー: `email` (String)
   - 暗号化: 有効

### API Gateway

- **エンドポイント**:
  - `POST /auth/login` - 認証
  - `GET /survey` - 回答取得
  - `POST /survey` - 回答送信
  - `GET /report` - レポート生成（管理者専用）
- **CORS**: 有効（すべてのオリジンを許可）
- **プロトコル**: HTTPS のみ

### CloudWatch Logs

- 各Lambda関数のログ
- 保持期間: 30日

## 環境変数

以下の環境変数が自動的に設定されます：

| 変数名 | 説明 | 値 |
|--------|------|-----|
| `SESSIONS_TABLE_NAME` | セッションテーブル名 | `teamviewer-survey-sessions` |
| `RESPONSES_TABLE_NAME` | 回答テーブル名 | `teamviewer-survey-responses` |
| `COMMON_PASSWORD` | 共通パスワード | SSMから取得 |
| `ADMIN_PASSWORD` | 管理者パスワード | SSMから取得 |
| `SURVEY_START_DATE` | アンケート開始日 | `2026-03-15` |
| `SURVEY_END_DATE` | アンケート終了日 | `2026-06-27` |
| `NODE_ENV` | 実行環境 | `production` |

### Lambda関数のログ確認

各Lambda関数のログを個別に確認：

```bash
npm run logs:auth      # 認証Lambda
npm run logs:survey    # アンケートLambda
npm run logs:report    # レポートLambda
```

すべてのLambda関数のログを確認：

```bash
npm run logs:all
```

または、AWS CLIを直接使用：

```bash
aws logs tail /aws/lambda/teamviewer-survey-app-AuthFunction --follow
aws logs tail /aws/lambda/teamviewer-survey-app-SurveyFunction --follow
aws logs tail /aws/lambda/teamviewer-survey-app-ReportFunction --follow
```

## 利用可能なnpmスクリプト

### ビルド関連

| スクリプト | 説明 |
|-----------|------|
| `npm run build` | Lambda関数のTypeScriptをビルド |
| `npm run build:frontend` | フロントエンドのTypeScriptをビルド |
| `npm run build:all` | Lambda関数とフロントエンドの両方をビルド |
| `npm run clean` | distディレクトリを削除 |

### テスト関連

| スクリプト | 説明 |
|-----------|------|
| `npm test` | すべてのテストを実行 |
| `npm run test:property` | プロパティベーステストのみ実行 |
| `npm run test:coverage` | カバレッジレポート付きでテスト実行 |
| `npm run lint` | ESLintでコードをチェック |

### デプロイ関連

| スクリプト | 説明 |
|-----------|------|
| `npm run deploy:setup` | SSMパラメータを設定 |
| `npm run deploy:validate` | デプロイ前の環境検証 |
| `npm run deploy:build` | ビルドとSAMビルドを実行 |
| `npm run deploy` | 通常デプロイ |
| `npm run deploy:guided` | ガイド付きデプロイ（初回推奨） |
| `npm run deploy:full` | 完全なデプロイフローを自動実行 |
| `npm run deploy:full:guided` | 完全なデプロイフロー（ガイド付き） |

### ログ確認関連

| スクリプト | 説明 |
|-----------|------|
| `npm run logs:auth` | 認証Lambdaのログを表示 |
| `npm run logs:survey` | アンケートLambdaのログを表示 |
| `npm run logs:report` | レポートLambdaのログを表示 |
| `npm run logs:all` | すべてのLambdaのログを表示 |

## デプロイスクリプトの詳細

### 完全デプロイスクリプト

`scripts/deploy.sh` (Linux/Mac) または `scripts/deploy.ps1` (Windows) は、以下のステップを自動実行します：

1. **依存関係のインストール確認**: node_modulesが存在しない場合、npm installを実行
2. **TypeScriptのビルド**: Lambda関数とフロントエンドをビルド
3. **SSMパラメータの確認**: パスワードが設定されているか確認し、未設定の場合は設定を促す
4. **SAMテンプレートの検証**: template.yamlの妥当性を確認
5. **SAMビルド**: Lambda関数をパッケージング
6. **SAMデプロイ**: AWSにデプロイ
7. **デプロイ結果の表示**: API Endpointとログ確認方法を表示

### 検証スクリプト

`scripts/validate.sh` (Linux/Mac) または `scripts/validate.ps1` (Windows) は、以下を検証します：

1. **必要なツールの確認**: AWS CLI、SAM CLI、Node.js、npmのインストール状況
2. **AWS認証情報の確認**: AWS CLIの認証情報が有効かどうか
3. **必要なファイルの確認**: package.json、tsconfig.json、template.yaml等の存在
4. **依存関係の確認**: node_modulesと主要なパッケージのインストール状況
5. **TypeScriptのコンパイル確認**: ビルドが成功するかどうか
6. **SAMテンプレートの検証**: template.yamlの妥当性
7. **SSMパラメータの確認**: パスワードが設定されているかどうか
8. **テストの実行**: すべてのテストが成功するかどうか

## トラブルシューティング

### デプロイエラー: "Parameter does not exist"

SSMパラメータが設定されていない可能性があります。以下を実行してください：

```bash
npm run deploy:setup
```

### デプロイエラー: "Insufficient permissions"

AWS CLIの認証情報に適切な権限があることを確認してください。必要な権限：
- Lambda関数の作成・更新
- DynamoDBテーブルの作成
- API Gatewayの作成
- IAMロールの作成
- CloudWatch Logsの作成
- SSMパラメータの読み取り

### ビルドエラー: TypeScriptのコンパイルに失敗

依存関係が正しくインストールされているか確認してください：

```bash
npm install
npm run build
```

### デプロイ前の環境確認

デプロイ前に環境を検証することをお勧めします：

```bash
npm run deploy:validate
```

このスクリプトは、デプロイに必要なすべての要件をチェックし、問題があれば具体的な修正方法を提示します。

### Lambda関数のログ確認

```bash
npm run logs:auth
npm run logs:survey
npm run logs:report
```

または、AWS CLIを直接使用：

```bash
aws logs tail /aws/lambda/teamviewer-survey-app-AuthFunction --follow
aws logs tail /aws/lambda/teamviewer-survey-app-SurveyFunction --follow
aws logs tail /aws/lambda/teamviewer-survey-app-ReportFunction --follow
```

### Windows環境での注意事項

Windows環境では、PowerShellスクリプト（.ps1）が自動的に使用されます。実行ポリシーの設定が必要な場合があります：

```powershell
# 実行ポリシーの確認
Get-ExecutionPolicy

# 実行ポリシーの変更（管理者権限が必要）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

または、スクリプトを直接実行：

```powershell
# デプロイ前の検証
.\scripts\validate.ps1

# 完全デプロイ（ガイド付き）
.\scripts\deploy.ps1 -Guided

# 完全デプロイ（通常）
.\scripts\deploy.ps1

# SSMパラメータ設定
.\scripts\setup-ssm-parameters.ps1
```

## スタックの削除

アプリケーションを削除する場合：

```bash
sam delete --stack-name teamviewer-survey-app
```

**注意**: DynamoDBテーブルのデータも削除されます。必要に応じてバックアップを取得してください。

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

## サポート

問題が発生した場合は、以下の手順で診断してください：

1. **デプロイ前の検証を実行**:
   ```bash
   npm run deploy:validate
   ```

2. **CloudWatch Logsを確認**:
   ```bash
   npm run logs:auth
   npm run logs:survey
   npm run logs:report
   ```

3. **SAMテンプレートの検証**:
   ```bash
   sam validate
   ```

4. **ビルドログの確認**:
   ```bash
   npm run build
   ```

5. **テストの実行**:
   ```bash
   npm test
   ```

## 参考リンク

- [AWS SAM CLI ドキュメント](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
- [Amazon DynamoDB ドキュメント](https://docs.aws.amazon.com/dynamodb/)
- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)

