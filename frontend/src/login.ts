// ログインページのTypeScript
// タスク8で実装予定

/**
 * ログインフォームの送信処理
 */
const handleLogin = async (event: Event): Promise<void> => {
  event.preventDefault();
  // TODO: タスク8で実装
  console.log('Login handler - to be implemented');
};

// DOMContentLoadedイベントでフォームにイベントリスナーを追加
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});
