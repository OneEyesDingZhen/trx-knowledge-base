# 浏览器渲染管线 · 周五晚集训手册

> 目标：一个晚上重建渲染管线认知，四个实验建立体感，Canvas 迷你管线打通"渲染引擎通用范式"，八股销题。
> 前置：Chrome/Edge（DevTools 完整）、一个本地文件夹、一台不卡的手机可忽略。

## 当晚时间表（可按精力 ±15 分钟浮动）

| 时段 | 环节 | 产出 |
|---|---|---|
| 19:30 - 20:15 | 第一部分 · 知识重讲 | 在手册空白处手写回忆要点 |
| 20:15 - 21:30 | 第二部分 · 四个 Lab | 每个 Lab 勾完观察清单 |
| 21:30 - 22:15 | 第三部分 · Canvas 迷你管线 | 跑通一个 100 行的"小渲染引擎" |
| 22:15 - 22:45 | 第四部分 · 八股自测 | 10 题能口述，答不出的回看对应章节 |

---

# 第一部分 · 知识重讲（45 分钟）

读法建议：**先看每节标题，自己口述 30 秒，再看正文对答案**——主动回忆比通读记忆效率高 3 倍。忘掉的部分就是你的真实缺口，标记它。

## 1.1 一张图记住全流程

```
HTML ──解析──> DOM 树 ┐
                      ├─> Render 树 ──> Layout(布局) ──> Paint(绘制) ──> Composite(合成) ──> 上屏
CSS  ──解析──> CSSOM  ┘
```

JS 可以插入任意一环（读样式、改 DOM、改样式），这就是为什么 JS 能搞砸整条流水线。

## 1.2 五个阶段各干什么

1. **Parse（解析）**：HTML 字符串 → DOM 树；CSS 字符串 → CSSOM 树。`<script>` 默认**阻塞解析**（JS 可能改 DOM，浏览器不敢继续猜）。
2. **Render Tree（渲染树构建）**：DOM + CSSOM 合并。`display: none` 的节点**不进渲染树**；`visibility: hidden` 进树（占位）。
3. **Layout / Reflow（布局/回流）**：计算每个节点的几何信息——在哪、多大。特点：**贵，且会传染**。改一个父元素的宽度，子树全部要重算。
4. **Paint（绘制）**：把每个节点的像素（背景、文字、边框、阴影）画出来，按**层**分别光栅化成位图。
5. **Composite（合成）**：合成线程把各层位图按顺序、按 transform/透明度拼成最终画面，交给 GPU 上屏。

**关键认知**：前 4 步都在主线程（和 JS 抢时间），第 5 步可以丢给独立的合成线程——这是所有性能优化的总开关。

## 1.3 一帧的生命周期（16.6ms 预算）

60Hz 屏幕每 16.6ms 刷新一次，一帧内浏览器要干完：

```
rAF 回调 → JS 执行 → Style 计算 → Layout → Paint → Composite → 上屏
|←—————————— 全部必须在 16.6ms 内 ——————————→|
```

- **requestAnimationFrame**：在每一帧开头被调用，回调时机与绘制对齐 → 动画用它不掉帧。
- **setTimeout/setInterval**：时机不与帧对齐，可能在帧中间才跑 → 改完样式来不及上屏 → 掉帧。
- **长任务**：一段 JS 执行超过 50ms 就叫长任务，直接吃掉好几帧的预算。

## 1.4 成本阶梯：改什么，触发多少

| 改动类型 | 例子 | 触发阶段 | 成本 |
|---|---|---|---|
| 改几何 | width、height、top、margin、font-size | Layout + Paint + Composite | 最贵 |
| 改外观 | color、background、box-shadow | （跳过 Layout）Paint + Composite | 中 |
| 改变换/透明 | transform、opacity | （跳过前两者）只 Composite | 最便宜，可完全跑在合成线程 |

**记忆锚点：越靠管线下游的改动越便宜。** 动画能用 transform/opacity 解决，就别碰别的属性。

## 1.5 层（Layer）与合成——CSS 玄学的总答案

