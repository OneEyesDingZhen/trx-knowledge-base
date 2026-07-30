# 中后台前端系统构建 SOP · 附录：功能页面套路库

> **用法**：接到页面需求 → 在下方目录对号入座 → 按"结构解剖 → 数据流与状态 → 实现步骤 → 交互与边界清单 → 常见坑"五段照做。所有配方默认已具备主手册 Part B 的全局基建（请求层、权限、通用组件），不再重复。
>
> 配方目录：1 登录 · 2 Dashboard · 3 列表标准版 · 4 列表变体 · 5 弹窗表单 · 6 独立表单页 · 7 表单高级场景 · 8 详情页 · 9 审批流程页 · 10 系统管理系列 · 11 个人中心 · 12 异常页 · 13 导入导出 · 14 打印页

---

# 阶段 9：功能页面套路库

## 9.0 页面量产总原则

### 三问先行，回答完再动手

任何页面动手前，先在纸上（或注释里）回答三个问题：

1. **数据从哪来**：几个接口？query key 怎么设计？数据之间有没有依赖（先拿 A 再拿 B）？
2. **页面有哪几种状态**：loading / empty / error / success 四态，外加无权限态。每一态长什么样，先想清楚。
3. **用户能做什么操作**：查询、新增、编辑、删除、导出、跳转……每个操作触发什么 mutation，成功后刷新什么。

三问答不出来，说明需求没聊透，回去问产品，不要靠猜。

### 新增一个页面的标准 7 步

```
1. 建目录    src/features/order/  （pages/api/hooks/components/types.ts）
2. 写类型    types.ts：Entity、Query、CreateDto、UpdateDto，与接口文档逐字段对齐
3. 写 api    api.ts：axios 函数，只做请求不做逻辑，统一走封装的 request 实例
4. 写 hook   hooks.ts：useXxxList / useXxxDetail / useCreateXxx / useUpdateXxx / useDeleteXxx
5. 搭布局    index.tsx：先摆区块骨架（查询区/表格区/分页区），四态先占位
6. 填交互    接 hook，补 mutation 的 loading 态、成功提示、invalidate
7. 补边界    对照本篇每页的「交互与边界清单」逐条打勾
```

纪律：**类型先行**。`types.ts` 是与后端的契约，先写死，后面所有代码都有自动补全和编译期保护；接口字段变了，改 types 让编译器帮你找全所有引用点。

### 通用约定（后文不再重复）

- 所有列表数据 hook 形如 `useOrderList(params)`，内部 `useQuery({ queryKey: ['order', 'list', params], queryFn: ... })`。
- 所有写操作 hook 成功后 `queryClient.invalidateQueries({ queryKey: ['order'] })`，前缀失效一把刷掉列表+详情。
- 服务端状态一律进 TanStack Query，**不要**把接口数据塞进 Zustand；Zustand 只管跨页面 UI 状态（侧边栏折叠、当前租户、标签页）。
- 四态渲染骨架：

```tsx
if (isPending) return <TableSkeleton />;
if (isError) return <ErrorResult onRetry={refetch} />;
return data?.list.length ? <DataTable ... /> : <EmptyResult />;
```

---
## 页面 1：登录/登出页

**适用场景**：系统入口认证，含账号密码登录、记住我、图形/滑块验证码。

**结构解剖**：

```
┌────────────────────────────┐
│  左：品牌图/标语  │  右：登录卡片  │
│                 │  [账号]        │
│                 │  [密码]        │
│                 │  [验证码][图]  │
│                 │  ☑记住我  登录 │
└────────────────────────────┘
```

**数据流与状态**：mutation `useLogin()`，成功后写入 token（httpOnly cookie 优先，否则 localStorage）+ `useUserStore.setUser()`；「记住我」只决定是否持久化账号名（密码绝不存）；`location.state?.from` 记录被拦截前的地址。

**实现步骤**：
1. 路由层把 `/login` 放在鉴权布局之外，已登录访问 `/login` 直接重定向 `/`。
2. react-hook-form + zod 定义登录 schema（账号非空、密码 ≥6 位）。
3. 验证码：`<img src={captchaUrl} onClick={刷新}>`，url 后拼时间戳防缓存；后端返回验证码错误时自动换一张。
4. 提交中按钮 loading + disabled，防重复提交。
5. 登录成功后 `navigate(from ?? '/', { replace: true })`，`from` 从路由守卫写入。
6. 路由守卫组件：无 token 时 `navigate('/login', { state: { from: location.pathname + location.search } })`。
7. 登出：调登出接口（失败也继续）→ 清 token、清 store、`queryClient.clear()` → 跳 `/login`。

