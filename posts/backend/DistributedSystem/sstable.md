---
title: SSTable 详解
date: 2026-05-14
order: 2
---

## LSM 引擎系列(二)：SSTable 与版本管理

在上一篇文章中，我们深入分析了 LSM 引擎的内存核心——基于跳表的 MemTable。MemTable 解决了高吞吐写入和有序存储的问题，但内存终究有限，数据必须持久化到磁盘，才能在崩溃后恢复，并容纳远超内存容量的数据集。在 LSM 中，这一任务由 **SSTable (Sorted String Table)** 和 **Version (版本元数据)** 共同承担。

SSTable 是磁盘上不可变的有序数据文件，由 MemTable 刷写 (flush) 或 Compaction 生成。Version 则维护着整个系统中所有 SSTable 的层级布局、键范围、序列号区间等元信息，是引擎读取路径的“导航地图”。本文将结合 `sstable` 和 `version` 两个包的实现，详细拆解 SSTable 的文件格式、读写流程，以及 Version 如何管理这些文件并支撑高效的查询路由。

---

### 一、SSTable 文件结构总览

一个 SSTable 文件由四个连续的部分组成：

```
+-------------------+
|   Data Blocks     |   ← 实际存储的条目，按 Key 排序，分成固定大小的块
+-------------------+
|   Index Block     |   ← 每个 Data Block 的起始/结束 Key 及其文件偏移
+-------------------+
|   Bloom Filter    |   ← 布隆过滤器，快速排除不存在的 Key
+-------------------+
|     Footer        |   ← 48字节固定尾部：魔数 + Index/Bloom 的位置和长度
+-------------------+
```

文件从前往后顺序写入 Data Block，最后将 Index、Bloom Filter 和 Footer 一次性追加到文件末尾。由于 Footer 长度固定为 48 字节，打开文件时只需从末尾回跳 48 字节即可读取到所有元信息，进而定位 Index 和 Bloom Filter，实现高效的随机读取。

这种设计约定由三个常量定义：

```go
const (
    tableMagic  = uint64(0x4d4b565353543031) // 魔数 "MKVSST01"
    footerSize  = 48
    filePattern = "%06d.sst"                 // 文件名如 000001.sst
)
```

魔数 `tableMagic` 是文件合法性的第一道关口，`filePattern` 则通过六位数字编号保证了文件的有序性和唯一性。

---

### 二、构建 SSTable：Writer 详解

`Writer` 负责将内存中有序的 `[]record.Entry` 转化为符合上述格式的磁盘文件。其核心字段如下：

```go
type Writer struct {
    file     *os.File
    opts     Options
    block    []record.Entry   // 当前 Data Block 缓冲区
    blockLen int              // 当前块的估算字节数
    index    []IndexEntry     // 索引条目列表
    bloom    *filter.BloomBuilder
    smallest []byte           // 全表最小 Key
    largest  []byte           // 全表最大 Key
    minSeq   uint64
    maxSeq   uint64
    count    int
    offset   uint64           // 当前文件写入偏移
}
```

#### 1. Add：逐条写入与分块

`Add(entry)` 方法按顺序接收条目，它假定调用方已保证传入顺序与 `record.Compare` 一致（Key 升序，Seq 降序）。每收到一个条目：

- 更新表的全局 `smallest`、`largest`、`minSeq`、`maxSeq`。
- 将 Key 加入布隆过滤器。
- 追加到当前 Block 缓冲区，并累加估算字节数。
- 当缓冲区大小超过配置的 `BlockSize`（默认 32 KB），触发 `flushBlock()`，将当前块编码并写入文件，然后清空缓冲区，同时在 `index` 中记录该块的 `FirstKey`、`LastKey` 和文件偏移/长度。

#### 2. Finish：收尾与元数据写入

所有条目添加完毕后，调用 `Finish()` 完成文件的最后组装：

