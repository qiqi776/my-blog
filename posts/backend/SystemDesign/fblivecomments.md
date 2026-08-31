---
title: Facebook Live Comments 系统设计
date: 2026-05-01
order: 9
---

## Facebook Live Comments 系统设计

本文设计的是一个类似 Facebook Live Comments 的直播评论系统。用户在观看直播时，可以实时发送评论、实时看到别人发的评论，并在刚进入直播间时先补到最近一段历史评论。它的核心不是“评论怎么存”，而是“评论怎么在极低延迟下广播给海量观众”。这意味着系统既要处理普通写库问题，也要处理长连接、实时推送、跨节点协调和 mega-stream 的流量爆炸问题。

### 问题定义与边界

#### 功能需求

观众能够在直播间发送评论；观众能够在观看直播时看到新评论不断出现；观众能够看到自己加入直播间之前已有的评论。

#### 非功能需求

1. 低延迟：评论应以接近实时的方式广播，典型目标是端到端 `< 200ms`
2. 高可用：优先可用性，最终一致即可
3. 高扩展：系统要能支撑数百万并发直播、以及单个热门直播每秒数千条评论

#### 本文暂不展开

评论回复、评论点赞 / reaction、审核、反垃圾和敏感词、复杂鉴权。

### 核心实体、接口与数据流

#### 核心实体

`LiveVideo`、`Comment`、`ViewerSession`、`RealtimeServer`。其中 `Comment` 最关键的字段通常包括 `commentId`、`liveVideoId`、`authorId`、`content`、`createdAt`。

#### 初始接口

发评论：`POST /comments/{liveVideoId}`；拉历史评论：`GET /comments/{liveVideoId}?before={timestamp}&limit={n}`；订阅实时评论：`GET /stream/{liveVideoId}`。这里 `before` 很关键，因为它天然支持“往上翻更早评论”的 infinite scroll，而不是只支持“某个时间点之后的新评论”。

#### 高层数据流

1. 用户进入直播间
2. 客户端先调用 `GET /comments/{liveVideoId}` 拉最近一屏历史评论
3. 同时建立实时订阅连接
4. 有新评论时，服务端先持久化，再广播给正在观看的客户端
5. 用户继续上滑时，再通过 `before + limit` 拉更早评论

### 核心架构设计

#### 一、观众能够发送评论

基础版本并不复杂：客户端调用 `POST /comments/{liveVideoId}`，`Comment Management Service` 校验请求，把评论写入数据库，返回成功。如果只看“发评论”这个功能，到这里已经成立。数据库本身不需要太复杂，重点是按 `liveVideoId` 查询某个直播间的评论、按时间倒序分页、写入吞吐足够高。因此比较自然的索引模型是主键或分区键包含 `liveVideoId`，排序键包含 `createdAt`。

#### 二、观众能够看到加入之前的评论

当用户进入直播间时，不能只看到新评论，还需要先补一屏历史记录。这条链路和聊天室、私信很像：先拉最近 N 条，用户继续上滑时，再按时间游标拿更旧的数据。因此 `GET /comments/{liveVideoId}?before={timestamp}&limit={n}` 很合适：第一次不带 `before`，返回最近一屏；后续带上当前最旧评论的时间戳，再继续往前翻。这里要特别注意，不要把“历史拉取”和“实时推送”混成一条链路，它们的访问模式完全不同：历史评论更像普通分页查询，新评论更像实时广播。

#### 三、观众能够实时看到新评论

如果让客户端每隔几秒轮询一次，请求数量会非常大，延迟会明显增高，大量请求其实都在问“有没有新评论”。因此，直播评论更适合 push 模型，而不是 polling。这里两个常见选择是 `WebSocket` 和 `Server-Sent Events (SSE)`。在这个场景里，评论流动基本是**服务端单向推送**：客户端虽然会发评论，但完全可以通过普通 `POST` 请求完成；实时通道本身更主要承担“服务器不断把新评论推给观众”这个职责。因此，`SSE` 是一个贴合度很高的默认选择，它的语义本来就是单向推送，浏览器支持自然，也很适合“持续流式返回评论”的场景。基础实时方案可以写成：用户进入直播间时建立 SSE 连接，`Realtime Messaging Server` 记录这个连接正在观看哪个 `liveVideoId`，某条新评论创建后，服务器把评论通过 SSE 推给所有订阅该直播的连接。

### 深入讨论

#### 一、为什么单机实时推送很快就不够用

单机版本里，`Realtime Server` 只需要在内存里维护一个 `liveVideoId -> [viewerConnection1, viewerConnection2, ...]` 的映射，新评论一到，直接遍历对应连接并推送即可。但一旦系统要支撑数百万并发观看者，单机就会马上遇到瓶颈：长连接数量太多；文件描述符、内存、CPU 会成为限制；同一个直播的观众会被分散到多台机器。真正困难的不是“怎么多部署几台机器”，而是“新评论到了某一台机器后，怎么让其他机器上的观众也收到”。

#### 二、横向扩容后，服务器之间如何协调

