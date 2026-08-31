---
title: Raft 算法详解（上）
date: 2026-08-09
order: 3
---

# Raft 算法详解（上）

## 一、引言：为什么需要 Raft？

在分布式系统中，数据一致性是一个核心挑战。当多台服务器组成集群协同工作时，如何保证它们对同一份数据达成一致的认知？这个问题被称为**共识问题**（Consensus Problem）。

在 Raft 出现之前，Paxos 算法一直是分布式共识领域的主流。然而，Paxos 不管从理解上还是工程实现上难度都非常高。正如 Raft 论文作者所言，Paxos 虽然理论正确性已被充分验证，但工程化门槛极高，基于 Paxos 的成熟工程实践非常稀少。

2013 年，Diego Ongaro 和 John Ousterhout 发表了 Raft 算法，其核心目标简洁而有力：**设计一个易于理解和实现的共识算法**。
研究表明，Raft 的可理解性显著优于 Paxos：在两所大学的实验中，33 名学生能准确回答 Raft 相关问题，而仅有 10 人能理解 Paxos。正因如此，Raft 迅速成为 Etcd、Consul、TiKV 等主流分布式系统的默认共识算法。

> **本文是 Raft 算法详解系列的上篇**，将重点围绕 Raft 的设计哲学、领导者选举和日志复制两大核心机制展开。安全性、集群成员变更等进阶内容将在下篇中详细探讨。

## 二、Raft 的设计哲学

### 2.1 多数派原则

任何决策只要获得超过半数节点的同意，就代表整个系统接受了这个决策。这种设计提高了可用性，不用等待系统中最慢的节点。同时，任意两个多数派集合必然有交集，这为后续的安全性提供了数学保证。

### 2.2 复制状态机

状态机是真正存储数据的地方，比如一个键值存储。Raft 不会直接修改状态机，而是先把每条写请求记录成一条预写日志。日志是一个有序数组，每条记录包含任期号、索引和具体指令。只要保证所有节点的已提交日志前缀完全一致，各自状态机执行的结果就必然相同，这就解决了顺序一致性问题。

### 2.3 三种节点角色

在任意时刻，Raft 集群中的每个服务器都处于以下三种状态之一：

```go
type NodeState uint8

const (
    Follower  NodeState = iota // 跟随者，被动接收并复制领导者的日志，响应投票请求
    Candidate                  // 候选者，用于在选举中竞争成为领导者
    Leader                     // 领导者，处理所有客户端请求，管理日志复制，定期发送心跳维持权威
)
```

节点启动时默认都是跟随者状态。这三种角色之间的转换由 Raft 算法严格规定，下一节将详细展开。

### 2.4 单一领导者

Raft 采用了一种 **“强领导者”** 的设计哲学。与一些对称式的共识算法不同，Raft 将一切决策权集中到领导者手中：只有领导者能处理客户端的写请求；日志条目只能从领导者流向跟随者；领导者决定何时将日志条目提交。如果跟随者收到了写请求，会直接转发给领导者。读请求则可以被任意节点处理，这带来的是最终一致性的读——如果要求读到的一定是最新数据，就需要额外的机制。

这种设计大幅简化了日志复制的管理——因为只有一个权威来源，不需要复杂的冲突协调逻辑。

### 2.5 两阶段提交

第一阶段叫“提议”：领导者把新日志追加到本地，然后向所有跟随者广播同步这条日志。当半数以上节点都确认收到后，就进入第二阶段“提交”。领导者将这条日志标记为已提交，应用到状态机，然后向客户端返回成功。这样一来，一次写请求的延迟只取决于多数派中最慢的那个节点，而不是全集群最慢的节点，可用性大大提高。

### 2.6 任期

Raft 把时间划分成一个个连续的任期，每个任期以一次选举开始。任期号单调递增，是节点判断信息新旧的核心依据。如果你收到的消息任期比自己小，说明那是过去的信息，直接拒绝；如果任期比自己大，说明自己落后了，立刻更新任期并退回到跟随者状态。每个任期最多只有一个领导者，如果选举没能产生领导者，这个任期就过去了，不会留下双主。

## 三、领导者选举（Leader Election）

### 3.1 选举的触发条件

Raft 使用**心跳机制**来触发领导者选举。