1. 刷新最后一个可能未满的 Block。
2. 将 `index` 切片编码为二进制，写入文件，记录其偏移 `indexOffset` 和长度。
3. 生成布隆过滤器，序列化后写入文件，记录其偏移 `bloomOffset` 和长度。
4. 构造 48 字节 Footer：

   ```
   [0:8]   = tableMagic
   [8:16]  = indexOffset
   [16:20] = indexLength
   [20:28] = bloomOffset
   [28:32] = bloomLength
   [32:36] = entryCount
   [36:48] = 保留
   ```

5. 调用 `file.Sync()` 强制刷盘，关闭文件。

最终，`Finish` 返回一个 `version.TableMeta` 结构，记录了这个新 SSTable 的文件编号、层级、键范围、序列号范围和文件大小，用于后续的元数据更新。

---

### 三、Data Block 的编解码

Data Block 是实际承载 `record.Entry` 的单元，其二进制格式如下：

```
+----------------+
| count (4 bytes)|   ← 本块包含的条目数量
+----------------+
| entry 0        |
|   kind  (1B)   |
|   seq   (8B)   |
|   keyLen (4B)  |
|   valLen (4B)  |
|   key   (变长) |
|   value (变长) |
+----------------+
| entry 1 ...    |
+----------------+
```

- **编码**：`encodeBlock` 先写入 4 字节条目计数，然后依次为每个条目写入 Kind、Seq、Key长度、Value长度、Key字节、Value字节。所有整数均使用小端序。
- **解码**：`decodeBlock` 通过一个轻量的 `blockReader` 按顺序读取上述字段，最终还原为 `[]record.Entry`。解码后还会检查是否有残留字节，确保数据完整。

这种简单的长度前缀编码在实现上足够清晰，并且由于 SSTable 一旦写入就不会再修改，无需考虑变长或压缩带来的复杂性问题（后续可在此基础上扩展压缩支持）。

---

### 四、索引块：快速定位的二分查找

Data Block 将条目切分为固定大小的块，但查询时需要知道哪个块可能包含目标 Key。索引块（Index Block）就是这一问题的答案——它记录了每个 Data Block 的起止 Key 以及该块在文件中的偏移和长度，并且自身按键范围有序排列，支持二分查找

**1. 索引条目与块句柄**

```go
type BlockHandle struct {
    Offset uint64   // Data Block 在文件中的起始偏移
    Length uint32   // Data Block 的字节长度
}

type IndexEntry struct {
    FirstKey []byte   // 该 Data Block 的最小键
    LastKey  []byte   // 该 Data Block 的最大键
    Handle   BlockHandle
}
```

`BlockHandle` 是一个轻量的文件定位指针，`IndexEntry` 则描述了一个 Data Block 的键范围 `[FirstKey, LastKey]`（闭区间）。整个 `Index` 持有所有 `IndexEntry` 的有序切片：

```go
type Index struct {
    entries []IndexEntry
}
```

**2. 构建索引：严格的不重叠约束**

`NewIndex` 在构造索引时会进行严格的校验：

- 每个条目的 `FirstKey` 和 `LastKey` 都不能为空
- `FirstKey <= LastKey`（不允许反转的区间）
- **相邻条目之间不允许重叠**：前一个条目的 `LastKey` 必须严格小于后一个条目的 `FirstKey`

这三条约束保证了索引条目形成了**严格递增且不重叠的键范围序列**，这正是二分查找正确性的前提。校验通过后，所有键均通过 `record.CloneBytes` 深拷贝，保证索引数据的不可变性

```go
func NewIndex(entries []IndexEntry) (*Index, error) {
    cloned := make([]IndexEntry, len(entries))
    for i, entry := range entries {
        // 校验键非空、区间不反转、范围不重叠
        // ...
        cloned[i] = IndexEntry{
            FirstKey: record.CloneBytes(entry.FirstKey),
            LastKey:  record.CloneBytes(entry.LastKey),
            Handle:   entry.Handle,
        }
    }
    return &Index{entries: cloned}, nil
}
```

**3. 二分查找：`Find` 方法**

```go
func (idx *Index) Find(key []byte) (BlockHandle, bool) {
    pos := sort.Search(len(idx.entries), func(i int) bool {
        return bytes.Compare(idx.entries[i].LastKey, key) >= 0
    })
    if pos >= len(idx.entries) {
        return BlockHandle{}, false
    }
    entry := idx.entries[pos]
    if bytes.Compare(key, entry.FirstKey) < 0 {
        return BlockHandle{}, false
    }
    return entry.Handle, true
}
```

