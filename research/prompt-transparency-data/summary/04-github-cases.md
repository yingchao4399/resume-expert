# GitHub 案例摘要

- Langfuse：最成熟的 Prompt 注册、不可变版本、标签部署、组合、Playground 和 Trace 关联范式。
- Opik：Prompt Library 与本机 Agent Playground 结合最接近“应用运行 + 配置查看 + Trace”；源码桥接仍是单独能力。
- Promptfoo：最适合 Git 内 Prompt 文件和测评矩阵，不适合充当生产控制面。
- Agenta：一体化团队 LLMOps，能力完整但明显偏重。
- 共同点：都没有自动把任意 `.md`、TypeScript 内联字符串、Schema 注入和最终运行 Prompt 统一成一份可信目录；这一层必须由应用自己建立显式注册和来源映射。
