# XuAI API Studio

一个用于测试 AI 多媒体 API 的静态网页工具。

## 当前功能

- 图片生成界面
- 模型选择
- API Base URL 配置
- API Key 输入
- Prompt 输入
- 尺寸、质量、数量配置
- 结果预览
- 演示模式占位图生成

## 注意事项

不要把真实 API Key 写入代码，也不要提交到 GitHub。

静态网页直接调用 API 可能会遇到：

1. API Key 暴露风险
2. 浏览器 CORS 限制
3. 请求额度被滥用

正式使用建议增加后端代理服务。
