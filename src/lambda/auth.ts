// 認証Lambda関数
// タスク2.1: 認証ハンドラーのコア実装

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import { LoginRequest, LoginResponse, ErrorCode, JWTPayload } from '../types';
import { isValidDomain, sanitizeEmail } from '../utils/validators';
import { ADMIN_EMAIL, JWT_EXPIRATION, HTTP_STATUS } from '../utils/constants';
import { logInfo } from '../utils/logger';
import { globalErrorHandler, AppError, logSuccess } from '../utils/errorHandler';
import { getSecretFromEnv, sanitizeResponse, getSecretFromSSM } from '../utils/security';

// パスワードのキャッシュ
let commonPasswordCache: string | null = null;
let adminPasswordCache: string | null = null;

/**
 * 環境変数の取得（セキュアバージョン）
 * 要件: 7.3
 */
const getPassword = async (type: 'common' | 'admin'): Promise<string> => {
  // キャッシュチェック
  if (type === 'common' && commonPasswordCache) {
    return commonPasswordCache;
  }
  if (type === 'admin' && adminPasswordCache) {
    return adminPasswordCache;
  }

  // SSMパラメータ名を環境変数から取得
  const paramName = type === 'common' 
    ? getEnvVar('COMMON_PASSWORD_PARAM')
    : getEnvVar('ADMIN_PASSWORD_PARAM');

  // SSMから取得
  const password = await getSecretFromSSM(paramName);

  // キャッシュに保存
  if (type === 'common') {
    commonPasswordCache = password;
  } else {
    adminPasswordCache = password;
  }

  return password;
};

/**
 * 環境変数の取得（セキュアバージョン）
 * 要件: 7.3
 */
const getEnvVar = (key: string): string => {
  return getSecretFromEnv(key);
};

/**
 * メールアドレスのドメイン検証
 * 要件: 1.2, 1.8
 */
const validateDomain = (email: string): { valid: boolean; errorCode?: ErrorCode; message?: string } => {
  if (!isValidDomain(email)) {
    return {
      valid: false,
      errorCode: ErrorCode.AUTH_001,
      message: 'このアンケートは社内メンバー専用です'
    };
  }
  return { valid: true };
};

/**
 * パスワード検証
 * 要件: 1.3, 1.4
 */
const validatePassword = async (
  email: string,
  password: string
): Promise<{ valid: boolean; role?: 'user' | 'admin'; errorCode?: ErrorCode; message?: string }> => {
  const commonPassword = await getPassword('common');
  const adminPassword = await getPassword('admin');

  // 管理者アカウントの場合
  if (email === ADMIN_EMAIL) {
    if (password === adminPassword) {
      return { valid: true, role: 'admin' };
    }
    return {
      valid: false,
      errorCode: ErrorCode.AUTH_002,
      message: 'メールアドレスまたはパスワードが正しくありません'
    };
  }

  // 一般ユーザーの場合
  if (password === commonPassword) {
    return { valid: true, role: 'user' };
  }

  return {
    valid: false,
    errorCode: ErrorCode.AUTH_002,
    message: 'メールアドレスまたはパスワードが正しくありません'
  };
};

/**
 * JWTトークン生成
 * 要件: 1.6
 */
const generateToken = (email: string, role: 'user' | 'admin'): string => {
  const jwtSecret = getEnvVar('JWT_SECRET');
  const now = Math.floor(Date.now() / 1000);

  const payload: JWTPayload = {
    email,
    role,
    iat: now,
    exp: now + JWT_EXPIRATION
  };

  return jwt.sign(payload, jwtSecret);
};

/**
 * 認証Lambda関数ハンドラー
 * 要件: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 7.3
 */
export const handler = async (
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
          role: 'user',
          message: 'リクエストボディが必要です'
        } as LoginResponse)
      };
    }

    const request: LoginRequest = JSON.parse(event.body);
    let { email, password } = request;

    // 入力検証（空白文字のトリミング後にチェック）
    if (!email || !password || email.trim() === '' || password.trim() === '') {
      return {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          role: 'user',
          message: 'メールアドレスとパスワードは必須です'
        } as LoginResponse)
      };
    }

    // 空白のトリミング
    email = email.trim();
    password = password.trim();

    // メールアドレスのサニタイズ（要件: 7.5）
    try {
      email = sanitizeEmail(email);
    } catch (sanitizeError) {
      logInfo('Email sanitization failed', { email });
      throw new AppError(ErrorCode.VAL_002);
    }

    // ドメイン検証（要件: 1.2, 1.8）
    const domainValidation = validateDomain(email);
    if (!domainValidation.valid) {
      logInfo('Domain validation failed', { email });
      throw new AppError(ErrorCode.AUTH_001);
    }

    // パスワード検証（要件: 1.3, 1.4）
    const passwordValidation = await validatePassword(email, password);
    if (!passwordValidation.valid) {
      logInfo('Password validation failed', { email });
      throw new AppError(ErrorCode.AUTH_002);
    }

    // JWTトークン生成（要件: 1.6, 7.3）
    const token = generateToken(email, passwordValidation.role!);

    // 成功ログの記録（要件: 10.2）
    logSuccess('authentication', {
      email,
      role: passwordValidation.role
    });

    // 成功レスポンス（要件: 1.5, 7.4）
    const response: LoginResponse = {
      success: true,
      token,
      role: passwordValidation.role!
    };

    // レスポンスのセキュリティチェック（要件: 7.4）
    const sanitizedResponse = sanitizeResponse(response);

    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(sanitizedResponse)
    };

  } catch (error) {
    // グローバルエラーハンドラーを使用（要件: 1.7, 10.1）
    return await globalErrorHandler(
      error instanceof AppError ? error.errorCode : (error as Error),
      {
        requestId: event.requestContext?.requestId,
        functionName: 'AuthLambda',
        userId: event.body ? JSON.parse(event.body).email : undefined
      }
    );
  }
};
