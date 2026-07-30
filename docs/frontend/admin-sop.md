# 中后台前端系统构建 SOP · 主手册

> **这份文档解决什么问题**：你脑子里一片空白，不是因为知识不够，而是缺少一条**固定的开工顺序**。知识是散点，SOP 是把散点串成流水线。以后拿到新项目，你唯一需要判断的事是："我现在进行到哪个阶段了。" 判断完，照步骤执行，勾 DoD，进下一阶段。

---

## 一、核心心智模型：三层建设

任何中后台前端项目，都可以拆成三层，三层的**复用频率**和**建设节奏**完全不同：

| 层 | 内容 | 建设频率 | 耗时参考 |
|---|---|---|---|
| **基座层** | 脚手架、工程规范、目录架构、环境变量 | 每个技术栈一次，跨项目复用 | 首次 1 天，之后 clone 模板 10 分钟 |
| **全局层** | 设计系统、路由布局、请求层、全局状态、权限、类型、通用组件 | 每个项目一次 | 2~4 天 |
| **页面层** | 列表、表单、详情、Dashboard、系统管理…… | 量产，对号入座 | 每页 0.5~2 天 |

**关键认知**：
1. 中后台的新页面，90% 是已有配方的变体，不是新发明。你的工作量不在"想"，在"查配方 + 填参数"。
2. 基座层是**你个人的资产**。第二、第三个项目开始，直接从你的模板仓库 clone，跳过 Part A 从阶段 3 干起。这套 SOP 用得越多，你越快——通用组件库越攒越厚。
3. 全局层必须在写第一个业务页面**之前**做完。顺序颠倒（先堆页面再补权限/请求层）是项目变屎山的第一死因。

---

## 二、推进铁律：最小闭环优先

**第 3 天结束前，必须跑通这条链路**：Mock 登录 → 拿到假 token → 进入主布局（侧边栏+顶栏） → 看到一个 Mock 数据的列表页 → 退出登录。

之后的所有工作，都是在这个**活着的闭环**上加肉——而不是把零件攒到最后拼尸。闭环在，你每天下班都有一个能跑的系统；闭环不在，你连"改动有没有把系统搞坏"都无法验证。

衍生三条纪律：
- 全局层每个阶段做完就接入闭环验证（请求层做完 → 列表页换真请求层调 Mock；权限做完 → 菜单真的按权限码过滤），不允许"先写完以后再接"。
- 任何阶段 DoD 没勾完，不进入下一阶段。DoD 是闸门，不是建议。
- 卡壳超过半天：先查该阶段"常见坑"，再压缩范围（如权限先做单角色写死、暗色模式先不做），把降级方案记进 TODO，**保持闭环活着**优先于一步到位。

---

## 三、十四阶段全景图

| 阶段 | 名称 | 产出物一句话 | 篇章 |
|---|---|---|---|
| 0 | 需求对齐与技术决策 | 一页 ADR，9 个架构级问题全部有答案 | Part A |
| 1 | 脚手架与工程规范 | 能 `pnpm dev` 跑起来的规范化空工程 | Part A |
| 2 | 目录架构与命名规范 | 五层目录树 + 一个黄金样例模块 | Part A |
| 3 | 设计系统与全局样式 | 语义 token 体系，全项目零魔法数值 | Part B |
| 4 | 路由与全局布局 | 路由表即菜单，三套布局壳 | Part B |
| 5 | 数据请求层 | 拦截器/错误分层/queryKey 规范/Mock 切换 | Part B |
| 6 | 全局状态与用户会话 | 登录时序闭环 + 路由守卫 | Part B |
| 7 | 权限体系 RBAC | 菜单过滤 + 按钮级权限组件 | Part B |
| 8 | 类型体系与通用组件 | 10 个高复用组件入库 | Part B |
| 9 | 功能页面量产 | 14 种页面配方，对号入座 | **附录** |
| 10 | 联调与 Mock 切换 | 联调 checklist，扯皮点提前对齐 | Part C |
| 11 | 测试策略 | 高性价比测试组合 | Part C |
| 12 | 构建部署与 CI/CD | Nginx/Docker/流水线三件套 | Part C |
| 13 | 上线前终极检查单 | 30 条放行闸门 | Part C |

阶段依赖关系：`0 → 1 → 2` 严格顺序；`3、4` 可并行或与 5、6 流水推进；`5、6 → 7 → 8` 顺序；`9` 依赖 3-8 全部；`10-13` 顺序。**1-8 全部做完 = 基建验收点**，之后进入页面量产期。

---

## 四、第一周动作表（模板，可按项目压缩）

| 时间 | 干什么 | 下班前必须达到的状态 |
|---|---|---|
| Day 1 上午 | 阶段 0 收尾确认 + 阶段 1 脚手架与规范 | `pnpm dev` 能跑，提交有 lint 拦截 |
| Day 1 下午 | 阶段 2 目录架构，建空页面占位，部署链路探通 | 空系统能 build、能部署到测试环境 |
| Day 2 | 阶段 3 设计 token + 阶段 4 路由布局静态壳 | 三套布局渲染正常，菜单由路由表驱动 |
| Day 3 | 阶段 5 请求层+Mock + 阶段 6 会话与守卫 | **最小闭环达成**（登录→布局→Mock 列表→登出） |
| Day 4 | 阶段 7 权限 + 阶段 8 先封装三大件（ProTable/SearchForm/FormDialog） | 菜单按权限码过滤，三大件可被页面引用 |
| Day 5 | 用附录配方写第一个真实业务页面（选列表页），全流程验证基建 | 一个完整 CRUD 页面走通，基建缺口清单更新 |

第二周起：进入页面量产期，每天按附录配方交付页面，同步补齐剩余通用组件。

---

## 五、这份 SOP 的三种用法

1. **新项目从零开建**：主手册从阶段 0 顺序执行，每阶段 DoD 全勾再进下一阶段。
2. **接到页面需求**：直接翻附录目录，找到对应配方，按"结构解剖 → 数据流 → 实现步骤 → 边界清单"照做。
3. **中途救火/接手别人的项目**：用阶段 13 的检查单反向体检，缺什么回对应阶段补什么。

**每次项目结束后做一件事**：把本项目新沉淀的通用组件、新踩的坑，回写到这份 SOP 和你的模板仓库。SOP 是活的，你用一次它就升值一次。

---
# Part A 工程基座篇

> 本篇回答一个问题：新项目到手，从"一句话需求"到"能写业务代码"之间，这两天该干什么、按什么顺序干。照抄执行即可，每一步都给出判定标准。

## 阶段 0：需求对齐与技术决策（动手之前）

**目标**：用半天时间把决定架构走向的问题全部问清楚，形成一页《技术决策记录》，避免写到第三周推翻重来。这个阶段不写一行代码，但它是整个项目性价比最高的半天：架构级的返工（SPA 改 SSR、写死权限改 RBAC、独立部署改微前端）每一次都是以"周"为单位计价，而避免它只需要在会上多问一句话。

**时机**：拿到项目立项信息之后、敲第一行代码之前。前置是：你知道有这个需求，知道大概要做什么系统。

**步骤**：

1. 拉一个 30 分钟的会，或者发一条钉钉消息，按下面清单逐项确认，逐条记录答案。没有答案的项，写明"默认假设"并让相关人确认：

| 问题 | 为什么必须问 | 典型答案与影响 |
|---|---|---|
| 浏览器兼容范围 | 决定构建 target、是否引入 polyfill | 内网系统 Chrome 最新两版 → `target: 'esnext'`；要兼容 IE11 直接换方案 |
| 是否需要 SEO | 决定 SPA 还是 SSR | 中后台 99% 不需要 → 纯 SPA，别碰 Next.js/SSR 增加复杂度 |
| 权限模型 | 决定路由与菜单如何生成 | RBAC（后端下发菜单+按钮权限码）还是前端写死路由；前者工作量多 2 天，必须提前说 |
| 接口规范 | 决定 request 封装层形态 | 是否 RESTful、错误码结构（`{code, message, data}`?）、token 放 header 还是 cookie、有无刷新 token 机制 |
| 有无 UI 设计稿 | 决定组件库定制深度 | 有设计稿且大量非标组件 → 考虑自建组件层；没有 → 直接用 shadcn/ui + Tailwind 默认风格 |
| 多语言 | 决定文案是否全部走 i18n key | 需要 → 第一天就接 i18n，事后补是灾难 |
| 多租户 | 决定请求头、路由、主题隔离方式 | 需要 → 请求层统一注入 tenant-id，布局层留租户切换位 |
| 主题定制/暗色 | 决定 CSS 变量体系是否第一天就立 | 需要暗色 → Tailwind `dark:` 策略 + CSS 变量 token 先行 |
| 部署形态 | 决定构建产物、publicPath、登录态共享方式 | 独立部署 / 嵌入已有系统（iframe）/ 微前端（qiankun、Module Federation）；三者工程结构差异巨大 |

提问技巧：不要发开放式问题（"系统有什么要求？"），要发选择题（"权限是 A 后端下发菜单还是 B 前端写死？"）。开放题得到的答案永远是"看着办"，选择题才能逼出决策。所有口头结论当场转成文字发群里，@相关人，留痕。答不上来的项按"最保守假设"记录——例如权限先按 RBAC 预留接口位、多语言先不做但文案不硬编码在逻辑里——并标注假设的推翻成本。

2. 做技术选型决策。按这张表判断，别凭喜好：

| 情形 | 选开箱脚手架（Ant Design Pro / UmiJS / 若依） | 选手工搭 Vite 工程 |
|---|---|---|
| 定制化程度 | 页面以 CRUD 为主，风格贴近 Antd 默认 | 有独立设计稿、交互非标、要接 shadcn/Tailwind |
| 团队维护能力 | 团队偏全栈/后端转前端，没人愿意维护基建 | 有 1 名以上能维护构建与规范的前端 |
| 交付压力 | 两周要上线、Demo 性质 | 生命周期 1 年以上、会持续迭代 |
| 简历/成长价值 | 低，配置工程师 | 高，能讲清每一层为什么存在 |

一句话取舍：开箱方案用"前两周的速度"换"后两年的灵活度"，CRUD 占比超过七成且风格无要求就选它，否则手工搭。补充一个判断维度：开箱方案的黑盒程度与bug排查成本成正比，UmiJS 这类框架约定大于配置，顺它者昌逆它者亡，一旦需求突破框架约定（自定义构建、非标登录流、特殊部署），你会花比手工搭建更多的时间对抗框架。手工搭建前两周慢，但每一行配置都是自己的，出了问题知道去哪查。

