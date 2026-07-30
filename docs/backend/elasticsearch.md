# Elasticsearch 学习手册

> **定位**：从「心智模型」到「动手跑通」再到「明年深入」的一站式文档。
> **读者画像**：前端转全栈，有 MySQL / Redis 经验，TS 技术栈，有自建 Linux 开发服务器。
> **版本对齐**（写作时点 2026-07）：当前最新版本为 9.4.x（9.4 于 2026-05 发布）；8.19 是 8.x 最后一条支持线，支持到 2027-07-15[^1^]。本文示例以 **8.19.x** 为主线（教程、客户端、IK 中文分词器生态最成熟），关键处标注 9.x 差异。

## 导读：怎么用这份文档

| 章节 | 内容 | 什么时候读 |
| --- | --- | --- |
| 第一章 | 概念与心智模型 | **现在**，建立正确直觉 |
| 第二章 | 能力导览 | **现在**，知道 ES 能干什么、边界在哪 |
| 第三章 | 快速上手（部署 + 核心用法） | **这个周末**，一天跑通 |
| 第四章 | 系统进阶学习路线 | **明年**再按图深入，先收藏 |
| 第五章 | 底层原理简述 | **现在**通读一遍，面试也够用 |
| 附录 | 命令速查表 | 用时翻 |

---

# 第一章 概念与心智模型

## 1.1 一句话定义

Elasticsearch（简称 ES）是一个**基于 Lucene 的分布式搜索与分析引擎**：把 JSON 文档切分成「词」建立**倒排索引**，从而支持毫秒级全文检索、结构化过滤和实时聚合；数据天然可以水平拆分到多台机器上。

拆开这句话，四个关键词：

- **Lucene**：Java 写的高性能全文检索库，ES 的每个分片本质上就是一个完整的 Lucene 索引。你平时不直接碰它，但它决定了 ES 的一切行为。
- **倒排索引**：全文检索的核心数据结构，详见 1.4。
- **分布式**：集群、分片、副本是 ES 的「默认概念」，不是高级特性。
- **分析引擎**：ES 不只是「搜索框」，它的聚合（Aggregation）能力对标并强于 SQL 的 GROUP BY。

## 1.2 用 MySQL 的既有知识类比 ES

建立心智模型最快的方式，是把新概念挂到旧知识上：

| MySQL | Elasticsearch | 说明 |
| --- | --- | --- |
| Database | Index（索引） | 一类文档的集合，物理上会被拆成多个分片 |
| Table | ≈ Index（7.x 起移除了 Type 概念） | 现在一个 Index 直接对应「一类数据」 |
| Row | Document（文档） | 一条 JSON，是 ES 的基本数据单元 |
| Column | Field（字段） | 有类型：text / keyword / date / long / nested… |
| Schema | Mapping | 字段类型与分词方式的定义 |
| SQL | Query DSL（JSON）/ ES\|QL（管道语法） | ES\|QL 是 8.11 引入、9.x 成熟的新查询语言 |
| GROUP BY | Aggregation（聚合） | 支持多层嵌套，比 GROUP BY 强得多 |
| B+ 树索引 | 倒排索引 | 数据结构完全不同，见 1.4 与第五章 |
| 主从复制 | 副本分片（Replica Shard） | 既保高可用，也分摊读流量 |
| binlog | translog | 写入的持久化保障，见 5.4 |

> 注意：这个对照表用来「入门定位」很好，但用来「指导使用」会害你。ES 的查询思维是**相关度 + 过滤**，不是关系代数；建模思维是**反范式（宽表/冗余）**，不是三范式。

## 1.3 心智模型：三个「不是」

**1）ES 不是数据库的替代品。**
没有多文档事务；更新一条文档实际是「标记删除旧版本 + 插入新版本」；写入后默认 1 秒才能被搜到（近实时）。所以金额记账、库存扣减这种强一致场景，永远以 MySQL 为准。

**2）ES 不只是「搜索框」。**
它至少有三重身份：全文搜索引擎、实时聚合分析引擎、（AI 时代的）向量检索引擎。日志平台（ELK）、报表聚合、RAG 召回层都是它。

**3）ES 不是单机软件。**
哪怕你只起一个节点，也要理解分片、副本、集群状态这些词，否则连「为什么我的索引状态是 yellow」都解释不了。

**生产中的经典组合**（你的财务系统也会是这个形态）：

```
MySQL（记账，强一致，事务）
   │  同步（双写 / MQ / Canal 监听 binlog）
   ▼
Elasticsearch（找东西，检索 + 聚合 + 高亮）
```

MySQL 是「真相之源（source of truth）」，ES 是「检索副本」，允许秒级不一致。

## 1.4 为什么数据库 LIKE 不够用

假设对账单要支持「按摘要模糊搜索」，用 MySQL 会有四个绕不过去的问题：

1. `LIKE '%关键字%'` 前导通配符让 B+ 树索引失效，退化为全表扫描；
2. 数据库不分词：搜「对账单」匹配不到只含「对账」的记录；
3. 没有相关度概念：命中 2000 条，哪条最该排在前面？SQL 答不上来；
4. 「搜索 + 聚合」无法一体：搜完之后还要回表再 GROUP BY。

**倒排索引的直觉**：翻书最后几页的「索引页」——不告诉你每页有什么词，而是告诉你每个词在哪些页。

```
正排（MySQL 的思路）：文档 → 包含哪些词
倒排（ES 的思路）  ：词 → 出现在哪些文档里
```

举个例子，三条文档：

