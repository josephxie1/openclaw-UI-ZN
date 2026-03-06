#!/usr/bin/env bash
# OpenClaw 中文版一键安装脚本
# 从 GitHub Releases 下载最新 tgz 并全局安装

set -euo pipefail

REPO="josephxie1/openclaw-UI-ZN"
TMP_DIR=$(mktemp -d)

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "🦞 OpenClaw 中文版 — 一键安装"
echo "================================"
echo ""

# 获取最新 Release 的 tgz 下载链接
echo "📦 正在获取最新版本..."
ASSET_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o '"browser_download_url":\s*"[^"]*\.tgz"' \
  | head -1 \
  | sed 's/"browser_download_url":\s*"//;s/"$//')

if [ -z "$ASSET_URL" ]; then
  echo "❌ 未找到 .tgz 发布包，请检查 https://github.com/$REPO/releases"
  exit 1
fi

FILENAME=$(basename "$ASSET_URL")
echo "📥 正在下载 $FILENAME ..."
curl -fSL -o "$TMP_DIR/$FILENAME" "$ASSET_URL"

echo "🔧 正在安装..."
npm install -g "$TMP_DIR/$FILENAME"

echo ""
echo "✅ 安装完成！"
echo ""
echo "   版本: $(openclaw --version 2>/dev/null || echo '(请重新打开终端)')"
echo ""
echo "   启动网关:  openclaw gateway"
echo "   控制面板:  http://127.0.0.1:18789"
echo ""
echo "   恢复官方版: npm install -g openclaw"