- **什么会把元素提升为独立合成层**：`will-change`、正在进行的 transform/opacity 动画、`video`、`canvas`、某些 `fixed` 场景、层叠顺序压在已合成元素之上等。
- **层不是免费的**：每一层占一块显存。给几百个元素乱加 `will-change` = **层爆炸**，GPU 内存飙升，反而更卡甚至崩溃。
- **层叠上下文（stacking context）**：`transform`、`filter`、`opacity < 1`、`position + z-index`、`flex/grid 子项 + z-index` 等都会创建。**z-index 只在同一个层叠上下文内比大小**——这就是 `z-index: 9999` 还是被盖住的根因：你俩根本不在一个"裁判组"里。
- **fixed 定位"失灵"**：fixed 相对的是**包含块**，通常视口；但祖先一旦有 `transform`/`filter`/`perspective`，包含块就变成那个祖先，fixed 秒变 absolute。弹窗组件库的弹窗"飞走"，八成是它。

## 1.6 强制同步布局 与 Layout Thrashing

- 样式被改"脏"后，浏览器本可以攒到帧末统一 Layout；但你一旦**读取** `offsetWidth` / `getBoundingClientRect()` / `getComputedStyle()`，浏览器被迫**立刻**同步跑一次 Layout 给你准确值——这叫**强制同步布局（Forced Synchronous Layout）**。
- **Layout Thrashing**：循环里"写 → 读 → 写 → 读"，每轮都强制一次 Layout，N 次循环 = N 次全量布局，帧预算瞬间爆炸。
- **解法**：批量读、批量写（先读完所有值，再统一改）；或把读写挪进同一个 rAF 回调里安排好顺序。

## 1.7 关键渲染路径（CRP）——首屏优化的理论根基

- CSS 是**渲染阻塞资源**：CSSOM 没建好，渲染树没法建，页面不敢画（否则样式闪变）。
- JS 是**解析阻塞资源**：默认遇到 `<script>` 停下载解析、执行完再继续。
  - `defer`：并行下载，DOM 解析完后按顺序执行（不阻塞解析）。
  - `async`：并行下载，下载完立刻执行（阻塞解析，顺序不保证）。
- **首屏三板斧**全从这张图推出来：减少关键资源数量、缩短关键路径长度、压缩关键字节数（内联关键 CSS、defer 非关键 JS、骨架屏/SSR 本质上都是在骗过或缩短 CRP）。

> 第一部分自检：合上手册，能画出 1.1 的图 + 说出 1.4 的三级阶梯 + 解释 fixed 失灵原因，就算过关。

---

# 第二部分 · 四个 Lab（75 分钟）

通用准备：

- 每个 Lab 一个独立 `.html` 文件，双击用 Chrome 打开即可。
- DevTools 两个开关先开好：
  - **Performance 面板**：`F12 → Performance`，点 ● 录制 3~5 秒再停，看火焰图。紫色 = Rendering（Layout/Paint），黄色 = Scripting，绿色 = Painting/Composite。
  - **Paint Flashing**：`F12 → 右上角 ⋮ → More tools → Rendering → 勾选 Paint flashing`。页面上哪里重绘，哪里闪绿框——肉眼直接看见重绘区域。
- 每个 Lab 末尾的"观察清单"是你的真实验收标准，**亲眼看到才勾**。

## Lab 1 · 重排 vs 重绘 vs 合成（20 分钟）⭐ 最重要

**文件：`lab1-three-buttons.html`**

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; padding: 20px; }
  button { margin-right: 12px; padding: 8px 16px; }
  #box {
    width: 100px; height: 100px;
    background: #4f8ef7;
    position: relative; top: 0; left: 0;
  }