| doc_id | content |
| --- | --- |
| 1 | 6月对账单已发送 |
| 2 | 6月发票已开具 |
| 3 | 对账单金额确认 |

建出的倒排索引（简化版）：

```
6月    → [1, 2]
对账单  → [1, 3]
发票   → [2]
金额   → [3]
```

搜「对账单」时，直接查词表拿到 `[1, 3]`，O(词表查找) 而不是 O(全表)。搜「6月 对账单」就是两个列表求交集 `[1]`——这就是为什么第五章要说「跳表」和「Roaring Bitmap」，它们都是为了**让交集算得快**。

## 1.5 核心概念层级图

```
逻辑层（你建模时面对的）            物理层（运维与原理面对的）

Cluster（集群）
└─ Index（索引）                   └─ Node（节点 = 一个 ES 进程，有不同角色）
   └─ Document（文档，JSON）           └─ Shard（分片 = 一个完整 Lucene 索引）
      └─ Field（字段，由 Mapping 定义）      ├─ Primary（主分片，写入入口）
                                            └─ Replica（副本分片，高可用+读分流）
                                                └─ Segment（段，Lucene 最小存储单元，不可变）
```

**必须记住的三条规则**：

1. **主分片数量在建索引时定死，之后不可改**（因为路由公式依赖它，见 5.6）。副本数量随时可改。
2. 7.x 起默认每个索引 **1 主 1 副**。单节点开发时副本无处安放，索引状态会显示 yellow（不影响用，生产才有意义）。
3. 节点有角色之分：master（管集群元数据）、data（存数据）、ingest（预处理管道）、coordinating（协调请求）……小集群一个节点身兼数职，大集群才拆分职责——**这是明年第四章的内容，现在知道有这回事即可**。

## 1.6 text 与 keyword：第一个必懂的分叉

ES 里字符串有两种命运，选错是新手第一大坑：

| 类型 | 行为 | 查询方式 | 典型用途 |
| --- | --- | --- | --- |
| `text` | 写入时被**分词器**切成词，建倒排索引 | `match`（全文检索，算相关度） | 摘要、备注、商品名 |
| `keyword` | **原样整体**存储，不切分 | `term`（精确匹配）、排序、聚合 | 发票号、状态、枚举值 |

同一个字段经常两种都要：客户名既要能模糊搜（text），又要能精确分组聚合（keyword）。用 **multi-field** 一次解决：

```json
"customer_name": {
  "type": "text",
  "analyzer": "ik_max_word",
  "fields": {
    "keyword": { "type": "keyword" }
  }
}
```

查询时 `customer_name` 走全文，`customer_name.keyword` 走精确。

## 1.7 ES 的能力边界（什么时候别用它）

| 场景 | 为什么不适合 |
| --- | --- |
| 记账、资金流水、库存扣减 | 无事务，近实时，一致性模型不满足 |
| 高频全字段更新 | 更新 = 删旧插新，写放大严重 |
| 复杂多表 JOIN | 只有 nested / join 字段等弱关系能力，且代价高 |
| 写完立刻要读 | 默认 1 秒 refresh 延迟（有 realtime get 兜底，但别依赖它做业务） |
| 数据量小、查询简单的后台列表 | MySQL 加索引就够，引入 ES 平白多一套中间件要维护 |

**一句话：ES 是为「检索与聚合」特化的副本系统，别让它承担「唯一真相」的角色。**

---

# 第二章 能力导览

这一章回答一个问题：**ES 到底能干什么？** 先建立全景地图，后面上手时才知道自己在用哪块能力。

## 2.1 全文检索（看家本领）

| 能力 | 对应语法/机制 | 说明 |
| --- | --- | --- |
| 分词全文搜索 | `match` / `multi_match` | 查询词先分词再查倒排，跨多字段搜 |
| 相关度排序 | BM25 评分（`_score`） | 命中的词越稀有、出现越多、字段越短，分越高 |
| 短语搜索 | `match_phrase` | 词序必须一致，如「月度对账单」 |
| 前缀/自动补全 | `match_phrase_prefix`、`completion` suggester | 搜索框联想 |
| 模糊纠错 | `fuzzy`（编辑距离） | 用户打错字也能命中 |
| 高亮 | `highlight` | 返回 `<em>关键词</em>` 包裹的片段，前端直接渲染 |
| 同义词 | synonym graph token filter | 「发票」=「票据」 |
| 拼音搜索 | pinyin 插件 | 「fapiao」搜「发票」 |

## 2.2 结构化查询与过滤（SQL where 的平替）

`term` / `terms` / `range` / `exists` / `ids` / `prefix`，以及把它们组合起来的 `bool`（`must` / `filter` / `should` / `must_not`）。

**第一个性能要点：query context vs filter context。**

- 放在 `must` 里的子句参与**算分**（要遍历评分，慢）；
- 放在 `filter` 里的子句只判断「是/否」，**不算分且结果会被缓存**（快）。

经验法则：**凡是只用来圈定范围、不关心相关度的条件（时间区间、状态、租户 ID），一律放进 `filter`。**

## 2.3 聚合分析（Aggregation）

对标并强于 SQL 的 GROUP BY，三大类可以任意嵌套：

- **Bucket（分桶）**：`terms`（按字段分组）、`date_histogram`（按时间分桶）、`range`（按区间分桶）；
- **Metric（指标）**：`sum` / `avg` / `max` / `min` / `cardinality`（去重计数）/ `percentiles`（分位数）；
- **Pipeline（管道）**：对聚合结果再聚合，比如「月环比增长率」。

