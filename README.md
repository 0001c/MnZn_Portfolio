# MNZN. 作品集

当前站点采用静态HTML、CSS、JavaScript和内容JSON。默认使用MP4全关键帧滚动视频，首屏人物使用高清WebP九方向图集，人物及辫子全部由椭圆窗口裁切。

## 预览与发布

- `npm start`：先生成发布包，再预览发布版本，默认 http://127.0.0.1:4173/ 。可用PORT环境变量更换端口。
- `npm run dev`：预览未构建源文件，供内容编辑，默认同一端口。勿同时启动两个相同端口的服务。
- `npm run build`：生成 `dist/`，该目录可直接上传Netlify Drop；已提供netlify.toml，连接仓库后自动构建并发布dist。
- `npm run check`：资源、脚本、内容字段和发布包版本检查。
- `npm test`：人物交互、章节导航、视频寻帧、入场补完、工作循环及失败回退测试。

`dist/` 是自动生成目录，构建会清空并重建。不要在里面编辑；修改根目录index.html、assets/或content/后重新构建。发布时仅上传dist，原素材、工具和日志不会进入发布包。

## 视频加载与缓存

进入页面只加载 `assets/videos/主视频-scroll.mp4`。故事进入第二屏履历（故事时间3.5秒）时，开始下载第三屏入场及工作循环MP4。直接跳到第三屏或恢复靠后滚动位置也会触发下载。已开始的下载不因返回首屏而重复启动。

构建使用文件内容SHA-256前12位作为版本号，例如 `主视频-scroll.eb98f962427a.mp4`。脚本、样式、图片、视频和内容JSON的依赖地址都同步更新；内容变化会沿依赖链更新地址。发布资产使用 `Cache-Control: public, max-age=31536000, immutable`；入口HTML使用no-cache，以便发现新版本。`_headers`用于Netlify，本地发布预览也实现同样的缓存策略、ETag与Range。部署到其它托管服务时须配置对应响应头。

原始主视频.mp4和尾部视频.mp4因当前错误回退与无脚本观看仍会被用到，属于运行时资源，继续保留；正常加载不会请求它们。未使用的原始素材、WebM和旧版本位于 `_workspace/original-assets/`。

## 内容编辑

执行npm run dev，打开 `/_workspace/editor/content-editor.html`。编辑器只在本机读取/保存文件，保存目标仍为根目录 `content/portfolio.json`。作品图片放在 `assets/images/works/` 并填写站点相对路径。保存后刷新开发页面，发布前重新执行npm run build。原始录入说明在 `_workspace/docs/个人内容快速录入.md`。

## 目录

- `index.html`、`assets/`、`content/`：当前站点源文件，仅保留所需资源。
- `dist/`：包含版本号和托管缓存规则的纯静态发布包。
- `_workspace/original-assets/`：未使用原始图片、原视频、WebM、提示词及旧资产。
- `_workspace/legacy-root/`、`_workspace/archive/`：旧入口和历史方案。
- `_workspace/tools/`、`_workspace/tests/`、`_workspace/editor/`：构建、验证、内容编辑工具。
- `_workspace/docs/`、`_workspace/analysis/`、`_workspace/screenshots/`：说明、分析和验证证据。
- `_workspace/log/`：归档任务日志；根目录log/保留此次及后续日志，均不发布。开始新任务先读取最新日志，旧背景可从归档日志追溯。
- `_workspace/3d/`、`_workspace/参考/`：三维素材与参考资料。

当前加载与缓存验收报告见 `_workspace/docs/章节加载与版本缓存.md`，运行时文件清单见 `_workspace/manifests/runtime-assets.json`。

## 局域网访问

`npm run dev:lan`：同时提供源站预览与本地编辑页；`npm run lan`：预览dist发布版。默认端口4173，可通过PORT环境变量调整。终端打印局域网IP，其他设备连接同一网络后打开对应地址。局域网模式仅开放站点资源、内容JSON和编辑器，历史日志及原素材不开放。普通npm start/dev仍只监听本机。编辑器在HTTP局域网环境可能采用下载JSON方式保存；不会写回电脑上的文件。
