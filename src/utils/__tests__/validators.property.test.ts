// バリデーターのプロパティベーステスト
// タスク7.3: セキュリティのプロパティテスト

import * as fc from 'fast-check';
import { sanitizeInput, sanitizeEmail } from '../validators';

describe('Validators - Property-Based Tests', () => {
  // Feature: teamviewer-survey-app, Property 25: 入力データのサニタイズ
  // **Validates: Requirements 7.5**
  describe('Property 25: 入力データのサニタイズ', () => {
    it('任意の安全な入力データに対して、サニタイズ後も基本的な内容が保持されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 })
            .filter(s => !/<|>|&|"|'|\//.test(s)) // HTML特殊文字を除外
            .filter(s => !/(\bOR\b|\bAND\b)\s+.*=/gi.test(s))
            .filter(s => !/(;|--|\/\*|DROP|DELETE|UPDATE|INSERT)/gi.test(s))
            .filter(s => !/javascript:/gi.test(s))
            .filter(s => !/on\w+\s*=/gi.test(s)),
          async (safeInput) => {
            // サニタイズ処理
            const sanitized = sanitizeInput(safeInput);

            // トリミングされた入力と一致することを確認
            expect(sanitized).toBe(safeInput.trim());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のHTML特殊文字に対して、適切にエスケープされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            prefix: fc.string({ minLength: 0, maxLength: 20 }),
            specialChar: fc.constantFrom('&', '<', '>', '"', "'", '/'),
            suffix: fc.string({ minLength: 0, maxLength: 20 }),
          }),
          async ({ prefix, specialChar, suffix }) => {
            const input = `${prefix}${specialChar}${suffix}`;

            // サニタイズ処理
            const sanitized = sanitizeInput(input);

            // 特殊文字がエスケープされていることを確認
            switch (specialChar) {
              case '&':
                expect(sanitized).toContain('&amp;');
                break;
              case '<':
                expect(sanitized).toContain('&lt;');
                break;
              case '>':
                expect(sanitized).toContain('&gt;');
                break;
              case '"':
                expect(sanitized).toContain('&quot;');
                break;
              case "'":
                expect(sanitized).toContain('&#x27;');
                break;
              case '/':
                expect(sanitized).toContain('&#x2F;');
                break;
            }

            // 元の特殊文字が単独で含まれていないことを確認（&はエスケープ後も含まれる）
            if (specialChar !== '&') {
              expect(sanitized).not.toContain(specialChar);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意のSQLインジェクション試行に対して、エラーをスローすること', async () => {
      const sqlInjectionPatterns = fc.constantFrom(
        "' OR '1'='1",
        "1; DROP TABLE users",
        "1' AND 1=1 --",
        "' OR 1=1 --"
      );

      await fc.assert(
        fc.asyncProperty(sqlInjectionPatterns, async (maliciousInput) => {
          // エラーがスローされることを確認
          expect(() => sanitizeInput(maliciousInput)).toThrow();
          expect(() => sanitizeInput(maliciousInput)).toThrow('VAL_003');
        }),
        { numRuns: 50 }
      );
    });

    it('任意のXSS攻撃試行に対して、エラーをスローすること', async () => {
      const xssPatterns = fc.constantFrom(
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<iframe src="javascript:alert(1)">',
        '<body onload=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<a href="javascript:alert(1)">click</a>'
      );

      await fc.assert(
        fc.asyncProperty(xssPatterns, async (maliciousInput) => {
          // エラーがスローされることを確認
          expect(() => sanitizeInput(maliciousInput)).toThrow();
          expect(() => sanitizeInput(maliciousInput)).toThrow('VAL_003');
        }),
        { numRuns: 50 }
      );
    });

    it('任意の空白文字に対して、トリミングが正しく行われること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 })
            .filter(s => !s.includes('<') && !s.includes('>')),
          fc.string({ minLength: 0, maxLength: 10 }).map(s => s.replace(/\S/g, ' ')),
          fc.string({ minLength: 0, maxLength: 10 }).map(s => s.replace(/\S/g, ' ')),
          async (content, leadingSpaces, trailingSpaces) => {
            const input = `${leadingSpaces}${content}${trailingSpaces}`;

            // サニタイズ処理
            const sanitized = sanitizeInput(input);

            // 前後の空白が削除されていることを確認
            expect(sanitized).not.toMatch(/^\s/);
            expect(sanitized).not.toMatch(/\s$/);

            // 内容が保持されていることを確認（HTMLエスケープを考慮）
            expect(sanitized.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の複数のHTML特殊文字を含む入力に対して、すべてエスケープされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom('&', '<', '>', '"', "'", '/'), {
            minLength: 2,
            maxLength: 6,
          }),
          async (specialChars) => {
            const input = specialChars.join('');

            // サニタイズ処理
            const sanitized = sanitizeInput(input);

            // すべての特殊文字がエスケープされていることを確認
            // &はエスケープ後も&amp;に含まれるため除外
            expect(sanitized).not.toContain('<');
            expect(sanitized).not.toContain('>');
            // &はエスケープ後も含まれるのでチェックしない
            // expect(sanitized).not.toContain('&');

            // エスケープされた文字列が含まれていることを確認
            expect(sanitized).toMatch(/(&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;)/);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 25: メールアドレスのサニタイズ', () => {
    it('任意の有効なメールアドレスに対して、正しくサニタイズされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress().filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)),
          async (email) => {
            // サニタイズ処理
            const sanitized = sanitizeEmail(email);

            // 小文字化とトリミングが行われていることを確認
            expect(sanitized).toBe(email.trim().toLowerCase());

            // メールアドレスの形式が保持されていることを確認
            expect(sanitized).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意の不正なメールアドレス形式に対して、エラーをスローすること', async () => {
      const invalidEmails = fc.constantFrom(
        'invalid',
        'invalid@',
        '@invalid.com',
        'invalid@.com',
        'invalid@domain',
        'invalid domain@test.com',
        'invalid<script>@test.com'
      );

      await fc.assert(
        fc.asyncProperty(invalidEmails, async (invalidEmail) => {
          // エラーがスローされることを確認
          expect(() => sanitizeEmail(invalidEmail)).toThrow();
          expect(() => sanitizeEmail(invalidEmail)).toThrow('VAL_002');
        }),
        { numRuns: 50 }
      );
    });

    it('任意の危険な文字を含むメールアドレスに対して、エラーをスローすること', async () => {
      const dangerousChars = fc.constantFrom('<', '>', '"', "'", ';', '\\', '/', '(', ')');

      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress().filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)),
          dangerousChars,
          async (email, dangerousChar) => {
            const maliciousEmail = email.replace('@', `${dangerousChar}@`);

            // エラーがスローされることを確認
            expect(() => sanitizeEmail(maliciousEmail)).toThrow();
            // VAL_002（形式エラー）またはVAL_003（危険な文字）のいずれかがスローされる
            try {
              sanitizeEmail(maliciousEmail);
            } catch (error: any) {
              expect(error.message).toMatch(/VAL_00[23]/);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('任意の大文字を含むメールアドレスに対して、小文字化されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9]+$/.test(s)),
          fc.constantFrom('com', 'jp', 'org', 'net'),
          async (localPart, domain, tld) => {
            const email = `${localPart}@${domain}.${tld}`;

            // サニタイズ処理
            const sanitized = sanitizeEmail(email);

            // すべて小文字になっていることを確認
            expect(sanitized).toBe(email.toLowerCase());
            expect(sanitized).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('任意の前後の空白を含むメールアドレスに対して、トリミングされること', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress().filter(email => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)),
          fc.string({ minLength: 1, maxLength: 5 }).map(s => s.replace(/\S/g, ' ')),
          fc.string({ minLength: 1, maxLength: 5 }).map(s => s.replace(/\S/g, ' ')),
          async (email, leadingSpaces, trailingSpaces) => {
            const input = `${leadingSpaces}${email}${trailingSpaces}`;

            // サニタイズ処理
            const sanitized = sanitizeEmail(input);

            // 前後の空白が削除されていることを確認
            expect(sanitized).toBe(email.trim().toLowerCase());
            expect(sanitized).not.toMatch(/^\s/);
            expect(sanitized).not.toMatch(/\s$/);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