典型一句话需求 → 一条 ES 查询：「按客户分组统计 6 月开票总额，并按月份出趋势图」。这在 MySQL 里是两条慢 SQL，在 ES 里是一次聚合请求。

## 2.4 分布式能力

- **水平扩展**：加节点，分片自动 rebalancing；
- **高可用**：副本分片与主分片不会落在同一节点，挂一台不丢数据；
- **并行查询**：一次搜索被拆到所有相关分片上并行执行，协调节点合并结果；
- **近实时（NRT）**：写入默认 1 秒后可搜——这是和「实时」的区别，第五章讲原因。

## 2.5 生态与周边组件

| 组件 | 干什么 | 你现在要不要管 |
| --- | --- | --- |
| Kibana | 官方可视化平台：**Dev Tools**（调试查询的神器）、图表仪表盘 | 要，上手就用 |
| Logstash / Beats / Elastic Agent | 数据采集管道（日志、指标进 ES） | 明年做日志平台时再学 |
| ES\|QL | 新式管道查询语言：`FROM index \| WHERE ... \| STATS ...` | 了解存在即可 |
| 各语言客户端 | Java / JS / Python / Go / .NET | 你用 `@elastic/elasticsearch`（见 3.7） |
| Logstash 替代品 | 业务系统通常自己写同步代码，不依赖 Logstash | 见 3.8 |

## 2.6 AI 时代的 ES：向量与语义搜索

这是 ES 近几年最重要的演进方向，做 RAG 绕不开：

- `dense_vector` 字段 + **HNSW** 近似最近邻算法：存 embedding，做 kNN 向量检索；
- `semantic_text` 字段：自动完成「切分 → 向量化 → 检索」的封装；
- ELSER：Elastic 官方的稀疏向量语义模型，不用自己接 embedding 服务；
- **混合检索 + RRF**：BM25 关键词结果与向量结果按倒数排名融合，各取所长。

对你的意义：**做 RAG 不一定需要单独的向量数据库**（Milvus/Qdrant），中小规模下 ES 一个顶俩（关键词 + 向量召回）。

## 2.7 典型应用场景盘点

1. **站内/电商搜索**：商品搜索、筛选、排序、联想——最经典的用途（Vendure 这类电商系统就深度依赖它）；
2. **日志与可观测性（ELK）**：应用日志进 ES，Kibana 检索 + 告警——每个后端迟早要搭；
3. **业务报表与聚合分析**：运营看板、统计报表的实时聚合层；
4. **RAG / AI 搜索**：向量召回 + 关键词召回的混合检索底座；
5. **安全分析（SIEM）**：审计日志检索——财务系统的操作日志同样适用。

## 2.8 映射到你的财务系统

| 业务痛点 | ES 能力 | 落地形态 |
| --- | --- | --- |
| 对账单按摘要/客户名模糊搜，MySQL LIKE 扛不住 | 全文检索 + IK 中文分词 | `invoices` 索引，MySQL 同步 |
| 报表 SQL 大量连表聚合查 10 秒 | 预聚合成宽表进 ES，用 Aggregation 出数 | 「搜索型报表」走 ES，「精确核对」走 MySQL |
| 操作审计日志越攒越多 | ELK 日志方案 | Filebeat/应用直推 → ES → Kibana |
| 客服/财务助理问「某客户上季度开了多少票」 | 聚合 + 未来可接自然语言查询 | 报表 Agent 的查询后端 |

> 注意数据敏感性：进 ES 的财务数据要考虑字段级脱敏与访问控制（ES 的安全特性/前置网关），别把含银行账号的原文直接怼进去。

---

# 第三章 快速上手

目标：**在你的 Ubuntu 虚拟机上，用 Docker 半天搭好 ES + Kibana + 中文分词，并跑通「建索引 → 写数据 → 查 → 聚合」全流程。** 案例主线就用你熟悉的财务发票数据。

## 3.1 部署方案选择

你的环境（VMware 里的 Ubuntu VM，分 6 核 / 32G / SSD）跑单节点绰绰有余。方案：

- **开发学习**：Docker Compose 单节点 ES 8.19 + Kibana 8.19 + IK 中文分词（本章方案）；
- **为什么不用 9.4**：9.x 是最新，但 IK 分词器等社区插件的版本跟进、网上教程存量，8.19 都更稳；且 8.19 官方支持到 2027-07[^1^]，学完再升不迟。核心 API 两个大版本基本一致；
- **生产环境别照抄**：本章关闭了安全认证（仅限内网开发机），生产必须开启 TLS + 账号密码（8.x 起默认强制开启，本文为了聚焦检索本身手动关闭）。

## 3.2 准备：Docker 与内核参数

```bash
# 1) 安装 Docker（如已装跳过）
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER   # 重新登录后免 sudo

# 2) ES 要求增大虚拟内存映射数（不改会启动失败/告警）
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

## 3.3 编写 Dockerfile（带 IK 中文分词器）

IK 分词器版本号必须与 ES 完全一致，构建前到 release 页核对：`https://release.infinilabs.com/analysis-ik/stable/`。

```dockerfile
# Dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.19.0
RUN bin/elasticsearch-plugin install --batch \
    https://get.infini.cloud/elasticsearch/analysis-ik/8.19.0
```

> 拉不动国外镜像时，可在 Docker  daemon 配置镜像加速器；或改用阿里云等镜像仓库里别人同步好的 `elasticsearch:8.19.0`。

## 3.4 docker-compose.yml

