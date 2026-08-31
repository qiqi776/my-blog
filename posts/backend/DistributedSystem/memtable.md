---
title: memtable 详解
date: 2026-05-13
order: 1
---

## LSM 引擎中的 MemTable

在 LSM (Log-Structured Merge-Tree) 存储引擎中，写入性能是最被看重的能力。为了实现高吞吐的随机写入，LSM 将数据首先写入内存中的有序结构，并在达到一定阈值后批量刷写到磁盘上的 SSTable。这个内存中的有序结构，就是 **MemTable**。MemTable 是整个 LSM 写入路径的入口，也是崩溃恢复依赖的 WAL 回放的目标。理解 MemTable 的实现，是深入掌握 LSM 引擎的关键一步。

本文将基于 **跳表 (Skip List)** 实现 MemTable，从其在 LSM 中的定位开始，逐步深入到数据结构、插入查询、迭代器、快照隔离以及冻结等核心机制。

---

### 一、MemTable 在 LSM 中的角色

在典型的 LSM 架构中，一条写入请求的路径如下：

1. 客户端发起 `Put` 或 `Delete` 操作。
2. 操作被序列化为带全局递增序列号 (`Seq`) 的 `record.Entry`。
3. 首先追加到预写日志 (WAL) 以保证持久性。
4. 随后将条目插入活跃的 MemTable（同时更新索引）。
5. 当 MemTable 大小达到预设阈值（如 64MB），引擎将其冻结为只读的 `Immutable`，并创建新的活跃 MemTable 接收后续写入。
6. 后台任务将 `Immutable` 刷写到磁盘，生成新的 SSTable，之后便可以清理对应的 WAL。

从这一流程可以看出，MemTable 充当了“写入缓冲区”的角色，将所有随机的、可能重复的、多版本的写操作在内存中快速排序并去重（按规则保留最新版本），为后续的磁盘合并和查询打下基础。

查询时，引擎需要从**活跃 MemTable、所有不可变 MemTable 以及各级 SSTable** 中收集数据。MemTable 需要提供高效的**点查** (Get) 和**范围扫描** (NewIterator) 能力，并且支持**快照隔离**（即根据读取序列号 `readSeq` 过滤出在该时间点之前已提交的版本）。

因此，一个合格的 MemTable 必须满足：

- **有序存储**，便于二分查找或跳表加速查询；
- **支持多版本**，同一键可存储多个 `Seq` 的条目，且能快速定位某一快照下的可见版本；
- **低内存开销、高写入吞吐**；
- **方便的冻结与遍历导出**，为刷写 SSTable 提供数据。

跳表是实现这一目标的优秀选择。它既具备二叉搜索树的 O(log n) 查找效率，又避免了复杂的平衡旋转，实现简单且性能稳定。

---

### 二、数据模型：record 包

在深入 MemTable 的跳表实现之前，需要先理解 LSM 引擎中**通用的数据单元**，它们在内存表、WAL 日志和 SSTable 之间流转，定义了排序、比较、克隆和边界过滤的规则。`record` 包就是这一基础约定。

**1. 条目类型与操作种类**

```go
type Kind uint8

const (
    KindUnknown Kind = iota
    KindPut
    KindDelete
)
```

LSM 中的每一次写入本质上是一个 `Entry`，它可以是 `KindPut`（写入键值对）或 `KindDelete`（逻辑删除，标记该键已删）。`KindUnknown` 为零值哨兵，防止未初始化状态被误用。

**2. Entry：版本化的键值对**

```go
type Entry struct {
    Key   []byte
    Value []byte
    Seq   uint64
    Kind  Kind
}
```

- **Key / Value**：用户数据。注意所有跨组件传递的 `Entry` 都会经过深拷贝（`CloneBytes`），以保证内存隔离。
- **Seq**：全局单调递增的序列号，实现 MVCC 的关键。序列号越大代表版本越新，引擎可以通过 `readSeq` 过滤器实现快照隔离。
- **Kind**：说明本条目的操作类型，上层合并时可根据 `KindDelete` 丢弃已删除的键。

