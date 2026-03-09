<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AI Studio App - Advice Engine

這是一個使用 React + Vite 建立的專案。

## 🚀 任務完成項目

1. **依賴安裝與測試**：已經設定好 `package.json`，並測試可以成功編譯與運行。
2. **GitHub Action 部署**：新增了 `.github/workflows/deploy.yml`，當程式碼 push 到 `main` 分支時，會自動編譯並部署到 GitHub Pages。
3. **安全與乾淨的 Git**：設定了 `.gitignore`，過濾掉 `node_modules`、`.env` 隱私檔、`dist` 編譯檔以及編輯器設定檔等。

---

## 💻 本地端運行 (Run Locally)

**環境要求：** Node.js 18+

1. 安裝依賴套件：
   ```bash
   npm install
   ```
2. 設定環境變數：
   將 `.env.example` 複製一份並命名為 `.env`，填入你的 Gemini API key (`GEMINI_API_KEY`) 等設定。
   ```bash
   cp .env.example .env
   ```
3. 啟動開發伺服器：
   ```bash
   npm run dev
   ```
4. 建立正式版本 (Production Build)：
   ```bash
   npm run build
   ```

## 🌐 部署至 GitHub Pages

本專案已配置 GitHub Actions 進行自動部署。
請確保專案已經 Push 到 GitHub，接著：
1. 到 Repository 的 **Settings** -> **Pages**。
2. 將 Source 設為 **GitHub Actions**。
3. 往後每次推送到 `main` 分支，Action 就會自動執行並幫你更新網頁。
