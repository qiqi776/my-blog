---
title: 分布式限流器系统设计
date: 2026-04-14
order: 1
---

## 分布式限流器系统设计

分布式限流器负责在 API 请求进入核心业务服务之前，判断某个客户端是否已经超出配额，并在必要时直接返回 `429 Too Many Requests`。它表面上像一个小组件，但一旦进入生产级系统，就会暴露出一组典型的分布式设计问题：限流器到底该放在哪里；客户端该按什么维度识别；用什么算法来定义“超额”；如何在多实例下共享一致的限流状态；以及如何扩展到非常高的请求量，同时避免热点 key 把单个分片打爆

### 问题定义与边界

#### 功能需求

1. 系统能够按用户 ID、IP 地址或 API Key 识别客户端
2. 能够对不同客户端应用不同限流规则
3. 能够在请求到来时判断该请求是否允许通过
4. 能够返回剩余配额与重置时间，供响应头使用

#### 非功能需求

1. 限流判断延迟要低，最好接近网关层常规处理开销
2. 系统需要高可用，不能轻易把整个 API 网关拖垮
3. 规则判断需要全局一致，不能因为多实例部署而形同虚设
4. 目标规模可以按约 `1M requests/s`、`10M users` 来考虑

### 核心实体、接口与规则模型

#### 核心实体

核心实体包括 `Rule`、`Client` 和 `Request`。`Rule` 表达限流策略，例如：登录用户每小时 `1000` 次请求、某个搜索接口每分钟 `10` 次、某个 API Key 每秒 `100` 次。`Client` 可以是用户 ID、IP 地址、API Key 或它们的组合

#### 初始接口

限流器的核心接口可以抽象为 `isRequestAllowed(clientId, ruleId) -> { passes: boolean, remaining: number, resetTime: timestamp }`。这个接口返回的不只是“过/不过”，还带上剩余可用配额和预计重置时间，业务服务或网关可以把这些信息写入标准响应头 `X-RateLimit-Remaining` 与 `X-RateLimit-Reset`

#### 规则粒度

真实系统里通常不止有一条规则，而是多条规则叠加，例如 per-user、per-IP、per-API-key、per-endpoint 和全局限制。因此一次请求到来时，系统往往需要匹配多条规则，并执行“最严格限制”

### 核心架构设计

#### 一、限流器应该放在哪里

##### 应用进程内限流

最简单的办法是每个应用实例都在自己内存里记一份计数器。这种方式的优点很直接：极快、不需要额外网络调用、实现最简单。但它在多实例下几乎立刻失效。例如，用户每分钟最多 `100` 次请求，现在有 `5` 台应用服务器，如果负载均衡把请求分散到 5 台机器，每台机器都可能只看到 `20` 次，于是各自判断为“未超额”。但从全局看，用户已经打满甚至超过限制，任何一台机器都无法单独拦截。所以 in-process 限流最多只适合单实例系统，或者允许非常粗糙的近似限流

##### 独立限流服务

进一步的做法是把限流器拆成独立服务：业务服务在处理请求前先 RPC 给 rate limiter，rate limiter 读取共享状态，返回 allow/deny。这能保证全局状态一致，也给业务层更多上下文，但每个请求多一次网络 hop，业务服务和限流服务之间新增依赖，如果限流服务挂了，业务服务要决定 fail-open 还是 fail-closed

##### 边缘限流

更贴近生产环境的常见方案是把限流器直接放到 API Gateway 或 Load Balancer 边缘，这样每个请求在进入业务服务之前先经过限流判断。这种部署方式有几个直接好处：被拦截的请求不会再进入应用层，业务服务不需要再承担被拒绝请求的开销，逻辑位置更符合“网关守门人”。同时，它也有明确约束：网关层能看到的信息有限，主要只能依赖 HTTP 请求自身信息，例如 path、headers、IP、JWT/API Key。在大多数 HTTP API 系统里，把限流前移到网关或负载均衡层，通常是更稳妥的默认选择

#### 二、该按什么识别客户端

一旦限流器放在网关层，下一步就是定义 client identity。最常见的三类是 `userId`、`IP address` 和 `API key`。实际生产里往往不会只用一种，而是叠加：已登录用户按 `userId`，匿名流量按 `IP`，开发者接口按 `API key`。系统甚至可能同时检查多条规则，例如用户自身没超额，但它所在 IP 已经超额，那也应该被挡住

### 深入讨论

#### 一、该用什么限流算法

限流算法决定了系统如何定义“超额”，也是整个设计里最核心的取舍。常见算法至少有四种：

