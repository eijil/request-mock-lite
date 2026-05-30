# Request Mock Lite

[English README](README.md)

一个轻量的 Chrome DevTools 扩展，用于捕获 API 请求并模拟
`fetch` / `XMLHttpRequest` 响应。

## 功能

- 捕获当前调试页面中的 HTTP(S) 请求。
- 从捕获到的请求快速创建 mock 规则。
- 模拟响应体、状态码和响应头。
- 支持按 origin + path、完整 URL、包含文本或正则匹配。
- 使用分组管理规则。
- 支持开启或关闭分组和单条规则。
- 支持以 JSON 导入和导出规则。

## 安装

1. 打开 `chrome://extensions`。
2. 开启 **开发者模式**。
3. 点击 **加载已解压的扩展程序**。
4. 选择 `request-mock-lite` 文件夹。
5. 打开 DevTools，并切换到 **Mock Lite** 面板。

## 使用

1. 打开 **Mock Lite** DevTools 面板。
2. 刷新或操作页面，让面板收集请求。
3. 在捕获到的请求上点击 **Mock this**。
4. 编辑匹配规则、状态码、响应头或响应体。
5. 保存规则，并重新触发该请求。
