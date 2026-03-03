/**
 * フロントエンドのユニットテスト
 * 要件: 2.4, 2.5, 5.4
 */

describe('アンケートページのユニットテスト', () => {
  // アンケート期間の定数
  const SURVEY_START_DATE = new Date('2026-03-15');
  const SURVEY_END_DATE = new Date('2026-06-27');

  /**
   * 日付を週の開始日（月曜日）に調整する
   */
  const getWeekStart = (date: Date): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  /**
   * 週の終了日（日曜日）を取得する
   */
  const getWeekEnd = (weekStart: Date): Date => {
    const result = new Date(weekStart);
    result.setDate(result.getDate() + 6);
    return result;
  };

  /**
   * 日付をYYYY-MM-DD形式の文字列に変換する
   */
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  describe('セルクリック時の状態切り替え（要件2.4, 2.5）', () => {
    it('未使用状態のセルをクリックすると使用状態に切り替わること', () => {
      // 回答データの型定義
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      // 初期状態: 未使用
      const surveyData: SurveyData = {
        '2026-03-17': {
          morning: false,
          afternoon: false,
          evening: false
        }
      };

      const date = '2026-03-17';
      const timeSlot = 'morning';

      // セルクリック処理をシミュレート
      const currentValue = surveyData[date][timeSlot as keyof TimeSlotResponse];
      surveyData[date][timeSlot as keyof TimeSlotResponse] = !currentValue;

      // 検証: 未使用(false) → 使用(true)
      expect(surveyData[date].morning).toBe(true);
    });

    it('使用状態のセルをクリックすると未使用状態に切り替わること', () => {
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      // 初期状態: 使用
      const surveyData: SurveyData = {
        '2026-03-17': {
          morning: true,
          afternoon: false,
          evening: false
        }
      };

      const date = '2026-03-17';
      const timeSlot = 'morning';

      // セルクリック処理をシミュレート
      const currentValue = surveyData[date][timeSlot as keyof TimeSlotResponse];
      surveyData[date][timeSlot as keyof TimeSlotResponse] = !currentValue;

      // 検証: 使用(true) → 未使用(false)
      expect(surveyData[date].morning).toBe(false);
    });

    it('複数の時間帯を独立して切り替えられること', () => {
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      const surveyData: SurveyData = {
        '2026-03-17': {
          morning: false,
          afternoon: false,
          evening: false
        }
      };

      const date = '2026-03-17';

      // 午前中を使用に切り替え
      surveyData[date].morning = !surveyData[date].morning;
      expect(surveyData[date].morning).toBe(true);
      expect(surveyData[date].afternoon).toBe(false);
      expect(surveyData[date].evening).toBe(false);

      // 午後を使用に切り替え
      surveyData[date].afternoon = !surveyData[date].afternoon;
      expect(surveyData[date].morning).toBe(true);
      expect(surveyData[date].afternoon).toBe(true);
      expect(surveyData[date].evening).toBe(false);

      // 18時以降を使用に切り替え
      surveyData[date].evening = !surveyData[date].evening;
      expect(surveyData[date].morning).toBe(true);
      expect(surveyData[date].afternoon).toBe(true);
      expect(surveyData[date].evening).toBe(true);
    });

    it('日付が存在しない場合は初期化してから切り替えること', () => {
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      const surveyData: SurveyData = {};
      const date = '2026-03-17';
      const timeSlot = 'morning';

      // 日付が存在しない場合は初期化
      if (!surveyData[date]) {
        surveyData[date] = {
          morning: false,
          afternoon: false,
          evening: false
        };
      }

      // セルクリック処理をシミュレート
      const currentValue = surveyData[date][timeSlot as keyof TimeSlotResponse];
      surveyData[date][timeSlot as keyof TimeSlotResponse] = !currentValue;

      // 検証
      expect(surveyData[date].morning).toBe(true);
      expect(surveyData[date].afternoon).toBe(false);
      expect(surveyData[date].evening).toBe(false);
    });
  });

  describe('週ナビゲーションのロジック（要件5.4）', () => {
    it('前の週ボタンで7日前の週に移動できること', () => {
      const currentWeekStart = new Date('2026-03-24'); // 月曜日
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() - 7);

      expect(formatDate(newWeekStart)).toBe('2026-03-17');
    });

    it('次の週ボタンで7日後の週に移動できること', () => {
      const currentWeekStart = new Date('2026-03-17'); // 月曜日
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() + 7);

      expect(formatDate(newWeekStart)).toBe('2026-03-24');
    });

    it('アンケート開始週より前には移動できないこと', () => {
      const surveyStartWeek = getWeekStart(SURVEY_START_DATE);
      const currentWeekStart = new Date(surveyStartWeek);

      // 前の週に移動しようとする
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() - 7);

      // 期間チェック
      const canMovePrev = newWeekStart >= surveyStartWeek;

      expect(canMovePrev).toBe(false);
    });

    it('アンケート終了週より後には移動できないこと', () => {
      const surveyEndWeek = getWeekStart(SURVEY_END_DATE);
      const currentWeekStart = new Date(surveyEndWeek);

      // 次の週に移動しようとする
      const newWeekStart = new Date(currentWeekStart);
      newWeekStart.setDate(newWeekStart.getDate() + 7);

      // 期間チェック
      const canMoveNext = newWeekStart <= surveyEndWeek;

      expect(canMoveNext).toBe(false);
    });

    it('アンケート期間内の週には移動できること', () => {
      const surveyStartWeek = getWeekStart(SURVEY_START_DATE);
      const surveyEndWeek = getWeekStart(SURVEY_END_DATE);
      const currentWeekStart = new Date('2026-04-06'); // 期間内の週

      // 前の週に移動
      const prevWeekStart = new Date(currentWeekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const canMovePrev = prevWeekStart >= surveyStartWeek && prevWeekStart <= surveyEndWeek;

      // 次の週に移動
      const nextWeekStart = new Date(currentWeekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const canMoveNext = nextWeekStart >= surveyStartWeek && nextWeekStart <= surveyEndWeek;

      expect(canMovePrev).toBe(true);
      expect(canMoveNext).toBe(true);
    });

    it('週の開始日が正しく計算されること（月曜日）', () => {
      // 2026年3月15日は日曜日
      const sunday = new Date('2026-03-15');
      const weekStart = getWeekStart(sunday);
      
      // 週の開始日は前の月曜日（3月9日）
      expect(formatDate(weekStart)).toBe('2026-03-09');
      expect(weekStart.getDay()).toBe(1); // 月曜日
    });

    it('週の終了日が正しく計算されること（日曜日）', () => {
      const weekStart = new Date('2026-03-09'); // 月曜日
      const weekEnd = getWeekEnd(weekStart);
      
      // 週の終了日は日曜日（3月15日）
      expect(formatDate(weekEnd)).toBe('2026-03-15');
      expect(weekEnd.getDay()).toBe(0); // 日曜日
    });
  });

  describe('データ送信前の検証（要件2.4）', () => {
    it('回答データが正しい形式であること', () => {
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      const surveyData: SurveyData = {
        '2026-03-17': {
          morning: true,
          afternoon: false,
          evening: true
        },
        '2026-03-18': {
          morning: false,
          afternoon: true,
          evening: false
        }
      };

      // 各日付のデータが正しい形式であることを検証
      Object.keys(surveyData).forEach(date => {
        expect(surveyData[date]).toHaveProperty('morning');
        expect(surveyData[date]).toHaveProperty('afternoon');
        expect(surveyData[date]).toHaveProperty('evening');
        expect(typeof surveyData[date].morning).toBe('boolean');
        expect(typeof surveyData[date].afternoon).toBe('boolean');
        expect(typeof surveyData[date].evening).toBe('boolean');
      });
    });

    it('日付がYYYY-MM-DD形式であること', () => {
      const date = new Date('2026-03-17');
      const formattedDate = formatDate(date);

      expect(formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formattedDate).toBe('2026-03-17');
    });

    it('空の回答データも送信可能であること', () => {
      interface SurveyData {
        [date: string]: {
          morning: boolean;
          afternoon: boolean;
          evening: boolean;
        };
      }

      const surveyData: SurveyData = {};

      // 空のデータも有効
      expect(Object.keys(surveyData).length).toBe(0);
      expect(surveyData).toEqual({});
    });

    it('複数日の回答データを保持できること', () => {
      interface TimeSlotResponse {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      }

      interface SurveyData {
        [date: string]: TimeSlotResponse;
      }

      const surveyData: SurveyData = {};

      // 1週間分のデータを追加
      for (let i = 0; i < 7; i++) {
        const date = new Date('2026-03-17');
        date.setDate(date.getDate() + i);
        const dateStr = formatDate(date);
        
        surveyData[dateStr] = {
          morning: i % 2 === 0,
          afternoon: i % 3 === 0,
          evening: i % 4 === 0
        };
      }

      expect(Object.keys(surveyData).length).toBe(7);
      expect(surveyData['2026-03-17'].morning).toBe(true);
      expect(surveyData['2026-03-18'].morning).toBe(false);
    });
  });

  describe('週の日付範囲フォーマット', () => {
    it('同じ月の週の日付範囲を正しくフォーマットすること', () => {
      const weekStart = new Date('2026-03-09'); // 月曜日
      const weekEnd = getWeekEnd(weekStart);

      const startYear = weekStart.getFullYear();
      const startMonth = weekStart.getMonth() + 1;
      const startDay = weekStart.getDate();
      const endMonth = weekEnd.getMonth() + 1;
      const endDay = weekEnd.getDate();

      let formatted: string;
      if (startMonth === endMonth) {
        formatted = `${startYear}年${startMonth}月${startDay}日 - ${endDay}日`;
      } else {
        formatted = `${startYear}年${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;
      }

      expect(formatted).toBe('2026年3月9日 - 15日');
    });

    it('異なる月にまたがる週の日付範囲を正しくフォーマットすること', () => {
      const weekStart = new Date('2026-03-30'); // 月曜日
      const weekEnd = getWeekEnd(weekStart);

      const startYear = weekStart.getFullYear();
      const startMonth = weekStart.getMonth() + 1;
      const startDay = weekStart.getDate();
      const endMonth = weekEnd.getMonth() + 1;
      const endDay = weekEnd.getDate();

      let formatted: string;
      if (startMonth === endMonth) {
        formatted = `${startYear}年${startMonth}月${startDay}日 - ${endDay}日`;
      } else {
        formatted = `${startYear}年${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`;
      }

      expect(formatted).toBe('2026年3月30日 - 4月5日');
    });
  });

  describe('システム日付に基づく初期週の決定', () => {
    it('システム日付がアンケート期間内の場合、その週を表示すること', () => {
      const today = new Date('2026-04-15');
      today.setHours(0, 0, 0, 0);

      let initialWeekStart: Date;
      if (today < SURVEY_START_DATE) {
        initialWeekStart = getWeekStart(SURVEY_START_DATE);
      } else if (today > SURVEY_END_DATE) {
        initialWeekStart = getWeekStart(SURVEY_END_DATE);
      } else {
        initialWeekStart = getWeekStart(today);
      }

      // 2026年4月15日は水曜日なので、週の開始日は4月13日（月曜日）
      expect(formatDate(initialWeekStart)).toBe('2026-04-13');
    });

    it('システム日付がアンケート期間より前の場合、開始週を表示すること', () => {
      const today = new Date('2026-01-01');
      today.setHours(0, 0, 0, 0);

      let initialWeekStart: Date;
      if (today < SURVEY_START_DATE) {
        initialWeekStart = getWeekStart(SURVEY_START_DATE);
      } else if (today > SURVEY_END_DATE) {
        initialWeekStart = getWeekStart(SURVEY_END_DATE);
      } else {
        initialWeekStart = getWeekStart(today);
      }

      // アンケート開始日（2026-03-15）を含む週の開始日
      expect(formatDate(initialWeekStart)).toBe('2026-03-09');
    });

    it('システム日付がアンケート期間より後の場合、終了週を表示すること', () => {
      const today = new Date('2026-12-31');
      today.setHours(0, 0, 0, 0);

      let initialWeekStart: Date;
      if (today < SURVEY_START_DATE) {
        initialWeekStart = getWeekStart(SURVEY_START_DATE);
      } else if (today > SURVEY_END_DATE) {
        initialWeekStart = getWeekStart(SURVEY_END_DATE);
      } else {
        initialWeekStart = getWeekStart(today);
      }

      // アンケート終了日（2026-06-27）を含む週の開始日
      expect(formatDate(initialWeekStart)).toBe('2026-06-22');
    });
  });
});
