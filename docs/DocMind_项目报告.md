# DocMind 智能文档处理平台 — 项目汇报

> **Full-Scenario Intelligent Document Processing Assistant**
>
> React 19 + Vite 8 + FastAPI + PostgreSQL 16 + DeepSeek AI

---

## 一、项目概述

DocMind 是一个全场景智能文档处理平台，利用大语言模型（DeepSeek）为用户提供一站式的文档智能处理服务。平台支持多种文档格式的上传、解析、AI 处理、格式转换、版本控制和实时协作，旨在解决传统文档处理中格式多样、人工审校效率低、团队协作困难、版本管理混乱等痛点。

### 1.1 解决的问题

| 传统痛点 | DocMind 解决方案 |
|---|---|
| 文档格式多样、转换困难 | 多格式引擎：原生支持 DOCX/MD/PDF/TXT/PPTX/XLSX/CSV，自动识别与解析 |
| 人工审校效率低、易出错 | AI 智能校对：基于 DeepSeek 的语法、拼写、逻辑纠错，秒级响应 |
| 团队协作缺乏实时同步 | 实时协作：WebSocket 多人同步编辑，操作日志完整追踪 |
| 文档版本管理混乱 | 版本控制：每次修改自动保存版本，任意回滚 + Diff 对比 |
| 格式排版耗时费力 | 智能排版：AI 自动识别标题层级、段落格式，一键美化 |
| 文档内容提取分析难 | 智能总结：AI 自动提取关键信息，3 秒生成摘要 |
| 写作翻译需切换多个工具 | 一体化平台：6 种 AI 工具集成，支持链式处理 |
| 大文档处理等待时间长 | 异步队列：Celery + Redis 后台处理，实时进度推送 |

### 1.2 目标用户

- **企业办公人员** — 日常文档处理、报告撰写
- **学生/教师** — 论文撰写与审阅、作业批改
- **技术团队** — 技术文档协作、API 文档维护
- **内容创作者** — 文案优化润色、多语言翻译
- **行政管理者** — 批量文档管理、归档
- **研究人员** — 文献阅读与总结、数据提取

### 1.3 核心价值

- **多格式支持**：DOCX/MD/PDF/TXT/PPTX/XLSX/CSV/PNG/JPG 共 9 种格式
- **AI 驱动**：智能校对、总结、改写、提取、格式转换、Q&A + AI 对话助手
- **实时协作**：WebSocket 多人编辑，操作日志完整追踪
- **版本管理**：完整历史追踪与回滚，Diff 对比
- **异步处理**：Celery 后台任务队列，不阻塞用户操作
- **GitHub 集成**：OAuth 授权，代码文档双向联动

---

## 二、技术架构

### 2.1 技术栈总览

| 层级 | 技术选型 |
|---|---|
| **前端** | React 19, TypeScript 5, Vite 8, Tailwind CSS 4, TanStack Query 5, React Router 7 |
| **后端** | Python 3.12, FastAPI, Celery 5, SQLAlchemy 2 (Async), Pydantic v2, WebSocket |
| **数据库** | PostgreSQL 16, Redis 7 (缓存 + 消息队列), MinIO (对象存储), SQLite (Dev Fallback) |
| **AI 引擎** | DeepSeek API v1, 智能分块器, 文本清洗器, 策略模式 Pipeline |
| **基础设施** | Docker Compose, JWT (HS256), Argon2, Nginx |

### 2.2 前端架构

```
App (React Router 7)
  Layout: Navbar | Sidebar | Footer
  Pages (12 routes): Landing | Login | Register | Dashboard |
    DocumentEditor | AiToolPanel | VersionHistory | Collaboration |
    GitHubImport | Settings | AdminDashboard | AuthCallback
  Viewers (4): DocxViewer | MdViewer | PdfViewer | PptxViewer
  Components (24 files):
    ui/ — Button, Input, Modal, Toast, Dropdown, Badge, Card, Tabs...
    layout/ — Navbar, AppLayout
    ai/ — DraggableAiAssistant (全局可拖拽 AI 助手)
    github/ — RepoBrowser, FileTree
    viewer/ — ViewerRegistry, TextViewer, PdfViewer, PptxViewer, ImageViewer
```

**关键技术点：**
- TanStack Query 5 声明式服务端状态管理，staleTime 30s，自动缓存失效 + 后台刷新
- 自定义 i18n 国际化引擎，支持 zh-CN / en-US 动态切换
- React Router 7 受保护路由 + 公开路由分离
- Tailwind CSS 4 JIT 按需编译，零外部 UI 库依赖
- JWT 双令牌自动刷新拦截器

### 2.3 后端架构

**API 路由模块（11 个）：**

| 模块 | 功能 |
|---|---|
| `auth.py` | 认证（login/register/refresh/logout） |
| `users.py` | 用户管理（profile/settings/quota） |
| `documents.py` | 文档 CRUD（upload/download/delete/slides） |
| `processing.py` | AI 处理（proofread/rewrite/summarize/extract/convert/qa/async） |
| `ai.py` | AI 对话助手（chat — 通用知识 + 文档感知） |
| `versions.py` | 版本控制（history/rollback/diff） |
| `collaboration.py` | 协作（session/invite/permission） |
| `github.py` | GitHub 集成（oauth/repos/sync） |
| `oauth.py` | OAuth（callback/providers） |
| `admin.py` | 管理后台（stats/users/system） |
| `operations.py` | 操作日志（audit/trail） |

