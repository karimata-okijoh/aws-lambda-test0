// 認証Lambda関数
// タスク2.1: 認証ハンドラーのコア実装

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import { LoginRequest, LoginResponse, ErrorCode, JWTPayload } from '../types';
import { isValidDomain } from '../utils/validators';
import { ADMIN_EMAIL, JWT_EXPIRATION, HTTP_STATUS } from '../utils/constants';
import { logInfo, logError } from '../utils/logger';

/**
 * 環境変数の取得
 */
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
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
const validatePassword = (
  email: string,
  password: string
): { valid: boolean; role?: 'user' | 'admin'; errorCode?: ErrorCode; message?: string } => {
  const commonPassword = getEnvVar('COMMON_PASSWORD');
  const adminPassword = getEnvVar('ADMIN_PASSWORD');

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
    const { email, password } = request;

    // 入力検証
    if (!email || !password) {
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

    // ドメイン検証（要件: 1.2, 1.8）
    const domainValidation = validateDomain(email);
    if (!domainValidation.valid) {
      logInfo('Domain validation failed', { email });
      return {
        statusCode: HTTP_STATUS.FORBIDDEN,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          role: 'user',
          message: domainValidation.message
        } as LoginResponse)
      };
    }

    // パスワード検証（要件: 1.3, 1.4）
    const passwordValidation = validatePassword(email, password);
    if (!passwordValidation.valid) {
      logInfo('Password validation failed', { email });
      return {
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          role: 'user',
          message: passwordValidation.message
        } as LoginResponse)
      };
    }

    // JWTトークン生成（要件: 1.6, 7.3）
    const token = generateToken(email, passwordValidation.role!);

    logInfo('Authentication successful', {
      email,
      role: passwordValidation.role
    });

    // 成功レスポンス（要件: 1.5）
    return {
      statusCode: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        token,
        role: passwordValidation.role!
      } as LoginResponse)
    };

  } catch (error) {
    // エラーハンドリング（要件: 1.7）
    logError('Authentication error', error as Error, {
      path: event.path,
      method: event.httpMethod
    });

    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        role: 'user',
        message: 'システムエラーが発生しました'
      } as LoginResponse)
    };
  }
};