</style>
</head>
<body>
  <button id="btn1">改 top（回流+重绘）</button>
  <button id="btn2">改背景色（只重绘）</button>
  <button id="btn3">改 transform（只合成）</button>
  <div id="box"></div>
  <script>
    const box = document.getElementById('box');
    let i = 0;
    const next = () => (i = (i + 20) % 300);

    btn1.onclick = () => { box.style.top = next() + 'px'; };
    btn2.onclick = () => { box.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`; };
    btn3.onclick = () => { box.style.transform = `translateX(${next()}px)`; };
  </script>
</body>
</html>
```

**操作步骤**：
1. 打开 Paint Flashing，分别点三个按钮，注意绿框闪的范围。
2. 开 Performance 面板，录制期间**快速连点 btn1 五次**，停止；再录一次**连点 btn3 五次**。
3. 展开火焰图里的 Main 线程，对比两种操作下紫色块的差异。

**观察清单**：
- [ ] 点 btn1 时，绿框在盒子**和周围区域**都闪（回流波及布局）
- [ ] 点 btn2 时，绿框只闪盒子本身，且火焰图里没有 Layout 紫色块
- [ ] 点 btn3 时，**绿框基本不闪**（没重绘，直接合成），Main 线程几乎空闲
- [ ] 火焰图里能指认出 Layout（紫色）和 Paint（绿色）各自长什么样

**面试挂钩**：回流重绘区别 / transform 为什么快。

## Lab 2 · 合成层的诞生与代价（20 分钟）

**文件：`lab2-layers.html`**

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; padding: 20px; }
  .box {
    display: inline-block;
    width: 40px; height: 40px; margin: 4px;
    background: #f76f8e;
  }
</style>
</head>
<body>
  <button id="btnTop">500 个盒子用 top 动画</button>
  <button id="btnTransform">500 个盒子用 transform 动画</button>
  <button id="btnWillChange">全部加 will-change（层爆炸预警）</button>
  <div id="stage"></div>
  <script>
    const stage = document.getElementById('stage');
    for (let i = 0; i < 500; i++) {
      const d = document.createElement('div');
      d.className = 'box';
      d.style.position = 'relative';
      stage.appendChild(d);
    }
    const boxes = document.querySelectorAll('.box');
    let t = 0, mode = null;

    function tick() {
      t += 0.03;
      boxes.forEach((b, idx) => {
        const v = Math.sin(t + idx * 0.05) * 20 + 'px';
        if (mode === 'top') b.style.top = v;
        if (mode === 'transform') b.style.transform = `translateY(${v})`;
      });
      requestAnimationFrame(tick);
    }
    btnTop.onclick = () => { mode = 'top'; tick(); };
    btnTransform.onclick = () => { mode = 'transform'; };
    btnWillChange.onclick = () => boxes.forEach(b => b.style.willChange = 'transform');
  </script>
</body>
</html>
```

**操作步骤**：
1. 开 Performance Monitor（`More tools → Performance monitor`），盯住 **CPU 占用** 和 **DOM Nodes**。
2. 先点"top 动画"，录 Performance，看帧率（帧率条上的红点 = 掉帧）。
3. 再点"transform 动画"，对比帧率和 Main 线程占用。
4. 开 **Layers 面板**（`More tools → Layers`，可能需要先开 3D 视图），看 transform 动画时层怎么变。
5. 最后点"全部加 will-change"，看 Performance Monitor 的 **GPU 内存**（若显示）和帧率变化。

**观察清单**：
- [ ] top 动画时帧率明显下降/出现红色掉帧标记，Main 线程被 Layout 占满
- [ ] transform 动画明显更顺滑，Main 线程空闲（动画跑在合成线程）
- [ ] Layers 面板里能亲眼看到"哪些元素被单独拎成了一层"
- [ ] 500 个 will-change 之后理解了"层 = 显存"不是口号（可能肉眼可见变卡）

**面试挂钩**：合成层是什么 / will-change 使用注意 / 动画性能优化。

## Lab 3 · Layout Thrashing 现场（20 分钟）

**文件：`lab3-thrashing.html`**

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; padding: 20px; }
  .item { background: #5eb85e; margin: 2px 0; height: 20px; }
</style>
</head>
<body>
  <button id="bad">错误示范：读写交替 500 次</button>
  <button id="good">正确示范：批量读 → 批量写</button>
  <div id="list"></div>
  <script>
    const list = document.getElementById('list');
    for (let i = 0; i < 500; i++) {
      const d = document.createElement('div');
      d.className = 'item';
      d.style.width = (100 + i % 100) + 'px';
      list.appendChild(d);
    }
    const items = [...document.querySelectorAll('.item')];

    bad.onclick = () => {
      console.time('thrashing');
      items.forEach(el => {
        const w = el.offsetWidth;      // 读 → 强制同步布局
        el.style.width = w + 1 + 'px'; // 写 → 样式变脏
      });
      console.timeEnd('thrashing');
    };

    good.onclick = () => {
      console.time('batched');
      const widths = items.map(el => el.offsetWidth); // 先全部读完
      items.forEach((el, i) => el.style.width = widths[i] + 1 + 'px'); // 再统一写
      console.timeEnd('batched');
    };
  </script>
</body>
</html>
```

