#!/bin/bash
# Build OpenClaw Desktop
# Usage: ./scripts/desktop-build.sh
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo ""
echo "  OpenClaw Desktop 构建工具"
echo "  ─────────────────────────"
echo "  0) 直接启动 Desktop Dev（不构建）"
echo "  1) 构建最新 Desktop Dev（构建后端 + UI + 同步 + 启动 dev）"
echo "  2) 完整构建 DMG（构建后端 + UI + DMG 打包）"
echo ""
read -p "  请选择 [0/1/2]: " choice

case "$choice" in
  0)
    echo ""
    echo "==> 启动 Desktop Dev..."
    cd desktop
    OPENCLAW_DEV=1 npm start
    ;;
  1)
    echo ""
    echo "==> 1/4 构建后端..."
    pnpm build

    echo "==> 2/4 构建前端 UI..."
    pnpm ui:build

    echo "==> 3/4 同步到 desktop/gateway..."
    rsync -a --delete --exclude='control-ui' dist/ desktop/gateway/dist/
    rm -rf desktop/gateway/dist/control-ui
    cp -r dist/control-ui desktop/gateway/dist/control-ui
    mkdir -p desktop/gateway/docs/reference
    rsync -a docs/reference/templates/ desktop/gateway/docs/reference/templates/
    echo "    ✅ 后端 + UI + 模板 已同步"

    echo "==> 4/4 启动 Desktop Dev..."
    cd desktop
    OPENCLAW_DEV=1 npm start
    ;;
  2)
    echo ""
    echo "==> 1/4 构建后端..."
    pnpm build

    echo "==> 2/4 构建前端 UI..."
    pnpm ui:build

    echo "==> 3/4 同步到 desktop/gateway..."
    rsync -a --delete --exclude='control-ui' dist/ desktop/gateway/dist/
    rm -rf desktop/gateway/dist/control-ui
    cp -r dist/control-ui desktop/gateway/dist/control-ui
    mkdir -p desktop/gateway/docs/reference
    rsync -a docs/reference/templates/ desktop/gateway/docs/reference/templates/
    echo "    ✅ 后端 + UI + 模板 已同步"

    echo "==> 4/4 构建 DMG..."
    cd desktop
    npm install
    npm run build:mac

    echo ""
    echo "✅ DMG 构建完成！"
    ls -lh release/*.dmg
    ;;
  *)
    echo "❌ 无效选项，请输入 0、1 或 2"
    exit 1
    ;;
esac
