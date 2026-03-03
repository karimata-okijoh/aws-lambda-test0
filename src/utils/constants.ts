// 定数定義

/**
 * アンケート期間
 */
export const SURVEY_PERIOD = {
  START_DATE: '2026-03-15',
  END_DATE: '2026-06-27'
} as const;

/**
 * 管理者メールアドレス
 */
export const ADMIN_EMAIL = 'karimata@okijoh.co.jp';

/**
 * 許可されたドメイン
 */
export const ALLOWED_DOMAIN = '@okijoh.co.jp';

/**
 * JWTトークンの有効期限（24時間）
 */
export const JWT_EXPIRATION = 24 * 60 * 60; // 秒単位

/**
 * DynamoDBリトライ設定
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000
} as const;

/**
 * 時間帯の定義
 */
export const TIME_SLOTS = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening'
} as const;

/**
 * HTTPステータスコード
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  GATEWAY_TIMEOUT: 504
} as const;
