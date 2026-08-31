---
title: Twitter 系统设计 Walkthrough
date: 2026-04-26
order: 8
---

## Twitter 系统设计 Walkthrough

本文设计的是一个类似 Twitter 的社交产品。用户可以发推、关注别人，并在首页看到自己和关注者发布的最新内容。它和 `FB News Feed` 的功能表面类似，但这里会把问题空间主动收缩到几条可落地的核心链路：发推、关注、首页时间线和分页。围绕这条主线，设计会先给出一个能工作的基础版本，再逐步演进到时间线生成、celebrity 用户和缓存。

### 问题定义与边界

#### 功能需求

用户能够发推；用户能够关注和取关其他用户；用户能够看到一条按时间倒序排列的首页时间线；用户能够分页浏览更早的推文。

#### 非功能需求

1. 高可用：优先可用性，允许最终一致
2. 低延迟：首页加载希望在 `200ms ~ 500ms` 内完成
3. 大规模：需要支撑亿级到十亿级用户
4. 高扩展：普通用户和 celebrity 用户的访问模式差异极大

#### 本文暂不展开

点赞、评论、转发、引用推，搜索、推荐、广告混排，话题趋势、审核、反垃圾，以及复杂隐私控制和圈子。Twitter 的完整产品面很大，如果不先主动收缩范围，后面的设计就很容易发散。

### 核心实体、接口与数据模型

#### 核心实体

`User`、`Tweet`、`Follow`、`HomeTimeline`、`UserTimeline`。这里最重要的拆分是把“作者自己的发帖流”和“用户首页看到的聚合流”分开：`UserTimeline` 是某个用户自己发过的推文，`HomeTimeline` 是某个用户首页看到的混合时间线。这是整个 Twitter 设计的核心抽象，只要这个拆分立住，后面的 fan-out 讨论都会顺很多。

#### 初始 API

- 发推：`POST /tweets`
- 关注：`PUT /users/{id}/follow`
- 取关：`DELETE /users/{id}/follow`
- 获取首页：`GET /timeline/home?cursor={cursor}&limit={limit}`
- 获取个人页：`GET /timeline/user/{userId}?cursor={cursor}&limit={limit}`

这里的 `cursor` 更适合使用某条推文的时间戳或 tweet ID，而不是页码。时间线数据会持续新增，页码很容易被新插入的数据打乱。

#### 基础数据模型

`Tweet` 主键 `tweetId`，字段 `authorId`、`content`、`createdAt`，索引 `authorId + createdAt`。`Follow` 主键 `followerId + followeeId`，反向索引 `followeeId + followerId`。`HomeTimeline` 主键 `userId`，值为按时间倒序排列的一组轻量 tweet 引用。这里的关键点和前面的 feed 题一样：timeline 里尽量放轻量引用，例如 `tweetId`，正文、作者、媒体等详情在读取时再批量补齐。

### 核心架构设计

#### 一、用户能够发推

基础设计可以保持直接：客户端请求 `POST /tweets`，`Tweet Service` 写入 `Tweet Store`，该推文进入作者自己的 `UserTimeline`。如果只要求“用户能发推并在个人主页看到自己的推文”，到这里已经够了。在工程上，`Tweet Store` 通常会选择一个高写入、按 key 访问友好的存储系统。重点不是具体产品名，而是 tweet 是 append-heavy 的，按 `tweetId` 和 `authorId + time` 两种方式读取很常见，需要容易分片和水平扩展。

#### 二、用户能够关注别人

关注关系本质上是一条单向边：`A -> B` 表示 A 关注了 B。这个结构看起来简单，但它会直接决定发布时要 fan-out 给谁、读取时需要从谁那里聚合内容。所以关系存储至少要支持两类访问：按 `followerId` 查关注列表，按 `followeeId` 查粉丝列表。如果只支持一侧，另一侧链路就会非常痛苦。

#### 三、用户能够看到首页时间线

基础做法是读时聚合：查当前用户关注了哪些人，逐个拉这些人的最近推文，在应用层合并排序，返回最新的一页。这套方案完全能工作，适合作为基础版本。但它的问题也非常明显：用户可能关注很多人，每个被关注者都可能发过很多推文，每次打开首页都要做大量下游查询和排序，这就是典型的 `fan-out on read`。

#### 四、用户能够分页浏览更早内容

分页本身可以通过游标完成：第一次请求不带 cursor，返回最新 `N` 条；后续请求带上当前页最老那条 tweet 的时间戳或 ID；服务只返回更旧的数据。这在 `UserTimeline` 和 `HomeTimeline` 上都适用。相比页码分页，游标分页更稳定，也更符合时间线这种持续追加的数据结构。

### 深入讨论

#### 一、为什么不能一直靠读时聚合

如果一个用户关注了 `1000` 个人，而每个人最近都有几条推文，那么一次首页请求就会扇出大量查询，还要做 merge sort。对小系统来说，这可以接受；对大系统来说，这会变成首页延迟和数据库压力的直接来源。所以更好的思路是把首页时间线提前算出来，也就是引入 `HomeTimeline`：某个作者发新 tweet 时，系统把这条 tweet 的引用提前写进粉丝的 `HomeTimeline`。这样首页读取时，就不再需要去很多作者那里拉数据，而是直接按 `userId` 读自己的 HomeTimeline。这本质上是把一部分计算从读路径前移到写路径，也就是从 `fan-out on read` 转成 `fan-out on write`。

