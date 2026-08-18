# 🦙 Llama.cpp 本地模型控制台与 HuggingFace 下载管理中心

一款为 **Llama.cpp (`llama-server.exe`)** 量身打造的高颜值、全功能本地大模型服务调度与 HuggingFace 模型管理 Web 平台。基于 **React 18 + JavaScript + Vite + Node.js Express** 驱动。

---

## 🌟 核心功能

### 1. 🚀 服务控制台 (Server Dashboard & Launcher)
- **多套启动方案一键切换**：
  - ⚡ **日常轻量推荐 (8K 上下文)**：GPU 全层卸载，极低显存极速响应。
  - ⚡ **方案 A (32K 长对话/代码重构)**：启用 Flash Attention 与 Q4 KV Cache 压缩，32k tokens 长文本支持。
  - ⚡ **方案 B (64K~128K CPU+GPU 混合)**：28 层 GPU 卸载分流至内存，突破显存上限。
  - ⚡ **方案 C (64K 纯 GPU 顶配加速)**：大显存极限长上下文极速推理。
  - ⚡ **方案 D (32K 极高注意力精度)**：Q8_0 KV Cache 压缩，数学与代码高精度推理。
  - ⚡ **方案 D+ (32K 高精度 + MCP 代理)**：开启 `--webui-mcp-proxy` 代理支持。
- **高级参数精细微调**：
  - GPU 卸载层数滑块（`0 ~ 99`）、Token 上下文窗口（`4K ~ 128K`）、CPU 线程数、并发插槽数（`-np`）。
  - KV Cache 压缩类型（`f16` / `q8_0` / `q4_0` / `q4_1`）、Flash Attention（`-fa on`）开关及自定义 Flags。
- **实时终端日志 (Live Log Stream)**：
  - 通过 SSE 实时捕获 `llama-server.exe` 的标准输出和 stderr 诊断日志。
  - ANSI 颜色高亮、按级别过滤（输出 / 诊断 / 系统）、搜索关键字、自动滚动开关、一键清空与复制。
- **内置简易对话测试 Playground**：
  - 无需打开外部软件，直接在网页内与已启动的本地模型进行推断测试。
  - 支持打字机流式输出、首字延迟（TTFT）与生成总耗时测算。

---

### 2. 📦 本地模型库 (Local Models Hub)
- 自动扫描模型存放目录（如 `D:\99_lamma\models`）下的所有 `.gguf` 文件。
- 自动解析提取模型家族（Qwen、DeepSeek、Llama、Mistral 等）、参数量（9B、7B、14B 等）、量化等级（`Q4_K_M`、`Q5_0`、`Q8_0` 等）、文件体积与修改时间。
- 提供 **一键载入并启动**、**在 Windows 资源管理器中定位**、**复制完整文件路径**、**安全删除** 等操作。

---

### 3. 🌐 HuggingFace 下载与收藏中心 (HF Download & Bookmarks)
- **智能链接与指令解析器**：输入框支持直接粘贴各类格式：
  - `hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf`
  - `hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf`
  - `https://huggingface.co/empero-ai/Qwen3.8-9B-GGUF/blob/main/Qwen3.8-9B-Q4_K_M.gguf`
  - `empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf`
  - `huggingface-cli download empero-ai/Qwen3.8-9B-GGUF Qwen3.8-9B-Q4_K_M.gguf`
- **模型收藏夹与状态联动**：
  - 自动识别收藏的模型在本地是否已下载（显示 **已在本地就绪 ✅** 或 **未下载 ⬇️**）。
- **极速多线程下载引擎**：
  - 基于 Python `huggingface_hub` 并默认集成国内极速镜像源（`https://hf-mirror.com`）。
  - 实时显示下载百分比进度条、下载速度（MB/s）、已下载/总大小、剩余预估时间（ETA）、断点续传与取消操作。
  - 下载完成后自动触发本地模型库刷新，无缝衔接一键启动！

---

### 4. ⚙️ 系统与接口设置 (Settings & Endpoints)
- 支持自由修改 `llama-server.exe` 路径、模型存储目录、默认 Host 与端口（8080）。
- **OpenAI 兼容 API 接入指南**：
  - 服务启动后，原生暴露 OpenAI 标准协议端点：`http://127.0.0.1:8080/v1`。
  - 内置 Python (OpenAI SDK)、cURL 命令行代码示例及 Cherry Studio、NextChat、Chatbox 等客户端接入指引。

---

## 🏃 快速启动

### 方式 1: Windows 一键启动（推荐）
在 `D:\99_lamma\lammaManage` 目录下，直接双击运行：
```bat
start.bat
```
后台服务将自动拉起，并在默认浏览器中自动打开控制台页面（`http://127.0.0.1:5175`）。