**交互与边界清单**：
- [ ] 登录中防重复提交（按钮 loading）
- [ ] 密码输入框回车提交
- [ ] 验证码点击刷新、登录失败后强制刷新
- [ ] 错误提示不暴露"账号不存在/密码错误"细节，统一"账号或密码错误"
- [ ] 已登录用户访问 /login 重定向
- [ ] 401 全局拦截跳登录并带 from
- [ ] 登出后清除所有 query 缓存，防止下一个用户看到上一用户数据
- [ ] 账号密码不进入 URL、不进埋点上报
- [ ] from 地址做白名单校验，防开放重定向（只接受站内相对路径）
- [ ] 多端登录/被踢下线的 toast 提示

**常见坑**：
- 登出时忘 `queryClient.clear()`，A 用户登出 B 用户登录看到 A 的缓存列表。
- from 未校验，被钓鱼链接利用跳外站。
- 记住我把 token 有效期和"记住我"混为一谈——记住我只记账号，token 过期时间永远由后端控制。

---

## 页面 2：Dashboard 工作台

**适用场景**：登录后首页，一屏看全关键指标、趋势、待办与快捷入口。

**结构解剖**：

```
┌─指标卡x4（今日订单/营收/用户/异常）─┐
├─趋势图表(2/3)──────┬─待办列表(1/3)──┤
├─排行/分布图表──────┼─快捷入口───────┤
```

**数据流与状态**：多个独立 query 并行：`['dashboard','metrics']`、`['dashboard','trend',range]`、`['dashboard','todo']`；图表时间范围（近7天/30天）是本地 state 并进 URL；不做的大数字用骨架屏分块加载，互不阻塞。

**实现步骤**：
1. 拆 4 个独立组件各自取数，谁先到谁先渲染（避免一个大接口拖慢整页）。
2. 指标卡：数值 + 环比箭头 + 点击跳对应列表页（带查询参数）。
3. 图表选型一句话：**echarts 全功能重型、recharts 轻量声明式；中后台图表多且杂用 echarts（`echarts-for-react` 或自封装），页面少而简单用 recharts**。
4. 封装 `<Chart option={...} />`：内部处理 init、`resize` 监听（ResizeObserver）、卸载 dispose。
5. 待办列表：只取前 5-10 条 + "查看全部"，每项点击跳审批详情。
6. 快捷入口：配置化数组（icon + 名称 + 路由 + 权限码），按权限过滤渲染。
7. 数据权限：指标接口可能按角色返回不同数据，前端不兜底，直接展示空态。

**交互与边界清单**：
- [ ] 各区块独立 loading 骨架，失败区块局部重试不影响整页
- [ ] 图表容器宽度为 0（tab 内/折叠面板）时不初始化或延迟初始化
- [ ] 窗口 resize 图表自适应
- [ ] 大数字格式化（万/千分位）、金额为 0 与 null 的区分展示
- [ ] 无数据时图表显示空态而非空白
- [ ] 快捷入口按权限码过滤
- [ ] 时间范围切换防抖、切换后只刷新趋势 query
- [ ] 首页轮询（如需要）用 `refetchInterval`，离开页面自动停

**常见坑**：
- echarts 实例泄漏：路由来回切换不断 init 不 dispose，内存暴涨。
- 图表装在 flex 容器里初次渲染宽度为 0，图缩成一团——用 ResizeObserver 解决。
- 一屏 8 个接口串行 await，白屏 3 秒；必须并行 + 分块渲染。

---

## 页面 3：列表页·标准版（查询区 + 表格 + 分页）

**适用场景**：中后台 60% 的页面形态，必须练到闭着眼能写。

**结构解剖**：

```
┌─查询区：条件x3-6  [查询][重置] [展开/收起]─┐
├─工具栏：[新增][导出]      [列设置][刷新]──┤
├─表格：列xN + 操作列(编辑/删除)────────────┤
├─分页：共N条  10条/页  < 1 2 3 >───────────┤
```

**数据流与状态**：
- **URL 是唯一事实来源**：查询条件 + page + pageSize 全部存 `searchParams`。
- `const [searchParams, setSearchParams] = useSearchParams()`，解析出 `params` 对象直接作为 query key：`['order','list',params]`。
- 好处：刷新不丢、可分享链接、浏览器前进后退天然可用、详情页返回列表条件还在。

```tsx
// 查询参数读写骨架
const params = Object.fromEntries(searchParams.entries());
const { data, isPending } = useOrderList(params);
const onSearch = (values: QueryForm) => {
  setSearchParams(cleanEmpty({ ...values, page: '1' })); // 查询必回第1页
};
const onReset = () => setSearchParams({ page: '1', pageSize: params.pageSize });
```

**实现步骤**：
1. types 定义 `OrderQuery`（含 page/pageSize）与 `Order` 实体。
2. api 写 `fetchOrders(params: OrderQuery)`，GET 带 params。
3. hook 写 `useOrderList(params)`，`placeholderData: keepPreviousData`（翻页不闪空）。
4. 查询表单：react-hook-form，提交时 `cleanEmpty` 去掉空字符串再写 URL。
5. 表格列配置抽成 `columns.tsx`：纯数据数组，操作列 render 里注入回调。
6. 分页器受控：page/pageSize 变化只改 searchParams，数据自然刷新。
7. 工具栏：新增跳表单页/开弹窗；导出走当前查询条件；列设置用 checkbox 控制列显隐（存 localStorage）。
8. 删除：二次确认 Popconfirm → mutation → invalidate → 若删的是当前页最后一条且 page>1，页码回退。

