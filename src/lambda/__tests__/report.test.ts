// Feature: teamviewer-survey-app
// レポート機能のユニットテスト
// タスク6.1: レポート生成機能の実装

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../report';
import { ReportResponse } from '../../types';
import * as jwt from 'jsonwebtoken';
import * as dynamodb from '../../utils/dynamodb';

// 環境変数のモック設定
const MOCK_JWT_SECRET = 'test-secret-key';
const ADMIN_EMAIL = 'karimata@okijoh.co.jp';

// 環境変数の設定
process.env.JWT_SECRET = MOCK_JWT_SECRET;
process.env.RESPONSES_TABLE = 'test-responses-table';

// DynamoDBのモック
jest.mock('../../utils/dynamodb');

/**
 * テスト用のAPIGatewayProxyEventを生成
 */
const createMockEvent = (token?: string): APIGatewayProxyEvent => {
  return {
    body: null,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/report',
    pathParameters: null,
    queryStringParameters: token ? { token } : null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

/**
 * 管理者トークンを生成
 */
const generateAdminToken = (): string => {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      email: ADMIN_EMAIL,
      role: 'admin',
      iat: now,
      exp: now + 86400
    },
    MOCK_JWT_SECRET
  );
};

/**
 * 一般ユーザートークンを生成
 */
const generateUserToken = (): string => {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      email: 'user@okijoh.co.jp',
      role: 'user',
      iat: now,
      exp: now + 86400
    },
    MOCK_JWT_SECRET
  );
};

