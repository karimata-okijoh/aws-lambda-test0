// アンケートLambda関数のユニットテスト
// タスク4.2: アンケート回答取得機能のテスト

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../survey';
import * as dynamodb from '../../utils/dynamodb';
import * as jwt from 'jsonwebtoken';

// モック設定
jest.mock('../../utils/dynamodb');
jest.mock('jsonwebtoken');

describe('Survey Lambda', () => {
  const mockEmail = 'test@okijoh.co.jp';
  const mockToken = 'valid-jwt-token';
  const mockJwtSecret = 'test-secret';

  beforeEach(() => {
    // 環境変数の設定
    process.env.JWT_SECRET = mockJwtSecret;
    process.env.SURVEY_START_DATE = '2026-03-15';
    process.env.SURVEY_END_DATE = '2026-06-27';
    
    // モックのリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 環境変数のクリア
    delete process.env.JWT_SECRET;
    delete process.env.SURVEY_START_DATE;
    delete process.env.SURVEY_END_DATE;
  });

  describe('POST /survey - 回答送信', () => {
    it('3つの時間帯すべてがTrueの回答送信が成功すること', async () => {
      // 2026年4月1日（アンケート期間内）を想定
      const mockDate = new Date('2026-04-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB保存のモック
      (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);

      // 保存後のデータ取得のモック
      const mockSavedData = {
        email: mockEmail,
        responses: {
          '2026-04-01': {
            morning: true,
            afternoon: true,
            evening: true
          }
        },
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-01T10:00:00Z'
      };
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(mockSavedData);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            '2026-04-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockSavedData);
      expect(body.message).toBe('回答が正常に保存されました');
      expect(dynamodb.saveResponse).toHaveBeenCalledWith(mockEmail, {
        '2026-04-01': {
          morning: true,
          afternoon: true,
          evening: true
        }
      });

      jest.useRealTimers();
    });

    it('1つの時間帯のみTrueの回答送信が成功すること', async () => {
      // 2026年4月1日（アンケート期間内）を想定
      const mockDate = new Date('2026-04-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB保存のモック
      (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);

      // 保存後のデータ取得のモック
      const mockSavedData = {
        email: mockEmail,
        responses: {
          '2026-04-01': {
            morning: true,
            afternoon: false,
            evening: false
          }
        },
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-01T10:00:00Z'
      };
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(mockSavedData);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            '2026-04-01': {
              morning: true,
              afternoon: false,
              evening: false
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockSavedData);
      expect(body.message).toBe('回答が正常に保存されました');
      expect(dynamodb.saveResponse).toHaveBeenCalledWith(mockEmail, {
        '2026-04-01': {
          morning: true,
          afternoon: false,
          evening: false
        }
      });

      jest.useRealTimers();
    });

    it('トークンがない場合は401エラーを返すこと', async () => {
      // イベントの作成（トークンなし）
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          responses: {
            '2026-04-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('認証トークンが必要です');
    });

    it('無効なトークンの場合は401エラーを返すこと', async () => {
      // JWT検証のモック（エラー）
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: 'invalid-token',
          responses: {
            '2026-04-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('無効な認証情報です');
    });

    it('アンケート期間外（開始前）の場合は403エラーを返すこと', async () => {
      // 2026年3月1日（アンケート期間より前）を想定
      const mockDate = new Date('2026-03-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            '2026-03-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('アンケートはまだ開始されていません');

      jest.useRealTimers();
    });

    it('アンケート期間外（終了後）の場合は403エラーを返すこと', async () => {
      // 2026年7月1日（アンケート期間より後）を想定
      const mockDate = new Date('2026-07-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            '2026-07-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('アンケートは終了しました');

      jest.useRealTimers();
    });

    it('不正な日付形式の場合は400エラーを返すこと', async () => {
      // 2026年4月1日（アンケート期間内）を想定
      const mockDate = new Date('2026-04-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // イベントの作成（不正な日付形式）
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            'invalid-date': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toContain('不正な日付形式です');

      jest.useRealTimers();
    });

    it('DynamoDB保存エラーの場合は500エラーを返すこと', async () => {
      // 2026年4月1日（アンケート期間内）を想定
      const mockDate = new Date('2026-04-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB保存のモック（エラー）
      (dynamodb.saveResponse as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        body: JSON.stringify({
          token: mockToken,
          responses: {
            '2026-04-01': {
              morning: true,
              afternoon: true,
              evening: true
            }
          }
        })
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('回答の保存に失敗しました。再度お試しください');

      jest.useRealTimers();
    });
  });

  describe('GET /survey - 回答取得', () => {
    it('有効なトークンで既存回答を取得できること', async () => {
      // モックデータ
      const mockResponse = {
        email: mockEmail,
        responses: {
          '2026-03-15': {
            morning: true,
            afternoon: false,
            evening: true
          }
        },
        createdAt: '2026-03-15T09:00:00Z',
        updatedAt: '2026-03-15T09:00:00Z'
      };

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(mockResponse);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockResponse);
      expect(body.currentWeekStart).toBeDefined();
      expect(body.message).toBe('既存の回答を取得しました');
    });

    it('既存回答がない場合は空のデータを返すこと', async () => {
      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック（データなし）
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(null);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeUndefined();
      expect(body.currentWeekStart).toBeDefined();
      expect(body.message).toBe('回答データがありません');
    });

    it('トークンがない場合は401エラーを返すこと', async () => {
      // イベントの作成（トークンなし）
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('認証トークンが必要です');
    });

    it('無効なトークンの場合は401エラーを返すこと', async () => {
      // JWT検証のモック（エラー）
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: 'invalid-token'
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('無効な認証情報です');
    });

    it('DynamoDB取得エラーの場合は500エラーを返すこと', async () => {
      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック（エラー）
      (dynamodb.getResponse as jest.Mock).mockRejectedValue(
        new Error('DynamoDB error')
      );

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.message).toBe('データの取得に失敗しました');
    });
  });

  describe('週の開始日の計算', () => {
    it('システム日付がアンケート期間内の場合、その週の開始日を返すこと', async () => {
      // 2026年3月18日（水曜日）を想定
      const mockDate = new Date('2026-03-18T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(null);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.currentWeekStart).toBe('2026-03-16'); // 2026年3月16日（月曜日）

      jest.useRealTimers();
    });

    it('システム日付がアンケート期間より前の場合、開始週の開始日を返すこと', async () => {
      // 2026年3月1日を想定
      const mockDate = new Date('2026-03-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(null);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // 2026年3月15日（日曜日）を含む週の月曜日は3月9日
      expect(body.currentWeekStart).toBe('2026-03-09');

      jest.useRealTimers();
    });

    it('システム日付がアンケート期間より後の場合、終了週の開始日を返すこと', async () => {
      // 2026年7月1日を想定
      const mockDate = new Date('2026-07-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // JWT検証のモック
      (jwt.verify as jest.Mock).mockReturnValue({
        email: mockEmail,
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400
      });

      // DynamoDB取得のモック
      (dynamodb.getResponse as jest.Mock).mockResolvedValue(null);

      // イベントの作成
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        queryStringParameters: {
          token: mockToken
        }
      };

      // ハンドラーの実行
      const result = await handler(event as APIGatewayProxyEvent);

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      // 2026年6月27日（土曜日）を含む週の月曜日は6月22日
      expect(body.currentWeekStart).toBe('2026-06-22');

      jest.useRealTimers();
    });
  });
});

