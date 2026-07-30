# ERPNext FI/AR 模块深度调研文档集

> 调研对象：**ERPNext v16 / Frappe Framework v16**（v16 于 2026 年 1 月发布；调研基准日 2026-07-28，当前补丁线 v16.x）
> 调研方法：官方用户手册 + GitHub `version-16` 分支一手证据（DocType JSON、代码、Release Notes、PR）+ 多维度交叉验证
> 读者定位：自研财务系统（应收/对账/开票报表）的全栈工程师，技术栈 NestJS + Prisma + PostgreSQL + React/TanStack

本套文档回答五个问题：**页面怎么设计、流程怎么跑完、数据怎么建模、架构怎么保一致、我的系统该抄什么**。

## 章节导航

| 章 | 文件 | 内容 | 中文字数 |
|---|---|---|---|
| 第 1 章 | [01-module-map-and-page-design.md](./01-module-map-and-page-design.md) | FI 模块地图、List/Form/Report 三种页面形态解剖、AR 五个关键页面逐个拆解、v16 UI 变化 | 7294 |
| 第 2 章 | [02-business-processes.md](./02-business-processes.md) | **【重点】** 应收主线闭环逐步操作（配置→开票→收款→核销→报表→期末）+ 状态机 + 八条支线（预收/分期/红冲/取消修改/催款/尾差/多币种/反核销） | 10081 |
| 第 3 章 | [03-data-model.md](./03-data-model.md) | **【重点中的重点】** 单据层 10 个 DocType 字段级拆解、GL/PLE 双层台账、outstanding 口径、核销即重建、三个设计问题解答 | 10634 |
| 第 4 章 | [04-architecture-and-ha.md](./04-architecture-and-ha.md) | Frappe 运行时架构、元数据驱动、提交事务/不可变台账/重过账队列/三级时间闸门/幂等防线、DuckDB 财报提速、部署形态 | 8663 |
| 第 5 章 | [05-mapping-to-your-system.md](./05-mapping-to-your-system.md) | 全部认知翻译为自研系统设计：Prisma schema、事务边界、一致性机制三档取舍（抄/简化抄/不抄）、页面落地、400 万明细报表策略 | 5926 |

## 推荐阅读路径

- **时间紧（30 分钟）**：第 2 章 2.2 主线闭环 + 第 3 章 3.5 三个设计问题 → 拿到 ERPNext 应收的灵魂
- **建模型前**：第 3 章全章 + 第 5 章 5.1 → 直接照着设计 Prisma schema
- **写页面前**：第 1 章 + 第 5 章 5.4
- **性能焦虑时**：第 4 章 4.4 + 第 5 章 5.5

## 全局术语表

| 术语 | 含义 |
|---|---|
| DocType | Frappe 的元数据类型定义，一张 DocType ≈ 一张表 + 表单 + 列表 + 权限 + API |
| docstatus | 单据状态字段：0=草稿（Draft）、1=已提交（Submitted）、2=已取消（Cancelled） |
| GL Entry | 总账分录，复式记账的最终落点，只增不改 |
| Payment Ledger Entry (PLE) | 收付台账（v14 引入），面向往来单位的核销追踪层，AR/AP 报表的数据源 |
| outstanding_amount | 发票未清金额，PLE 实时聚合 + 事件驱动回写的冗余投影 |
| Payment Entry Reference | 收付款单的核销引用子表，单据对单据 + 分摊金额的多对多模型 |
| Repost Accounting Ledger (RAL) | 重过账队列，背日补单时异步"先反向后重记"后续台账 |
| Period Closing Voucher (PCV) | 期末关账凭证，结平损益并落 ACB 快照；v16 起后台化（Process PCV） |
| Account Closing Balance (ACB) | 结账余额快照表（v14 引入），供财务报表快速确定期初余额 |
| Credit Note | 红字发票（Sales Invoice `is_return=1`），部分冲销/须留痕场景使用 |
| Accounts Frozen Date | 账务冻结日期（v16 位于 Company），冻结日前的账务不可增改 |

## 阅读约定

- 所有版本差异均显式标注归属（v14 / v15 / v16）
- 引用采用章内独立编号 `[^N^]`，每章末尾附来源清单（官方文档 / GitHub 一手来源为主）
- 带 ⚠️ 的内容为待验证项，不作为确定事实
- 流程图、状态机、ER 图均为 Mermaid，GitHub 可直接渲染

## 调研可信度说明

本套文档经多维度交叉验证：6 路并行调研产出一手证据 brief → 交叉验证分级（高/中/低置信）→ 冲突定向裁决。其中最重要的裁决：v16.28 财报提速的数据源为 **DuckDB 快照报表**（GL/TB/BS/P&L 四张），ACB 为 v14 起既有的期初快照机制、两者叠加；**AR/AP 报表未被该提速覆盖**，仍基于 PLE 实时聚合。中间产物（调研 brief、交叉验证报告、冲突裁决）不在本目录，如需溯源可向作者索取。