领导者会定期向所有跟随者发送心跳消息（不携带日志条目的 `AppendEntries` RPC），以维护自己的权威。每个跟随者都维护一个**选举超时时间**（Election Timeout）——如果在这个时间内没有收到来自领导者的任何通信，跟随者就会认为领导者已经失效，从而触发新一轮选举。

**关键设计：随机化超时**

为了防止多个跟随者同时超时并发起选举导致选票被瓜分，Raft 使用了**随机化的选举超时时间**。超时时间通常从一个固定区间（如 150ms 到 300ms）中随机选择。这样，大多数情况下只有一个服务器会先超时，它能在其他服务器超时之前赢得选举并发送心跳。

### 3.2 选举流程

当一个跟随者超时未收到心跳时，它会启动选举流程：

**第一步：成为候选者**

- 将自己的**任期号 +1**；
- 转换状态为**候选者**（Candidate）；
- **给自己投一票**；
- 重置选举超时计时器。

**第二步：请求投票**

- 向集群中的所有其他节点并行发送 **`RequestVote` RPC**（请求投票）；
- RPC 中包含候选人的任期号、候选人 ID，以及候选人最后一条日志的索引和任期。

```go
// RequestVoteArgs 请求投票的参数
type RequestVoteArgs struct {
    Term         uint64 // 候选人的任期号
    CandidateId  uint64 // 请求投票的候选人 ID
    LastLogIndex uint64 // 候选人最后一条日志的索引
    LastLogTerm  uint64 // 候选人最后一条日志的任期号
}

// RequestVoteReply 请求投票的响应
type RequestVoteReply struct {
    Term        uint64 // 应答者的当前任期号，候选人据此更新自己
    VoteGranted bool   // 是否投出赞成票
}
```

发起选举的代码大致如下，`startElection` 在选举计时器超时后被调用：

```go
func (r *Raft) startElection() {
    r.currentTerm++          // 任期号 +1
    r.state = Candidate      // 转为候选者
    r.votedFor = r.id        // 给自己投一票
    r.persist()              // 持久化 currentTerm 和 votedFor
    r.resetElectionTimer()   // 重置随机化选举超时

    args := &RequestVoteArgs{
        Term:         r.currentTerm,
        CandidateId:  r.id,
        LastLogIndex: r.lastLogIndex(),
        LastLogTerm:  r.lastLogTerm(),
    }

    votes := 1 // 自己的那一票
    for _, peer := range r.peers {
        if peer == r.id {
            continue
        }
        go func(peer uint64) {
            var reply RequestVoteReply
            if !r.sendRequestVote(peer, args, &reply) {
                return
            }

            r.mu.Lock()
            defer r.mu.Unlock()

            // 收到更高任期，立即退回跟随者
            if reply.Term > r.currentTerm {
                r.becomeFollower(reply.Term)
                return
            }
            // 任期或状态已变化，本次响应作废
            if r.state != Candidate || args.Term != r.currentTerm {
                return
            }
            if reply.VoteGranted {
                votes++
                if votes > len(r.peers)/2 { // 过半即当选
                    r.becomeLeader()
                }
            }
        }(peer)
    }
}
```

**第三步：等待结果**

候选者会一直处于候选者状态，直到发生以下三种情况之一：

#### 情况一：赢得选举

如果候选者在同一任期内获得了**超过半数**（`N/2 + 1`）节点的投票，它就赢得了选举。

> **为什么是“超过半数”？** 这个数学特性保证了**同一个任期内不可能有两个不同的候选者同时获得过半票数**，从而天然杜绝了“双主”问题。

赢得选举后，候选者成为新的领导者，并立即向所有其他服务器发送心跳消息，以建立权威、防止新的选举。

#### 情况二：收到更高任期的心跳

在等待投票时，候选者可能会收到来自另一个节点的 `AppendEntries` RPC，声称自己是领导者。此时候选者会检查该 RPC 中的任期号：

- 如果领导者的任期**大于等于**候选者的当前任期，候选者承认该领导者合法，**立即退回到跟随者状态**；
- 如果 RPC 中的任期**小于**候选者的当前任期，候选者**拒绝**该 RPC，继续保持候选者状态。

这个机制确保了**一旦有更高任期的领导者出现，所有旧任期的候选者都会自动降级**。

#### 情况三：选举超时（选票被瓜分）

如果多个跟随者几乎同时成为候选者，选票可能被瓜分，导致没有任何候选者获得多数票。发生这种情况时，每个候选者都会超时，然后**增加自己的任期号**并启动新一轮选举。

