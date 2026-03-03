/**
 * パフォーマンステスト
 * 
 * **検証対象: 要件 7.1, 7.2, 7.5, 6.6**
 * 
 * このテストは実際のデプロイ済みAPIエンドポイントに対して実行されます。
 * 環境変数 API_ENDPOINT を設定してください。
 * 
 * 実行方法:
 * API_ENDPOINT=https://your-api-gateway-url npm run test:performance
 */

import { performance } from 'perf_hooks';
import * as https from 'https';
import * as http from 'http';

// テスト設定
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000';
const COMMON_PASSWORD = process.env.COMMON_PASSWORD || 'teamviewer2026!';
const ADMIN_EMAIL = 'karimata@okijoh.co.jp';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'supervisor1!';

// テストユーザー生成
function generateTestUsers(count: number): Array<{ email: string; password: string }> {
  return Array.from({ length: count }, (_, i) => ({
    email: `testuser${i + 1}@okijoh.co.jp`,
    password: COMMON_PASSWORD,
  }));
}

// サンプル回答データ生成
function generateSurveyResponse() {
  const today = new Date('2026-03-15');
  const responses: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> = {};
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    responses[dateStr] = {
      morning: Math.random() > 0.5,
      afternoon: Math.random() > 0.5,
      evening: Math.random() > 0.5,
    };
  }
  
  return responses;
}