3. 确定本 SOP 默认栈（若步骤 2 结论为手工搭建）：Vite + React 18 + TypeScript + pnpm + React Router v6+ + Tailwind CSS + shadcn/ui + TanStack Query + Zustand + react-hook-form + zod + Axios + ESLint/Prettier + Husky + Vitest。这套栈的选择逻辑一句话说清：Vite/pnpm 解决构建与依赖速度；TanStack Query 接管所有服务端状态（loading、缓存、失效重取），Zustand 只装真正的客户端全局态（登录用户、主题、侧边栏开合），两者边界划清就不用 Redux；react-hook-form + zod 让表单校验规则即类型定义，一份 schema 前后端可共享；shadcn/ui 的组件源码直接生成进仓库，可改可控，区别于 Antd 的黑盒引用；Tailwind 消灭 CSS 命名与样式文件爆炸。每一步有明确替代方案（如 UI 库换 Antd、状态换 Redux Toolkit）都不影响本篇流程，换的是零件不是图纸。

4. 写一页《技术决策记录》（轻量 ADR）。ADR 的作用不是存档，是"给未来的自己和接盘的人一个交代"：三个月后有人问"为什么不用 Antd 要用 shadcn"，你甩链接而不是重新吵一遍。模板如下，贴在仓库 `docs/adr/0001-tech-stack.md` 并进 git：

```markdown
# ADR-0001 技术栈与架构决策
- 日期 / 决策人：
- 背景：一句话业务背景
- 关键约束：浏览器范围、部署形态、权限模型、是否 SEO/多语言/多租户（逐条列答案）
- 决策：技术栈清单 + SPA/SSR + 脚手架 or 手工 + 理由（每条一句）
- 被否决方案：xxx，否决原因一句
- 后果：该决策带来的限制（如：不支持 IE、按钮级权限需后端配合）
```

**产出物**：确认完毕的需求清单一份、`docs/adr/0001-tech-stack.md` 一页。

**完成判定 DoD**：
- [ ] 清单 9 个问题每一条都有明确答案或书面默认假设
- [ ] 权限模型（RBAC or 写死）已与后端当面对齐，按钮级权限谁下发已明确
- [ ] 接口错误码结构与 token 机制有后端书面确认（聊天记录也行）
- [ ] SPA/SSR、独立部署/微前端已定，无人再提"到时候再说"
- [ ] ADR 文件已提交 git，后续改架构先改 ADR

**常见坑**：
- 做到一半被告知要嵌进老系统当微前端 → 阶段 0 必须当面问清部署形态，不要问"要不要 SEO"这种开放题，直接给选项。
- 后端说"权限很简单，前端写死吧"，两个月后变成 RBAC → 在 ADR 里写明"权限模型变更需重估工期"，让产品签字。
- 默认假设没人看，出了事扯皮 → 假设必须发给相关人并要求"回复确认或 24 小时无异议视为同意"。
- 看到新项目就上 Next.js 显得高级 → 中后台无 SEO 需求时 SSR 是纯负债，拒绝。
- 技术决策只存在自己脑子里 → 不写 ADR，三个月后没人记得为什么选它，包括你自己。

## 阶段 1：脚手架初始化与工程规范（第 1 天上午）

**目标**：半天内得到一个可运行、可提交、规范自动强制、环境可切换的空工程。这一上午的所有工作有一个共同特征：只做一次，终身受益，越晚做代价越大——规范工具在空项目上接入只要半小时，在有一百个存量文件的项目上接入要还债一周。

**时机**：阶段 0 的 ADR 写完之后。前置：本机装有 Node 18+ 与 pnpm（`npm i -g pnpm`）。

**步骤**：

1. 初始化工程并首次提交：

```bash
pnpm create vite my-admin --template react-ts
cd my-admin && pnpm install
git init && git add -A && git commit -m "chore: init vite react-ts"
```

2. 开 TS 严格模式。`tsconfig.json` 的 `compilerOptions` 保留并确认以下 5 项，其余不动：

```jsonc
{
  "compilerOptions": {
    "strict": true,                        // 总开关，必须开
    "noUncheckedIndexedAccess": true,      // arr[i] 返回 T|undefined，挡住一半越界 bug
    "noImplicitOverride": true,            // 重写方法必须标 override
    "noFallthroughCasesInSwitch": true,    // switch 漏 break 直接报错
    "forceConsistentCasingInFileNames": true
  }
}
```

为什么单独点名这几个：`strict` 是总开关不多说；`noUncheckedIndexedAccess` 是被低估最多的一个，它让 `arr[i]`、`map[key]` 的返回类型带上 `undefined`，中后台大量"接口数据没判空就渲染"的白屏 bug 在编译期就被挡掉。代价是某些循环里要多写一次判空——用这点啰嗦换线上事故，值。开启时机必须是第一天，项目中期再开会被存量报错淹没。

3. 配路径别名 `@/`，两处必须双写，缺一必踩坑。`vite.config.ts`：

```ts
import path from 'node:path'
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

`tsconfig.json` 的 `compilerOptions` 内加（给编辑器/类型检查用）：

```jsonc
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

4. 装规范工具链，一条命令装齐：

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh \
  prettier eslint-config-prettier lint-staged husky @commitlint/cli @commitlint/config-conventional
