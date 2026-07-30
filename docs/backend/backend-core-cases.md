# 后端核心能力 Case Demo 手册

> 面向财务系统的后端能力全景教程
> 技术栈：TypeScript / NestJS / Prisma / Zod / Redis / RabbitMQ(RocketMQ 同理)
> 每个维度的结构：**概念 → Case 事故回放 → 问题代码 → 方案与代码 → 设计思路 → 自检清单**

---

## 目录

1. [并发与竞态：同一行数据的抢写](#一并发与竞态)
2. [幂等性：重复请求的免疫系统](#二幂等性)
3. [数据一致性：事务、缓存与跨服务](#三数据一致性)
4. [参数校验与输入防御](#四参数校验与输入防御)
5. [安全：认证、授权与越权](#五安全)
6. [资损防控与金额正确性（财务核心）](#六资损防控与金额正确性)
7. [时间与定时任务](#七时间与定时任务)
8. [大数据量：分页、索引与批处理](#八大数据量)
9. [消息队列：丢失、重复、顺序、积压](#九消息队列)
10. [系统韧性：超时、重试、熔断、限流](#十系统韧性)
11. [性能与伸缩性](#十一性能与伸缩性)
12. [接口契约与数据生命周期](#十二接口契约与数据生命周期)
13. [可观测性：日志、指标、追踪](#十三可观测性)
14. [发布、迁移与回滚](#十四发布迁移与回滚)
15. [总自检清单](#十五总自检清单)

---

## 一、并发与竞态

### 概念

竞态条件（Race Condition）：**多个执行流同时读写共享状态，最终结果取决于不可控的执行时序**。后端的典型形态是「读-改-写」三步被打断：两个请求都读到余额 100，各自减去 60 写回 40，实际应剩 -20。

关键认知：**Node.js 单线程不代表没有竞态**。`await` 让出了事件循环，两个请求的数据库往返会交错——竞态发生在数据库层面，不在 JS 层面。

### Case：付款单重复审批

财务系统里有一张付款单 `payment_order`，状态流转：`PENDING → APPROVED → PAID`。审批人 A 在 PC 端点了「通过」，网络卡住，又在手机端点了一次。两个请求同时到达后端。

### 问题代码

```typescript
// ❌ 典型事故写法：先查再改，两步之间被打断
async approve(id: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id } });
  if (order.status !== 'PENDING') {
    throw new BadRequestException('状态不允许审批');
  }
  // ← 两个并发请求都通过了上面的检查，都走到这里
  await prisma.paymentOrder.update({
    where: { id },
    data: { status: 'APPROVED' },
  });
  await this.voucherService.create(order); // 生成凭证 —— 生成了两次！
}
```

结果：一张付款单生成两张会计凭证，月底对账发现凭证金额翻倍。

### 方案：把判断「压」进数据库原子操作

**方案 1：条件更新（乐观状态机），最常用**

```typescript
async approve(id: string) {
  // UPDATE ... SET status='APPROVED' WHERE id=? AND status='PENDING'
  // 数据库保证这一行同一时刻只有一个事务能更新成功
  const result = await prisma.paymentOrder.updateMany({
    where: { id, status: 'PENDING' }, // 条件即锁：状态不对就更新不到
    data: { status: 'APPROVED' },
  });

  if (result.count === 0) {
    // 要么单不存在，要么已被别人审批——无论哪种都拒绝
    throw new ConflictException('单据已被处理，请刷新');
  }

  await this.voucherService.create(id); // 只有抢到的那一个请求会走到这
}
```

**方案 2：乐观锁（版本号），适合多字段冲突更新**

```prisma
model PaymentOrder {
  id      String @id
  status  String
  amount  Decimal @db.Decimal(18, 2)
  version Int    @default(0)
}
```

```typescript
const { count } = await prisma.paymentOrder.updateMany({
  where: { id, version: order.version }, // 读到的版本必须还是当前版本
  data: { status: 'APPROVED', version: { increment: 1 } },
});
if (count === 0) throw new ConflictException('数据已被他人修改');
```

**方案 3：悲观锁（SELECT ... FOR UPDATE），适合长流程内多次读写同一行**

```typescript
await prisma.$transaction(async (tx) => {
  // 事务内锁定该行，其他事务排队
  const [order] = await tx.$queryRaw<PaymentOrder[]>`
    SELECT * FROM payment_order WHERE id = ${id} FOR UPDATE`;
  if (order.status !== 'PENDING') throw new ConflictException('已被处理');
  await tx.paymentOrder.update({ where: { id }, data: { status: 'APPROVED' } });
  // ...长流程的其它写操作
});
```

### 设计思路：三种锁怎么选

| 方案 | 原理 | 适用 | 代价 |
|---|---|---|---|
| 条件更新 | 数据库行锁，单条 SQL 原子完成 | 状态流转、库存扣减，**默认首选** | 几乎为零 |
| 乐观锁 | 版本号比对，失败重试 | 冲突少、读多写少 | 需要处理重试逻辑 |
| 悲观锁 | 事务期间独占行 | 冲突激烈、一个事务里要读写多次 | 持有锁时间长，吞吐下降，有死锁风险 |

决策口诀：**能用一条原子 SQL 解决的，就不要先查后改；必须多步的，短事务用条件更新兜底，长事务用悲观锁但控制临界区。**

另一个常被忽略的点：**扣减类操作用 SQL 内置表达式，不要把值算好再写**：

```typescript
// ❌ 算好再写：余额又变成了竞态
await tx.account.update({ where: { id }, data: { balance: account.balance.minus(amount) } });

// ✅ 让数据库在锁内完成计算
await tx.account.update({ where: { id }, data: { balance: { decrement: amount } } });
// 余额不足也要在数据库层面防：
// UPDATE account SET balance = balance - 100 WHERE id=? AND balance >= 100 → count=0 即失败
```

### 自检清单

- [ ] 代码里有没有「先 find 判断、再 update」的两步操作？改成条件更新了吗？
- [ ] 扣减类字段用的是 `decrement` 还是算好再写？
- [ ] 状态流转的每一步都有 `WHERE status = 前置状态` 吗？
- [ ] 悲观锁事务里有没有 RPC/HTTP 调用？（有 = 拿数据库锁等网络，大忌）

---

## 二、幂等性

### 概念

幂等：**同一操作执行一次和执行 N 次，系统效果相同**。竞态解决的是「同时来」，幂等解决的是「重复来」——来源至少有四种：

1. 用户双击、刷新重提交；
2. 前端/网关超时后自动重试；
3. MQ 的 at-least-once 投递（消费重复）；
4. 第三方回调重复通知（支付渠道最爱干这事）。

### Case：对账系统的「生成对账单」接口

财务月底对每家客户生成对账单。用户点了按钮，前端 3 秒没响应又点一次；同时你接的支付渠道回调也可能重复推送同一笔收款。

### 问题代码

```typescript
// ❌ 点几次生成几张，回调来几次记几笔
@Post('statements')
async generate(@Body() dto: GenerateDto) {
  return this.statementService.create(dto.customerId, dto.month);
}
```

### 方案：三层防线

**第一层：业务唯一约束（最根本，数据库兜底）**

对账单天然有业务唯一键：客户 + 月份。把它建成唯一索引，重复插入直接失败——这是最后一道、也是最可靠的一道防线。

```prisma
model Statement {
  id         String @id @default(cuid())
  customerId String
  month      String // '2026-07'
  status     String @default("GENERATING")
  @@unique([customerId, month]) // 唯一索引即幂等防线
}
```

```typescript
try {
  return await prisma.statement.create({ data: { customerId, month } });
} catch (e) {
  if (e.code === 'P2002') { // Prisma 唯一约束冲突
    return prisma.statement.findUnique({
      where: { customerId_month: { customerId, month } },
    }); // 不报错，直接返回已存在的那张 → 幂等语义
  }
  throw e;
}
```

**第二层：幂等键（Idempotency-Key），防无天然唯一键的写操作**

前端提交时生成 UUID 放在 Header，后端先占位再执行：

```typescript
async createPayment(dto: CreatePaymentDto, idemKey: string) {
  // INSERT INTO idempotency_key ... 已存在则说明处理过
  const existed = await prisma.idempotencyKey.findUnique({ where: { key: idemKey } });
  if (existed) {
    return JSON.parse(existed.response); // 返回首次执行的结果
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.idempotencyKey.create({ data: { key: idemKey, response: '{}' } }); // 占位
    const payment = await tx.payment.create({ data: dto }); // 真正的业务写入
    await tx.idempotencyKey.update({
      where: { key: idemKey },
      data: { response: JSON.stringify(payment) },
    });
    return payment;
  });
  return result;
}
```

**第三层：消费者幂等（MQ 场景）**

```typescript
async onPaymentCallback(msg: PaymentPaidMsg) {
  const { count } = await prisma.payment.updateMany({
    where: { id: msg.paymentId, status: 'UNPAID' }, // 状态机即幂等：已支付的更新不到
    data: { status: 'PAID', paidAt: new Date() },
  });
  if (count === 0) return; // 重复消息，直接 ack 丢弃
  await this.ledger.record(msg); // 只有首次消费会执行
}
```

### 设计思路

- **优先级：状态机 > 业务唯一键 > 幂等键**。能用状态流转表达的（已支付不能再支付），不要引入额外的幂等表；有天然业务唯一键的（客户+月份），直接上唯一索引；都没有的（纯创建类），才用 Idempotency-Key。
- **占位和提交要在同一事务**，否则占位成功、业务失败，重试永远被拒绝。
- **幂等返回首次结果而不是报错**——对调用方来说「重复请求」应该无感，报错会导致前端把成功当失败处理。
- 财务系统里，**所有外部回调入口（支付、银行流水、发票平台）默认假设会重复**，没有例外。

### 自检清单

- [ ] 每个写接口回答一遍：这个请求来两次会怎样？
- [ ] 创建类操作有唯一索引或幂等键吗？
- [ ] 所有 MQ 消费逻辑里，重复消费是无害的吗？
- [ ] 第三方回调有没有先去重/状态判断？
- [ ] 前端的提交按钮有没有防重复点击 + 生成幂等键？

---

## 三、数据一致性

### 概念

一致性回答的问题是：**一次业务操作涉及多个写动作，它们能否同生共死？** 按范围分三层：

1. **单库多写**：本地事务（ACID）解决；
2. **缓存与库**：更新顺序 + 失效策略；
3. **跨服务/跨库**：放弃强一致，走最终一致（消息表 + 重试 + 对账兜底）。

### Case 1：审批付款单要同时写三张表

审批通过时：① 改付款单状态；② 生成会计凭证；③ 写操作审计日志。

```typescript
// ❌ 三步裸奔，第二步挂了第一步已经提交了
await prisma.paymentOrder.update({ ... });
await prisma.voucher.create({ ... });   // 数据库抖动，失败
await prisma.auditLog.create({ ... });  // 永远执行不到
// 结果：单已批，凭证没有 —— 账实不符
```

**方案：本地事务，同生共死**

```typescript
await prisma.$transaction(async (tx) => {
  await tx.paymentOrder.update({
    where: { id, status: 'PENDING' },
    data: { status: 'APPROVED' },
  });
  await tx.voucher.create({ data: buildVoucher(order) });
  await tx.auditLog.create({ data: buildLog(order, user) });
}, {
  isolationLevel: 'ReadCommitted',
  timeout: 5000, // 必须设超时，防止长事务拖垮连接池
});
```

**设计思路**：事务要**小而快**。事务里禁止 RPC、禁止循环逐条写（改批量）、禁止等大文件 IO。事务持有行锁，时间越长，并发越差、死锁越多。

### Case 2：缓存与数据库不一致

客户主数据（名称、税率、开户行）被高频读取，你加了 Redis 缓存。财务把客户税率从 13% 改成 9%，但开票页读到的还是 13%——缓存没更新。

**方案：先写库，再删缓存（Cache Aside）**

```typescript
async updateCustomer(id: string, dto: UpdateCustomerDto) {
  const updated = await prisma.customer.update({ where: { id }, data: dto });
  await redis.del(`customer:${id}`); // 删缓存，不是更新缓存
  return updated;
}

async getCustomer(id: string) {
  const cached = await redis.get(`customer:${id}`);
  if (cached) return JSON.parse(cached);
  const data = await prisma.customer.findUnique({ where: { id } });
  if (data) await redis.set(`customer:${id}`, JSON.stringify(data), 'EX', 300);
  return data;
}
```

为什么是「删」而不是「更新」？因为更新缓存在并发下会乱序（A 写库 → B 写库 → B 更缓存 → A 更缓存，缓存里是旧值）。删缓存后由下一次读重建，最多短暂读到旧值，最终一致。

极端严格场景可再加 **延迟双删**（写完库后过 500ms 再删一次，清理并发读重建的脏缓存），但要明白：这只是降低概率，不是强一致。**真正不能容忍短暂不一致的数据（如账户余额），不要进缓存。**

### Case 3：主从延迟——刚保存的客户，刷新列表没有了

读写分离架构下，写走主库，读走从库，复制延迟 200ms。用户保存完立刻跳转列表页，读的是从库，数据还没同步过来，用户以为保存失败，又提交一次（连锁引发幂等问题）。

**方案：写后读关键数据走主库**

```typescript
// 方案A：保存接口直接返回完整对象，前端不重新拉列表（最简单，首选）
async create(dto: CreateCustomerDto) {
  const customer = await prisma.customer.create({ data: dto });
  return customer; // 前端直接用这个返回值更新本地状态
}

// 方案B：必须重新读的场景（如聚合统计），该查询强制走主库
// Prisma 中给关键读配置独立的主库 client，或用中间件按「刚写入的 key」路由主库
```

### Case 4：跨服务——审批通过后要通知税务系统开票

付款审批在财务系统，开票在税务服务。审批成功后调开票接口失败：单已批、票没开。重试又可能重复开票。

**方案：本地消息表 + MQ，最终一致**

核心思想：**把「要发消息」这件事和业务写库放在同一个本地事务里**，从此消息不丢；投递和消费各自幂等，从此重复无害。

```typescript
// 第一步：业务写入 + 消息落库，同一事务
await prisma.$transaction(async (tx) => {
  await tx.paymentOrder.update({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED' } });
  await tx.outboxMessage.create({
    data: {
      topic: 'invoice.issue',
      payload: JSON.stringify({ paymentId: id, amount: order.amount, taxRate: order.taxRate }),
      status: 'PENDING',
    },
  });
}); // 从此刻起，开票指令已经"安全落地"

// 第二步：后台 relay 任务轮询 outbox，投递 MQ
async relay() {
  const msgs = await prisma.outboxMessage.findMany({ where: { status: 'PENDING' }, take: 100 });
  for (const m of msgs) {
    await mq.publish(m.topic, m.payload);
    await prisma.outboxMessage.update({ where: { id: m.id }, data: { status: 'SENT' } });
  }
}

// 第三步：消费方（税务服务）幂等消费，见第二章
```

**兜底：对账任务**。每天凌晨比对「已审批未开票」的付款单，超过阈值告警并自动补发消息。——这就是财务系统里「对账」的技术本质：**承认分布式必然有裂缝，用周期性核对来发现和修复裂缝。**

### 设计思路

- 一致性的层级是**成本递增**的：本地事务 ≈ 免费，缓存最终一致 ≈ 便宜，分布式事务（2PC/Seata AT）= 昂贵且脆弱。**能降级到最终一致的，绝不强一致。**
- 区分哪些数据「错一会儿没关系」（客户名称展示）和「一刻都不能错」（余额、凭证）——前者用缓存/最终一致，后者单库事务 + 不进缓存。
- 实践排序：**本地消息表（Outbox）> RocketMQ 事务消息 > Seata**。前两者无框架侵入，语义清晰，是行业主流。
- 补偿和对账不是「可选的保险丝」，是最终一致架构的**必要组成部分**——没有兜底核对的最终一致是赌博。

### 自检清单

- [ ] 多表写入都包在事务里了吗？事务里有 RPC/循环单写/慢 IO 吗？
- [ ] 哪些数据进了缓存？能接受「旧值存活几秒」吗？不能的移出缓存了吗？
- [ ] 缓存是「写库后删除」而不是「双写更新」吗？
- [ ] 保存后立即读的场景，是返回对象还是强制读主？
- [ ] 跨服务调用有 Outbox 吗？消费端幂等吗？有对账兜底任务吗？

---

## 四、参数校验与输入防御

### 概念

**绝不信任任何外部输入**——Body、Query、Header、路径参数、文件上传，甚至来自「内部服务」的消息。校验分三层，职责不同：

| 层 | 职责 | 例子 |
|---|---|---|
| 入参层（Controller/DTO） | 格式合法性：类型、必填、长度、枚举、范围 | amount 必须是正数、最多两位小数 |
| 业务层（Service） | 业务规则：状态、归属、余额 | 该客户是否存在、单据是否在可编辑状态 |
| 持久层（ORM/DB） | 最后防线：参数化查询、NOT NULL、CHECK、外键 | 数据库约束兜住应用层的漏网之鱼 |

### Case：对账系统的应收调整接口

财务可以手工调整某客户的应收金额。接口收到这样的请求体：

```json
{ "customerId": "1 OR 1=1", "amount": -999999.999, "reason": "<script>alert(1)</script>" }
```

三个问题各对应一种攻击/事故：注入、负金额资损、存储型 XSS。

### 方案与代码

**第一层：Zod Schema 声明式校验（NestJS 管道）**

```typescript
import { z } from 'zod';

export const adjustReceivableSchema = z.object({
  customerId: z.string().cuid(),           // 格式即防御：非法 ID 直接 400
  amount: z.number()
    .positive('调整金额必须为正')            // 负数业务上用 direction 字段表达
    .multipleOf(0.01, '最多两位小数')
    .max(10_000_000, '超出单笔调整上限'),    // 上限防离谱输入
  direction: z.enum(['INCREASE', 'DECREASE']),
  reason: z.string().trim().min(5).max(200), // trim + 长度限制
});

type AdjustDto = z.infer<typeof adjustReceivableSchema>;

@Post('receivable/adjust')
adjust(@Body(new ZodValidationPipe(adjustReceivableSchema)) dto: AdjustDto) { ... }
```

**第二层：业务校验在 Service，返回明确错误码**

```typescript
async adjust(dto: AdjustDto, operator: User) {
  const customer = await prisma.customer.findUnique({ where: { id: dto.customerId } });
  if (!customer) throw new NotFoundException('客户不存在');
  if (customer.status === 'FROZEN') throw new ConflictException('客户已冻结，禁止调整');
  if (dto.direction === 'DECREASE' && customer.receivable.lt(dto.amount)) {
    throw new UnprocessableEntityException('调整后应收为负，已拦截'); // 业务规则
  }
  // ...事务内写入（调整记录 + 余额变动，见第一章原子扣减）
}
```

**第三层：数据库约束兜底**

```sql
ALTER TABLE receivable_adjustment
  ADD CONSTRAINT chk_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT chk_direction CHECK (direction IN ('INCREASE','DECREASE'));
-- 应用层全部失守时，数据库拒绝落库
```

**注入与 XSS 的具体防线**

```typescript
// SQL 注入：Prisma 默认参数化，天然免疫。真正的风险在 $queryRaw 拼字符串：
// ❌ await prisma.$queryRawUnsafe(`SELECT * FROM customer WHERE name = '${name}'`)
// ✅ await prisma.$queryRaw`SELECT * FROM customer WHERE name = ${name}` （带参模板）

// 存储型 XSS：reason 会展示在审批详情页
// 原则：入库存原文（方便检索/导出），出库/渲染时转义
// React 默认转义文本节点，危险的是 dangerouslySetInnerHTML 和富文本
// 富文本场景用 DOMPurify 白名单过滤：
import DOMPurify from 'isomorphic-dompurify';
const safeHtml = DOMPurify.sanitize(richText, { ALLOWED_TAGS: ['p','b','table','tr','td'] });
```

**文件上传（对账单 Excel 导入场景）**

```typescript
// 四重校验：扩展名、MIME、魔数、大小
const fileSchema = z.object({
  mimetype: z.enum(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  size: z.number().max(10 * 1024 * 1024), // 10MB 上限，防内存被打爆
});
// 魔数校验：xlsx 是 zip，开头必须是 PK\x03\x04
const buf = await file.toBuffer();
if (buf.readUInt32BE(0) !== 0x504b0304) throw new BadRequestException('文件内容不合法');
// 解析时限制行数：stream 逐行读，超过 50000 行拒绝
```

### 设计思路

- **格式校验前置，业务校验居中，数据库约束兜底**——越靠前的校验越便宜（400 错误 vs 数据库异常）。
- 校验规则要**声明式**（Zod/Bean Validation），散落的 `if` 手写校验必然漏。
- 负数、零、超长、null、undefined、`{}`、`[]`——写接口时对每个字段过一遍这八个「恶魔值」。
- **白名单思维**：校验「允许什么」而非「禁止什么」。黑名单永远列不完。
- 错误信息对外模糊（不泄露表结构/SQL），对内详细（日志带完整上下文）。

### 自检清单

- [ ] 每个接口有 Zod schema 吗？金额字段有正数/精度/上限三重限制吗？
- [ ] 有没有 `$queryRawUnsafe` / 字符串拼 SQL？
- [ ] 富文本和回显字段有输出转义/消毒吗？
- [ ] 文件上传校验了类型、大小、魔数、行数吗？
- [ ] 数据库有 CHECK / NOT NULL / 唯一约束兜底吗？

---

## 五、安全

### 概念

安全在业务后端的核心是三件事：**你是谁（认证）、你能干什么（授权）、你是不是在冒充/重放（完整性）**。业务系统最大的安全事故不是 SQL 注入，而是**越权**——它不在 OWASP headlines 里，却是真实世界数据泄露的第一来源。

### Case 1：水平越权——改个 ID 看到别家公司的对账单

你的系统是多租户的：A 公司的财务登录后请求 `GET /api/statements/:id`，把 id 换成 B 公司的对账单 id，后端只查了 id 存在性就返回了——A 公司看到了 B 公司的营收明细。

### 问题代码

```typescript
// ❌ 只认证、不授权
@Get('statements/:id')
@UseGuards(JwtAuthGuard) // 只验证了"登录了"
async getStatement(@Param('id') id: string) {
  return prisma.statement.findUnique({ where: { id } }); // 谁的都能看
}
```

### 方案与代码

**原则：每一次按 ID 取数，查询条件都必须带「归属」**

```typescript
@Get('statements/:id')
@UseGuards(JwtAuthGuard)
async getStatement(@Param('id') id: string, @CurrentUser() user: AuthUser) {
  const stmt = await prisma.statement.findFirst({
    where: { id, tenantId: user.tenantId }, // 归属条件进 WHERE，进数据库层过滤
  });
  if (!stmt) throw new NotFoundException('对账单不存在'); // 注意：返回404而非403
  return stmt;
}
```

两个细节：
1. **在查询条件里过滤，而不是查出来再在代码里比对**——后者在列表查询、聚合查询里一定会漏。
2. **越权返回 404 而非 403**——403 等于告诉攻击者「这东西存在但你不配看」，404 什么都探测不出来。

更系统的做法是把 tenantId 注入 Prisma Client 扩展（middleware/extension），所有查询自动附加，从机制上杜绝漏写：

```typescript
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (TENANT_MODELS.includes(model) && args?.where) {
          args.where = { ...args.where, tenantId: getCurrentTenant() };
        }
        return query(args);
      },
    },
  },
});
```

**垂直越权（功能权限）**：普通财务不该能调「审批」接口。用 RBAC 声明式守卫：

```typescript
@Post('payment/:id/approve')
@RequirePermission('payment:approve') // 自定义装饰器 + Guard 查角色权限表
approve(@Param('id') id: string) { ... }
```

权限模型建议：**角色 → 权限点（资源:动作）** 多对多，权限点代码里枚举管理，角色在后台可配。审批类操作还可以叠加**数据范围**（只能批本部门单）和**金额阈值**（>10万需财务经理）。

### Case 2：认证与会话

```typescript
// JWT 的正确姿势
{
  sub: userId, tenantId, roles,
  exp: '15分钟',        // 短寿命 access token
}
// + refresh token（httpOnly cookie，7天，可吊销）
// 敏感操作（导出、审批大额）：要求重新验证密码或二次确认 —— "step-up auth"
```

要点：JWT 无状态但**不可吊销**，所以 access token 寿命要短；登出/改密码后旧 token 必须失效 → refresh token 存库可吊销，或维护 token 版本号。

### Case 3：防重放与防篡改（对外的回调接口）

你暴露给银行/支付渠道的流水回调接口，攻击者抓到一次合法请求，重放 100 次——如果没有第二章的幂等，就是 100 笔重复入账。

```typescript
// 回调验签 + 时间戳 + nonce
function verifyCallback(headers, body) {
  const { sign, timestamp, nonce } = headers;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) {
    throw new UnauthorizedException('请求过期'); // 防重放时间窗
  }
  const expected = hmacSHA256(secret, timestamp + nonce + canonical(body));
  if (!timingSafeEqual(sign, expected)) throw new UnauthorizedException('签名无效');
  // nonce 存 Redis 5 分钟，用过的拒绝
}
```

### 其他必修项（速查）

| 风险 | 一句话方案 |
|---|---|
| 密码存储 | bcrypt/argon2，禁止 MD5/SHA 裸哈希 |
| 敏感数据 | 身份证号、银行账号加密存储（AES-GCM），展示脱敏（`6222****1234`） |
| 日志泄露 | 日志框架配脱敏过滤器，手机号/卡号/密码绝不落日志 |
| CSRF | 纯 Bearer Token 接口天然免疫；用 Cookie 会话就必须 CSRF Token |
| 接口防刷 | 网关/Redis 令牌桶限流（见第十章） |
| 依赖漏洞 | CI 里跑 `npm audit` / Trivy，高危阻断发布 |

### 设计思路

- **认证在边缘做，授权在每一个资源访问点做**。网关验 JWT，但归属校验必须在业务查询里——网关不知道这条数据是谁的。
- 多租户系统的第一纪律：**tenantId 不从请求体拿，从 token 拿**。请求体里的 tenantId 是攻击者写给我们的。
- 安全校验失败要**计数告警**——单用户短时间大量 404/403，就是越权探测行为。
- 权限设计宁缺毋滥：上线初期权限粒度粗一点（角色级），随业务演化细化。一开始就上 ABAC 是过度设计。

### 自检清单

- [ ] 每个按 ID 查询的接口，WHERE 里带归属字段吗？
- [ ] tenantId/userId 来自 token 还是请求体？
- [ ] 越权统一返回 404 吗？
- [ ] 审批/导出类敏感接口有权限点 + 金额阈值 + 二次确认吗？
- [ ] 回调接口有验签 + 时间戳 + nonce 吗？
- [ ] 敏感字段存储加密、展示脱敏、日志过滤了吗？

---

## 六、资损防控与金额正确性

### 概念

资损 = 系统原因导致的钱的差错。这是财务系统区别于普通业务系统的**第一命题**。三条铁律：

1. **金额永不丢失精度**（存储、计算、传输全链路）；
2. **资金变动只增不改**（流水不可变，错了用红字冲正）；
3. **每一分钱的变动都能被追溯和核对**（账账相符、账实相符）。

### Case 1：浮点数毁掉一张发票

对账明细里有一笔 19.99 元的订单，系统算合计时：

```javascript
// ❌ JS 浮点灾难
0.1 + 0.2            // 0.30000000000000004
19.99 * 100          // 1998.9999999999998
// 对账合计 19.99，渠道账单 19.99，系统算出 19.989999... → 差异告警，财务白查两小时
```

### 方案与代码

**存储层：数据库 DECIMAL，整数优先**

```prisma
model Invoice {
  amount  Decimal @db.Decimal(18, 2) // 两位小数，最大约 10^16
  taxRate Decimal @db.Decimal(5, 4)  // 税率需要四位精度
}
// 更稳妥的流派：直接存"分"（BIGINT），彻底无小数。二选一，全系统统一
```

**应用层：decimal.js 统一计算，禁止 number 参与金额运算**

```typescript
import Decimal from 'decimal.js';

// 封装一个 Money 值对象，从源头禁掉裸 number
export class Money {
  private readonly value: Decimal;
  private constructor(v: Decimal) { this.value = v; }

  static of(input: string | number | Decimal): Money {
    if (typeof input === 'number' && !Number.isFinite(input)) throw new Error('非法金额');
    return new Money(new Decimal(input));
  }
  static fromCents(cents: bigint | number): Money {
    return new Money(new Decimal(cents.toString()).div(100));
  }

  add(o: Money) { return new Money(this.value.plus(o.value)); }
  sub(o: Money) { return new Money(this.value.minus(o.value)); }
  mul(rate: string | number) { return new Money(this.value.times(rate)); }
  div(rate: string | number) { return new Money(this.value.div(rate)); }
  /** 金额必须显式指定舍入模式，不允许"默认四舍五入"偷偷发生 */
  round2(): Money {
    return new Money(this.value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
  }
  toString() { return this.value.toFixed(2); }
  toCents() { return BigInt(this.value.times(100).toFixed(0)); }
}

// 含税价拆不含税价（财务高频场景）：不含税 = 含税 / 1.13，税额 = 含税 - 不含税
const total = Money.of('113.00');
const net = total.div('1.13').round2();   // 100.00
const tax = total.sub(net);               // 13.00，恒等式保证 不含税+税额≡含税
```

**传输层：金额序列化为字符串**

```typescript
// JSON 没有 Decimal 类型，number 会丢精度（> 2^53 或大数累加时）
// 约定：API 里金额一律字符串 "1234.56"，前端也用 decimal 库处理
return { amount: money.toString() }; // 不是 money.value.toNumber()
```

### Case 2：负数与舍入规则不一致引发的 0.01 差异

对账时系统合计 1000 条明细得到 10000.01，渠道账单 10000.00——每条明细四舍五入多出的 0.00001 累积成了 1 分钱差异。这在月度对账里是高频噩梦。

**方案：舍入规则三定**

1. **定点**：明确每个计算环节的精度位（单价 4 位、金额 2 位）；
2. **定模式**：全系统统一 `ROUND_HALF_UP`（财务惯例），折扣分摊等特殊场景文档注明；
3. **定时机**：明细级逐条舍入再合计，**与渠道账单保持同侧舍入**——对账差异先查舍入口径，再查数据。

分摊场景（把 100 元优惠摊到 3 个商品）：必须用**余数分配法**——前 N-1 行按比例舍入，最后一行 = 总额 - 已分摊，保证「分项之和 ≡ 总额」。

```typescript
function allocate(total: Money, weights: Decimal[]): Money[] {
  const weightSum = weights.reduce((a, b) => a.plus(b), new Decimal(0));
  let allocated = Money.of('0');
  return weights.map((w, i) => {
    if (i === weights.length - 1) return total.sub(allocated); // 最后一行吃余数
    const share = total.mul(w.div(weightSum).toString()).round2();
    allocated = allocated.add(share);
    return share;
  });
}
```

### Case 3：改错账的正确姿势——红冲，不是 UPDATE

财务发现一张已入账凭证金额录错了（1000 录成 10000）。

```typescript
// ❌ 直接改：审计链断裂，月底报表和银行流水永远对不上
await prisma.voucher.update({ where: { id }, data: { amount: 1000 } });

// ✅ 红字冲正：原凭证保留，生成一张 -10000 的冲销凭证 + 一张 1000 的正确凭证
await prisma.$transaction(async (tx) => {
  await tx.voucher.update({
    where: { id },
    data: { status: 'REVERSED', reversedBy: reversalVoucherId },
  });
  await tx.voucher.create({ data: { amount: -10000, type: 'REVERSAL', refId: id } }); // 红冲
  await tx.voucher.create({ data: { amount: 1000, type: 'NORMAL', refId: id } });     // 蓝字
});
```

配套原则：**已过账（posted）的数据物理上不可改**——代码层面没有 update 路径，DB 层面可以上触发器或权限收紧。

### Case 4：资损的对账防线（事前/事中/事后）

| 时机 | 机制 | 财务系统落地 |
|---|---|---|
| 事前 | 校验与限额 | 单笔调整上限、日累计调整上限、超出需双人复核 |
| 事中 | 实时核对 | 写流水后立即校验「余额 = 上笔余额 + 发生额」，不等式成立才提交事务 |
| 事后 | 周期对账 | 日终：系统明细 vs 渠道账单 vs 银行流水三方核对，差异进差异表 + 告警 |

```typescript
// 事中校验示例：账户流水的链式校验
await prisma.$transaction(async (tx) => {
  const last = await tx.ledgerEntry.findFirst({
    where: { accountId }, orderBy: { seq: 'desc' },
  });
  const newBalance = Money.of(last?.balance ?? '0').add(amount);
  await tx.ledgerEntry.create({
    data: { accountId, amount: amount.toString(), balance: newBalance.toString(), seq: (last?.seq ?? 0) + 1 },
  });
  // 余额为负且账户不允许透支 → 抛错回滚
  if (newBalance.value.lt(0)) throw new ConflictException('余额不足');
});
```

### 设计思路

- **精度问题全链路治理**：DB(DECIMAL) → ORM(Prisma Decimal) → 应用(decimal.js) → 序列化(string) → 前端(decimal 库)，任何一环用 number 就前功尽弃。
- 「不可变流水 + 红冲」本质是把**会计实践翻译成工程约束**：append-only 的表天然可审计、可重放、可对账。
- 对账系统的设计核心不是「比对」而是**差异的分类处置**：哪些差异自动核销（舍入尾差）、哪些人工处理（缺单）、哪些告警升级（金额不符）。
- 资损防控的收益要在简历上量化：「日终三方对账，差异发现时效 T+1，尾差自动核销率 99.x%」。

### 自检清单

- [ ] 全链路还有 number 参与金额运算吗？grep 一遍 `toNumber()`？
- [ ] API 金额字段是字符串吗？前端也用 decimal 库吗？
- [ ] 舍入规则（点位、模式、时机）写成文档了吗？
- [ ] 分摊逻辑有余数分配吗？
- [ ] 已过账数据有 update/delete 路径吗？改成红冲了吗？
- [ ] 余额变动有链式校验吗？有日终对账任务吗？

---

## 七、时间与定时任务

### 概念

时间是后端最容易「本地跑得好好的，上线就错」的维度。三个子问题：**存储与展示的时区**、**跨时钟的不可靠**（服务器时钟会漂移）、**定时任务在多实例下的重复执行**。

### Case 1：对账周期错位 8 小时

服务器在 Docker 容器里（默认 UTC），业务在中国（UTC+8）。你的日切任务取「今天」：

```typescript
// ❌ 服务器时区依赖：本地 dev 是 +8 没问题，容器里跑直接切错天
const today = new Date().toISOString().slice(0, 10); // UTC 日期！
// 北京时间 7月20日 06:00 = UTC 7月19日 22:00 → 早晨生成的"今日"对账单日期是昨天
```

### 方案与代码

**铁律：存储 UTC，业务日界用明确的业务时区换算**

```typescript
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

const BIZ_TZ = 'Asia/Shanghai';

// 业务日期（账期归属）必须显式按时区算，不依赖服务器时区
export function bizDate(d = new Date()): string {
  return format(toZonedTime(d, BIZ_TZ), 'yyyy-MM-dd');
}

// "北京时间今天"对应的 UTC 查询区间（查数据库用）
export function bizDayRange(date: string): [Date, Date] {
  const startUtc = fromZonedTime(`${date} 00:00:00`, BIZ_TZ);
  const endUtc = fromZonedTime(`${date} 23:59:59.999`, BIZ_TZ);
  return [startUtc, endUtc];
}
```

配套约定：
- DB 时间列一律 `timestamptz`（PG）/ `TIMESTAMP`（MySQL 存 UTC），不用 `DATETIME`（无时区信息）；
- 容器镜像显式 `TZ=Asia/Shanghai`（兜底，但代码不依赖它）；
- **账期、对账日期这类「业务日期」字段用 DATE 类型存日期串**，不带时间，从根上消灭时区歧义。

### Case 2：对账任务跑了三遍，凭证生成三份

应用部署了 3 个实例做高可用，每个实例上都有 `@Cron('0 2 * * *')`——凌晨 2 点，任务在 3 台机器上各跑一遍。

### 方案：调度与执行分离

**方案 A：调度中心（推荐）**——xxl-job / 云厂商定时触发器，由调度中心只触发一次，执行器横向扩展：

```typescript
// 应用内不再有 cron，只暴露一个执行端点，由调度中心调用
@Post('jobs/daily-reconcile')
async runReconcile(@Body() body: { date?: string }) {
  const date = body.date ?? bizDate(dayjs().subtract(1, 'day').toDate());
  return this.reconcileService.run(date);
}
```

**方案 B：分布式锁（轻量替代）**——任务入口抢锁，抢不到就退出：

```typescript
@Cron('0 2 * * *')
async dailyReconcile() {
  const locked = await redis.set(
    'lock:daily-reconcile', process.pid.toString(),
    'EX', 3600, 'NX', // 不存在才设置 = 全局只有一个实例抢到
  );
  if (!locked) return; // 别的实例在跑，本实例退出
  try {
    await this.reconcileService.run();
  } finally {
    await redis.del('lock:daily-reconcile');
  }
}
```

**方案 C（兜底，永远要做）：任务本身幂等**——就算跑三遍，结果也一样：

```typescript
async run(date: string) {
  // 账期 + 任务类型唯一，重复执行直接返回已有结果（第二章的幂等思路）
  const existed = await prisma.reconcileBatch.findUnique({
    where: { date_type: { date, type: 'DAILY' } },
  });
  if (existed?.status === 'DONE') return existed;
  // 用 upsert + 状态机保证只有一个执行体真正干活
}
```

### Case 3：长任务的断点续跑

月度对账要处理 500 万条流水，跑到 80% 实例被重启了。

**方案：分片 + 进度落库 + 可重入**

```typescript
async run(date: string) {
  const customers = await prisma.customer.findMany({ select: { id: true } });
  for (const c of customers) {
    const done = await prisma.reconcileProgress.findUnique({
      where: { batchId_customerId: { batchId, customerId: c.id } },
    });
    if (done?.status === 'DONE') continue; // 已完成的客户跳过 → 断点续跑
    await this.reconcileOneCustomer(c.id, date); // 单客户级幂等
    await prisma.reconcileProgress.upsert({ ...status: 'DONE' });
  }
}
```

### 设计思路

- **调度唯一、执行幂等、进度可查**——定时任务三要素，缺一不可。
- 任务要有**补偿入口**：支持手动指定日期重跑（对账漏跑一天是常态运维场景），所以任务参数永远显式传 `date`，默认昨天，绝不写死「当前时间」。
- 时钟漂移：不要用本机时间做精确过期判断（跨机器），用 Redis TTL 或数据库 `now()`。
- 报表类任务跑完后**冻结快照**：对账单生成后存结果表，之后明细变了不重算——财务需要「那一刻的账」是稳定的。

### 自检清单

- [ ] 代码里有 `new Date().toISOString().slice(0,10)` 这类隐式时区吗？
- [ ] 业务日期字段是 DATE 类型吗？时间字段存 UTC 吗？
- [ ] 多实例下定时任务有调度中心/分布式锁吗？
- [ ] 任务重复执行是无害的吗？支持指定日期重跑吗？
- [ ] 长任务有进度表、能断点续跑吗？

---

## 八、大数据量

### 概念

核心心法：**永远不要假设数据量会停在现在**。所有查询、导出、批处理按「百万级流水、千万级明细」设计。三个典型死法：深分页扫全表、一次查爆内存、大事务锁全表。

### Case 1：对账明细列表，翻到第 5000 页要 8 秒

```sql
-- ❌ OFFSET 深分页：扫描 500,010 行，丢弃前 500,000 行
SELECT * FROM statement_detail ORDER BY id LIMIT 10 OFFSET 500000;
```

### 方案与代码

**游标分页（Keyset Pagination）**

```typescript
// 前端不再传 page=5001，传上一页最后一条的 id
@Get('details')
async list(@Query('cursor') cursor?: string, @Query('limit', new DefaultValuePipe(50)) limit = 50) {
  const items = await prisma.statementDetail.findMany({
    where: cursor ? { id: { lt: cursor } } : {}, // id 倒序场景
    orderBy: { id: 'desc' },
    take: limit + 1, // 多取一条判断是否有下一页
  });
  const hasMore = items.length > limit;
  if (hasMore) items.pop();
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
```

```sql
-- 实际执行：走主键索引，10 行直达，与页深无关，毫秒级
SELECT * FROM statement_detail WHERE id < 'xxx' ORDER BY id DESC LIMIT 51;
```

代价：不能跳页（没有「跳到第 500 页」）。**后台系统列表第一页占 95% 访问量，这个代价几乎总是值得的**；必须跳页的场景（管理后台）限制最大页数即可。

### Case 2：导出对账单把 Node 进程打爆了

```typescript
// ❌ 50 万条明细一次性查进内存
const details = await prisma.statementDetail.findMany({ where: { statementId } });
const workbook = buildExcel(details); // 内存 2GB，进程 OOM
```

**方案：分批流式处理 + 异步任务**

```typescript
// ① 导出走异步：提交任务 → 后台生成 → 通知下载（不阻塞在线请求）
@Post('statements/:id/export')
async export(@Param('id') id: string) {
  const job = await prisma.exportJob.create({ data: { statementId: id, status: 'PENDING' } });
  await this.queue.add('export', { jobId: job.id }); // MQ 异步
  return { jobId: job.id };
}

// ② 消费端游标分批读 + 流式写
async doExport(jobId: string) {
  const stream = createWriteStream(`/tmp/${jobId}.csv`);
  let cursor: string | undefined;
  while (true) {
    const batch = await prisma.statementDetail.findMany({
      where: { statementId, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: 1000, // 每批 1000，内存恒定
    });
    if (batch.length === 0) break;
    for (const row of batch) stream.write(toCsvLine(row) + '\n');
    cursor = batch[batch.length - 1].id;
  }
  stream.end();
  await uploadToOss(`/tmp/${jobId}.csv`); // 传对象存储，生成下载链接
}
```

### Case 3：慢查询——对账列表按客户名模糊搜索拖垮库

```sql
-- ❌ 前导通配，索引完全失效，全表扫描
SELECT * FROM customer WHERE name LIKE '%贸易有限公司%';
```

**索引与查询治理要点**：

```prisma
model StatementDetail {
  id          String   @id
  statementId String
  customerId  String
  amount      Decimal  @db.Decimal(18, 2)
  tradeDate   DateTime
  @@index([statementId, tradeDate]) // 联合索引：覆盖"按对账单+日期范围"高频查询
}
```

- **核心 SQL 必须 `EXPLAIN`**：确认 type 是 `ref/range` 而不是 `ALL`，确认用了覆盖索引（Extra: Using index）；
- **联合索引最左前缀**：`(statementId, tradeDate)` 的索引能服务 `WHERE statementId=?`，但不能服务 `WHERE tradeDate` 单独查询；
- `LIKE '%xx%'` 无解 → 文本检索走搜索引擎（ES/Meilisearch），或业务上妥协：只允许前缀匹配 `LIKE 'xx%'`（可用索引）；
- **查询入口约束**：后台列表强制至少一个索引字段作为筛选条件（如必须选对账单/日期范围），从产品上消灭全表扫描的入口；
- 慢查询日志（MySQL `long_query_time=1`）接告警，每周治理 TopN。

### Case 4：批量入账的大事务锁表

月结要向 10 万客户批量生成应收单。

```typescript
// ❌ 一个事务 10 万条 insert：undo log 爆炸、锁持有几分钟、主从延迟飙升
await prisma.$transaction(async (tx) => {
  for (const c of customers) await tx.receivable.create({ ... });
}, { timeout: 600000 });
```

**方案：切小批次 + 每批独立事务 + 失败可续**

```typescript
const BATCH = 500;
for (let i = 0; i < customers.length; i += BATCH) {
  const chunk = customers.slice(i, i + BATCH);
  await prisma.$transaction(
    chunk.map((c) => prisma.receivable.create({ data: buildReceivable(c) })),
  ); // 每 500 条一个事务，秒级提交
  await prisma.batchJob.update({ where: { id: jobId }, data: { progress: i + BATCH } });
}
```

更优：能用 `createMany` 就别循环单插（减少 RTT）；MySQL 超大批量考虑 `LOAD DATA` 或先写暂存表再 `INSERT ... SELECT`（一条 SQL 在库内完成，无网络往返）。

### 设计思路

- 数据量问题的本质是**算法复杂度问题**：OFFSET 分页是 O(N)，游标是 O(logN)；全量加载是 O(N) 内存，流式是 O(1) 内存。看到 O(N) 就警觉。
- 分页方案选型：**前台/高频列表 → 游标；管理后台要跳页 → OFFSET 但限制最大页；复杂多条件检索 → 搜索引擎**。
- 数据再上一个量级（单表亿级）才是分库分表的话题——在此之前，索引 + 读写分离 + 归档能解决 99% 的问题。**不要预支分库分表的复杂度。**
- 归档策略提前设计：3 年前的对账明细迁到历史库/冷库，在线库保持「苗条」。

### 自检清单

- [ ] 列表接口是游标分页吗？有 OFFSET 大页码入口吗？
- [ ] 导出/批处理是异步 + 分批 + 流式吗？内存占用与数据量无关吗？
- [ ] 核心 SQL 都 EXPLAIN 过吗？有全表扫描吗？
- [ ] 批量写切小事务了吗？能用 createMany 吗？
- [ ] 有慢查询监控和历史数据归档策略吗？

---

## 九、消息队列

### 概念

MQ 解决解耦、削峰、异步，但它自己引入四个新问题：**消息会丢吗？会重复吗？顺序对吗？堆积了怎么办？** 用 MQ 就必须回答这四个问题，否则 MQ 只是把事故从同步搬到了异步。

### Case：付款审批通过后，异步生成凭证 + 通知税务 + 推送企业微信

### 方案与代码

**1. 丢失 —— 生产端：Outbox 落库（见第三章）；消费端：手动 ack**

```typescript
// ❌ 收到消息先 ack 再处理：处理挂了消息已确认，永久丢失
channel.consume(queue, async (msg) => {
  channel.ack(msg);
  await process(msg); // 挂了 → 消息没了
});

// ✅ 处理成功才 ack；失败 nack 重回队列或进死信
channel.consume(queue, async (msg) => {
  try {
    await process(msg);
    channel.ack(msg);
  } catch (e) {
    if (isRetryable(e)) channel.nack(msg, false, true);  // requeue 重试
    else channel.nack(msg, false, false);                // 进死信队列 DLQ
  }
});
```

**2. 重复 —— at-least-once 是 MQ 的默认语义，消费端必须幂等**（见第二章，状态机/去重表）。没有「恰好一次」的免费午餐，所谓 exactly-once 都是「至少一次 + 消费幂等」的组合拳。

**3. 顺序 —— 同一实体的消息路由到同一队列分区**

付款单状态消息：`APPROVED → PAID → CLOSED` 必须按序消费。

```typescript
// 发送时按业务 key 选择队列/分区（Kafka 的 key、RocketMQ 的 MessageQueueSelector）
await mq.send('payment-events', {
  key: paymentId,        // 同一付款单永远进同一分区 → 分区内有序
  body: { status: 'PAID' },
});
```

注意边界：**只能保证同一 key 内有序，全局有序等于退回单点，吞吐归零**。设计时问：这件事真的需要全局顺序吗？（几乎都不需要。）

**4. 积压 —— 监控 + 扩容消费者 + 降级预案**

对账日消息洪峰，凭证队列积压 50 万条：

- 监控：`lag`（积压量）指标接告警，积压 > 阈值触发；
- 消费端无状态 → 临时扩容消费者实例（Kafka 受分区数上限约束，分区数要提前规划）;
- 降级：非关键消息（企业微信通知）积压时可批量合并发送或直接跳过，保住凭证这种关键链路。

**5. 死信队列（DLQ）—— 坏消息的停尸房**

连续重试 N 次仍失败的消息进 DLQ，**必须有配套**：DLQ 告警 + 人工/自动重放工具。没有告警的 DLQ 等于把错误扫到地毯下。

```typescript
// 重放工具（运维脚本）
async replayDlq(queue: string, limit = 100) {
  const msgs = await mq.peek(dlqName(queue), limit);
  for (const m of msgs) {
    if (await this.isBusinessStillValid(m)) { // 过期消息别盲目重放！
      await mq.send(queue, m);
    }
  }
}
```

### 设计思路

- MQ 选型话术：**可靠性看投递语义 + 持久化配置，顺序性看分区路由，吞吐看批量与压缩**。RabbitMQ 适合企业级业务消息（你这种场景），Kafka 适合日志/大数据流，RocketMQ 两者兼顾且支持事务消息。
- **同步能解决的别上 MQ**：MQ 是权衡后的选择（解耦/削峰/异步化收益 > 一致性变弱的代价），不是为了「架构显得高级」。你的审批 → 凭证场景，同步事务内写凭证表也完全成立——MQ 化的理由是税务通知这种**外部慢调用**不该卡住审批主流程。
- 消息体设计：**传 ID 还是传全量数据？** 传 ID（消费者回查，数据总是最新，但多一次查询）；传全量（自包含，但可能读到旧快照）。财务凭证建议传 ID + 关键金额快照（金额按审批那一刻定格）。
- 任何消费者上线前回答：重复消费会怎样？——答不上来不上线。

### 自检清单

- [ ] 生产端消息发送是 Outbox 事务内落库吗？
- [ ] 消费端手动 ack 吗？重试与进 DLQ 的边界（可重试错误 vs 业务错误）分清了吗？
- [ ] 每个消费者都幂等吗？
- [ ] 需要顺序的消息按业务 key 分区了吗？
- [ ] 积压有监控告警吗？DLQ 有告警和重放工具吗？

---

## 十、系统韧性

### 概念

韧性回答：**依赖坏了的时候，我怎么办？** 你的系统依赖数据库、Redis、MQ、税务接口、对象存储——它们每一个都会挂，只是时间问题。四个武器：**超时**（别傻等）、**重试**（临时故障再给次机会）、**熔断**（对方病了就别再添乱）、**降级**（核心功能优先活命）。外加**限流**（保护自己不被打垮）。

### Case 1：税务平台卡顿，拖死整个审批服务

税务平台接口正常 200ms，故障时 30s 不返回。你的审批接口同步调用它：

```typescript
// ❌ 无超时：每个请求占住一个连接 30 秒
// 审批 QPS 10 → 300 个挂起请求 → 连接池耗尽 → 整个财务系统所有接口全部超时
async approve(id: string) {
  await prisma.paymentOrder.update({ ... });
  await axios.post('https://tax-api.example.com/issue', payload); // 没有 timeout！
}
```

**方案：超时 + 重试 + 熔断三件套**

```typescript
import CircuitBreaker from 'opossum';

// ① 超时：任何外部调用必须有 deadline，这是底线
const taxClient = axios.create({ timeout: 3000 }); // 3 秒，按 P99 延迟定

// ② 重试：只对幂等 + 临时性错误重试，指数退避
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = e.code === 'ECONNRESET' || e.response?.status >= 500;
      if (!retryable || i >= retries) throw e; // 4xx 业务错误绝不重试
      await sleep(200 * 2 ** i + Math.random() * 100); // 退避 + 抖动，防重试风暴
    }
  }
}

// ③ 熔断：失败率超阈值 → 直接快速失败，给对方恢复时间
const breaker = new CircuitBreaker(
  (payload: unknown) => callWithRetry(() => taxClient.post('/issue', payload)),
  { timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 30000 },
);
breaker.fallback(() => ({ queued: true })); // ④ 降级：熔断期间转为"进开票队列，稍后补开"
```

熔断期间开票请求转入 Outbox 表（第三章的本地消息表），由后台任务在税务平台恢复后补开——**降级不是放弃，是换条路走**。

### Case 2：Excel 导入接口被脚本刷爆

有人写脚本循环调你的流水导入接口，每次上传 10MB Excel，服务器 CPU 全在解析文件，正常用户打不开页面。

**方案：限流（令牌桶）**

```typescript
// 网关层（Nginx/网关限流是第一道），应用层用 Redis 做分布式限流
async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSec);
  return count <= limit;
}

@Post('import')
async import(@CurrentUser() user: AuthUser) {
  // 每用户每分钟最多 5 次导入
  if (!(await rateLimit(`rl:import:${user.id}`, 5, 60))) {
    throw new HttpException('操作过于频繁，请稍后再试', 429);
  }
  // ...
}
```

粗粒度（全局限流）在网关做，细粒度（按用户/按接口）在应用做；突发场景用令牌桶（允许短时突发），平滑场景用漏桶。

### 设计思路

- **超时是必需品，其他是优化品**。没有超时的重试是灾难放大器（30s 的请求重试 3 次 = 占 90s）；没有幂等的重试是资损制造机（第二章）。
- 熔断三态：闭合（正常）→ 打开（快速失败）→ 半开（放少量请求试探）。参数按依赖的 SLA 定：P99 延迟决定 timeout，错误率阈值决定何时断开。
- **舱壁隔离**：给不同依赖分配独立资源池（税务接口的 HTTP 连接池 vs 对象存储的连接池），一个依赖的故障不挤占其他依赖的资源。Node 里天然单线程事件循环帮助很大，但连接池、队列长度仍需手动隔离。
- 降级预案要**提前写好、演练过**，故障时现想降级方案等于没有。
- 韧性设计的检验方法： chaos 一把——把税务接口 mock 成 30s 延迟，看系统表现。

### 自检清单

- [ ] 所有外部调用（HTTP/RPC/MQ/DB）都设了超时吗？
- [ ] 重试只作用于幂等操作和临时性错误吗？有退避和抖动吗？
- [ ] 关键外部依赖有熔断器和降级路径吗？
- [ ] 高频/重资源接口有限流吗？
- [ ] 不同依赖的资源池隔离了吗？

---

## 十一、性能与伸缩性

### 概念

性能优化的第一原则：**先测量，再优化**（慢查询用 EXPLAIN，接口用 APM 火焰图）。伸缩性的核心是**无状态**——应用实例不存任何会话/文件，任意一台挂了流量切走即可，扩容量 = 加机器。

### Case 1：对账列表页打开要 4 秒

接口内部：查对账单 → 循环 200 个客户逐个查客户信息 → 循环查每条汇总金额。

```typescript
// ❌ N+1 查询：1 + 200 + 200 = 401 次数据库往返
const statements = await prisma.statement.findMany({ where: { month } });
for (const s of statements) {
  s.customer = await prisma.customer.findUnique({ where: { id: s.customerId } });
  s.total = await prisma.detail.aggregate({ where: { statementId: s.id }, _sum: { amount: true } });
}
```

**方案：include 一次 JOIN + 聚合下推**

```typescript
const statements = await prisma.statement.findMany({
  where: { month },
  include: { customer: { select: { id: true, name: true } } }, // 1 次 JOIN
});
// 聚合交给数据库 GROUP BY，一次查完所有 statementId
const totals = await prisma.statementDetail.groupBy({
  by: ['statementId'],
  where: { statementId: { in: statements.map((s) => s.id) } },
  _sum: { amount: true },
});
// 401 次 RTT → 2 次。4 秒 → 80ms
```

### Case 2：客户主数据每次请求都查库

**方案：多级缓存**

```
请求 → L1 进程内缓存（lru-cache，TTL 10s，抗热 key）
     → L2 Redis（TTL 5min，多实例共享）
     → DB
```

缓存三大经典问题及对策：

| 问题 | 现象 | 对策 |
|---|---|---|
| 穿透 | 查询不存在的 id，每次打穿到 DB | 缓存空值（TTL 30s）/ 布隆过滤器 |
| 击穿 | 热点 key 过期瞬间，万请求同时重建 | 互斥重建：`SET lock NX`，抢到的查库，其他等待 |
| 雪崩 | 大量 key 同时过期 | TTL 加随机抖动（300s ± 60s） |

```typescript
async getCustomer(id: string) {
  const key = `customer:${id}`;
  const cached = await redis.get(key);
  if (cached !== null) return cached === 'NULL' ? null : JSON.parse(cached); // 空值缓存防穿透

  const locked = await redis.set(`lock:${key}`, '1', 'EX', 5, 'NX');
  if (!locked) { await sleep(50); return this.getCustomer(id); } // 没抢到锁稍等重试（击穿互斥）

  try {
    const data = await prisma.customer.findUnique({ where: { id } });
    const ttl = 300 + Math.floor(Math.random() * 60); // 抖动防雪崩
    await redis.set(key, data ? JSON.stringify(data) : 'NULL', 'EX', ttl);
    return data;
  } finally {
    await redis.del(`lock:${key}`);
  }
}
```

### Case 3：文件上传把无状态打破了

用户上传的 Excel 存到了实例本地磁盘 `/tmp`，下次请求被负载均衡到另一台实例，文件找不到。

**方案：一切外部化**

- 文件 → 对象存储（S3/OSS），本地只做过渡；
- 会话 → JWT / Redis，不进内存；
- 定时任务 → 调度中心（第七章）；
- WebSocket 连接 → 有状态服务单独部署或走网关粘性会话。

### 设计思路

- 性能问题排序：**N+1 和缺索引（改代码，收益 100 倍）> 缓存（收益 10 倍，引入复杂度）> 连接池调优（收益个位数百分比）**。先干收益大的。
- 连接池常识：池大小 ≈ DB 能承受的前提下 `((核数 * 2) + 磁盘数)` 量级，盲目开大反而慢（上下文切换）；所有实例连接数之和 < DB max_connections 的 80%。
- 缓存是**优化不是架构**——先让 DB 查询正确高效，缓存只用于读多写少、容忍短暂旧值的数据。
- Node 服务的 CPU 密集操作（大 Excel 解析、PDF 生成）会阻塞事件循环 → 丢给 worker_threads 或独立 worker 服务。

### 自检清单

- [ ] 列表接口有没有 N+1？（日志里数 SQL 条数）
- [ ] 聚合是数据库 groupBy 还是拉回内存算？
- [ ] 缓存三问题（穿透/击穿/雪崩）都有对策吗？
- [ ] 应用有任何本地状态吗（内存 session、磁盘文件、内存队列）？
- [ ] CPU 密集任务隔离出主服务了吗？

---

## 十二、接口契约与数据生命周期

### 概念

接口和表结构一旦被别人依赖，**修改就是破坏**。两条纪律：契约只增不删（字段可加不可删不可改语义）；数据有生死（热数据在线、温数据归档、冷数据封存，删除走软删+留痕）。

### Case 1：改了个字段名，前端白屏 + 对账 JOB 失败

你把对账单接口的 `totalAmount` 改名 `total`，前端未同步上线 → 页面 `undefined`；夜间对账 JOB 解析失败。

### 方案与代码

**契约演进规则**：

1. **加字段**：随意，向后兼容（旧客户端忽略新字段）；
2. **删字段/改名/改类型**：走「加新字段 → 双写/双返过渡期 → 消费者全部迁移 → 旧字段下线」四步，跨越至少一个发布周期；
3. **破坏性变更躲不掉**：版本号隔离 `GET /api/v2/statements`，v1 保留到消费者清零；
4. **契约测试**：用 OpenAPI 生成 schema，CI 里跑契约比对， breaking change 直接红。

```typescript
// 过渡期双返（新旧字段都给），日志统计旧字段的消费方
return {
  id: stmt.id,
  total: stmt.total.toString(),
  totalAmount: stmt.total.toString(), // @deprecated 2026-09-01 下线，已通知前端组
};
```

**DB schema 变更同理——先兼容后清理**：

```text
需求：statement 表的 month 字段从 'YYYY-MM' 字符串改为 year + month 两列

第 1 步（兼容期）：ALTER 加新列（允许 NULL）→ 代码双写新旧列 → 刷历史数据
第 2 步（切换期）：读取切到新列 → 观察一个账期
第 3 步（清理期）：旧列停止写入 → 下线旧列
—— 每一步都可回滚，永不存在"代码和表结构必须同时上线"的死锁窗口
```

### Case 2：客户被「删除」后，历史发票全部变成无主数据

```typescript
// ❌ 物理删除：发票表 customerId 成了悬空外键，3 年前的审计无法回溯
await prisma.customer.delete({ where: { id } });
```

**方案：软删除 + 审计字段，财务数据永不物理删**

```prisma
model Customer {
  id        String    @id
  name      String
  status    String    @default("ACTIVE") // ACTIVE / ARCHIVED
  deletedAt DateTime? // 软删除标记
  createdBy String
  updatedBy String
  updatedAt DateTime  @updatedAt
  // 关键业务（凭证、流水）还要完整操作留痕表 audit_log：谁、何时、改了什么、旧值新值
}
```

**数据分层与归档**：

| 层 | 数据 | 存储 | 访问 |
|---|---|---|---|
| 热 | 近 12 个月明细 | 在线库主表 | 在线查询 |
| 温 | 1-3 年 | 在线库归档表（同结构，无在线索引负担） | 低频查询，可走从库 |
| 冷 | 3 年以上 | 归档库 / Parquet 文件存 OSS | 审计调取，异步导出 |

归档 JOB 每月把到期数据「复制到归档表 → 校验行数和合计金额一致 → 删主表」，**先验证再删除**，归档本身是资损风险点。

### 设计思路

- 契约管理 = 承诺管理。对外（含前端、JOB、第三方）的每个字段都是承诺，**加字段是自由的，收承诺是有流程的**。
- 财务系统的删除语义：**业务删除（软删，可恢复）≠ 数据删除（物理，永不）**。凭证、流水只有「作废/红冲」状态，没有 delete。
- 归档策略要在表设计时就定好分区键（按 `trade_date` 范围分区），事后补分区是亿级表的噩梦。

### 自检清单

- [ ] 接口字段的删/改有四步过渡流程吗？有契约测试吗？
- [ ] 财务核心表都是软删除 + 审计字段吗？有物理 delete 的代码路径吗？
- [ ] 大表有分区键和归档策略吗？归档流程先验证后删除吗？

---

## 十三、可观测性

### 概念

系统出问题时，「定位速度」取决于平时的可观测建设。三根支柱：**日志**（发生了什么）、**指标**（整体健康度）、**追踪**（一次请求经过了哪些环节，慢在哪）。目标是：**故障时 5 分钟内定位到哪个服务、哪个依赖、哪类错误。**

### Case：凌晨对账 JOB 失败，排查两小时才发现是税务接口超时

没有 traceId，日志散在 3 台实例上，grep 了半小时才拼出请求链路。

### 方案与代码

**1. 结构化日志 + traceId 贯穿全链路**

```typescript
// NestJS 拦截器：每个请求生成/继承 traceId，注入 AsyncLocalStorage
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const traceId = req.headers['x-trace-id'] ?? randomUUID();
    return als.run({ traceId, userId: req.user?.id }, () => next.handle());
  }
}

// 日志统一 JSON 输出（pino），每条自动带 traceId
logger.info({ msg: 'statement generated', statementId, customerId, durationMs: 230 });
// → {"level":"info","traceId":"a1b2","statementId":"s123","durationMs":230,...}
// ELK/Loki 里按 traceId 一查，整次请求的所有日志全部聚齐
```

**2. 指标（Prometheus）——四个黄金信号**

```typescript
// 延迟、流量、错误、饱和度，每个接口自动埋点
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 1, 3, 10],
});
```

财务系统特有关键指标（业务可观测，比技术指标更早发现问题）：

```typescript
// 业务指标：技术正常但业务异常的唯一发现手段
metrics.gauge('reconcile_diff_count', diffCount);          // 对账差异数
metrics.gauge('voucher_daily_total', total);               // 当日凭证金额（突降=业务断了）
metrics.gauge('outbox_pending_messages', pending);         // 待投递消息积压
metrics.gauge('dlq_message_count', dlqCount);              // 死信数量
```

**3. 告警分级**

| 级 | 例子 | 通道 |
|---|---|---|
| P0 | 对账差异 > 阈值、凭证金额归零、DLQ 持续增长 | 电话/短信 |
| P1 | P99 延迟超阈值、错误率 > 1%、消息积压 | 企业微信 |
| P2 | 慢查询 TopN、磁盘 80% | 邮件日报 |

告警第一原则：**每个告警都必须可行动**。「CPU 高」但不用处理的告警只会培养忽略告警的习惯（告警疲劳）。

### 设计思路

- traceId 要**穿透 MQ**：生产消息时把 traceId 放进消息头，消费端继承——异步链路的日志才能串起来。
- 日志三不：**不记敏感信息（脱敏）、不用同步写、不 print 调试**。错误日志必须带上下文（哪个单、哪个客户、入参摘要），只打一句 `error occurred` 的日志等于没打。
- 先建业务指标再建技术指标——「凭证数异常」比「CPU 异常」更接近真实故障。

### 自检清单

- [ ] 每个请求/消息有 traceId 且贯穿 MQ 吗？
- [ ] 日志结构化、脱敏、带业务上下文吗？
- [ ] 四个黄金信号 + 核心业务指标有看板吗？
- [ ] 告警分级且每条可行动吗？

---

## 十四、发布、迁移与回滚

### 概念

最后一道韧性：**我自己发布挂了怎么办？** 原则：发布可灰度（先 1 台，再全量）、DB 变更可前滚可回滚、出事先回滚再排查（恢复优先于定位）。

### Case：上线新对账逻辑，同时执行了删列 SQL，回滚后数据没了

代码 bug 需要回滚，但旧代码依赖被删的列——**DB 变更不可逆，代码回滚无效**。

### 方案与代码

**1. DB 迁移纪律（与第十二章呼应）**

- 所有变更走迁移工具（Prisma Migrate / Flyway），禁止手改库；
- **只允许向后兼容的变更随代码一起发布**：加表、加列（可空/有默认值）、加索引（在线 DDL）；
- 危险变更（删列、改类型、加 NOT NULL）必须拆到后续版本，走「兼容期→切换期→清理期」；
- 大表 DDL 用 pt-online-schema-change / gh-ost，避免锁表。

**2. 发布策略**

```text
灰度（金丝雀）：1 台实例跑新版本 → 观察核心指标（错误率、对账差异数）15 分钟 → 全量
财务系统加成：避开月结窗口发布；重大变更后第一时间手工抽核一笔对账结果
```

**3. 回滚预案模板（每个上线单必填）**

```markdown
- 回滚方式：切回上一镜像版本（预计 2 分钟）
- DB 兼容性：本次变更仅加列，旧代码可正常运行 ✅
- 数据修复：若新逻辑已产生错误凭证，执行修复脚本 fix_xxx.sql（已准备）
- 决策人：回滚由值班 TL 决定，无需等开发到场
```

**4. 配置与密钥**

- 配置与代码分离（环境变量/配置中心），**密钥永不进 git**（用 Vault/KMS 或至少加密的环境变量）；
- 功能开关（Feature Flag）：新对账算法用开关包起来，出问题关开关即可，不用回滚部署。

### 自检清单

- [ ] 每次发布能 5 分钟内回滚吗？DB 变更与旧代码兼容吗？
- [ ] 迁移脚本是版本化管理的吗？危险 DDL 拆期了吗？
- [ ] 高风险功能有 Feature Flag 吗？
- [ ] 上线单里有回滚预案和数据修复脚本吗？

---

## 十五、总自检清单

设计任何一个功能时，按此过一遍（打印出来贴工位）：

**正确性**
- [ ] 并发下：先查后改改条件更新了吗？扣减用原子表达式了吗？
- [ ] 重复下：接口幂等吗？MQ 消费幂等吗？回调去重了吗？
- [ ] 多写时：一个事务吗？跨服务有 Outbox + 对账兜底吗？

**钱的正确性（财务专属）**
- [ ] 金额全链路无 number 吗？舍入规则统一吗？分摊有余数处理吗？
- [ ] 已过账数据只能红冲不能改吗？余额变动有链式校验吗？

**防御性**
- [ ] 入参有 Zod schema 吗？金额有正数/精度/上限吗？
- [ ] 每个查询带归属条件吗？越权返回 404 吗？
- [ ] 外部调用有超时吗？重试幂等吗？有熔断降级吗？

**规模性**
- [ ] 列表游标分页吗？导出异步流式吗？批量写切小事务吗？
- [ ] 核心 SQL EXPLAIN 过吗？定时任务多实例安全且可重跑吗？
- [ ] 数据到千万级，归档策略想清楚了吗？

**运维性**
- [ ] traceId 全链路吗？业务指标有监控吗？告警可行动吗？
- [ ] 发布可灰度可回滚吗？DB 变更兼容旧代码吗？

---

> 这份清单上的每一条，都是从真实事故里长出来的。写代码时多问一遍，上线后就少被叫起来一次。