**交互与边界清单**：
- [ ] 首次进入/刷新/分享链接，查询条件与 URL 一致
- [ ] 点查询页码重置为 1；改 pageSize 页码重置为 1
- [ ] 翻页/切条件时保留上一页数据占位（keepPreviousData），不闪 loading
- [ ] 重置只清条件，保留 pageSize
- [ ] 空结果空态文案区分"无数据"与"无符合条件的数据，试试调整筛选"
- [ ] 接口错误整表 error 态 + 重试按钮
- [ ] 超长文本列 ellipsis + Tooltip，时间/金额/状态列统一格式化与字典映射
- [ ] 删除/操作二次确认，操作中行级 loading 防连点
- [ ] 批量操作（如有）：全选只选当前页，跨页选择要额外维护 id 集合
- [ ] 快速连续切条件：query key 变化自动取消旧请求（TanStack 自带），不要手动防抖过度
- [ ] 无权限按钮隐藏而非 disabled（权限码过滤）

**常见坑**：
- 查询条件放组件 state 不进 URL，用户从详情返回条件全丢，被产品打回。
- pageSize 改了 page 没归 1，出现"第 5 页每页 50 条但实际只有 30 条"的空表。
- 枚举状态列硬编码文案，后端加了一个状态前端显示空白——状态映射必须走字典 + 兜底"未知"。

---

## 页面 4：列表页·变体

只写与标准版的差异点，其余照搬页面 3。

### 4a 树表格（部门/分类/多级地区）

- 数据结构：后端扁平返回（`id/parentId`）则前端 `listToTree`；层级 ≤3 建议直接让后端返回树。
- 展开控制：受控 `expandedRowKeys` 存 state（不进 URL）；默认展开第一层。
- 新增子节点：操作列"新增子级"把当前行 id 作为 parentId 传给表单。
- 坑：树表格分页通常无意义，确认产品是否接受"不分页 + 懒加载子节点"（`children: undefined` 触发 loadMore）。

### 4b 左右树 + 右表

- 左侧树选中节点 id 作为右表的一个查询条件，**也进 URL**（`?deptId=xx&page=1`）。
- 切树节点必须重置 page=1。
- 树本身单独一个 query：`['dept','tree']`，支持关键字过滤（前端 filter 即可）。
- 坑：树节点被删除后 URL 里残留失效 deptId，接口 400——前端对失效 id 兜底清空。

### 4c 卡片列表（商品/应用/模板）

- 卡片 = 封面 + 标题 + 2-3 个关键字段 + 悬浮操作。
- 响应式栅格：`grid-cols-1 sm:2 lg:3 xl:4`。
- 分页与标准版一致；图片懒加载 + 固定宽高比防跳动。
- 坑：卡片高度不齐——标题两行截断、固定高度，别用 masonry 增加复杂度。

### 4d 无限滚动（移动端/ feed 流）

- 用 `useInfiniteQuery`，query key 带过滤条件，`getNextPageParam` 依据 `page * pageSize < total`。
- 触底加载用 IntersectionObserver 哨兵 div，不用 scroll 事件。
- 保留"加载更多"按钮兜底（低端机/SEO）。
- 坑：无限滚动下"返回保留位置"极难做，详情跳转尽量用弹窗或新 tab；列表数据变化后游标错乱，刷新即重置。

---
## 页面 5：新增/编辑表单页·弹窗式（FormDialog）

**适用场景**：字段 ≤10 个的轻量表单，在列表页就地完成增改，不打断上下文。

**结构解剖**：

```
列表页 ──点击[新增]/[编辑]──► Dialog
                              ├ 表单字段 xN
                              └ [取消] [确定(loading)]
```

**数据流与状态**：弹窗开关与编辑对象是列表页的本地 state：`const [editing, setEditing] = useState<Order | 'new' | null>(null)`；编辑时回填来自行数据（字段少直接用，字段多则按 id 再查详情接口）；提交 mutation 成功后 invalidate 列表 + 关闭弹窗 + toast。

**实现步骤**：
1. 一个组件同时服务新增与编辑，判别逻辑：**`editing === 'new'` 为新增，对象则为编辑**，不要用单独的 isEdit 布尔（会和数据不同步）。
2. zod schema 一处定义，新增编辑共用；个别字段（如初始密码）只在新增时出现，用 `.superRefine` 或条件渲染。
3. **弹窗每次打开重新 mount 表单**：`<Dialog>{editing && <OrderForm key={editing === 'new' ? 'new' : editing.id} .../>}</Dialog>`，用 key 强制重置，彻底避免脏数据残留。
4. 初始值回填：`useForm({ defaultValues: toFormValues(editing) })`，`toFormValues` 负责把后端 null 转成 `''`/`undefined`，数字转字符串类坑在此消化。
5. 提交：`mutation.mutate(values)`，`isPending` 时确定按钮 loading + 禁用取消和关闭。
6. `onSuccess`：`toast.success('保存成功')` → `invalidateQueries(['order'])` → `setEditing(null)`。
7. `onError`：错误留在弹窗内展示（form 级 error 或字段级 `setError`），**不关弹窗**。