// HTTPリクエスト実行
async function makeRequest(
  endpoint: string,
  method: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any; duration: number }> {
  const startTime = performance.now();
  
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_ENDPOINT}${endpoint}`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode || 500,
            data: jsonData,
            duration: endTime - startTime,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// ログイン処理
async function login(email: string, password: string): Promise<{ token: string; duration: number }> {
  const result = await makeRequest('/auth/login', 'POST', { email, password });
  
  if (result.status !== 200 || !result.data.success) {
    throw new Error(`Login failed for ${email}: ${result.data.message || 'Unknown error'}`);
  }
  
  return {
    token: result.data.token,
    duration: result.duration,
  };
}

// 回答送信処理
async function submitSurvey(token: string): Promise<number> {
  const responses = generateSurveyResponse();
  const result = await makeRequest('/survey', 'POST', { responses }, token);
  
  if (result.status !== 200 || !result.data.success) {
    throw new Error(`Survey submission failed: ${result.data.message || 'Unknown error'}`);
  }
  
  return result.duration;
}

// レポート生成処理
async function generateReport(token: string): Promise<number> {
  const result = await makeRequest('/report', 'GET', undefined, token);
  
  if (result.status !== 200 || !result.data.success) {
    throw new Error(`Report generation failed: ${result.data.message || 'Unknown error'}`);
  }
  
  return result.duration;
}

describe('パフォーマンステスト', () => {
  // テストスキップ条件: API_ENDPOINTが設定されていない場合
  const shouldSkip = !process.env.API_ENDPOINT;
  
  beforeAll(() => {
    if (shouldSkip) {
      console.log('⚠️  API_ENDPOINTが設定されていないため、パフォーマンステストをスキップします');
      console.log('   実行するには: API_ENDPOINT=https://your-api-url npm run test:performance');
    }
  });
  
  /**
   * シナリオ1: 20名の同時ログイン
   * 
   * **検証対象: 要件 7.5**
   * 合格基準: 各リクエスト30秒以内
   */
  test('20名の同時ログインが30秒以内に完了すること', async () => {
    if (shouldSkip) {
      console.log('スキップ: API_ENDPOINTが未設定');
      return;
    }
    
    const users = generateTestUsers(20);
    const startTime = performance.now();
    
    // 並列ログイン実行
    const loginPromises = users.map(user => login(user.email, user.password));
    const results = await Promise.allSettled(loginPromises);
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    // 結果集計
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const durations = results
      .filter((r): r is PromiseFulfilledResult<{ token: string; duration: number }> => r.status === 'fulfilled')
      .map(r => r.value.duration);
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log('\n📊 20名同時ログインテスト結果:');
    console.log(`   成功: ${successful}/${users.length}`);
    console.log(`   失敗: ${failed}/${users.length}`);
    console.log(`   合計時間: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`   平均応答時間: ${(avgDuration / 1000).toFixed(2)}秒`);
    console.log(`   最大応答時間: ${(maxDuration / 1000).toFixed(2)}秒`);
    console.log(`   最小応答時間: ${(minDuration / 1000).toFixed(2)}秒`);
    
    // 検証: 各リクエストが30秒以内
    expect(maxDuration).toBeLessThan(30000);
    expect(successful).toBe(users.length);
  }, 120000); // タイムアウト: 2分
  
  /**
   * シナリオ2: 25名の同時回答送信
   * 
   * **検証対象: 要件 7.2, 7.5**
   * 合格基準: 各リクエスト30秒以内
   */
  test('25名の同時回答送信が30秒以内に完了すること', async () => {
    if (shouldSkip) {
      console.log('スキップ: API_ENDPOINTが未設定');
      return;
    }
    
    const users = generateTestUsers(25);
    
    // まず全員ログイン
    console.log('\n🔐 25名のログイン中...');
    const loginResults = await Promise.all(
      users.map(user => login(user.email, user.password))
    );
    
    const tokens = loginResults.map(r => r.token);
    
    // 並列回答送信実行
    console.log('📝 25名の回答送信中...');
    const startTime = performance.now();
    const submitPromises = tokens.map(token => submitSurvey(token));
    const results = await Promise.allSettled(submitPromises);
    const endTime = performance.now();
    
    const totalDuration = endTime - startTime;
    
    // 結果集計
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const durations = results
      .filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled')
      .map(r => r.value);
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log('\n📊 25名同時回答送信テスト結果:');
    console.log(`   成功: ${successful}/${users.length}`);
    console.log(`   失敗: ${failed}/${users.length}`);
    console.log(`   合計時間: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`   平均応答時間: ${(avgDuration / 1000).toFixed(2)}秒`);
    console.log(`   最大応答時間: ${(maxDuration / 1000).toFixed(2)}秒`);
    console.log(`   最小応答時間: ${(minDuration / 1000).toFixed(2)}秒`);
    
    // 検証: 各リクエストが30秒以内
    expect(maxDuration).toBeLessThan(30000);
    expect(successful).toBe(users.length);
  }, 180000); // タイムアウト: 3分
  
  /**
   * シナリオ3: レポート生成の応答時間測定
   * 
   * **検証対象: 要件 6.6**
   * 合格基準: レポート生成10秒以内
   */
  test('レポート生成が10秒以内に完了すること', async () => {
    if (shouldSkip) {
      console.log('スキップ: API_ENDPOINTが未設定');
      return;
    }
    
    // 管理者としてログイン
    console.log('\n🔐 管理者ログイン中...');
    const { token } = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    
    // レポート生成を3回実行して平均を取る
    console.log('📊 レポート生成テスト中...');
    const durations: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      const duration = await generateReport(token);
      durations.push(duration);
      console.log(`   試行${i + 1}: ${(duration / 1000).toFixed(2)}秒`);
    }
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log('\n📊 レポート生成テスト結果:');
    console.log(`   平均応答時間: ${(avgDuration / 1000).toFixed(2)}秒`);
    console.log(`   最大応答時間: ${(maxDuration / 1000).toFixed(2)}秒`);
    console.log(`   最小応答時間: ${(minDuration / 1000).toFixed(2)}秒`);
    
    // 検証: レポート生成が10秒以内
    expect(maxDuration).toBeLessThan(10000);
  }, 60000); // タイムアウト: 1分
  
  /**
   * シナリオ4: コールドスタート時間測定
   * 
   * **検証対象: 要件 7.1**
   * 合格基準: コールドスタート5秒未満
   * 
   * 注意: このテストは実際のコールドスタートを測定するため、
   * Lambda関数が一定時間アイドル状態である必要があります。
   */
  test('コールドスタートが5秒未満であること', async () => {
    if (shouldSkip) {
      console.log('スキップ: API_ENDPOINTが未設定');
      return;
    }
    
    console.log('\n⏱️  コールドスタート測定中...');
    console.log('   注意: 正確な測定には、Lambda関数が事前にアイドル状態である必要があります');
    
    // 初回リクエスト（コールドスタートの可能性が高い）
    const testUser = generateTestUsers(1)[0];
    const { duration: coldStartDuration } = await login(testUser.email, testUser.password);
    
    // 2回目のリクエスト（ウォームスタート）
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
    const { duration: warmStartDuration } = await login(testUser.email, testUser.password);
    
    console.log('\n📊 コールドスタート測定結果:');
    console.log(`   初回リクエスト: ${(coldStartDuration / 1000).toFixed(2)}秒`);
    console.log(`   2回目リクエスト: ${(warmStartDuration / 1000).toFixed(2)}秒`);
    console.log(`   差分: ${((coldStartDuration - warmStartDuration) / 1000).toFixed(2)}秒`);
    
    // 検証: 初回リクエストが5秒未満
    // 注意: ネットワーク遅延も含まれるため、実際のコールドスタート時間はこれより短い
    expect(coldStartDuration).toBeLessThan(5000);
  }, 30000); // タイムアウト: 30秒
});
