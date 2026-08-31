---
title: Ticketmaster 票务系统设计
date: 2026-05-02
order: 10
---

## Ticketmaster 票务系统设计

本文设计的是一个类似 Ticketmaster 的在线票务系统。用户需要能浏览演出、搜索活动，并在高并发场景下安全地购买门票。它最核心的矛盾不是“怎么展示活动列表”，而是如何在热门抢票时既不超卖，又不让体验变得混乱。因此，系统主线可以拆成三条：读路径要能扛住热门活动的超高访问量；写路径要保证绝不 double booking；极端热点活动要有比“所有人一起抢座位”更好的体验策略。

### 问题定义与边界

#### 功能需求

用户能够查看活动详情；用户能够搜索活动；用户能够购买活动门票。

#### 非功能需求

1. 查看和搜索应优先可用性
2. 购票应优先一致性，不能重复售卖同一张票
3. 搜索延迟应尽量低，目标可收敛在 `< 500ms`
4. 系统整体是明显的读多写少，大约可按 `100:1` 理解
5. 系统需要能处理极端热门活动，例如单场活动 `10M` 用户同时关注

#### 本文暂不展开

用户查看已购订单、活动主办方后台、动态定价、退款、转售、黄牛对抗。

### 核心实体、接口与数据模型

#### 核心实体

核心实体包括 `Event`、`Performer`、`Venue`、`Ticket`、`Booking` 和 `User`。其中最值得先讲清楚的是 `Venue` 和 `Ticket` 的关系：`Venue` 保存场馆和 seat map，`Ticket` 表示某场活动里某个座位对应的一张可售票。也就是说，当一个活动创建出来时，系统会基于 Venue 的座位图，为这个活动实例化出一批 `Ticket`。

#### 初始接口

- 查看活动：`GET /events/{eventId}`
- 搜索活动：`GET /events/search?keyword={keyword}&start={start}&end={end}&pageSize={n}&page={p}`
- 下单购票：`POST /bookings/{eventId}`

初始购票接口可以简单设计成 `{ "ticketIds": [...], "paymentDetails": {} }`，这只是一个起点。随着系统深入，我们会把“直接购票”进一步拆成先保留 / 预占座位，再支付确认。

#### 基础数据模型

`Event` 包含 `eventId`、`venueId`、`performerId`、`startTime`、`description`。`Ticket` 包含 `ticketId`、`eventId`、`section`、`row`、`seat`、`price`、`status`、`bookingId`、`reservationExpiresAt`。`Booking` 包含 `bookingId`、`userId`、`ticketIds`、`totalPrice`、`status`。这里 `Ticket.status` 通常至少会演进成三态：`available`、`reserved`、`sold`。

### 核心架构设计

#### 一、用户能够查看活动

查看链路可以先保持直接：客户端请求 `GET /events/{eventId}`，API Gateway 转给 `Event Service`，`Event Service` 从数据库读取活动、场馆、艺人和票务状态，返回给客户端渲染活动页和 seat map。这条链路本质上是读路径，没有强一致性压力，它的重点是响应要快，热门活动时要能扛住高并发刷新。

#### 二、用户能够搜索活动

第一版搜索可以先做一个基础的 `Search Service`，让它根据关键词、日期、地点去查询活动数据。这一步作为高层设计起点完全可以接受，因为它先满足了用户能找到活动的功能需求；至于它在规模上不够好，后面再通过全文索引、专用搜索引擎和缓存继续优化。

#### 三、用户能够购买门票

购票路径是整个系统最重要的部分。最早期的基础版可以这样设计：用户选择若干张票；客户端调用 `POST /bookings/{eventId}`；`Booking Service` 开启数据库事务；检查这些票是否仍可用；如果可用，则创建 `Booking`，并把 `Ticket.status` 更新；成功后返回 `bookingId`。这里只要数据库支持事务，理论上就可以避免同一张票被同时卖给两个人。PostgreSQL 是一个常见选择，因为购票路径需要 ACID 事务、行级更新和并发控制。MySQL 或其他支持事务的数据库也可以胜任，重点不是具体名字，而是票务预占和最终售卖这条链路不能只依赖最终一致。

