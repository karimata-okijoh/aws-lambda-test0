// 管理者ダッシュボードのTypeScript

/**
 * レポートレスポンスの型定義
 */
interface ReportResponse {
  success: boolean;
  data?: {
    totalResponses: number;
    targetCount: number;
    responseRate: number;
    timeSlotStats: {
      morning: { count: number; percentage: number };
      afternoon: { count: number; percentage: number };
      evening: { count: number; percentage: number };
    };
    usagePatterns: {
      allTimeSlots: number;
      twoTimeSlots: number;
      oneTimeSlot: number;
      noUsage: number;
    };
    generatedAt: string;
  };
  message?: string;
}

/**
 * API設定
 */
const API_BASE_URL = process.env.API_BASE_URL || 'https://your-api-gateway-url.amazonaws.com';

/**
 * メッセージ表示
 */
const showMessage = (message: string, type: 'success' | 'error' | 'info'): void => {
  const messageArea = document.getElementById('message-area');
  if (!messageArea) return;

  messageArea.textContent = message;
  messageArea.className = `message-area show ${type}`;

  // 5秒後に自動で非表示
  setTimeout(() => {
    messageArea.classList.remove('show');
  }, 5000);
};

/**
 * ローディング表示の切り替え
 */
const toggleLoading = (show: boolean): void => {
  const loading = document.getElementById('loading');
  const reportContainer = document.getElementById('report-container');
  const generateButton = document.getElementById('generate-report-btn') as HTMLButtonElement;

  if (loading) {
    loading.style.display = show ? 'block' : 'none';
  }
  if (reportContainer) {
    reportContainer.style.display = show ? 'none' : 'block';
  }
  if (generateButton) {
    generateButton.disabled = show;
  }
};

/**
 * 管理者権限チェック
 */
const checkAdminAuth = (): string | null => {
  const token = localStorage.getItem('authToken');
  const role = localStorage.getItem('userRole');

  if (!token) {
    showMessage('ログインが必要です', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    return null;
  }

  if (role !== 'admin') {
    showMessage('管理者権限が必要です', 'error');
    setTimeout(() => {
      window.location.href = 'survey.html';
    }, 2000);
    return null;
  }

  return token;
};

/**
 * レポート生成APIの呼び出し
 */
const fetchReport = async (token: string): Promise<ReportResponse> => {
  const response = await fetch(`${API_BASE_URL}/report`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('認証エラー: 管理者権限が必要です');
    }
    throw new Error(`レポート生成に失敗しました (${response.status})`);
  }

  return await response.json();
};

/**
 * レポートデータの表示
 */
const displayReport = (data: ReportResponse['data']): void => {
  if (!data) return;

  // 回答総数表示
  const totalResponses = document.getElementById('total-responses');
  const targetCount = document.getElementById('target-count');
  const responseRate = document.getElementById('response-rate');

  if (totalResponses) totalResponses.textContent = data.totalResponses.toString();
  if (targetCount) targetCount.textContent = `${data.targetCount}名`;
  if (responseRate) responseRate.textContent = `${data.responseRate.toFixed(1)}%`;

  // 時間帯別統計
  const timeSlots = [
    { key: 'morning', label: '午前中' },
    { key: 'afternoon', label: '午後' },
    { key: 'evening', label: '18時以降' }
  ] as const;

  timeSlots.forEach(({ key }) => {
    const stats = data.timeSlotStats[key];
    const countElement = document.getElementById(`${key}-count`);
    const percentageElement = document.getElementById(`${key}-percentage`);
    const barElement = document.getElementById(`${key}-bar`);

    if (countElement) countElement.textContent = `${stats.count}名`;
    if (percentageElement) percentageElement.textContent = `${stats.percentage.toFixed(1)}%`;
    if (barElement) {
      barElement.style.width = `${stats.percentage}%`;
    }
  });

  // 利用パターン分布
  const patterns = [
    { key: 'allTimeSlots', id: 'pattern-all' },
    { key: 'twoTimeSlots', id: 'pattern-two' },
    { key: 'oneTimeSlot', id: 'pattern-one' },
    { key: 'noUsage', id: 'pattern-none' }
  ] as const;

  patterns.forEach(({ key, id }) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `${data.usagePatterns[key]}名`;
    }
  });

  // レポート生成日時
  const generatedAt = document.getElementById('generated-at');
  if (generatedAt) {
    const date = new Date(data.generatedAt);
    generatedAt.textContent = date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
};

/**
 * レポート生成処理
 */
const handleGenerateReport = async (): Promise<void> => {
  const token = checkAdminAuth();
  if (!token) return;

  try {
    toggleLoading(true);

    const reportData = await fetchReport(token);

    if (reportData.success && reportData.data) {
      displayReport(reportData.data);
      showMessage('レポートを生成しました', 'success');
    } else {
      throw new Error(reportData.message || 'レポート生成に失敗しました');
    }
  } catch (error) {
    console.error('Report generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('認証エラー')) {
        showMessage(error.message, 'error');
        setTimeout(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          window.location.href = 'index.html';
        }, 2000);
      } else {
        showMessage(error.message, 'error');
      }
    } else {
      showMessage('予期しないエラーが発生しました', 'error');
    }
  } finally {
    toggleLoading(false);
  }
};

/**
 * ログアウト処理
 */
const handleLogout = (): void => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  window.location.href = 'index.html';
};

/**
 * 初期化処理
 */
const initialize = (): void => {
  // 管理者権限チェック
  checkAdminAuth();

  // レポート生成ボタン
  const generateButton = document.getElementById('generate-report-btn');
  if (generateButton) {
    generateButton.addEventListener('click', handleGenerateReport);
  }

  // ログアウトボタン
  const logoutButton = document.getElementById('logout-btn');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
};

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', initialize);
