// ログインページのTypeScript

// 即時実行関数でスコープを分離
(function() {
  // API設定（環境に応じて変更）
  const API_BASE_URL = 'https://bycx9lu24g.execute-api.ap-northeast-1.amazonaws.com/prod'; // 本番環境用

/**
 * エラーメッセージを表示
 */
const showError = (message: string): void => {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
  }
};

/**
 * エラーメッセージを非表示
 */
const hideError = (): void => {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.classList.remove('show');
  }
};

/**
 * ログインボタンの状態を変更
 */
const setButtonState = (button: HTMLButtonElement, loading: boolean): void => {
  button.disabled = loading;
  button.textContent = loading ? 'ログイン中...' : 'ログイン';
};

/**
 * ログインフォームの送信処理
 */
const handleLogin = async (event: Event): Promise<void> => {
  event.preventDefault();
  hideError();

  const form = event.target as HTMLFormElement;
  const emailInput = form.querySelector('#email') as HTMLInputElement;
  const passwordInput = form.querySelector('#password') as HTMLInputElement;
  const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // クライアント側のバリデーション
  if (!email || !password) {
    showError('メールアドレスとパスワードを入力してください');
    return;
  }

  // ドメインチェック（クライアント側での事前チェック）
  if (!email.endsWith('@okijoh.co.jp')) {
    showError('このアンケートは社内メンバー専用です');
    return;
  }

  setButtonState(submitButton, true);

  try {
    // 認証APIへのリクエスト
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // JWTトークンをlocalStorageに保存
      localStorage.setItem('token', data.token);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userRole', data.role);

      // 成功時のリダイレクト
      if (data.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'survey.html';
      }
    } else {
      // エラーメッセージの表示
      const errorMessage = data.message || 'ログインに失敗しました';
      showError(errorMessage);
      setButtonState(submitButton, false);
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('ネットワークエラーが発生しました。しばらくしてから再度お試しください');
    setButtonState(submitButton, false);
  }
};

// DOMContentLoadedイベントでフォームにイベントリスナーを追加
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // 既にログイン済みの場合はリダイレクト
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('userRole');
  if (token) {
    if (role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'survey.html';
    }
  }
});

})(); // 即時実行関数の終了
