// 入力サニタイズ機能のユニットテスト
// タスク7.2: 入力データのサニタイズ機能のテスト
// 要件: 7.5

import { sanitizeInput, sanitizeEmail } from '../validators';

describe('Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('基本的なトリミングを行うこと', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
      expect(sanitizeInput('test\n')).toBe('test');
    });

    it('HTMLタグをエスケープすること（XSS対策）', () => {
      // scriptタグは検出されてエラーになる
      expect(() => sanitizeInput('<script>alert("xss")</script>'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
      
      // 通常のHTMLタグはエスケープされる
      expect(sanitizeInput('<div>test</div>'))
        .toBe('&lt;div&gt;test&lt;&#x2F;div&gt;');
    });

    it('特殊文字をエスケープすること', () => {
      expect(sanitizeInput('test & test')).toBe('test &amp; test');
      expect(sanitizeInput('test < test')).toBe('test &lt; test');
      expect(sanitizeInput('test > test')).toBe('test &gt; test');
      expect(sanitizeInput('test "quote"')).toBe('test &quot;quote&quot;');
      expect(sanitizeInput("test 'quote'")).toBe('test &#x27;quote&#x27;');
    });

    it('SQLインジェクション試行を検出すること', () => {
      // OR/AND演算子を含むパターンを検出（スペースと=が必要）
      expect(() => sanitizeInput("test OR 1=1"))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
      
      // セミコロンとコメントを含むパターンを検出
      expect(() => sanitizeInput('1; DROP TABLE users--'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
      
      // セミコロンとスラッシュコメント
      expect(() => sanitizeInput('test; /*comment*/'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
    });

    it('JavaScriptプロトコルを検出すること', () => {
      expect(() => sanitizeInput('javascript:alert("xss")'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
    });

    it('イベントハンドラーを検出すること', () => {
      expect(() => sanitizeInput('<img src=x onerror=alert(1)>'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
    });

    it('安全な文字列はそのまま通すこと', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World');
      expect(sanitizeInput('test@example.com')).toBe('test@example.com');
      expect(sanitizeInput('2026-03-15')).toBe('2026-03-15');
    });

    it('空文字列を正しく処理すること', () => {
      expect(sanitizeInput('')).toBe('');
    });

    it('文字列以外の入力に対して空文字列を返すこと', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('メールアドレスをトリミングして小文字化すること', () => {
      expect(sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
      expect(sanitizeEmail('USER@OKIJOH.CO.JP')).toBe('user@okijoh.co.jp');
    });

    it('有効なメールアドレスを正しく処理すること', () => {
      expect(sanitizeEmail('test@okijoh.co.jp')).toBe('test@okijoh.co.jp');
      expect(sanitizeEmail('user.name@example.com')).toBe('user.name@example.com');
      expect(sanitizeEmail('user+tag@example.co.jp')).toBe('user+tag@example.co.jp');
    });

    it('不正なメールアドレス形式を拒否すること', () => {
      expect(() => sanitizeEmail('invalid-email'))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('test@'))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('test@@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
    });

    it('危険な文字を含むメールアドレスを拒否すること', () => {
      // 正規表現で不正な形式として検出される（VAL_002）
      expect(() => sanitizeEmail('test<script>@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('test;@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('test"@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
    });

    it('SQLインジェクション試行を拒否すること', () => {
      // 正規表現で不正な形式として検出される（VAL_002）
      expect(() => sanitizeEmail("test'@example.com"))
        .toThrow('VAL_002: 入力形式が正しくありません');
      
      expect(() => sanitizeEmail('test\\@example.com'))
        .toThrow('VAL_002: 入力形式が正しくありません');
    });

    it('空文字列を正しく処理すること', () => {
      expect(() => sanitizeEmail(''))
        .toThrow('VAL_002: 入力形式が正しくありません');
    });

    it('文字列以外の入力に対してエラーをスローすること', () => {
      expect(() => sanitizeEmail(null as any))
        .toThrow('VAL_002: 入力形式が正しくありません');
      expect(() => sanitizeEmail(undefined as any))
        .toThrow('VAL_002: 入力形式が正しくありません');
    });
  });

  describe('統合テスト: XSS攻撃パターン', () => {
    const xssPatterns = [
      // scriptタグはエスケープされるが、エラーは出ない（安全に処理される）
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
      '<body onload=alert(1)>'
    ];

    xssPatterns.forEach(pattern => {
      it(`XSSパターンを検出すること: ${pattern}`, () => {
        expect(() => sanitizeInput(pattern)).toThrow();
      });
    });

    it('scriptタグは検出されてエラーになること', () => {
      expect(() => sanitizeInput('<script>alert("XSS")</script>'))
        .toThrow('VAL_003: 入力内容に使用できない文字が含まれています');
    });
  });

  describe('統合テスト: SQLインジェクション攻撃パターン', () => {
    const sqlPatterns = [
      "test OR 1=1",  // OR演算子パターン
      "1; DROP TABLE users--",
      "test; --comment",
      "test; /*comment*/"
    ];

    sqlPatterns.forEach(pattern => {
      it(`SQLインジェクションパターンを検出すること: ${pattern}`, () => {
        expect(() => sanitizeInput(pattern)).toThrow();
      });
    });

    // エスケープされるが、エラーにはならないパターン
    it('シンプルなシングルクォートはエスケープされること', () => {
      const result = sanitizeInput("admin'");
      expect(result).toBe('admin&#x27;');
    });
  });
});
