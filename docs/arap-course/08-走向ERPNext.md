# 第 8 课 · 从 Frappe Books 到 ERPNext：概念迁移与代码阅读路径

> 进阶课：把 7 课学到的概念映射到工业级 ERP，给你一份 ERPNext 代码的"导航图"。
> 学到这里，你已经懂了 AR/AP 的领域语言。这一课解决的是"大系统怎么读"。

---

## 一、为什么有这一课

Frappe Books 约 40 个核心模型，每个几百行 TypeScript；ERPNext 的 `accounts` 模块光 `sales_invoice.py` 就几千行，外加多公司、多币种、库存、税则、权限……直接从 ERPNext 入门会被淹没。但你现在已经掌握了**领域概念的骨架**——大系统多出来的 90% 代码，都是在处理你已知概念的"复杂情况"。这一课教你识别骨架、跳过赘肉。

## 二、概念映射表：你认识的每个东西在 ERPNext 里叫什么

| 课程概念（Frappe Books） | ERPNext | 说明 |
|------|------|------|
| `SalesInvoice` | DocType `Sales Invoice` | 同名同职责，多了税则模板、多币种、关联销售订单/发货单 |
| `PurchaseInvoice` | DocType `Purchase Invoice` | 同上 |
| `Payment`（type=Receive/Pay） | DocType `Payment Entry` | 拆成独立单据类型，支持预收预付、内部转账、差额核销（write-off） |
| `PaymentFor`（分摊子表） | `Payment Entry Reference` | 同名思路：哪张发票分多少 |
| `AccountingLedgerEntry` | **两张表：`GL Entry` + `Payment Ledger Entry`** | 关键架构差异，见下文 |
| `Party`（role 区分） | `Customer` / `Supplier` 两个独立 DocType | ERPNext 拆开了，外加 `Address`/`Contact` 独立建模 |
| `Tax` | `Sales/Purchase Taxes and Charges Template` + 子表 | 税率模板化，可组合多税目、按行/按单计税 |
| 退货单（isReturn） | Sales Invoice `is_return = 1` + `return_against` 关联原票 | 完全一致的红冲思路 |
| General Ledger 报表 | `General Ledger` report | 同名 |
| （无独立账龄报表） | `Accounts Receivable` / `Accounts Payable` report | **账龄分析的工业级实现，你做报表必看** |
| （无对账工具） | `Payment Reconciliation` 工具 | **批量发票↔收付款匹配，你做对账模块必看** |
| （手工出对账单） | `Process Statement of Accounts` | 批量生成客户对账单 |
| 科目表 | `Chart of Accounts`（按公司一棵树） | 概念相同 |

### 重点展开：GL Entry vs Payment Ledger Entry（v13 架构升级）

Frappe Books 只有一张台账表，账龄报表要扫"发票+付款分摊"推导。ERPNext v13 之后拆成两张：

- **GL Entry**：总账分录（对应 AccountingLedgerEntry），服务三大报表
- **Payment Ledger Entry**：专为收付款/账龄设计的台账——发票过账记一条，每次收款核销记一条，字段直接带"未清金额、到期日"

**效果：账龄报表只扫 Payment Ledger Entry 一张表，不用 join 全量分录和单据。** 这是"报表性能靠台账分层"的教科书案例——直接对照你公司开票报表慢不慢的根因。

## 三、ERPNext 代码阅读路径（按依赖顺序）

把 ERPNext clone 到工作区后按此顺序读，每步都带着课程概念去找对应物：

```
第 1 站  erpnext/accounts/doctype/sales_invoice/sales_invoice.py
         → 找 on_submit → make_gl_entries()，对应第 3 课"开票生成分录"

第 2 站  erpnext/controllers/accounts_controller.py
         → 所有发票单据的公共基类，对应第 4 课"AR/AP 对称复用"

第 3 站  erpnext/accounts/doctype/payment_entry/payment_entry.py
         → 分摊、预收、差额核销，对应第 3 课 Payment + PaymentFor

第 4 站  erpnext/accounts/utils.py
         → update_outstanding / reconcile 工具函数，outstanding 的维护现场

第 5 站  erpnext/accounts/report/accounts_receivable/accounts_receivable.py
         → 账龄报表本尊：Payment Ledger Entry + 账龄分桶 + 按客户聚合
           和你的开票报表逐段对照（分桶逻辑、汇总口径、筛选器设计）

第 6 站  erpnext/accounts/doctype/payment_reconciliation/
         → 对账工具前后端：未核销发票与未分摊收付款的拉取、匹配、批量核销
           和你的对账模块对照（匹配算法、差异处理、挂账设计）

第 7 站  erpnext/accounts/doctype/process_statement_of_accounts/
         → 客户对账单的批量生成与发送，对应第 5 课
```

阅读纪律：

- **只读 `accounts/` 目录**，其余模块（stock、manufacturing、hr）全部跳过
- 每读一个文件先问："它对应课程里的哪个概念？"——答不上来的先跳过，大概率是你不需要的复杂度
- 遇到多币种、税则、成本中心分支，第一次读一律跳过主干以外的代码

## 四、从课程到你的工作：一张检查清单

把课程概念当"领域验收标准"，检查你负责的 AR/AP 模块：

**发票模块**
- [ ] 发票是否有清晰的状态机（Unpaid/Partly Paid/Paid/Overdue/Returned）？
- [ ] Outstanding 是物化字段（随分摊更新）还是每次实时算？（前者才对）
- [ ] 红冲单据是否强制关联原发票？已提交单据是否不可改不可删？
- [ ] 税额是单据上算好落库，还是报表里现算？（前者才对）

**对账模块**
- [ ] 对账数据源是台账表还是业务单据大表？（性能分水岭）
- [ ] 支持部分核销、一对多/多对多分摊吗？
- [ ] 差异有"挂账"状态吗，还是强行对平？
- [ ] 预收/预付（负数余额）在对账结果里单列了吗？

**开票报表**
- [ ] 账龄按到期日还是开票日？口径写清楚了吗？
- [ ] 报表底层有没有类似 Payment Ledger Entry 的物化台账？
- [ ] 红冲数据在报表里如何呈现（冲减当月 vs 调整原月）？
- [ ] 客户税号、发票号码等合规字段是否来自主数据而非手工录入？

## 五、验收清单（整门课的毕业标准）

- [ ] 不看答案说出：开票、收款、付款、红冲、预收各自的分录方向
- [ ] 能画出"单据 → 分录台账 → 三大报表"的数据流图
- [ ] 能向同事解释 GL Entry / Payment Ledger Entry 分层的价值
- [ ] 拿着第四节清单评审自己的模块，能列出至少 3 条改进项

## 六、下一步

1. 把 ERPNext 浅克隆到 `vendor/erpnext`：`git clone --depth 1 https://github.com/frappe/erpnext`
2. 按第三节路径读代码，每读完一站回头对照本课映射表
3. 用第四节清单评审你负责的模块，产出一份改进清单

恭喜毕业。🎓
