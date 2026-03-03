// 入力検証ユーティリティ
// タスク2、4で実装予定

import { ALLOWED_DOMAIN } from './constants';

/**
 * メールアドレスのドメイン検証
 */
export const isValidDomain = (email: string): boolean => {
  // TODO: タスク2で実装
  return email.endsWith(ALLOWED_DOMAIN);
};

/**
 * 日付形式の検証（YYYY-MM-DD）
 */
export const isValidDateFormat = (date: string): boolean => {
  // TODO: タスク4で実装
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) {
    return false;
  }
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
};

/**
 * 入力データのサニタイズ
 */
export const sanitizeInput = (input: string): string => {
  // TODO: タスク7で実装
  return input.trim();
};

/**
 * アンケート期間内かチェック
 */
export const isWithinSurveyPeriod = (
  date: Date,
  startDate: string,
  endDate: string
): boolean => {
  // TODO: タスク4で実装
  const start = new Date(startDate);
  const end = new Date(endDate);
  return date >= start && date <= end;
};