`Find` 是查询路径的核心，利用 Go 标准库的 `sort.Search` 进行二分查找：

1. 在 `entries` 中查找**第一个满足 `LastKey >= key` 的条目**。因为索引条目按键范围升序排列，这是唯一可能包含目标 Key 的块
2. 如果 `pos` 越界（即所有块的 `LastKey` 都小于目标 Key），说明 Key 不在本表中
3. 检查目标 Key 是否不小于该块的 `FirstKey`。由于第 1 步只保证了 `LastKey >= key`，还需要确认 `key >= FirstKey`，才能保证 Key 真正落在该块的区间内
4. 两步都通过后，返回该块的 `BlockHandle`。

这个设计保证了点查只需一次二分查找加上一次 Block 读取，时间复杂度 O(log N + BlockSize)，其中 N 为 Data Block 的数量

**4. 索引的编解码**

索引块在 SSTable 文件中的二进制格式如下：

```
+-------------------+
| count (4 bytes)   |  ← 索引条目数量
+-------------------+
| entry 0           |
|   firstKeyLen (4B)|
|   lastKeyLen  (4B)|
|   offset      (8B)|  ← BlockHandle.Offset
|   length      (4B)|  ← BlockHandle.Length
|   firstKey (变长) |
|   lastKey  (变长) |
+-------------------+
| entry 1 ...       |
+-------------------+
```

- `EncodeIndex`：接收 `[]IndexEntry`，先调用 `NewIndex` 进行校验和深拷贝，然后顺序写入：4 字节计数，每个条目的两段键长度、偏移、长度，以及键的实际字节。所有整数使用小端序
- `DecodeIndex`：通过一个 `indexReader` 按顺序读取上述字段，构造出 `[]IndexEntry`，最后再经过 `NewIndex` 校验。解码完成后会检查是否有残留字节，确保数据完整

通过编码前的 `NewIndex` 校验，任何写入磁盘的索引块都经过严格检查，打开 SSTable 时解码也会再次校验，将数据损坏的风险降到最低

---

### 五、读取 SSTable：Reader 与查询流程

`Reader` 封装了 SSTable 的读取逻辑，其结构如下：

```go
type Reader struct {
    path  string
    meta  version.TableMeta
    index *Index
    bloom *filter.Bloom
}
```

#### 1. Open：解析文件

`Open(path, meta)` 负责打开 SSTable 并提取索引和布隆过滤器：

- 打开文件，读取最后 48 字节 Footer。
- 校验魔数 `tableMagic`。
- 解析出 `indexOffset`、`indexLength`、`bloomOffset`、`bloomLength`。
- 根据偏移量读取 Index Block 和 Bloom Block 的数据，反序列化成内存中的 `*Index` 和 `*filter.Bloom`。

此时文件句柄可以关闭，后续的 Block 读取将按需重新打开文件。

#### 2. Get：点查询

`Get(key, readSeq)` 展示了一条经典的 LSM 磁盘查找路径：

1. **布隆过滤器快速排除**：若 Bloom 判断 Key 一定不存在，直接返回 `false`。
2. **索引二分定位**：`r.index.Find(key)` 找到可能包含该 Key 的 Data Block 的 `BlockHandle`（偏移+长度）。Index 结构中记录了每个 Block 的 `FirstKey` 和 `LastKey`，因此可以二分查找出唯一可能包含目标 Key 的块。
3. **读取并扫描 Block**：通过 `readBlock(handle)` 打开文件，读取该块的全部数据并解码成 `[]record.Entry`。由于 Block 内条目按 Key 排序，顺序遍历即可找到 Key 相等且 `Seq <= readSeq` 的第一个可见版本。

`readBlock` 实现简单直接：每次调用都打开文件、定位、读取、关闭。虽然频繁查询时会带来文件打开开销，但这种“无状态”设计天然线程安全，且对于读量不大的场景足够可靠，未来可以通过文件句柄池或缓存进行优化。

