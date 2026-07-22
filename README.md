# 浅仪式之墓
<img width="2561" height="1440" alt="图片信息" src="https://github.com/user-attachments/assets/677d695a-62d3-4e53-98ec-b95e0f5d107e" />

一座给 **vibe coding / 被 AI 味耗干的人** 立的网页墓。

寒蝉式标题菜单 · 上坟短剧 · 手记 · 回响 · 雨声环境音。  
静态站点，可直接用 **Cloudflare Pages** 部署。

## 本地预览

用任意静态服务器打开根目录（推荐，避免 `file://` 限制）：

```bash
# Python
python -m http.server 8787

# 或 Node
npx --yes serve -l 8787
```

浏览器打开：`http://127.0.0.1:8787`

入口文件：`index.html`（单页应用，不要拆开访问）。

## Cloudflare Pages 部署

1. 连接本 GitHub 仓库  
2. **Framework preset**：None  
3. **Build command**：留空  
4. **Build output directory**：`/`（根目录）  
5. 部署后即可访问  

也可用 Wrangler：

```bash
npx wrangler pages deploy . --project-name=asagi-grave
```

## 目录结构

```
index.html      # 入口
app.js          # 路由与界面逻辑
content.js      # 文案（手记 / 回响 / 上坟）
shared.js       # 存档、雨声、通用交互
rain.js         # 雨动画
site.css        # 样式
bg.png          # 背景
audio/          # 雨声音频
ui/             # 标题菜单按钮图
assets/         # 参考素材
```

## 说明

- 雨声需用户先点击页面一次（浏览器自动播放策略）  
- 进度存在 `localStorage`  
- 右下角可静音雨声  

## License

站点代码以仓库为准；背景与音频请自行确认使用范围。