```yaml
services:
  elasticsearch:
    build: .
    container_name: es-dev
    environment:
      - discovery.type=single-node        # 单节点模式
      - xpack.security.enabled=false      # 仅本地开发关闭！生产必须开启
      - ES_JAVA_OPTS=-Xms2g -Xmx2g        # 堆内存；规则见下方说明
      - TZ=Asia/Shanghai
    ports:
      - "9200:9200"                        # HTTP API
      - "9300:9300"                        # 节点间通信（单机其实用不到，映射无妨）
    volumes:
      - esdata:/usr/share/elasticsearch/data
    networks:
      - elastic

  kibana:
    image: docker.elastic.co/kibana/kibana:8.19.0
    container_name: kibana-dev
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - I18N_LOCALE=zh-CN
      - TELEMETRY_OPTIN=false
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - elastic

volumes:
  esdata:

networks:
  elastic:
    driver: bridge
```

**堆内存规则**（面试也常考）：堆设为物理内存的一半、且不超过 ~26G（超过会失去压缩指针优化反而变慢）；剩下的一半留给操作系统 page cache——ES 大量依赖文件系统缓存，这是它快的秘诀之一。开发机 2G 足够。

启动与验证：

```bash
docker compose up -d
docker compose logs -f elasticsearch   # 看到 started 即成功

curl http://localhost:9200
# 返回 {"tagline" : "You Know, for Search", ...} 即正常

curl http://localhost:9200/_cluster/health?pretty
# status 为 yellow 是正常的（单节点副本无处分配），green 更好
```

打开 `http://<虚拟机IP>:5601` → 左侧菜单 **Dev Tools**，后面所有请求都建议在这里执行（有自动补全，不用记 curl 转义）。宿主机浏览器访问不了的话，检查 VMware 网络模式（桥接/NAT 端口转发）与 Ubuntu 防火墙。

## 3.5 核心 API 实战：发票索引全流程

以下请求全部在 Kibana Dev Tools 里执行。

### ① 建索引 + 显式 Mapping

```json
PUT /invoices
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0          // 单节点开发设 0，状态直接 green
  },
  "mappings": {
    "properties": {
      "invoice_no":    { "type": "keyword" },                  // 发票号：精确匹配
      "customer_name": {                                       // 客户名：模糊搜 + 精确聚合
        "type": "text",
        "analyzer": "ik_max_word",
        "search_analyzer": "ik_smart",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "summary":       { "type": "text", "analyzer": "ik_max_word" },
      "amount":        { "type": "scaled_float", "scaling_factor": 100 },  // 金额别用 float
      "status":        { "type": "keyword" },                  // OPEN / PAID / OVERDUE
      "invoice_date":  { "type": "date", "format": "yyyy-MM-dd" },
      "items": {                                               // 发票行项目：嵌套
        "type": "nested",
        "properties": {
          "goods_name": { "type": "text", "analyzer": "ik_max_word" },
          "quantity":   { "type": "integer" },
          "price":      { "type": "scaled_float", "scaling_factor": 100 }
        }
      }
    }
  }
}
```

两个设计细节：

- **金额用 `scaled_float` 而不是 `float/double`**：浮点数算钱会出精度问题，`scaled_float` 内部按 long 存储（乘 100），既精确又比 `double` 省空间——财务系统尤其注意。
- **`nested` 类型**：普通 object 数组会被「拍平」导致跨对象错误匹配，`nested` 把每个数组元素存成隐藏独立文档，行项目条件才不会串行。代价是写入更贵，这就是 1.3 说的「JOIN 很弱」。

### ② 写入数据（单条 + 批量）

```json
POST /invoices/_doc/INV-2026-0001        // 自定义 ID，重复 PUT 会覆盖（幂等）
{
  "invoice_no": "INV-2026-0001",
  "customer_name": "基恩士（上海）有限公司",
  "summary": "2026年6月技术服务费对账单",
  "amount": 12500.50,
  "status": "PAID",
  "invoice_date": "2026-06-15",
  "items": [
    { "goods_name": "技术服务费", "quantity": 1, "price": 12500.50 }
  ]
}

POST /_bulk                              // 批量：永远优先用 bulk，省网络往返
{ "index": { "_index": "invoices", "_id": "INV-2026-0002" } }
{ "invoice_no": "INV-2026-0002", "customer_name": "上海精密制造有限公司", "summary": "6月设备采购发票", "amount": 88000.00, "status": "OPEN", "invoice_date": "2026-06-20", "items": [ { "goods_name": "传感器", "quantity": 40, "price": 2200.00 } ] }
{ "index": { "_index": "invoices", "_id": "INV-2026-0003" } }
{ "invoice_no": "INV-2026-0003", "customer_name": "基恩士（上海）有限公司", "summary": "5月技术服务费对账单", "amount": 11900.00, "status": "OVERDUE", "invoice_date": "2026-05-15", "items": [ { "goods_name": "技术服务费", "quantity": 1, "price": 11900.00 } ] }
```

> 写完立刻搜可能搜不到——refresh 默认 1 秒一次（近实时）。测试时可 `POST /invoices/_refresh` 强制刷新，**生产代码里禁止这么做**。

### ③ 读 / 改 / 删

```json
GET /invoices/_doc/INV-2026-0001

POST /invoices/_update/INV-2026-0001     // 部分更新（读-改-写，有乐观锁）
{
  "doc": { "status": "PAID" }
}

POST /invoices/_update/INV-2026-0001?if_seq_no=5&if_primary_term=1   // 乐观并发控制
{ "doc": { "status": "PAID" } }

DELETE /invoices/_doc/INV-2026-0003
```