#### 3. 迭代器

当前 `Reader.NewIterator` 的实现是一次性读出文件中所有条目，然后根据 `readSeq` 和 `bounds` 过滤，构建一个基于切片的迭代器。这种方式实现简单，但在大表上会带来较高的内存和 IO 代价。更成熟的实现会按需加载 Block，利用合并迭代器逐块输出，不过这也正体现了 LSM 引擎逐步优化的典型路径。

#### 4. 布隆过滤器：快速排除不存在的键

在点查流程中，最坏情况是目标 Key 并不存在于当前 SSTable 中。如果不加任何过滤，引擎仍然需要读取 Index Block，再读取某个 Data Block，最后扫描确认不存在，这会造成昂贵的磁盘 IO。布隆过滤器（Bloom Filter）正是为解决这一问题而生——它以极小的内存占用，快速判定一个 Key **一定不存在**，从而跳过大段无效读取。

**1. 数据结构**

```go
type Bloom struct {
    bits     []uint64   // 位数组，以 uint64 为单位存储
    bitCount uint64     // 位数组总位数（总是 64 的倍数）
    hashes   uint8      // 哈希函数个数
}
```

`Bloom` 是一个经典的布隆过滤器实现：一个长度为 `bitCount` 的位数组，以及 `hashes` 个独立的哈希函数。插入时，对 Key 计算 `hashes` 个哈希值，将对应的位全部置 1；查询时，同样计算 `hashes` 个位置，只要有一个位为 0，即可断定 Key 一定不存在。

**2. 构建参数**

`BloomBuilder` 负责根据预期数据量构造合适的布隆过滤器：

```go
func NewBloomBuilder(expectedKeys int, bitsPerKey int) *BloomBuilder {
	if expectedKeys < 1 {
		expectedKeys = 1
	}
	if bitsPerKey < 1 {
		bitsPerKey = 10
	}
	// 计算总位数，并对齐到 64 的倍数
	bitCount := uint64(expectedKeys * bitsPerKey)
	if bitCount < 64 {
		bitCount = 64
	}
	words := (bitCount + 63) / 64
	bitCount = words * 64

	// 最优哈希函数个数 k = (bitsPerKey) * ln(2)，近似 0.69
	hashes := uint8(bitsPerKey * 69 / 100)
	if hashes < 1 {
		hashes = 1
	}
	if hashes > 30 {
		hashes = 30
	}

	return &BloomBuilder{
		bits:     make([]uint64, words),
		bitCount: bitCount,
		hashes:   hashes,
	}
}
```

- **`expectedKeys`**：预估的条目数量。SSTable Writer 会在构建开始时预估总条目数（或使用一个合理的默认值）。
- **`bitsPerKey`**：每个 Key 分配的平均位数，默认值为 10。这个值直接影响假阳性率——10 bits/key 时假阳性率约为 1%。
- **位数组大小**：`bitCount = expectedKeys * bitsPerKey`，向上取整到 64 的倍数。
- **哈希函数个数**：`hashes = bitsPerKey * 69 / 100`，即 `bitsPerKey * 0.69`。这是基于数学推导的最优值，能使假阳性率最低。当 `bitsPerKey = 10` 时，`hashes ≈ 7`。实现中限制了最大值为 30。

**3. 双重哈希与位设置**

为了模拟 k 个独立的哈希函数，实现采用了**双重哈希（Double Hashing）** 技术：

```go
func setBits(bits []uint64, bitCount uint64, hashes uint8, key []byte) {
    h1 := hash64(key)          // 第一个哈希值
    h2 := mix64(h1)            // 第二个哈希值，由 h1 变换得到
    for i := uint8(0); i < hashes; i++ {
        bit := (h1 + uint64(i)*h2) % bitCount
        bits[bit/64] |= uint64(1) << (bit % 64)
    }
}
```

通过 `h1 + i * h2` 生成第 i 个哈希位置，无需重复计算多个完整哈希函数，计算效率极高。底层 `hash64` 使用 FNV-1a 算法的变体，`mix64` 则通过三次 xorshift 和乘法混合确保 `h2` 的分布均匀性。

