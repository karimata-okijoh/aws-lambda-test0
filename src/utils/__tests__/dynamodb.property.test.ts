import * as fc from 'fast-check';

// モックの設定（importより前に定義）
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
    PutCommand: jest.fn((params) => ({ input: params })),
    GetCommand: jest.fn((params) => ({ input: params })),
    UpdateCommand: jest.fn((params) => ({ input: params })),
    ScanCommand: jest.fn((params) => ({ input: params })),
  };
});

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { putItem, updateItem, getItem } from '../dynamodb';
import { logger } from '../logger';

describe('DynamoDB Utility - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    process.env.AWS_REGION = 'ap-northeast-1';
    
    // デフォルトで成功するモック
    mockSend.mockResolvedValue({});
  });

  // Feature: teamviewer-survey-app, Property 12: タイムスタンプの記録
  describe('Property 12: タイムスタンプの記録', () => {
    it('任意のアイテムに対して、putItemはcreatedAtとupdatedAtを自動追加すること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            data: fc.string(),
          }),
          async (item) => {
            mockSend.mockClear();
            mockSend.mockResolvedValue({});
            
            const tableName = 'test-table';
            
            await putItem(tableName, item, true);
            
            // mockSendが呼ばれたことを確認
            expect(mockSend).toHaveBeenCalled();
            
            // 呼び出されたコマンドのパラメータを取得
            const callArgs = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
            const savedItem = callArgs.input.Item;
            
            // createdAtとupdatedAtが追加されていることを確認
            expect(savedItem).toHaveProperty('createdAt');
            expect(savedItem).toHaveProperty('updatedAt');
            
            // タイムスタンプがISO 8601形式であることを確認
            expect(typeof savedItem.createdAt).toBe('string');
            expect(typeof savedItem.updatedAt).toBe('string');
            
            // タイムスタンプが妥当な範囲内であることを確認
            expect(savedItem.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(savedItem.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            
            // 元のアイテムのプロパティが保持されていることを確認
            expect(savedItem.email).toBe(item.email);
            expect(savedItem.data).toBe(item.data);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の更新データに対して、updateItemはupdatedAtを自動追加すること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.record({ id: fc.string() }),
            updates: fc.record({
              field1: fc.string(),
              field2: fc.integer(),
            }),
          }),
          async ({ key, updates }) => {
            mockSend.mockClear();
            mockSend.mockResolvedValue({});
            
            const tableName = 'test-table';
            
            await updateItem(tableName, key, updates, true);
            
            // mockSendが呼ばれたことを確認
            expect(mockSend).toHaveBeenCalled();
            
            // 呼び出されたコマンドのパラメータを取得
            const callArgs = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
            const expressionValues = callArgs.input.ExpressionAttributeValues;
            const expressionNames = callArgs.input.ExpressionAttributeNames;
            
            // updatedAtが属性名マッピングに含まれていることを確認
            const updatedAtKey = Object.keys(expressionNames || {}).find(
              key => expressionNames[key] === 'updatedAt'
            );
            expect(updatedAtKey).toBeDefined();
            
            // updatedAtの値がISO 8601形式であることを確認
            const updatedAtValue = Object.values(expressionValues).find(
              (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)
            );
            expect(updatedAtValue).toBeDefined();
            expect(updatedAtValue).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('autoTimestamp=falseの場合、タイムスタンプが自動追加されないこと', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            customField: fc.string(),
          }),
          async (item) => {
            mockSend.mockClear();
            mockSend.mockResolvedValue({});
            
            const tableName = 'test-table';
            
            await putItem(tableName, item, false);
            
            const callArgs = mockSend.mock.calls[mockSend.mock.calls.length - 1][0];
            const savedItem = callArgs.input.Item;
            
            // 元のアイテムにcreatedAt/updatedAtがない場合、追加されないこと
            if (!item.hasOwnProperty('createdAt')) {
              expect(savedItem.createdAt).toBeUndefined();
            }
            if (!item.hasOwnProperty('updatedAt')) {
              expect(savedItem.updatedAt).toBeUndefined();
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 13: リトライロジック
  describe('Property 13: リトライロジック', () => {
    it('任意の一時的なエラーに対して、最大3回までリトライすること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            data: fc.string(),
          }),
          fc.integer({ min: 1, max: 2 }), // 成功するまでの失敗回数
          async (item, failuresBeforeSuccess) => {
            let callCount = 0;
            
            mockSend.mockClear();
            (logger.info as jest.Mock).mockClear();
            (logger.warn as jest.Mock).mockClear();
            (logger.error as jest.Mock).mockClear();
            
            // 指定回数失敗した後に成功するモック
            mockSend.mockImplementation(() => {
              callCount++;
              if (callCount <= failuresBeforeSuccess) {
                return Promise.reject(new Error('Temporary DynamoDB error'));
              }
              return Promise.resolve({});
            });
            
            const tableName = 'test-table';
            
            // エラーをスローせずに成功すること
            await expect(putItem(tableName, item)).resolves.not.toThrow();
            
            // リトライが実行されたことを確認
            expect(mockSend).toHaveBeenCalledTimes(failuresBeforeSuccess + 1);
            
            // 成功ログが記録されていることを確認（2回目以降の試行で成功した場合）
            if (failuresBeforeSuccess > 0) {
              expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining('succeeded on attempt')
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // タイムアウトを30秒に設定

    it('任意のテーブル操作に対して、リトライ間に指数バックオフが適用されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.record({ id: fc.string() }),
          }),
          async ({ key }) => {
            const timestamps: number[] = [];
            
            mockSend.mockClear();
            
            // 2回失敗して3回目に成功するモック
            mockSend.mockImplementation(() => {
              timestamps.push(Date.now());
              if (timestamps.length < 3) {
                return Promise.reject(new Error('Temporary error'));
              }
              return Promise.resolve({ Item: null });
            });
            
            const tableName = 'test-table';
            
            await getItem(tableName, key);
            
            // 3回呼ばれたことを確認
            expect(timestamps.length).toBe(3);
            
            // 1回目と2回目の間隔が約100ms以上であることを確認（指数バックオフの最初の遅延）
            const delay1 = timestamps[1] - timestamps[0];
            expect(delay1).toBeGreaterThanOrEqual(90); // 多少の誤差を許容
            
            // 2回目と3回目の間隔が約200ms以上であることを確認（指数バックオフの2回目の遅延）
            const delay2 = timestamps[2] - timestamps[1];
            expect(delay2).toBeGreaterThanOrEqual(180); // 多少の誤差を許容
          }
        ),
        { numRuns: 10 } // 時間がかかるため実行回数を減らす
      );
    }, 60000); // タイムアウトを60秒に設定
  });

  // Feature: teamviewer-survey-app, Property 14: リトライ失敗時のエラーハンドリング
  describe('Property 14: リトライ失敗時のエラーハンドリング', () => {
    it('任意の永続的なエラーに対して、3回のリトライ後にエラーがスローされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            data: fc.string(),
          }),
          async (item) => {
            mockSend.mockClear();
            
            // 常に失敗するモック
            mockSend.mockRejectedValue(new Error('Persistent DynamoDB error'));
            
            const tableName = 'test-table';
            
            // エラーがスローされることを確認
            await expect(putItem(tableName, item)).rejects.toThrow();
            
            // 正確に3回リトライされたことを確認
            expect(mockSend).toHaveBeenCalledTimes(3);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // タイムアウトを30秒に設定

    it('任意のリトライ失敗に対して、エラーログが記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.record({ id: fc.string() }),
            updates: fc.record({ field: fc.string() }),
          }),
          async ({ key, updates }) => {
            mockSend.mockClear();
            (logger.info as jest.Mock).mockClear();
            (logger.warn as jest.Mock).mockClear();
            (logger.error as jest.Mock).mockClear();
            
            // 常に失敗するモック
            const errorMessage = 'Database connection failed';
            mockSend.mockRejectedValue(new Error(errorMessage));
            
            const tableName = 'test-table';
            
            try {
              await updateItem(tableName, key, updates);
            } catch (error) {
              // エラーが予期されている
            }
            
            // エラーログが記録されたことを確認
            expect(logger.error).toHaveBeenCalledWith(
              expect.stringContaining('failed after'),
              expect.objectContaining({
                error: expect.any(String),
              })
            );
            
            // 警告ログが各リトライで記録されたことを確認
            expect(logger.warn).toHaveBeenCalledTimes(3);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // タイムアウトを30秒に設定

    it('任意のリトライ失敗に対して、エラーメッセージに試行回数が含まれること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
          }),
          async (item) => {
            mockSend.mockClear();
            
            const originalError = 'Network timeout';
            mockSend.mockRejectedValue(new Error(originalError));
            
            const tableName = 'test-table';
            
            try {
              await putItem(tableName, item);
              fail('エラーがスローされるべき');
            } catch (error: any) {
              // エラーメッセージに試行回数とテーブル名が含まれることを確認
              expect(error.message).toContain('3 attempts');
              expect(error.message).toContain(tableName);
              expect(error.message).toContain(originalError);
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 30000); // タイムアウトを30秒に設定

    it('任意の部分的な失敗に対して、各試行が個別にログ記録されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            key: fc.record({ id: fc.string() }),
          }),
          async ({ key }) => {
            let attemptCount = 0;
            
            mockSend.mockClear();
            (logger.info as jest.Mock).mockClear();
            (logger.warn as jest.Mock).mockClear();
            (logger.error as jest.Mock).mockClear();
            
            // 各試行で異なるエラーを返すモック
            mockSend.mockImplementation(() => {
              attemptCount++;
              return Promise.reject(new Error(`Error on attempt ${attemptCount}`));
            });
            
            const tableName = 'test-table';
            
            try {
              await getItem(tableName, key);
            } catch (error) {
              // エラーが予期されている
            }
            
            // 各試行で警告ログが記録されたことを確認
            expect(logger.warn).toHaveBeenCalledTimes(3);
            
            // 各ログに試行番号が含まれることを確認
            for (let i = 1; i <= 3; i++) {
              expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`attempt ${i}/3`),
                expect.objectContaining({
                  attempt: i,
                })
              );
            }
          }
        ),
        { numRuns: 15 }
      );
    }, 30000); // タイムアウトを30秒に設定
  });
});