```

5. 写 ESLint flat config（`eslint.config.js`，ESLint 9 起唯一官方格式，别再建 `.eslintrc`）。最小骨架：

```js
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier, // 永远放最后：关掉所有和 Prettier 冲突的格式规则
)
```

思路：ESLint 管代码质量（未用变量、hooks 依赖），Prettier 管格式（缩进、引号），两者职责分开、用 `eslint-config-prettier` 消除交集，绝不让 ESLint 干格式的活。为什么不装 airbnb 那类重型规则集：规则越多，新人写的代码被满屏红线吓退的概率越高，先跑通"少量高价值规则 + 自动修复"，规矩再逐步加。`no-console` 只警告不报错，是给调试留活口，提 CI 再收紧。

6. 写 Prettier 与 editorconfig。`.prettierrc`：`{"semi": false, "singleQuote": true, "printWidth": 100, "trailingComma": "all"}`（团队有既定规范就用团队的，风格不重要，统一才重要）。`.editorconfig` 骨架：`root = true`，`[*]` 下 `charset=utf-8`、`indent_style=space`、`indent_size=2`、`end_of_line=lf`、`insert_final_newline=true`，保证换行符与缩进跨编辑器一致。

7. 上 Git 钩子。先 `pnpm exec husky init`，然后：
   - `.husky/pre-commit` 内容：`pnpm exec lint-staged` —— 提交前只检查暂存文件，不全量 lint，保证速度。
   - `package.json` 加：`"lint-staged": { "*.{ts,tsx}": ["eslint --fix", "prettier --write"], "*.{json,md,css}": ["prettier --write"] }`。
   - `.husky/commit-msg` 内容：`pnpm exec commitlint --edit $1`。
   - `commitlint.config.js`：`export default { extends: ['@commitlint/config-conventional'] }`，强制 `feat: xxx` / `fix: xxx` 格式，为以后自动生成 changelog 铺路。

   为什么这么做：lint-staged 只处理本次改动的文件，提交不被全仓库历史欠债拖慢；commitlint 把提交信息变成机器可读数据。

8. 建环境变量体系。原则：环境之间只允许环境变量不同，代码、构建命令完全一致——一份代码打出哪个环境的包，只由 `--mode` 参数决定。根目录建三个文件：
   - `.env.development`：`VITE_API_BASE_URL=/api`
   - `.env.staging`、`VITE_API_BASE_URL=https://staging-api.xxx.com`
   - `.env.production`：`VITE_API_BASE_URL=https://api.xxx.com`

   规则只有两条：① 只有 `VITE_` 前缀的变量会被注入客户端代码，不带前缀的拿不到；② 永远不要在前端环境变量里放真密钥，构建产物人人可读。类型声明写进 `src/env.d.ts`：

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
```

9. 理清 baseURL 与 dev proxy 的关系。原则是"业务代码永远不知道自己在哪个环境"：开发环境 `VITE_API_BASE_URL=/api`（相对路径），配合 `vite.config.ts` 的 proxy 把 `/api` 转发到真实后端，浏览器看到的是同源请求，天然无跨域，代码里也不出现任何环境判断分支：

```ts
server: {
  port: 5173,
  proxy: { '/api': { target: 'http://dev-backend:8080', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } },
},
```

生产环境没有 dev server，baseURL 直接写绝对地址，由 Nginx 反代或网关处理跨域。代码里一律 `import.meta.env.VITE_API_BASE_URL`，不写死任何域名。

10. 初始化目录（先建空骨架，阶段 2 再定规范细节）：`src/` 下建 `app/ pages/ features/ entities/ shared/ assets/`，`.gitignore` 确认含 `node_modules`、`dist`、`.env.local`、`.DS_Store`。

11. 定 git 分支模型简版：`main` 只接受发布合并并打 tag；`dev` 为集成分支；功能开发从 `dev` 切 `feature/xxx`，合并回 `dev`；线上 hotfix 从 `main` 切 `hotfix/xxx`，修完同时合回 `main` 和 `dev`。小团队别上完整 GitFlow，这三层足够。

12. 写 README，只写六块：项目一句话简介、环境要求（Node/pnpm 版本）、`pnpm install && pnpm dev` 启动命令、环境变量说明表、分支与提交规范一句话、目录结构一句话索引。README 写给三个月后的新人看，不是写论文；判断标准是"新人只看 README 能否在十分钟内把项目跑起来"，跑不起来就是 README 的锅，不是新人的锅。

13. 收尾策略三件套：
    - 本地 https：仅当后端 cookie 是 `Secure`/`SameSite=None` 或要调试第三方回调时才开，用 `@vitejs/plugin-basic-ssl`，否则不开。
    - 端口：固定 5173 写进配置，并同步给后端加进 CORS 白名单。
    - sourcemap：开发环境默认开；生产构建 `build.sourcemap: 'hidden'`，产物不带 map 文件引用，map 只传错误监控平台（Sentry），不随静态资源公开。不要选 `false` 一关了之——线上报错没有 map 等于没有堆栈，等于裸奔排查。

**产出物**：可运行的空工程一套；`eslint.config.js`、`.prettierrc`、`.editorconfig`、husky 钩子、commitlint 配置；三个环境变量文件 + `env.d.ts`；带 proxy 与别名的 `vite.config.ts`；ADR 与 README 入库。

**完成判定 DoD**：
- [ ] `pnpm dev` 能起、`pnpm build` 能过、`pnpm tsc --noEmit` 零报错
- [ ] 任意文件里 `import x from '@/xxx'` 编译器与编辑器都不报错（双写生效）
- [ ] 故意写一个未使用变量再 `git commit`，提交被 ESLint 拦下
- [ ] 故意写 `add something` 作为提交信息，被 commitlint 拦下
- [ ] `pnpm dev` 下请求 `/api/xxx` 经 proxy 打到真实后端且无跨域报错
- [ ] 切换到 `--mode staging` 构建，`import.meta.env.VITE_API_BASE_URL` 取到 staging 值
- [ ] 仓库里不存在 `.env.local`、不存在任何密钥类字符串

**常见坑**：
- 别名只配了 vite 没配 tsconfig（或反之）→ 运行正常但编辑器满屏红线，或反过来；两处都改，改完重启 TS Server。
- 装了 `.eslintrc.cjs` 又装了 `eslint.config.js` → flat config 时代旧文件被忽略但团队成员困惑，全新项目只留 `eslint.config.js`。
- Husky 钩子提交后队友拉代码不生效 → 确认 `package.json` 有 `"prepare": "husky"`，husky init 会自动加，别手删。
- 环境变量改了不生效 → `import.meta.env` 是构建时注入，改 `.env` 必须重启 dev server。
- lint-staged 全量扫仓库导致提交卡 30 秒 → 检查 glob 是否写成 `**/*`，正确写法只匹配暂存文件（lint-staged 自动过滤）。

## 阶段 2：目录架构与代码组织规范（第 1 天下午）

**目标**：立一套"上层依赖下层、业务按域隔离"的目录结构和命名约定，让每个文件该放哪有唯一答案，防止半年后目录失控。

**时机**：脚手架就绪之后、写第一个业务页面之前。前置：阶段 1 完成。

**步骤**：

1. 按 feature-based（业务域划分）+ 分层混合模式建目录。整体分两层管制：横向按"层级"分（app/pages/features/entities/shared），纵向在 features 内按"业务域"分。完整目录树如下，每个目录一行职责一句例子：

```
src/
├── app/                        # 应用装配层：全局唯一的初始化与组合
│   ├── router.tsx              # 路由表组装（例：createBrowserRouter(routes)）
│   ├── providers.tsx           # 全局 Provider 嵌套（例：QueryClientProvider + ThemeProvider）
│   └── main.tsx                # 入口，只做挂载
├── pages/                      # 路由页面层：一个文件对应一个路由，薄壳
│   ├── reconciliation/
│   │   └── list.tsx            # 例：/reconciliation 列表页，只做取参+拼 features 组件
│   └── login.tsx
├── features/                   # 业务域层：一个域一个文件夹，自包含
│   └── reconciliation/         # 对账域（内部结构见步骤 5）
├── entities/                   # 核心实体层：跨域复用的领域模型与只读展示
│   ├── user/                   # 例：User 类型、UserAvatar、useCurrentUser
│   └── order/
├── shared/                     # 基础设施层：与业务零耦合，可整包拷去别的项目
│   ├── api/                    # request 封装（例：axios 实例、错误码统一处理）
│   ├── ui/                     # shadcn/ui 生成的通用组件（button、dialog……）
│   ├── hooks/                  # 通用 hook（例：useDebounce、usePermission）
│   ├── lib/                    # 纯函数工具（例：formatMoney、download）
│   ├── types/                  # 全局公共类型（例：Pagination、ApiResponse）
│   ├── constants/              # 全局常量与枚举（例：ERROR_CODE、STORAGE_KEY）
│   └── config/                 # 运行时配置读取（例：env.ts 收口 import.meta.env）
├── assets/                     # 静态资源（图片、字体、svg）
└── env.d.ts
```

各层一句话职责：`app` 负责"把一切拼起来"；`pages` 负责"这个 URL 长什么样"，不写业务逻辑；`features` 负责"某个业务域的完整能力"；`entities` 负责"跨域都要用的核心数据模型"；`shared` 负责"换个项目也能直接用的东西"。

为什么要五层而不是平铺一个 `components/`：平铺结构在 20 个组件时很爽，200 个时就是灾难——改一个组件不知道谁在用，删一个组件不敢删。分层的本质是给每个文件标"影响范围等级"：层越靠下，动它之前要越小心；层越靠上，随便改。这套结构借鉴 Feature-Sliced Design 但做了简化，原版七层对中后台过重，五层是"管住依赖"与"学习成本"的平衡点。

2. 立依赖方向铁律，并写进 README 或 eslint 规则：

```
app → pages → features → entities → shared
```

规则三条：① 上层可以依赖下层，下层禁止反向依赖（shared 里出现一个 `import from '@/features/...'` 即违规）；② 同层不互相依赖，feature A 要用 feature B 的东西，把公共部分下沉到 entities 或 shared，禁止 `features/order` import `features/reconciliation`；③ pages 不互相 import，页面间跳转只走路由。

为什么这条规则能防屎山：项目腐化的起点几乎全是循环依赖和"随手 import 隔壁业务模块的内部实现"。单向依赖保证任何一层的改动影响面只向上不向下——改 shared 你知道会影响全部，改某个 feature 你知道只影响它自己和引用它的 page；新人也能凭目录位置推断代码稳定性，shared 里的东西敢用，features 内部的组件不敢乱引。这条规则执行成本极低、收益随项目时长指数增长，是整套规范里最不能妥协的一条。可选加固：用 `eslint-plugin-boundaries` 或 dependency-cruiser 在 CI 里自动拦截违规 import，前期靠 code review 也行。

3. 定命名规范，全项目一套口径。命名规范的价值不在"哪种风格更好"，而在"看到文件名就知道里面是什么"——`useReconList.ts` 一眼是 hook，`RECON_STATUS_OPTIONS` 一眼是常量，review 时不用点开文件就能判断 import 是否合理：

| 类别 | 约定 | 例子 |
|---|---|---|
| 组件文件 | PascalCase.tsx | `ReconDetailDrawer.tsx` |
| hook 文件 | camelCase，use 前缀 | `useReconList.ts` |
| 工具函数文件 | camelCase，动词开头 | `formatMoney.ts` |
| 类型文件 | `types.ts`（域内）或 camelCase | `features/reconciliation/types.ts` |
| 常量文件 | `constants.ts`，内容用 SCREAMING_SNAKE | `RECON_STATUS_OPTIONS` |
| 枚举 | PascalCase 声明 + SCREAMING_SNAKE 成员，优先 `as const` 对象替代 enum | `ReconStatus.Success` |
| 页面/目录文件夹 | kebab-case | `reconciliation/`、`user-center/` |
| CSS 类名 | Tailwind 原子类优先；必须自定义时 kebab-case + BEM 语义 | `recon-card__header` |
| 事件处理函数 | handle 前缀 | `handleSubmit`、`handleRowClick` |
| 布尔变量 | is/has/can/should 前缀 | `isReconciled`、`canExport` |

执行要点：枚举优先用 `as const` 对象加类型推导而不是 TS `enum`，原因是 `enum` 有运行时开销、与字符串字面量联合类型不互通，且 tree-shaking 不友好；组件文件名与内部默认导出的组件名保持一致，全局搜索时才一搜一个准。

4. 定 barrel 文件（`index.ts` 统一导出）的使用边界。规则：**每个 feature 对外只暴露一个 `index.ts`，层内文件之间不套 barrel**。利：对外接口收口，`import { ReconList } from '@/features/reconciliation'` 一眼看清这个域提供什么能力；重构内部文件结构时外部引用零改动。弊：多层 barrel 嵌套会让 tree-shaking 失效、产生隐式循环依赖（A 的 barrel 引 B，B 的 barrel 又引 A，运行时才爆 undefined）、IDE 跳转多跳一层。因此 shared/ui 这类纯组件库可以用 barrel，业务文件之间的内部引用一律直接写相对路径，禁止为"少打几个字母"在域内建 index。判断口诀：barrel 是"门面"，只装在模块的出入口，不装在走廊里。

5. 用"对账管理 reconciliation"做一个标准业务域样板，让所有人照抄。`features/reconciliation/` 内部结构：

```
features/reconciliation/
├── api/                        # 本域接口请求函数，只发请求不处理 UI
│   └── reconciliation.ts       # 例：fetchReconList(params)、exportRecon(id)
├── hooks/                      # 本域数据 hook，封装 TanStack Query
│   ├── useReconList.ts         # 例：useQuery({ queryKey: ['recon', 'list', params], ... })
│   └── useReconExport.ts       # 例：useMutation 导出并触发下载
├── components/                 # 本域私有组件，别处不许 import
│   ├── ReconFilterForm.tsx     # 筛选表单（react-hook-form + zod schema）
│   ├── ReconTable.tsx          # 列表表格，列定义内聚在这里
│   └── ReconDiffDrawer.tsx     # 差异详情抽屉
├── types.ts                    # 本域类型：ReconOrder、ReconDiffItem、ReconListParams
├── constants.ts                # 本域常量：RECON_STATUS_OPTIONS、状态-颜色映射
└── index.ts                    # 对外出口：只导出页面需要的组件和类型
```

各文件放什么的判定口径：和接口 URL 直接相关的放 `api/`，函数保持薄，签名即后端契约；带 `useQuery/useMutation` 的放 `hooks/`，queryKey 按 `[域, 资源, 参数]` 三级组织，方便失效重取；只被本域使用的 JSX 放 `components/`，一旦被第二个域引用就下沉到 entities 或 shared；后端返回结构和表单 schema 推导出的类型放 `types.ts`；下拉选项、字典映射放 `constants.ts`；`index.ts` 只 re-export，不写逻辑。页面层 `pages/reconciliation/list.tsx` 只做三件事：读路由参数、调用 `useReconList`、把数据传给 `ReconTable`——超过 50 行说明逻辑该下沉到 feature。

这个结构的隐藏收益：新增一个业务域时，整个过程是机械的——复制 reconciliation 文件夹、全局替换域名、改 api URL 和类型，半小时出一个新模块骨架。新人的第一个任务就让他照这个结构做一个简单域，做完即理解了整套规范，比讲一小时架构课有效。

6. 把规范落成团队可见的东西：目录树和依赖规则贴进 README"目录结构"一节；命名规范做成 README 附表；第一个照此规范写出的 reconciliation 模块作为"黄金样例"，后续 code review 直接对照它。规范写进文档只是第一步，真正的生效机制是"第一个样例 + review 对照"——人不会读规范，但会抄样例，所以黄金样例必须挑一个真实业务完整写一遍，不能是 toy demo。

**产出物**：完整分层目录骨架（含空目录用 `.gitkeep` 占位）；README 中的目录职责表与依赖方向规则；命名规范表一份；`features/reconciliation/` 黄金样例模块一个。

**完成判定 DoD**：
- [ ] 五层目录全部建立，任意一个新文件团队成员能秒答该放哪层
- [ ] 全项目 grep 不到 `shared` 或 `entities` 里 import `features/` 的语句
- [ ] 任意 feature 之间不存在相互 import（grep 验证）
- [ ] reconciliation 样例模块的 api/hooks/components/types/constants 各司其职，pages 层文件不足 50 行
- [ ] 每个 feature 有且仅有一个对外 `index.ts`，域内引用全部走相对路径
- [ ] 命名规范表进入 README，code review 有人对照执行

**常见坑**：
- 层建好三个月后 `shared/` 变成垃圾场，什么都往里塞 → 入 shared 的门槛是"敢不敢整包拷到下一个项目"，不敢就不许进。
- feature 之间图省事直接互相 import，半年后改 A 坏 B → 公共逻辑第一时间下沉 entities，code review 见到跨域 import 直接打回。
- barrel 文件层层嵌套导致打包体积暴涨、循环依赖报错查半天 → 只对 feature 对外出口用 barrel，域内禁止。
- `components/` 和 `pages/` 职责混了，页面里写 300 行业务逻辑 → 页面只许"取参数、调 hook、拼组件"，超行就下沉。
- 类型到处散落，后端改字段要改十个文件 → 每个域的类型集中在 `types.ts`，接口返回类型与表单 schema（zod 推导）放一起。
# Part B 全局架构篇

> 本篇覆盖阶段 3～8，默认技术栈：Vite + React 18 + TypeScript + React Router v6+ + Tailwind CSS + shadcn/ui + TanStack Query + Zustand + Axios + react-hook-form + zod。目标：拿到新项目后，照本篇步骤把"全局性内容"一次性搭完，后续只做业务。

---

## 阶段 3：设计系统与全局样式

**目标**：建立一套不写死任何颜色/间距数值的设计 token 体系，让全站样式"有据可依"。

**时机**：项目脚手架搭好之后、写第一个页面之前。前置：Tailwind 已装好（阶段 2 内容）、shadcn/ui 已初始化。

**步骤**：

1. **立规矩：禁止魔法值**。任何 <code v-pre>style={{ color: '#1677ff' }}</code>、`className="mt-[13px]"` 一律打回。规矩一条：颜色必须来自语义 token，间距必须是 4 的倍数（Tailwind 的 `1/2/3/4...` 默认就是 4px 倍数），字号必须落在约定阶梯上。这条规矩写进团队的 lint / Code Review 清单，比任何工具都有效。

2. **建两层 token 结构**。第一层是"原始值"（CSS 变量），定义在 `:root` 里；第二层是"语义映射"（Tailwind theme），把变量映射成语义类名。业务代码只允许用第二层。

```css
/* src/styles/tokens.css 第一层：原始值（HSL 便于调透明度） */
:root {
  --primary: 221 83% 53%;          /* 品牌主色 */
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;       /* 主文字 */
  --muted-foreground: 215 16% 47%; /* 次要文字 */
  --border: 214 32% 91%;
  --radius: 6px;
}
.dark {
  --background: 222 47% 8%;
  --foreground: 210 40% 96%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 17%;
}
```

3. **在 tailwind.config 里做第二层映射**，让业务里写的是 `bg-background text-foreground text-muted-foreground`，而不是 `bg-[hsl(...)]`：

```js
// tailwind.config.js 节选
theme: {
  extend: {
    colors: {
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      'muted-foreground': 'hsl(var(--muted-foreground))',
      primary: 'hsl(var(--primary))',
      success: 'hsl(var(--success))',
      warning: 'hsl(var(--warning))',
      danger: 'hsl(var(--danger))',
      border: 'hsl(var(--border))',
    },
    borderRadius: { DEFAULT: 'var(--radius)' },
  },
}
```

4. **语义 token 命名约定**：颜色用语义名（primary/success/warning/danger），禁止用色名（blue/red）；文字分 `foreground`（正文）/ `muted-foreground`（辅助说明）两档，不要再细分第三档；状态组件一律从这四个状态色取值。好处：换主题、换品牌色时只改第一层。

5. **没有设计师时，直接抄一套数值体系，不要自己发明**。推荐默认值（抄 shadcn 默认主题 + Ant Design 规范数值）：
   - 字号阶梯：`12 / 13 / 14 / 16 / 20 / 24`（12 辅助文字，13 表格正文，14 正文，16 小标题，20 模块标题，24 页面大标题），对应 Tailwind `text-xs / text-[13px] / text-sm / text-base / text-xl / text-2xl`。
   - 间距：全部 4 的倍数，常用档位 4/8/12/16/24/32，页面内元素间距默认 16，卡片内边距默认 16 或 24。
   - 圆角：三档 `4 / 6 / 8`，按钮输入框 6，卡片 8，标签 4。
   - 行高：正文 1.5，标题 1.3。

6. **组织全局样式文件**，`src/styles/` 下固定四个文件：

```
src/styles/
├── index.css      # 汇总入口：@tailwind 指令 + 引入下面三个
├── tokens.css     # CSS 变量（主题色、暗色覆盖）
├── base.css       # reset 补丁：box-sizing、body 字体、#root 高度、链接色
└── utilities.css  # 滚动条美化、全局过渡、focus 样式
```

```css
/* utilities.css 节选 */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
a, button { transition: color .2s, background-color .2s, border-color .2s; }
```

7. **暗色模式用 class 策略**（`tailwind.config.js` 里 `darkMode: 'class'`），包一个极简 ThemeProvider：读 localStorage → 决定根节点 `<html class="dark">` → 提供切换函数。骨架：

```tsx
// src/shared/components/ThemeProvider.tsx
const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>(null!);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>{children}</ThemeContext.Provider>;
}
```

8. **定死布局常量**，写在 `src/shared/constants/layout.ts`，任何地方不重复出现字面量：

```ts
export const LAYOUT = {
  SIDER_WIDTH: 208,        // 侧边栏展开宽度
  SIDER_WIDTH_COLLAPSED: 64,
  HEADER_HEIGHT: 56,       // 顶栏高度
  CONTENT_MAX_WIDTH: 1440, // 内容区最大宽度（超过居中）
  PAGE_PADDING: 16,        // 页面统一 padding
} as const;
```

**产出物**：
- `src/styles/`（index/tokens/base/utilities 四个文件）
- `tailwind.config.js` 的语义色映射 + `darkMode: 'class'`
- `src/shared/components/ThemeProvider.tsx`
- `src/shared/constants/layout.ts`
- 一页团队约定文档：字号/间距/圆角阶梯

**完成判定 DoD**：
- [ ] 全项目搜不到十六进制色值出现在业务组件里（grep `#` 只命中 tokens.css 和配置文件）
- [ ] tailwind 配置里存在 primary/success/warning/danger/foreground/muted-foreground 语义色且全部来自 CSS 变量
- [ ] 切换暗色模式，页面所有背景/文字/边框颜色正确翻转，无刺眼白块
- [ ] 布局常量统一从 `LAYOUT` 取，侧边栏/顶栏/页面 padding 全站一致
- [ ] 任意页面的字号全部落在 12/13/14/16/20/24 阶梯内

