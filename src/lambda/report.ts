// レポートLambda関数
// タスク6.1: レポート生成機能の実装

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import {
  ReportResponse,
  ErrorCode,
  JWTPayload
} from '../types';
import { getAllResponses } from '../utils/dynamodb';
import { ADMIN_EMAIL, HTTP_STATUS, SURVEY_PERIOD } from '../utils/constants';
import { logInfo, logError } from '../utils/logger';
import { getSecretFromEnv, sanitizeResponse } from '../utils/security';

/**
 * 環境変数の取得（セキュアバージョン）
 * 要件: 7.3
 */
const getEnvVar = (key: string): string => {
  return getSecretFromEnv(key);
};

/**
 * JWTトークンの検証と管理者権限チェック
 * 要件: 6.1
 */
const verifyAdminToken = (token: string): { valid: boolean; payload?: JWTPayload; errorCode?: ErrorCode; message?: string } => {
  try {
    const jwtSecret = getEnvVar('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // 管理者権限チェック
    if (decoded.email !== ADMIN_EMAIL || decoded.role !== 'admin') {
      return {
        valid: false,
        errorCode: ErrorCode.AUTH_005,
        message: 'この機能にアクセスする権限がありません'
      };
    }
    
    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        errorCode: ErrorCode.AUTH_003,
        message: 'セッションが期限切れです。再度ログインしてください'
      };
    }
    return {
      valid: false,
      errorCode: ErrorCode.AUTH_004,
      message: '無効な認証情報です'
    };
  }
};

/**
 * 時間帯別の統計を集計
 * 要件: 6.3
 */
interface TimeSlotCounts {
  morning: number;
  afternoon: number;
  evening: number;
}

const calculateTimeSlotStats = (
  responses: Array<{
    email: string;
    responses: Record<string, {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
    }>;
  }>,
  totalResponses: number
): {
  morning: { count: number; percentage: number };
  afternoon: { count: number; percentage: number };
  evening: { count: number; percentage: number };
} => {
  const counts: TimeSlotCounts = {
    morning: 0,
    afternoon: 0,
    evening: 0
  };

  // 各ユーザーの回答を集計
  responses.forEach(response => {
    let userMorning = false;
    let userAfternoon = false;
    let userEvening = false;

    // 各日付の回答をチェック（1日でも使用していればカウント）
    Object.values(response.responses).forEach(dayResponse => {
      if (dayResponse.morning) userMorning = true;
      if (dayResponse.afternoon) userAfternoon = true;
      if (dayResponse.evening) userEvening = true;
    });

    if (userMorning) counts.morning++;
    if (userAfternoon) counts.afternoon++;
    if (userEvening) counts.evening++;
  });

  // パーセンテージの計算
  const calculatePercentage = (count: number): number => {
    return totalResponses > 0 ? Math.round((count / totalResponses) * 100 * 100) / 100 : 0;
  };

  return {
    morning: {
      count: counts.morning,
      percentage: calculatePercentage(counts.morning)
    },
    afternoon: {
      count: counts.afternoon,
      percentage: calculatePercentage(counts.afternoon)
    },
    evening: {
      count: counts.evening,
      percentage: calculatePercentage(counts.evening)
    }
  };
};

/**
 * 利用パターンの分類
 * 要件: 6.4
 */
const calculateUsagePatterns = (
  responses: Array<{
    email: string;
    responses: Record<string, {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
    }>;
  }>
): {
  allTimeSlots: number;
  twoTimeSlots: number;
  oneTimeSlot: number;
  noUsage: number;
} => {
  const patterns = {
    allTimeSlots: 0,
    twoTimeSlots: 0,
    oneTimeSlot: 0,
    noUsage: 0
  };

  responses.forEach(response => {
    let userMorning = false;
    let userAfternoon = false;
    let userEvening = false;

    // 各日付の回答をチェック（1日でも使用していればカウント）
    Object.values(response.responses).forEach(dayResponse => {
      if (dayResponse.morning) userMorning = true;
      if (dayResponse.afternoon) userAfternoon = true;
      if (dayResponse.evening) userEvening = true;
    });

    // 使用している時間帯の数をカウント
    const usedTimeSlots = [userMorning, userAfternoon, userEvening].filter(Boolean).length;

    switch (usedTimeSlots) {
      case 3:
        patterns.allTimeSlots++;
        break;
      case 2:
        patterns.twoTimeSlots++;
        break;
      case 1:
        patterns.oneTimeSlot++;
        break;
      case 0:
        patterns.noUsage++;
        break;
    }
  });

  return patterns;
};