假设 `Viewer A` 正在 `Server 1` 上看 `LiveVideo 1`，`Viewer B` 正在 `Server 2` 上看 `LiveVideo 1`，如果一条新评论请求打到 `Server 1`，它很容易推给 `Viewer A`，但它并不知道 `Viewer B` 在 `Server 2`。这就需要一个跨节点协调层。

一个能工作的基础方案是 naive pub/sub：`Comment Management Service` 每创建一条评论，就向一个公共 channel 发布消息；所有 `Realtime Messaging Server` 都订阅这个 channel；每台服务器收到后，只把评论转发给本机正在观看该直播的连接。这个方案容易实现，但效率很低，因为每台服务器都会收到所有直播间的评论，即使它本机一个相关观众都没有，也要白白处理这条消息。

#### 三、如何改进 naive pub/sub

更合理的方向是分区式 pub/sub：不再只有一个全局 channel，而是把直播流映射到多个 channel，每台 `Realtime Server` 只订阅自己真正需要的那部分 channel，例如通过 `hash(liveVideoId) % N` 把直播分散到固定数量的 channel 上。

但这又会引出一个新问题：如果负载均衡是 round-robin，那么同一个直播的观众可能被打散到很多服务器上，于是很多服务器都得订阅同一个或很多个 channel，效率还是不理想。所以更进一步的解法是让观众尽量**同播同服**：Layer 7 负载均衡器根据 `liveVideoId` 做一致性路由，尽量把观看同一个直播的观众打到同一批 `Realtime Server`，这样每台服务器需要订阅的 channel 数量更少，也更容易把“收到一条评论后广播给本机连接”这件事做得高效。

#### 四、另一种思路：Dispatcher Service

除了 pub/sub，还可以使用更高级但更复杂的 `Dispatcher Service`。它的思路是反过来：不让所有 `Realtime Server` 自己订阅频道，而是维护一个中心路由器，记录“哪个直播现在在哪些服务器上有观众”。每来一条新评论，`Comment Service` 先问 Dispatcher，Dispatcher 直接把评论转发给那些目标服务器。这个方案的优点是路由逻辑集中、不需要复杂的动态订阅管理、可以做更细的路由策略；代价是状态一致性和运维复杂度更高。通常可以先采用分区式 pub/sub 作为基础方案，再把 Dispatcher 作为更深一层的演进方向。

#### 五、mega-stream 为什么不能再追求“每条评论都送到每个人”

mega-stream 是直播评论系统里很有代表性的极端场景。如果某个超级热点直播间每秒 `5000` 条评论，而用户界面只显示最近 `20` 条，那么每条评论可能只停留几毫秒，人类根本来不及阅读。这时系统目标就变了：重点不再是“每个观众看见每一条评论”，而是“让观众感受到实时热闹的氛围”。也就是说，到了 mega-stream 场景，**完整送达每一条评论**本身就不再有产品价值。

#### 六、mega-stream 的更合理策略：采样

因此，对超级热点直播间，更合理的方案是只展示一个代表性子集。最直接的办法是动态采样：评论量较小时，几乎全量推送；评论量极大时，只按一定比例抽样。例如 `100 comments/s` 时采样 `50%`，`5000 comments/s` 时采样 `1% ~ 2%`，这样每个观众仍能持续看到新评论滚动，但系统不再试图把所有评论都广播给所有人。

采样策略还可以继续变得更聪明：优先展示用户关注的人发的评论、优先展示有互动的评论、优先展示认证账号或高质量评论。这一步已经从“系统设计”自然延伸到了“产品体验优化”，也是这类系统很值得补充的思考。

#### 七、为什么历史评论和实时流要分层

这里还有一个容易忽略的分层原则：历史评论适合查库分页，实时评论适合内存连接广播。如果让实时系统负责“所有历史回放”，或者让数据库承担“所有实时广播”，两边都会变差。因此更清晰的拆法是：`Comment Management Service + DB` 负责写入和历史查询；`Realtime Messaging Server` 负责低延迟推送；`Pub/Sub` 或 `Dispatcher` 负责跨节点协调。一旦这个分层说清楚，系统的大部分复杂度也就随之被拆开了。

### 整体链路

#### 发评论路径

1. 客户端请求 `POST /comments/{liveVideoId}`
2. `Comment Management Service` 持久化评论
3. 服务把新评论事件发给协调层
4. 相关 `Realtime Server` 收到事件
5. 服务器将评论通过 SSE 推给本机正在观看该直播的观众

#### 首次进入直播间路径

1. 客户端请求 `GET /comments/{liveVideoId}`
2. 服务返回最近一屏历史评论
3. 客户端同时建立 `GET /stream/{liveVideoId}` SSE 连接
4. 后续新评论不断通过 SSE 推送

#### 上滑加载更早评论路径

1. 客户端拿到当前最老评论的时间戳
2. 请求 `GET /comments/{liveVideoId}?before={timestamp}&limit={n}`
3. 服务返回更早一页

#### mega-stream 路径

1. 系统检测某直播的评论速度过高
2. 对该直播切换到采样 / 限流模式
3. 每个观众只收到一个代表性子集

## 参考来源

- [Hello Interview 官方讲解：FB Live Comments](https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-live-comments)