```tsx
// 判别与提交骨架
const saveMutation = useSaveOrder(); // 内部按 values.id 决定 POST/PUT
<OrderFormDialog
  value={editing}                 // 'new' | Order | null
  onClose={() => setEditing(null)}
  onSubmit={(v) => saveMutation.mutate(v, { onSuccess: () => setEditing(null) })}
/>
```

**交互与边界清单**：
- [ ] 重复打开/切换编辑对象后表单无脏数据（key 重置）
- [ ] 提交中防连点，提交中禁止点遮罩/Esc 关闭
- [ ] 表单有改动时点取消弹"放弃修改？"确认
- [ ] 服务端字段级错误（如名称重复）映射回对应输入框 `setError('name', ...)`
- [ ] 编辑场景回填完整，id 等隐藏字段不丢
- [ ] 新增成功后列表刷新并回到第 1 页（或保持当前页，与产品约定）
- [ ] 弹窗内下拉/日期选择器 z-index 与滚动穿透正常
- [ ] 网络错误不关弹窗、不清已填内容
- [ ] 超长弹窗内部滚动，底部按钮固定

**常见坑**：
- 用 `reset()` 在 useEffect 里回填，时序问题导致偶发脏数据；`key` 重挂载是最稳方案。
- 编辑直接拿列表行数据回填，行数据缺字段（列表接口不返回备注），保存时把备注清空——字段多必须查详情接口回填。
- 新增和编辑拆成两个 Dialog 组件，字段改一处忘另一处。

---

## 页面 6：新增/编辑表单页·独立页式

**适用场景**：字段多（>10）、有分组/分步、需要上传附件的复杂表单，如建单、发版申请。

**结构解剖**：

```
┌─页头：标题 + [保存草稿][提交]──────────┐
├─锚点导航(左)─┬─区块1 基本信息──────────┤
│             ├─区块2 明细(动态行)────────┤
│             └─区块3 附件/备注───────────┘
```

**数据流与状态**：路由 `/order/new` 与 `/order/:id/edit` 复用同一页面组件，按 `useParams` 的 id 判别；编辑态先 `useOrderDetail(id)`，拿到前整页骨架；草稿：本地 localStorage 定时存 + 服务端草稿接口二选一（单端操作选本地即可）。

**实现步骤**：
1. 路由两个 path 指向同一组件：`const { id } = useParams(); const isEdit = !!id;`。
2. 表单按业务分区块拆子组件，但**只用一个 `useForm` 实例**，通过 `FormProvider` + `useFormContext` 分发，保证一次提交拿到全部值。
3. 分步表单（如需要）：每步只校验本步字段 `trigger(['fieldA','fieldB'])` 通过才放行下一步；最后一步统一提交。
4. 草稿：`watch` 防抖 1s 写 localStorage（key 带用户 id 与表单 id），进入页面检测草稿提示"恢复上次填写？"。
5. 离开拦截：表单 `dirty` 时，路由跳转用 blocker（react-router `useBlocker`），浏览器关闭用 `beforeunload`。
6. 提交成功：invalidate + `navigate(-1)` 或跳详情页，同时清草稿。
7. 页头操作区吸顶（`sticky top-0`），长表单随时可提交。

**交互与边界清单**：
- [ ] 编辑态数据未加载完成前禁渲染表单（否则 defaultValues 不生效）
- [ ] dirty 状态离开拦截：路由内跳、关闭 tab、浏览器后退三场景
- [ ] 提交中全表单 disabled，按钮 loading
- [ ] 校验失败自动滚动到第一个错误字段（`shouldFocusError`）
- [ ] 草稿恢复后提示且不覆盖 dirty 判定
- [ ] 服务端 409（数据已被他人修改）提示刷新对比
- [ ] 大表单分区块渲染，避免一处输入全表单重渲染（用 `Controller` 隔离或字段级订阅）
- [ ] 金额/日期等格式在提交前 `transform` 统一转成后端格式
- [ ] 新增/编辑提交按钮文案与接口区分（POST/PUT）

**常见坑**：
- 拆成多个 form 分步提交，中途失败产生半单数据；能单 form 单提交就别分。
- `beforeunload` 只在页面级生效，SPA 内路由跳转拦不住——两者都要做。
- 编辑页直接刷新丢 state 报错——数据必须按 id 从接口拿，不依赖列表页传 state。

---

## 页面 7：表单高级场景

**适用场景**：复杂表单内的高频武器库，按需取用。

### 7a 动态增减字段数组（明细行）