**3. 排序规则：Key 升序，Seq 降序**

```go
func Compare(a, b Entry) int {
    if cmp := bytes.Compare(a.Key, b.Key); cmp != 0 {
        return cmp
    }
    switch {
    case a.Seq > b.Seq:
        return -1
    case a.Seq < b.Seq:
        return 1
    default:
        return 0
    }
}
```

这条规则贯穿整个 LSM 引擎：

- 先按 Key 的字节字典序升序排列。
- Key 相同时，按 Seq 降序排列，即最新版本（Seq 较大）排在前面。

这种设计让**同键的多个版本在物理上连续存放**，并且最新版本在版本链的头部。点查时，只需一次前向扫描就能找到快照可见的版本；迭代器也只需逐个键处理一次。MemTable 的跳表、SSTable 的数据块、合并迭代器的归并逻辑都依赖这一约定。

**4. Batch：原子写入单元**

```go
type Batch struct {
    SeqStart uint64
    Entries  []Entry
}
```

一次 `WriteBatch` 在上层被转换为 `Batch`，其中 `SeqStart` 是该批次的起始序列号，批次内各 `Entry` 的具体 `Seq` 可以依次分配。`Batch` 是 WAL 日志中的持久化单位，回放时可直接恢复至 MemTable。

**5. KeyBounds：键范围约束**

```go
type KeyBounds struct {
    Lower []byte
    Upper []byte
}
```

- 描述一个**左闭右开区间 `[Lower, Upper)`**。
- `Contains(key)` 方法判断键是否在范围内。
- `NormalizeSeek(key)` 用于修正迭代器定位：如果用户传入的起始键比下界还小，则提升到下界，避免无效扫描。

在 MemTable 的迭代器中，`bounds` 会过滤掉不符合范围的条目；在 SSTable 索引中，`KeyBounds` 用于描述每个数据块的起止键。

**6. 深拷贝与不可变性**

所有 `Entry`、`Batch`、`KeyBounds` 都提供了 `Clone()` 方法，其内部使用 `CloneBytes` 进行字节级复制。这样保证了数据在组件间传递时完全独立，任何一方修改切片都不会影响其他组件。MemTable 的 `Add` 方法在插入前会调用 `entry.Clone()`，正是对这一原则的贯彻。

---

### 三、跳表的基本结构

本文实现的 MemTable 使用一个**头节点哨兵**和基于概率的多层索引结构。跳表节点定义如下：

```go
type node struct {
    entry record.Entry  // 存储的条目
    next  []*node       // 每层前向指针，数组长度即节点高度
}
```

`Entry` 是 LSM 的数据载体，包含 `Key`、`Value`、`Seq` (序列号) 和 `Kind` (操作类型)。排序规则是：**先按 Key 升序，Key 相同时按 Seq 降序**。这样同一个键的多个版本会被紧邻存放，并且最新版本 (Seq 最大) 排在第一个，查找时只需一次前向扫描。

跳表 `Table` 包含以下字段：

```go
type Table struct {
    head   *node   // 哨兵头节点，next 数组长度固定为 maxHeight
    height int     // 当前实际使用的最高层级
    rng    uint64  // 伪随机数状态
    size   int64   // 近似内存大小 (字节)
    count  int     // 条目个数
}
```

其中 `maxHeight` 被设置为 20，允许最多 20 层索引。随机高度生成算法保证平均高度约为 1.33，节点高度大于 1 的概率为 1/4，每增一层概率再乘 1/4。这种分布使得跳表在大多数情况下能够提供对数级的查找性能。

---

### 四、插入流程：`Add` 方法

插入是整个 MemTable 最频繁的操作，需要兼顾正确性和性能。核心方法是 `Add(entry record.Entry)`，其流程如下：

**1. 克隆输入**  
`entry = entry.Clone()` 确保表内数据与外部隔离，防止调用者后续修改切片内容影响内部数据。

**2. 查找各层前驱**  
调用 `findPrev(entry, update[:])` 从最高层向第 0 层搜索，`update[level]` 记录了该层插入位置的前一个节点。

