#!/bin/bash
# DONDONHAPPY 整合版部署腳本
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/public/index.html"
DEST="$HOME/dondonhappy/public/index.html"

if [ ! -f "$SRC" ]; then
  echo "❌ 找不到來源檔案: $SRC"
  exit 1
fi

if [ ! -d "$HOME/dondonhappy/public" ]; then
  echo "❌ 找不到目標目錄: $HOME/dondonhappy/public"
  exit 1  
fi

cp "$SRC" "$DEST"
echo "✅ 已複製 index.html ($(wc -l < "$DEST") 行)"
cd "$HOME/dondonhappy"
git add public/index.html
git commit -m "v6：時事專欄+AI產業鏈分析+持倉期權現價修正+板塊獨立頁面"
git push
echo "✅ 已推送到 GitHub!"
