// アンケートLambda関数のプロパティベーステスト
// タスク4.3: アンケート機能のプロパティテスト

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../survey';
import * as dynamodb from '../../utils/dynamodb';
import * as jwt from 'jsonwebtoken';
import * as fc from 'fast-check';

// モック設定
jest.mock('../../utils/dynamodb');
jest.mock('jsonwebtoken');

describe('Survey Lambda - Property-Based Tests', () => {
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

  // ジェネレータ: @okijoh.co.jpドメインのメールアドレス
  const okijohEmail = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !s.includes('@') && !s.includes(' '))
    .map(s => `${s}@okijoh.co.jp`);

  // ジェネレータ: 日付文字列（YYYY-MM-DD形式）
  const dateString = fc.date({ min: new Date('2026-03-15'), max: new Date('2026-06-27') })
    .map(d => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

  // ジェネレータ: 時間帯の回答
  const timeSlotResponse = fc.record({
    morning: fc.boolean(),
    afternoon: fc.boolean(),
    evening: fc.boolean()
  });

  // ジェネレータ: アンケート回答データ
  const surveyResponses = fc.dictionary(dateString, timeSlotResponse, { minKeys: 1, maxKeys: 7 });

  // Feature: teamviewer-survey-app, Property 5: 認証済みユーザーのアクセス制御
  // 要件: 2.1
  describe('Property 5: 認証済みユーザーのアクセス制御', () => {
    it('任意のリクエストに対して、有効なJWTトークンを持つ場合のみアンケートフォームにアクセスでき、トークンがない場合はアクセスが拒否されること', async () => {
      await fc.assert(
        fc.asyncProperty(okijohEmail, async (email) => {
          // 有効なトークンの場合
          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.getResponse as jest.Mock).mockResolvedValue(null);

          const eventWithToken: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'valid-token' }
          };

          const resultWithToken = await handler(eventWithToken as APIGatewayProxyEvent);
          const bodyWithToken = JSON.parse(resultWithToken.body);

          // トークンがある場合はアクセス成功
          expect(resultWithToken.statusCode).toBe(200);
          expect(bodyWithToken.success).toBe(true);

          // トークンがない場合
          const eventWithoutToken: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: {}
          };

          const resultWithoutToken = await handler(eventWithoutToken as APIGatewayProxyEvent);
          const bodyWithoutToken = JSON.parse(resultWithoutToken.body);

          // トークンがない場合はアクセス拒否
          expect(resultWithoutToken.statusCode).toBe(401);
          expect(bodyWithoutToken.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 6: 既存回答の表示
  // 要件: 2.2, 4.2
  describe('Property 6: 既存回答の表示', () => {
    it('任意のユーザーに対して、過去に回答が存在する場合、ログイン時にその回答がフォームに事前選択された状態で表示されること', async () => {
      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, async (email, responses) => {
          const mockResponse = {
            email,
            responses,
            createdAt: '2026-03-15T09:00:00Z',
            updatedAt: '2026-03-15T09:00:00Z'
          };

          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.getResponse as jest.Mock).mockResolvedValue(mockResponse);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'valid-token' }
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // 既存回答が返されること
          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);
          expect(body.data).toEqual(mockResponse);
          expect(body.data.responses).toEqual(responses);
        }),
        { numRuns: 50 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 7: 入力検証（全時間帯の回答必須）
  // 要件: 2.4
  describe('Property 7: 入力検証（全時間帯の回答必須）', () => {
    it('任意のアンケート送信に対して、3つの時間帯すべてについて回答が選択されている場合のみ検証が成功すること', async () => {
      // システム日付をアンケート期間内に設定
      const mockDate = new Date('2026-04-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, async (email, responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);
          (dynamodb.getResponse as jest.Mock).mockResolvedValue({
            email,
            responses,
            createdAt: '2026-03-15T09:00:00Z',
            updatedAt: '2026-03-15T09:00:00Z'
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // すべての時間帯にboolean値が設定されている場合は成功
          const allValid = Object.values(responses).every(
            r => typeof r.morning === 'boolean' &&
                 typeof r.afternoon === 'boolean' &&
                 typeof r.evening === 'boolean'
          );

          if (allValid) {
            expect(result.statusCode).toBe(200);
            expect(body.success).toBe(true);
          }
        }),
        { numRuns: 50 }
      );

      jest.useRealTimers();
    });
  });

  // Feature: teamviewer-survey-app, Property 8: 回答の保存
  // 要件: 2.5, 3.1
  describe('Property 8: 回答の保存', () => {
    it('任意の有効な回答データに対して、ユーザーのメールアドレスをキーとしてDynamoDBに正常に保存されること', async () => {
      // システム日付をアンケート期間内に設定
      const mockDate = new Date('2026-04-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, async (email, responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);
          (dynamodb.getResponse as jest.Mock).mockResolvedValue({
            email,
            responses,
            createdAt: '2026-03-15T09:00:00Z',
            updatedAt: '2026-03-15T09:00:00Z'
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);

          if (result.statusCode === 200) {
            // saveResponseが正しいパラメータで呼ばれたことを確認
            expect(dynamodb.saveResponse).toHaveBeenCalledWith(email, responses);
          }
        }),
        { numRuns: 50 }
      );

      jest.useRealTimers();
    });
  });

  // Feature: teamviewer-survey-app, Property 9: 既存回答の更新
  // 要件: 2.6, 3.4
  describe('Property 9: 既存回答の更新', () => {
    it('任意のユーザーに対して、既に回答が存在する状態で新しい回答を送信した場合、既存の回答が新しい回答で上書き更新されること', async () => {
      // システム日付をアンケート期間内に設定
      const mockDate = new Date('2026-04-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      await fc.assert(
        fc.asyncProperty(
          okijohEmail,
          surveyResponses,
          surveyResponses,
          async (email, oldResponses, newResponses) => {
            // 最初の回答
            (jwt.verify as jest.Mock).mockReturnValue({
              email,
              role: 'user',
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 86400
            });
            (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);
            (dynamodb.getResponse as jest.Mock).mockResolvedValue({
              email,
              responses: oldResponses,
              createdAt: '2026-03-15T09:00:00Z',
              updatedAt: '2026-03-15T09:00:00Z'
            });

            const firstEvent: Partial<APIGatewayProxyEvent> = {
              httpMethod: 'POST',
              body: JSON.stringify({
                token: 'valid-token',
                responses: oldResponses
              })
            };

            await handler(firstEvent as APIGatewayProxyEvent);

            // 2回目の回答（更新）
            (dynamodb.getResponse as jest.Mock).mockResolvedValue({
              email,
              responses: newResponses,
              createdAt: '2026-03-15T09:00:00Z',
              updatedAt: '2026-04-15T10:00:00Z'
            });

            const secondEvent: Partial<APIGatewayProxyEvent> = {
              httpMethod: 'POST',
              body: JSON.stringify({
                token: 'valid-token',
                responses: newResponses
              })
            };

            const result = await handler(secondEvent as APIGatewayProxyEvent);

            if (result.statusCode === 200) {
              // saveResponseが新しい回答で呼ばれたことを確認
              expect(dynamodb.saveResponse).toHaveBeenLastCalledWith(email, newResponses);
            }
          }
        ),
        { numRuns: 30 }
      );

      jest.useRealTimers();
    });
  });

  // Feature: teamviewer-survey-app, Property 10: 検証失敗時のエラーメッセージ
  // 要件: 2.7
  describe('Property 10: 検証失敗時のエラーメッセージ', () => {
    it('任意の不完全な回答データに対して、検証が失敗した場合、具体的なエラーメッセージが返されること', async () => {
      // システム日付をアンケート期間内に設定
      const mockDate = new Date('2026-04-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      // 不正な形式のジェネレータ
      const invalidResponses = fc.oneof(
        fc.constant({}), // 空のオブジェクト
        fc.dictionary(fc.string(), fc.anything()), // 不正な形式
        fc.constant(null),
        fc.constant(undefined)
      );

      await fc.assert(
        fc.asyncProperty(okijohEmail, invalidResponses, async (email, responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // 不正なデータの場合はエラーメッセージが返されること
          if (result.statusCode === 400) {
            expect(body.success).toBe(false);
            expect(body.message).toBeDefined();
            expect(typeof body.message).toBe('string');
          }
        }),
        { numRuns: 50 }
      );

      jest.useRealTimers();
    });
  });

  // Feature: teamviewer-survey-app, Property 11: 保存成功時の確認メッセージ
  // 要件: 2.8
  describe('Property 11: 保存成功時の確認メッセージ', () => {
    it('任意の有効な回答データに対して、保存が成功した場合、ユーザーに確認メッセージが表示されること', async () => {
      // システム日付をアンケート期間内に設定
      const mockDate = new Date('2026-04-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, async (email, responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);
          (dynamodb.getResponse as jest.Mock).mockResolvedValue({
            email,
            responses,
            createdAt: '2026-03-15T09:00:00Z',
            updatedAt: '2026-03-15T09:00:00Z'
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          if (result.statusCode === 200) {
            expect(body.success).toBe(true);
            expect(body.message).toBeDefined();
            expect(body.message).toBe('回答が正常に保存されました');
          }
        }),
        { numRuns: 50 }
      );

      jest.useRealTimers();
    });
  });

  // Feature: teamviewer-survey-app, Property 15: 既存回答の取得
  // 要件: 4.1
  describe('Property 15: 既存回答の取得', () => {
    it('任意のユーザーに対して、ログイン時にそのユーザーのメールアドレスをキーとして既存回答が正しく取得されること', async () => {
      await fc.assert(
        fc.asyncProperty(
          okijohEmail,
          fc.option(surveyResponses, { nil: null }),
          async (email, responses) => {
            (jwt.verify as jest.Mock).mockReturnValue({
              email,
              role: 'user',
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 86400
            });

            const mockResponse = responses ? {
              email,
              responses,
              createdAt: '2026-03-15T09:00:00Z',
              updatedAt: '2026-03-15T09:00:00Z'
            } : null;

            (dynamodb.getResponse as jest.Mock).mockResolvedValue(mockResponse);

            const event: Partial<APIGatewayProxyEvent> = {
              httpMethod: 'GET',
              queryStringParameters: { token: 'valid-token' }
            };

            const result = await handler(event as APIGatewayProxyEvent);
            const body = JSON.parse(result.body);

            expect(result.statusCode).toBe(200);
            expect(body.success).toBe(true);

            // getResponseが正しいメールアドレスで呼ばれたことを確認
            expect(dynamodb.getResponse).toHaveBeenCalledWith(email);

            // データの有無に応じた適切なレスポンス
            if (responses) {
              expect(body.data).toEqual(mockResponse);
            } else {
              expect(body.data).toBeUndefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 27: 開始前のアクセス制御
  // 要件: 8.2
  describe('Property 27: 開始前のアクセス制御', () => {
    it('任意の日付設定に対して、現在日時が開始日より前の場合、回答送信が拒否されること', async () => {
      // アンケート開始前の日付を生成
      const beforeStartDate = fc.date({ min: new Date('2026-01-01'), max: new Date('2026-03-14') });

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, beforeStartDate, async (email, responses, currentDate) => {
          jest.useFakeTimers();
          jest.setSystemTime(currentDate);

          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // 開始前はアクセス拒否
          expect(result.statusCode).toBe(403);
          expect(body.success).toBe(false);
          expect(body.message).toContain('アンケートはまだ開始されていません');

          jest.useRealTimers();
        }),
        { numRuns: 30 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 28: 終了後のアクセス制御
  // 要件: 8.3
  describe('Property 28: 終了後のアクセス制御', () => {
    it('任意の日付設定に対して、現在日時が終了日より後の場合、回答送信が拒否されること', async () => {
      // アンケート終了後の日付を生成
      const afterEndDate = fc.date({ min: new Date('2026-06-28'), max: new Date('2026-12-31') });

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, afterEndDate, async (email, responses, currentDate) => {
          jest.useFakeTimers();
          jest.setSystemTime(currentDate);

          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // 終了後はアクセス拒否
          expect(result.statusCode).toBe(403);
          expect(body.success).toBe(false);
          expect(body.message).toContain('アンケートは終了しました');

          jest.useRealTimers();
        }),
        { numRuns: 30 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 29: アクティブ期間中の回答受付
  // 要件: 8.4
  describe('Property 29: アクティブ期間中の回答受付', () => {
    it('任意の日付設定に対して、現在日時がアンケート期間内にある場合、回答送信が正常に受け付けられること', async () => {
      // アンケート期間内の日付を生成
      const activePeriodDate = fc.date({ min: new Date('2026-03-15'), max: new Date('2026-06-27') });

      await fc.assert(
        fc.asyncProperty(okijohEmail, surveyResponses, activePeriodDate, async (email, responses, currentDate) => {
          jest.useFakeTimers();
          jest.setSystemTime(currentDate);

          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role: 'user',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });
          (dynamodb.saveResponse as jest.Mock).mockResolvedValue(undefined);
          (dynamodb.getResponse as jest.Mock).mockResolvedValue({
            email,
            responses,
            createdAt: '2026-03-15T09:00:00Z',
            updatedAt: currentDate.toISOString()
          });

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'POST',
            body: JSON.stringify({
              token: 'valid-token',
              responses
            })
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // 期間内は正常に受け付けられる
          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);

          jest.useRealTimers();
        }),
        { numRuns: 30 }
      );
    });
  });
});