并发更新冲突时返回 409。业务上「先查出来改完再写回」的场景，带上 `if_seq_no + if_primary_term` 防止覆盖别人的修改——和你之前整理的并发知识里的 CAS 是同一思想。

### ④ 查询全家桶

```json
// 1. 全文检索：「对账单」
GET /invoices/_search
{
  "query": { "match": { "summary": "对账单" } },
  "highlight": { "fields": { "summary": {} } }
}

// 2. 多字段搜：一个关键词同时搜客户名和摘要
GET /invoices/_search
{
  "query": {
    "multi_match": {
      "query": "基恩士 6月",
      "fields": [ "customer_name^2", "summary" ]   // ^2：客户名字段权重翻倍
    }
  }
}

// 3. 精确匹配 + 范围过滤（filter 不算分、走缓存，快！）
GET /invoices/_search
{
  "query": {
    "bool": {
      "must":   [ { "match": { "customer_name": "基恩士" } } ],
      "filter": [
        { "term":  { "status": "OPEN" } },
        { "range": { "invoice_date": { "gte": "2026-06-01", "lte": "2026-06-30" } } },
        { "range": { "amount": { "gte": 10000 } } }
      ],
      "must_not": [ { "term": { "status": "CANCELLED" } } ]
    }
  },
  "sort": [ { "invoice_date": "desc" } ],
  "from": 0, "size": 20,
  "_source": [ "invoice_no", "customer_name", "amount", "invoice_date" ]
}
```

记忆口诀：**must 算分、filter 过滤、should 加分、must_not 排除。**

### ⑤ 聚合：一条查询出一张报表

「按客户统计开票总额 + 每月趋势」：

```json
GET /invoices/_search
{
  "size": 0,                          // 不要文档明细，只要聚合结果
  "aggs": {
    "by_customer": {
      "terms": { "field": "customer_name.keyword", "size": 10 },
      "aggs": {
        "total_amount": { "sum": { "field": "amount" } },
        "by_month": {
          "date_histogram": { "field": "invoice_date", "calendar_interval": "month" },
          "aggs": { "month_amount": { "sum": { "field": "amount" } } }
        }
      }
    },
    "overall_amount": { "sum": { "field": "amount" } },
    "customer_count": { "cardinality": { "field": "customer_name.keyword" } }
  }
}
```

把这条查询和你在 MySQL 里写的「连表 + GROUP BY + 排序」对比，就是 ES 在报表场景的价值。

### ⑥ 分词调试（中文搜索的灵魂）

```json
POST /_analyze
{ "analyzer": "ik_max_word", "text": "6月技术服务费对账单" }

POST /_analyze
{ "analyzer": "ik_smart", "text": "6月技术服务费对账单" }
```

- `ik_max_word`：切得最细（「技术服务费」→ 技术/服务/服务费/技术服务费…），**建索引时用**，召回率高；
- `ik_smart`：切得最粗（「技术服务费」整词），**搜索时用**，精度高。
- 业务词切不出来（如「对账单」被切碎）→ 给 IK 加自定义词典，挂载 `config/analysis-ik/custom.dic`。

## 3.6 在 Node.js / NestJS 里使用

```bash
npm i @elastic/elasticsearch@8
```

```ts
import { Client } from '@elastic/elasticsearch';

interface InvoiceDoc {
  invoice_no: string;
  customer_name: string;
  summary: string;
  amount: number;
  status: 'OPEN' | 'PAID' | 'OVERDUE';
  invoice_date: string;
}

const client = new Client({ node: 'http://192.168.x.x:9200' }); // 你的虚拟机 IP

// 搜索（filter 算分分离的写法照搬到代码里）
const res = await client.search<InvoiceDoc>({
  index: 'invoices',
  query: {
    bool: {
      must: [{ match: { customer_name: '基恩士' } }],
      filter: [{ range: { invoice_date: { gte: '2026-06-01' } } }],
    },
  },
  size: 20,
});
const rows = res.hits.hits.map((h) => h._source!);

// 批量同步（MySQL → ES 的同步任务核心就是这么个循环）
await client.bulk({
  operations: invoicesFromMysql.flatMap((inv) => [
    { index: { _index: 'invoices', _id: inv.invoice_no } },
    inv,
  ]),
  refresh: false, // 批量灌数据时别每批都刷
});
```

在 NestJS 里的常规做法：封装一个 `ElasticsearchService`（`OnModuleInit` 里建连接、检查/创建索引 mapping），业务模块注入使用；官方也有 `@nestjs/elasticsearch` 包，本质就是把这个 Client 包成可注入的 Provider，看一遍源码就懂。

## 3.7 MySQL → ES 的数据同步策略

三种主流方案，按一致性要求与改造成本选：

| 方案 | 做法 | 优点 | 缺点 | 适用 |
| --- | --- | --- | --- | --- |
| 应用双写 | 业务代码写完 MySQL 再写 ES（或发 MQ 后消费写 ES） | 实时、简单可控 | 侵入业务代码；双写失败要兜底（本地消息表/重试） | 中小型系统首选 |
| MQ 异步 | 写库后发事件，消费者同步 ES | 解耦、可重放 | 有秒级延迟 | 有 MQ 基础设施时 |
| Canal 监听 binlog | 伪装成 MySQL 从库解析 binlog，推 ES | 业务零侵入 | 多一套中间件要运维 | 老系统改造、表多 |

你的财务系统建议：**业务代码双写 + MQ 兜底重试**，发票这种低频写入场景足够，还能当简历项目。

## 3.8 新手高频踩坑清单（每条都是血泪）

