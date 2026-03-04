# パフォーマンステストガイド

## 概要

このドキュメントでは、TeamViewerアンケートアプリケーションのパフォーマンステストの実行方法について説明します。

## テスト対象

パフォーマンステストは以下の要件を検証します：

- **要件 7.1**: AWS Lambdaの1GBメモリ制限内で実行
- **要件 7.2**: 各リクエストを30秒以内に完了
- **要件 7.5**: 20〜25名の同時アクセスを処理
- **要件 6.6**: レポート生成を10秒以内に完了

## テストシナリオ

### 1. 20名の同時ログインテスト

20名のユーザーが同時にログインするシナリオをシミュレートします。

**合格基準**: 各リクエストが30秒以内に完了すること

### 2. 25名の同時回答送信テスト

25名のユーザーが同時にアンケート回答を送信するシナリオをシミュレートします。

**合格基準**: 各リクエストが30秒以内に完了すること

### 3. レポート生成の応答時間測定

管理者がレポートを生成する際の応答時間を測定します。

**合格基準**: レポート生成が10秒以内に完了すること

### 4. コールドスタート時間測定

Lambda関数のコールドスタート時間を測定します。

**合格基準**: コールドスタートが5秒未満であること

## 前提条件

パフォーマンステストを実行する前に、以下の準備が必要です：

1. **アプリケーションのデプロイ**
   ```bash
   npm run deploy:full
   ```

2. **API Gatewayエンドポイントの取得**
   
   デプロイ完了後、CloudFormationの出力からAPI Gatewayのエンドポイントを取得します：
   
   ```bash
   aws cloudformation describe-stacks \
     --stack-name teamviewer-survey-app \
     --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
     --output text
   ```

3. **環境変数の設定**
   
   `.env`ファイルを作成し、以下の環境変数を設定します：
   
   ```bash
   API_ENDPOINT=https://your-api-gateway-url
   COMMON_PASSWORD=teamviewer2026!
   ADMIN_PASSWORD=Okijoh!admin
   ```

## テストの実行

### 基本的な実行方法

```bash
# 環境変数を設定してテストを実行
API_ENDPOINT=https://your-api-gateway-url npm run test:performance
```

### Windowsの場合

PowerShellを使用する場合：

```powershell
$env:API_ENDPOINT="https://your-api-gateway-url"
npm run test:performance
```

コマンドプロンプトを使用する場合：

```cmd
set API_ENDPOINT=https://your-api-gateway-url
npm run test:performance
```

### .envファイルを使用する場合

プロジェクトルートに`.env`ファイルを作成し、以下の内容を記述します：

```env
API_ENDPOINT=https://your-api-gateway-url
COMMON_PASSWORD=teamviewer2026!
ADMIN_PASSWORD=Okijoh!admin
```

その後、dotenvを使用してテストを実行します：

```bash
# dotenvをインストール（まだの場合）
npm install --save-dev dotenv-cli

# テストを実行
npx dotenv -e .env npm run test:performance
```

## テスト結果の見方

テスト実行後、以下のような結果が表示されます：

```
📊 20名同時ログインテスト結果:
   成功: 20/20
   失敗: 0/20
   合計時間: 3.45秒
   平均応答時間: 1.23秒
   最大応答時間: 2.15秒
   最小応答時間: 0.89秒

📊 25名同時回答送信テスト結果:
   成功: 25/25
   失敗: 0/25
   合計時間: 4.67秒
   平均応答時間: 1.56秒
   最大応答時間: 2.89秒
   最小応答時間: 1.02秒

📊 レポート生成テスト結果:
   平均応答時間: 2.34秒
   最大応答時間: 2.78秒
   最小応答時間: 1.98秒

📊 コールドスタート測定結果:
   初回リクエスト: 3.45秒
   2回目リクエスト: 1.23秒
   差分: 2.22秒
```

## トラブルシューティング

### API_ENDPOINTが未設定の場合

テストがスキップされます：

```
⚠️  API_ENDPOINTが設定されていないため、パフォーマンステストをスキップします
   実行するには: API_ENDPOINT=https://your-api-url npm run test:performance
```

この場合、環境変数を設定してから再実行してください。

### 認証エラーが発生する場合

パスワードが正しく設定されているか確認してください：

```bash
# SSMパラメータの確認
aws ssm get-parameter --name /teamviewer-survey/common-password --with-decryption
aws ssm get-parameter --name /teamviewer-survey/admin-password --with-decryption
```

環境変数のパスワードとSSMパラメータのパスワードが一致している必要があります。

### タイムアウトエラーが発生する場合

Lambda関数のメモリやタイムアウト設定を確認してください：

```yaml
# template.yamlで設定を確認
Timeout: 30
MemorySize: 1024
```

### コールドスタート測定が不正確な場合

コールドスタートを正確に測定するには、Lambda関数が一定時間（5〜10分）アイドル状態である必要があります。

以下のコマンドでLambda関数を手動で停止できます：

```bash
# Lambda関数の同時実行数を0に設定（一時的に無効化）
aws lambda put-function-concurrency \
  --function-name teamviewer-survey-app-AuthFunction \
  --reserved-concurrent-executions 0

# 5分待機

# 同時実行数の制限を解除
aws lambda delete-function-concurrency \
  --function-name teamviewer-survey-app-AuthFunction
```

## CI/CDでの実行

GitHub ActionsなどのCI/CDパイプラインでパフォーマンステストを実行する場合の例：

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 0 * * 0'  # 毎週日曜日に実行
  workflow_dispatch:

jobs:
  performance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        env:
          API_ENDPOINT: ${{ secrets.API_ENDPOINT }}
          COMMON_PASSWORD: ${{ secrets.COMMON_PASSWORD }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
        run: npm run test:performance
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: performance-test-results
          path: test-results/
```

## ベストプラクティス

1. **定期的な実行**: パフォーマンステストは定期的に実行し、パフォーマンスの劣化を早期に検出します。

2. **本番環境に近い環境でテスト**: 可能な限り本番環境に近い設定でテストを実行します。

3. **結果の記録**: テスト結果を記録し、時系列でパフォーマンスの変化を追跡します。

4. **負荷の段階的増加**: 最初は少ない同時接続数から始め、徐々に増やしていきます。

5. **クリーンアップ**: テスト後は、テスト用に作成したデータをクリーンアップします。

## 注意事項

- パフォーマンステストは実際のAPIエンドポイントに対して実行されるため、DynamoDBにテストデータが保存されます。
- テスト実行後、必要に応じてテストデータをクリーンアップしてください。
- 本番環境でパフォーマンステストを実行する場合は、ユーザーへの影響を考慮してください。
- AWS Lambda無料枠の制限に注意してください（月間100万リクエスト、40万GB秒）。

## 参考資料

- [AWS Lambda制限](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [AWS Lambda無料枠](https://aws.amazon.com/lambda/pricing/)
- [Jest設定ドキュメント](https://jestjs.io/docs/configuration)
