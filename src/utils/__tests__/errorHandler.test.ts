// エラーハンドラーのユニットテスト
// タスク7.1: グローバルエラーハンドラーの実装

import {
  classifyError,
  logErrorWithCode,
  logSuccess,
  logTimeout,
  createErrorResponse,
  globalErrorHandler,
  AppError,
  ErrorType
} from '../errorHandler';
import { ErrorCode } from '../../types';
import { HTTP_STATUS } from '../constants';

describe('エラーハンドラー', () => {
  describe('classifyError', () => {
    test('AUTH_001エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.AUTH_001);
      
      expect(errorInfo.code).toBe(ErrorCode.AUTH_001);
      expect(errorInfo.type).toBe(ErrorType.AuthenticationError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.FORBIDDEN);
      expect(errorInfo.userMessage).toBe('このアンケートは社内メンバー専用です');
    });

    test('AUTH_002エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.AUTH_002);
      
      expect(errorInfo.code).toBe(ErrorCode.AUTH_002);
      expect(errorInfo.type).toBe(ErrorType.AuthenticationError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(errorInfo.userMessage).toBe('メールアドレスまたはパスワードが正しくありません');
    });

    test('VAL_001エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.VAL_001);
      
      expect(errorInfo.code).toBe(ErrorCode.VAL_001);
      expect(errorInfo.type).toBe(ErrorType.ValidationError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(errorInfo.userMessage).toBe('すべての時間帯について回答を選択してください');
    });

    test('DB_002エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.DB_002);
      
      expect(errorInfo.code).toBe(ErrorCode.DB_002);
      expect(errorInfo.type).toBe(ErrorType.DataStoreError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(errorInfo.userMessage).toBe('回答の保存に失敗しました。再度お試しください');
    });

    test('PERIOD_001エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.PERIOD_001);
      
      expect(errorInfo.code).toBe(ErrorCode.PERIOD_001);
      expect(errorInfo.type).toBe(ErrorType.PeriodConstraintError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.FORBIDDEN);
      expect(errorInfo.userMessage).toBe('アンケートはまだ開始されていません（開始日: 2026年3月15日）');
    });

    test('SYS_003エラーコードを正しく分類する', () => {
      const errorInfo = classifyError(ErrorCode.SYS_003);
      
      expect(errorInfo.code).toBe(ErrorCode.SYS_003);
      expect(errorInfo.type).toBe(ErrorType.SystemError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(errorInfo.userMessage).toBe('予期しないエラーが発生しました');
    });

    test('エラーメッセージにエラーコードが含まれている場合、正しく抽出する', () => {
      const error = new Error('AUTH_004: Invalid token');
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.AUTH_004);
      expect(errorInfo.type).toBe(ErrorType.AuthenticationError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    test('ValidationErrorの場合、VAL_002として分類する', () => {
      const error = new Error('Invalid format');
      error.name = 'ValidationError';
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.VAL_002);
      expect(errorInfo.type).toBe(ErrorType.ValidationError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.BAD_REQUEST);
    });

    test('TimeoutErrorの場合、DB_004として分類する', () => {
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.DB_004);
      expect(errorInfo.type).toBe(ErrorType.DataStoreError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.GATEWAY_TIMEOUT);
    });

    test('DynamoDBエラーの場合、DB_001として分類する', () => {
      const error = new Error('DynamoDB connection failed');
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.DB_001);
      expect(errorInfo.type).toBe(ErrorType.DataStoreError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });

    test('未知のエラーの場合、SYS_003として分類する', () => {
      const error = new Error('Unknown error');
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.SYS_003);
      expect(errorInfo.type).toBe(ErrorType.SystemError);
      expect(errorInfo.httpStatus).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(errorInfo.userMessage).toBe('予期しないエラーが発生しました');
    });

    test('コンテキスト情報を含める', () => {
      const context = { userId: 'test@okijoh.co.jp', action: 'login' };
      const errorInfo = classifyError(ErrorCode.AUTH_002, context);
      
      expect(errorInfo.context).toEqual(context);
    });
  });

  describe('createErrorResponse', () => {
    test('エラーレスポンスを正しく生成する', () => {
      const errorInfo = classifyError(ErrorCode.AUTH_001);
      const response = createErrorResponse(errorInfo);
      
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe(ErrorCode.AUTH_001);
      expect(response.message).toBe('このアンケートは社内メンバー専用です');
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp).getTime()).toBeGreaterThan(0);
    });

    test('タイムスタンプがISO 8601形式である', () => {
      const errorInfo = classifyError(ErrorCode.VAL_001);
      const response = createErrorResponse(errorInfo);
      
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(response.timestamp).toMatch(isoRegex);
    });
  });

  describe('globalErrorHandler', () => {
    test('エラーコードから正しいHTTPレスポンスを生成する', async () => {
      const result = await globalErrorHandler(ErrorCode.AUTH_001, {
        requestId: 'test-request-id',
        functionName: 'AuthLambda'
      });
      
      expect(result.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe(ErrorCode.AUTH_001);
      expect(body.message).toBe('このアンケートは社内メンバー専用です');
    });

    test('Errorオブジェクトから正しいHTTPレスポンスを生成する', async () => {
      const error = new Error('DB_002: Save failed');
      const result = await globalErrorHandler(error, {
        requestId: 'test-request-id',
        functionName: 'SurveyLambda',
        userId: 'user@okijoh.co.jp'
      });
      
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe(ErrorCode.DB_002);
      expect(body.message).toBe('回答の保存に失敗しました。再度お試しください');
    });

    test('未知のエラーの場合、SYS_003として処理する', async () => {
      const error = new Error('Unexpected error');
      const result = await globalErrorHandler(error, {
        requestId: 'test-request-id',
        functionName: 'TestLambda'
      });
      
      expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe(ErrorCode.SYS_003);
      expect(body.message).toBe('予期しないエラーが発生しました');
    });
  });

  describe('AppError', () => {
    test('エラーコードを含むカスタムエラーを作成する', () => {
      const error = new AppError(ErrorCode.AUTH_001);
      
      expect(error.errorCode).toBe(ErrorCode.AUTH_001);
      expect(error.name).toBe('AppError');
      expect(error.message).toContain('AUTH_001');
      expect(error.message).toContain('このアンケートは社内メンバー専用です');
    });

    test('カスタムメッセージを指定できる', () => {
      const customMessage = 'Custom error message';
      const error = new AppError(ErrorCode.VAL_001, customMessage);
      
      expect(error.errorCode).toBe(ErrorCode.VAL_001);
      expect(error.message).toBe(customMessage);
    });

    test('classifyErrorで正しく処理される', () => {
      const error = new AppError(ErrorCode.DB_003);
      const errorInfo = classifyError(error);
      
      expect(errorInfo.code).toBe(ErrorCode.DB_003);
      expect(errorInfo.type).toBe(ErrorType.DataStoreError);
      expect(errorInfo.userMessage).toBe('データの取得に失敗しました');
    });
  });

  describe('logErrorWithCode', () => {
    // console.logをモック化
    const originalConsoleLog = console.log;
    let consoleOutput: string[] = [];

    beforeEach(() => {
      consoleOutput = [];
      console.log = jest.fn((message: string) => {
        consoleOutput.push(message);
      });
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    test('エラーログを正しい形式で出力する', () => {
      const errorInfo = classifyError(ErrorCode.AUTH_002);
      const error = new Error('Password mismatch');
      
      logErrorWithCode(errorInfo, error, {
        requestId: 'test-request-id',
        functionName: 'AuthLambda',
        userId: 'test@okijoh.co.jp'
      });
      
      expect(consoleOutput.length).toBe(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.errorCode).toBe(ErrorCode.AUTH_002);
      expect(logEntry.message).toBe('Password mismatch');
      expect(logEntry.context.errorType).toBe(ErrorType.AuthenticationError);
      expect(logEntry.context.requestId).toBe('test-request-id');
      expect(logEntry.context.functionName).toBe('AuthLambda');
      expect(logEntry.context.userId).toBe('test@okijoh.co.jp');
      expect(logEntry.stackTrace).toBeDefined();
      expect(logEntry.timestamp).toBeDefined();
    });

    test('エラーオブジェクトがnullの場合でもログを出力する', () => {
      const errorInfo = classifyError(ErrorCode.VAL_001);
      
      logErrorWithCode(errorInfo, null, {
        requestId: 'test-request-id',
        functionName: 'SurveyLambda'
      });
      
      expect(consoleOutput.length).toBe(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.errorCode).toBe(ErrorCode.VAL_001);
      expect(logEntry.message).toBe('すべての時間帯について回答を選択してください');
      expect(logEntry.stackTrace).toBeUndefined();
    });
  });

  describe('logSuccess', () => {
    const originalConsoleLog = console.log;
    let consoleOutput: string[] = [];

    beforeEach(() => {
      consoleOutput = [];
      console.log = jest.fn((message: string) => {
        consoleOutput.push(message);
      });
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    test('成功ログを正しい形式で出力する', () => {
      logSuccess('survey_submission', {
        userId: 'test@okijoh.co.jp',
        responseCount: 7
      });
      
      expect(consoleOutput.length).toBe(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.message).toBe('Operation successful: survey_submission');
      expect(logEntry.context.userId).toBe('test@okijoh.co.jp');
      expect(logEntry.context.responseCount).toBe(7);
      expect(logEntry.timestamp).toBeDefined();
    });
  });

  describe('logTimeout', () => {
    const originalConsoleLog = console.log;
    let consoleOutput: string[] = [];

    beforeEach(() => {
      consoleOutput = [];
      console.log = jest.fn((message: string) => {
        consoleOutput.push(message);
      });
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    test('タイムアウトログを正しい形式で出力する', () => {
      logTimeout('SurveyLambda', {
        requestId: 'test-request-id',
        userId: 'test@okijoh.co.jp',
        operation: 'save_response'
      });
      
      expect(consoleOutput.length).toBe(1);
      const logEntry = JSON.parse(consoleOutput[0]);
      
      expect(logEntry.level).toBe('ERROR');
      expect(logEntry.errorCode).toBe(ErrorCode.DB_004);
      expect(logEntry.message).toBe('Lambda function timeout: SurveyLambda');
      expect(logEntry.context.errorType).toBe(ErrorType.SystemError);
      expect(logEntry.context.functionName).toBe('SurveyLambda');
      expect(logEntry.context.requestId).toBe('test-request-id');
      expect(logEntry.context.userId).toBe('test@okijoh.co.jp');
      expect(logEntry.timestamp).toBeDefined();
    });
  });
});