`Add(key)` 方法直接调用 `setBits`，将 Key 对应的所有位置置 1。`Finish()` 方法生成不可变的 `*Bloom`，拷贝一份位数组，保证构建器后续的修改不影响已完成的过滤器。

**4. 查询**

```go
func (b *Bloom) MayContain(key []byte) bool {
    h1 := hash64(key)
    h2 := mix64(h1)
    for i := uint8(0); i < b.hashes; i++ {
        bit := (h1 + uint64(i)*h2) % b.bitCount
        if b.bits[bit/64]&(uint64(1)<<(bit%64)) == 0 {
            return false   // 某一位为 0，一定不存在
        }
    }
    return true            // 所有位都为 1，可能存在（有假阳性概率）
}
```

查询逻辑与插入完全对称：计算相同的 k 个位置，检查是否全为 1。如果是，说明 Key **可能存在**（因为可能有其他 Key 将这些位置置 1，造成假阳性）；如果任何一位为 0，说明 Key **一定不存在**。

这种“一定不存在”的语义非常适合 SSTable：假阳性只会导致偶尔多读一个 Data Block，但不会漏掉真实存在的 Key，所以**不会影响正确性，只会轻微影响性能**。而 10 bits/key 下约 1% 的假阳性率，意味着 99% 的不存在 Key 都能被快速过滤，大大减少无效 IO。

**5. 序列化与反序列化**

`MarshalBinary` 将布隆过滤器序列化为以下格式：

```
+------------------+
| version (4 bytes)|  ← 固定为 1
+------------------+
| hashes  (1 byte) |  ← 哈希函数个数
+------------------+
| bitCount (8 bytes)| ← 总位数
+------------------+
| wordCount (8 bytes)|← bits 数组长度
+------------------+
| bits[0] (8 bytes)|
| bits[1] (8 bytes)|
| ...              |
+------------------+
```

`DecodeBloom` 按相同格式解码，并进行严格校验：版本号必须匹配、`bitCount` 必须是 64 的倍数、`wordCount` 必须等于 `bitCount/64`、不能有残留字节。这些校验确保了从磁盘读取的布隆过滤器数据完整可靠

---

### 六、Version：层级元数据管理

有了 SSTable 文件后，引擎需要一个机制来记录“当前有哪些文件、它们属于哪一层、各自的键范围是什么”。这就是 `version` 包的职责。

#### 1. 核心类型

- **`TableMeta`**：描述单个 SSTable 的元数据，包含 `FileNum`、`Level`、`Smallest`、`Largest`、`MinSeq`、`MaxSeq`、`Size`。它是不可变的，提供 `Clone()` 方法。
- **`Edit`**：表示一次元数据变更，包含 `NextFileNum`、`LastSeq`、`Added`（新增的表）、`Deleted`（删除的文件编号）。每次 MemTable 刷写或 Compaction 完成时，都会生成一个 Edit。
- **`State`**：系统的完整文件视图。包含 `NextFileNum`、`LastSeq` 和一个二维切片 `Levels`，`Levels[0]` 是 Level 0 的所有 SSTable，`Levels[1]` 是 Level 1，以此类推。

#### 2. 不可变状态与 Apply

`State` 的设计遵循**不可变性**：`Apply(edit Edit)` 并不修改原状态，而是克隆一份，在新副本上应用变更，然后返回新状态。这样引擎可以通过原子指针切换当前状态，读操作可以安全地持有一个旧状态的快照，完全不受后续写入影响。