**服务层（8 个服务模块）：**
auth_service, document_service, ai_service, version_service, collaboration_service, github_service, oauth_service, user_service

**中间件栈：** CORS → Rate Limiter → JWT Auth → RBAC (Tier-based)

**认证流程：**
1. 用户登录 → Argon2id 密码验证
2. 签发 JWT HS256 Access Token (15min) + Refresh Token (7d)
3. Bearer Token 携带认证，中间件自动解析
4. Refresh Token 无感续期，黑名单快速失效

**WebSocket：** `/ws/collaboration/{doc_id}` 端点，多人实时编辑同步

**Celery 任务：** ai_process | document_export | batch_operation

### 2.4 数据库设计

**16 张数据表：**
users, documents, document_versions, operation_logs, collaboration_sessions, collaboration_participants, collaboration_operations, oauth_accounts, oauth_states, github_connections, user_tiers, user_quotas, ai_processing_tasks, document_shares, tags, tag_associations

**核心 E-R 关系：**
- users 1──N documents (owner_id FK)
- users 1──N oauth_accounts (user_id FK)
- documents 1──N document_versions (document_id FK)
- documents 1──N collaboration_sessions (document_id FK)
- documents N──M tags (tag_associations 中间表)
- documents 1──N ai_processing_tasks (document_id FK)
- users 1──1 user_quotas (user_id FK)

**关键设计决策：**
- UUID 主键：全局唯一，分布式友好
- TIMESTAMPTZ：带时区时间戳，多时区精准记录
- JSONB 字段：metadata_ 灵活存储扩展属性
- 软删除：deleted_at 字段实现逻辑删除，数据可恢复
- 异步 ORM：SQLAlchemy 2.0 async session，全链路非阻塞

---

## 三、核心功能

### 3.1 多格式文档支持

支持 9 种文件格式的上传与解析：DOCX, MD, PDF, TXT, PPTX, XLSX, CSV, PNG, JPG。
每个格式有专属的解析器和查看器，通过 ViewerRegistry 模式实现格式无关的文档展示。

### 3.2 AI 智能处理（6 大工具）

| 工具 | 功能 | 适用场景 |
|---|---|---|
| **Proofread 校对** | 语法、拼写、标点、风格纠错 | 论文、报告、邮件审校 |
| **Rewrite 改写** | 按指定语气/受众/长度重写 | 文案优化、多版本创作 |
| **Summarize 总结** | 提取核心信息生成摘要 | 文献阅读、会议纪要 |
| **Extract 提取** | 提取实体、表格、关键事实 | 数据分析、信息抽取 |
| **Convert 转换** | 格式间互转 | 跨平台文档兼容 |
| **Q&A 问答** | 基于文档内容回答问题 | 快速查找特定信息 |

### 3.3 AI 智能助手（新增）

一个可在全站自由拖拽的 AI 对话助手，具有以下特性：

- **自由拖拽** — 鼠标按住标题栏将面板拖到页面任意位置，自动限制在视口范围内
- **浮动球快捷入口** — 最小化时收起到右下角紫色渐变浮动球，带在线状态指示灯
- **多轮智能对话** — 基于 DeepSeek 大模型，记住上下文，支持中英文双语交流
- **项目功能知识** — 内置 DocMind 全部功能说明，引导用户使用各项功能
- **通用知识问答** — 可回答编程、技术、写作、翻译等任意领域问题
- **文档感知模式** — 传入 documentId 后自动加载文档内容，基于上下文精准回答

**技术实现：**
```
前端: DraggableAiAssistant 组件
  - useState + useRef + useEffect 管理状态
  - Mouse Events (mousedown/move/up) 实现拖拽
  - clampPosition() 边界限制算法
  - 快速提问快捷按钮 + 三点跳动加载动画

API: POST /api/v1/ai/chat
  - ChatRequest: { messages, document_id? }
  - ChatResponse: { message, tokens_used }

后端: FastAPI router (/ai prefix)
  - DeepSeekClient.chat() 调用
  - ASSISTANT_SYSTEM 系统提示词（项目知识）
  - ASSISTANT_DOC_CONTEXT_SYSTEM（文档感知）
```

### 3.4 实时协作

基于 WebSocket 的多人实时文档编辑：
- 实时光标位置同步
- 操作日志完整追踪
- 邀请制权限管理（view/comment/edit）
- 会话快照自动保存

### 3.5 版本控制

- 自动创建版本快照
- 任意版本回滚/恢复
- 版本间内容 Diff 对比
- 变更摘要记录

### 3.6 GitHub 集成

- OAuth 授权认证
- 仓库文件浏览与导入
- 支持 README 预览
- Rate Limit 状态显示

### 3.7 异步处理

- Celery 分布式任务队列
- Redis 消息中间件
- 大文档 AI 处理不阻塞用户操作
- 实时进度推送