**常见坑**：
- 坑：团队成员图省事直接写 `text-[#666]`。对策：Code Review 检查清单第一条就是"grep 魔法色值"，或在 eslint 里禁掉 `text-[#`、`bg-[#` 模式。
- 坑：token 一层直接写业务（`var(--blue-500)`），换主题全炸。对策：强制两层结构，第一层只允许 tokens.css 引用。
- 坑：暗色模式闪白（SSR/首帧 html 无 class）。对策：在 index.html 里内联一段同步脚本，先读 localStorage 再加 class，不等 React。
- 坑：间距随手写 `mt-[13px]` 对不齐栅格。对策：约定 4 的倍数，Tailwind 数字档位天然满足，禁用任意值写法。
- 坑：每个页面自己定 padding。对策：页面容器统一由 PageContainer（阶段 8）渲染，padding 写死在一个地方。

---

## 阶段 4：路由与全局布局

**目标**：搭好"路由配置即菜单数据源"的集中式路由与三层布局壳子，之后加页面只需在路由表里加一条记录。

**时机**：设计 token 完成后、业务页面开工前。前置：React Router v6 已装。

**步骤**：

1. **集中式路由表**，所有页面注册在一个文件里，meta 字段约定好（title/icon/authCode/keepAlive/hideInMenu）：

```tsx
// src/router/routes.tsx
export interface RouteMeta {
  title: string;
  icon?: ReactNode;
  authCode?: string;      // 权限码，见阶段 7
  keepAlive?: boolean;    // 是否缓存页签
  hideInMenu?: boolean;   // 详情页等不进菜单
}
export type AppRoute = RouteObject & { meta?: RouteMeta; children?: AppRoute[] };

export const routes: AppRoute[] = [
  {
    path: '/', element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', lazy: () => import('@/pages/Dashboard'), meta: { title: '工作台' } },
      { path: 'finance/recon', lazy: () => import('@/pages/finance/Recon'),
        meta: { title: '对账管理', authCode: 'finance:recon:view' } },
      { path: 'finance/recon/:id', lazy: () => import('@/pages/finance/ReconDetail'),
        meta: { title: '对账详情', hideInMenu: true } },
    ],
  },
  { path: '/login', element: <AuthLayout />, children: [{ index: true, lazy: () => import('@/pages/Login') }] },
  { path: '/403', lazy: () => import('@/pages/Error/Forbidden') },
  { path: '*', lazy: () => import('@/pages/Error/NotFound') },
];
```

**菜单数据源直接由 routes 生成**：递归过滤 `hideInMenu` 和无权限项（阶段 7 讲过滤），标题/图标取 meta。菜单和路由永远一致，不存在两处维护。

2. **三层布局壳子**：
   - `RootLayout`：侧边栏 + 顶栏 + `<Outlet />`，所有登录后页面挂这里。
   - `AuthLayout`：居中卡片壳，只给登录/注册用。
   - 空白布局：不建组件，路由直接挂页面即可（如打印页）。
   层级：`AuthLayout` 与 `RootLayout` 平级挂在根路由下，互不嵌套。

3. **懒加载 + Suspense 兜底**：每个页面用 `lazy:`（Router v6.4+ 原生支持），在 RootLayout 的 Outlet 外包一层 Suspense，fallback 用居中 Spin，避免每个页面写 loading。

```tsx
// src/layouts/RootLayout.tsx 节选
<Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner /></div>}>
  <Outlet />
</Suspense>
```

4. **兜底路由**：`*` 配 404；`/403` 独立页面；路由守卫里权限不足统一跳 403（阶段 6/7）。不要在每个页面里自己判断"没权限"。

5. **面包屑自动生成**：用 `useMatches()`（v6 提供）拿到当前匹配链，每条 match 的 handle/meta 里有 title 就渲染，自动出层级，无需手写：

```tsx
// src/layouts/Breadcrumb.tsx
const matches = useMatches();
const items = matches
  .filter(m => (m.handle as RouteMeta)?.title)
  .map(m => ({ title: (m.handle as RouteMeta).title, path: m.pathname }));
```

6. **多 tab 页签（keep-alive）：默认不做**。中后台 90% 项目用 URL 状态（页码、筛选条件进 searchParams）就能满足"切走再回来不丢状态"。只有产品明确要求多页签时才做，且做轻：用 `react-router-cache-route` 之类重型方案不值得，自己实现一个"按 path 缓存 Outlet 实例"的 TabLayout 约 100 行，且只缓存 meta.keepAlive 为 true 的路由。**写进 SOP 的决策：先 URL 状态，不够再页签。**

