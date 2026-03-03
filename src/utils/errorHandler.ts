// グローバルエラーハンドラー
// タスク7.1: エラー分類ロジック、エラーログフォーマット、CloudWatch Logsへのログ記録、ユーザーフレンドリーなエラーレスポンス生成
// 要件: 10.1, 10.2, 10.3

import { ErrorCode, ErrorResponse } from '../types';
import { log, LogLevel } from './logger';
import { HTTP_STATUS } from './constants';

/**
 * エラータイプ
 */
export enum ErrorType {
  AuthenticationError = 'AuthenticationError',
  ValidationError = 'ValidationError',
  DataStoreError = 'DataStoreError',
  PeriodConstraintError = 'PeriodConstraintError',
  SystemError = 'SystemError'
}

/**
 * エラー情報
 */
export interface ErrorInfo {
  code: ErrorCode;
  type: ErrorType;
  httpStatus: number;
  userMessage: string;
  context?: Record<string, unknown>;
}

/**
 * エラーコードとHTTPステータス、ユーザーメッセージのマッピング
 */
const ERROR_MAPPINGS: Record<ErrorCode, { type: ErrorType; httpStatus: number; userMessage: string }> = {
  // 認証エラー (AUTH_001 - AUTH_005)
  [ErrorCode.AUTH_001]: {
    type: ErrorType.AuthenticationError,
    httpStatus: HTTP_STATUS.FORBIDDEN,
    userMessage: 'このアンケートは社内メンバー専用です'
  },
  [ErrorCode.AUTH_002]: {
    type: ErrorType.AuthenticationError,
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    userMessage: 'メールアドレスまたはパスワードが正しくありません'
  },
  [ErrorCode.AUTH_003]: {
    type: ErrorType.AuthenticationError,
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    userMessage: 'セッションが期限切れです。再度ログインしてください'
  },
  [ErrorCode.AUTH_004]: {
    type: ErrorType.AuthenticationError,
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    userMessage: '無効な認証情報です'
  },
  [ErrorCode.AUTH_005]: {
    type: ErrorType.AuthenticationError,
    httpStatus: HTTP_STATUS.FORBIDDEN,
    userMessage: 'この機能にアクセスする権限がありません'
  },

  // 入力検証エラー (VAL_001 - VAL_003)
  [ErrorCode.VAL_001]: {
    type: ErrorType.ValidationError,
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    userMessage: 'すべての時間帯について回答を選択してください'
  },
  [ErrorCode.VAL_002]: {
    type: ErrorType.ValidationError,
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    userMessage: '入力形式が正しくありません'
  },
  [ErrorCode.VAL_003]: {
    type: ErrorType.ValidationError,
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    userMessage: '入力内容に使用できない文字が含まれています'
  },

  // データストアエラー (DB_001 - DB_004)
  [ErrorCode.DB_001]: {
    type: ErrorType.DataStoreError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: '一時的なエラーが発生しました。しばらくしてから再度お試しください'
  },
  [ErrorCode.DB_002]: {
    type: ErrorType.DataStoreError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: '回答の保存に失敗しました。再度お試しください'
  },
  [ErrorCode.DB_003]: {
    type: ErrorType.DataStoreError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: 'データの取得に失敗しました'
  },
  [ErrorCode.DB_004]: {
    type: ErrorType.DataStoreError,
    httpStatus: HTTP_STATUS.GATEWAY_TIMEOUT,
    userMessage: '処理がタイムアウトしました。再度お試しください'
  },

  // 期間制約エラー (PERIOD_001 - PERIOD_002)
  [ErrorCode.PERIOD_001]: {
    type: ErrorType.PeriodConstraintError,
    httpStatus: HTTP_STATUS.FORBIDDEN,
    userMessage: 'アンケートはまだ開始されていません（開始日: 2026年3月15日）'
  },
  [ErrorCode.PERIOD_002]: {
    type: ErrorType.PeriodConstraintError,
    httpStatus: HTTP_STATUS.FORBIDDEN,
    userMessage: 'アンケートは終了しました（終了日: 2026年6月27日）'
  },

  // システムエラー (SYS_001 - SYS_003)
  [ErrorCode.SYS_001]: {
    type: ErrorType.SystemError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: 'システムエラーが発生しました'
  },
  [ErrorCode.SYS_002]: {
    type: ErrorType.SystemError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: 'システムエラーが発生しました'
  },
  [ErrorCode.SYS_003]: {
    type: ErrorType.SystemError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: '予期しないエラーが発生しました'
  }
};

/**
 * エラー分類ロジック
 * エラーオブジェクトまたはエラーコードからエラー情報を生成
 * 要件: 10.1
 */