由于每个候选者的超时时间是**随机**的，最先超时重启选举的节点有很大概率赢得多数票，从而快速解决僵局。

### 3.3 投票的严格规则

一个节点在收到 `RequestVote` 请求后，并不会无条件投票。Raft 规定了严格的投票条件：

**条件一：任期检查**

- 如果请求中的任期号**小于**自己当前的任期号，**直接拒绝**。

**条件二：先到先得**

- 在每个任期内，每个节点**只能投出一张选票**（投给最先到达的候选人）。如果已经投过票，则拒绝后来的所有请求。

**条件三：日志新旧比较（安全性核心）**

- 这是最关键的规则。投票者会比较候选人与自己的**最后一条日志**：
  - 首先比较**最后一条日志的任期号**（`LastLogTerm`）：任期号更大的日志更新；
  - 如果任期号相同，则比较**最后一条日志的索引号**（`LastLogIndex`）：索引更大的日志更新。
- **只有候选人的日志至少和投票者一样新**，投票者才会投出赞成票。

这条规则保证了**胜出的领导者一定拥有所有已提交的日志**，是 Raft 安全性的核心保障。

三个条件对应到 `RequestVote` 的处理逻辑：

```go
func (r *Raft) RequestVote(args *RequestVoteArgs, reply *RequestVoteReply) {
    r.mu.Lock()
    defer r.mu.Unlock()

    reply.VoteGranted = false

    // 条件一：任期检查——请求的任期过旧，直接拒绝
    if args.Term < r.currentTerm {
        reply.Term = r.currentTerm
        return
    }
    // 请求任期更大：先更新自己的任期并退回跟随者，本任期尚未投票
    if args.Term > r.currentTerm {
        r.becomeFollower(args.Term)
    }
    reply.Term = r.currentTerm

    // 条件二：先到先得——本任期内已投给别人，拒绝
    if r.votedFor != None && r.votedFor != args.CandidateId {
        return
    }

    // 条件三：候选人的日志必须至少和自己一样新
    if !r.isLogUpToDate(args.LastLogTerm, args.LastLogIndex) {
        return
    }

    r.votedFor = args.CandidateId
    r.persist()
    r.resetElectionTimer() // 投出赞成票后重置计时器，避免自己也发起选举
    reply.VoteGranted = true
}

// isLogUpToDate 判断候选人日志是否不旧于本节点：先比任期，任期相同再比索引
func (r *Raft) isLogUpToDate(lastTerm, lastIndex uint64) bool {
    myTerm, myIndex := r.lastLogTerm(), r.lastLogIndex()
    if lastTerm != myTerm {
        return lastTerm > myTerm
    }
    return lastIndex >= myIndex
}
```

### 3.4 当选后的“立威”：No-op 日志

新领导者当选后，还有一个容易被忽略但至关重要的步骤——**立即追加并复制一条 No-op（无操作）日志**。

为什么需要 No-op 日志？因为 Raft 规定，**领导者只能提交“当前任期”的日志**。No-op 日志属于当前任期，当它被成功复制到半数以上节点并提交后，领导者的**领导权才算真正被集群确认**。此时，上一任期的遗留日志才会被**顺带**自动提交。

在 TinyKV 等工程实现中，No-op 日志是**明确要求**的——新当选的领导者必须立即追加 No-op 日志并广播给所有跟随者。

```go
func (r *Raft) becomeLeader() {
    r.state = Leader

    // 领导者的易失性状态在每次选举后重新初始化
    last := r.lastLogIndex()
    for _, peer := range r.peers {
        r.nextIndex[peer] = last + 1 // 乐观假设跟随者与自己完全同步
        r.matchIndex[peer] = 0
    }

    // 立即追加一条当前任期的 No-op 日志，用于确认领导权、
    // 并顺带提交上一任期遗留的日志
    r.log = append(r.log, LogEntry{
        Index: last + 1,
        Term:  r.currentTerm,
        Data:  nil, // No-op：状态机执行时直接跳过
    })
    r.persist()

    r.broadcastAppendEntries() // 立刻广播，建立权威
}
```

## 四、日志复制（Log Replication）

### 4.1 日志的结构

在 Raft 中，日志是由一系列**日志条目**（Log Entry）组成的