```tsx
const { fields, append, remove } = useFieldArray({ control, name: 'items' });
// 行内：fields.map(f => <Row key={f.id} ... register(`items.${idx}.name`) />)
```

- `key` 必须用 `f.id`，不用 index，否则删中间行输入错位。
- 每行小计 = 数量 × 单价，用 `watch` 行级订阅计算；总计用 `useWatch({ name: 'items' })` 汇总。
- 至少保留一行；行内校验（数量>0）在 zod 里写 `z.array(itemSchema).min(1)`。

### 7b 级联选择

- 省市区/分类：数据量小（<1000）一次拉全做前端级联；数据量大用"选中一级再拉下一级"，每级独立 query：`['region', parentId]`。
- 表单值只存最终节点 id，路径展示另算；编辑回填需要反查完整路径（让后端返回 path 数组，别前端递归拼）。

### 7c 远程搜索下拉

- Select + 输入防抖 300ms 触发 `useQuery(['user','search',kw], { enabled: kw.length >= 2 })`。
- 编辑回填时选中项可能不在当前搜索结果里——把已选项合并进 options（`[selected, ...list]` 去重）。
- 关键词最短 2 字符才发请求；空结果显示"无匹配"。

### 7d 文件上传

- 直传业务接口：FormData + `onUploadProgress` 显示进度条；大文件/多文件考虑 OSS 直传（前端先取 sts 凭证再传 OSS，回传 url）。
- 校验前置：类型白名单 + 大小上限在选择时拦截，别等上传完。
- 表单值只存后端返回的 url/id；提交前过滤掉"上传中"的文件。
- 删除已上传文件只是表单态移除，是否真删服务端文件与后端约定。

### 7e 富文本

- 中后台够用优先 `quill`/`tinymce`；轻量场景直接 textarea + Markdown 预览。
- 封装受控组件接 Controller；内容展示端必须 sanitize（`dompurify`）防 XSS。
- 图片粘贴上传要配上传适配器，否则 base64 撑爆提交体。

### 7f 日期范围与金额输入规范

- 日期范围：值统一 `dayjs` 对象，提交前转 `YYYY-MM-DD HH:mm:ss`；快捷选项（今天/近7天/本月）必备；起止校验结束 ≥ 开始。
- 金额：**前端输入字符串，提交前转"分"为单位的整数**，禁止 float 直传；展示端统一 `fen → 元` 千分位格式化，两处函数全项目唯一来源。
- 数字输入用 `inputMode="decimal"` + 失焦格式化，别在 onChange 里强改打断输入。

**交互与边界清单**：
- [ ] 明细行删除后 zod 仍校验 min(1)，错误提示定位到行
- [ ] 级联回填充整路径
- [ ] 远程下拉已选项不丢、无网可展示
- [ ] 上传中禁止提交、失败可重传
- [ ] 富文本 XSS sanitize、图片大小限制
- [ ] 金额全链路无 float 运算
- [ ] 所有高级控件都接入 react-hook-form 校验与错误展示，不游离在外

**常见坑**：
- `useFieldArray` 用 index 当 key 导致诡异错位。
- 金额 `0.1+0.2` 精度问题出现在前端汇总行——用分为单位整数运算。
- 远程下拉编辑回填 label 显示成 id 字符串。

---

## 页面 8：详情页

**适用场景**：展示单条记录全貌，只读为主，顶部挂少量操作。

**结构解剖**：

```
┌─页头：标题+状态徽标      [编辑][审批][更多▾]─┐
├─Tab: 基本信息 | 明细 | 操作日志 | 时间线─────┤
├─描述列表(2-3列) / 左信息右关联(2:1)─────────┤
```

**数据流与状态**：`useOrderDetail(id)`，query key `['order','detail',id]`；当前 tab 进 URL（`?tab=log`）；id 来自路由 params。

**实现步骤**：
1. 描述列表用配置数组驱动：`{ label, key, render? }[]`，统一处理空值显示 `-`。
2. 状态徽标、枚举字段走全局字典映射组件 `<DictTag value={status} type="orderStatus" />`。
3. 多 tab 懒加载：切到才挂载对应组件（日志、时间线各自分页查询）。
4. 顶部操作区按状态+权限动态渲染（复用页面 9 的可用操作表）。
5. 编辑入口：跳独立编辑页（`/:id/edit`）或复用 FormDialog，保存后 invalidate detail。
6. 关联数据（如订单的商品列表）独立 query + 简单表格，不分页或前端分页。

**交互与边界清单**：
- [ ] id 不存在/已删除 → 404 态
- [ ] 无权限查看 → 403 态
- [ ] 加载骨架按描述列表形状占位，不跳变
- [ ] 长文本（备注/富文本）折叠展开 + sanitize
- [ ] 字段为空统一 `-`，区分 0 与空
- [ ] 操作成功后详情自动刷新（invalidate detail key）
- [ ] 复制按钮（订单号/id）+ 复制成功反馈
- [ ] 浏览器刷新/直接访问链接可完整还原（全部状态在 URL）
- [ ] 返回列表记住之前查询条件（列表条件本就在 URL，天然满足）

