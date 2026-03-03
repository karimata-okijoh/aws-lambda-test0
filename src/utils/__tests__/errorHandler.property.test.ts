// エラーハンドラーとロギングのプロパティベーステスト
// タスク7.3: セキュリティのプロパティテスト

import * as fc from 'fast-check';
import {
  classifyError,
  logErrorWithCode,
  logSuccess,
  logTimeout,
  ErrorType,
} from '../errorHandler';
import { ErrorCode } from '../../types';
import { log, LogLevel } from '../logger';

// ロガーのモック
jest.mock('../logger', () => ({
  log: jest.fn(),
  LogLevel: {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
  },
}));

describe('Error Handler and Logging - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: teamviewer-survey-app, Property 32: エラーログの記録
  // **Validates: Requirements 10.1**
  describe('Property 32: エラーログの記録', () => {
    it('任意のエラー発生時に、タイムスタンプ、エラータイプ、コンテキスト情報を含むログが正しく記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(ErrorCode)),
          fc.record({
            requestId: fc.uuid(),
            functionName: fc.constantFrom('AuthLambda', 'SurveyLambda', 'ReportLambda'),
            userId: fc.emailAddress(),
            retryCount: fc.integer({ min: 0, max: 3 }),
          }),
          async (errorCode, requestContext) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // エラー情報を分類
            const errorInfo = classifyError(errorCode, { customData: 'test' });

            // エラーログを記録
            const error = new Error(`Test error: ${errorCode}`);
            logErrorWithCode(errorInfo, error, requestContext);

            // logが呼ばれたことを確認
            expect(log).toHaveBeenCalledTimes(1);

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // タイムスタンプが含まれていることを確認
            expect(logCall.timestamp).toBeDefined();
            expect(logCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // ログレベルがERRORであることを確認
            expect(logCall.level).toBe(LogLevel.ERROR);

            // エラーコードが含まれていることを確認（classifyErrorで変換される可能性がある）
            expect(logCall.errorCode).toBeDefined();
            expect(Object.values(ErrorCode)).toContain(logCall.errorCode);

            // エラーメッセージが含まれていることを確認
            expect(logCall.message).toBeDefined();
            expect(typeof logCall.message).toBe('string');

            // コンテキスト情報が含まれていることを確認
            expect(logCall.context).toBeDefined();
            expect(logCall.context.errorType).toBe(errorInfo.type);
            expect(logCall.context.requestId).toBe(requestContext.requestId);
            expect(logCall.context.functionName).toBe(requestContext.functionName);
            expect(logCall.context.userId).toBe(requestContext.userId);
            expect(logCall.context.retryCount).toBe(requestContext.retryCount);

            // スタックトレースが含まれていることを確認
            expect(logCall.stackTrace).toBeDefined();
            expect(typeof logCall.stackTrace).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のエラータイプに対して、適切なエラー分類が行われること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...Object.values(ErrorCode)),
          async (errorCode) => {
            // エラー情報を分類
            const errorInfo = classifyError(errorCode);

            // エラーコードが正しく設定されていることを確認
            expect(errorInfo.code).toBe(errorCode);

            // エラータイプが定義されていることを確認
            expect(errorInfo.type).toBeDefined();
            expect(Object.values(ErrorType)).toContain(errorInfo.type);

            // HTTPステータスが妥当な範囲内であることを確認
            expect(errorInfo.httpStatus).toBeGreaterThanOrEqual(400);
            expect(errorInfo.httpStatus).toBeLessThan(600);

            // ユーザーメッセージが定義されていることを確認
            expect(errorInfo.userMessage).toBeDefined();
            expect(typeof errorInfo.userMessage).toBe('string');
            expect(errorInfo.userMessage.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意のカスタムコンテキストに対して、ログに正しく含まれること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(ErrorCode.DB_001, ErrorCode.AUTH_002, ErrorCode.VAL_001),
          fc.record({
            customField1: fc.string({ minLength: 1, maxLength: 20 }),
            customField2: fc.integer(),
            customField3: fc.boolean(),
          }),
          async (errorCode, customContext) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // エラー情報を分類
            const errorInfo = classifyError(errorCode, customContext);

            // エラーログを記録
            logErrorWithCode(errorInfo, new Error('Test error'), {});

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // カスタムコンテキストが含まれていることを確認
            expect(logCall.context.customField1).toBe(customContext.customField1);
            expect(logCall.context.customField2).toBe(customContext.customField2);
            expect(logCall.context.customField3).toBe(customContext.customField3);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 33: 成功ログの記録
  // **Validates: Requirements 10.2**
  describe('Property 33: 成功ログの記録', () => {
    it('任意の成功した回答送信に対して、監査目的のログが正しく記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'survey_submission',
            'user_login',
            'report_generation',
            'response_update'
          ),
          fc.record({
            userId: fc.emailAddress(),
            timestamp: fc.date().map(d => d.toISOString()),
            responseCount: fc.integer({ min: 1, max: 100 }),
          }),
          async (operation, context) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // 成功ログを記録
            logSuccess(operation, context);

            // logが呼ばれたことを確認
            expect(log).toHaveBeenCalledTimes(1);

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // タイムスタンプが含まれていることを確認
            expect(logCall.timestamp).toBeDefined();
            expect(logCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // ログレベルがINFOであることを確認
            expect(logCall.level).toBe(LogLevel.INFO);

            // メッセージに操作名が含まれていることを確認
            expect(logCall.message).toContain(operation);
            expect(logCall.message).toContain('successful');

            // コンテキスト情報が含まれていることを確認
            expect(logCall.context).toBeDefined();
            expect(logCall.context.userId).toBe(context.userId);
            expect(logCall.context.timestamp).toBe(context.timestamp);
            expect(logCall.context.responseCount).toBe(context.responseCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意の操作に対して、成功ログが一貫した形式で記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.option(
            fc.record({
              field1: fc.string({ minLength: 1, maxLength: 20 }),
              field2: fc.integer(),
            }),
            { nil: undefined }
          ),
          async (operation, context) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // 成功ログを記録
            logSuccess(operation, context);

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // 必須フィールドが含まれていることを確認
            expect(logCall).toHaveProperty('timestamp');
            expect(logCall).toHaveProperty('level');
            expect(logCall).toHaveProperty('message');

            // コンテキストが正しく設定されていることを確認
            if (context) {
              expect(logCall.context).toBeDefined();
              expect(logCall.context.field1).toBe(context.field1);
              expect(logCall.context.field2).toBe(context.field2);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 34: タイムアウトログの記録
  // **Validates: Requirements 10.3**
  describe('Property 34: タイムアウトログの記録', () => {
    it('任意のLambda関数のタイムアウト発生時に、リクエスト詳細を含むログが記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('AuthLambda', 'SurveyLambda', 'ReportLambda'),
          fc.record({
            requestId: fc.uuid(),
            userId: fc.emailAddress(),
            httpMethod: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
            path: fc.constantFrom('/auth/login', '/survey', '/report'),
            executionTime: fc.integer({ min: 25000, max: 30000 }),
          }),
          async (functionName, requestDetails) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // タイムアウトログを記録
            logTimeout(functionName, requestDetails);

            // logが呼ばれたことを確認
            expect(log).toHaveBeenCalledTimes(1);

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // タイムスタンプが含まれていることを確認
            expect(logCall.timestamp).toBeDefined();
            expect(logCall.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            // ログレベルがERRORであることを確認
            expect(logCall.level).toBe(LogLevel.ERROR);

            // エラーコードがDB_004（タイムアウト）であることを確認
            expect(logCall.errorCode).toBe(ErrorCode.DB_004);

            // メッセージに関数名が含まれていることを確認
            expect(logCall.message).toContain(functionName);
            expect(logCall.message).toContain('timeout');

            // コンテキスト情報が含まれていることを確認
            expect(logCall.context).toBeDefined();
            expect(logCall.context.errorType).toBe(ErrorType.SystemError);
            expect(logCall.context.functionName).toBe(functionName);
            expect(logCall.context.requestId).toBe(requestDetails.requestId);
            expect(logCall.context.userId).toBe(requestDetails.userId);
            expect(logCall.context.httpMethod).toBe(requestDetails.httpMethod);
            expect(logCall.context.path).toBe(requestDetails.path);
            expect(logCall.context.executionTime).toBe(requestDetails.executionTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のタイムアウトイベントに対して、一貫した形式でログが記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.record({
            detail1: fc.string({ minLength: 1, maxLength: 20 }),
            detail2: fc.integer(),
          }),
          async (functionName, requestDetails) => {
            // モックをクリア
            (log as jest.Mock).mockClear();

            // タイムアウトログを記録
            logTimeout(functionName, requestDetails);

            // ログの内容を確認
            const logCall = (log as jest.Mock).mock.calls[0][0];

            // 必須フィールドが含まれていることを確認
            expect(logCall).toHaveProperty('timestamp');
            expect(logCall).toHaveProperty('level');
            expect(logCall).toHaveProperty('errorCode');
            expect(logCall).toHaveProperty('message');
            expect(logCall).toHaveProperty('context');

            // リクエスト詳細が含まれていることを確認
            expect(logCall.context.detail1).toBe(requestDetails.detail1);
            expect(logCall.context.detail2).toBe(requestDetails.detail2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