```go
// LogEntry 是日志中的一个条目
type LogEntry struct {
    Index uint64 // 日志索引，从 1 开始连续递增
    Term  uint64 // 创建该条目的领导者的任期号
    Data  []byte // 状态机指令（No-op 条目为 nil）
}
```

`(Index, Term)` 这个二元组是 Raft 中日志条目的唯一标识：只要两个节点上某个索引处的任期号相同，就可以断定这两条日志是同一条指令。

### 4.2 日志复制的完整流程

一旦领导者被选出，它就开始为客户请求提供服务。日志复制的流程如下：

**第一步：接收请求**

- 领导者接收客户端的写请求，将指令封装为一个新的日志条目；
- 将该条目**追加到自己的本地日志中**。

**第二步：并行复制**

- 领导者向所有跟随者**并行**发送 `AppendEntries` RPC，其中包含新的日志条目；
- 如果跟随者崩溃、运行缓慢或网络数据包丢失，领导者会**无限期地重试** `AppendEntries` RPC。

```go
// AppendEntriesArgs 日志复制的参数，Entries 为空时即为心跳
type AppendEntriesArgs struct {
    Term         uint64     // 领导者的任期号
    LeaderId     uint64     // 领导者 ID，供跟随者重定向客户端请求
    PrevLogIndex uint64     // 新条目之前那一条日志的索引
    PrevLogTerm  uint64     // PrevLogIndex 处日志的任期号
    Entries      []LogEntry // 需要复制的日志条目（心跳时为空）
    LeaderCommit uint64     // 领导者的 commitIndex
}

// AppendEntriesReply 日志复制的响应
type AppendEntriesReply struct {
    Term    uint64 // 应答者的当前任期号，领导者据此更新自己
    Success bool   // PrevLogIndex/PrevLogTerm 是否匹配成功

    // 快速回退优化用字段，见 4.4 节
    ConflictTerm  uint64 // 跟随者在 PrevLogIndex 处的任期号
    ConflictIndex uint64 // 该任期在跟随者日志中的最早索引
}
```

跟随者侧的处理逻辑体现了一致性检查与强制覆盖：

```go
func (r *Raft) AppendEntries(args *AppendEntriesArgs, reply *AppendEntriesReply) {
    r.mu.Lock()
    defer r.mu.Unlock()

    reply.Success = false

    // 任期过旧的领导者，拒绝
    if args.Term < r.currentTerm {
        reply.Term = r.currentTerm
        return
    }
    // 任期 > 自己：承认对方是合法领导者，无条件退回跟随者
    if args.Term > r.currentTerm {
        r.becomeFollower(args.Term)
    } else if args.Term == r.currentTerm {
        // 任期相等时，根据当前角色决定行为
        if r.state == Leader {
            // Leader 绝不能接受同任期的 AppendEntries（可能是过期或伪造消息）
            return
        }
        if r.state == Candidate {
            // Candidate 收到同任期的 AppendEntries，说明当前任期已有合法 Leader
            r.becomeFollower(args.Term)
        }
    }

    reply.Term = r.currentTerm
    r.resetElectionTimer() // 收到合法心跳，推迟选举

    // 一致性检查：PrevLogIndex 处必须存在且任期匹配
    if !r.matchLog(args.PrevLogTerm, args.PrevLogIndex) {
        reply.ConflictIndex, reply.ConflictTerm = r.findConflict(args.PrevLogIndex)
        return
    }

    // 逐条比对，遇到第一个冲突点就截断并追加剩余条目
    for i, entry := range args.Entries {
        if entry.Index <= r.lastLogIndex() && r.termAt(entry.Index) != entry.Term {
            r.log = r.log[:r.sliceIdx(entry.Index)] // 删除冲突条目及其之后的所有日志
        }
        if entry.Index > r.lastLogIndex() {
            r.log = append(r.log, args.Entries[i:]...)
            break
        }
    }
    r.persist()

    // 推进 commitIndex，但不能超过本地最后一条日志
    if args.LeaderCommit > r.commitIndex {
        r.commitIndex = min(args.LeaderCommit, r.lastLogIndex())
        r.applyCond.Signal() // 唤醒 applier 协程应用到状态机
    }
    reply.Success = true
}
```

注意最后一句 `min(args.LeaderCommit, r.lastLogIndex())`：跟随者的日志可能落后于领导者的提交点，因此绝不能盲目采用 `LeaderCommit`。

**第三步：等待多数派确认**