**操作步骤**：
1. 开 Performance 录制，点"错误示范"，停止。展开 Main 线程——你会看到一长串密集的紫色 **Layout 锯齿**，以及可能的紫色红色角标"Forced reflow"警告。
2. 点 Console 看 `console.time` 输出：thrashing 通常比 batched 慢**几十倍**。
3. 点"正确示范"录制对比：Layout 只跑一次。

**观察清单**：
- [ ] 亲眼看到"读写交替"产生的紫色锯齿状 Layout 瀑布
- [ ] 在 Console 看到两者耗时数量级差异
- [ ] 火焰图里找到 "Forced reflow is a likely performance bottleneck" 警告（Chrome 会直接点名）

**面试挂钩**：什么是 layout thrashing / 强制同步布局 / 怎么优化。

## Lab 4 · rAF 与帧预算（15 分钟）

**文件：`lab4-raf.html`**

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; padding: 20px; }
  #ball {
    width: 50px; height: 50px; border-radius: 50%;
    background: #f7a94f; position: relative;
  }
</style>
</head>
<body>
  <button id="btnRaf">rAF 驱动</button>
  <button id="btnTimeout">setTimeout 驱动</button>
  <button id="btnBlock">主线程塞一个 300ms 长任务（看两种动画的反应）</button>
  <div id="ball"></div>
  <script>
    const ball = document.getElementById('ball');
    let x = 0, dir = 1, driver = null;

    function move() {
      x += dir * 3;
      if (x > 600 || x < 0) dir *= -1;
      ball.style.transform = `translateX(${x}px)`;
    }
    btnRaf.onclick = () => {
      driver = 'raf';
      (function loop() { move(); if (driver === 'raf') requestAnimationFrame(loop); })();
    };
    btnTimeout.onclick = () => {
      driver = 'timeout';
      (function loop() { move(); if (driver === 'timeout') setTimeout(loop, 16); })();
    };
    btnBlock.onclick = () => {
      const end = performance.now() + 300;
      while (performance.now() < end); // 阻塞主线程 300ms
    };
  </script>