1. **Mapping 字段类型建好后不可改**，只能 `reindex` 到新索引 → 建索引前想清楚，金额/日期尤其。
2. **text 字段默认不能排序和聚合**（会报 fielddata 错）→ 用 `.keyword` 子字段。
3. **深度分页**：`from + size > 10000` 直接报错 → 用 `search_after`（配合 `sort` + PIT），滚动导数据用 `scroll`/PIT 快照。
4. **刚写完查不到**：NRT 1 秒延迟，别在「写后立刻查」的流程里依赖搜索。
5. **前置通配符** `*关键字` 查询极慢（倒排索引的逆向）→ 换 `match` 或 ngram 字段。
6. **字段爆炸**：dynamic mapping 默认开启，JSON 里乱塞字段会把 mapping 撑爆（默认上限 1000）→ 生产关 dynamic 或设 `dynamic: "strict"`。
7. **bulk 不是越大越好**：单批 5~15MB、几千条为宜，压测调优。
8. **单节点 yellow 别慌**：副本无处分配而已，`number_of_replicas: 0` 即可 green。
9. **删除索引不可恢复**：`DELETE /invoices` 没有回收站。生产环境要禁通配删除：`action.destructive_requires_name: true`。
10. **把 ES 当主库**：宕机恢复依赖 translog 与副本，单节点丢数据不是传说——重要数据真相永远在 MySQL。

---

# 第四章 系统进阶学习路线（明年深入）

> 使用方式：第三章跑通后，本章先**只读 4.1 的总览**，心里有一张地图；明年按 L2 → L3 → L4 的顺序逐个击破。每个主题都标注了「什么时候该学」。

## 4.1 学习路径总览

| 层级 | 目标 | 核心主题 | 建议时机 |
| --- | --- | --- | --- |
| L1 会用 | 建索引、写数据、查、聚合（本文第三章） | Query DSL、Mapping、客户端 | 已完成 |
| L2 用好 | 数据建模与查询进阶，知道每种选择的代价 | 见 4.2 | 财务系统接入 ES 时 |
| L3 调优 | 写入/查询性能优化，能看懂慢在哪 | 见 4.3 | 数据量上来或面试前 |
| L4 运维 | 集群规划、生命周期、监控、安全 | 见 4.4 | 明年系统学习时 |
| L5 原理 | 读 Lucene/ES 源码级机制 | 见 4.5 | 面试冲高阶岗位前 |

## 4.2 L2：建模与查询进阶

- **关系建模三选一的权衡**：`nested`（一对多、子对象独立查询）vs `join` 字段（父子文档、真正的一对多关系，慎用）vs 反范式宽表冗余（**ES 世界的首选**）；
- `flattened` 类型：整段 JSON 当一个字段索引，应对字段名不确定的动态结构（防字段爆炸的另一条路）；
- **运行时字段 `runtime_mappings`**：不改索引、查询时动态生成字段，适合临时统计口径；
- **Index Sorting**：写入时就排好序，让特定排序查询快一个量级；
- 同义词体系：`synonym_graph` 过滤器 + 词典热更新；
- `percolator`（反向索引）：「把查询存起来，文档来了匹配查询」——做订阅/告警；
- `search template`：查询模板化，前后端解耦；
- **深度分页标准方案**：PIT（Point In Time）+ `search_after`；
- ES|QL：新管道语法，官方主推方向，明年大概率已是主流写法。

## 4.3 L3：性能调优

- **写入优化**：bulk 批次调参、灌数期间 `refresh_interval: -1` + 副本 0、写完再恢复 + `forcemerge`；
- **查询优化**：`profile: true` 定位慢查询、`filter` 上下文复用缓存、避免高基数 terms 聚合、`wildcard` 前置通配替代方案；
- **慢日志**：`index.search.slowlog` / `index.indexing.slowlog` 阈值化记录；
- **缓存体系三层**：Request cache（分片级聚合结果）、Query cache（filter bitset）、Page cache（OS 文件缓存）——调优前先想清楚动的是哪层；
- **段合并调优**：merge 线程、磁盘 IO 与写入吞吐的拉扯；
- 字段瘦身：关掉不需要的 `_source` 字段、`index: false`、`doc_values: false` 各自的取舍。

## 4.4 L4：集群规划与运维

- **分片规划经验值**：单分片数据量控制在 10~50GB；分片总数与堆内存挂钩（每 GB 堆约 20 个分片内）；时序数据按时间 rollover 而不是固定大索引；
- **ILM（索引生命周期管理）+ Data Stream**：hot → warm → cold → delete 自动流转，日志/流水类数据的标配；
- **节点角色拆分**：专职 master、data、coordinating，voting_only 防脑裂；
- **快照与恢复**：`snapshot` 到 S3/MinIO，灾难恢复演练；
- **滚动升级**：先升数据节点后升 master 的顺序、停写与 shard allocation 开关；
- **监控**：Stack Monitoring / Prometheus exporter，关注 JVM 老年代占用、reject 率（线程池打满）、磁盘水位（默认 85%/90%/95% 三档洪水位）；
- **安全**：内置用户/角色 RBAC、API Key、SSO 对接、字段级与文档级安全（财务数据重点）。

## 4.5 L5：原理深挖

- 通读第五章后，进阶书单：Lucene 的段文件格式（.tim/.doc/.pos/.fdt/.dvd 各存什么）；
- 并发模型：`_seq_no` / `_primary_term` 如何做副本同步与恢复；
- BM25 调参（k1/b）与 `function_score` 自定义排序（如「金额大且时间近的发票排前面」）；
- 直接读 ES 源码的入口：`IndexService` / `InternalEngine` / `TransportSearchAction`。

