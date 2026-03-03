// Feature: teamviewer-survey-app
// 認証機能のプロパティベーステスト
// タスク2.2: 認証機能のプロパティテスト

import * as fc from 'fast-check';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../auth';
import { LoginResponse } from '../../types';

// 環境変数のモック設定
const MOCK_COMMON_PASSWORD = 'common123';
const MOCK_ADMIN_PASSWORD = 'supervisor1!';
const MOCK_JWT_SECRET = 'test-secret-key';
const ADMIN_EMAIL = 'karimata@okijoh.co.jp';
const VALID_DOMAIN = '@okijoh.co.jp';

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

/**
 * カスタムジェネレータ: @okijoh.co.jpドメインのメールアドレス
 */
const validDomainEmail = (): fc.Arbitrary<string> => {
  return fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => s.length > 0 && !s.includes('@') && s.trim().length > 0 && !/\s/.test(s) && /^[a-zA-Z0-9._+-]+$/.test(s))
    .map(localPart => `${localPart}${VALID_DOMAIN}`);
};

/**
 * カスタムジェネレータ: 無効なドメインのメールアドレス
 */
const invalidDomainEmail = (): fc.Arbitrary<string> => {
  const invalidDomains = ['@gmail.com', '@yahoo.co.jp', '@example.com', '@test.com'];
  return fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('@') && s.trim().length > 0 && !/\s/.test(s) && /^[a-zA-Z0-9._+-]+$/.test(s)),
    fc.constantFrom(...invalidDomains)
  ).map(([localPart, domain]) => `${localPart}${domain}`);
};

describe('認証機能のプロパティテスト', () => {
  
  /**
   * Property 1: ドメイン検証とエラーメッセージ
   * 要件: 1.2, 1.8
   * 
   * 任意のメールアドレスに対して、@okijoh.co.jpドメインのものは認証処理に進み、
   * それ以外のドメインは「このアンケートは社内メンバー専用です」というエラーメッセージを返すこと
   */
  test('Property 1: ドメイン検証とエラーメッセージ', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidDomainEmail(),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !/\s/.test(s)),
        async (email, password) => {
          const event = createMockEvent(email, password);
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // 無効なドメインの場合、403エラーと特定のメッセージを返すこと
          expect(result.statusCode).toBe(403);
          expect(response.success).toBe(false);
          expect(response.message).toBe('このアンケートは社内メンバー専用です');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: パスワード検証
   * 要件: 1.3
   * 
   * 任意のパスワード入力に対して、事前設定された共通パスワードまたは管理者パスワードと
   * 一致する場合のみ認証が成功すること
   */
  test('Property 2: パスワード検証', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDomainEmail(),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !/\s/.test(s)),
        async (email, password) => {
          const event = createMockEvent(email, password);
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // 管理者アカウントの場合
          if (email === ADMIN_EMAIL) {
            if (password === MOCK_ADMIN_PASSWORD) {
              // 管理者パスワードが正しい場合、認証成功
              expect(response.success).toBe(true);
              expect(response.role).toBe('admin');
            } else {
              // 管理者パスワードが間違っている場合、認証失敗
              expect(response.success).toBe(false);
              expect(result.statusCode).toBe(401);
            }
          } else {
            // 一般ユーザーの場合
            if (password === MOCK_COMMON_PASSWORD) {
              // 共通パスワードが正しい場合、認証成功
              expect(response.success).toBe(true);
              expect(response.role).toBe('user');
            } else {
              // 共通パスワードが間違っている場合、認証失敗
              expect(response.success).toBe(false);
              expect(result.statusCode).toBe(401);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: 認証成功時のセッション作成
   * 要件: 1.5
   * 
   * 任意の有効な認証情報（正しいドメインと正しいパスワード）に対して、
   * 認証が成功した場合、JWTトークンを含むセッションが作成されること
   */
  test('Property 3: 認証成功時のセッション作成', async () => {
    await fc.assert(
      fc.asyncProperty(
        validDomainEmail(),
        async (email) => {
          // 正しいパスワードを使用
          const password = email === ADMIN_EMAIL ? MOCK_ADMIN_PASSWORD : MOCK_COMMON_PASSWORD;
          const event = createMockEvent(email, password);
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // 認証成功時、JWTトークンが返されること
          expect(result.statusCode).toBe(200);
          expect(response.success).toBe(true);
          expect(response.token).toBeDefined();
          expect(typeof response.token).toBe('string');
          expect(response.token!.length).toBeGreaterThan(0);
          
          // ロールが正しく設定されていること
          if (email === ADMIN_EMAIL) {
            expect(response.role).toBe('admin');
          } else {
            expect(response.role).toBe('user');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: 認証失敗時のエラーメッセージ
   * 要件: 1.7
   * 
   * 任意の無効な認証情報（間違ったパスワードまたは無効なドメイン）に対して、
   * 認証が失敗した場合、適切なエラーメッセージが返されること
   */
  test('Property 4: 認証失敗時のエラーメッセージ', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // ケース1: 有効なドメイン + 間違ったパスワード
          fc.tuple(
            validDomainEmail(),
            fc.string({ minLength: 1, maxLength: 50 })
              .filter(pwd => pwd !== MOCK_COMMON_PASSWORD && pwd !== MOCK_ADMIN_PASSWORD && pwd.trim().length > 0 && !/\s/.test(pwd))
          ),
          // ケース2: 無効なドメイン + 任意のパスワード
          fc.tuple(
            invalidDomainEmail(),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !/\s/.test(s))
          )
        ),
        async ([email, password]) => {
          const event = createMockEvent(email, password);
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // 認証失敗時、successがfalseであること
          expect(response.success).toBe(false);
          
          // 適切なエラーメッセージが返されること
          expect(response.message).toBeDefined();
          expect(typeof response.message).toBe('string');
          expect(response.message!.length).toBeGreaterThan(0);
          
          // ドメインが無効な場合
          if (!email.endsWith(VALID_DOMAIN)) {
            expect(result.statusCode).toBe(403);
            expect(response.message).toBe('このアンケートは社内メンバー専用です');
          } else {
            // パスワードが間違っている場合
            expect(result.statusCode).toBe(401);
            expect(response.message).toBe('メールアドレスまたはパスワードが正しくありません');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 追加プロパティ: トークンが存在しない場合の処理
   * 要件: 1.7
   */
  test('Property: トークンが存在しない場合の適切なエラー処理', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(null, undefined, ''),
        async (invalidToken) => {
          const event = createMockEvent('', '');
          event.body = invalidToken as any;
          
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // リクエストボディが無効な場合、400エラーを返すこと
          expect(result.statusCode).toBe(400);
          expect(response.success).toBe(false);
          expect(response.message).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 追加プロパティ: 空のメールアドレスまたはパスワードの処理
   * 要件: 1.7
   */
  test('Property: 空のメールアドレスまたはパスワードの検証', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant({ email: '', password: 'test' }),
          fc.constant({ email: 'test@okijoh.co.jp', password: '' }),
          fc.constant({ email: '', password: '' })
        ),
        async (credentials) => {
          const event = createMockEvent(credentials.email, credentials.password);
          const result = await handler(event);
          const response: LoginResponse = JSON.parse(result.body);

          // 必須フィールドが空の場合、400エラーを返すこと
          expect(result.statusCode).toBe(400);
          expect(response.success).toBe(false);
          expect(response.message).toBe('メールアドレスとパスワードは必須です');
        }
      ),
      { numRuns: 50 }
    );
  });
});