7. **侧边栏组件**：菜单数据由路由表递归生成；选中态用 `useLocation().pathname` 与菜单 path 做前缀匹配（`/finance/recon/123` 命中 `/finance/recon`）；折叠状态存 Zustand + persist（阶段 6）。递归渲染骨架：

```tsx
// src/layouts/SiderMenu.tsx
function renderMenu(items: MenuItem[]) {
  return items.map(item =>
    item.children?.length ? (
      <SubMenu key={item.path} icon={item.icon} title={item.title}>{renderMenu(item.children)}</SubMenu>
    ) : (
      <MenuItem key={item.path} icon={item.icon}>
        <Link to={item.path}>{item.title}</Link>
      </MenuItem>
    )
  );
}
```

8. **顶栏组件**：左面包屑，右依次为消息入口（Badge + 下拉）、主题切换按钮（调 ThemeProvider）、用户下拉（头像 + 用户名 + 退出登录）。顶栏组件不写业务逻辑，只做组合。

9. **响应式折叠**：`window.innerWidth < 1024` 时侧边栏自动收起为图标态（用 `useMediaQuery` hook），移动端抽屉式弹出。中后台主要面向桌面端，做到"1024 以下折叠"即可，不做更细的适配。

**产出物**：
- `src/router/routes.tsx`（集中路由表 + RouteMeta 类型）
- `src/layouts/RootLayout.tsx`、`AuthLayout.tsx`、`SiderMenu.tsx`、`HeaderBar.tsx`、`Breadcrumb.tsx`
- 菜单数据生成器 `src/router/menu.ts`
- 404/403 页面
- （可选）`src/layouts/TabLayout.tsx`

**完成判定 DoD**：
- [ ] 新增一个页面只需在 routes.tsx 加一条记录，菜单、面包屑、标题自动出现
- [ ] 刷新任意深层路由，侧边栏选中态正确、面包屑层级正确
- [ ] 访问不存在路径出 404，无权限路径跳 403
- [ ] 页面切换有 Suspense 兜底 loading，无白屏闪烁
- [ ] 侧边栏折叠/展开正常，刷新后折叠状态保持
- [ ] 登录页与主布局互不嵌套，/login 不出现侧边栏

**常见坑**：
- 坑：菜单和路由两份数据，改一个忘一个。对策：菜单永远从路由表生成，禁止手写菜单数组。
- 坑：详情页选中不了所属菜单。对策：选中态用前缀匹配而非全等。
- 坑：lazy 页面切换白屏半秒。对策：Suspense fallback 放 RootLayout 里一次搞定，fallback 用骨架屏而不是空白。
- 坑：面包屑手写，层级一深就错。对策：一律 useMatches 自动生成。
- 坑：上来就做多 tab keep-alive，内存泄漏+状态错乱排查两周。对策：先用 URL 状态方案，明确需求再上页签。

---

## 阶段 5：数据请求层（最重要的一层）

**目标**：全站只有一个请求出口、一个错误处理出口、一套缓存规范。业务代码里永远不出现裸 axios 调用和 try/catch toast。

**时机**：布局壳子之后、第一个接口联调之前。前置：Axios、TanStack Query 已装。

**步骤**：

1. **封装 Axios 实例**。一个实例管 baseURL、超时、token 注入、响应解包：

```ts
// src/shared/api/http.ts
import axios from 'axios';
import { useUserStore } from '@/stores/user';

export const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE, timeout: 15000 });

http.interceptors.request.use(config => {
  const token = useUserStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  res => {
    const { code, data, message } = res.data;
    if (code === 0) return data;                       // 业务成功，直接解包
    return Promise.reject(new BizError(code, message));// 业务失败，抛业务错误
  },
  err => Promise.reject(normalizeHttpError(err)),      // HTTP 层错误统一包装
);
```

约定后端统一返回 `{ code, data, message }`，`code === 0` 为成功。拦截器解包后，业务层拿到的就是 data 本身，不再 `.data.data`。

2. **错误分两层处理，出口唯一**：
   - **业务错误码**（HTTP 200 但 code ≠ 0）：在响应拦截器抛 `BizError`，默认在全局 onError 里 toast message，业务页一般不处理。
   - **HTTP 错误码**（4xx/5xx/超时）：在 `normalizeHttpError` 里归一化成 `{ status, message }`，再按状态走策略。

3. **统一错误策略表**，写死在拦截器/全局 onError 里，业务代码不重复写：

| 错误 | 策略 |
|---|---|
| 401 | 清空 token → 跳 /login（带 redirect 回跳参数） |
| 403 | toast "无权限" 或跳 /403（页面级跳，按钮级 toast） |
| 5xx | toast "服务异常，请稍后重试" |
| 超时/断网 | toast "网络异常" + 幂等 GET 自动重试 1~2 次 |
| 其他业务码 | toast 后端返回的 message |

**铁律：错误提示只有一个出口**（全局 onError），页面里只有需要"就地展示"（如表单提交失败留在按钮 loading 态）才自己 catch，且 catch 后必须 `throw` 标记已处理，防止重复 toast。简单做法：给请求 config 加 `skipErrorHandler: true` 白名单位。

4. **双 token 无感刷新队列**。要点：401 时先拿 refreshToken 换新 token，期间并发来的请求挂起，刷新成功后重放；刷新失败才登出：

```ts
// src/shared/api/refresh.ts 思路骨架
let refreshing: Promise<string> | null = null;
async function refreshToken(): Promise<string> {
  if (!refreshing) {
    refreshing = api.refresh().then(res => {
      useUserStore.getState().setToken(res.accessToken);
      return res.accessToken;
    }).finally(() => { refreshing = null; });
  }
  return refreshing; // 并发请求共享同一个 Promise，天然排队
}
// 响应拦截器 401 分支：
// const newToken = await refreshToken();
// 重放原请求：return http({ ...err.config, headers: { Authorization: `Bearer ${newToken}` } });
```

5. **TanStack Query 集成**。先定 queryKey 规范，这是可维护性的关键：

```
['user', 'list', { page, keyword }]   // 模块/资源/参数 三段式
['user', 'detail', id]
['dict', 'orderStatus']               // 字典类
```

- 禁止把 key 写成字符串拼接（`'userList' + page`），必须数组形式，方便按前缀 invalidate。
- 默认值：`staleTime: 30_000`（30 秒内不重复请求）、`retry: 1`、GET 失败全局 toast。
- mutation 后按前缀失效：操作完用户列表就 `queryClient.invalidateQueries({ queryKey: ['user'] })`，把 list 和 detail 一起刷掉，不要精确到单条 key。

```tsx
// src/shared/api/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { onError: err => toast.error(getErrMsg(err)) },
  },
});
```

6. **Mock 方案**：项目内 mock 用 `vite-plugin-mock`（零侵入、改配置即切）；需要给测试/Storybook 复用同一套假数据时用 MSW。二选一即可，不要都上。目录固定：

```
mock/                  # vite-plugin-mock 数据文件，按模块分文件
├── user.ts
└── finance.ts
```

联调切换：环境变量控制，`.env.development` 里 `VITE_USE_MOCK=true` 开 mock，`vite.config.ts` 里按变量决定是否注册插件；切真后端只需改 env，不改代码。

7. **TypeScript 类型来源**：后端能提供 OpenAPI 文档就用 `openapi-typescript` 生成 DTO（一条命令进 `src/shared/api/types.gen.ts`，每次后端改完重新生成）；后端给不了文档就手写在 `src/shared/api/dto/`，按模块分文件。**取舍一句话：有文档必生成，无文档才手写，禁止对着响应体在组件里 inline 定义类型。**

**产出物**：
- `src/shared/api/http.ts`（实例 + 双拦截器）、`refresh.ts`、`errors.ts`
- `src/shared/api/queryClient.ts` + 全局 QueryClientProvider
- `mock/` 目录 + 环境变量切换逻辑
- queryKey 命名规范（写进团队约定文档）
- `src/shared/api/dto/` 或 `types.gen.ts`

**完成判定 DoD**：
- [ ] 全局搜不到组件里 `import axios from 'axios'` 的裸用法
- [ ] 业务代码 `await userApi.list()` 拿到的就是 data，无二次解包
- [ ] 制造 401：自动跳登录且回跳原页面；制造 500：只弹一次 toast
- [ ] token 过期瞬间发 3 个并发请求，只刷新一次 token 且 3 个请求都成功重放
- [ ] 同一 queryKey 两秒内切换页面回来不发重复请求（staleTime 生效）
- [ ] `VITE_USE_MOCK` 一键切换 mock / 真后端，无需改业务代码

**常见坑**：
- 坑：错误 toast 弹两三次。对策：唯一出口 + 就地处理的请求标记跳过全局处理。
- 坑：401 死循环（登录接口也 401 又去刷新）。对策：白名单接口（login/refresh）不进刷新逻辑，refresh 失败直接登出。
- 坑：queryKey 随手写导致 invalidate 漏刷。对策：三段式数组 + 只按前缀 invalidate。
- 坑：mutation 成功后手动 refetch 一堆 query。对策：统一 `invalidateQueries({ queryKey: [module] })`。
- 坑：baseURL 写死域名，换环境改代码。对策：一律走 `import.meta.env.VITE_API_BASE` + vite proxy 解决开发跨域。

---

## 阶段 6：全局状态与用户会话

**目标**：四类状态各归其位，登录→拉权限→守卫放行的时序一次定型。

**时机**：请求层完成后。前置：Zustand、TanStack Query 已就绪。

**步骤**：

1. **状态分类决策表**，新状态进来先对表再动手：

| 状态类型 | 归属 | 例子 | 判断口诀 |
|---|---|---|---|
| 服务端状态 | TanStack Query | 列表、详情、字典、userInfo | "来自后端"→ Query |
| 客户端全局状态 | Zustand | token、主题、侧边栏折叠、当前租户 | "跨页面共享且纯前端"→ Zustand |
| 表单状态 | react-hook-form | 表单字段、校验态 | "表单内"→ RHF，不进任何 store |
| URL 状态 | searchParams | 页码、筛选条件、tab 激活项、详情 id | "刷新/分享要保留"→ URL |

口诀合起来一句话：**后端给 Query，表单给 RHF，要分享进 URL，剩下跨页的才进 Zustand。**

2. **Zustand 按域拆 store**，不建大杂烩 store：

```
src/stores/
├── user.ts      # token、userInfo、permissions
├── setting.ts   # 主题、语言、侧边栏折叠
└── app.ts       # 全局 loading、消息未读数等运行时状态
```

3. **persist 白名单**：只持久化"刷新后必须有"的东西——token、主题、侧边栏折叠。`userInfo`、`permissions` **不持久化**（刷新后由守卫重新拉，防止权限过期不一致），app 运行时状态绝不持久化。

```ts
// src/stores/user.ts
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      token: null, userInfo: null, permissions: [],
      setToken: token => set({ token }),
      setSession: (userInfo, permissions) => set({ userInfo, permissions }),
      logout: () => set({ token: null, userInfo: null, permissions: [] }),
    }),
    { name: 'app-user', partialize: s => ({ token: s.token }) }, // 只存 token
  ),
);
```