#### 二、为什么又不能对所有人都做写扩散

写扩散能显著降低首页读取成本，但 celebrity 用户会立刻放大它的代价。如果一个普通用户只有几百个粉丝，那么发一条 tweet 时写几百次 `HomeTimeline` 完全可以接受；但如果一个 celebrity 有几千万粉丝，一次发推就会触发灾难级写放大。因此，全推模式并不现实。更合理的方案是混合模型：普通用户走 fan-out on write，celebrity 用户走 fan-out on read。也就是说，对普通用户，tweet 发布后立即写进粉丝首页；对大 V，tweet 只写进自己的 `UserTimeline`，粉丝打开首页时，再把这些大 V 的最新内容动态 merge 进去。这就是这类时间线系统中经典的 `hybrid timeline` 方案。

#### 三、如何把写扩散做成可扩展链路

即使是普通用户，也不应该在发推主请求里同步做所有 fan-out。更合理的流程是：用户发推；`Tweet Service` 把 tweet 写入 `Tweet Store`；同时写入作者自己的 `UserTimeline`；产生一条 tweet-created 事件；事件进入消息队列；`Fanout Worker` 异步消费事件；Worker 查粉丝列表；将 `tweetId` 批量写入这些粉丝的 `HomeTimeline`。这样做好处很明显：发推主链路足够短，fan-out 可以横向扩容，故障时可以重试或回放，系统可以容忍短暂的最终一致延迟。这也是为什么 Twitter 这类系统通常会天然长成“事件驱动架构”。

#### 四、celebrity 推文怎么动态 merge

当系统对大 V 关闭写扩散后，读取首页时就必须补上这一块。一个实用的办法是：先读用户自己的 `HomeTimeline`，再查这个用户关注的大 V 列表，分别拉这些大 V 最近的少量 tweet，和 HomeTimeline 做一次小规模 merge。这里要注意两个边界：大 V 数量通常远小于总关注数，只需要拉每个大 V 最近很小一段内容。因此这一步虽然也是读时聚合，但它只对少数高粉账号发生，不会退化成最原始的“全量关注聚合”。

#### 五、缓存应该放在哪一层

Twitter 这类时间线系统非常依赖缓存，但不能一上来就只喊 Redis。至少有三层缓存值得明确说出来。第一层是 Tweet 详情缓存：时间线里通常只放 tweet 引用，所以读取首页后还要批量补正文、作者、媒体等详情，这些 tweet 详情很适合放在缓存里，因为 tweet 发布后大多数时间只读不改，热 tweet 会被大量重复请求，从缓存里批量读可以显著降低主存储压力。第二层是 HomeTimeline 页缓存：对非常活跃的用户，首页会被频繁刷新，可以把首页前几页短时间缓存起来，例如几十秒，代价是新 tweet 进入 Feed 会有轻微延迟并需要处理失效与覆盖问题，但它能换来更稳定的首页延迟。第三层是社交关系缓存：关注列表和粉丝列表在 fan-out 和读时 merge 中都要频繁使用，因此对热点用户，把关系数据缓存在内存里也非常常见，尤其是 celebrity 的粉丝列表，如果每次都直接查底库，会让 fanout worker 本身成为数据库压力放大器。

#### 六、如何处理热点与不均匀负载

Twitter 最典型的不均匀性来自 celebrity 用户。热点主要会打在三处：粉丝列表读取、tweet 详情读取、首页混合读取。所以系统不仅要分片，更要承认“热点 key 会真实存在”。常见处理方式包括：对 tweet 详情做多副本缓存；对 celebrity 关系数据做专门缓存或预热；将 fan-out worker 和普通时间线 worker 分开；对首页读取做限流、退化和局部缓存。也就是说，困难不在平均负载，而在极端负载。

#### 七、个人页为什么更简单

和首页时间线相比，个人页 `UserTimeline` 要简单得多。因为它只需要按 `authorId` 查某个人自己的推文，按时间倒序分页，这是一条非常规整的单写单读链路，不存在多作者 merge，也没有 fan-out 的问题。首页时间线是复杂路径，个人页时间线是简单路径。把两者分清楚，能更准确地定位系统复杂度的来源。

### 整体链路

#### 发推路径

1. 用户请求 `POST /tweets`
2. `Tweet Service` 写入 `Tweet Store`
3. 同时把 tweet 写入作者的 `UserTimeline`
4. 产生 tweet-created 事件
5. `Fanout Worker` 异步消费
6. 普通用户 fan-out 到粉丝 `HomeTimeline`
7. celebrity 用户跳过预计算，只保留在 `UserTimeline`

#### 关注路径

1. 用户请求 follow / unfollow
2. `Follow Service` 更新 `Follow Store`
3. 同步维护正向和反向查询所需索引

#### 首页读取路径

1. 读取用户自己的 `HomeTimeline`
2. 读取其关注的大 V 列表
3. 拉大 V 最近少量 tweet
4. 做小规模 merge
5. 批量补 tweet 详情
6. 返回最终首页结果

#### 个人页读取路径

1. 根据 `authorId` 读取 `UserTimeline`
2. 按 cursor 分页
3. 批量补详情
4. 返回结果

## 参考来源

- [Hello Interview 社区题目：Design Twitter](https://www.hellointerview.com/community/questions/twitter-clone-feed/cmgfco6rf05in08adz2rut2nw)