export const classifyError = (
  error: Error | ErrorCode,
  context?: Record<string, unknown>
): ErrorInfo => {
  // ErrorCodeが直接渡された場合
  if (typeof error === 'string' && error in ERROR_MAPPINGS) {
    const mapping = ERROR_MAPPINGS[error as ErrorCode];
    return {
      code: error as ErrorCode,
      type: mapping.type,
      httpStatus: mapping.httpStatus,
      userMessage: mapping.userMessage,
      context
    };
  }

  // Errorオブジェクトの場合、エラーメッセージからエラーコードを抽出
  if (error instanceof Error) {
    // エラーメッセージにエラーコードが含まれている場合
    const errorCodeMatch = error.message.match(/^(AUTH|VAL|DB|PERIOD|SYS)_\d{3}/);
    if (errorCodeMatch) {
      const errorCode = errorCodeMatch[0] as ErrorCode;
      if (errorCode in ERROR_MAPPINGS) {
        const mapping = ERROR_MAPPINGS[errorCode];
        return {
          code: errorCode,
          type: mapping.type,
          httpStatus: mapping.httpStatus,
          userMessage: mapping.userMessage,
          context
        };
      }
    }

    // エラー名からエラータイプを推測
    if (error.name === 'ValidationError') {
      return {
        code: ErrorCode.VAL_002,
        type: ErrorType.ValidationError,
        httpStatus: HTTP_STATUS.BAD_REQUEST,
        userMessage: '入力形式が正しくありません',
        context
      };
    }

    if (error.name === 'TimeoutError') {
      return {
        code: ErrorCode.DB_004,
        type: ErrorType.DataStoreError,
        httpStatus: HTTP_STATUS.GATEWAY_TIMEOUT,
        userMessage: '処理がタイムアウトしました。再度お試しください',
        context
      };
    }

    // DynamoDBエラー
    if (error.name.includes('DynamoDB') || error.message.includes('DynamoDB')) {
      return {
        code: ErrorCode.DB_001,
        type: ErrorType.DataStoreError,
        httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        userMessage: '一時的なエラーが発生しました。しばらくしてから再度お試しください',
        context
      };
    }
  }

  // デフォルト: 予期しないエラー
  return {
    code: ErrorCode.SYS_003,
    type: ErrorType.SystemError,
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    userMessage: '予期しないエラーが発生しました',
    context
  };
};

/**
 * エラーログの記録
 * CloudWatch Logsに構造化ログとして記録
 * 要件: 10.1, 10.3
 */
export const logErrorWithCode = (
  errorInfo: ErrorInfo,
  error: Error | null,
  requestContext?: {
    requestId?: string;
    functionName?: string;
    userId?: string;
    retryCount?: number;
  }
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    errorCode: errorInfo.code,
    message: error?.message || errorInfo.userMessage,
    context: {
      errorType: errorInfo.type,
      ...requestContext,
      ...errorInfo.context
    },
    stackTrace: error?.stack
  });
};

/**
 * 成功ログの記録
 * 監査目的ですべての成功した回答送信をログに記録
 * 要件: 10.2
 */
export const logSuccess = (
  operation: string,
  context?: Record<string, unknown>
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: `Operation successful: ${operation}`,
    context
  });
};

/**
 * タイムアウトログの記録
 * Lambda関数のタイムアウト発生時にログを記録
 * 要件: 10.3
 */
export const logTimeout = (
  functionName: string,
  requestDetails: Record<string, unknown>
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    errorCode: ErrorCode.DB_004,
    message: `Lambda function timeout: ${functionName}`,
    context: {
      errorType: ErrorType.SystemError,
      functionName,
      ...requestDetails
    }
  });
};

/**
 * ユーザーフレンドリーなエラーレスポンス生成
 */
export const createErrorResponse = (errorInfo: ErrorInfo): ErrorResponse => {
  return {
    success: false,
    errorCode: errorInfo.code,
    message: errorInfo.userMessage,
    timestamp: new Date().toISOString()
  };
};

/**
 * グローバルエラーハンドラー
 * Lambda関数で使用する統一的なエラーハンドリング
 * 要件: 10.1, 10.2, 10.3
 */
export const globalErrorHandler = async (
  error: Error | ErrorCode,
  context: {
    requestId?: string;
    functionName?: string;
    userId?: string;
    retryCount?: number;
  }
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> => {
  // エラー分類
  const errorInfo = classifyError(error, context);

  // ログ記録
  logErrorWithCode(
    errorInfo,
    error instanceof Error ? error : null,
    context
  );

  // ユーザーレスポンス生成
  const errorResponse = createErrorResponse(errorInfo);

  return {
    statusCode: errorInfo.httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(errorResponse)
  };
};

/**
 * カスタムエラークラス
 * エラーコードを含むエラーを簡単に作成
 */
export class AppError extends Error {
  constructor(
    public errorCode: ErrorCode,
    message?: string
  ) {
    super(message || `${errorCode}: ${ERROR_MAPPINGS[errorCode]?.userMessage || 'Unknown error'}`);
    this.name = 'AppError';
  }
}
