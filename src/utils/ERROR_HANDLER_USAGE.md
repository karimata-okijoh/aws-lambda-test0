# グローバルエラーハンドラー使用ガイド

## 概要

`errorHandler.ts`は、TeamViewerアンケートアプリケーションの統一的なエラーハンドリング機能を提供します。

## 主な機能

1. **エラー分類ロジック**: エラーを5つのカテゴリ（AUTH、VAL、DB、PERIOD、SYS）に自動分類
2. **エラーログフォーマット**: CloudWatch Logsに構造化ログとして記録
3. **ユーザーフレンドリーなエラーレスポンス**: 適切なHTTPステータスコードとメッセージを生成
4. **成功ログの記録**: 監査目的で成功した操作をログに記録

## エラーコード体系

### 認証エラー (AUTH_001 - AUTH_005)
- `AUTH_001`: 無効なドメイン
- `AUTH_002`: パスワード不一致
- `AUTH_003`: トークン期限切れ
- `AUTH_004`: トークン不正
- `AUTH_005`: 権限不足

### 入力検証エラー (VAL_001 - VAL_003)
- `VAL_001`: 必須フィールド未入力
- `VAL_002`: 不正な形式
- `VAL_003`: 危険な文字列検出

### データストアエラー (DB_001 - DB_004)
- `DB_001`: 接続エラー
- `DB_002`: 保存失敗
- `DB_003`: 取得失敗
- `DB_004`: タイムアウト

### 期間制約エラー (PERIOD_001 - PERIOD_002)
- `PERIOD_001`: 開始前アクセス
- `PERIOD_002`: 終了後アクセス

### システムエラー (SYS_001 - SYS_003)
- `SYS_001`: Lambda関数エラー
- `SYS_002`: メモリ不足
- `SYS_003`: 予期しないエラー

## 使用方法

### 1. Lambda関数での基本的な使用

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { globalErrorHandler, AppError, logSuccess } from '../utils/errorHandler';
import { ErrorCode } from '../types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // ビジネスロジック
    
    // 検証エラーの場合
    if (!isValid) {
      throw new AppError(ErrorCode.VAL_001);
    }
    
    // 成功ログの記録
    logSuccess('operation_name', {
      userId: 'user@okijoh.co.jp',
      additionalContext: 'value'
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true })
    };
    
  } catch (error) {
    // グローバルエラーハンドラーを使用
    return await globalErrorHandler(
      error instanceof AppError ? error.errorCode : (error as Error),
      {
        requestId: event.requestContext?.requestId,
        functionName: 'YourLambdaName',
        userId: 'user@okijoh.co.jp'
      }
    );
  }
};
```

### 2. カスタムエラーの作成

```typescript
import { AppError } from '../utils/errorHandler';
import { ErrorCode } from '../types';

// エラーコードのみ指定
throw new AppError(ErrorCode.AUTH_001);

// カスタムメッセージを指定
throw new AppError(ErrorCode.VAL_002, 'カスタムエラーメッセージ');
```

### 3. エラー分類の使用

```typescript
import { classifyError } from '../utils/errorHandler';
import { ErrorCode } from '../types';

// エラーコードから分類
const errorInfo = classifyError(ErrorCode.DB_002);
console.log(errorInfo.type); // 'DataStoreError'
console.log(errorInfo.httpStatus); // 500
console.log(errorInfo.userMessage); // '回答の保存に失敗しました。再度お試しください'

// Errorオブジェクトから分類
try {
  // 何らかの処理
} catch (error) {
  const errorInfo = classifyError(error as Error, {
    userId: 'user@okijoh.co.jp',
    operation: 'save'
  });
}
```

### 4. ログ記録

```typescript
import { logSuccess, logErrorWithCode, logTimeout } from '../utils/errorHandler';

// 成功ログ（要件: 10.2）
logSuccess('survey_submission', {
  userId: 'user@okijoh.co.jp',
  responseCount: 7
});

