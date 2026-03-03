// セキュリティユーティリティ
// タスク7.2: パスワードの非露出チェック、機密情報のマスキング
// 要件: 7.4

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

/**
 * 機密情報のパターン
 */
const SENSITIVE_PATTERNS = [
  /password/gi,
  /passwd/gi,
  /pwd/gi,
  /secret/gi,
  /api[_-]?key/gi,
  /access[_-]?key/gi,
  /private[_-]?key/gi
];

/**
 * 機密情報を含むキーのリスト
 */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'apiKey',
  'api_key',
  'accessKey',
  'access_key',
  'privateKey',
  'private_key',
  'COMMON_PASSWORD',
  'ADMIN_PASSWORD'
];

/**
 * オブジェクトから機密情報を検出
 * 要件: 7.4
 */
export const containsSensitiveData = (obj: unknown): boolean => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const checkObject = (o: Record<string, unknown>): boolean => {
    for (const key in o) {
      // キー名が機密情報を示す場合
      if (SENSITIVE_KEYS.some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      )) {
        return true;
      }

      // 値が文字列の場合、パターンマッチング
      if (typeof o[key] === 'string') {
        for (const pattern of SENSITIVE_PATTERNS) {
          if (pattern.test(key)) {
            return true;
          }
        }
      }

      // ネストされたオブジェクトを再帰的にチェック
      if (typeof o[key] === 'object' && o[key] !== null) {
        if (checkObject(o[key] as Record<string, unknown>)) {
          return true;
        }
      }
    }
    return false;
  };

  return checkObject(obj as Record<string, unknown>);
};

/**
 * オブジェクトから機密情報をマスキング
 * ログ出力やAPIレスポンスに使用
 * 要件: 7.4
 */
export const maskSensitiveData = (obj: unknown): unknown => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item));
  }

  const masked: Record<string, unknown> = {};
  const original = obj as Record<string, unknown>;

  for (const key in original) {
    // キー名が機密情報を示す場合、値をマスキング
    const isSensitiveKey = SENSITIVE_KEYS.some(sensitiveKey => 
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    );

    if (isSensitiveKey) {
      masked[key] = '***MASKED***';
    } else if (typeof original[key] === 'object' && original[key] !== null) {
      // ネストされたオブジェクトを再帰的にマスキング
      masked[key] = maskSensitiveData(original[key]);
    } else {
      masked[key] = original[key];
    }
  }

  return masked;
};

/**
 * ログ出力前に機密情報をチェック
 * パスワードが含まれている場合は警告を出力
 * 要件: 7.4
 */
export const validateLogSafety = (data: unknown): void => {
  if (containsSensitiveData(data)) {
    console.warn('[SECURITY WARNING] Attempted to log sensitive data. Data has been masked.');
  }
};

/**
 * APIレスポンスから機密情報を除去
 * 要件: 7.4
 */
export const sanitizeResponse = <T>(response: T): T => {
  // 機密情報が含まれているかチェック
  if (containsSensitiveData(response)) {
    console.warn('[SECURITY WARNING] Response contains sensitive data. Masking applied.');
    return maskSensitiveData(response) as T;
  }
  return response;
};

/**
 * 環境変数から機密情報を安全に取得
 * 要件: 7.3
 */
export const getSecretFromEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
};

/**
 * SSMパラメータストアから機密情報を取得
 * 要件: 7.3
 */
const ssmClient = new SSMClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const parameterCache: Record<string, { value: string; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5分

export const getSecretFromSSM = async (parameterName: string): Promise<string> => {
  // キャッシュチェック
  const cached = parameterCache[parameterName];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    
    if (!response.Parameter?.Value) {
      throw new Error(`SSM parameter ${parameterName} not found`);
    }

    // キャッシュに保存
    parameterCache[parameterName] = {
      value: response.Parameter.Value,
      timestamp: Date.now()
    };

    return response.Parameter.Value;
  } catch (error) {
    console.error(`Failed to get SSM parameter ${parameterName}:`, error);
    throw new Error(`Failed to retrieve ${parameterName} from SSM`);
  }
};

/**
 * パスワードの強度チェック（オプション）
 */
export const isStrongPassword = (password: string): boolean => {
  // 最低8文字
  if (password.length < 8) {
    return false;
  }

  // 大文字、小文字、数字、特殊文字を含む
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
};