```go
// 将一次编辑应用到当前状态，返回新状态（不可变）
func (s *State) Apply(edit Edit) *State {
	next := s.Clone()
	if edit.NextFileNum > next.NextFileNum {
		next.NextFileNum = edit.NextFileNum
	}
	if edit.LastSeq > next.LastSeq {
		next.LastSeq = edit.LastSeq
	}
	// 删除指定文件
	for _, deleted := range edit.Deleted {
		for level := range next.Levels {
			next.Levels[level] = removeFile(next.Levels[level], deleted)
		}
	}
	// 添加新文件，并按层级排序
	for _, meta := range edit.Added {
		for len(next.Levels) <= meta.Level {
			next.Levels = append(next.Levels, nil)
		}
		next.Levels[meta.Level] = append(next.Levels[meta.Level], meta.Clone())
		sortLevel(next.Levels[meta.Level])
		if meta.FileNum >= next.NextFileNum {
			next.NextFileNum = meta.FileNum + 1
		}
		if meta.MaxSeq > next.LastSeq {
			next.LastSeq = meta.MaxSeq
		}
	}
	if next.NextFileNum == 0 {
		next.NextFileNum = 1
	}
	return next
}
```

1. 深拷贝当前 `State`。
2. 更新 `NextFileNum` 和 `LastSeq`（只增不减）。
3. 遍历 `edit.Deleted`，从各层级移除对应文件。
4. 遍历 `edit.Added`，将新表加入对应层级，并根据规则排序：
   - Level 0：按 `FileNum` 降序，最新的文件排在最前面。
   - 其他层：按 `Smallest` 升序，因为同一层内文件键范围不重叠。
5. 同步更新全局计数器，返回新状态。

这种机制也是崩溃恢复的基础：MANIFEST 文件记录了所有 Edit 序列，重放它们即可重建出最新的 `State`。

#### 3. 查询路由

`State` 提供了几个关键的查询方法，直接影响读取性能：

- **`FilesForKey(key)`**：找出可能包含目标 Key 的所有文件。对于 Level 0，由于文件范围可能重叠，它**从新到旧**遍历所有文件，收集包含该 Key 的；对于更深层级，因为文件键范围不重叠，最多只有一个文件匹配。这一顺序与查找最新版本的需求完美契合。
- **`FilesInRange(level, lower, upper)`**：返回某层内与给定范围有交集的所有文件，用于 Compaction 挑选参与文件。
- **`AllFiles()`**：导出所有表元数据，方便快照或整体统计。

这些方法在返回元数据时都会进行 `Clone()`，确保调用方得到独立的副本。

---

### 七、SSTable 与 Version 的协同

在完整的 LSM 引擎中，SSTable 和 Version 紧密协作：

1. **Flush**：MemTable 冻结后，`sstable.Manager.Build()` 生成新的 SSTable 文件，返回 `TableMeta`。引擎构建一个 `Edit{Added: []TableMeta{meta}}`，通过 `State.Apply(edit)` 更新版本，将新表加入 Level 0，最后原子切换当前状态。
2. **Compaction**：从 `State` 中选择一层或多层文件进行合并，生成新的 SSTable（可能放入下一层），旧文件被删除。对应的 `Edit` 同时包含 `Added` 和 `Deleted`，应用后状态平滑过渡。
3. **读取**：当执行 `Get` 或创建迭代器时，引擎从当前 `State` 中调用 `FilesForKey` 获取需要扫描的 SSTable 列表，结合内存表（MemTable / Immutable）统一进行多路归并，得到最终结果。

由此可见，`version` 包提供的“导航地图”直接决定了磁盘读取的范围；而 `sstable` 包提供的高效文件格式，使得在定位到某个文件后能快速捞出所需数据。

---

### 八、总结

本文详细解析了 LSM 引擎的磁盘存储部分——SSTable 的文件格式、读写流程，以及 Version 如何管理这些文件的层级元数据。概括其设计要点：

- **SSTable 格式**：Data Block + Index Block + Bloom Filter + Footer，顺序写入，尾部索引，适合不可变文件的高效读写。
- **分块与索引**：将有序条目切分为固定大小的 Block，通过 Index 快速定位，避免全表扫描。
- **布隆过滤器**：在查询前以极低内存代价排除不存在的 Key，大幅减少无效 IO。
- **不可变状态**：`State` 通过深克隆和 `Apply` 实现无锁的并发读取，Edit 机制记录了所有元数据变更，是崩溃恢复的基石。
- **层级组织**：Level 0 允许重叠，Level 1+ 强制不重叠，分别通过不同的排序和遍历策略支撑写入吞吐和读取效率。