</body>
</html>
```

**操作步骤**：
1. 分别用两种驱动跑小球，Performance 录制对比。
2. 动画跑着的时候点"长任务"按钮，观察小球的卡顿，并在火焰图里找到那条 300ms 的黄色长任务。
3. 思考题（动手验证）：把 `move()` 里的 transform 改成 `ball.style.left`，再点长任务，有区别吗？（提示：left 动画必须回主线程跑 Layout，长任务一堵全堵；transform 已合成后，部分场景下合成线程还能续命。）

**观察清单**：
- [ ] setTimeout 驱动的帧间隔不均匀（火焰图里帧间距忽长忽短）
- [ ] 亲眼在火焰图里指认出"长任务"，理解"长任务吃掉帧预算"
- [ ] 理解 rAF 回调在帧头执行的含义（火焰图里 rAF 回调紧贴帧起点）

**面试挂钩**：rAF vs setTimeout / 长任务 / 一帧里浏览器都做了什么。

> 第二部分验收：四个 Lab 清单全部打勾。没打勾的那一项，就是你八股里会露怯的那道题。

---

# 第三部分 · Canvas 迷你渲染管线（45 分钟）

## 为什么做这个

浏览器的管线你刚才"看"到了，现在亲手"造"一个迷你版。你会真切体会到：**所有渲染引擎都是同一个范式——场景树 → 布局 → 绘制 → （脏区）重绘**。浏览器如此，Flutter 如此，你以后写 Mermaid 渲染器、低代码画布、甘特图，全如此。

定位：**认知级，不是工业级**。100 行左右，能跑、能观察、能映射。

## 范式对照表（做完回头再看一遍，会起鸡皮疙瘩）

| 浏览器管线 | 我们的迷你引擎 |
|---|---|
| DOM 树 | `scene` 场景树（纯 JS 对象） |
| CSSOM / 样式 | 节点自带的 `fill`、`w/h` 属性 |
| Layout（布局） | `layout()`：把相对坐标算成绝对坐标 |
| Paint（绘制） | `paint()`：遍历树调 Canvas API 画像素 |
| Composite（合成） | 没有——Canvas 是一块位图，浏览器替我们合成 |
| 强制重绘 | `invalidate()`：数据变了，标记脏，下一帧重画 |
| rAF | 同款 rAF，帧头检查脏标记 |

## 代码：`mini-engine.html`

```html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: sans-serif; padding: 20px; }
  canvas { border: 1px solid #ccc; }
</style>
</head>
<body>
  <button id="btn">点我：随机移动一个矩形（触发"脏检查重绘"）</button>
  <span id="log"></span>
  <br><br>
  <canvas id="c" width="700" height="400"></canvas>
  <script>
    const ctx = document.getElementById('c').getContext('2d');

    // ===== 1. 场景树（≈ DOM 树）：节点只有相对父级的坐标 =====
    const scene = {
      type: 'root', x: 0, y: 0, children: [
        { type: 'rect', x: 30,  y: 30,  w: 200, h: 150, fill: '#4f8ef7', children: [
          { type: 'rect', x: 20, y: 20, w: 60, h: 60, fill: '#f76f8e', children: [] },
          { type: 'rect', x: 100, y: 60, w: 60, h: 60, fill: '#f7a94f', children: [] },
        ]},
        { type: 'rect', x: 300, y: 80,  w: 150, h: 100, fill: '#5eb85e', children: [] },
      ]
    };

    // ===== 2. Layout 阶段（≈ 浏览器 Layout）：递归算绝对坐标 =====
    function layout(node, parentAbsX, parentAbsY) {
      node.absX = parentAbsX + node.x;   // 父级一动，子级全跟着算 → 体会"回流传染"
      node.absY = parentAbsY + node.y;
      node.children.forEach(c => layout(c, node.absX, node.absY));
    }

    // ===== 3. Paint 阶段（≈ 浏览器 Paint）：遍历树画像素 =====
    function paint(node) {
      if (node.type === 'rect') {
        ctx.fillStyle = node.fill;
        ctx.fillRect(node.absX, node.absY, node.w, node.h);
      }
      node.children.forEach(paint);
    }

    // ===== 4. 脏标记 + 帧循环（≈ 浏览器的"样式变脏 → 下一帧重跑管线"）=====
    let dirty = true;
    let frames = 0;

    function invalidate() { dirty = true; }   // 数据变了：只打标记，不立刻画！

    function frame() {
      if (dirty) {                            // 帧头统一检查：攒一批改动只画一次
        const t0 = performance.now();
        ctx.clearRect(0, 0, 700, 400);
        layout(scene, 0, 0);                  // 重跑"管线"：布局 → 绘制
        paint(scene);
        const cost = (performance.now() - t0).toFixed(2);
        document.getElementById('log').textContent =
          `本帧重绘耗时 ${cost}ms（累计渲染 ${++frames} 帧）`;
        dirty = false;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ===== 交互：改数据 → 打脏标记 → 交给帧循环 =====
    document.getElementById('btn').onclick = () => {
      const green = scene.children[1];
      green.x = Math.random() * 500;
      green.y = Math.random() * 250;
      invalidate();                           // 注意：我们没有直接调 paint()
    };
  </script>
</body>
</html>
```

## 动手观察与思考题（认知建立的关键，别跳过）

1. **跑起来，连点按钮 20 次**：看 log——尽管你"改了 20 次数据"，如果手速够快（一帧内点两次），重绘次数可能少于点击次数。这就是**批量更新**：数据变动先攒着（dirty 标记），帧头统一重画。Vue/React 的异步更新队列，本质就是这个 dirty 标记。
2. **体会"回流传染"**：改 `btn` 的回调，改成只移动最外层蓝色大矩形（`scene.children[0]`），观察它的两个子矩形——你没有碰它们，但它们跟着动了，因为 `layout()` 递归重算了它们的绝对坐标。**这就是"改父元素导致子树全部回流"的物理本质**，比背十遍定义都牢。
3. **体会"全量重绘的浪费"**：只移动绿色小矩形，整个 canvas 却被 clearRect 全擦全画。工业级引擎的解法是**脏矩形（dirty rect）**：只擦并重画变化区域。试试把 `invalidate(x, y, w, h)` 传入变化区域，只 clearRect 那一块、只重画与之相交的节点——这就是浏览器 Paint 阶段"只重绘受损区域"的思想。
4. **映射回 Lab 1**：这个 canvas 页面里，你的引擎再忙，对浏览器来说也只是一块位图内容变了 → 只触发 canvas 这一层的重绘/合成，**不会引起页面其他元素的回流**。这就是为什么大型画布应用（Figma、在线表格）选择 Canvas 而不是几万个 DOM 节点。

## 认知封顶一句话

> DOM 渲染和 Canvas 渲染的区别只是"场景树谁托管"：浏览器托管（声明式，省心智，但管线成本不可控）vs 你托管（命令式，全手写，但管线完全由你掌控）。低代码画布、图形编辑器、大数据表格选 Canvas，买的就是这份"管线控制权"。

---

# 第四部分 · 八股自测（30 分钟）

用法：**遮住答案，先口述**。口述不出来或卡壳的题，回到对应章节/Lab 补。每题给了"加分句"——那是你今晚实验换来的体感，面试时说出来直接拉开档次。

---

**Q1. 回流（Reflow）和重绘（Repaint）的区别？怎么减少？**

> 回流：几何属性变化导致重新计算布局（位置、尺寸），会传染子树乃至全局；重绘：外观变化（颜色、背景）不重算几何只重画像素。回流必然引发重绘，重绘不一定回流。
> 减少手段：① 动画用 transform/opacity（只走合成）；② 批量改样式（class 切换代替逐条 style 赋值）；③ 读写分离，避免强制同步布局；④ 离线操作（DocumentFragment / display:none 改完再放回）；⑤ 复杂动画元素提升为独立层。

**加分句**："我在 Performance 面板里对比过三种操作：改 top 时 Main 线程每次都有 Layout 紫色块，改 transform 时主线程基本空闲，重绘闪烁直接消失。"（Lab 1）

---

**Q2. 为什么 transform 动画比改 left/top 快？**

> 三层原因：① left 是几何属性，触发 Layout + Paint + Composite 全流程，且都在主线程；② transform 不改变布局，只影响合成阶段的层变换，跳过前两个阶段；③ 已提升为合成层的 transform 动画可以完全跑在**合成线程**，主线程被 JS 占住时动画都不卡。

**加分句**："500 个盒子的动画实验里，top 版帧率明显掉，transform 版主线程几乎空跑。"（Lab 2）

---

**Q3. requestAnimationFrame 和 setTimeout 做动画有什么区别？**

> rAF 在每帧渲染开始前被调用，与屏幕刷新对齐，一帧一次，不掉帧；页面不可见时自动暂停（省电）。setTimeout 时机与帧不对齐，可能错过当前帧或一帧跑多次；后台标签页被节流但不保证停。动画一律用 rAF。

**加分句**："我在火焰图里看过两者的帧间隔，setTimeout 的帧间距忽长忽短，rAF 紧贴帧起点。"（Lab 4）

---

**Q4. 什么是合成层（Composite Layer）？will-change 有什么坑？**

> 合成层是浏览器把某些元素单独拎出来光栅化成位图，交给合成线程/GPU 独立处理。提升条件：transform/opacity 动画、will-change、video、canvas、fixed（部分场景）等。好处：变换动画不回流不重绘、跑在合成线程。**坑：每层占一块显存**，大量 will-change 会造成"层爆炸"，GPU 内存飙升反而变卡。will-change 应当是"动画前临时加、结束后移除"的提示，不是常驻 Buff。

**加分句**："我在 Layers 面板里亲眼看过元素被拎成独立层，也试过给 500 个元素加 will-change 看它变卡。"（Lab 2）

---

**Q5. 什么是强制同步布局 / Layout Thrashing？**

> 样式变脏后浏览器本想攒到帧末统一布局，但一旦读取 offsetWidth、getBoundingClientRect 等布局信息，浏览器被迫立即同步执行一次 Layout 返回准确值——强制同步布局。循环里"写→读→写→读"，每轮强制一次全量布局，就是 Layout Thrashing。解法：批量读、批量写，或把读写安排进同一个 rAF 回调。

**加分句**："500 次读写交替 vs 批量处理，耗时差几十倍，火焰图里是密密麻麻的紫色 Layout 锯齿，Chrome 直接给出 Forced reflow 警告。"（Lab 3）

---

**Q6. 说说关键渲染路径（CRP）和首屏优化。**

> CRP：HTML→DOM、CSS→CSSOM、合并成渲染树、布局、绘制、合成。两个阻塞点：CSS 是渲染阻塞（CSSOM 不完工不敢画），JS 是解析阻塞。首屏优化全部围绕缩短 CRP：内联关键 CSS、非关键 JS 加 defer/async、压缩关键资源体积、预加载关键资源（preload）、骨架屏、SSR 直出。

**加分句**：" defer 和 async 的区别我能从'是否阻塞解析'推出来，而不是背的——defer 等 DOM 解析完按序执行，async 下载完立刻执行。"

---

**Q7. z-index 设了 9999 还是被盖住，为什么？**

> z-index 只在**同一个层叠上下文**内比较。transform、filter、opacity<1、position+z-index 等都会创建新的层叠上下文。两个元素若分属不同层叠上下文，比的是它们**祖先上下文**的层级，内部 z-index 再大也没用。排查：DevTools Elements 面板看哪个祖先创建了层叠上下文。

**加分句**："这和合成层是同一套规则的两个侧面——层叠上下文决定绘制顺序，合成层决定光栅化边界。"

---

**Q8. fixed 定位弹窗为什么有时会"飞走"？**

> fixed 相对包含块定位，默认视口；但祖先一旦带 transform / filter / perspective，包含块变为该祖先，fixed 退化成相对它定位。组件库弹窗常见解法：Teleport/Portal，把弹窗挂到 body 下，躲开所有祖先的层叠上下文和包含块陷阱。

**加分句**："Vue 的 Teleport、React 的 createPortal 存在的第一理由不是组织代码，就是躲这个渲染规则。"

---

**Q9. 长列表/页面滚动卡顿，你的排查流程是什么？**

> ① Performance 面板录制卡顿过程，先看帧率条红点确认掉帧；② 展开 Main 线程看帧耗时大头在哪：黄色长（JS 长任务）→ 拆任务/防抖/Web Worker；紫色长（Layout）→ 查 layout thrashing、节点过多 → 虚拟滚动；绿色长（Paint）→ 查重绘区域过大/层爆炸，开 Paint Flashing 和 Layers 面板看；③ 如果是 DOM 数量问题（几万节点），上虚拟列表——不是因为"DOM 多就慢"，而是 Layout/Paint 成本随节点数增长。

**加分句**："这是流程题，我答的是工具链：Performance → Paint Flashing → Layers → Performance Monitor，每个工具验证一个假设。"（Lab 1-4 全用上了）

---

**Q10. 一帧里浏览器都做了什么？（16.6ms 都花在哪了）**

> 60Hz 屏幕一帧 16.6ms：帧头执行 rAF 回调 → JS 执行 → Style 计算（哪些样式变了）→ Layout（算几何）→ Paint（分层次光栅化）→ Composite（合成线程拼层上屏）。任何一环超时都会挤占后续环节，整帧超 16.6ms 就掉帧。优化就是：JS 别超时（拆长任务）、Layout 别多跑（读写分离）、Paint 别大面积（合成层隔离）、能用合成的动画别碰布局。

**加分句**："我写的迷你 Canvas 引擎就是这个循环的极简版：数据变脏只打标记，帧头统一跑 layout + paint——这就是 Vue/React 批量更新的思想原型。"（第三部分，这句话值整场面试）

---

## 当晚收尾（5 分钟）

- 四个 Lab 的观察清单 + 十道八股，凡是卡壳的，记三行笔记：问题 → 我的答案 → 正确答案差距在哪。
- 这份手册 + 六个 HTML 文件建议丢进你博客仓库的 `frontend/browser-rendering/` 目录，本身就是一篇学习沉淀——你的博客分类里"前端"目录的第一篇硬核内容就是它了。

## 后续（可选，不排期）

- 遇到真实项目卡顿，把 Lab 的工具链走一遍，把实战案例补进手册附录——面试时"我优化过真实项目"比"我做过实验"再硬一档。
- Canvas 引擎如果想继续：加脏矩形 → 加命中检测（点击选中）→ 加简单分层——三步之后，你再看 Figma 类产品的技术博客，基本都能看懂了。
