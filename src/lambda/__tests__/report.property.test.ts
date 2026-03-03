// レポートLambda関数のプロパティベーステスト
// タスク6.2: レポート機能のプロパティテスト

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../report';
import * as dynamodb from '../../utils/dynamodb';
import * as jwt from 'jsonwebtoken';
import * as fc from 'fast-check';

// モック設定
jest.mock('../../utils/dynamodb');
jest.mock('jsonwebtoken');

describe('Report Lambda - Property-Based Tests', () => {
  const mockJwtSecret = 'test-secret';
  const adminEmail = 'karimata@okijoh.co.jp';

  beforeEach(() => {
    // 環境変数の設定
    process.env.JWT_SECRET = mockJwtSecret;
    process.env.RESPONSES_TABLE = 'test-responses-table';
    
    // モックのリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 環境変数のクリア
    delete process.env.JWT_SECRET;
    delete process.env.RESPONSES_TABLE;
  });

  // ジェネレータ: @okijoh.co.jpドメインのメールアドレス
  const okijohEmail = fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !s.includes('@') && !s.includes(' '))
    .map(s => `${s}@okijoh.co.jp`);

  // ジェネレータ: 管理者以外のメールアドレス
  const nonAdminEmail = okijohEmail.filter(email => email !== adminEmail);

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

  // ジェネレータ: ユーザーの回答データ
  const userResponse = fc.record({
    email: okijohEmail,
    responses: surveyResponses,
    createdAt: fc.constant('2026-03-15T09:00:00Z'),
    updatedAt: fc.constant('2026-03-15T09:00:00Z')
  });

  // ジェネレータ: 回答データセット（0〜25件）
  const responseDataset = fc.array(userResponse, { minLength: 0, maxLength: 25 });

  // Feature: teamviewer-survey-app, Property 18: 管理者アクセス制御
  // **Validates: Requirements 6.1**
  describe('Property 18: 管理者アクセス制御', () => {
    it('任意のリクエストに対して、管理者権限を持つユーザーのみがアクセスでき、それ以外のユーザーはアクセスが拒否されること', async () => {
      await fc.assert(
        fc.asyncProperty(fc.oneof(fc.constant(adminEmail), nonAdminEmail), async (email) => {
          const isAdmin = email === adminEmail;
          const role = isAdmin ? 'admin' : 'user';

          (jwt.verify as jest.Mock).mockReturnValue({
            email,
            role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          (dynamodb.getAllResponses as jest.Mock).mockResolvedValue([]);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'valid-token' },
            headers: {}
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          if (isAdmin) {
            // 管理者の場合はアクセス成功
            expect(result.statusCode).toBe(200);
            expect(body.success).toBe(true);
          } else {
            // 一般ユーザーの場合はアクセス拒否
            expect(result.statusCode).toBe(403);
            expect(body.success).toBe(false);
            expect(body.message).toBe('この機能にアクセスする権限がありません');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 19: 回答総数の計算
  // **Validates: Requirements 6.2**
  describe('Property 19: 回答総数の計算', () => {
    it('任意の回答データセットに対して、Report_Generatorは正しく回答総数を計算すること', async () => {
      await fc.assert(
        fc.asyncProperty(responseDataset, async (responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email: adminEmail,
            role: 'admin',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(responses);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'admin-token' },
            headers: {}
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);
          expect(body.data).toBeDefined();

          // 回答総数が正しく計算されていること
          expect(body.data.totalResponses).toBe(responses.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 20: 時間帯別統計の集計
  // **Validates: Requirements 6.3**
  describe('Property 20: 時間帯別統計の集計', () => {
    it('任意の回答データセットに対して、Report_Generatorは各時間帯ごとの利用者数と利用率を正しく集計すること', async () => {
      await fc.assert(
        fc.asyncProperty(responseDataset, async (responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email: adminEmail,
            role: 'admin',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(responses);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'admin-token' },
            headers: {}
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);
          expect(body.data).toBeDefined();

          // 期待される時間帯別の利用者数を計算
          const expectedCounts = {
            morning: 0,
            afternoon: 0,
            evening: 0
          };

          responses.forEach(response => {
            let userMorning = false;
            let userAfternoon = false;
            let userEvening = false;

            Object.values(response.responses).forEach(dayResponse => {
              if (dayResponse.morning) userMorning = true;
              if (dayResponse.afternoon) userAfternoon = true;
              if (dayResponse.evening) userEvening = true;
            });

            if (userMorning) expectedCounts.morning++;
            if (userAfternoon) expectedCounts.afternoon++;
            if (userEvening) expectedCounts.evening++;
          });

          // 期待される利用率を計算
          const totalResponses = responses.length;
          const calculatePercentage = (count: number): number => {
            return totalResponses > 0 ? Math.round((count / totalResponses) * 100 * 100) / 100 : 0;
          };

          // 時間帯別の統計が正しく計算されていること
          expect(body.data.timeSlotStats.morning.count).toBe(expectedCounts.morning);
          expect(body.data.timeSlotStats.afternoon.count).toBe(expectedCounts.afternoon);
          expect(body.data.timeSlotStats.evening.count).toBe(expectedCounts.evening);

          expect(body.data.timeSlotStats.morning.percentage).toBe(calculatePercentage(expectedCounts.morning));
          expect(body.data.timeSlotStats.afternoon.percentage).toBe(calculatePercentage(expectedCounts.afternoon));
          expect(body.data.timeSlotStats.evening.percentage).toBe(calculatePercentage(expectedCounts.evening));
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 21: 利用パターンの分類
  // **Validates: Requirements 6.4**
  describe('Property 21: 利用パターンの分類', () => {
    it('任意の回答データセットに対して、Report_Generatorは利用パターンを正しく分類すること', async () => {
      await fc.assert(
        fc.asyncProperty(responseDataset, async (responses) => {
          (jwt.verify as jest.Mock).mockReturnValue({
            email: adminEmail,
            role: 'admin',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(responses);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'admin-token' },
            headers: {}
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);
          expect(body.data).toBeDefined();

          // 期待される利用パターンを計算
          const expectedPatterns = {
            allTimeSlots: 0,
            twoTimeSlots: 0,
            oneTimeSlot: 0,
            noUsage: 0
          };

          responses.forEach(response => {
            let userMorning = false;
            let userAfternoon = false;
            let userEvening = false;

            Object.values(response.responses).forEach(dayResponse => {
              if (dayResponse.morning) userMorning = true;
              if (dayResponse.afternoon) userAfternoon = true;
              if (dayResponse.evening) userEvening = true;
            });

            const usedTimeSlots = [userMorning, userAfternoon, userEvening].filter(Boolean).length;

            switch (usedTimeSlots) {
              case 3:
                expectedPatterns.allTimeSlots++;
                break;
              case 2:
                expectedPatterns.twoTimeSlots++;
                break;
              case 1:
                expectedPatterns.oneTimeSlot++;
                break;
              case 0:
                expectedPatterns.noUsage++;
                break;
            }
          });

          // 利用パターンが正しく分類されていること
          expect(body.data.usagePatterns.allTimeSlots).toBe(expectedPatterns.allTimeSlots);
          expect(body.data.usagePatterns.twoTimeSlots).toBe(expectedPatterns.twoTimeSlots);
          expect(body.data.usagePatterns.oneTimeSlot).toBe(expectedPatterns.oneTimeSlot);
          expect(body.data.usagePatterns.noUsage).toBe(expectedPatterns.noUsage);

          // パターンの合計が回答総数と一致すること
          const totalPatterns = expectedPatterns.allTimeSlots + 
                               expectedPatterns.twoTimeSlots + 
                               expectedPatterns.oneTimeSlot + 
                               expectedPatterns.noUsage;
          expect(totalPatterns).toBe(responses.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: teamviewer-survey-app, Property 30: 終了後のレポート生成許可
  // **Validates: Requirements 8.5**
  describe('Property 30: 終了後のレポート生成許可', () => {
    it('任意の日付設定に対して、アンケート期間が終了した後でも、管理者はレポート生成にアクセスできること', async () => {
      // アンケート終了後の日付を生成
      const afterEndDate = fc.date({ min: new Date('2026-06-28'), max: new Date('2026-12-31') });

      await fc.assert(
        fc.asyncProperty(afterEndDate, responseDataset, async (currentDate, responses) => {
          jest.useFakeTimers();
          jest.setSystemTime(currentDate);

          (jwt.verify as jest.Mock).mockReturnValue({
            email: adminEmail,
            role: 'admin',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 86400
          });

          (dynamodb.getAllResponses as jest.Mock).mockResolvedValue(responses);

          const event: Partial<APIGatewayProxyEvent> = {
            httpMethod: 'GET',
            queryStringParameters: { token: 'admin-token' },
            headers: {}
          };

          const result = await handler(event as APIGatewayProxyEvent);
          const body = JSON.parse(result.body);

          // アンケート期間終了後でも管理者はレポート生成にアクセスできる
          expect(result.statusCode).toBe(200);
          expect(body.success).toBe(true);
          expect(body.data).toBeDefined();
          expect(body.data.totalResponses).toBe(responses.length);

          jest.useRealTimers();
        }),
        { numRuns: 100 }
      );
    });
  });
});