```go
func (t *Table) findPrev(entry record.Entry, update []*node) {
    cur := t.head
    for level := t.height - 1; level >= 0; level-- {
        for cur.next[level] != nil && record.Compare(cur.next[level].entry, entry) < 0 {
            cur = cur.next[level]
        }
        update[level] = cur
    }
}
```

**3. 原地替换优化**  
如果第 0 层前驱的下一个节点与待插入条目完全相等（Key 相同且 Seq 相同），说明是同一版本的更新。此时直接原地替换 `entry` 并修正估算大小，**不增加节点**。这样避免了重复版本造成的内存浪费和查找时版本链变长。

**4. 生成随机高度并调整表高**  
`height := t.randomHeight()` 决定新节点的层数。如果新高度超过了当前表的最高层 `t.height`，则需要将多出来的层的 `update[i]` 指向哨兵 `head`，并更新 `t.height`。

**5. 在各层插入新节点**  
创建新节点，并将它的 `next` 指针指向各层前驱的原后继，然后修改前驱的 `next` 指向新节点，完成插入。同时更新统计信息 `size` 和 `count`。

整个插入操作的时间复杂度期望为 O(log n)，空间复杂度与节点高度成正比。原地替换策略使得更新操作通常只修改节点值，不增加节点数，减轻了内存压力和 GC 负担。

---

### 五、查询：基于快照隔离的 `Get`

点查方法 `Get(key []byte, readSeq uint64)` 返回满足 `Seq <= readSeq` 且属于该键的最新可见条目。其实现巧妙地利用了排序规则。

**定位起始节点**  
调用 `lowerBound(entry)` 方法，查找第一个 `≥ {Key: key, Seq: math.MaxUint64}` 的节点。由于排序规则中 Seq 降序，将目标 Seq 设为最大意味着：如果该键存在，定位到的将是该键**版本链中最新的那个节点**（即 Seq 最大的节点）。如果键不存在，则返回下一个键大于目标键的节点或 nil。

```go
func (t *Table) lowerBound(entry record.Entry) *node {
    cur := t.head
    for level := t.height - 1; level >= 0; level-- {
        for cur.next[level] != nil && record.Compare(cur.next[level].entry, entry) < 0 {
            cur = cur.next[level]
        }
    }
    return cur.next[0]
}
```

**沿版本链找到可见版本**  
从起始节点开始，沿着第 0 层的 `next` 指针遍历同一键的所有版本（它们连续存放），找到第一个 `Seq <= readSeq` 的条目，即为该快照应看到的版本。若遍历完所有版本仍未找到（所有 Seq 均大于 readSeq），则说明该键在快照时刻尚未写入，返回 `false`。如果找到的条目是 `KindDelete`，同样返回，由上层决定是否过滤。

这一设计充分利用了跳表的“排序+链表”特性，无需额外索引即可支持版本链遍历，平均复杂度 O(log n + K)，K 为同一键的版本数，通常很小。

---

### 六、迭代器与可见性推进

为了支持范围扫描和合并多组件数据，MemTable 提供了专用的迭代器 `Iterator`。它直接工作在跳表节点上，动态过滤出满足 `readSeq` 和 `bounds` 的条目，每个键仅返回最新可见版本。

迭代器的核心是一个名为 `advanceVisible` 的推进方法：

```go
func (it *Iterator) advanceVisible() bool {
    for it.cur != nil {
        if !it.bounds.Contains(it.cur.entry.Key) {
            it.cur = nil
            return false
        }
        key := it.cur.entry.Key
        for it.cur != nil && bytes.Equal(it.cur.entry.Key, key) {
            if it.cur.entry.Seq <= it.readSeq {
                return true
            }
            it.cur = it.cur.next[0]
        }
    }
    return false
}
```

该方法在每次定位（`First`、`Seek` 或 `Next`）后被调用，执行以下逻辑：

