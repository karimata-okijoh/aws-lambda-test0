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
 * インジェクション攻撃を防ぐために危険な文字列をエスケープ
 * 要件: 7.5
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // 基本的なトリミング
  let sanitized = input.trim();

  // 危険なパターンのチェック（エスケープ前に実行）
  const dangerousPatterns = [
    /(\bOR\b|\bAND\b)\s+.*=/gi,   // SQL論理演算子（スペース必須）
    /;\s*(-{2}|\/\*|DROP|DELETE|UPDATE|INSERT)/gi,  // SQLコメントまたは危険なSQL文
    /<script[^>]*>/gi,             // スクリプトタグ（開始タグのみ）
    /javascript:/gi,               // JavaScriptプロトコル
    /on\w+\s*=/gi                  // イベントハンドラー
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('VAL_003: 入力内容に使用できない文字が含まれています');
    }
  }

  // HTMLエスケープ（XSS対策）
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
};

/**
 * メールアドレスのサニタイズ
 * メールアドレス専用のサニタイズ処理
 * 要件: 7.5
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') {
    return '';
  }

  // 基本的なトリミングと小文字化
  let sanitized = email.trim().toLowerCase();

  // メールアドレスの形式チェック
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('VAL_002: 入力形式が正しくありません');
  }

  // 危険な文字列のチェック
  const dangerousChars = ['<', '>', '"', "'", ';', '\\', '/', '(', ')'];
  for (const char of dangerousChars) {
    if (sanitized.includes(char)) {
      throw new Error('VAL_003: 入力内容に使用できない文字が含まれています');
    }
  }

  return sanitized;
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