**常见坑**：
- 从列表跳详情靠 `navigate` 传 state 带数据，用户一刷新页面全空——一切数据按 id 重新查。
- 详情页改了数据返回列表，列表还是旧的——编辑成功必须 invalidate 列表前缀。
- 描述列表每项手写 `<div>`，加字段加到崩溃；配置化一次到位。

---

## 页面 9：审批/流程类页面

**适用场景**：待办审批、工单流转、状态机驱动的业务单据。

**核心思维：状态枚举驱动一切。** 单据只有一个 `status` 字段（别搞一堆布尔），UI 展示、可用操作、按钮权限全部由状态推导：

```ts
// 可用操作表：状态 × 角色 → 操作集合
const ACTIONS: Record<Status, Action[]> = {
  PENDING:  [{ key: 'approve', label: '通过', type: 'primary', needComment: false },
             { key: 'reject',  label: '驳回', type: 'danger',  needComment: true }],
  APPROVED: [{ key: 'revoke',  label: '撤销', type: 'default' }],
  REJECTED: [],
};
// 渲染：ACTIONS[detail.status]?.filter(a => hasPerm(`order:${a.key}`))
```

**结构解剖**：

```
┌─页头：单号+状态徽标   [通过][驳回][转交]──┐
├─申请信息(描述列表)───────────────────────┤
├─审批时间线：节点→节点(当前高亮)───────────┤
└─操作弹窗：意见输入 + [确定]───────────────┘
```

**数据流与状态**：详情 query + 时间线 query；操作 mutation 带操作类型与意见；操作后 invalidate 详情 + 待办列表 + 工作台待办数。

**实现步骤**：
1. 与后端敲定完整状态枚举与流转图，写进 types 注释，画在文档里。
2. 定义状态 → 徽标颜色/文案映射表，全局唯一。
3. 定义上文的可用操作表（状态 × 操作 × 是否需意见 × 二次确认文案）。
4. 操作统一走一个 `<ActionDialog action={...}>`：按 action 配置渲染意见框（必填/选填）、确认文案。
5. 批量审批（如需要）：列表多选 → 逐个串行调用或后端批量接口，结果逐条反馈成功/失败。
6. 待办列表与普通列表复用页面 3，仅固定查询条件 `status=PENDING` + 角标计数。
7. 操作完成后 toast + invalidate 三个相关 query（详情、列表、计数）。

**交互与边界清单**：
- [ ] 按钮渲染完全由操作表驱动，代码里不出现 `if status === 'PENDING'` 散落各处
- [ ] 驳回必须填意见（前端+后端双校验）
- [ ] 操作二次确认文案带单据关键信息（"确认通过 #2024001 的申请？"）
- [ ] 并发审批：两人同时点通过，后者收到 409/状态已变更 → 刷新详情并提示
- [ ] 操作中按钮 loading，防连点产生重复流转记录
- [ ] 时间线节点展示操作人/时间/意见，空意见显示 `-`
- [ ] 当前状态无任何可用操作时给出说明文案而非空白页头
- [ ] 审批人就是自己创建的申请时是否可自审（业务规则前置确认）
- [ ] 状态枚举兜底：未知状态显示原始值+灰色，不崩页面

**常见坑**：
- 状态判断散落在 JSX 里，加一个状态改十处；收敛成映射表。
- 前端只按当前状态渲染按钮，但接口慢返回期间用户点了旧状态的按钮——提交前再校验或交给后端 409 兜底。
- 审批意见富文本/换行在时间线被压成一行，展示端 `whitespace-pre-wrap`。

---

## 页面 10：系统管理系列（通用配方 + 差异表）

**适用场景**：用户/角色/菜单/字典/参数/日志，中后台第二多的页面群，全部套"列表 + FormDialog"模板。

**通用配方（一次写好，复制六次）**：
1. 标准列表页（页面 3）全套：查询区、表格、分页、URL 同步。
2. 新增/编辑用 FormDialog（页面 5）。
3. 删除二次确认 + invalidate。
4. 权限码：`system:user:list / :create / :update / :delete`，按钮级控制。

**差异点表格**：

| 页面 | 列表特点 | 表单特殊字段 | 独有操作 | 特别注意 |
|---|---|---|---|---|
| 用户管理 | 按部门树过滤（左树右表） | 角色多选、部门、初始密码（仅新增） | 重置密码、启用/禁用、分配角色 | 重置密码弹窗显示新密码仅一次/或发邮件；禁用自己要做拦截 |
| 角色管理 | 简单表格 | 权限树勾选（半选态处理） | 分配权限、查看成员 | 权限树提交"全选 id + 半选父 id"的约定与后端对齐；内置超管角色禁编辑 |
| 菜单/权限 | 树表格 | 类型（目录/菜单/按钮）、路由、组件路径、图标、排序 | 新增子级 | 按钮类型无路由；改动后需刷新当前用户权限缓存 |
| 字典管理 | 字典类型列表 → 字典项内嵌抽屉 | 类型 code 唯一、项的 label/value/排序 | 字典项 CRUD | 前端字典缓存需在变更后刷新（invalidate `['dict']`） |
| 参数配置 | 简单表格 | 键、值、是否内置 | — | 内置参数禁删；值类型（string/json/number）提示 |
| 操作/登录日志 | 只读列表，查询条件多（操作人/IP/时间范围/结果） | 无表单 | 详情抽屉、导出 | 禁止提供删除（审计要求）；时间范围默认今天；大表分页性能交给后端 |