---

### 方式 2: 命令行启动

```bash
# 1. 进入项目目录
cd D:\99_lamma\lammaManage

# 2. 启动全栈发行服务（后台 API + dist 静态前端）
npm start
# 浏览器访问: http://127.0.0.1:5175

# 或者启动前端 Vite 热更新开发模式：
npm run dev
# 浏览器访问: http://localhost:5173
```

---

## 📖 简单使用流程

```
 1. 选择或下载模型           2. 选择启动预设方案          3. 一键启动并对话
+-------------------+      +-------------------+      +-------------------+
| 📦 本地模型库      | ---> | 🚀 服务控制台      | ---> | 💬 测试 Playground|
| 🌐 HF 下载中心    |      | (日常8K / 方案A/B/C)|      | 📱 Cherry Studio  |
+-------------------+      +-------------------+      +-------------------+
```

### 步骤 1：下载或导入模型
1. 切换至 **「🌐 HF 下载与收藏中心」**。
2. 在输入框粘贴你的 HuggingFace 下载命令，例如：
   ```text
   hf download hf://empero-ai/Qwen3.8-9B-GGUF/Qwen3.8-9B-Q4_K_M.gguf
   ```
3. 系统自动解析出 Repo 与 Filename，点击 **「收藏并立即下载」**。
4. 在进度条中查看下载速度与剩余时间，下载完成后会自动加入 **「📦 本地模型库」**。

### 步骤 2：启动 Llama 推理服务
1. 切换至 **「🚀 服务控制台」**。
2. 在下拉框中选择要运行的模型文件（如 `Qwen3.8-9B-Q4_K_M.gguf`）。
3. 点击选定一个预设方案（例如 **方案 A 32K** 或 **日常轻量 8K**）。
4. 点击 **「🟢 启动 Llama 服务」**。
5. 在下方 **「实时终端日志」** 中可看到模型层数加载进度与就绪提示。

### 步骤 3：测试与接入第三方客户端
- **网页内测试**：点击下方的 **「快速推断对话 Playground」** 标签页，直接发送提示词即可测试流式输出。
- **原生 WebUI**：点击顶部或卡片上的 **「打开 WebUI」**，跳转到 `http://127.0.0.1:8080`。
- **第三方客户端接入（Cherry Studio / NextChat / Chatbox 等）**：
  - **API 地址 (Base URL)**: `http://127.0.0.1:8080/v1`
  - **API Key**: 任意填写（如 `123`）
  - **模型名称**: 填写当前运行的模型名称或 `default`

---

## 📂 项目结构说明

```
D:\99_lamma\lammaManage\
├── package.json               # 项目依赖与运行脚本
├── vite.config.js             # Vite 构建与 API 代理配置
├── start.bat                  # Windows 一键启动脚本
├── index.html                 # 前端 HTML 入口
├── README.md                  # 项目使用与说明文档
│
├── server/                    # 后端服务源码 (Node.js Express)
│   ├── index.js               # Express 主服务 (API 路由、静态托管、SSE 事件流)
│   ├── llamaManager.js        # Llama-server 进程生命周期与日志管理
│   ├── modelManager.js        # 本地 GGUF 模型扫描与元数据解析
│   ├── hfDownloader.js        # HuggingFace 链接解析与下载任务管理
│   ├── download_worker.py     # Python 极速镜像多线程下载脚本
│   ├── config.json            # 路径与预设方案持久化配置
│   └── data/
│       └── bookmarks.json     # 模型收藏夹数据
│
└── src/                       # 前端源码 (React + Vite)
    ├── main.jsx               # React 应用挂载入口
    ├── App.jsx                # 全局状态管理与 SSE 实时同步
    ├── index.css              # 现代化深色毛玻璃设计系统
    ├── api/
    │   └── client.js          # 后端 REST 与 SSE 接口封装
    ├── utils/
    │   ├── hfParser.js        # HuggingFace 链接即时解析正则
    │   └── formatters.js      # 字节与时间格式化工具
    └── components/            # UI 组件库
        ├── Header.jsx         # 顶部状态导航栏
        ├── DashboardTab.jsx   # 🚀 服务控制台与启动器
        ├── ModelsTab.jsx      # 📦 本地模型库管理
        ├── DownloadTab.jsx    # 🌐 HF 下载与收藏中心
        ├── SettingsTab.jsx    # ⚙️ 系统设置与 API 指南
        ├── LogViewer.jsx      # 实时终端日志监视器
        ├── ChatPlayground.jsx # 快速对话测试 Playground
        ├── QuickAddModal.jsx  # 快捷粘贴导入弹窗
        └── Toast.jsx          # 浮动提示通知
```