---

## 四、AI 处理流水线

```
Upload → Parse → Clean → Chunk → AI Call → Aggregate → Result
  |        |       |       |        |          |          |
 MinIO  格式解析  文本清洗  智能分块  DeepSeek   结果聚合   SSE推送
存储    DOCX/MD   标准化   语义切割  策略执行   内容组装   前端展示
        /PDF/TXT          2000tokens  Proofread
                          200 overlap Summarize
                                      Rewrite
                                      Extract
                                      Convert
                                      QA
                                      Chat
```

**策略模式 Pipeline：**
- `ProofreadPipeline` — 语法/拼写/风格纠错
- `SummarizePipeline` — 核心信息提取摘要
- `RewritePipeline` — 语气/受众/长度重写
- `ExtractPipeline` — 实体/表格/关键事实提取
- `ConvertPipeline` — 格式互转
- `QAPipeline` — 文档问答
- `ChatPipeline` — 通用 AI 对话

---

## 五、安全架构

### 5.1 认证流程

1. 用户登录 → Argon2id 密码哈希比对（抵御彩虹表 + 暴力破解）
2. JWT HS256 签名 → Access Token (15min) + Refresh Token (7d)
3. Bearer Token 携带 → 中间件自动解析验证
4. Token 刷新 → 无感续期，黑名单检查
5. 安全登出 → Refresh Token 加入 Redis 黑名单，TTL 自动过期

### 5.2 安全防护层

| 层级 | 措施 |
|---|---|
| **密码安全** | Argon2id (RFC 9106), 内存成本 64MB, 随机 Salt |
| **JWT 安全** | HS256 签名, Access Token 15min, Refresh Token 黑名单, Payload 最小化 |
| **网络安全** | CORS 白名单, Security Headers, Rate Limiting, Request Size Limit |
| **数据安全** | AES-256 字段级加密, SHA-256 文件校验, SQL 注入防护 (ORM 参数化), XSS 防护 |

---

## 六、功能测试结果

测试策略：**3 种格式 (DOCX / MD / PDF) × 6 项功能 = 18 项全通过**

| 序号 | 测试功能 | DOCX | MD | PDF |
|---|---|---|---|---|
| 1 | 文档上传与解析 | PASS | PASS | PASS |
| 2 | AI 智能校对 | PASS | PASS | PASS |
| 3 | AI 智能总结 | PASS | PASS | PASS |
| 4 | AI 内容改写 | PASS | PASS | PASS |
| 5 | 格式保留与渲染 | PASS | PASS | PASS |
| 6 | 版本创建与回滚 | PASS | PASS | PASS |

**测试环境：** Dev Fallback Mode (SQLite + Local FS)
**测试时间：** 2026-06-04

---

## 七、技术亮点

1. **React 19 + TanStack Query 5** — 声明式状态管理，智能缓存，减少 70% 重复 API 请求
2. **JWT 双令牌机制** — 自动无感刷新，黑名单快速失效，前后端分离认证
3. **PostgreSQL 原生 UUID** — gen_random_uuid() 主键，TIMESTAMPTZ 多时区，JSONB 灵活扩展
4. **SQLAlchemy 2 全链路异步** — async/await 非阻塞，连接池复用，selectinload 避免 N+1
5. **Celery + Redis 异步任务** — 分布式任务队列，SSE 实时进度推送，支持重试和超时控制
6. **ViewerRegistry 模式** — 插件化文档查看器，格式自动路由，易于扩展
7. **DraggableAiAssistant** — 全局可拖拽 AI 助手，自由定位 + 视口约束，通用知识 + 文档感知
8. **Dev Fallback 模式** — SQLite + Local FS + 内存缓存，零外部依赖一键启动开发环境

---

## 八、未来规划

| 阶段 | 计划内容 |
|---|---|
| **Phase 1 (Current)** | AI 智能助手完善、核心功能优化、安全加固 |
| **Phase 2 (Q3 2026)** | PDF 导出增强、OCR 图片文字识别、高级语义搜索 |
| **Phase 3 (Q4 2026)** | 插件市场、企业 SSO 集成、移动端适配 |

---

## 九、项目统计

| 指标 | 数据 |
|---|---|
| 项目规模 | 80+ Python 文件 + 45+ TS/TSX 文件 = 125+ 源文件 |
| 数据模型 | 16 张数据表 (PostgreSQL 16) |
| API 路由 | 11 个路由模块，覆盖完整业务 |
| 前端页面 | 12 个页面 + 4 种文档查看器 + AI 助手组件 |
| 服务层 | 8 个服务模块 + 3 个 PPTX 渲染服务 |
| AI 工具 | 6 种文档处理 AI + 1 个全局 AI 对话助手 |
| UI 组件 | 24 个 React 组件，全手写 Tailwind CSS v4 |
| 测试覆盖 | 3 格式 × 6 功能 = 18/18 全通过 |
| 技术栈 | Python 3.12 + TypeScript 5 + DeepSeek AI |

---

> **DocMind** — 让文档处理更智能
>
> 2026 年 6 月