- 领导者等待跟随者的响应；
- 当**超过半数**的节点成功复制了该日志条目后，该条目被认为**已提交**（Committed）。

**第四步：应用与响应**

- 领导者将该日志条目**应用到自己的状态机**中；
- 领导者将执行结果**返回给客户端**；
- 在后续的 `AppendEntries` RPC（包括心跳）中，领导者会携带**已提交的日志索引**，通知跟随者哪些日志可以应用到它们的状态机中。

### 4.3 关键数据结构

为了追踪每个跟随者的同步进度，领导者维护了两个重要的**易失性状态**（Volatile State）：

- **`nextIndex[]`** ：对每个跟随者，记录要发送给它的**下一条日志的索引**。初始化为领导者最后一条日志的索引 + 1。
- **`matchIndex[]`** ：对每个跟随者，记录已成功复制到该节点的**最高日志索引**。初始为 0。

把前面提到的状态汇总起来，就是论文 Figure 2 中的完整节点状态：

```go
type Raft struct {
    mu    sync.Mutex // 保护以下所有字段
    id    uint64     // 本节点 ID
    peers []uint64   // 集群中所有节点的 ID（含自身）

    // ---- 持久化状态：必须在响应 RPC 之前落盘 ----
    currentTerm uint64     // 见过的最大任期号，初始为 0
    votedFor    uint64     // 当前任期内投票给的候选人（None 表示还没投）
    log         []LogEntry // 日志条目，索引从 1 开始

    // ---- 所有节点的易失性状态 ----
    commitIndex uint64 // 已知已提交的最高日志索引，初始为 0
    lastApplied uint64 // 已应用到状态机的最高日志索引，初始为 0

    // ---- 仅领导者的易失性状态，每次选举后重新初始化 ----
    nextIndex  map[uint64]uint64 // 下一条要发给各跟随者的日志索引
    matchIndex map[uint64]uint64 // 各跟随者已复制成功的最高日志索引

    // ---- 运行时辅助状态 ----
    state         NodeState   // 当前角色
    electionTimer *time.Timer // 随机化的选举超时计时器
    applyCond     *sync.Cond  // commitIndex 推进时唤醒 applier
    applyCh       chan ApplyMsg
}
```

三组字段的划分不是随意的：**持久化状态**决定了崩溃重启后能否正确恢复（丢失 `votedFor` 就可能在同一任期投出两票，直接破坏选举安全性）；**易失性状态**可以从日志重建；**领导者状态**只在任期内有意义，因此每次当选都要重置。

`matchIndex` 的另一个作用是推进提交点。领导者不需要单独计票，只要 `matchIndex` 的中位数越过某个索引，就说明该条目已被多数派复制：

```go
// advanceCommitIndex 找出被多数派复制的最大索引并提交
func (r *Raft) advanceCommitIndex() {
    matches := make([]uint64, 0, len(r.peers))
    for _, peer := range r.peers {
        if peer == r.id {
            matches = append(matches, r.lastLogIndex())
        } else {
            matches = append(matches, r.matchIndex[peer])
        }
    }
    sort.Slice(matches, func(i, j int) bool { return matches[i] > matches[j] })

    // 降序排列后，第 N/2 个位置即为“过半节点都已达到”的索引
    n := matches[len(r.peers)/2]

    // 关键约束：只能提交当前任期的日志条目
    if n > r.commitIndex && r.termAt(n) == r.currentTerm {
        r.commitIndex = n
        r.applyCond.Signal()
    }
}
```

最后那个 `r.termAt(n) == r.currentTerm` 的判断，正是 3.4 节 No-op 日志存在的原因：领导者不能仅凭“副本数过半”就提交上一任期的日志，必须借由一条当前任期的条目被提交来间接确认。

### 4.4 日志不一致的处理

在实际运行中，由于网络分区、节点宕机等原因，不同节点的日志可能会出现不一致。Raft 通过以下机制强制同步：

**第一步：一致性检查**

- 领导者发送 `AppendEntries` RPC 时，会附带**前一条日志的索引**（`PrevLogIndex`）和**前一条日志的任期**（`PrevLogTerm`）。

**第二步：逐级回退**

- 跟随者检查自己日志中 `PrevLogIndex` 位置的条目是否与 `PrevLogTerm` 匹配；
- 如果不匹配，跟随者**拒绝**该请求，并在响应中告知领导者冲突信息；
- 领导者收到拒绝后，将 `nextIndex` **减 1**，然后用新的索引重试。

