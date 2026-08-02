# 简历专家

基于目标岗位 JD 的个人简历优化工作台。项目会分析岗位要求、识别经历证据缺口、生成可核验的优化建议，并将最终简历保存为多个本地岗位版本。

## 已实现能力

- JD 解析、简历诊断、匹配分析与经历补证
- Mock / 真实大模型两种运行模式
- 按目标岗位保存、切换、重命名、复制和删除多个简历版本
- 浏览器本地自动保存，刷新或重新打开后继续使用
- 最终简历完整编辑，支持工作/项目经历和成果描述增删
- ATS 就绪度估算：关键词 40%、经历证据 30%、量化成果 20%、内容完整度 10%
- ATS 友好单栏 DOCX 下载
- A4 打印页，可通过浏览器保存为 PDF
- 独立的面试对话复盘模块
- Zod 请求与模型输出校验；OpenAI 使用严格 JSON Schema

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand + persist
- Zod
- docx
- Vitest

## 快速开始

项目统一使用 npm 和 `package-lock.json`。

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

如果当前终端找不到 `npm`，请先安装 Node.js LTS，并重新打开终端。

## 使用流程

1. 新建一个简历版本，或点击“使用示例数据”。
2. 填写目标岗位、JD 和原始简历后开始分析。
3. 查看 JD、诊断与 ATS 就绪度。
4. 在“经历补证”中补充真实经历并生成简历 bullet。
5. 选择优化风格并生成最终简历。
6. 在“最终简历”中人工编辑并保存。
7. 在“导出结果”中下载 DOCX，或打开打印页保存为 PDF。

顶部版本选择器用于管理不同岗位的简历。复制版本适合保留一份基础简历，再针对新的 JD 调整。

## Word 与 PDF

- DOCX 使用单栏正文、普通标题和项目符号，不使用表格、图片、图标或复杂分栏。
- PDF 通过专用 A4 页面生成：点击“打印为 PDF”，在浏览器打印窗口中选择“另存为 PDF”。
- 打印时建议关闭浏览器的页眉和页脚。
- ATS 分数是本地规则估算，用于发现内容缺口，不代表任何招聘系统的真实筛选结果。

## 大模型接入

未配置 API Key 时自动使用 Mock 模式，完整流程仍可体验。

可以点击页面右上角“AI 设置”，也可以创建 `.env.local`：

```env
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_PROVIDER=openai
```

API Key 输入框只粘贴服务商控制台生成的 Key 本身，不要包含“API Key：”、中文括号、说明文字或空格。格式错误时应用会自动回退 Mock，并要求重新填写。

项目通过 OpenAI 兼容的 `/chat/completions` 接口调用模型。OpenAI Provider 使用严格 JSON Schema；DeepSeek、Moonshot、Qwen、智谱、Gemini 等兼容 Provider 使用 JSON Object 模式，并统一经过 Zod 运行时校验。

模型返回无法解析或结构不合法时，系统只自动修复一次；再次失败会返回明确错误，不会把不完整数据写入简历。

## 数据与隐私

- 简历版本保存在当前浏览器的 `localStorage` 中，不会自动同步到云端。
- API Key 保存在本机项目目录的 `.ai-user-config.json` 中，该文件已被 Git 忽略。
- 使用真实大模型时，JD、简历和补充信息会发送给所配置的模型服务商。
- 清除浏览器站点数据会删除本地简历版本，重要内容请及时导出 DOCX。
- 面试录音上传文件仅用于本地项目，`data/recordings` 已被 Git 忽略。

## 验证命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 项目结构

```text
src/
├── app/
│   ├── api/                 # AI 与本地配置 API
│   └── print/               # A4 打印 / PDF 页面
├── components/
│   ├── documents/           # 简历版本管理
│   ├── resume/              # 编辑器、统一预览、ATS 卡片
│   └── steps/               # 工作流页面
├── lib/
│   ├── ai/                  # Prompt、Zod Schema、模型客户端
│   ├── export/              # DOCX 生成
│   └── ats.ts               # 确定性 ATS 评分
├── services/ai/             # Mock / LLM 服务层
├── store/                   # Zustand 文档库与持久化
└── types/                   # 简历、文档库与面试类型
```

## 当前边界

- 原始简历以文本方式输入，暂不解析上传的 DOCX/PDF。
- PDF 由浏览器打印生成，不使用原生 PDF 排版引擎。
- 当前为本机个人版，不包含账号、数据库、云同步、职位投递跟踪或语音转写。