describe('レポート機能のユニットテスト', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 要件: 6.1
   * 管理者権限チェック
   */
  describe('管理者権限チェック', () => {
    test('管理者トークンでレポート生成が成功すること', async () => {
      const adminToken = generateAdminToken();
      const event = createMockEvent(adminToken);

      // モックデータの設定
      const mockResponses = [
        {
          email: 'user1@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: true, evening: true }
          },
          createdAt: '2026-03-15T09:00:00Z',
          updatedAt: '2026-03-15T09:00:00Z'
        },
        {
          email: 'user2@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: false, evening: false }
          },
          createdAt: '2026-03-15T10:00:00Z',
          updatedAt: '2026-03-15T10:00:00Z'
        }
      ];

      (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(mockResponses);

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      // ステータスコードが200であること
      expect(result.statusCode).toBe(200);
      
      // レポート生成成功
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      
      // 回答総数が正しいこと
      expect(response.data!.totalResponses).toBe(2);
      
      // 対象人数が設定されていること
      expect(response.data!.targetCount).toBe(25);
      
      // 回答率が計算されていること
      expect(response.data!.responseRate).toBeGreaterThan(0);
    });

    test('一般ユーザートークンでレポート生成が拒否されること', async () => {
      const userToken = generateUserToken();
      const event = createMockEvent(userToken);

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      // ステータスコードが403であること
      expect(result.statusCode).toBe(403);
      
      // レポート生成失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('この機能にアクセスする権限がありません');
    });

    test('トークンがない場合はレポート生成が拒否されること', async () => {
      const event = createMockEvent();

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // レポート生成失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('認証トークンが必要です');
    });
  });

  /**
   * 要件: 6.2, 6.3, 6.4
   * レポートデータの集計
   */
  describe('レポートデータの集計', () => {
    test('時間帯別の統計が正しく計算されること', async () => {
      const adminToken = generateAdminToken();
      const event = createMockEvent(adminToken);

      // モックデータ: 5件の回答
      const mockResponses = [
        {
          email: 'user1@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: true, evening: true }
          },
          createdAt: '2026-03-15T09:00:00Z',
          updatedAt: '2026-03-15T09:00:00Z'
        },
        {
          email: 'user2@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: true, evening: false }
          },
          createdAt: '2026-03-15T10:00:00Z',
          updatedAt: '2026-03-15T10:00:00Z'
        },
        {
          email: 'user3@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: false, evening: false }
          },
          createdAt: '2026-03-15T11:00:00Z',
          updatedAt: '2026-03-15T11:00:00Z'
        },
        {
          email: 'user4@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: false, afternoon: true, evening: false }
          },
          createdAt: '2026-03-15T12:00:00Z',
          updatedAt: '2026-03-15T12:00:00Z'
        },
        {
          email: 'user5@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: false, afternoon: false, evening: false }
          },
          createdAt: '2026-03-15T13:00:00Z',
          updatedAt: '2026-03-15T13:00:00Z'
        }
      ];

      (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(mockResponses);

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      // 時間帯別の統計
      const { timeSlotStats } = response.data!;
      
      // 午前中: 3人が利用
      expect(timeSlotStats.morning.count).toBe(3);
      expect(timeSlotStats.morning.percentage).toBe(60);
      
      // 午後: 3人が利用
      expect(timeSlotStats.afternoon.count).toBe(3);
      expect(timeSlotStats.afternoon.percentage).toBe(60);
      
      // 18時以降: 1人が利用
      expect(timeSlotStats.evening.count).toBe(1);
      expect(timeSlotStats.evening.percentage).toBe(20);
    });

    test('利用パターンが正しく分類されること', async () => {
      const adminToken = generateAdminToken();
      const event = createMockEvent(adminToken);

      // モックデータ
      const mockResponses = [
        {
          email: 'user1@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: true, evening: true }
          },
          createdAt: '2026-03-15T09:00:00Z',
          updatedAt: '2026-03-15T09:00:00Z'
        },
        {
          email: 'user2@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: true, evening: false }
          },
          createdAt: '2026-03-15T10:00:00Z',
          updatedAt: '2026-03-15T10:00:00Z'
        },
        {
          email: 'user3@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: true, afternoon: false, evening: false }
          },
          createdAt: '2026-03-15T11:00:00Z',
          updatedAt: '2026-03-15T11:00:00Z'
        },
        {
          email: 'user4@okijoh.co.jp',
          responses: {
            '2026-03-15': { morning: false, afternoon: false, evening: false }
          },
          createdAt: '2026-03-15T12:00:00Z',
          updatedAt: '2026-03-15T12:00:00Z'
        }
      ];

      (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(mockResponses);

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      // 利用パターンの分類
      const { usagePatterns } = response.data!;
      
      // 全時間帯利用: 1人
      expect(usagePatterns.allTimeSlots).toBe(1);
      
      // 2時間帯利用: 1人
      expect(usagePatterns.twoTimeSlots).toBe(1);
      
      // 1時間帯利用: 1人
      expect(usagePatterns.oneTimeSlot).toBe(1);
      
      // 未利用: 1人
      expect(usagePatterns.noUsage).toBe(1);
    });

    test('空のデータセットでも正しく処理されること', async () => {
      const adminToken = generateAdminToken();
      const event = createMockEvent(adminToken);

      // 空のモックデータ
      (dynamodb.getAllResponses as jest.Mock).mockResolvedValue([]);

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();

      // 回答総数が0
      expect(response.data!.totalResponses).toBe(0);
      
      // 回答率が0
      expect(response.data!.responseRate).toBe(0);
      
      // すべての統計が0
      expect(response.data!.timeSlotStats.morning.count).toBe(0);
      expect(response.data!.timeSlotStats.afternoon.count).toBe(0);
      expect(response.data!.timeSlotStats.evening.count).toBe(0);
      
      expect(response.data!.usagePatterns.allTimeSlots).toBe(0);
      expect(response.data!.usagePatterns.twoTimeSlots).toBe(0);
      expect(response.data!.usagePatterns.oneTimeSlot).toBe(0);
      expect(response.data!.usagePatterns.noUsage).toBe(0);
    });
  });

  /**
   * エラーハンドリング
   */
  describe('エラーハンドリング', () => {
    test('DynamoDBエラー時に適切なエラーレスポンスが返されること', async () => {
      const adminToken = generateAdminToken();
      const event = createMockEvent(adminToken);

      // DynamoDBエラーをシミュレート
      (dynamodb.getAllResponses as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      // ステータスコードが500であること
      expect(result.statusCode).toBe(500);
      
      // レポート生成失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('レポートの生成に失敗しました');
    });

    test('期限切れトークンで認証が失敗すること', async () => {
      // 期限切れトークンを生成
      const pastTime = Math.floor(Date.now() / 1000) - 100000;
      const expiredToken = jwt.sign(
        {
          email: ADMIN_EMAIL,
          role: 'admin',
          iat: pastTime - 86400,
          exp: pastTime
        },
        MOCK_JWT_SECRET
      );

      const event = createMockEvent(expiredToken);
      const result = await handler(event);
      const response: ReportResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // レポート生成失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('セッションが期限切れです。再度ログインしてください');
    });
  });
});