### 深入讨论

#### 一、为什么需要预占座位

如果系统只在最终提交支付时才检查票是否还在，用户体验会很不稳定：用户挑好票，填了很久支付信息，最后才被告知票已经被别人买走。因此，票务系统通常需要引入“预占座位”的概念。

#### 二、几种常见预占方案

##### 长事务数据库锁

一个直接的做法，是使用 `SELECT ... FOR UPDATE`：用户点中座位后，系统锁住对应行，等待用户在 5 分钟内完成支付。这个方案听起来直接，但问题很明显：数据库锁不适合持有几分钟；高并发下会制造严重锁竞争；用户放弃支付、网络中断、应用崩溃都很难优雅处理。因此，长时间数据库锁不适合作为票务预占方案。

##### 状态 + 过期时间 + 定时任务

更稳妥的做法是给 `Ticket` 增加 `status` 和 `reservationExpiresAt`。当用户选中座位时，将状态从 `available` 改为 `reserved`，同时写入过期时间，例如 `now + 10 minutes`。如果用户完成支付，状态变为 `sold`；如果用户超时放弃，系统再把它恢复成 `available`。一个简单实现方式是用 cron 周期性扫描过期预占，再释放它们。但这个方案仍然有缺点：过期释放不是实时的，cron 出故障会导致大量票长时间被错误占住。

##### 隐式状态 + 短事务

更好的思路是把“是否可预占”判断为 `available` 或者 `reserved` 但 `reservationExpiresAt` 已经过期。也就是说，系统不需要真的等 cron 把状态改回去，任何新的预占事务都可以把“已过期的 reserved”当成可抢占目标。于是事务就可以非常短：开启事务，检查该票是否 `available` 或 `reserved but expired`，如果是则把它更新成 `reserved + new expiration`，提交事务。这样既保留了数据库的一致性保证，又避免了长事务锁。

#### 三、为什么 Redis 在这里仍然有价值

即使 PostgreSQL 已经能保证强一致，Redis 仍然很有帮助，因为这里还有一个“自动到期”的需求。数据库可以做事务，但天然不擅长做“高并发下的临时占位 + 精确过期释放”。Redis 则很适合承担短期 reservation 状态：键过期是原生能力，内存操作延迟低，高并发下抢占速度更快。因此一个常见演进是持久化事实仍在 PostgreSQL，短期 reservation 锁放在 Redis，再配合最终支付确认时回写数据库。这样既保留了数据库里的最终事实，也把高频、短期、可过期的预占状态交给了更合适的存储。

#### 四、如何扩展活动查看路径

当热门活动开票时，活动页会被频繁刷新。这里最大的压力其实不在购票事务，而在读流量，包括活动名称、时间、艺人介绍、场馆信息、seat map 和当前剩余票状态。其中很多信息是高读低写的，非常适合缓存。核心思路是对 `Event`、`Performer`、静态 `Venue` 信息做激进缓存，`Event Service` 做水平扩容，前面用负载均衡均匀分发请求。具体来说，`eventId -> eventObject` 很适合放 Redis / Memcached，静态元数据 TTL 可以较长，票务状态 TTL 应更短，或者走局部失效。这条链路体现的是一个典型原则：一致性重的路径单独保守设计，读多写少的路径尽量通过缓存和水平扩容减压。

#### 五、热门活动里，为什么仅靠实时 seat map 更新还不够

一个自然的改法，是在活动页打开后用 SSE 持续把座位变化推给客户端：某张票被预占或卖出，马上通知正在看这个 seat map 的用户。这比让用户手动刷新强很多，也更符合产品体验。但在极端热门活动里，例如超大明星演出，这个方案还是不够：用户会看到座位瞬间成片消失，页面不断刷新状态，大量用户仍在同时争抢同一小批票。也就是说，实时更新能改善信息滞后，却不能从根本上降低竞争强度。