// エラーログ（要件: 10.1）
const errorInfo = classifyError(ErrorCode.DB_002);
logErrorWithCode(errorInfo, error, {
  requestId: 'abc123',
  functionName: 'SurveyLambda',
  userId: 'user@okijoh.co.jp',
  retryCount: 3
});

// タイムアウトログ（要件: 10.3）
logTimeout('SurveyLambda', {
  requestId: 'abc123',
  userId: 'user@okijoh.co.jp',
  operation: 'save_response'
});
```

### 5. エラーレスポンスの生成

```typescript
import { createErrorResponse, classifyError } from '../utils/errorHandler';
import { ErrorCode } from '../types';

const errorInfo = classifyError(ErrorCode.AUTH_001);
const response = createErrorResponse(errorInfo);

// レスポンス形式:
// {
//   success: false,
//   errorCode: 'AUTH_001',
//   message: 'このアンケートは社内メンバー専用です',
//   timestamp: '2026-03-03T10:30:45.123Z'
// }
```

## ログフォーマット

すべてのエラーログは以下の形式でCloudWatch Logsに記録されます：

```json
{
  "timestamp": "2026-03-03T10:30:45.123Z",
  "level": "ERROR",
  "errorCode": "DB_002",
  "message": "Failed to save survey response",
  "context": {
    "errorType": "DataStoreError",
    "requestId": "abc123-def456",
    "functionName": "SurveyLambda",
    "userId": "user@okijoh.co.jp",
    "retryCount": 3
  },
  "stackTrace": "Error: DB_002: Save failed\n    at ..."
}
```

成功ログの形式：

```json
{
  "timestamp": "2026-03-03T10:30:45.123Z",
  "level": "INFO",
  "message": "Operation successful: survey_submission",
  "context": {
    "userId": "user@okijoh.co.jp",
    "responseCount": 7
  }
}
```

## 実装例

### auth.ts での使用例

```typescript
// ドメイン検証エラー
if (!isValidDomain(email)) {
  throw new AppError(ErrorCode.AUTH_001);
}

// パスワード検証エラー
if (!isValidPassword(password)) {
  throw new AppError(ErrorCode.AUTH_002);
}

// 成功ログ
logSuccess('authentication', {
  email,
  role: 'user'
});
```

### survey.ts での使用例

```typescript
// 期間チェックエラー
if (currentDate < surveyStartDate) {
  throw new AppError(ErrorCode.PERIOD_001);
}

if (currentDate > surveyEndDate) {
  throw new AppError(ErrorCode.PERIOD_002);
}

// 入力検証エラー
if (!hasAllTimeSlots(responses)) {
  throw new AppError(ErrorCode.VAL_001);
}

// データベース保存エラー
try {
  await saveResponse(data);
} catch (error) {
  throw new AppError(ErrorCode.DB_002);
}

// 成功ログ
logSuccess('survey_submission', {
  userId: email,
  responseCount: Object.keys(responses).length
});
```

### report.ts での使用例

```typescript
// 権限チェックエラー
if (role !== 'admin') {
  throw new AppError(ErrorCode.AUTH_005);
}

// データ取得エラー
try {
  const responses = await getAllResponses();
} catch (error) {
  throw new AppError(ErrorCode.DB_003);
}

// 成功ログ
logSuccess('report_generation', {
  userId: email,
  totalResponses: responses.length
});
```

## テスト

エラーハンドラーのテストは `src/utils/__tests__/errorHandler.test.ts` にあります。

```bash
# エラーハンドラーのテストを実行
npm test -- src/utils/__tests__/errorHandler.test.ts
```

## 要件との対応

- **要件 10.1**: エラーログの記録（タイムスタンプ、エラータイプ、コンテキスト情報）
- **要件 10.2**: 成功ログの記録（監査目的）
- **要件 10.3**: タイムアウトログの記録

## 注意事項

1. すべてのLambda関数で`globalErrorHandler`を使用してください
2. エラーコードは`ErrorCode`列挙型から選択してください
3. 成功した操作には必ず`logSuccess`を呼び出してください
4. コンテキスト情報には個人情報を含めないでください（メールアドレスは可）
5. パスワードやトークンをログに記録しないでください