**坚决不放全局的东西**：表单值、弹窗开关（除非是全局弹窗）、列表数据、临时 loading。这些进 store 早晚变成无法追踪的耦合源。

4. **用户会话完整时序**，按此顺序实现，一步不跳：

```
登录页提交 → login 接口返回 token → useUserStore.setToken(token)
→ 跳 redirect 目标页 → 路由守卫拦截：有 token 但无 userInfo
→ 守卫里并发拉 userInfo + permissions → 存入 store
→ 守卫放行渲染目标页（菜单按权限码过滤，见阶段 7）
任何一步失败 → logout() → 回 /login?redirect=原路径
```

关键点：**拉 userInfo 的动作放在路由守卫里而不是登录页**，这样刷新页面（token 还在但 userInfo 没了）走的也是同一条路径，两条入口一套逻辑。

5. **路由守卫实现**，做成 RootLayout 里的一个组件，包住 Outlet：

```tsx
// src/router/AuthGuard.tsx
export function AuthGuard({ children }: { children: ReactNode }) {
  const { token, userInfo, setSession } = useUserStore();
  const location = useLocation();
  const [ready, setReady] = useState(!!userInfo);

  useEffect(() => {
    if (token && !userInfo) {
      Promise.all([api.userInfo(), api.permissions()])
        .then(([info, perms]) => { setSession(info, perms); setReady(true); })
        .catch(() => useUserStore.getState().logout());
    }
  }, [token, userInfo]);

  if (!token) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  if (!ready) return <FullPageSpinner />;   // 拉会话中
  return <>{children}</>;
}
```

另加一个反向守卫：已登录访问 /login 时 `Navigate to={redirect || '/'}`，一行判断放登录页顶部即可。

**产出物**：
- `src/stores/user.ts` / `setting.ts` / `app.ts`（persist 白名单配置）
- 状态分类决策表（团队约定文档）
- `src/router/AuthGuard.tsx`
- 登录页反向重定向逻辑

**完成判定 DoD**：
- [ ] 未登录访问任意页面跳 /login 并带 redirect，登录后回到原页面
- [ ] 登录状态刷新页面：不出现登录页闪现，守卫拉完会话直接渲染目标页
- [ ] 已登录访问 /login 自动回首页
- [ ] 退出登录清空 store 并回登录页，再访问内页被拦
- [ ] localStorage 里只有 token/主题/折叠态，无 userInfo/permissions
- [ ] 全局搜不到把表单值、列表数据塞进 Zustand 的用法

**常见坑**：
- 坑：userInfo 持久化，权限改了刷新不生效。对策：只持久化 token，会话数据每次刷新重拉。
- 坑：登录页拉 userInfo、守卫又拉一次，逻辑两处。对策：统一收口在守卫，登录页只存 token。
- 坑：守卫里拉会话失败陷入 loading 死循环。对策：catch 里 logout 清 token，自然回落到未登录分支。
- 坑：什么都往 store 塞，半年后没人敢动。对策：决策表贴墙，四类口诀过一遍再动手。
- 坑：页码筛选放 useState，刷新全丢。对策：列表页查询条件一律 searchParams（配合 ProTable，见阶段 8）。

---

## 阶段 7：权限体系（RBAC 落地）

**目标**：一套权限码贯穿菜单、路由、按钮三级，后端改权限前端零发版生效。

**时机**：路由与守卫就绪后、批量业务页开工前。前置：阶段 4 的 meta.authCode、阶段 6 的 permissions 已就位。

**步骤**：

1. **权限模型定三级**：角色（role）→ 权限码（permission code）→ 资源（菜单/按钮）。前端只认权限码，不认角色名（角色是后端聚合权限用的）。权限码命名约定 **`module:entity:action`**，全小写冒号分隔：

```
finance:recon:view     # 看对账列表/菜单
finance:recon:export   # 导出按钮
system:user:create     # 新建用户
system:role:assign     # 分配角色
```

约定：`view` 管菜单与页面访问，其余 action（create/update/delete/export/assign）管按钮。新增权限码由前端提需求、后端入库，命名表进团队文档。

2. **菜单与路由权限：选"静态路由全量注册 + 按权限过滤"方案**，不用动态路由。两种方案取舍：

| 方案 | 做法 | 问题 |
|---|---|---|
| 动态路由 | 后端返回菜单树，前端 `addRoute` 动态注册 | 路由表与代码分离，改路由要动后端数据；组件映射靠字符串约定，TS 无法检查；刷新时序复杂 |
| 静态全量 + 过滤（推荐） | 路由全写在 routes.tsx，meta 带 authCode；渲染菜单/进路由前按 permissions 过滤 | 权限码硬编码在前端（可接受：本来就是前端提的需求） |

推荐后者的原因：**路由是代码不是数据**——路径、组件、懒加载关系天然该进版本库；TS 能检查；刷新无时序问题；后端只管返回一维权限码数组，职责清晰。

3. **过滤逻辑两处复用同一个函数**：菜单生成时过滤掉无权限项；AuthGuard 里校验当前路由 meta.authCode，无权限跳 403：

```ts
// src/shared/auth/permission.ts
export const hasAuth = (perms: string[], code?: string) =>
  !code || perms.includes('*:*:*') || perms.includes(code);

// src/router/menu.ts 生成菜单时：过滤 !hasAuth(permissions, route.meta?.authCode)
// AuthGuard 内：const route = matchCurrentRoute(location); 
//   if (!hasAuth(permissions, route?.meta?.authCode)) return <Navigate to="/403" replace />;
```

4. **按钮级权限双封装**，组件与 hook 各一个，覆盖两种场景：

```tsx
// src/shared/auth/Auth.tsx —— 声明式，包住按钮
export function Auth({ code, children }: { code: string; children: ReactNode }) {
  const permissions = useUserStore(s => s.permissions);
  return hasAuth(permissions, code) ? <>{children}</> : null;
}
// 用法：<Auth code="finance:recon:export"><Button>导出</Button></Auth>

// src/shared/auth/useAuth.ts —— 命令式，用于条件逻辑
export function useAuth() {
  const permissions = useUserStore(s => s.permissions);
  return (code?: string) => hasAuth(permissions, code);
}
// 用法：const can = useAuth(); disabled={!can('system:user:create')}
```

规则：单纯显隐用 `<Auth>`，要参与逻辑（disabled、表格列显隐）用 `useAuth()`。**无权限默认隐藏而不是禁用**，减少界面噪音；只有"提示用户可以升级开通"的场景才用 disabled + tooltip。

5. **权限变更刷新策略**：权限数据不进 localStorage（阶段 6 已定），刷新页面即重拉最新权限；会话期内管理员改了权限，用户下次刷新或重新登录生效，这已满足 99% 场景。确有"立即生效"需求（如被踢下线），走 WebSocket/轮询通知前端重新拉 permissions，不要为此引入复杂推送。

6. **本地调试 mock 权限**：mock 层的 permissions 接口返回可配置数组，提供环境变量 `VITE_MOCK_PERMS='*:*:*'` 一键全权限开发；需要验证无权限表现时改成具体码数组。团队约定：**提测前必须用最小权限集自测一遍菜单与按钮**。

**产出物**：
- 权限码命名规范文档（module:entity:action）
- `src/shared/auth/permission.ts`、`Auth.tsx`、`useAuth.ts`
- 菜单过滤逻辑接入 `src/router/menu.ts`
- AuthGuard 路由级鉴权
- mock permissions 接口 + `VITE_MOCK_PERMS` 开关

**完成判定 DoD**：
- [ ] 后端只返回权限码数组，前端路由/菜单/按钮全部据此显隐
- [ ] 无 `finance:recon:view` 权限的账号：菜单不见该项，直接输 URL 进 403
- [ ] 无导出权限的账号看不到导出按钮，代码中无角色名硬编码
- [ ] 全量路由在 routes.tsx 可见、可被 TS 检查，无字符串动态注册
- [ ] mock 权限可一键切换全权限/最小权限，两类账号自测通过

**常见坑**：
- 坑：前端写死"admin 才显示"，后端角色一改全乱。对策：前端只匹配权限码，永不判断角色。
- 坑：只藏菜单不拦路由，用户输 URL 直进。对策：AuthGuard 必须做路由级鉴权，菜单过滤只是体验优化。
- 坑：上动态路由方案，组件字符串映射出错只能运行时发现。对策：静态全量注册 + 过滤，编译期可检查。
- 坑：无权限按钮 disabled 展示一堆灰按钮。对策：默认隐藏，disabled 仅用于引导开通场景。
- 坑：权限码起名放飞（`exportFinanceRecon`/`finance_export` 混用）。对策：命名表入库前 review，lint 脚本校验格式 `^[a-z]+:[a-z]+:[a-z]+$`。

---

## 阶段 8：类型体系与通用组件沉淀

**目标**：类型分三层不混用，沉淀 10 个复用率最高的通用组件，业务页 80% 代码由组装构成。

**时机**：与业务开发并行，第一个业务模块做完时回头抽象第一批。前置：阶段 3～7 全部完成。

**步骤**：

1. **类型分三层**，各放各的目录：

| 层 | 内容 | 位置 | 来源 |
|---|---|---|---|
| API DTO | 请求/响应原始结构 | `src/shared/api/dto/` 或生成文件 | OpenAPI 生成 / 手写 |
| 领域类型 | 前端业务语义模型 | `src/features/<mod>/types.ts` | 手写 |
| 组件 props | 组件入参 | 组件文件内联导出 | 手写 |

**DTO 与视图模型的转换层何时需要**：默认不需要——后端返回什么前端用什么（DTO 即领域类型），过度设计转换层是中后台常见浪费。只有两种情况建转换层：① 后端字段命名/结构与前端展示差距大（如嵌套拍平、单位换算、拼接展示字段）；② 同一接口在多处使用且都要做同样的加工。转换函数放在 `src/features/<mod>/transform.ts`，纯函数，随手可测。

2. **通用类型工具**，建 `src/shared/types/common.ts`，一次写好全站复用：

```ts
// 分页请求/响应
export interface PageParams { page: number; pageSize: number }
export interface PageResult<T> { list: T[]; total: number; page: number; pageSize: number }
// 树结构
export interface TreeNode<T = Record<string, unknown>> { id: string | number; children?: TreeNode<T>[] & T[] }
// 选项
export interface SelectOption<V = string> { label: string; value: V; disabled?: boolean }
// 枚举转 options（配合 zod enum 或 const 对象）
export function enumToOptions<E extends Record<string, string>>(
  enumObj: E, labelMap: Record<keyof E, string>,
): SelectOption[] {
  return Object.keys(enumObj).map(k => ({ value: enumObj[k], label: labelMap[k] }));
}
```

3. **沉淀 10 个通用组件**，每个写清"解决什么、props 要点、骨架"：

