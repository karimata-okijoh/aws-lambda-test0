// セキュリティユーティリティのプロパティベーステスト
// タスク7.3: セキュリティのプロパティテスト

import * as fc from 'fast-check';
import {
  containsSensitiveData,
  maskSensitiveData,
  getSecretFromEnv,
  sanitizeResponse,
} from '../security';

describe('Security Utility - Property-Based Tests', () => {
  beforeEach(() => {
    // 環境変数のクリア
    delete process.env.COMMON_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.TEST_SECRET;
  });

  afterEach(() => {
    // 環境変数のクリア
    delete process.env.COMMON_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.TEST_SECRET;
  });

  // Feature: teamviewer-survey-app, Property 23: 環境変数からのパスワード読み込み
  // **Validates: Requirements 7.3**
  describe('Property 23: 環境変数からのパスワード読み込み', () => {
    it('任意の起動時に、共通パスワードと管理者パスワードを環境変数から正しく読み込むこと', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (commonPassword, adminPassword) => {
            // 環境変数を設定
            process.env.COMMON_PASSWORD = commonPassword;
            process.env.ADMIN_PASSWORD = adminPassword;

            // 共通パスワードの読み込み
            const loadedCommonPassword = getSecretFromEnv('COMMON_PASSWORD');
            expect(loadedCommonPassword).toBe(commonPassword);

            // 管理者パスワードの読み込み
            const loadedAdminPassword = getSecretFromEnv('ADMIN_PASSWORD');
            expect(loadedAdminPassword).toBe(adminPassword);

            // クリーンアップ
            delete process.env.COMMON_PASSWORD;
            delete process.env.ADMIN_PASSWORD;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意の環境変数キーに対して、設定されていない場合はエラーをスローすること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !process.env[s]),
          async (envKey) => {
            // 環境変数が設定されていないことを確認
            delete process.env[envKey];

            // エラーがスローされることを確認
            expect(() => getSecretFromEnv(envKey)).toThrow();
            expect(() => getSecretFromEnv(envKey)).toThrow(
              `Environment variable ${envKey} is not set`
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の非空パスワード値に対して、正しく読み込めること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (password) => {
            process.env.TEST_SECRET = password;

            const loaded = getSecretFromEnv('TEST_SECRET');
            expect(loaded).toBe(password);

            delete process.env.TEST_SECRET;
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 24: パスワードの非露出
  // **Validates: Requirements 7.4**
  describe('Property 24: パスワードの非露出', () => {
    it('任意のログ出力に対して、パスワード情報が含まれていないこと', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            data: fc.string(),
          }),
          async (obj) => {
            // パスワードを含むオブジェクトを検出
            const hasSensitiveData = containsSensitiveData(obj);
            expect(hasSensitiveData).toBe(true);

            // マスキング処理
            const masked = maskSensitiveData(obj);

            // パスワードがマスキングされていることを確認
            expect((masked as any).password).toBe('***MASKED***');
            expect((masked as any).password).not.toBe(obj.password);

            // 他のフィールドは保持されていることを確認
            expect((masked as any).email).toBe(obj.email);
            expect((masked as any).data).toBe(obj.data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のAPIレスポンスに対して、機密情報が含まれている場合はマスキングされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            success: fc.boolean(),
            token: fc.string({ minLength: 20, maxLength: 100 }),
            apiKey: fc.string({ minLength: 20, maxLength: 100 }),
            userData: fc.record({
              name: fc.string(),
              email: fc.emailAddress(),
            }),
          }),
          async (response) => {
            // sanitizeResponseを使用
            const sanitized = sanitizeResponse(response);

            // トークンとAPIキーがマスキングされていることを確認
            expect((sanitized as any).token).toBe('***MASKED***');
            expect((sanitized as any).apiKey).toBe('***MASKED***');

            // 他のフィールドは保持されていることを確認
            expect((sanitized as any).success).toBe(response.success);
            expect((sanitized as any).userData.name).toBe(response.userData.name);
            expect((sanitized as any).userData.email).toBe(response.userData.email);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のネストされたオブジェクトに対して、深い階層のパスワードもマスキングされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            level1: fc.record({
              level2: fc.record({
                password: fc.string({ minLength: 8, maxLength: 50 }),
                normalField: fc.string(),
              }),
            }),
          }),
          async (nestedObj) => {
            // マスキング処理
            const masked = maskSensitiveData(nestedObj);

            // ネストされたパスワードがマスキングされていることを確認
            expect((masked as any).level1.level2.password).toBe('***MASKED***');
            expect((masked as any).level1.level2.password).not.toBe(
              nestedObj.level1.level2.password
            );

            // 他のフィールドは保持されていることを確認
            expect((masked as any).level1.level2.normalField).toBe(
              nestedObj.level1.level2.normalField
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の配列を含むオブジェクトに対して、配列内の機密情報もマスキングされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            users: fc.array(
              fc.record({
                name: fc.string(),
                password: fc.string({ minLength: 8, maxLength: 50 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          async (objWithArray) => {
            // マスキング処理
            const masked = maskSensitiveData(objWithArray);

            // 配列内の各要素のパスワードがマスキングされていることを確認
            (masked as any).users.forEach((user: any, index: number) => {
              expect(user.password).toBe('***MASKED***');
              expect(user.password).not.toBe(objWithArray.users[index].password);
              expect(user.name).toBe(objWithArray.users[index].name);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の機密情報を含まないオブジェクトに対して、変更されないこと', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string(),
            email: fc.emailAddress(),
            age: fc.integer({ min: 0, max: 120 }),
          }),
          async (safeObj) => {
            // 機密情報が含まれていないことを確認
            const hasSensitiveData = containsSensitiveData(safeObj);
            expect(hasSensitiveData).toBe(false);

            // sanitizeResponseを使用
            const sanitized = sanitizeResponse(safeObj);

            // オブジェクトが変更されていないことを確認
            expect(sanitized).toEqual(safeObj);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
