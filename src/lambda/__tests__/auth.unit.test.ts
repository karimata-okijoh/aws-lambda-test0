// Feature: teamviewer-survey-app
// 認証機能のユニットテスト
// タスク2.3: 認証機能のユニットテスト

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../auth';
import { LoginResponse } from '../../types';
import * as jwt from 'jsonwebtoken';

// 環境変数のモック設定
const MOCK_COMMON_PASSWORD = 'common123';
const MOCK_ADMIN_PASSWORD = 'supervisor1!';
const MOCK_JWT_SECRET = 'test-secret-key';
const ADMIN_EMAIL = 'karimata@okijoh.co.jp';

// 環境変数の設定
process.env.COMMON_PASSWORD = MOCK_COMMON_PASSWORD;
process.env.ADMIN_PASSWORD = MOCK_ADMIN_PASSWORD;
process.env.JWT_SECRET = MOCK_JWT_SECRET;

/**
 * テスト用のAPIGatewayProxyEventを生成
 */
const createMockEvent = (email: string, password: string): APIGatewayProxyEvent => {
  return {
    body: JSON.stringify({ email, password }),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/auth/login',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: ''
  };
};

describe('認証機能のユニットテスト', () => {
  
  /**
   * 要件: 1.3, 1.5
   * 管理者アカウントでのログイン成功テスト
   */
  describe('管理者アカウントでのログイン', () => {
    test('管理者メールアドレスと正しい管理者パスワードでログイン成功', async () => {
      const event = createMockEvent(ADMIN_EMAIL, MOCK_ADMIN_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが200であること
      expect(result.statusCode).toBe(200);
      
      // 認証成功
      expect(response.success).toBe(true);
      
      // 管理者ロールが設定されていること
      expect(response.role).toBe('admin');
      
      // JWTトークンが返されること
      expect(response.token).toBeDefined();
      expect(typeof response.token).toBe('string');
      expect(response.token!.length).toBeGreaterThan(0);
      
      // トークンの内容を検証
      const decoded = jwt.verify(response.token!, MOCK_JWT_SECRET) as any;
      expect(decoded.email).toBe(ADMIN_EMAIL);
      expect(decoded.role).toBe('admin');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    test('管理者メールアドレスと間違った管理者パスワードでログイン失敗', async () => {
      const event = createMockEvent(ADMIN_EMAIL, 'wrong-password');
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // 認証失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('メールアドレスまたはパスワードが正しくありません');
      
      // トークンが返されないこと
      expect(response.token).toBeUndefined();
    });

    test('管理者メールアドレスと共通パスワードでログイン失敗', async () => {
      const event = createMockEvent(ADMIN_EMAIL, MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // 認証失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('メールアドレスまたはパスワードが正しくありません');
    });
  });

  /**
   * 要件: 1.3, 1.7
   * 無効なパスワードでのログイン失敗テスト
   */
  describe('無効なパスワードでのログイン失敗', () => {
    test('一般ユーザーが間違ったパスワードでログイン失敗', async () => {
      const event = createMockEvent('user@okijoh.co.jp', 'wrong-password');
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // 認証失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('メールアドレスまたはパスワードが正しくありません');
      
      // トークンが返されないこと
      expect(response.token).toBeUndefined();
    });

    test('一般ユーザーが管理者パスワードでログイン失敗', async () => {
      const event = createMockEvent('user@okijoh.co.jp', MOCK_ADMIN_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが401であること
      expect(result.statusCode).toBe(401);
      
      // 認証失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('メールアドレスまたはパスワードが正しくありません');
    });

    test('空のパスワードでログイン失敗', async () => {
      const event = createMockEvent('user@okijoh.co.jp', '');
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが400であること
      expect(result.statusCode).toBe(400);
      
      // 認証失敗
      expect(response.success).toBe(false);
      
      // エラーメッセージが返されること
      expect(response.message).toBe('メールアドレスとパスワードは必須です');
    });
  });

  /**
   * 要件: 1.5, 1.7
   * トークン期限切れの処理テスト
   */
  describe('トークン期限切れの処理', () => {
    test('生成されたトークンに有効期限が設定されていること', async () => {
      const event = createMockEvent('user@okijoh.co.jp', MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // 認証成功
      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();

      // トークンをデコードして有効期限を確認
      const decoded = jwt.verify(response.token!, MOCK_JWT_SECRET) as any;
      
      // iatとexpが設定されていること
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      
      // expがiatより大きいこと（未来の時刻）
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
      
      // 有効期限が24時間（86400秒）であること
      const expirationDuration = decoded.exp - decoded.iat;
      expect(expirationDuration).toBe(86400);
    });

    test('期限切れのトークンは検証に失敗すること', () => {
      // 過去の時刻でトークンを生成
      const pastTime = Math.floor(Date.now() / 1000) - 100000; // 過去の時刻
      const expiredToken = jwt.sign(
        {
          email: 'user@okijoh.co.jp',
          role: 'user',
          iat: pastTime - 86400,
          exp: pastTime // 既に期限切れ
        },
        MOCK_JWT_SECRET
      );

      // トークンの検証が失敗することを確認
      expect(() => {
        jwt.verify(expiredToken, MOCK_JWT_SECRET);
      }).toThrow();
    });

    test('有効なトークンは正しく検証されること', async () => {
      const event = createMockEvent('user@okijoh.co.jp', MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();

      // トークンの検証が成功することを確認
      const decoded = jwt.verify(response.token!, MOCK_JWT_SECRET) as any;
      expect(decoded.email).toBe('user@okijoh.co.jp');
      expect(decoded.role).toBe('user');
    });
  });

  /**
   * 追加テスト: 一般ユーザーのログイン成功
   * 要件: 1.3, 1.5
   */
  describe('一般ユーザーのログイン', () => {
    test('一般ユーザーが正しい共通パスワードでログイン成功', async () => {
      const event = createMockEvent('yamada@okijoh.co.jp', MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      // ステータスコードが200であること
      expect(result.statusCode).toBe(200);
      
      // 認証成功
      expect(response.success).toBe(true);
      
      // ユーザーロールが設定されていること
      expect(response.role).toBe('user');
      
      // JWTトークンが返されること
      expect(response.token).toBeDefined();
      
      // トークンの内容を検証
      const decoded = jwt.verify(response.token!, MOCK_JWT_SECRET) as any;
      expect(decoded.email).toBe('yamada@okijoh.co.jp');
      expect(decoded.role).toBe('user');
    });
  });

  /**
   * 追加テスト: エッジケース
   * 要件: 1.7
   */
  describe('エッジケース', () => {
    test('リクエストボディがnullの場合', async () => {
      const event = createMockEvent('', '');
      event.body = null;
      
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.message).toBe('リクエストボディが必要です');
    });

    test('メールアドレスが空の場合', async () => {
      const event = createMockEvent('', MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.message).toBe('メールアドレスとパスワードは必須です');
    });

    test('無効なドメインの場合', async () => {
      const event = createMockEvent('user@gmail.com', MOCK_COMMON_PASSWORD);
      const result = await handler(event);
      const response: LoginResponse = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(response.success).toBe(false);
      expect(response.message).toBe('このアンケートは社内メンバー専用です');
    });
  });
});