## 4.6 推荐资料

| 资料 | 用法 |
| --- | --- |
| 官方文档 Guide（elastic.co） | 第一权威来源，查参数必备；9.x 文档已按新架构重组，写得很友好 |
| 阮一鸣《Elasticsearch 核心技术与实战》（极客时间） | 中文体系课，L2~L4 覆盖最好 |
| 《Elasticsearch in Action, 2nd Edition》 | 英文进阶书，原理与实战均衡 |
| 张俊林《这就是搜索引擎》 | 不针对 ES，讲通用搜索引擎原理，配合第五章读 |
| Elastic 官方 Blog / Labs | 新特性（向量、ES\|QL）第一手解读 |
| medcl（ES 中文社区/INFINI Labs） | IK 分词器作者社区，中文资料多 |

## 4.7 面试视角：高频问题清单

学完本文，你应该能回答：ES 为什么快？为什么是近实时？倒排索引结构？深度分页怎么解决？text 和 keyword 区别？怎么设计 MySQL→ES 同步的一致性？

进阶后还要能回答：脑裂是什么、7.x 后怎么解决？BM25 和 TF-IDF 的区别与参数？分片怎么规划？写入/搜索的完整链路？reindex 不停机怎么做？——**这些问题的答案骨架都在第五章，明年往骨架上填肉。**

---

# 第五章 底层原理简述

> 目标：不写一行 Lucene 代码，也能在纸上画出 ES 的读写全貌。

## 5.1 一次写入的完整旅程

```
客户端 PUT /invoices/_doc/1
   │
   ▼
协调节点：按 路由 = hash(_id) % 主分片数 找到目标主分片所在节点
   │
   ▼
主分片（Lucene）：
   1) 写入内存 Buffer（同时构建倒排索引）
   2) 追加 translog（WAL，防宕机丢数据）
   │
   ├─ 每 1 秒 refresh：Buffer 生成一个新的 Segment，落进 OS page cache
   │     → 此刻起文档「可被搜索」（近实时的由来）
   │
   ├─ 副本分片同步复制同样的操作
   │
   └─ translog 攒够（默认 512MB）或定时触发 flush：
        fsync 落盘 + 提交点 + 清空 translog（真正的「持久化」）
   │
   ▼
后台 merge：大量小 Segment 定期合并成大 Segment，
            顺带物理删除被标记的文档（.del 墓碑清理）
```

记住四个动词的层次：**refresh（1s，可见性）→ translog（每条，安全性）→ flush（持久化）→ merge（整理）**。面试问「ES 会不会丢数据」：默认配置下 refresh 后数据已在 page cache，节点宕机丢最多 1 秒（除非 translog 设为异步 fsync，那丢最多 5 秒）——可回答「可配，有取舍」。

## 5.2 倒排索引的内部结构

一个 Segment 里，一个 text 字段的索引大致长这样：

```
Term Dictionary（词表）
  "对账单" ──FST──▶ Posting List（倒排链）
                     ├─ doc 1（词频 2，位置 [3,7]）
                     └─ doc 3（词频 1，位置 [0]）
```

三个关键数据结构：

1. **FST（Finite State Transducer）**：词表的存储结构，类似前缀树但更省内存，可常驻内存。作用是「词 → 倒排链位置」的快速映射，支持前缀查找；
2. **Posting List**：文档 ID 升序数组 + 词频 + 位置。压缩手段：差值编码（存 delta）+ FOR（Frame Of Reference 分块定长编码）；需要求交集时转 **Roaring Bitmap**（位图交并运算极快）+ **跳表**加速两个不等长列表的交集；
3. **位置与词频**：`match_phrase` 需要位置信息，`BM25` 评分需要词频——所以它们都存在倒排链里。

**同一份数据，多种存储视角**（理解这个就看懂了 ES 的存储设计）：

| 结构 | 存什么 | 服务什么操作 | 类比 |
| --- | --- | --- | --- |
| 倒排索引 | 词 → 文档 | 检索、算分 | 书末索引 |
| Stored Fields（`_source`） | 原始 JSON | 取回原文展示 | 行存 |
| Doc Values | 列式存储的字段值 | 排序、聚合、脚本 | 列存（如 ClickHouse 的思路） |
| Points（BKD 树） | 数值/日期/地理 | range 查询 | 多维索引 |

这解释了三个现象：**为什么排序聚合要用 keyword/数值字段**（走 doc values）；**为什么 `_source` 可以只取部分字段**（stored fields 按列块压缩）；**为什么 range 查询在数值上很快**（BKD 树不是倒排）。

## 5.3 为什么 ES 快

1. 倒排索引把「搜内容」变成「查词表 + 集合交并」；
2. FST 让词表查找常驻内存、接近 O(词长)；
3. Posting list 压缩 + Roaring Bitmap 让交并运算可以在 CPU cache 里飞；
4. filter 上下文的 bitset 缓存：第二次同样的过滤条件是 O(1)；
5. 重活交给 OS page cache，堆内存压力小；
6. 查询扇出到所有分片并行执行——数据越多机器越多，单机复杂度不变。

## 5.4 近实时与数据安全的取舍

- **为什么不能实时**：每次写入都生成磁盘 Segment 代价太大（fsync 是 ms 级），所以用「内存 buffer + 每秒 refresh 到 page cache」折中——可见性延迟 1 秒，换来写入吞吐数量级的提升；
- **为什么不怕宕机**：translog 是每条追加的 WAL，宕机后重放恢复 buffer；
- **`GET /_doc/{id}` 是实时的**：按 ID 查直接走 translog + 内存，不经倒排索引——所以「按 ID 回查」可以依赖，「按条件搜」不行；
- 刷新间隔可调：`refresh_interval: 30s`（日志场景提吞吐）或 `-1`（灌数时暂停）。

