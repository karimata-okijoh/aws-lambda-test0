// コア型定義ファイル
// TeamViewerアンケートアプリケーションの型定義

/**
 * ログインリクエスト
 */
export interface LoginRequest {
  email: string;        // @okijoh.co.jpドメイン
  password: string;     // 共通パスワードまたは管理者パスワード
}

/**
 * ログインレスポンス
 */
export interface LoginResponse {
  success: boolean;
  token?: string;       // JWTトークン
  role: 'user' | 'admin';
  message?: string;     // エラーメッセージ
}

/**
 * アンケート回答送信リクエスト
 */
export interface SubmitSurveyRequest {
  token?: string;                   // 認証トークン（Authorizationヘッダーで送信される場合はオプション）
  responses: {
    [date: string]: {               // 日付をキー（YYYY-MM-DD形式）
      morning: boolean;             // 午前中（9:00-12:00）
      afternoon: boolean;           // 午後（13:00-18:00）
      evening: boolean;             // 18時以降（18:00-）
    }
  };
}

/**
 * アンケート回答取得リクエスト
 */
export interface GetSurveyRequest {
  token: string;                    // 認証トークン
  startDate?: string;               // 取得開始日（オプション）
  endDate?: string;                 // 取得終了日（オプション）
}

/**
 * アンケートレスポンス
 */
export interface SurveyResponse {
  success: boolean;
  data?: {
    email: string;
    responses: {
      [date: string]: {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }
    };
    createdAt: string;              // ISO 8601形式
    updatedAt: string;              // ISO 8601形式
  };
  currentWeekStart?: string;        // システム日付の週の開始日
  message?: string;
}

/**
 * レポート生成リクエスト
 */
export interface GenerateReportRequest {
  token: string;                    // 管理者トークン
}

/**
 * レポートレスポンス
 */
export interface ReportResponse {
  success: boolean;
  data?: {
    totalResponses: number;         // 回答総数
    targetCount: number;            // 対象人数（20-25名）
    responseRate: number;           // 回答率（%）
    timeSlotStats: {
      morning: {
        count: number;              // 利用者数
        percentage: number;         // 利用率（%）
      };
      afternoon: {
        count: number;
        percentage: number;
      };
      evening: {
        count: number;
        percentage: number;
      };
    };
    usagePatterns: {
      allTimeSlots: number;         // 全時間帯利用
      twoTimeSlots: number;         // 2時間帯利用
      oneTimeSlot: number;          // 1時間帯利用
      noUsage: number;              // 未利用
    };
    generatedAt: string;            // レポート生成日時
  };
  message?: string;
}

/**
 * JWTペイロード
 */
export interface JWTPayload {
  email: string;
  role: 'user' | 'admin';
  iat: number;                      // 発行日時
  exp: number;                      // 有効期限
}

/**
 * DynamoDB - セッションテーブル
 */
export interface SessionItem {
  sessionId: string;                // セッションID（UUID）
  email: string;                    // ユーザーメールアドレス
  role: 'user' | 'admin';           // ユーザーロール
  createdAt: number;                // 作成タイムスタンプ（Unix時間）
  expiresAt: number;                // 有効期限（Unix時間）
}

/**
 * DynamoDB - 回答テーブル
 */
export interface ResponseItem {
  email: string;                    // ユーザーメールアドレス（パーティションキー）
  responses: {
    [date: string]: {
      morning: boolean;
      afternoon: boolean;
      evening: boolean;
    }
  };
  createdAt: string;                // 初回回答日時（ISO 8601）
  updatedAt: string;                // 最終更新日時（ISO 8601）
}

/**
 * エラーコード
 */
export enum ErrorCode {
  // 認証エラー
  AUTH_001 = 'AUTH_001',            // 無効なドメイン
  AUTH_002 = 'AUTH_002',            // パスワード不一致
  AUTH_003 = 'AUTH_003',            // トークン期限切れ
  AUTH_004 = 'AUTH_004',            // トークン不正
  AUTH_005 = 'AUTH_005',            // 権限不足
  
  // 入力検証エラー
  VAL_001 = 'VAL_001',              // 必須フィールド未入力
  VAL_002 = 'VAL_002',              // 不正な形式
  VAL_003 = 'VAL_003',              // 危険な文字列検出
  
  // データストアエラー
  DB_001 = 'DB_001',                // 接続エラー
  DB_002 = 'DB_002',                // 保存失敗
  DB_003 = 'DB_003',                // 取得失敗
  DB_004 = 'DB_004',                // タイムアウト
  
  // 期間制約エラー
  PERIOD_001 = 'PERIOD_001',        // 開始前アクセス
  PERIOD_002 = 'PERIOD_002',        // 終了後アクセス
  
  // システムエラー
  SYS_001 = 'SYS_001',              // Lambda関数エラー
  SYS_002 = 'SYS_002',              // メモリ不足
  SYS_003 = 'SYS_003'               // 予期しないエラー
}

/**
 * エラーレスポンス
 */
export interface ErrorResponse {
  success: false;
  errorCode: ErrorCode;
  message: string;
  timestamp: string;
}

/**
 * アンケート期間設定
 */
export interface SurveyPeriod {
  startDate: string;                // 開始日（YYYY-MM-DD）
  endDate: string;                  // 終了日（YYYY-MM-DD）
}

/**
 * 環境変数
 */
export interface EnvironmentVariables {
  COMMON_PASSWORD: string;          // 共通パスワード
  ADMIN_PASSWORD: string;           // 管理者パスワード
  JWT_SECRET: string;               // JWT署名用シークレット
  SURVEY_START_DATE: string;        // アンケート開始日
  SURVEY_END_DATE: string;          // アンケート終了日
  DYNAMODB_SESSIONS_TABLE: string;  // Sessionsテーブル名
  DYNAMODB_RESPONSES_TABLE: string; // Responsesテーブル名
}
