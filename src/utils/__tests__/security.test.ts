// セキュリティユーティリティのユニットテスト
// タスク7.2: セキュリティ関連の実装のテスト

import {
  containsSensitiveData,
  maskSensitiveData,
  validateLogSafety,
  sanitizeResponse,
  getSecretFromEnv,
  isStrongPassword
} from '../security';

describe('Security Utilities', () => {
  describe('containsSensitiveData', () => {
    it('パスワードを含むオブジェクトを検出すること', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        password: 'secret123'
      };
      expect(containsSensitiveData(data)).toBe(true);
    });

    it('トークンを含むオブジェクトを検出すること', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        token: 'abc123xyz'
      };
      expect(containsSensitiveData(data)).toBe(true);
    });

    it('機密情報を含まないオブジェクトを正しく判定すること', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        role: 'user'
      };
      expect(containsSensitiveData(data)).toBe(false);
    });

    it('ネストされたオブジェクト内のパスワードを検出すること', () => {
      const data = {
        user: {
          email: 'test@okijoh.co.jp',
          credentials: {
            password: 'secret123'
          }
        }
      };
      expect(containsSensitiveData(data)).toBe(true);
    });

    it('環境変数名（COMMON_PASSWORD）を検出すること', () => {
      const data = {
        COMMON_PASSWORD: 'secret123'
      };
      expect(containsSensitiveData(data)).toBe(true);
    });
  });

  describe('maskSensitiveData', () => {
    it('パスワードフィールドをマスキングすること', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        password: 'secret123'
      };
      const masked = maskSensitiveData(data) as Record<string, unknown>;
      expect(masked.email).toBe('test@okijoh.co.jp');
      expect(masked.password).toBe('***MASKED***');
    });

    it('トークンフィールドをマスキングすること', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        token: 'abc123xyz'
      };
      const masked = maskSensitiveData(data) as Record<string, unknown>;
      expect(masked.email).toBe('test@okijoh.co.jp');
      expect(masked.token).toBe('***MASKED***');
    });

    it('ネストされたオブジェクト内のパスワードをマスキングすること', () => {
      const data = {
        user: {
          email: 'test@okijoh.co.jp',
          credentials: {
            password: 'secret123'
          }
        }
      };
      const masked = maskSensitiveData(data) as Record<string, unknown>;
      const user = masked.user as Record<string, unknown>;
      const credentials = user.credentials as Record<string, unknown>;
      expect(credentials.password).toBe('***MASKED***');
    });

    it('配列内のオブジェクトもマスキングすること', () => {
      const data = {
        users: [
          { email: 'user1@okijoh.co.jp', password: 'pass1' },
          { email: 'user2@okijoh.co.jp', password: 'pass2' }
        ]
      };
      const masked = maskSensitiveData(data) as Record<string, unknown>;
      const users = masked.users as Array<Record<string, unknown>>;
      expect(users[0].password).toBe('***MASKED***');
      expect(users[1].password).toBe('***MASKED***');
    });

    it('機密情報を含まないデータはそのまま返すこと', () => {
      const data = {
        email: 'test@okijoh.co.jp',
        role: 'user'
      };
      const masked = maskSensitiveData(data);
      expect(masked).toEqual(data);
    });
  });

  describe('validateLogSafety', () => {
    it('機密情報を含むデータに対して警告を出力すること', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const data = {
        email: 'test@okijoh.co.jp',
        password: 'secret123'
      };
      
      validateLogSafety(data);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SECURITY WARNING] Attempted to log sensitive data. Data has been masked.'
      );
      
      consoleSpy.mockRestore();
    });

    it('機密情報を含まないデータに対しては警告を出力しないこと', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const data = {
        email: 'test@okijoh.co.jp',
        role: 'user'
      };
      
      validateLogSafety(data);
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('sanitizeResponse', () => {
    it('機密情報を含むレスポンスをマスキングすること', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const response = {
        success: true,
        data: {
          email: 'test@okijoh.co.jp',
          password: 'secret123'
        }
      };
      
      const sanitized = sanitizeResponse(response);
      const data = sanitized.data as Record<string, unknown>;
      
      expect(data.password).toBe('***MASKED***');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('機密情報を含まないレスポンスはそのまま返すこと', () => {
      const response = {
        success: true,
        data: {
          email: 'test@okijoh.co.jp',
          role: 'user'
        }
      };
      
      const sanitized = sanitizeResponse(response);
      
      expect(sanitized).toEqual(response);
    });
  });

  describe('getSecretFromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('環境変数から値を取得できること', () => {
      process.env.TEST_SECRET = 'test-value';
      expect(getSecretFromEnv('TEST_SECRET')).toBe('test-value');
    });

    it('環境変数が設定されていない場合はエラーをスローすること', () => {
      expect(() => getSecretFromEnv('NON_EXISTENT_VAR')).toThrow(
        'Environment variable NON_EXISTENT_VAR is not set'
      );
    });
  });

  describe('isStrongPassword', () => {
    it('強力なパスワードを正しく判定すること', () => {
      expect(isStrongPassword('StrongPass123!')).toBe(true);
      expect(isStrongPassword('MyP@ssw0rd')).toBe(true);
    });

    it('短すぎるパスワードを拒否すること', () => {
      expect(isStrongPassword('Short1!')).toBe(false);
    });

    it('大文字を含まないパスワードを拒否すること', () => {
      expect(isStrongPassword('lowercase123!')).toBe(false);
    });

    it('小文字を含まないパスワードを拒否すること', () => {
      expect(isStrongPassword('UPPERCASE123!')).toBe(false);
    });

    it('数字を含まないパスワードを拒否すること', () => {
      expect(isStrongPassword('NoNumbers!')).toBe(false);
    });

    it('特殊文字を含まないパスワードを拒否すること', () => {
      expect(isStrongPassword('NoSpecialChar123')).toBe(false);
    });
  });
});