#### 六、极端热点活动的更优体验：虚拟排队

对超热点活动，更合适的产品化思路是启用 virtual waiting room。核心做法是：用户想进入购票页时，不立即放他进 seat map，而是先把用户放进等待队列；通过 SSE 或 WebSocket 持续告知排队位置；系统按节奏逐步放用户进入购票页；只有被放行的用户，才允许真正发起 reservation / booking。

这个队列可以放在 Redis 里，例如用 sorted set 存排队顺序，再用一个带 TTL 的 `admitted:{eventId}` 集合记录被放行用户。然后 `Booking Service` 在处理 reservation 请求前，先检查当前用户是否已被 waiting room 放行，如果没有就直接拒绝。这个方案的重要性在于，它不是在“更快地抢”，而是在“减少无意义竞争”，从产品体验和系统稳定性两个维度一起降压。

#### 七、搜索为什么不能只靠 SQL LIKE

基础搜索通常会写成 `SELECT * FROM Events WHERE name LIKE '%Taylor%' OR description LIKE '%Taylor%';`，这在数据量大时会很慢，因为 `%keyword%` 往往意味着全表扫描。第一步优化可以是给常用过滤列建索引，做 SQL 优化，用 `LIMIT`，拆 `OR` 为更友好的查询形式，但它对模糊关键词搜索仍然不够好。

更进一步的两种方案是：数据库内全文索引，例如 PostgreSQL 的 `tsvector + GIN`，优点是不引入额外系统，比 `%LIKE%` 快很多，缺点是维护和查询仍然会比普通索引复杂，模糊匹配、纠错等能力有限；外挂全文搜索引擎，例如 Elasticsearch，更适合关键词搜索多、需要 typo tolerance 和更复杂的全文检索能力，但代价是要维护额外集群，要做 SQL -> ES 的 CDC 同步。因此，搜索链路不必一开始就绑定 Elasticsearch：规模较小时可以用数据库索引或 DB 内全文搜索，复杂搜索要求上来后再演进到专用搜索引擎。

#### 八、如何缓存热门搜索结果

Ticketmaster 的搜索还存在另一个很典型的问题：热门艺人、热门城市、热门日期组合会被反复搜索，这非常适合结果缓存。例如缓存 key 可以长成 `search:keyword=Taylor Swift&start=2026-05-01&end=2026-12-31`，然后把对应活动列表缓存一段时间。如果搜索结果不带个性化，还可以继续往前推一层，使用 CDN 或 edge cache，这样很多热门搜索甚至不需要每次都打到搜索服务本体。

### 整体链路

#### 查看活动路径

1. 用户请求 `GET /events/{eventId}`
2. API Gateway 转给 `Event Service`
3. 服务优先命中缓存
4. 未命中则读数据库
5. 返回活动、场馆、艺人和座位信息

#### 搜索路径

1. 用户请求 `GET /events/search`
2. `Search Service` 先查搜索结果缓存
3. 未命中时，查询 DB 全文索引或 Elasticsearch
4. 返回分页结果

#### 预占与购票路径

1. 用户挑选票
2. `Booking Service` 通过短事务把票更新成 `reserved`
3. 返回 `bookingId`
4. 用户完成支付
5. 支付成功 webhook 回来
6. 系统把 `Booking.status` 更新为 `confirmed`
7. 对应 `Ticket.status` 更新为 `sold`

#### 热门活动路径

1. 用户尝试进入购票页
2. 先被放进 virtual waiting room
3. 通过 SSE 获得排队位置更新
4. 被放行后才能进入 seat map 和 reservation 流程

## 参考来源

- [Hello Interview 官方讲解：Ticketmaster](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster)
