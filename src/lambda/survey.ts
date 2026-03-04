// アンケートLambda関数
// タスク4.1: アンケート回答送信機能の実装

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import {
  SubmitSurveyRequest,
  SurveyResponse,
  ErrorCode,
  JWTPayload
} from '../types';
import { saveResponse, getResponse } from '../utils/dynamodb';
import { isValidDateFormat, sanitizeInput } from '../utils/validators';
import { SURVEY_PERIOD, HTTP_STATUS } from '../utils/constants';
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
 * JWTトークンの検証
 * 要件: 2.1
 */
const verifyToken = (token: string): { valid: boolean; payload?: JWTPayload; errorCode?: ErrorCode; message?: string } => {
  try {
    const jwtSecret = getEnvVar('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
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
 * アンケート期間のチェック
 * 要件: 8.1, 8.2, 8.3, 8.4
 */
const checkSurveyPeriod = (currentDate: Date): { valid: boolean; errorCode?: ErrorCode; message?: string } => {
  const startDate = new Date(SURVEY_PERIOD.START_DATE);
  const endDate = new Date(SURVEY_PERIOD.END_DATE);
  
  // 開始前のチェック（要件: 8.2）
  if (currentDate < startDate) {
    return {
      valid: false,
      errorCode: ErrorCode.PERIOD_001,
      message: `アンケートはまだ開始されていません（開始日: ${SURVEY_PERIOD.START_DATE}）`
    };
  }
  
  // 終了後のチェック（要件: 8.3）
  if (currentDate > endDate) {
    return {
      valid: false,
      errorCode: ErrorCode.PERIOD_002,
      message: `アンケートは終了しました（終了日: ${SURVEY_PERIOD.END_DATE}）`
    };
  }
  
  // 期間内（要件: 8.4）
  return { valid: true };
};

/**
 * 入力データの検証
 * 要件: 2.4, 2.7, 7.5
 */
const validateSurveyData = (
  responses: Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>
): { valid: boolean; errorCode?: ErrorCode; message?: string } => {
  // 回答が空でないかチェック
  if (!responses || Object.keys(responses).length === 0) {
    return {
      valid: false,
      errorCode: ErrorCode.VAL_001,
      message: '回答データが必要です'
    };
  }
  
  // 各日付の検証
  for (const [date, timeSlots] of Object.entries(responses)) {
    // 日付形式の検証とサニタイズ（要件: 7.5）
    try {
      const sanitizedDate = sanitizeInput(date);
      if (!isValidDateFormat(sanitizedDate)) {
        return {
          valid: false,
          errorCode: ErrorCode.VAL_002,
          message: `不正な日付形式です: ${date}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        errorCode: ErrorCode.VAL_003,
        message: `日付に使用できない文字が含まれています: ${date}`
      };
    }
    
    // 時間帯の値の検証
    if (
      typeof timeSlots.morning !== 'boolean' ||
      typeof timeSlots.afternoon !== 'boolean' ||
      typeof timeSlots.evening !== 'boolean'
    ) {
      return {
        valid: false,
        errorCode: ErrorCode.VAL_002,
        message: `時間帯の値が不正です: ${date}`
      };
    }
  }
  
  return { valid: true };
};

/**
 * アンケート回答送信ハンドラー
 * 要件: 2.8, 2.9, 8.1, 8.2, 8.3, 8.4
 */
const handleSubmitSurvey = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // リクエストボディのパース
    if (!event.body) {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: 'リクエストボディが必要です'
        } as SurveyResponse)
      };
    }

    const request: SubmitSurveyRequest = JSON.parse(event.body);
    const { responses } = request;

    // Authorizationヘッダーからトークンを取得
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: '認証トークンが必要です'
        } as SurveyResponse)
      };
    }

    // "Bearer <token>" 形式からトークンを抽出
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
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
        } as SurveyResponse)
      };
    }

    const tokenValidation = verifyToken(token);
    if (!tokenValidation.valid) {
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: tokenValidation.message
        } as SurveyResponse)
      };
    }

    const { email } = tokenValidation.payload!;

    // アンケート期間のチェック（要件: 8.1, 8.2, 8.3, 8.4）
    const currentDate = new Date();
    const periodCheck = checkSurveyPeriod(currentDate);
    if (!periodCheck.valid) {
      logInfo('Survey period check failed', {
        email,
        currentDate: currentDate.toISOString(),
        errorCode: periodCheck.errorCode
      });
      
      return {
        statusCode: HTTP_STATUS.FORBIDDEN,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: periodCheck.message
        } as SurveyResponse)
      };
    }

    // 入力データの検証
    const dataValidation = validateSurveyData(responses);
    if (!dataValidation.valid) {
      logInfo('Survey data validation failed', {
        email,
        errorCode: dataValidation.errorCode
      });
      
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: dataValidation.message
        } as SurveyResponse)
      };
    }

    // DynamoDBへの保存/更新（要件: 2.8, 2.9）
    try {
      await saveResponse(email, responses);
      
      // 保存後のデータを取得
      const savedData = await getResponse(email);
      
      logInfo('Survey response saved successfully', {
        email,
        dateCount: Object.keys(responses).length
      });

      // 成功レスポンス（要件: 7.4）
      const response: SurveyResponse = {
        success: true,
        data: savedData || undefined,
        message: '回答が正常に保存されました'
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
      logError('Failed to save survey response', error as Error, {
        email,
        errorCode: ErrorCode.DB_002
      });
      
      return {
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: '回答の保存に失敗しました。再度お試しください'
        } as SurveyResponse)
      };
    }
  } catch (error) {
    logError('Survey submission error', error as Error);
    
    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'システムエラーが発生しました'
      } as SurveyResponse)
    };
  }
};

/**
 * 週の開始日（月曜日）を計算
 * 要件: 5.1
 */
const getWeekStart = (date: Date): string => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (日曜) から 6 (土曜)
  const diff = day === 0 ? -6 : 1 - day; // 月曜日を週の開始とする
  d.setDate(d.getDate() + diff);
  
  // YYYY-MM-DD形式で返す
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

/**
 * システム日付に基づいて表示すべき週の開始日を計算
 * 要件: 5.1, 5.2, 5.3
 */
const getCurrentWeekStart = (): string => {
  const currentDate = new Date();
  const startDate = new Date(SURVEY_PERIOD.START_DATE);
  const endDate = new Date(SURVEY_PERIOD.END_DATE);
  
  // システム日付がアンケート期間より前の場合（要件: 5.2）
  if (currentDate < startDate) {
    return getWeekStart(startDate);
  }
  
  // システム日付がアンケート期間より後の場合（要件: 5.3）
  if (currentDate > endDate) {
    return getWeekStart(endDate);
  }
  
  // システム日付がアンケート期間内の場合（要件: 5.1）
  return getWeekStart(currentDate);
};

/**
 * アンケート回答取得ハンドラー
 * 要件: 4.1, 4.2, 5.1
 */
const handleGetSurvey = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: '認証トークンが必要です'
        } as SurveyResponse)
      };
    }

    // "Bearer <token>" 形式からトークンを抽出
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    
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
        } as SurveyResponse)
      };
    }

    // JWTトークン検証（要件: 4.1）
    const tokenValidation = verifyToken(token);
    if (!tokenValidation.valid) {
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          message: tokenValidation.message
        } as SurveyResponse)
      };
    }

    const { email } = tokenValidation.payload!;

    // システム日付の週の開始日を計算（要件: 5.1）
    const currentWeekStart = getCurrentWeekStart();

    // メールアドレスをキーとした既存回答の取得（要件: 4.1）
    try {
      const existingResponse = await getResponse(email);
      
      logInfo('Survey response retrieved successfully', {
        email,
        hasData: !!existingResponse,
        currentWeekStart
      });

      // 既存回答の返却（存在しない場合は空）（要件: 4.2, 7.4）
      const response: SurveyResponse = {
        success: true,
        data: existingResponse || undefined,
        currentWeekStart,
        message: existingResponse ? '既存の回答を取得しました' : '回答データがありません'
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
      logError('Failed to retrieve survey response', error as Error, {
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
          message: 'データの取得に失敗しました'
        } as SurveyResponse)
      };
    }
  } catch (error) {
    logError('Survey retrieval error', error as Error);
    
    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'システムエラーが発生しました'
      } as SurveyResponse)
    };
  }
};

/**
 * メインハンドラー
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  
  if (method === 'POST') {
    return handleSubmitSurvey(event);
  } else if (method === 'GET') {
    return handleGetSurvey(event);
  } else {
    return {
      statusCode: HTTP_STATUS.BAD_REQUEST,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: 'サポートされていないHTTPメソッドです'
      })
    };
  }
};