**交互与边界清单**：
- [ ] 操作自己账号的降权/禁用有拦截或强提示
- [ ] 唯一性字段（用户名/角色 code/字典 code）冲突错误映射到字段
- [ ] 权限树半选态勾选逻辑与提交格式前后端对齐
- [ ] 角色变更后涉及的用户权限何时生效（重登 or 强制刷新 token）有说明
- [ ] 日志页查询条件默认收窄（时间范围必填），防止全表扫
- [ ] 各页面删除操作评估关联影响（角色被用户引用时禁删）
- [ ] 权限按钮按权限码显隐
- [ ] 表单字段全项目复用（部门选择、角色选择抽成业务组件）

**常见坑**：
- 权限树只提交叶子 id，后端需要父级半选 id，对不齐导致回显全选变半选丢失。
- 用户管理的"分配角色"与编辑表单里的角色字段两处维护，数据互相覆盖。
- 字典改了前端还显示旧文案——字典统一走 query 缓存，变更后 invalidate。

---
## 页面 11：个人中心

**适用场景**：当前用户自助维护资料、密码与消息。

**结构解剖**：

```
┌─左侧卡：头像+姓名+角色────┬─Tab: 基本资料 | 修改密码 | 消息通知─┐
│  [上传头像]              │  对应表单/列表                        │
```

**数据流与状态**：`['profile']`、`['messages', { page, read }]`；未读数全局 store（布局层角标共用）；头像上传走文件上传配方。

**实现步骤**：
1. 基本资料：复用表单套路，提交后 invalidate `['profile']` 并同步用户 store（顶栏头像/姓名）。
2. 修改密码独立表单：旧密码 + 新密码 ×2；zod 校验两次一致、强度（8 位含字母数字）；与登录 schema 复用规则常量。
3. 改密成功后强制重新登录（清 token 跳登录页），因为旧 token 通常失效。
4. 消息通知列表：tab 分"全部/未读"，行点击标记已读 + 跳关联页面；顶部"全部已读"。
5. 未读数：轮询 `refetchInterval: 60s` 或 WebSocket 推送，角标显示 99+。

**交互与边界清单**：
- [ ] 修改密码错误（旧密码不对）映射字段级提示
- [ ] 改密成功清登录态并提示"请使用新密码重新登录"
- [ ] 头像裁剪、类型/大小校验、上传中预览 loading
- [ ] 资料保存后顶栏信息同步更新
- [ ] 消息"全部已读"二次确认（量大时）
- [ ] 已读/未读样式区分，点击后即时更新角标
- [ ] 手机号/邮箱修改是否需验证码验证（安全等级高的系统）
- [ ] 个人资料字段与"用户管理"编辑同一用户时的字段一致性

**常见坑**：
- 资料提交成功但顶栏还是旧名字——store 与 query 双写，记得同步。
- 改密后前端没登出，后续请求 401 连环弹错。

---

## 页面 12：异常页全家桶

**适用场景**：403/404/500/网络异常/维护中，一个组件参数化全搞定。

**结构解剖**：

```
┌─────────────────────┐
│   插图/状态码大字     │
│   一句话说明          │
│  [返回首页] [重试?]   │
└─────────────────────┘
```

**实现步骤**：
1. 一个 `<Result status="403|404|500|offline|maintenance" />`，内部映射表配置插图、标题、副标题、按钮。
2. 路由层：`path="*"` → 404；无权限路由守卫 → 403；`ErrorBoundary` fallback → 500 并上报 Sentry。
3. 网络异常：axios 拦截器识别 `ERR_NETWORK`，列表/详情 error 态复用 Result 带"重试"按钮（`onClick={refetch}`）。
4. 维护中：全局开关（接口 503 或配置中心下发）时路由层整体替换渲染。

```tsx
const MAP = {
  403: { title: '暂无访问权限', desc: '请联系管理员开通', action: 'home' },
  404: { title: '页面不存在', desc: '地址错误或页面已移除', action: 'home' },
  500: { title: '系统开小差了', desc: '请稍后重试', action: 'retry' },
} as const;
```

**交互与边界清单**：
- [ ] 403 与 404 文案区分，403 提供"切换账号"入口（可选）
- [ ] 500 页提供错误 ID（trace id）便于客服定位
- [ ] ErrorBoundary 捕获后上报 Sentry 并可"重载页面"
- [ ] 网络异常重试有节流，避免狂点
- [ ] 异常页不泄露堆栈/接口地址等敏感信息
- [ ] 深色模式下插图与文字可读
- [ ] 菜单内嵌页面异常不吞掉整体布局（保留侧边栏与顶栏）

