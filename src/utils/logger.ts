// ロギングユーティリティ

import { maskSensitiveData, validateLogSafety } from './security';

/**
 * ログレベル
 */
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * ログエントリ
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  errorCode?: string;
  stackTrace?: string;
}

/**
 * ログ出力（CloudWatch Logsに記録）
 * 要件: 7.4 - パスワードの非露出
 */
export const log = (entry: LogEntry): void => {
  // セキュリティチェック（要件: 7.4）
  validateLogSafety(entry);
  
  // 機密情報をマスキング
  const sanitizedEntry = {
    ...entry,
    context: entry.context ? maskSensitiveData(entry.context) : undefined
  };
  
  // CloudWatch Logsに構造化ログとして出力
  console.log(JSON.stringify(sanitizedEntry));
};

/**
 * エラーログ出力
 */
export const logError = (
  message: string,
  error: Error,
  context?: Record<string, unknown>
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    message,
    context,
    stackTrace: error.stack
  });
};

/**
 * 情報ログ出力
 */
export const logInfo = (
  message: string,
  context?: Record<string, unknown>
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message,
    context
  });
};

/**
 * 警告ログ出力
 */
export const logWarn = (
  message: string,
  context?: Record<string, unknown>
): void => {
  log({
    timestamp: new Date().toISOString(),
    level: LogLevel.WARN,
    message,
    context
  });
};

/**
 * ロガークラス（オブジェクト指向スタイル）
 */
export class Logger {
  info(message: string, context?: Record<string, unknown>): void {
    logInfo(message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    logWarn(message, context);
  }

  error(message: string, context?: Record<string, unknown> & { error?: string; stack?: string }): void {
    log({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      stackTrace: context?.stack
    });
  }
}

// デフォルトロガーインスタンス
export const logger = new Logger();