1. **越界检查**：若当前节点 Key 超出 `bounds`，直接结束。
2. **版本链扫描**：对当前键，沿第 0 层指针向后扫描，寻找第一个 `Seq <= readSeq` 的版本。找到则停在此处，返回 `true`。
3. **跳过不可见键**：若该键所有版本都不可见（如所有 Seq 均大于 readSeq），则自动跳到下一个键，重复以上过程。

`Next` 方法在移动到下一个键时，会先通过循环跳过当前键的所有剩余版本：

```go
key := it.cur.entry.Key
for it.cur != nil && bytes.Equal(it.cur.entry.Key, key) {
    it.cur = it.cur.next[0]
}
```

然后再调用 `advanceVisible` 处理新键。

这种设计避免了全量拷贝数据，迭代器仅持有当前节点的引用，内存开销极小。同时，由于它内部包含 `readSeq` 和 `bounds`，上层合并逻辑（如 `collectVisibleEntries`）无需重复过滤，可以直接使用迭代器返回的条目。

---

### 七、冻结与不可变表

当 MemTable 大小达到阈值，引擎会将其“冻结”，以便后续刷写到磁盘。冻结操作通过 `Freeze()` 方法生成一个 `Immutable` 只读视图：

```go
type Immutable struct {
    table *Table
}

func (t *Table) Freeze() *Immutable {
    return &Immutable{table: t}
}
```

`Immutable` 包装了底层 `Table`，但只暴露只读操作：

- `Get(key, readSeq)`：点查
- `NewIterator(readSeq, bounds)`：范围扫描
- `Entries()`：导出所有条目（用于刷盘）
- `ApproximateSize()`：获取大小

冻结后，引擎会将此 `Immutable` 加入不可变表队列，并创建新的活跃 `Table`。后台 flush 协程则会从 `Immutable` 中遍历所有条目，写入 SSTable，最后清理对应的 WAL 文件。由于 `Immutable` 不会再次被修改，这一过程无需加锁，简单高效。

---

### 八、内存估算与随机高度

为了精确控制 MemTable 的大小，实现中使用 `approximateSize` 函数估算每个条目的内存开销：

```go
func approximateSize(entry record.Entry) int64 {
    return int64(len(entry.Key) + len(entry.Value) + 24)
}
```

这里的 `24` 字节是节点结构体、指针等固定开销的粗略估计。每次插入、原地替换时都同步更新 `t.size`，使得 `ApproximateSize()` 能返回一个相对合理的值，作为冻结阈值判断的依据。

随机高度生成使用了简单的 xorshift 伪随机算法，种子在创建表时确定（可以通过 `NewWithSeed` 指定，便于测试复现）。`randomHeight` 利用随机数低两位是否为 0 来决定是否增加高度，从而生成符合概率分布的高度值：

```go
func (t *Table) randomHeight() int {
    height := 1
    for height < maxHeight && t.nextRand()&0x3 == 0 {
        height++
    }
    return height
}
```

---

### 九、总结

本文详细分析了一个基于跳表的 MemTable 实现，展现了它如何作为 LSM 引擎的写入缓冲和读取加速器协同工作。总结其核心设计要点：

- **跳表数据结构**：利用多层索引实现 O(log n) 查找和插入，概率平衡避免复杂旋转。
- **多版本与快照隔离**：通过 Key 升序、Seq 降序的排序规则，以及版本链扫描，支持任意快照下的点查和范围扫描。
- **原地替换优化**：相同版本更新时直接替换节点值，减少内存分配和版本链长度。
- **轻量级迭代器**：基于节点指针遍历，动态过滤可见性，避免全量拷贝，为合并多组件数据提供高效基础。
- **冻结与不可变表**：通过只读视图无缝切换，支持后台刷盘而不阻塞写入。
- **内存估算与概率高度**：提供大小控制依据和稳定的随机平衡。

MemTable 是整个 LSM 树上最活跃的部分，它的设计直接影响写入延迟和读取性能。理解这些细节，不仅能够帮助我们更好地调优存储引擎，也为学习更复杂的 SSTable 格式、合并策略以及崩溃恢复奠定了坚实的基础。
