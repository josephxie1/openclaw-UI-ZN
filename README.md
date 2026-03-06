# OpenClaw 中文界面补丁 🇨🇳

为 [OpenClaw](https://github.com/openclaw/openclaw) 提供完整的简体中文界面翻译。

## ✨ 特性

- 🌐 完整的控制面板中文化（导航、配置、Agent、频道、定时任务等）
- 📝 Schema 配置项中文标签和帮助文本（700+ 条翻译）
- 🔍 搜索支持中文匹配
- ⚡ 快速添加模型提供商（预置主流 AI 服务商 + 视觉模型标识）
- 📨 快速添加消息频道（Telegram / 飞书一键配置 + Agent 绑定）
- 📄 独立「编辑 JSON」页面（主导航直达，按需加载 raw 配置文本）
- 🛡 修复大配置文件 `config.get` RangeError 崩溃问题
- 🔄 GitHub Actions 自动跟进上游更新并构建

## � 截图预览

### 快速添加模型提供商
预置 SiliconFlow、Kimi、Gemini、Claude、OpenAI 等主流提供商，一键填入配置。

![快速添加模型提供商](docs/quick-add-model.png)

### 快速添加消息渠道
支持 Telegram / 飞书一键配置，同时绑定 Agent。

![快速添加渠道](docs/quick-add-channel.png)

### Agent 管理
完整汉化的 Agent 工作区，包含概览、文件、工具、技能、频道、定时任务面板。

![Agent 管理](docs/agent-management.png)

## �📦 快速安装

### 方式一：一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/josephxie1/openclaw-UI-ZN/main/scripts/install-remote.sh | bash
```

> 请将 `OWNER` 替换为实际的 GitHub 用户名。

### 方式二：手动安装

1. 从 [Releases](https://github.com/josephxie1/openclaw-UI-ZN/releases) 下载 `control-ui-zh.zip`
2. 找到 OpenClaw 安装目录：
   ```bash
   # npm 全局安装
   ls $(npm root -g)/openclaw/dist/control-ui

   # 或查找 openclaw 命令位置
   which openclaw
   ```
3. 备份并替换：
   ```bash
   OPENCLAW_DIR=$(npm root -g)/openclaw
   cp -r $OPENCLAW_DIR/dist/control-ui $OPENCLAW_DIR/dist/control-ui.bak
   unzip control-ui-zh.zip -d $OPENCLAW_DIR/dist/
   ```
4. 重启网关

### 方式三：从源码构建

```bash
git clone https://github.com/josephxie1/openclaw-UI-ZN.git
cd openclaw-zh
bash scripts/build.sh
bash scripts/install.sh
```

## 🔄 恢复英文版

```bash
OPENCLAW_DIR=$(npm root -g)/openclaw
# 找到备份目录（install 时自动创建）
ls $OPENCLAW_DIR/dist/control-ui.bak.*
# 恢复
cp -r $OPENCLAW_DIR/dist/control-ui.bak.XXXXXXXX $OPENCLAW_DIR/dist/control-ui
```

## ⚡ 可选：后端性能优化

补丁中还包含两个后端文件的优化（`src/config/schema.ts`、`src/gateway/server-methods/config.ts`），用于减少插件较多时 Schema 序列化的体积和加载时间。

**仅替换 UI 不影响任何功能**，但如果你从源码构建 OpenClaw，建议一起应用以获得更好的性能。

## 🛠 本地开发

如果你想贡献翻译或修改：

```bash
# 1. 克隆 OpenClaw 源码
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# 2. 应用补丁
git apply /path/to/openclaw-zh/patches/zh-cn.patch

# 3. 安装依赖并启动开发服务器
pnpm install
pnpm ui:dev
```

修改后重新生成补丁：

```bash
cd /path/to/openclaw
git diff HEAD -- ui/src/ > /path/to/openclaw-zh/patches/zh-cn.patch
```

## 📋 翻译覆盖

| 模块 | 状态 |
|------|------|
| 导航和标签栏 | ✅ |
| 概览页 | ✅ |
| 聊天界面 | ✅ |
| 配置表单（Schema 标签） | ✅ 700+ 条 |
| 配置表单（Schema 帮助文本） | ✅ 460+ 条 |
| 配置 Section 卡片 | ✅ |
| Agent 管理 | ✅ |
| 频道管理 | ✅ |
| 会话管理 | ✅ |
| 使用统计 | ✅ |
| 定时任务 | ✅ |
| 技能管理 | ✅ |
| 节点管理 | ✅ |
| 执行审批 | ✅ |
| 日志 / 调试 | ✅ |

## 📄 许可证

[MIT](LICENSE) — 基于 [OpenClaw](https://github.com/openclaw/openclaw)（MIT License）。
