# TraceNest UI Rebuilder

这是一个本地 Figma 插件，用来在“当前打开的 Figma 文件”里重建 TraceNest / 图迹应用界面，输出为可编辑的 Figma 原生图层。

## 使用方法

1. 用 Figma 桌面版打开你提供的 `Untitled` 文件。
2. 进入 `Plugins > Development > Import plugin from manifest...`。
3. 选择这个文件：`E:\PicFlow\figma-tracenest-rebuild-plugin\manifest.json`。
4. 运行 `Plugins > Development > TraceNest UI Rebuilder`。

插件会在当前文件里创建一个页面：`TraceNest / 图迹 - Editable UI`。

## 输出内容

- 使用 Frame、Text、Rectangle、Line、Ellipse、Component、Instance 等原生可编辑图层。
- 不导出截图，不把界面作为一张整图放入 Figma。
- 包含主工作台、创作复迹画布、Toast 和 Modal 示例。
- 图层命名包括：`Topbar`、`Sidebar`、`Gallery`、`Detail Panel`、`Prompt Area`、`Reference Images`、`Toast`、`Modal`。
- 包含本地组件：按钮、图标按钮、输入框、作品卡片、标签、侧栏行。

## 重复运行

再次运行插件会替换旧的 `TraceNest / 图迹 - Editable UI` 页面，方便迭代。