## 5.5 段不可变设计（一以贯之的思想）

Segment 一旦写出**永不修改**，这是 Lucene 的根基设计，推导出 ES 的几乎所有「怪癖」：

- **更新 = 标记删除旧版本 + 新增**：所以高频更新写放大严重；
- **删除 = .del 墓碑标记**，merge 时才物理清除：所以删了数据磁盘不立刻释放；
- **不可变 → 无锁读**：查询不用加锁，读写并发简单高效；
- **不可变 → 缓存友好**：Segment 级缓存（filter bitset）永不失效，直到被 merge；
- 文档版本 `_version` / `_seq_no` 提供乐观并发，不需要悲观锁。

这个思想和 Kafka 的日志不可变、LSM-Tree（RocksDB）一脉相承——**「用顺序写 + 不可变文件换性能」是你后端进阶路上会反复见到的范式**。

## 5.6 分布式机制

**路由**：`shard = hash(routing) % 主分片数`，默认 routing 是 `_id`。这解释了「主分片数不可改」——改了，所有已有文档的地址全错。自定义 routing（如按 customer_id）可让同一客户的数据集中在一个分片，查询只打一个分片，但也可能数据倾斜。

**写入**：协调节点 → 主分片写 → 同步复制到副本（默认等多数派成功才返回）。

**搜索两阶段（Query Then Fetch）**：

```
Query 阶段：协调节点把查询广播给所有相关分片
            → 每个分片各自算分，返回 from+size 个 Top 结果（只有 doc_id 和分数）
Reduce：协调节点全局合并排序，确定最终要取的文档列表
Fetch 阶段：按需回各分片取 _source，拼装返回
```

**深度分页为什么灾难**：第 10000 页意味着每个分片都要算前 10010 条再扔掉 10000 条，N 个分片就是 N 倍浪费——所以官方硬限制 10000，让你用 `search_after`（游标式，不回头）。

**高可用与脑裂**：主分片挂了，副本提升为主；master 挂了，多数派节点重新选举。老版本脑裂靠 `minimum_master_nodes` 手工配置，**7.x 起改用类 Raft 的投票配置自动管理**，多数派存活才可用——面试题「脑裂怎么解决」的标准答案。

## 5.7 相关度评分：从 TF-IDF 到 BM25

直觉：**一个词在本文档出现越多（TF 高）、在全体文档中越稀有（IDF 高）、所在字段越短，这篇文档越相关。**

BM25（5.0 起默认）在 TF-IDF 上做了两个修正：

- TF 收益递减（饱和曲线，参数 `k1` 控制，默认 1.2）：词出现 100 次不比 10 次「十倍相关」；
- 字段长度归一化（参数 `b`，默认 0.75）：长文档天然词多，要压分。

实用技巧：任何搜索请求加 `"explain": true` 看每个文档的算分明细——调试「为什么这条排这么靠前」的唯一正确姿势。`function_score` 可以把业务因子（时间衰减、金额权重）乘进分数。

## 5.8 原理一句话总结

> ES 用「分词 + 倒排索引」把内容检索变成集合运算，用「段不可变 + 内存 buffer + translog」在近实时与高吞吐之间取平衡，用「分片路由 + 副本 + 多数派选举」换取水平扩展与高可用——所有特性都是这三组取舍的推论。

---

# 附录 A：常用命令速查

```bash
# 集群与节点
GET /_cluster/health?pretty
GET /_cat/nodes?v&h=name,role,heap.percent,ram.percent,cpu,disk.used_percent
GET /_cat/indices?v&s=store.size:desc        # 按大小排列索引
GET /_cat/shards?v                            # 分片分布

# 索引管理
GET /invoices/_mapping                        # 看 mapping
GET /invoices/_settings
PUT /invoices/_settings { "refresh_interval": "30s" }
POST /invoices/_refresh                       # 测试时强制可见（生产勿用）
POST /invoices/_forcemerge?max_num_segments=1 # 只读索引瘦身
POST /_reindex { "source": {"index":"invoices"}, "dest": {"index":"invoices_v2"} }

# 调试
GET /invoices/_search { "profile": true, "query": {...} }   # 慢查询解剖
GET /invoices/_search { "explain": true, ... }              # 算分解剖
GET /_nodes/hot_threads                                     # CPU 热点
GET /_tasks?actions=*search&detailed                        # 跑着的查询
```

# 附录 B：与 MySQL 的思维切换清单

| 你在 MySQL 的习惯 | 到 ES 应该换成 |
| --- | --- |
| 先设计三范式表结构 | 先设计「查询长什么样」，反着推 mapping，接受冗余 |
| JOIN 多张表出结果 | 宽表 / nested / 应用层拼装 |
| 事务保证一致性 | MySQL 为准，ES 接受秒级延迟 + 对账补偿 |
| 全表更新某字段 | reindex 或接受 `update_by_query` 的代价 |
| LIMIT 100000, 20 | search_after 游标 |
| COUNT/GROUP BY 大表 | ES 聚合（甚至预聚合 transform） |

---

[^1^]: 版本与支持周期数据来自 endoflife.date（2026-07 更新）：9.4.3 为最新（2026-06-25 发布），8.19 支持至 2027-07-15。https://endoflife.date/elasticsearch
