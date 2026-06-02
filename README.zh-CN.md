# Request Mock Lite

[![Release](https://img.shields.io/github/v/release/eijil/request-mock-lite?style=flat-square)](https://github.com/eijil/request-mock-lite/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT111315?style=flat-square)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/chrome-extension-e85d40?style=flat-square)](https://github.com/eijil/request-mock-lite/releases)

**Request Mock Lite** 是一个轻量的 Chrome DevTools 扩展，用于在浏览器中捕获
API 请求，并模拟 `fetch` / `XMLHttpRequest` 响应。

[English README](README.md) · [下载最新版本](https://github.com/eijil/request-mock-lite/releases/latest)

![Request Mock Lite 面板](store-assets/screenshots/01-panel.png)

## 为什么需要它

前端开发经常依赖一些不稳定、未完成或难以复现的 API 状态。Request Mock Lite
让这个流程留在本地：捕获请求，生成规则，编辑响应，然后继续开发。

## 功能亮点

- 捕获当前调试页面中的 HTTP(S) 请求。
- 通过工具栏侧边栏直接打开规则管理器，无需先打开 DevTools。
- 从捕获到的请求快速创建 mock 规则。
- 模拟响应体、状态码和响应头。
- 为每条规则设置响应延迟。
- 格式化并校验 JSON 响应内容。
- 支持按 origin + path、完整 URL、包含文本或正则匹配。
- 使用分组管理规则。
- 支持开启或关闭分组和单条规则。
- 支持以 JSON 导入和导出规则。

## 截图

| 规则编辑 | 页面 mock 标识 |
| --- | --- |
| ![规则编辑](store-assets/screenshots/02-rule-editor.png) | ![页面 mock 标识](store-assets/screenshots/03-page-badge.png) |

## 安装

1. 从 [最新版本](https://github.com/eijil/request-mock-lite/releases/latest) 下载 `request-mock-lite.zip`。
2. 解压压缩包。
3. 打开 `chrome://extensions`。
4. 开启 **开发者模式**。
5. 点击 **加载已解压的扩展程序**。
6. 选择 `request-mock-lite` 文件夹。
7. 点击 Request Mock Lite 工具栏图标，打开侧边栏规则管理器。
8. 只有需要从当前调试页面捕获请求时，才打开 DevTools 并切换到 **Mock Lite** 面板。

## 使用

1. 点击 Request Mock Lite 工具栏图标，打开侧边栏规则管理器。
2. 手动新增规则、在 **Add** 流程里粘贴 cURL，或导入已有 JSON 规则文件。
3. 在管理器中开启或关闭分组和单条规则；变更会立即保存到扩展存储。
4. 如果要从真实请求生成规则，打开 **Mock Lite** DevTools 面板，刷新或操作页面，再在捕获到的请求上点击 **Mock this**。
5. 编辑匹配规则、状态码、响应头、延迟或响应体。
6. 保存规则，并重新触发该请求。

## 本地开发

克隆仓库后，将项目目录作为未打包扩展加载到 Chrome。

```bash
git clone https://github.com/eijil/request-mock-lite.git
cd request-mock-lite
```

打包发布 zip：

```bash
./scripts/package.sh
```

## 开源协议

[MIT](LICENSE)
