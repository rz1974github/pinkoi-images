## Plan: RWD Refactor

將目前偏桌機的股票看板整理成可追蹤的 RWD 改造計畫，採用折衷方案：桌機維持高資訊密度的 table，手機改為 card list 並以上下滑動瀏覽全部股票。優先順序是先清理結構與樣式責任，再做斷點與互動區塊重排，最後切出手機卡片版並驗證桌機與手機可用性。

**Steps**
1. 1.0 盤點與基線確認
2. 1.1 確認目前版面中的桌機假設：header 橫向排列、pagination 橫向排列、footer 多組按鈕橫向排列、股票資料以 11 欄 table 呈現。
3. 1.2 確認目前技術債：index.html 仍有大量 inline style，會阻礙 RWD 斷點管理。
4. 1.3 建立本次改造的驗證基線：桌機版功能不退化，手機版至少可操作、可閱讀、可捲動。
5. 2.0 結構清理
6. 2.1 [done] 將 index.html 中的 inline style 抽成具名 class，集中到 styles.css 管理。
7. 2.2 [done] 為主要區塊補上穩定的語意 class：header、controls、pagination、table wrapper、footer meta、footer actions、modal actions。
8. 2.3 保持 app.js 的 DOM 查找 id 不變，避免 RWD 改造時引入功能回歸。
9. 3.0 版面系統重整
10. 3.1 [done] 將 header 改成可在桌機橫排、手機直排的彈性布局。
11. 3.2 [done] 將 pagination controls 改成可換行或上下堆疊的布局。
12. 3.3 [done] 將 footer 的資訊區與操作區拆成可獨立換行的區塊，避免手機寬度不足時擠壓內容。
13. 3.4 [done] 統一按鈕、輸入框、select 的尺寸與間距，建立觸控友善的最小點擊區。
14. 4.0 股票列表 RWD 策略
15. 4.1 [done] 桌機與較大平板維持 table 結構，保留高資訊密度與跨列比較能力。
16. 4.2 [done] 手機改為 card list，將每檔股票的主要資訊改成上下分層呈現，避免小螢幕橫向擠壓。
17. 4.3 [done] 手機取消分頁，改為一次顯示全部股票並以上下滑動瀏覽；桌機是否保留分頁可視資料量再決定。
18. 4.4 [done] 調整 table 最小寬度、欄位間距、字級與輸入欄寬度，讓桌機與平板 table 穩定顯示。
19. 4.5 [done] 規劃 table row 與 mobile card 共用同一份資料來源與事件綁定，避免 app.js 分成兩套邏輯。
20. 5.0 斷點設計
21. 5.1 [done] 建立主要斷點：桌機、平板、手機，至少包含約 900px 與 640px 兩個層級。
22. 5.2 [done] 在平板斷點調整容器寬度、區塊間距、footer 換行與 table 可視範圍。
23. 5.3 [done] 在手機斷點切換為 card list，隱藏 table header/desktop pagination，保留新增、同步、匯入匯出與 modal 操作。
24. 6.0 Modal 與操作細節
25. 6.1 [done] 將 modal-content 寬度改為相對視窗寬度，避免小螢幕溢出。
26. 6.2 [done] 調整 modal 內按鈕排列，必要時在手機改為直向或雙列。
27. 6.3 [done] 檢查 GitHub 同步、API Key 設定、匯入匯出等操作在手機上的可點擊性。
28. 7.0 驗證與收尾
29. 7.1 [done] 驗證 index.html、styles.css、app.js 無診斷錯誤。
30. 7.2 [done] 手動檢查桌機寬度下的 header、table、footer、modal 是否維持原功能。
31. 7.3 [done] 手動檢查手機寬度下的輸入、新增、卡片列表、上下滑動、匯入匯出、同步、modal 是否可操作。
32. 7.4 [done] 驗證手機已不再依賴分頁即可瀏覽全部股票，且桌機 table 的資訊密度與操作效率未退化。

**Relevant files**
- `/Users/richardchen/Documents/my-stock-memo/index.html` — 保留桌機 table 容器，加入 mobile card list 容器與必要的語意區塊。
- `/Users/richardchen/Documents/my-stock-memo/styles.css` — 建立桌機 table / 手機 card 的斷點規則、元件尺寸與 modal 響應式樣式。
- `/Users/richardchen/Documents/my-stock-memo/app.js` — 調整 render 流程，讓 table row 與 mobile card 共用資料與互動邏輯，並處理手機取消分頁的行為。

**Verification**
1. 使用診斷檢查確認 `/Users/richardchen/Documents/my-stock-memo/index.html`、`/Users/richardchen/Documents/my-stock-memo/styles.css`、`/Users/richardchen/Documents/my-stock-memo/app.js` 無錯誤。
2. 以桌機寬度檢查主要區塊是否維持可讀與可操作。
3. 以手機寬度檢查 card list 是否可順暢上下滑動、資訊層級清楚，且不需要分頁即可瀏覽全部股票。
4. 驗證股票新增、桌機分頁、更新頻率切換、API Key modal、GitHub 同步 modal、匯入匯出功能未受影響。

**Decisions**
- 採用折衷方案：桌機保留 table，手機改為 card list。
- 手機取消分頁，改為一次顯示全部股票並以上下滑動瀏覽；桌機是否保留分頁依資料量與可讀性決定。
- table row 與 mobile card 應共用同一份資料與事件邏輯，避免維護兩套獨立流程。
