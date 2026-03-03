// アンケートページのTypeScript

// 即時実行関数でスコープを分離
(function() {
  // アンケート期間の定数
  const SURVEY_START_DATE = new Date('2026-03-15');
  const SURVEY_END_DATE = new Date('2026-06-27');

  // API エンドポイント（環境に応じて変更）
  const API_BASE_URL = 'https://bycx9lu24g.execute-api.ap-northeast-1.amazonaws.com/prod'; // 本番環境用

  // 回答データの型定義
  interface TimeSlotResponse {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  }

  interface SurveyData {
    [date: string]: TimeSlotResponse;
  }

  // 現在表示中の週の開始日
  let currentWeekStart: Date;

  // 回答データ（日付をキーとしたMap構造）
  let surveyData: SurveyData = {};

  /**
   * 日付を週の開始日（月曜日）に調整する
   * @param date 対象の日付
   * @returns 週の開始日（月曜日）
   */
  const getWeekStart = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    // 日曜日は0、月曜日は1なので、月曜日を週の開始とする
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  /**
   * 週の終了日（日曜日）を取得する
   * @param weekStart 週の開始日
   * @returns 週の終了日（日曜日）
   */
  const getWeekEnd = (weekStart: Date): Date => {
    const result = new Date(weekStart);
    result.setDate(result.getDate() + 6);
    return result;
  };

  /**
   * システム日付に基づいて初期表示する週を決定する
   * @returns 初期表示する週の開始日
   */
  const getInitialWeekStart = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // システム日付がアンケート期間より前の場合、開始週を表示
    if (today < SURVEY_START_DATE) {
      return getWeekStart(SURVEY_START_DATE);
    }
    
    // システム日付がアンケート期間より後の場合、終了週を表示
    if (today > SURVEY_END_DATE) {
      return getWeekStart(SURVEY_END_DATE);
    }
    
    // システム日付がアンケート期間内の場合、その週を表示
    return getWeekStart(today);
  };

  /**
   * 日付をYYYY-MM-DD形式の文字列に変換する
   * @param date 対象の日付
   * @returns YYYY-MM-DD形式の文字列
   */
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * 週の日付範囲を表示用にフォーマットする
   * @param weekStart 週の開始日
   * @returns 表示用の日付範囲文字列（例: "2026年3月15日 - 3月21日"）
   */
  const formatWeekRange = (weekStart: Date): string => {
    const weekEnd = getWeekEnd(weekStart);
    
    const startYear = weekStart.getFullYear();
    const startMonth = weekStart.getMonth() + 1;
    const startDay = weekStart.getDate();
    
    const endYear = weekEnd.getFullYear();
    const endMonth = weekEnd.getMonth() + 1;
    const endDay = weekEnd.getDate();
    
    // 同じ年の場合
    if (startYear === endYear) {
      // 同じ月の場合
      if (startMonth === endMonth) {
        return `${startYear}年${startMonth}月${startDay}日 - ${endDay}日`;
      }
      // 異なる月の場合
      return `${startYear}年${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;
    }
    
    // 異なる年の場合
    return `${startYear}年${startMonth}月${startDay}日 - ${endYear}年${endMonth}月${endDay}日`;
  };

  /**
   * 週ナビゲーションボタンの有効/無効を更新する
   */
  const updateNavigationButtons = (): void => {
    const prevWeekBtn = document.getElementById('prev-week-btn') as HTMLButtonElement;
    const nextWeekBtn = document.getElementById('next-week-btn') as HTMLButtonElement;
    
    if (!prevWeekBtn || !nextWeekBtn) return;
    
    // 前の週ボタン: 現在の週の開始日がアンケート開始週より前の場合は無効化
    const surveyStartWeek = getWeekStart(SURVEY_START_DATE);
    prevWeekBtn.disabled = currentWeekStart <= surveyStartWeek;
    
    // 次の週ボタン: 現在の週の開始日がアンケート終了週以降の場合は無効化
    const surveyEndWeek = getWeekStart(SURVEY_END_DATE);
    nextWeekBtn.disabled = currentWeekStart >= surveyEndWeek;
  };

  /**
   * 週の日付範囲表示を更新する
   */
  const updateWeekDisplay = (): void => {
    const weekRangeElement = document.getElementById('week-range');
    if (!weekRangeElement) return;
    
    weekRangeElement.textContent = formatWeekRange(currentWeekStart);
  };

  /**
   * セルの表示を更新する
   * @param cell セル要素
   * @param isUsed 使用状態
   */
  const updateCellDisplay = (cell: HTMLElement, isUsed: boolean): void => {
    if (isUsed) {
      cell.classList.add('used');
      cell.classList.remove('unused');
      cell.textContent = '✓';
      cell.setAttribute('aria-label', '使用');
    } else {
      cell.classList.add('unused');
      cell.classList.remove('used');
      cell.textContent = '-';
      cell.setAttribute('aria-label', '未使用');
    }
  };

  /**
   * アンケート表を更新する
   */
  const updateSurveyTable = (): void => {
    const tbody = document.getElementById('survey-table-body');
    if (!tbody) return;
    
    // テーブルをクリア
    tbody.innerHTML = '';
    
    // 1週間分の行を生成
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      const dateStr = formatDate(date);
      
      // アンケート期間外の日付はスキップ
      if (date < SURVEY_START_DATE || date > SURVEY_END_DATE) {
        continue;
      }
      
      const row = document.createElement('tr');
      
      // 日付セル
      const dateCell = document.createElement('th');
      dateCell.scope = 'row';
      dateCell.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
      row.appendChild(dateCell);
      
      // 時間帯セル（午前中、午後、18時以降）
      const timeSlots: Array<'morning' | 'afternoon' | 'evening'> = ['morning', 'afternoon', 'evening'];
      
      timeSlots.forEach(timeSlot => {
        const cell = document.createElement('td');
        cell.dataset.date = dateStr;
        cell.dataset.timeSlot = timeSlot;
        
        // セル内のボタン要素を作成
        const cellButton = document.createElement('div');
        cellButton.className = 'survey-cell';
        
        // 既存の回答データがあれば反映
        const isUsed = surveyData[dateStr]?.[timeSlot] ?? false;
        updateCellDisplay(cellButton, isUsed);
        
        // クリックイベントを設定
        cellButton.addEventListener('click', () => handleCellClick(dateStr, timeSlot));
        
        cell.appendChild(cellButton);
        row.appendChild(cell);
      });
      
      tbody.appendChild(row);
    }
  };

  /**
   * 週ナビゲーション処理
   * @param direction 移動方向（'prev': 前の週、'next': 次の週）
   */
  const handleWeekNavigation = (direction: 'prev' | 'next'): void => {
    const newWeekStart = new Date(currentWeekStart);
    
    if (direction === 'prev') {
      // 前の週（7日前）
      newWeekStart.setDate(newWeekStart.getDate() - 7);
    } else {
      // 次の週（7日後）
      newWeekStart.setDate(newWeekStart.getDate() + 7);
    }
    
    // アンケート期間内かチェック
    const surveyStartWeek = getWeekStart(SURVEY_START_DATE);
    const surveyEndWeek = getWeekStart(SURVEY_END_DATE);
    
    if (newWeekStart < surveyStartWeek || newWeekStart > surveyEndWeek) {
      // 期間外の場合は移動しない
      return;
    }
    
    // 週を更新
    currentWeekStart = newWeekStart;
    
    // 表示を更新
    updateWeekDisplay();
    updateNavigationButtons();
    updateSurveyTable();
  };

  /**
   * セルクリック処理（使用/未使用の切り替え）
   */
  const handleCellClick = (date: string, timeSlot: string): void => {
    // 現在の状態を取得
    if (!surveyData[date]) {
      surveyData[date] = {
        morning: false,
        afternoon: false,
        evening: false
      };
    }
    
    // 状態を切り替え
    const currentValue = surveyData[date][timeSlot as keyof TimeSlotResponse];
    surveyData[date][timeSlot as keyof TimeSlotResponse] = !currentValue;
    
    // セルの表示を更新（tdの中のdiv要素を取得）
    const td = document.querySelector(`[data-date="${date}"][data-time-slot="${timeSlot}"]`) as HTMLTableCellElement;
    if (td) {
      const cellButton = td.querySelector('.survey-cell') as HTMLElement;
      if (cellButton) {
        updateCellDisplay(cellButton, !currentValue);
      }
    }
  };

  /**
   * メッセージを表示する
   * @param message メッセージ内容
   * @param type メッセージタイプ（'success' | 'error'）
   */
  const showMessage = (message: string, type: 'success' | 'error'): void => {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) return;
    
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    messageArea.style.display = 'block';
    
    // 3秒後に自動的に非表示
    setTimeout(() => {
      messageArea.style.display = 'none';
    }, 3000);
  };

  /**
   * 既存回答を取得する
   */
  const fetchExistingResponses = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = 'index.html';
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/survey`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // 認証エラーの場合はログインページにリダイレクト
          localStorage.removeItem('token');
          window.location.href = 'index.html';
          return;
        }
        throw new Error('回答の取得に失敗しました');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        // 既存回答をsurveyDataに反映
        surveyData = data.data.responses || {};
        
        // ユーザーのメールアドレスを表示
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement && data.data.email) {
          userEmailElement.textContent = data.data.email;
        }
        
        // テーブルを更新
        updateSurveyTable();
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
      showMessage('既存の回答の取得に失敗しました', 'error');
    }
  };

  /**
   * クリアボタンの処理
   */
  const handleClear = (): void => {
    // 現在の週の日付範囲を取得
    const weekEnd = getWeekEnd(currentWeekStart);
    
    // 現在の週のデータをクリア
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      
      if (date > weekEnd) break;
      if (date < SURVEY_START_DATE || date > SURVEY_END_DATE) continue;
      
      const dateStr = formatDate(date);
      if (surveyData[dateStr]) {
        surveyData[dateStr] = {
          morning: false,
          afternoon: false,
          evening: false
        };
      }
    }
    
    // テーブルを更新
    updateSurveyTable();
    showMessage('現在の週のデータをクリアしました', 'success');
  };

  /**
   * アンケート回答の保存
   */
  const handleSaveSurvey = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = 'index.html';
        return;
      }
      
      // 保存ボタンを無効化
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
      }
      
      const response = await fetch(`${API_BASE_URL}/survey`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          responses: surveyData
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // 認証エラーの場合はログインページにリダイレクト
          localStorage.removeItem('token');
          window.location.href = 'index.html';
          return;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.message || '保存に失敗しました');
      }
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('回答を保存しました', 'success');
      } else {
        throw new Error(data.message || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      const errorMessage = error instanceof Error ? error.message : '回答の保存に失敗しました';
      showMessage(errorMessage, 'error');
    } finally {
      // 保存ボタンを再度有効化
      const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存';
      }
    }
  };

  /**
   * ログアウト処理
   */
  const handleLogout = (): void => {
    // localStorageからトークンを削除
    localStorage.removeItem('token');
    
    // ログインページにリダイレクト
    window.location.href = 'index.html';
  };

  /**
   * ページ初期化処理
   */
  const initializeSurveyPage = async (): Promise<void> => {
    // トークンの確認
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'index.html';
      return;
    }
    
    // 初期表示する週を決定
    currentWeekStart = getInitialWeekStart();
    
    // 週の日付範囲を表示
    updateWeekDisplay();
    
    // ナビゲーションボタンの状態を更新
    updateNavigationButtons();
    
    // 既存回答を取得
    await fetchExistingResponses();
    
    // イベントリスナーを設定
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const clearBtn = document.getElementById('clear-btn');
    const saveBtn = document.getElementById('save-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', () => handleWeekNavigation('prev'));
    }
    
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', () => handleWeekNavigation('next'));
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClear);
    }
    
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveSurvey);
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
  };

  // DOMContentLoadedイベントで初期化
  document.addEventListener('DOMContentLoaded', () => {
    initializeSurveyPage();
  });

})(); // 即時実行関数の終了