**① SearchForm（配置化查询区）**
解决：每个列表页都手写一排输入框 + 查询/重置按钮，布局与收起逻辑重复。
props 要点：`fields: FieldConfig[]`（类型/标签/组件/占位）、`onSearch(values)`、收起展开内置、默认值支持。
```tsx
interface FieldConfig { name: string; label: string; type: 'input' | 'select' | 'dateRange'; options?: SelectOption[] }
function SearchForm({ fields, onSearch }: { fields: FieldConfig[]; onSearch: (v: Record<string, unknown>) => void }) {
  const form = useForm();
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSearch)} className="flex flex-wrap gap-4">
        {fields.map(f => <FormField key={f.name} name={f.name} render={() => renderFieldByType(f)} />)}
        <Button type="submit">查询</Button>
        <Button variant="ghost" onClick={() => { form.reset(); onSearch({}); }}>重置</Button>
      </form>
    </Form>
  );
}
```

**② ProTable（查询区+表格+分页三合一）**
解决：列表页三件套的数据流（查询条件 → 请求 → 表格/分页）每个页面重抄一遍。
props 要点：`columns`、`request(params): Promise<PageResult<T>>`、`searchFields`；内部管 loading/分页/条件合并；**查询条件同步到 searchParams**，刷新不丢。
```tsx
function ProTable<T>({ columns, request, searchFields }: ProTableProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = Object.fromEntries(searchParams); // page/pageSize/条件全在 URL
  const { data, isLoading } = useQuery({
    queryKey: ['table', location.pathname, params],
    queryFn: () => request({ page: 1, pageSize: 10, ...params } as PageParams & typeof params),
  });
  return (<>
    {searchFields && <SearchForm fields={searchFields} onSearch={v => setSearchParams({ ...v, page: '1' })} />}
    <Table columns={columns} dataSource={data?.list} loading={isLoading} />
    <Pagination total={data?.total} onChange={(p, ps) => setSearchParams({ ...params, page: String(p), pageSize: String(ps) })} />
  </>);
}
```
数据流约定一句话：**URL 是唯一数据源，request 是纯函数，组件不持有一份"查询状态"副本。**

**③ FormDialog（新增/编辑复用同一表单）**
解决：新增弹窗和编辑弹窗写两遍几乎相同的表单。
props 要点：`open`、`initialValues?`（有值即编辑态）、`fields/schema（zod）`、`onSubmit`、`title` 自动按有无 initialValues 切换"新增/编辑"。
```tsx
function FormDialog<T>({ open, initialValues, schema, fields, onSubmit, onClose }: FormDialogProps<T>) {
  const form = useForm({ resolver: zodResolver(schema), values: initialValues });
  useEffect(() => { open && form.reset(initialValues ?? {}); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>{initialValues ? '编辑' : '新增'}</DialogTitle>
        <form onSubmit={form.handleSubmit(async v => { await onSubmit(v); onClose(); })}>{/* fields 渲染 */}</form>
      </DialogContent>
    </Dialog>
  );
}
```

**④ ConfirmButton（危险操作二次确认）**
解决：删除/停用等操作每次手写确认弹窗。
props 要点：`title`、`description`、`onConfirm`（支持 Promise，自动 loading）、`variant` 默认 danger；把确认框和触发按钮合成一个组件。
```tsx
function ConfirmButton({ title, description, onConfirm, children }: ConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ok = async () => { setLoading(true); try { await onConfirm(); setOpen(false); } finally { setLoading(false); } };
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
        <AlertDialogAction onClick={ok} disabled={loading} className="bg-danger">确认</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**⑤ StatusTag（枚举→颜色文案映射）**
解决：状态列满屏 `status === 1 ? '成功' : ...` 三元表达式。
props 要点：`value`、`map: Record<V, { label; color: 'success'|'warning'|'danger'|'default' }>`；映射表跟枚举放同文件，一处维护。
```tsx
function StatusTag<V extends string | number>({ value, map }: { value: V; map: Record<V, { label: string; color: string }> }) {
  const conf = map[value] ?? { label: String(value), color: 'default' };
  return <Badge variant={conf.color}>{conf.label}</Badge>;
}
// 用法：<StatusTag value={row.status} map={ORDER_STATUS_MAP} />
```

**⑥ EllipsisText（超长省略+tooltip）**
解决：表格里长文本撑破布局。
props 要点：`text`、`maxWidth`（默认 100%）、`lines`（单行/多行）；`title` 原生属性不够用 shadcn Tooltip；宽度不足自动省略是 CSS 行为，组件只管包一层。
```tsx
function EllipsisText({ text, maxWidth = '100%' }: { text: string; maxWidth?: number | string }) {
  return (
    <Tooltip content={text}>
      <span className="block truncate" style={{ maxWidth }}>{text}</span>
    </Tooltip>
  );
}
```

**⑦ PageContainer（页头+面包屑+内容）**
解决：每页手写标题、面包屑、padding，全站不一致。
props 要点：`title`、`extra`（右上角操作区）、自动接阶段 4 的面包屑、padding 取布局常量。
```tsx
function PageContainer({ title, extra, children }: { title?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ padding: LAYOUT.PAGE_PADDING }} className="mx-auto" >
      <div className="mb-4 flex items-center justify-between">
        <div><Breadcrumb /><h1 className="text-xl font-semibold">{title}</h1></div>
        <div className="flex gap-2">{extra}</div>
      </div>
      {children}
    </div>
  );
}
```

**⑧ Empty / ErrorBoundary**
解决：空数据白屏、组件异常整站崩溃。
要点：Empty 包 shadcn 图标 + 文案 + 可选操作按钮，三 props（`description`、`image?`、`action?`）；ErrorBoundary 用 class 组件（React 无 hook 方案），在 RootLayout 和每个 lazy 页面包两层，fallback 给"刷新/回首页"按钮。
```tsx
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { reportError(err); } // 接监控
  render() {
    return this.state.hasError
      ? <Result status="error" title="页面出错了" extra={<Button onClick={() => location.reload()}>刷新</Button>} />
      : this.props.children;
  }
}
```

**⑨ CopyText（一键复制）**
解决：订单号/ID 复制场景每处手写 navigator.clipboard。
props 要点：`text`、成功 toast 内置、可复制图标 hover 才显示。
```tsx
function CopyText({ text }: { text: string }) {
  const copy = async () => { await navigator.clipboard.writeText(text); toast.success('已复制'); };
  return (
    <span className="group inline-flex items-center gap-1">
      {text}
      <CopyIcon className="h-3 w-3 cursor-pointer opacity-0 group-hover:opacity-100" onClick={copy} />
    </span>
  );
}
```

**⑩ DictSelect（字典下拉）**
解决：下拉选项来自后端字典接口，每个 select 手写一遍请求。
props 要点：`dictCode`、`value/onChange` 透传；内部用 TanStack Query 拉字典（`queryKey: ['dict', dictCode]`，staleTime 给 5 分钟）；选项缓存在 Query 层天然共享。
```tsx
function DictSelect({ dictCode, ...props }: { dictCode: string } & SelectProps) {
  const { data: options = [] } = useQuery({
    queryKey: ['dict', dictCode],
    queryFn: () => api.dict(dictCode),
    staleTime: 5 * 60_000,
  });
  return <Select options={options} {...props} />;
}
```

4. **业务组件 vs 通用组件归档规则**，定一条可执行的判定：
   - 组件写在 `src/features/<mod>/components/` 起步，**禁止第一版就放 shared**。
   - 满足三个条件才下沉到 `src/shared/components/`：① 被 **2 个以上** feature 实际使用（不是"预感会用"）；② props 里不含任何该业务的领域类型（依赖倒置：shared 不 import features）；③ 有明确的 props 接口和默认行为。
   - 下沉动作 = 移动文件 + 把领域类型替换成泛型/配置 props。只做移动不做抽象的下沉是制造垃圾。

**产出物**：
- `src/shared/types/common.ts`（分页/树/选项/枚举工具）
- 类型三层目录约定
- `src/shared/components/` 下 10 个通用组件
- 组件下沉三条件（团队约定文档）

**完成判定 DoD**：
- [ ] 列表页由 PageContainer + ProTable 组装而成，无手写三件套数据流
- [ ] 新增/编辑共用 FormDialog，表单校验走 zod schema
- [ ] 危险操作全部走 ConfirmButton，无散装确认弹窗
- [ ] 状态列全部走 StatusTag + 映射表，搜不到状态三元表达式
- [ ] shared/components 里无任何 import features/ 的引用（eslint 可强制）
- [ ] 枚举/字典有统一工具（enumToOptions / DictSelect），无硬编码 option 数组散落在页面

**常见坑**：
- 坑：项目第一天就抽象 ProTable，配置项越加越多变成内框架。对策：第一个列表页手写，第二个页面对照提炼，第三个页面才定型 API。
- 坑：shared 组件 import 了某业务的类型，形成反向依赖。对策：下沉时领域类型泛型化，eslint `no-restricted-imports` 禁 shared → features。
- 坑：DTO 转换层见接口就建，全是透传废代码。对策：默认 DTO 即领域类型，只有两类场景才建 transform。
- 坑：FormDialog 的编辑回填靠手动 setValue 一堆。对策：RHF 的 `values`/`reset(initialValues)` 一行解决。
- 坑：查询条件组件 state 一份、URL 一份，两边同步写 bug。对策：URL 是唯一数据源，组件无本地副本（阶段 6 决策表）。

---

> 全局架构篇到此结束。后续业务开发阶段（页面模板、表单模式、表格模式等）见 Part C。
# Part C 工程收尾篇

## 阶段 10：联调与 Mock 切换

### 联调 checklist（动手前先对齐，省 80% 扯皮）

- [ ] **分页参数约定**：`page/pageSize` 还是 `pageNo/pageSize`？返回是 `{ list, total }` 还是 `{ records, totalCount }`？全系统统一，写进接口规范文档第一页。
- [ ] **响应包结构**：`{ code, data, message }`？code=0 还是 200 为成功？axios 拦截器按此统一拆包，业务代码不再判断 code。
- [ ] **错误码表**：401/403 之外的业务错误码（如 10001=余额不足）列成表，前端维护 `errorCode → 提示文案` 映射。
- [ ] **时间格式**：统一 ISO 字符串还是时间戳？时区谁处理？金额单位分还是元？
- [ ] **枚举值**：状态用字符串还是数字？前后端同一份枚举定义（可让后端从代码导出）。
- [ ] **空值约定**：空字符串/空数组是 `""`/`[]` 还是 `null`/字段缺失？查询参数空值是否传递？
- [ ] **跨域**：开发态用 Vite `server.proxy` 转发 `/api`，代码里绝不写死后端域名；生产态 Nginx 反代（见阶段 12）。
- [ ] **环境切换**：`.env.development / .env.test / .env.production` 管理 `VITE_API_BASE`，build 时注入，禁止代码里 if 域名判断。

### 接口文档驱动的协作节奏

1. 后端先出接口文档（Swagger/Apifox），前端评审字段，**评审通过即冻结契约**。
2. 前端按文档 Mock 开发：轻量方案用 `msw`（拦截 fetch/axios，类型友好、可带进 e2e），或直接用 Apifox/Apipost 的云端 Mock 地址把 `VITE_API_BASE` 指过去。
3. Mock 数据与 types.ts 同源（用 zod schema 反向生成 mock 更稳），异常分支（空列表/报错/超时）各造一条，四态都能调出来。
4. 后端 ready 后**逐模块切换**：`.env` 指向真实服务，发现一个字段不符当场改文档并通知，不允许"前端你兼容一下"。
5. 联调期抓包工具（Charles/浏览器 Network）常备，问题先定位是哪一端再沟通，描述带 curl 复现命令。

### 联调问题排查顺序（出问题按此走，别上来就群里喊）

1. **看请求发出去没有**：Network 面板没有请求 → 前端逻辑问题（hook 没触发、enabled 条件、权限拦截）。
2. **看请求长什么样**：URL、方法、参数与文档逐项对——80% 的联调 bug 死在参数名/层级上。
3. **看响应是什么**：状态码 4xx 是前端锅（参数、鉴权、Content-Type），5xx 是后端锅，CORS 报错是网关/后端配置锅。
4. **看数据到组件没有**：响应正常但页面空 → query key 不匹配、数据结构取值层级错（`res.data.list` 写成 `res.list`）。
5. 确认是环境差异时，先清缓存、强刷、查 Nginx/代理配置，再怀疑代码。

### Mock 的组织方式

- Mock 文件按 feature 分目录存放，与 types.ts 同目录，字段改动时类型报错会逼你同步改 mock。
- 每个接口至少准备 4 条数据：正常多条、空列表、单条边界值（超长文本/特殊字符）、错误响应（用于调试 error 态）。
- 联调切换用环境变量一个开关完成（`VITE_USE_MOCK=true` 时注册 msw worker），代码里不留 if-else 散弹。

---

## 阶段 11：测试策略（务实版）

中后台时间有限，测试按性价比排序投入，**不写八股，不搞覆盖率 KPI**：

**工具函数单测 > 复杂 hooks 单测 > 关键流程 e2e > 组件快照（基本别写）**

1. **工具函数**：金额换算、listToTree、查询参数序列化、权限判断——纯函数、改动少、回归价值最高。
2. **复杂 hooks**：跨页选择逻辑、步骤表单状态机等含分支逻辑的 hook，用 `@testing-library/react` 的 `renderHook`。
3. **e2e**：Playwright 写**一条**主链路即可：登录 → 列表查询 → 新增 → 编辑 → 删除 → 断言列表恢复。一条链路覆盖 80% 基础设施（鉴权、请求封装、表单、表格）。
4. **组件快照**：中后台 UI 天天改，快照全是噪音，不写。

### Vitest 最小配置

```ts
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts', // 引入 @testing-library/jest-dom
  },
});
```

```ts
// 示范 1：纯函数
describe('fenToYuan', () => {
  it('正常转换', () => expect(fenToYuan(12345)).toBe('123.45'));
  it('空值兜底', () => expect(fenToYuan(null)).toBe('-'));
});