**常见坑**：
- ErrorBoundary 只包路由出口，异步 query 错误没被捕获——query 错误靠各页面 error 态 + Result 组件，边界只兜底渲染错误。
- 维护中页面也走需要登录的布局，维护接口 401 又跳登录死循环。

---

## 页面 13：数据导入导出

**适用场景**：批量初始化/迁移数据；业务数据落 Excel 给财务/运营。

**结构解剖（导入）**：

```
导入 Dialog：①下载模板 → ②上传文件 → ③校验结果
   成功 N 条 / 失败 M 条 [下载失败明细]
```

**实现步骤（导入）**：
1. 模板下载：静态文件放 public 或后端接口，文件名带版本号。
2. 上传前校验：扩展名、大小；upload 接口返回 `{ successCount, failCount, errors: [{ row, message }] }`。
3. 结果回显：成功/失败计数 + 失败行表格（行号 + 原因），支持"下载失败明细 Excel"（后端生成）。
4. 全部成功后 invalidate 列表；部分成功提示用户处理失败行。
5. 大数据量导入改异步任务：上传后返回 taskId，轮询任务状态或通知中心收结果。

**实现步骤（导出）**：
1. **同步下载**（数据量 <1 万行）：`axios.get(url, { responseType: 'blob', params })`，前端用 `URL.createObjectURL` + `a[download]` 触发保存；文件名从 `Content-Disposition` 解析。
2. 导出带当前查询条件：直接透传 searchParams 里的条件。
3. **异步任务**（大数据量）：创建导出任务 → toast"任务已创建，完成后通知中心下载" → 通知中心轮询/推送 → 提供下载链接（有效期）。
4. 导出按钮 loading 防连点；高频导出做节流提示。

```ts
// Blob 下载骨架
const blob = await api.exportOrders(params); // responseType: 'blob'
const a = Object.assign(document.createElement('a'), {
  href: URL.createObjectURL(blob),
  download: getFileName(headers) ?? 'export.xlsx',
});
a.click(); URL.revokeObjectURL(a.href);
```

**交互与边界清单**：
- [ ] 导入前必读说明（模板版本、必填列、示例）
- [ ] 上传中进度条、禁重复上传
- [ ] 失败行号与 Excel 实际行号一致（含表头偏移，前后端对齐）
- [ ] 部分成功的语义与产品确认（是否回滚）
- [ ] 导出上限提示（如单次最多 1 万行，超出引导异步）
- [ ] Blob 下载要处理"错误也返回 blob"的情况——先 peek `blob.type` 是否 json，是则解析出错误信息 toast
- [ ] 导出权限单独权限码
- [ ] 异步导出通知点击直达下载，链接过期有提示

**常见坑**：
- 后端校验失败返回 JSON，前端按 blob 处理导致下载了一个 json 文件且无提示。
- 大文件导出同步等待 60s 网关超时——超过阈值一律异步任务。
- 导入模板列顺序/日期格式用户常填错，失败明细文案要写到单元格级。

---

## 页面 14：打印页面

**适用场景**：订单、发票、报表的纸质输出。

**实现步骤**：
1. 两种路线：**浏览器打印**（样式可控性低、零依赖）与 **PDF 生成**（后端生成或前端 `pdfmake`，精确排版），优先让后端出 PDF，前端打印只用于简单单据。
2. 打印页面做独立路由 `/print/order/:id`，无布局（不套侧边栏）。
3. 全局样式加 `@media print`：隐藏 `.no-print`（按钮、导航）、重置背景为白、字号用 pt。
4. 进入页面数据 ready 后 `window.print()`；`onafterprint` 关闭页签或跳回。
5. 分页控制：`page-break-inside: avoid`（行不截断）、`page-break-after`（多单连打）。

```css
@media print {
  .no-print { display: none !important; }
  body { background: #fff; font-size: 12pt; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
}
@page { margin: 16mm; } /* 边距交给 @page，不在 body 上加 padding */
```

**交互与边界清单**：
- [ ] 打印前数据未加载完禁用打印按钮
- [ ] 彩色徽标/图表在黑白打印下可读（必要时打印样式换纯文字）
- [ ] 表格跨页表头重复（`thead { display: table-header-group }`）
- [ ] 二维码/条码用图片或 SVG，保证可扫
- [ ] 金额、日期打印格式与页面一致
- [ ] Chrome/Edge 打印预览实测，页眉页脚（浏览器自带 URL/页码）提示用户关闭
- [ ] 多联打印排版用 `@page` 尺寸声明

**常见坑**：
- 背景色/深色主题直接打印一片黑——`@media print` 强制白底黑字，必要时 `-webkit-print-color-adjust: exact` 只对需要的元素开。
- flex/grid 布局打印错位，打印版单独用 table/ block 布局写一套。