**第三步：强制覆盖**

- 这个过程会一直回退，直到找到领导者与跟随者**完全相同的最后一个日志条目**（任期和索引都匹配）；
- 一旦找到匹配点，领导者把该匹配点**之后的所有日志条目**发送给跟随者；
- 跟随者**删除**自己不匹配的旧日志，**覆盖**成领导者的日志。

**核心原则**：领导者**从不删除或覆盖自己的日志**；只有跟随者要向领导者看齐。

**工程优化：快速回退**

在实际实现中，“一次减 1”的方式效率较低。优化方案是让跟随者在拒绝响应中返回**冲突日志条目的任期号**以及该任期对应的**最早索引**，领导者可以一次性跳过整个冲突任期，大幅加快同步速度。

```go
// 领导者处理 AppendEntries 的响应
func (r *Raft) handleAppendEntriesReply(
    peer uint64, args *AppendEntriesArgs, reply *AppendEntriesReply,
) {
    if reply.Term > r.currentTerm {
        r.becomeFollower(reply.Term)
        return
    }
    if r.state != Leader || args.Term != r.currentTerm {
        return // 状态已变，丢弃过期响应
    }

    if reply.Success {
        // 用本次请求的内容推进，而不是用 lastLogIndex，避免乱序响应导致回退
        r.matchIndex[peer] = args.PrevLogIndex + uint64(len(args.Entries))
        r.nextIndex[peer] = r.matchIndex[peer] + 1
        r.advanceCommitIndex()
        return
    }

    // 快速回退：一次跳过整个冲突任期，而非 nextIndex--
    if reply.ConflictTerm == 0 {
        // 跟随者日志太短，直接跳到它的末尾之后
        r.nextIndex[peer] = reply.ConflictIndex
    } else if idx, ok := r.lastIndexOfTerm(reply.ConflictTerm); ok {
        // 领导者也有这个任期：从该任期的最后一条之后重试
        r.nextIndex[peer] = idx + 1
    } else {
        // 领导者没有这个任期：整段跳过
        r.nextIndex[peer] = reply.ConflictIndex
    }
    r.sendAppendEntries(peer) // 立即重试，不必等下一次心跳
}
```

原始方案在跟随者落后 N 条日志时需要 N 个 RTT，而快速回退把代价降到“冲突任期的个数”这个量级，在实践中通常只需一两轮。

### 4.5 Raft 的日志匹配属性

Raft 的日志机制保证了两个重要属性，它们共同构成了**日志匹配属性**（Log Matching Property）：

1. **相同索引和任期 → 相同命令**：如果两个日志中的条目具有相同的索引和任期号，则它们存储的是**相同的命令**。这源于领导者在给定任期内最多创建一个具有给定索引的条目。

2. **相同索引和任期 → 前序全部相同**：如果两个日志中的条目具有相同的索引和任期号，那么在该条目**之前的所有条目都是相同的**。这个属性由 `AppendEntries` 的一致性检查保证。

这两个属性共同确保了：一旦某个日志条目在某个节点上被确认，它在所有节点上的前序日志都是完全一致的。

## 五、总结与预告

本文作为 Raft 算法详解的上篇，我们探讨了：

1. **Raft 的设计哲学**：为什么需要 Raft、强领导者模型、三种节点角色以及任期机制；
2. **领导者选举**：从触发条件、完整流程到投票的严格规则，以及 No-op 日志的重要性；
3. **日志复制**：日志结构、完整复制流程、不一致处理机制以及日志匹配属性。

Raft 通过“**选总统、记日志、保安全**”这三个清晰的步骤，优雅地解决了分布式系统中的数据一致性问题。其设计目标——**易于理解和实现**——贯穿于每一个细节之中。

在下篇中，我们将继续深入探讨：

- **安全性**（Safety）：Raft 如何通过选举限制、领导者只追加等规则保证数据绝不丢失；
- **日志压缩**（Log Compaction）：如何通过快照（Snapshot）机制防止日志无限增长；
- **集群成员变更**（Membership Change）：如何在不停机的情况下安全地增加或移除节点；
- **客户端交互**与**线性一致性**：Raft 如何保证客户端看到的数据是一致的。

敬请期待！

## 参考资料

- [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf)
- [The Raft Consensus Algorithm](https://raft.github.io/)
