# 个人 知识库

个人学习与技术文档集，基于 VitePress 构建，push 到 `main` 分支后自动发布到 GitHub Pages。

## 目录结构

```
docs/
├── index.md            # 首页
├── frontend/           # 前端（中后台 SOP、渲染管线）
├── backend/            # 后端（核心能力 Case、Elasticsearch）
├── finance/            # 财务业务（财务系统详细设计）
└── devops/             # 运维（Shell/Docker/Nginx/私服）
```

## 本地预览

```bash
npm install
npm run dev        # http://localhost:5173
```

## 新增文档

1. 把 md 文件放进对应分类目录（新分类需在 `docs/.vitepress/config.ts` 加 sidebar/nav）
2. 在分类的 `index.md` 表格里加一行
3. `git push`，几分钟后自动上线

## 部署原理

`.github/workflows/deploy.yml` 会在 push 时自动构建并通过 GitHub Pages 发布。
首次使用需在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