1. **Fixed Window Counter**：按固定时间桶计数，例如每分钟一个桶。优点是极其简单、状态量小；缺点是边界效应很严重，用户可以在 `12:00:59` 打满 `100` 次，再在 `12:01:00` 立刻再打 `100` 次，等于在 2 秒里打出 200 次请求
2. **Sliding Window Log**：为每个用户保存所有请求时间戳，实时滑动统计最近窗口。优点是最精确；缺点是内存开销很大，每次判断都要处理大量时间戳
3. **Sliding Window Counter**：用“当前桶 + 上一个桶”的加权近似来模拟真实滑动窗口。优点是比 fixed window 准、比 sliding log 省内存；缺点是仍然只是近似，实现要更细心
4. **Token Bucket**：把每个客户端想成一个 token bucket，bucket 有容量上限，token 以固定速率恢复，每次请求消耗一个 token，没 token 就拒绝。它的优势非常适合真实 API 流量：能处理短时 burst，又能限制长期平均速率，状态量小，只需记录当前 token 数和上次 refill 时间。因此，`Token Bucket` 通常是分布式 API 限流器的默认选择

#### 二、Token Bucket 的状态放在哪里

一旦系统是多台网关实例，bucket 状态就不能放在每台机器自己的内存里，否则又会回到“每台机器只看到局部流量”的问题。因此我们需要一个共享且足够快的状态存储，常见选择是 `Redis`。每个客户端在 Redis 里保存一份 bucket，包含 `tokens` 和 `lastRefill`。一条典型流程是：请求进入某台 API Gateway，网关按 `clientId + ruleId` 找到 Redis 中的 bucket，根据 `lastRefill` 计算应补充多少 token，计算新 token 数，如果足够则扣减并放行，如果不够则拒绝

#### 三、为什么“单个 Redis 操作是原子”还不够

这里有一个很典型的竞态：两个请求几乎同时打到不同网关实例，它们都读到“当前还有 1 个 token”，两边都认为自己可以放行，最终 token 被超卖。问题的根源在于，我们真正需要原子的不是某一次 `GET` 或 `SET`，而是整个 `read -> compute -> write` 序列。因此，正确的做法是扩大原子边界，常见实现包括 `MULTI/EXEC` 或 Lua script，其中 Lua script 往往更适合把读取状态、计算补 token、判断是否放行和更新状态放在一次 Redis 执行里完成，这才是真正解决 contention 的关键

#### 四、如何扩展到 `1M requests/s`

如果所有请求都打一台 Redis，显然不现实。更合理的扩展方式是按 `clientId` 做 consistent hashing，把不同客户端的 bucket 分散到 Redis Cluster 多个 shard，这样每个 shard 只负责一部分 client state。扩展路径通常是 API Gateway 水平扩容，Redis 按 key 分片。因为大多数客户端之间是天然独立的，只要 hash 做得均匀，写入就能比较自然地扩展

#### 五、rate limiter 为什么也会有 hot key

限流器本质上是写密集系统，但 hot key 问题并不只发生在读系统里。如果某个单独的用户、IP 或 API key 请求量极高，就会出现同一个 bucket key 被极高频率访问，单个 Redis shard 被打爆。这可能来自恶意攻击、错配客户端或合法但极高吞吐的数据采集任务。这类 hot key 可以分成两种情况处理：面向合法高吞吐客户端，鼓励 client-side rate limiting 和请求 batching/queuing，让“高频但善意”的调用方在客户端侧平滑流量，避免持续用尖峰冲击同一个 key；面向恶意流量，在命中限流过多次后临时 blocklist，并在更外层接入 DDoS 防护服务。这体现了一个现实原则：rate limiter 本身不该独自承担所有流量清洗职责

#### 六、规则和状态应该如何失效

bucket state 并不需要永久存在。如果某个客户端很久没有请求，继续保留它的 token bucket 只会浪费内存。因此一个自然的优化是给 bucket key 设置 TTL，例如 1 小时或更长的不活跃后自动过期，这样 Redis 不会因为海量长尾客户端而无限膨胀

#### 七、限流器挂了怎么办：fail-open 还是 fail-closed

这是生产系统里绕不过去的问题。如果 Redis 或限流判断链路短暂故障，有两种典型策略：Fail-Open 暂时放行请求，风险是下游服务承压；Fail-Closed 暂时拒绝请求，风险是把本来正常的流量也挡掉。在大多数用户面向型 API 场景里，更常见的是倾向 fail-open，同时配合更粗粒度的全局兜底限流，因为相比误放一小段时间流量，直接把整个 API 全拒绝通常更伤用户体验。更准确的表达不是绝对选择其中一种，而是根据业务性质区分：对支付、风控类接口可能更保守，对普通内容 API 更可能偏 fail-open

### 整体链路

#### 请求路径

1. 客户端请求到达 API Gateway
2. 网关从请求中提取 client identity
3. 查出适用的 rule 集合
4. 对每条 rule 调用限流判断
5. 每次判断通过 Redis 原子脚本执行 token bucket 更新
6. 若任何规则不通过，则直接返回 `429`
7. 全部通过，则把请求转发到下游业务服务

#### 状态路径

1. 每个 `clientId + ruleId` 对应一个 bucket key
2. bucket 状态保存在 Redis Cluster
3. key 按 consistent hashing 分散到各 shard
4. 不活跃 bucket 通过 TTL 自动淘汰

## 参考来源

- [Hello Interview 官方讲解：Distributed Rate Limiter](https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-rate-limiter)