// 示范 2：hook（跨页勾选）
it('跨页保留已选 id', () => {
  const { result } = renderHook(() => useRowSelection());
  act(() => result.current.toggle(['1', '2']));
  act(() => result.current.toggle(['3']));      // 模拟翻页后再选
  expect(result.current.selectedIds).toEqual(['1', '2', '3']);
});
```

### Playwright 主链路用例思路

```ts
// e2e/order.spec.ts 思路（按项目实际选择器调整）
test('登录-增删改查主链路', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('账号').fill('admin');
  await page.getByLabel('密码').fill('Admin@123');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL('/');                       // 1. 登录成功
  await page.goto('/order');
  await page.getByRole('button', { name: '新增' }).click();
  await page.getByLabel('订单名称').fill('e2e测试单');
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('e2e测试单')).toBeVisible(); // 2. 新增可见
  // 3. 编辑 → 改名称断言；4. 删除 → 断言列表不再包含
});
```

要点：e2e 跑在独立的测试环境（后端连测试库），数据自带清理（跑完删单）；选择器优先 `getByRole/getByLabel`，别用 class；CI 里 `--workers=1` 串行跑，避免测试间数据打架；失败自动截图 + trace，定位不靠猜。

---

## 阶段 12：构建、部署与 CI/CD

### 构建优化检查

- [ ] 路由懒加载已做：`React.lazy(() => import('@/features/order'))` + Suspense 骨架。
- [ ] `manualChunks` 分包：把 `echarts`、`lodash`、`vendor(react/react-dom)` 拆出去，避免单 chunk 过大。

```ts
// vite.config.ts 分包骨架
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        echarts: ['echarts'],
      },
    },
  },
}
```

- [ ] gzip/brotli：`vite-plugin-compression` 预压缩（或交给 Nginx 在线压缩，二选一）。
- [ ] 产物分析：`rollup-plugin-visualizer` 跑一次，找出意外打进包的大家伙（整个 moment、全量 lodash、重复的 dayjs locale）。
- [ ] `import dayjs from 'dayjs'` 替代 moment；lodash 用 `lodash-es` 按需导入。

### 部署形态：Nginx 静态部署

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://backend:8080/;      # 反代后端，解决跨域
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /assets/ {
    expires 30d;                           # 带 hash 的静态资源长缓存
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri/ /index.html;      # history 路由 fallback，关键！
    add_header Cache-Control "no-cache";   # index.html 不缓存，发版即生效
  }
}
```

核心原则：**index.html no-cache（它是入口，必须拿到最新）；assets 长缓存（文件名带 content hash，变了就是新文件）**。两者反过来就是"发版不生效"和"每次全量下载"两大经典事故。

另外三个 Nginx 部署常见检查：

- `try_files` 漏写 `$uri/ /index.html` fallback → 用户刷新深层路由直接 404，这是 history 模式 SPA 部署的第一大坑。
- 反向代理路径斜杠：`proxy_pass http://backend:8080/` 带不带尾斜杠决定 `/api/user` 转发成 `/user` 还是 `/api/user`，必须与后端路由约定对齐并写进部署文档。
- 大文件上传（导入功能）要在 Nginx 调大 `client_max_body_size 20m;`，否则 413 报错在前端看起来像是"接口挂了"。

### Docker 化：多阶段构建

```dockerfile
# 构建阶段
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./ && RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### CI 流水线：三段式

GitHub Actions / GitLab CI 思路一致，三步走，前一步失败即终止：

```yaml
# GitHub Actions 骨架
jobs:
  ci:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint          # 第 1 段：ESLint
      - run: npm run typecheck     # 第 2 段：tsc --noEmit
      - run: npm run test -- --run # （有单测后加上）
      - run: npm run build         # 第 3 段：构建
      # main 分支额外：上传产物 / 构建镜像 / 触发部署 webhook
```

要点：`npm ci` 而非 `npm install`（锁定版本）；lint 和 typecheck 分开两条命令，报错定位快；合并 MR 前流水线必须绿。

### 灰度与回滚的朴素做法

- 服务器上保留版本目录：`releases/20240101/`、`releases/20240102/`，Nginx root 软链 `current → releases/xxx`。回滚 = 软链切回上一版 + reload，10 秒完成。
- 灰度：小团队没必要上 AB 平台。够用方案是 Nginx 按 cookie/IP 哈希把少量流量指到 `beta` 目录，或干脆发给内部用户群试用 beta 域名。
- 因为 index.html no-cache 且 assets 带 hash，回滚后用户刷新即回旧版，无缓存残留问题。
- 发版窗口选低峰期，发版后 30 分钟内盯 Sentry 错误曲线与接口成功率，异常即回滚，不恋战。
- 版本号与 CHANGELOG：每次发版打 git tag，CHANGELOG 只写用户可感知的变化，回滚定位靠 tag 不靠记忆。

---

## 阶段 13：上线前终极检查单

发版前逐条过，打勾再放行。

**功能与流程**
- [ ] 主链路 e2e 手工走一遍：登录 → 各核心页面增删改查 → 登出
- [ ] 所有页面四态（loading/empty/error/success）至少肉眼验过空态与错误态
- [ ] 表单校验、防重复提交、离开拦截抽查
- [ ] 浏览器刷新、直接访问深层链接、前进后退行为正常

**权限与安全**
- [ ] 无权限菜单/按钮不可见，直接输 URL 访问被拦截（前端 403 + 后端兜底）
- [ ] 登出后返回上一页不泄露缓存数据（queryClient.clear 已生效）
- [ ] 富文本/用户输入展示端已 sanitize，抽查 XSS 用例 `<img onerror>`
- [ ] 敏感信息检查：源码无硬编码密钥/token，`.env` 不入库，console 无敏感日志
- [ ] token 存取符合安全约定，接口全走 HTTPS

**异常与兼容**
- [ ] 断网/接口 500/超时三场景有友好提示与重试
- [ ] 404/403/500 页面可达且样式正常
- [ ] 目标浏览器（Chrome/Edge 最近两版本）实测，无兼容报错
- [ ] 1366×768 与 1920 分辨率布局不崩，表格可横向滚动

**性能**
- [ ] 首页首屏 < 3s（内网），Lighthouse 性能分无红项
- [ ] 路由懒加载生效（Network 面板切路由才加载对应 chunk）
- [ ] 产物分析无异常大包，echarts/lodash 已分包
- [ ] 列表翻页不闪空、无重复请求（React Query Devtools 抽查）
- [ ] 长任务（导入导出/大文件）有进度反馈，不阻塞页面

**工程与发布**
- [ ] CI 三段全绿：lint / typecheck / build
- [ ] 环境变量指向生产环境，无 Mock 开关残留、无 debug 面板
- [ ] console.log / debugger 已清除
- [ ] sourcemap 策略确认：上传 Sentry 后从产物删除，或不对公网开放
- [ ] SEO 无关项剔除：robots、默认 favicon、index.html 里 Vite 模板文案、页面 title 已替换
- [ ] 埋点 SDK 初始化且关键事件抽查上报成功
- [ ] 错误监控：**Sentry 接入**——`Sentry.init({ dsn, environment, release })` + ErrorBoundary 上报 + axios 拦截器上报接口错误，一句话配置，上线后第一天就能抓到真错误
- [ ] Nginx 配置验证：刷新深层路由不 404、`/api` 代理通、缓存头正确
- [ ] 回滚方案就绪：上一版产物目录保留，软链可切回
- [ ] 发版公告/值班安排同步给相关方

---

> 至此，从"拿到需求"到"上线稳定运行"的完整 SOP 闭环完成。本篇的页面配方随项目演进持续补充：每做完一个新形态页面，回头把它抽象成新配方追加进来。