/**
 * 日別利用者数の集計
 * 要件: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2
 */
const calculateDailyUsage = (
  responses: Array<{
    email: string;
    responses: Record<string, {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
    }>;
  }>,
  startDate: string,
  endDate: string
): Array<{ date: string; userCount: number }> => {
  // 開始日から終了日までの全日付を生成
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    dates.push(current.toISOString().split('T')[0]);
  }

  // 各日付のユニークユーザー数をカウント
  const dailyUsage = dates.map(date => {
    const uniqueUsers = new Set<string>();
    
    responses.forEach(response => {
      const dayResponse = response.responses[date];
      // その日にいずれかの時間帯で利用していればカウント
      if (dayResponse && (dayResponse.morning || dayResponse.afternoon || dayResponse.evening)) {
        uniqueUsers.add(response.email);
      }
    });
    
    return {
      date,
      userCount: uniqueUsers.size
    };
  });

  return dailyUsage;
};

/**
 * レポート生成Lambda関数ハンドラー
 * 要件: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // クエリパラメータまたはヘッダーからトークンを取得
    const token = event.queryStringParameters?.token || 
                  event.headers?.Authorization?.replace('Bearer ', '') ||
                  event.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: '認証トークンが必要です'
        } as ReportResponse)
      };
    }

    // JWTトークン検証と管理者権限チェック（要件: 6.1）
    const tokenValidation = verifyAdminToken(token);
    if (!tokenValidation.valid) {
      logInfo('Admin token validation failed', {
        errorCode: tokenValidation.errorCode
      });

      return {
        statusCode: tokenValidation.errorCode === ErrorCode.AUTH_005 
          ? HTTP_STATUS.FORBIDDEN 
          : HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: tokenValidation.message
        } as ReportResponse)
      };
    }

    const { email } = tokenValidation.payload!;

    // DynamoDBから全回答をスキャン（要件: 6.2）
    try {
      const allResponses = await getAllResponses();
      
      // 回答総数の計算（要件: 6.2）
      const totalResponses = allResponses.length;
      const targetCount = 25; // 対象人数（20-25名）
      const responseRate = targetCount > 0 
        ? Math.round((totalResponses / targetCount) * 100 * 100) / 100 
        : 0;

      // 時間帯別の集計計算（要件: 6.3）
      const timeSlotStats = calculateTimeSlotStats(allResponses, totalResponses);

      // 利用パターンの分類（要件: 6.4）
      const usagePatterns = calculateUsagePatterns(allResponses);

      // 日別利用者数の集計（要件: 1.1, 1.2, 1.3, 1.4, 1.5）
      let dailyUsage: Array<{ date: string; userCount: number }> | undefined;
      let dailyUsageError = false;
      
      try {
        dailyUsage = calculateDailyUsage(
          allResponses,
          SURVEY_PERIOD.START_DATE,
          SURVEY_PERIOD.END_DATE
        );
      } catch (error) {
        dailyUsageError = true;
        logError('Daily usage calculation failed', error as Error, {
          errorCode: ErrorCode.SYS_003
        });
      }

      // レポートデータの生成（要件: 6.5）
      const generatedAt = new Date().toISOString();

      logInfo('Report generated successfully', {
        email,
        totalResponses,
        generatedAt
      });

      // レスポンス（要件: 6.6 - 10秒以内に結果を生成、7.4 - パスワードの非露出）
      const response: ReportResponse = {
        success: true,
        data: {
          totalResponses,
          targetCount,
          responseRate,
          timeSlotStats,
          usagePatterns,
          ...(dailyUsage && { dailyUsage }), // 集計成功時のみ追加
          generatedAt
        },
        message: dailyUsageError 
          ? 'レポートを生成しましたが、日別利用者数の集計に失敗しました' 
          : 'レポートが正常に生成されました'
      };

      // レスポンスのセキュリティチェック
      const sanitizedResponseData = sanitizeResponse(response);

      return {
        statusCode: HTTP_STATUS.OK,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(sanitizedResponseData)
      };

    } catch (error) {
      logError('Failed to generate report', error as Error, {
        email,
        errorCode: ErrorCode.DB_003
      });

      return {
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'レポートの生成に失敗しました'
        } as ReportResponse)
      };
    }

  } catch (error) {
    logError('Report generation error', error as Error);

    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'システムエラーが発生しました'
      } as ReportResponse)
    };
  }
};
