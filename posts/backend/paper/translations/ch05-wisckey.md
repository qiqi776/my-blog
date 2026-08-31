---
title: WiscKey: 在面向SSD的存储中分离键与值
date: 2026-08-10
order: 5
---

# WiscKey: 在面向SSD的存储中分离键与值

Lanyue Lu, Thanumalayan Sankaranarayana Pillai, Andrea C. Arpaci-Dusseau, 和 Remzi H. Arpaci-Dusseau  
威斯康星大学麦迪逊分校  
https://www.usenix.org/conference/fast16/technical-sessions/presentation/lu

_本文收录于第14届USENIX文件与存储技术会议（FAST '16）论文集中。2016年2月22-25日 • 美国加州圣克拉拉_  
ISBN 978-1-931971-28-7

对第14届USENIX文件与存储技术会议论文集的开放获取由USENIX赞助

---

## 摘要

我们提出了 WiscKey，一个基于 LSM 树的持久化键值存储系统，其采用面向性能的数据布局，通过将键与值分离来最小化 I/O 放大。WiscKey 的设计针对 SSD 进行了高度优化，充分利用了设备顺序和随机访问的性能特征。我们通过微基准测试和 YCSB 工作负载展示了 WiscKey 的优势。微基准测试结果表明，在加载数据库方面，WiscKey 比 LevelDB 快 2.5 倍到 111 倍；在随机查找方面，快 1.6 倍到 14 倍。在所有六种 YCSB 工作负载中，WiscKey 均优于 LevelDB 和 RocksDB。

---

## 1 引言

持久化键值存储在现代各种数据密集型应用中扮演着关键角色，包括 Web 索引 [16, 48]、电子商务 [24]、数据去重 [7, 22]、照片存储 [12]、云数据 [32]、社交网络 [9, 25, 51]、在线游戏 [23]、消息传递 [1, 29]、软件仓库 [2] 和广告 [20]。通过支持高效的插入、点查找和范围查询，键值存储为这些日益重要的应用群体奠定了基础。

对于写入密集型工作负载，基于日志结构合并树（LSM-tree）[43] 的键值存储已成为业界最先进的技术。基于 LSM-tree 构建的各种分布式和本地存储已广泛应用于大规模生产环境，例如 Google 的 BigTable [16] 和 LevelDB [48]、Facebook 的 Cassandra [33]、HBase [29] 和 RocksDB [25]、Yahoo! 的 PNUTS [20] 以及 Basho 的 Riak [4]。LSM 树相较于其他索引结构（如 B-树）的主要优势在于其维护了写入的顺序访问模式。B-树上的小规模更新可能涉及大量随机写入，因此在固态存储设备或硬盘驱动器上效率都不高。

[[115, 796, 485, 902], [512, 216, 882, 262]]

为了提供高写入性能，LSM 树批量地将键值对进行顺序写入。随后，为了实现高效的查找（包括单键查找和范围查询），LSM 树在后台持续地读取、排序和写入键值对，从而保持键和值的有序状态。因此，相同的数据在其生命周期内会被多次读写；正如我们稍后（第 2 节）所示，典型 LSM 树中的这种 I/O 放大系数可达到 50 倍或更高 [39, 54]。

LSM 技术的成功与其在传统硬盘驱动器（HDD）上的应用密切相关。在 HDD 中，随机 I/O 比顺序 I/O 慢 100 倍以上 [43]；因此，执行额外的顺序读写以持续对键排序并实现高效查找，代表了一种极佳的权衡。

然而，存储领域正在迅速变化，现代固态存储设备（SSD）正在许多重要应用场景中取代 HDD。与 HDD 相比，SSD 在性能和可靠性特征上有着根本的不同；在考虑键值存储系统设计时，我们认为以下三个差异至关重要。**第一**，随机与顺序性能之间的差距远没有 HDD 那么大；因此，执行大量顺序 I/O 以减少后续随机 I/O 的 LSM 树可能是在不必要地浪费带宽。**第二**，SSD 具有高度的内部并行性；构建在 SSD 之上的 LSM 树必须精心设计以利用这种并行性 [53]。**第三**，SSD 会因重复写入而磨损 [34, 40]；LSM 树中的高写入放大会显著缩短设备寿命。正如我们将在论文（第 4 节）中展示的那样，这些因素的结合极大地影响了 LSM 树在 SSD 上的性能，使其吞吐量降低 90%，并将写入负载增加十倍以上。虽然将 LSM 树底层的 HDD 更换为 SSD 确实能提升性能，但在当前的 LSM 树技术下，SSD 的真正潜力远未得到充分发挥。

在本文中，我们提出了 WiscKey，一个面向 SSD 的持久化键值存储系统，它源自流行的 LSM 树实现——LevelDB。WiscKey 的核心思想是**分离键和值** [42]；只有键在 LSM 树中保持有序，而值则单独存储在一个日志中。换句话说，我们在 WiscKey 中将键排序和垃圾回收解耦，而 LevelDB 则将它们捆绑在一起。这种简单的技术通过避免在排序过程中不必要地移动值，可以显著减少写放大。此外，LSM 树的大小显著减小，从而减少了设备读取并改善了查找期间的缓存。

WiscKey 保留了 LSM 树技术的优势，包括卓越的插入和查找性能，且没有过度的 I/O 放大。

将键与值分离带来了一系列挑战和优化机会。首先，范围查询（扫描）性能可能受到影响，因为值不再按排序顺序存储。WiscKey 通过利用 SSD 设备丰富的内部并行性来解决这一挑战。其次，WiscKey 需要垃圾回收来回收无效值所占用的空间。WiscKey 提出了一种在线轻量级垃圾回收器，它仅涉及顺序 I/O，对前台工作负载影响极小。第三，分离键和值使得崩溃一致性变得具有挑战性；WiscKey 利用了现代文件系统中的一个有趣特性，即追加写入在崩溃时不会产生垃圾数据。WiscKey 在提供与现代基于 LSM 的系统相同的一致性保证的同时，优化了性能。

我们将 WiscKey 的性能与两个流行的基于 LSM 树的键值存储系统 LevelDB [48] 和 RocksDB [25] 进行了比较。对于大多数工作负载，WiscKey 的性能显著更优。使用 LevelDB 自身的微基准测试，在加载数据库时，WiscKey 比 LevelDB 快 2.5 倍到 111 倍，具体取决于键值对的大小；对于随机查找，WiscKey 比 LevelDB 快 1.6 倍到 14 倍。WiscKey 的性能并非总是优于标准 LSM 树；如果随机写入小值，并且对大型数据集进行顺序范围查询，WiscKey 的性能不如 LevelDB。然而，这种工作负载并不能反映真实世界的用例（主要使用较短的范围查询），并且可以通过日志重组来改进。在反映真实世界用例的 YCSB 宏基准测试 [21] 中，WiscKey 在所有六种 YCSB 工作负载下均优于 LevelDB 和 RocksDB，并且其趋势与加载和随机查找微基准测试相似。

本文的其余部分组织如下。我们首先在第 2 节描述背景和动机。第 3 节阐述 WiscKey 的设计，第 4 节分析其性能。我们在第 5 节简要描述相关工作，并在第 6 节得出结论。

---

## 2 背景与动机

在本节中，我们首先描述日志结构合并树（LSM-tree）的概念。然后，我们解释基于 LSM 树技术的流行键值存储系统 LevelDB 的设计。我们研究 LevelDB 中的读写放大。最后，我们描述现代存储硬件的特性。

### 2.1 日志结构合并树

[[115, 880, 485, 908], [512, 317, 882, 409]]

LSM 树是一种持久化结构，为具有高插入和删除率的键值存储提供高效索引 [43]。它将数据写入延迟并批处理成大数据块，以利用硬盘的高顺序带宽。由于在硬盘上随机写入比顺序写入慢近两个数量级，LSM 树提供了比需要随机访问的传统 B-树更好的写入性能。

<center>**图 1：LSM-tree 和 LevelDB 架构。** 此图展示了标准的 LSM-tree 和 LevelDB 架构。对于 LevelDB，插入一个键值对需要经过多个步骤：（1）日志文件；（2）内存表（memtable）；（3）不可变内存表（immutable memtable）；（4）L0 层的 SSTable；（5）压实到更深层。</center>

如图 1 所示，LSM 树由多个大小呈指数增长的组件组成，从 $C_0$ 到 $C_k$。$C_0$ 组件是内存中的原地更新排序树，而其他组件 $C_1$ 到 $C_k$ 是磁盘上的仅追加 B-树。

在 LSM 树中插入数据时，插入的键值对被追加到一个磁盘顺序日志文件中，以便在崩溃时能够恢复。然后，该键值对被添加到按键排序的内存 $C_0$ 中；$C_0$ 支持对最近插入的键值对进行高效查找和扫描。一旦 $C_0$ 达到其大小限制，它将通过与磁盘上的 $C_1$ 进行类似归并排序的过程进行合并；这个过程称为**压实（compaction）**。新合并的树将被顺序写入磁盘，替换旧版本的 $C_1$。当每个磁盘组件 $C_i$ 达到其大小限制时，也会发生压实（即归并排序）。请注意，压实仅在相邻层级 $C_i$ 和 $C_{i+1}$ 之间进行，并且可以在后台异步执行。

为了服务查找操作，LSM 树可能需要搜索多个组件。请注意，$C_0$ 包含最新数据，其次是 $C_1$，依此类推。因此，为了检索一个键值对，LSM 树从 $C_0$ 开始以级联方式搜索各组件，直到在最小的组件 $C_i$ 中找到所需数据。与 B-树相比，LSM 树进行点查找可能需要多次读取。因此，LSM 树在插入操作比查找操作更频繁时最为有用 [43]。

### 2.2 LevelDB

LevelDB 是一个广泛使用的基于 LSM 树的键值存储系统，其灵感来源于 BigTable [16, 48]。LevelDB 支持范围查询、快照以及其他在现代应用中实用的功能。在本节中，我们简要描述 LevelDB 的核心设计。

LevelDB 的整体架构如图 1 所示。LevelDB 中的主要数据结构包括一个磁盘日志文件、两个内存中的有序跳表（memtable 和 immutable memtable），以及七层（$L_0$ 到 $L_6$）的磁盘排序字符串表（SSTable）文件。LevelDB 初始时将插入的键值对存储在日志文件和内存中的 memtable 中。一旦 memtable 满了，LevelDB 会切换到新的 memtable 和日志文件来处理后续的用户插入。在后台，先前的 memtable 被转换为 immutable memtable，然后一个压实线程将其刷新到磁盘，在第 0 层（$L_0$）生成一个新的 SSTable 文件（通常约为 2 MB）；先前的日志文件被丢弃。

每一层所有文件的总大小是有限制的，并且随着层数的增加，大小限制以 10 倍递增。例如，$L_1$ 层所有文件的大小限制是 10 MB，而 $L_2$ 层则是 100 MB。为了维持大小限制，一旦某一层 $L_i$ 的总大小超过其限制，压实线程会从 $L_i$ 中选择一个文件，与 $L_{i+1}$ 层中所有重叠的文件进行归并排序，并生成新的 $L_{i+1}$ 层 SSTable 文件。压实线程会持续进行，直到所有层级都处于其大小限制之内。此外，在压实过程中，LevelDB 确保除 $L_0$ 外，特定层级中的所有文件在键范围上不重叠；$L_0$ 中的文件键范围可能相互重叠，因为它们直接从 memtable 刷新而来。

为了服务查找操作，LevelDB 首先搜索 memtable，然后是 immutable memtable，接着按顺序搜索 $L_0$ 到 $L_6$ 层的文件。查找一个随机键所需搜索的文件数量受最大层数限制，因为除 $L_0$ 外，同一层内的文件键不重叠。由于 $L_0$ 中的文件可能包含重叠的键，一次查找可能需要搜索 $L_0$ 层的多个文件。为避免较大的查找延迟，如果 $L_0$ 层的文件数量超过 8 个，LevelDB 会减慢前台写入流量，以等待压实线程将一些文件从 $L_0$ 压实到 $L_1$。

### 2.3 读写放大

读写放大是 LSM 树（如 LevelDB）的主要问题。写（读）放大定义为写入（读取）底层存储设备的数据量与用户请求的数据量之间的比率。在本节中，我们分析 LevelDB 中的读写放大。

[[113, 818, 483, 908], [511, 318, 881, 409]]

为了实现近乎顺序的磁盘访问，LevelDB 写入了超出必要的数据量（尽管仍然是顺序的），即 LevelDB 具有高写放大。由于 $L_i$ 层的大小限制是 $L_{i-1}$ 层的 10 倍，在压实过程中将文件从 $L_{i-1}$ 合并到 $L_i$ 时，最坏情况下 LevelDB 可能从 $L_i$ 读取多达 10 个文件，并在排序后将这些文件写回 $L_i$。因此，将一个文件跨两层移动的写放大可能高达 10。对于大型数据集，由于任何新生成的表文件最终都会通过一系列压实步骤从 $L_0$ 迁移到 $L_6$，写放大可能超过 50（$L_1$ 到 $L_6$ 每层之间为 10）。

<center>**图 2：读写放大。** 此图显示了 LevelDB 在两种不同数据库大小（1 GB 和 100 GB）下的写放大和读放大。键大小为 16 B，值大小为 1 KB。</center>

读放大一直是 LSM 树的主要问题，这源于设计中的权衡。LevelDB 的读放大有两个来源。**第一**，查找一个键值对时，LevelDB 可能需要检查多个层级。在最坏情况下，LevelDB 需要检查 $L_0$ 层的 8 个文件，以及其余 6 层各 1 个文件：总共 14 个文件。**第二**，要在 SSTable 文件中找到一个键值对，LevelDB 需要读取文件内的多个元数据块。具体来说，实际读取的数据量为（索引块 + 布隆过滤器块 + 数据块）。例如，查找一个 1-KB 的键值对，LevelDB 需要读取一个 16-KB 的索引块、一个 4-KB 的布隆过滤器块和一个 4-KB 的数据块；总计 24 KB。因此，考虑到最坏情况下的 14 个 SSTable 文件，LevelDB 的读放大为 $24 \times 14 = 336$。更小的键值对会导致更高的读放大。

为了测量 LevelDB 在实际中表现出的放大程度，我们进行了以下实验。我们首先加载一个包含 1-KB 键值对的数据库，然后查找数据库中的 100,000 个条目；我们对初始加载使用两种不同的数据库大小，并从均匀分布中随机选择键。图 2 显示了加载阶段的写放大和查找阶段的读放大。对于 1-GB 的数据库，写放大为 3.1，而对于 100-GB 的数据库，写放大增加到 14。读放大遵循相同的趋势：1-GB 数据库为 8.2，100-GB 数据库为 327。写放大随数据库大小增加的原因很简单。随着插入数据库的数据增多，键值对更有可能沿着层级向下移动；换句话说，LevelDB 在将数据从低层级压实到高层级时会多次写入数据。然而，写放大并未达到先前预测的最坏情况，因为层级之间合并的文件平均数量通常小于最坏情况下的 10。读放大也随数据集大小增加，因为对于小型数据库，所有 SSTable 文件中的索引块和布隆过滤器都可以缓存在内存中。然而，对于大型数据库，每次查找可能触及不同的 SSTable 文件，每次都需付出读取索引块和布隆过滤器的代价。

值得注意的是，高读写放大对于硬盘来说是一种合理的权衡。例如，对于一个寻道延迟为 10 毫秒、吞吐量为 100 MB/s 的硬盘，访问随机 1K 数据所需的大致时间是 10 毫秒，而访问下一个顺序块的时间约为 $10 \mu s$，随机与顺序延迟之比为 1000:1。因此，与需要随机写入访问的替代数据结构（如 B-树）相比，在硬盘上，写放大小于 1000 的顺序写入方案会更快 [43, 49]。另一方面，LSM 树的读放大与 B-树相比仍然具有竞争力。例如，考虑一个高度为 5、块大小为 4 KB 的 B-树，查找一个 1-KB 的键值对需要访问 6 个块，导致读放大为 24。

### 2.4 快速存储硬件

[[115, 788, 485, 910], [512, 90, 881, 120]]

许多现代服务器采用 SSD 设备来实现高性能。与硬盘类似，随机写入在 SSD 上也被认为是有害的 [10, 31, 34, 40]，这是由于它们独特的擦写周期和昂贵的垃圾回收机制。尽管 SSD 设备初始的随机写入性能良好，但在预留块被使用后，性能可能会显著下降。因此，LSM 树避免随机写入的特性天然适合 SSD；许多面向 SSD 优化的键值存储都基于 LSM 树 [25, 50, 53, 54]。

然而，与硬盘不同，SSD 上随机读取（相对于顺序读取）的相对性能要好得多；此外，当在 SSD 上并发发出随机读取时，对于某些工作负载，聚合吞吐量可以与顺序吞吐量相匹配 [17]。例如，图 3 显示了 500-GB Samsung 840 EVO SSD 在不同请求大小下的顺序和随机读取性能。对于单线程随机读取，吞吐量随请求大小增加，在 256 KB 时达到顺序吞吐量的一半。对于 32 线程的并发随机读取，当大小大于 16 KB 时，聚合吞吐量与顺序吞吐量相匹配。对于更高端的 SSD，并发随机读取与顺序读取之间的差距要小得多 [3, 39]。

<center>**图 3：SSD 上的顺序读和随机读。** 此图显示了在现代 SSD 设备上，不同请求大小的顺序和随机读取性能。所有请求都发送到 ext4 文件系统上的一个 100-GB 文件。</center>

正如我们在本节中所展示的，LSM 树具有较高的读写放大，这对于硬盘是可以接受的。在高性能 SSD 上使用 LSM 树可能会浪费大量设备带宽进行过多的读写操作。在本文中，我们的目标是在 SSD 设备上提高 LSM 树的性能，以有效利用设备带宽。

---

## 3 WiscKey

前一节解释了 LSM 树如何通过增加 I/O 放大来维持顺序 I/O 访问。虽然顺序 I/O 访问和 I/O 放大之间的这种权衡对于传统硬盘是合理的，但对于使用 SSD 的现代硬件来说并非最优。在本节中，我们介绍 WiscKey 的设计，这是一个在 SSD 上最小化 I/O 放大的键值存储系统。

为了实现面向 SSD 优化的键值存储，WiscKey 包含了四个关键思想。**第一**，WiscKey 将键与值分离，仅在 LSM 树中保留键，而将值存储在一个单独的日志文件中。**第二**，为了处理无序的值（这会在范围查询期间导致随机访问），WiscKey 利用了 SSD 设备的并行随机读取特性。**第三**，WiscKey 采用了独特的崩溃一致性和垃圾回收技术来高效管理值日志。**最后**，WiscKey 通过在不牺牲一致性的情况下移除 LSM 树日志来优化性能，从而减少了小写入带来的系统调用开销。

### 3.1 设计目标

WiscKey 是一个单机持久化键值存储系统，派生自 LevelDB。它可以作为关系数据库（例如 MySQL）或分布式键值存储（例如 MongoDB）的存储引擎。它提供与 LevelDB 相同的 API，包括 `Put(key, value)`、`Get(key)`、`Delete(key)` 和 `Scan(start, end)`。WiscKey 的设计遵循以下主要目标。

**低写放大。** 写放大引入了额外的不必要写入。尽管 SSD 设备相比硬盘具有更高的带宽，但大的写放大可能消耗大部分写入带宽（超过 90% 的情况并不少见），并由于有限的擦写周期而缩短 SSD 寿命。因此，最小化写放大对于提高工作负载性能和 SSD 寿命至关重要。

**低读放大。** 大的读放大导致两个问题。首先，每次查找发出多次读取显著降低了查找吞吐量。其次，加载到内存中的大量数据降低了缓存的效率。WiscKey 目标是实现较小的读放大以加速查找。

**面向 SSD 优化。** WiscKey 通过将其 I/O 模式与 SSD 设备的性能特征相匹配来针对 SSD 进行优化。具体来说，顺序写入和并行随机读取得到有效利用，以便应用程序能够充分利用设备的带宽。

**丰富的 API 特性。** WiscKey 旨在支持使 LSM 树流行的现代特性，例如范围查询和快照。范围查询允许扫描一个连续的键值对序列。快照允许捕获数据库在特定时间点的状态，然后对该状态执行查找。

**现实中的键值大小。** 在现代工作负载中，键通常很小（例如 16 B）[7, 8, 11, 22, 35]，尽管值的大小可能变化很大（例如 100 B 到大于 4 KB）[6, 11, 22, 28, 32, 49]。WiscKey 旨在为这组现实的键值大小提供高性能。

### 3.2 键值分离

LSM 树的主要性能开销在于压实过程，该过程不断对 SSTable 文件进行排序。在压实过程中，多个文件被读入内存、排序并写回，这可能显著影响前台工作负载的性能。然而，排序对于高效检索是必需的；通过排序，范围查询（即扫描）将主要涉及对多个文件的顺序访问，而点查询则只需在每个层级访问最多一个文件。

[[115, 714, 485, 910], [511, 274, 882, 363]]

WiscKey 的动机源于一个简单的启示。压实只需要对键进行排序，而值可以单独管理 [42]。由于键通常比值小，仅压实键可以显著减少排序期间需要处理的数据量。在 WiscKey 中，只有值的位置与键一起存储在 LSM 树中，而实际值则以面向 SSD 友好的方式存储在其他地方。通过这种设计，对于给定大小的数据库，WiscKey 的 LSM 树大小比 LevelDB 小得多。对于具有中等偏大值大小的现代工作负载，更小的 LSM 树可以显著减少写放大。例如，假设键为 16 B，值为 1 KB，键（在 LSM 树中）的写放大为 10，值的写放大为 1，则 WiscKey 的有效写放大仅为：

$$(10 \times 16 + 1024) / (16 + 1024) = 1.14$$

除了提高应用程序的写入性能外，减少写放大还通过减少所需的擦写周期来延长 SSD 寿命。

WiscKey 较小的读放大提高了查找性能。在查找期间，WiscKey 首先在 LSM 树中搜索键和值的位置；一旦找到，再发出另一次读取以检索值。读者可能会认为 WiscKey 在查找时会比 LevelDB 慢，因为它需要额外的 I/O 来检索值。然而，由于 WiscKey 的 LSM 树（对于相同的数据库大小）比 LevelDB 小得多，一次查找可能只需要搜索 LSM 树中较少的表文件层级，并且 LSM 树的很大一部分可以轻松缓存在内存中。因此，每次查找只需要一次随机读取（用于检索值），从而实现了优于 LevelDB 的查找性能。例如，假设键为 16 B，值为 1 KB，如果整个键值数据集的大小为 100 GB，那么 LSM 树的大小仅为约 2 GB（假设值的位置和大小开销为 12 B），这可以轻松缓存在拥有超过 100 GB 内存的现代服务器中。

<center>**图 4：WiscKey 在 SSD 上的数据布局。** 此图显示了 WiscKey 在单个 SSD 设备上的数据布局。键和值的位置存储在 LSM 树中，而值则追加到一个单独的值日志文件中。</center>

WiscKey 的架构如图 4 所示。键存储在 LSM 树中，而值存储在一个单独的值日志文件 **vLog** 中。与 LSM 树中的键一起存储的人造值是实际值在 vLog 中的地址。

当用户在 WiscKey 中插入一个键值对时，该值首先被追加到 vLog 中，然后键连同值的地址（vLog 偏移量，值大小）一起被插入到 LSM 树中。删除一个键只是从 LSM 树中删除该键，而不触碰 vLog。vLog 中所有有效的值在 LSM 树中都有对应的键；vLog 中的其他值无效，将在稍后被垃圾回收（§ 3.3.2）。

当用户查询一个键时，首先在 LSM 树中搜索该键，如果找到，则检索对应的值地址。然后，WiscKey 从 vLog 中读取该值。请注意，此过程适用于点查询和范围查询。

尽管键值分离的思想很简单，但它带来了许多挑战和优化机会，这些将在以下小节中描述。

### 3.3 挑战

键和值的分离使得范围查询需要随机 I/O。此外，这种分离也使得垃圾回收和崩溃一致性变得具有挑战性。我们现在解释如何解决这些挑战。

#### 3.3.1 并行范围查询

范围查询是现代键值存储的一项重要特性，允许用户扫描一定范围内的键值对。关系数据库 [26]、本地文件系统 [30, 46, 50]，甚至分布式文件系统 [37] 都使用键值存储作为其存储引擎，范围查询是这些环境中请求的核心 API。

对于范围查询，LevelDB 为用户提供了一个基于迭代器的接口，包含 `Seek(key)`、`Next()`、`Prev()`、`Key()` 和 `Value()` 操作。要扫描一个范围内的键值对，用户可以首先 `Seek()` 到起始键，然后调用 `Next()` 或 `Prev()` 逐个搜索键。要获取当前迭代器位置的键或值，用户分别调用 `Key()` 或 `Value()`。

在 LevelDB 中，由于键和值存储在一起且有序，范围查询可以顺序地从 SSTable 文件中读取键值对。然而，由于在 WiscKey 中键和值是分开存储的，范围查询需要随机读取，因此效率不高。正如我们在图 3 中看到的，SSD 上单线程的随机读取性能无法与顺序读取性能相比。然而，具有相当大请求大小的并行随机读取可以充分利用设备的内部并行性，获得接近顺序读取的性能。

为了使范围查询高效，WiscKey 利用 SSD 设备的并行 I/O 特性，在范围查询期间从 vLog **预取**值。其基本思想是，对于 SSD，只有键需要特殊关注以实现高效检索。只要键能被高效检索，范围查询就可以使用并行随机读取来高效检索值。

预取框架可以轻松适应当前的范围查询接口。在当前接口中，如果用户请求范围查询，会返回一个迭代器给用户。对于每次在迭代器上请求的 `Next()` 或 `Prev()` 操作，WiscKey 会跟踪范围查询的访问模式。一旦请求了一个连续的键值对序列，WiscKey 开始从 LSM 树中顺序读取后续的一些键。从 LSM 树中检索到的对应值地址被插入到一个队列中；多个线程将在后台从 vLog 中并发地获取这些地址。

<center>**图 5：用于垃圾回收的 WiscKey 新数据布局。** 此图显示了 WiscKey 为支持高效垃圾回收而设计的新数据布局。在内存中维护头指针和尾指针，并持久化存储在 LSM 树中。只有垃圾回收线程会改变尾指针，而所有对 vLog 的写入都会追加到头指针处。</center>

#### 3.3.2 垃圾回收

基于标准 LSM 树的键值存储在键值对被删除或覆盖时不会立即回收空间。相反，在压实过程中，如果发现与已删除或覆盖的键值对相关的数据，这些数据会被丢弃并回收空间。在 WiscKey 中，只有无效的键通过 LSM 树压实来回收。由于 WiscKey 不会压实值，它需要一个特殊的垃圾回收器来回收 vLog 中的空闲空间。

由于我们只将值存储在 vLog 文件中（§ 3.2），回收 vLog 空闲空间的一种朴素方法是首先扫描 LSM 树以获取所有有效值的地址；然后，vLog 中所有在 LSM 树中没有有效引用的值都可以被视为无效并回收。然而，这种方法过于重量级，仅适用于离线垃圾回收。

WiscKey 的目标是轻量级**在线垃圾回收器**。为了实现这一点，我们对 WiscKey 的基本数据布局做了一个小改动：在将值存储到 vLog 的同时，我们也存储对应的键。新的数据布局如图 5 所示：元组（键大小，值大小，键，值）存储在 vLog 中。

WiscKey 的垃圾回收旨在将有效值（对应于未被删除的键）保持在 vLog 的一个连续范围内，如图 5 所示。这个范围的一端，即**头指针（head）**，始终对应于 vLog 的末尾，新的值将被追加到这里。这个范围的另一端，即**尾指针（tail）**，是当垃圾回收被触发时开始释放空间的地方。只有 vLog 中位于头指针和尾指针之间的部分包含有效值，并会在查找时被搜索。

在垃圾回收过程中，WiscKey 首先从 vLog 的尾部读取一块键值对（例如几 MB），然后通过查询 LSM 树来确定哪些值是有效的（尚未被覆盖或删除）。接着，WiscKey 将这些有效值追加到 vLog 的头部。最后，它释放该块先前占用的空间，并相应地更新尾指针。

为避免在垃圾回收过程中发生崩溃时丢失任何数据，WiscKey 必须确保新追加的有效值和新的尾指针在真正释放空间之前已持久化到设备上。WiscKey 通过以下步骤实现这一点。在将有效值追加到 vLog 后，垃圾回收器在 vLog 上调用 `fsync()`。然后，它将这些新值的地址和当前尾指针以同步方式添加到 LSM 树中；尾指针作为 `<‘tail’, tail-vLog-offset>` 存储在 LSM 树中。最后，回收 vLog 中的空闲空间。

WiscKey 可以配置为定期启动和继续垃圾回收，或者直到达到特定阈值。垃圾回收也可以在离线模式下进行维护。对于删除操作较少且存储空间有超配的环境，可以很少触发垃圾回收。

#### 3.3.3 崩溃一致性

在系统崩溃时，LSM 树实现通常保证插入键值对的原子性和插入对的顺序恢复。由于 WiscKey 的架构将值与 LSM 树分开存储，获得相同的崩溃保证可能看起来很复杂。然而，WiscKey 通过利用现代文件系统（如 ext4、btrfs 和 xfs）的一个有趣属性来提供相同的崩溃保证。考虑一个包含字节序列 $\langle b_1 b_2 b_3 \ldots b_n \rangle$ 的文件，并且用户将序列 $\langle b_{n+1} b_{n+2} b_{n+3} \ldots b_{n+m} \rangle$ 追加到它。如果发生崩溃，在现代文件系统恢复后，观察到的文件将包含字节序列 $\langle b_1 b_2 b_3 \ldots b_n b_{n+1} b_{n+2} b_{n+3} \ldots b_{n+x} \rangle$，其中 $x < m$，即只有追加字节的某个前缀会在文件系统恢复期间被添加到文件末尾 [45]。随机字节或追加字节的非前缀子集不可能被添加到文件中。由于在 WiscKey 中，值是被顺序追加到 vLog 文件末尾的，前述属性可以方便地转化为：如果 vLog 中的值 $X$ 在崩溃中丢失，那么所有未来的值（在 $X$ 之后插入的）也将丢失。

[[115, 698, 484, 908], [511, 318, 881, 378]]

当用户查询一个键值对时，如果 WiscKey 因为键在系统崩溃期间丢失而无法在 LSM 树中找到该键，其行为与传统 LSM 树完全相同：即使该值在崩溃前已写入 vLog，它也会在之后被垃圾回收。然而，如果键能在 LSM 树中找到，则需要额外步骤来维持一致性。在这种情况下，WiscKey 首先验证从 LSM 树检索到的值地址是否落在 vLog 当前有效范围内，然后验证找到的值是否对应于所查询的键。如果验证失败，WiscKey 假定该值在系统崩溃期间丢失，从 LSM 树中删除该键，并通知用户未找到该键。由于添加到 vLog 的每个值都包含一个包含对应键的头部，验证键和值是否匹配很简单；如有必要，可以轻松地在头部添加一个魔数或校验和。

<center>**图 6：写入单元大小的影响。** 此图显示了在 SSD 设备上向 ext4 文件系统写入一个 10-GB 文件，并在最后执行 `fsync()` 的总时间。我们改变每次 `write()` 系统调用的大小。</center>

### 3.4 优化

在 WiscKey 中将键与值分离提供了重新思考值日志更新方式以及 LSM 树日志必要性的机会。我们现在描述这些机会如何带来性能提升。

#### 3.4.1 值日志写缓冲区

对于每次 `Put()` 操作，WiscKey 需要通过 `write()` 系统调用将值追加到 vLog。然而，对于插入密集型工作负载，向文件系统发出大量小写入会引入显著的开销，尤其是在快速存储设备上 [15, 44]。图 6 显示了在 ext4（Linux 3.14）中顺序写入一个 10-GB 文件的总时间。对于小写入，每次系统调用的开销显著累积，导致运行时间较长。对于大写入（大于 4 KB），设备吞吐量得到充分利用。

为了减少开销，WiscKey 将值缓存在用户空间缓冲区中，并且仅在缓冲区大小超过阈值或用户请求同步插入时才刷新缓冲区。因此，WiscKey 只发出大写入，减少了 `write()` 系统调用的次数。对于查找，WiscKey 首先搜索 vLog 缓冲区，如果未找到，再从 vLog 实际读取。显然，这种机制可能导致某些数据（已缓冲）在崩溃时丢失；获得的崩溃一致性保证与 LevelDB 类似。

#### 3.4.2 优化 LSM 树日志

如图 1 所示，LSM 树通常使用一个日志文件。LSM 树将插入的键值对记录在日志文件中，以便在用户请求同步插入并且发生崩溃时，可以在重启后扫描日志并恢复插入的键值对。

在 WiscKey 中，LSM 树仅用于键和值地址。此外，vLog 也记录了插入的键以支持垃圾回收，如前一节所述。因此，可以避免写入 LSM 树日志文件而不影响正确性。

如果在键持久化到 LSM 树之前发生崩溃，可以通过扫描 vLog 来恢复它们。然而，朴素的算法需要扫描整个 vLog 进行恢复。为了只需扫描 vLog 的一小部分，WiscKey 定期将 vLog 的头指针记录在 LSM 树中，作为一个键值对 `<head>, head-vLog-offset>`。当打开数据库时，WiscKey 从存储在 LSM 树中的最近的头指针位置开始扫描 vLog，并继续扫描直到 vLog 的末尾。由于头指针存储在 LSM 树中，并且 LSM 树固有地保证插入其中的键将按插入顺序恢复，这种优化是崩溃一致的。因此，移除 WiscKey 的 LSM 树日志是一种安全的优化，并且在存在许多小插入时尤其能提高性能。

### 3.5 实现

WiscKey 基于 LevelDB 1.18。WiscKey 在创建新数据库时创建一个 vLog，并在 LSM 树中管理键和值地址。vLog 在内部由多个组件以不同的访问模式访问。例如，查找通过随机读取 vLog 来服务，而垃圾回收器则顺序地从 vLog 尾部读取并追加到 vLog 文件的头部。我们使用 `posix_fadvise()` 在不同情况下为 vLog 预先声明访问模式。

对于范围查询，WiscKey 维护一个包含 32 个线程的背景线程池。这些线程在一个线程安全的队列上等待新的值地址到来。当预取被触发时，WiscKey 将固定数量的值地址插入到工作队列中，然后唤醒所有等待的线程。这些线程将开始并行读取值，并自动将它们缓存在缓冲区缓存中。

[[115, 803, 485, 908], [511, 90, 881, 133]]

为了高效地回收 vLog 的空闲空间，我们使用了现代文件系统的**打洞**功能（`fallocate()`）。在文件中打一个洞可以释放已分配的物理空间，并允许 WiscKey 弹性地使用存储空间。现代文件系统上的最大文件大小足以让 WiscKey 长时间运行而无需回绕到文件开头；例如，ext4 的最大文件大小为 64 TB，xfs 为 8 EB，btrfs 为 16 EB。如有必要，vLog 可以很容易地适配成循环日志。

---

## 4 评估

在本节中，我们展示评估结果，以证明 WiscKey 设计选择的优势。

所有实验均在配备两个 Intel(R) Xeon(R) CPU E5-2667 v2 @ 3.30GHz 处理器和 64-GB 内存的测试机器上运行。操作系统为 64 位 Linux 3.14，使用的文件系统为 ext4。使用的存储设备是 500-GB Samsung 840 EVO SSD，其最大顺序读取性能为 500 MB/s，最大顺序写入性能为 400 MB/s。设备的随机读取性能如图 3 所示。

### 4.1 微基准测试

我们使用 `db_bench`（LevelDB 中的默认微基准测试）来评估 LevelDB 和 WiscKey。我们始终使用 16 B 的键大小，但对不同的值大小进行实验。为了便于理解和分析性能，我们禁用了数据压缩。

#### 4.1.1 加载性能

我们现在描述**顺序加载**和**随机加载**微基准测试的结果。前一个基准测试通过按顺序插入键来构建一个 100-GB 的数据库，而后一个基准测试以均匀分布的随机顺序插入键。请注意，顺序加载基准测试在 LevelDB 或 WiscKey 中都不会引起压实，而随机加载会。

<center>**图 7：顺序加载性能。** 此图显示了 LevelDB 和 WiscKey 在 100-GB 数据集上，不同值大小下的顺序加载吞吐量。键大小为 16 B。</center>

图 7 显示了 LevelDB 和 WiscKey 在广泛值大小范围内的顺序加载吞吐量：两种存储的吞吐量都随值大小增加。但是，即使对于所考虑的最大值大小（256 KB），LevelDB 的吞吐量也远未达到设备带宽。为了进一步分析，图 8 显示了 LevelDB 在该基准测试每次运行期间，时间在不同组件中的分布情况；时间主要花在三个部分：写入日志文件、插入到 memtable 以及等待 memtable 刷新到设备。对于小型键值对，写入日志文件占总时间的百分比最高，原因如图 6 所述。对于较大的键值对，日志写入和 memtable 排序更高效，而 memtable 刷新是瓶颈。与 LevelDB 不同，当值大小超过 4 KB 时，WiscKey 达到了设备全带宽。由于它不写入 LSM 树日志并缓冲对 vLog 的追加，即使对于小值，它也快 3 倍。

<center>**图 8：LevelDB 顺序加载时间分解。** 此图显示了 LevelDB 在顺序加载期间不同组件所花费时间的百分比。</center>

图 9 显示了 LevelDB 和 WiscKey 在不同值大小下的随机加载吞吐量。LevelDB 的吞吐量范围从仅 2 MB/s（64-B 值大小）到 4.1 MB/s（256-KB 值大小），而 WiscKey 的吞吐量随值大小增加，在值大小超过 4 KB 后达到设备写入吞吐量的峰值。对于 1-KB 和 4-KB 的值大小，WiscKey 的吞吐量分别是 LevelDB 的 $46 \times$ 和 $111 \times$。LevelDB 的吞吐量低是因为压实既消耗了设备带宽的很大一部分，也减慢了前台写入（以避免 LSM 树 $L_0$ 层过载，如第 2.2 节所述）。在 WiscKey 中，压实只引入很小的开销，使得设备带宽得以有效利用。为了进一步分析，图 10 显示了 LevelDB 和 WiscKey 的写放大。LevelDB 的写放大始终大于 12，而 WiscKey 的写放大在值大小达到 1 KB 时迅速降至接近 1，这是因为 WiscKey 的 LSM 树显著更小。

<center>**图 9：随机加载性能。** 此图显示了 LevelDB 和 WiscKey 在 100-GB 数据集上，不同值大小下的随机加载吞吐量。键大小为 16 B。</center>

<center>**图 10：随机加载的写放大。** 此图显示了 LevelDB 和 WiscKey 在随机加载一个 100-GB 数据库时的写放大。</center>

#### 4.1.2 查询性能

[[113, 860, 483, 904], [510, 581, 880, 790]]

我们现在比较 LevelDB 和 WiscKey 的随机查找（点查询）和范围查询性能。图 11 显示了在 100-GB 随机加载数据库上执行 100,000 次操作的随机查找结果。尽管 WiscKey 中的随机查找需要同时检查 LSM 树和 vLog，但其吞吐量仍然远优于 LevelDB：对于 1-KB 值大小，WiscKey 的吞吐量是 LevelDB 的 $12 \times$。对于大值大小，WiscKey 的吞吐量仅受设备随机读取吞吐量的限制，如图 3 所示。LevelDB 的吞吐量低是因为第 2.3 节提到的高读放大。WiscKey 的性能显著更好，是因为更小的 LSM 树降低了读放大。WiscKey 性能更好的另一个原因是 WiscKey 中的压实过程不那么密集，从而避免了许多后台读写操作。

<center>**图 11：随机查找性能。** 此图显示了在 100-GB 随机加载数据库上执行 100,000 次操作的随机查找性能。</center>

图 12 显示了 LevelDB 和 WiscKey 的范围查询（扫描）性能。对于随机加载的数据库，LevelDB 从不同层级读取多个文件，而 WiscKey 需要对 vLog 进行随机访问（但 WiscKey 利用并行随机读取）。从图 12 可以看出，对于两种数据库，LevelDB 的吞吐量最初随值大小增加。然而，当值大小超过 4 KB 后，由于一个 SSTable 文件只能存储少量键值对，开销主要来自于打开大量 SSTable 文件以及读取每个文件中的索引块和布隆过滤器。对于较大的键值对，WiscKey 可以提供设备的顺序带宽，最高达到 LevelDB 的 $8.4 \times$。然而，对于 64-B 的键值对，由于设备在小请求大小下有限的并行随机读取吞吐量，WiscKey 的性能比 LevelDB 差 $12 \times$；在具有更高并行随机读取吞吐量的高端 SSD 上，WiscKey 的相对性能会更好 [3]。此外，这种工作负载代表了一种最坏情况，即数据库是随机填充的，且数据在 vLog 中是无序的。

图 12 还显示了当数据有序时（对应于顺序加载的数据库）范围查询的性能；在这种情况下，LevelDB 和 WiscKey 都可以顺序扫描数据。顺序加载数据库的性能趋势与随机加载数据库相同；对于 64-B 对，WiscKey 慢 $25\%$，因为 WiscKey 从 vLog 中同时读取键和值（从而浪费了带宽），但对于大的键值对，WiscKey 快 $2.8 \times$。因此，对于小型键值对，对随机加载的数据库进行日志重组（排序）可以使 WiscKey 的范围查询性能与 LevelDB 的性能相当。

<center>**图 12：范围查询性能。** 此图显示了范围查询性能。从 100-GB 数据库中查询 4 GB 数据，该数据库是随机（Rand）和顺序（Seq）加载的。</center>

#### 4.1.3 垃圾回收

[[115, 790, 484, 910], [512, 353, 881, 474]]

我们现在研究 WiscKey 在后台执行垃圾回收时的性能。性能可能会因垃圾回收期间发现的空闲空间百分比而变化，因为这会影响垃圾回收线程写入的数据量和释放的空间量。我们使用随机加载（受垃圾回收影响最大的工作负载）作为前台工作负载，并研究其在各种空闲空间百分比下的性能。我们的实验具体包括三个步骤：我们首先使用随机加载创建一个数据库，然后删除所需百分比的键值对，最后，我们运行随机加载工作负载并测量其在后台进行垃圾回收时的吞吐量。我们使用 4 KB 的键值大小，并将空闲空间百分比从 $25\%$ 变化到 $100\%$。

图 13 显示了结果：如果垃圾回收器读取的 $100\%$ 数据是无效的，吞吐量仅下降 $10\%$。吞吐量仅略微下降，因为垃圾回收从 vLog 尾部读取，并且只将有效的键值对写入头部；如果读取的数据完全无效，则无需写入任何键值对。对于其他空闲空间百分比，吞吐量下降约 $35\%$，因为垃圾回收线程执行了额外的写入。请注意，在所有情况下，当垃圾回收正在进行时，WiscKey 至少比 LevelDB 快 $70 \times$。

#### 4.1.4 崩溃一致性

将键与值分离需要额外的机制来维持崩溃一致性。我们通过使用 ALICE 工具 [45] 验证了 WiscKey 的崩溃一致性机制；该工具选择并模拟一组全面的、具有高概率暴露不一致性的系统崩溃。我们使用一个调用几次异步和同步 `Put()` 调用的测试用例。当配置为对 ext4、xfs 和 btrfs 运行测试时，ALICE 检查了 3000 多个选择性选择的系统崩溃，并未报告 WiscKey 引入任何一致性漏洞。

新的一致性机制也影响了 WiscKey 在崩溃后的恢复时间，我们设计了一个实验来测量 WiscKey 和 LevelDB 的最坏情况恢复时间。LevelDB 的恢复时间与崩溃后其日志文件的大小成正比；而 WiscKey 的恢复时间取决于 vLog 中从最近记录的头指针到末尾的数据量。在最坏情况下（即头指针记录很久以前），WiscKey 可能需要扫描与 LevelDB 日志文件相当或更多的数据。然而，通过定期持久化头指针（例如，每几 MB 的 vLog 写入一次），WiscKey 可以将恢复时间控制在很小范围内。图 14 显示了在不同 vLog 写入量下，WiscKey 和 LevelDB 的恢复时间。WiscKey 的恢复时间远低于 LevelDB，因为头指针的持久化频率很高，使得扫描量很小。

#### 4.1.5 CPU 开销

表 1 比较了 LevelDB 和 WiscKey 在四种工作负载下的 CPU 使用率（以 CPU 时间占总运行时间的百分比表示）。对于顺序加载、随机加载和随机查找，WiscKey 的 CPU 使用率与 LevelDB 相当或略高，这是因为它需要额外的 vLog 访问和验证。然而，对于范围查询，WiscKey 的 CPU 使用率显著高于 LevelDB（30.1% 对 11.2%），这是因为预取机制和并行随机读取带来了额外的线程管理和 I/O 提交开销。尽管 CPU 使用率较高，WiscKey 的整体吞吐量仍然远优于 LevelDB，这表明 I/O 是主要瓶颈，CPU 开销是可接受的。

| 工作负载 | 顺序加载 | 随机加载 | 随机查找 | 范围查询 |
| -------- | -------- | -------- | -------- | -------- |
| LevelDB  | 10.6%    | 6.3%     | 7.9%     | 11.2%    |
| WiscKey  | 8.2%     | 8.9%     | 11.3%    | 30.1%    |

**表 1：LevelDB 和 WiscKey 的 CPU 使用率。** 此表比较了 LevelDB 和 WiscKey 在四种工作负载下的 CPU 使用率。键大小为 16 B，值大小为 1 KB。SeqLoad 和 Rand-Load 分别顺序和随机加载一个 100-GB 数据库。给定一个 100-GB 随机填充的数据库，Rand-Lookup 执行 100 K 次随机查找，而 Range-Query 顺序扫描 4-GB 数据。

### 4.2 YCSB 基准测试

YCSB 基准测试 [21] 提供了一个框架和一组标准的六种工作负载，用于评估键值存储的性能。我们使用 YCSB 在 100-GB 数据库上比较 LevelDB、RocksDB [25] 和 WiscKey。除了测量 WiscKey 的常规性能外，我们还让 WiscKey 在后台始终运行垃圾回收以测量其最坏情况性能。RocksDB [25] 是 LevelDB 的面向 SSD 优化版本，具有许多优化，包括多个 memtable 和用于压实的后台线程。我们使用默认配置参数的 RocksDB。我们使用两种不同的值大小（1 KB 和 16 KB）评估了这些键值存储（数据压缩被禁用）。

[[115, 824, 484, 899], [512, 384, 880, 414]]

如图 15 所示，WiscKey 的性能显著优于 LevelDB 和 RocksDB。例如，在加载期间，对于 1-KB 值，在常规情况下 WiscKey 的性能至少是其他数据库的 $50 \times$，在最坏情况下（有垃圾回收）至少是 $45 \times$；对于 16-KB 值，即使在最坏情况下，WiscKey 的性能也高出 $104 \times$。

对于读取操作，大多数工作负载中使用的 Zipf 分布使得热门条目可以被缓存并在不访问磁盘的情况下检索，从而减小了 WiscKey 相对于 LevelDB 和 RocksDB 的优势。因此，WiscKey 在工作负载 A（50% 读取）中的相对性能（与 LevelDB 和 RocksDB 相比）优于工作负载 B（95% 读取）和工作负载 C（100% 读取）。然而，在这些工作负载中，RocksDB 和 LevelDB 仍然无法匹敌 WiscKey 的性能。

WiscKey 的最坏情况性能（即使对于只读工作负载也始终开启垃圾回收）优于 LevelDB 和 RocksDB。然而，垃圾回收对性能的影响对于 1-KB 和 16-KB 值明显不同。垃圾回收反复选择并清理 vLog 的一个 4-MB 块；对于小值，该块将包含许多键值对，因此垃圾回收花费更多时间访问 LSM 树以验证每个键值对的有效性。对于大值，垃圾回收花在验证上的时间较少，因此更积极地写出清理后的块，从而更显著地影响前台吞吐量。请注意，如有必要，可以限制垃圾回收的速度以减少其对前台的影响。

与之前考虑的微基准测试不同，工作负载 E 包含多个小范围查询，每次查询检索 1 到 100 个键值对。由于工作负载涉及多个范围查询，访问每个范围的第一个键相当于一次随机查找——这种情况对 WiscKey 有利。因此，即使对于 1-KB 值，WiscKey 的性能也优于 RocksDB 和 LevelDB。

<center>**图 15：YCSB 宏基准测试性能。** 此图显示了 LevelDB、RocksDB 和 WiscKey 在各种 YCSB 工作负载下的性能。X 轴对应不同的工作负载，Y 轴显示性能归一化到 LevelDB 的性能。柱状图顶部的数字显示实际达到的吞吐量（K ops/s）。（a）显示了 1-KB 值下的性能，（b）显示了 16-KB 值下的性能。加载工作负载对应于构建一个 100-GB 的数据库，类似于随机加载微基准测试。工作负载 A 包含 50% 的读取和 50% 的更新，工作负载 B 包含 95% 的读取和 5% 的更新，工作负载 C 包含 100% 的读取；键从 Zipf 分布中选择，更新操作针对已存在的键。工作负载 D 涉及 95% 的读取和 5% 插入新键（时间加权分布）。工作负载 E 涉及 95% 的范围查询和 5% 插入新键（Zipf 分布），而工作负载 F 包含 50% 的读取和 50% 的读-修改-写操作（Zipf 分布）。</center>

---

## 5 相关工作

各种基于哈希表的键值存储已被提出用于 SSD 设备。FAWN [8] 将键值对以仅追加日志的形式保存在 SSD 上，并使用内存中的哈希表索引进行快速查找。FlashStore [22] 和 SkimpyStash [23] 遵循相同的设计，但优化了内存中的哈希表；FlashStore 使用布谷鸟哈希和紧凑的键签名，而 SkimpyStash 使用线性链式法将部分表移至 SSD。BufferHash [7] 使用多个内存中的哈希表，并利用布隆过滤器来选择查找时使用哪个哈希表。SILT [35] 针对内存进行了高度优化，结合了日志结构、哈希表和排序表的布局。WiscKey 与这些键值存储共享日志结构的数据布局。然而，这些存储使用哈希表进行索引，因此不支持构建在 LSM 树存储之上的现代特性，例如范围查询或快照。WiscKey 则针对一个功能丰富的键值存储，可在各种情况下使用。

许多工作致力于优化原始的 LSM 树键值存储 [43]。bLSM [49] 提出了一种新的合并调度器来限制写入延迟，从而维持稳定的写入吞吐量，并且也使用布隆过滤器来提高性能。VT-tree [50] 通过使用一层间接寻址，避免了在压实过程中对任何已排序的键值对进行重新排序。WiscKey 则直接将值与键分离，无论工作负载中的键分布如何，都能显著减少写放大。LOCS [53] 将内部闪存通道暴露给 LSM 树键值存储，可以利用丰富的并行性实现更高效的压实。Atlas [32] 是一个基于 ARM 处理器和纠删码的分布式键值存储，将键和值存储在不同的硬盘上。WiscKey 是一个独立的键值存储，其中键和值的分离针对 SSD 设备进行了高度优化，以实现显著的性能提升。LSM-trie [54] 使用 trie 结构来组织键，并提出了一种基于 trie 的更高效的压实方法；然而，这种设计牺牲了 LSM 树的特性，例如对范围查询的高效支持。如前所述的 RocksDB，由于其设计与 LevelDB 根本相似，仍然表现出高写放大；RocksDB 的优化与 WiscKey 的设计是正交的。

Walnut [18] 是一个混合对象存储，将小对象存储在 LSM 树中，而将大对象直接写入文件系统。IndexFS [47] 将其元数据存储在使用列式模式的 LSM 树中，以提高插入吞吐量。Purity [19] 也通过仅对索引进行排序并将元组按时间顺序存储来将其索引与数据元组分离。这三个系统都使用了与 WiscKey 类似的技术。然而，我们以更通用和更完整的方式解决了这个问题，并在广泛的工作负载下优化了 SSD 设备的加载和查找性能。

基于其他数据结构的键值存储也被提出。TokuDB [13, 14] 基于分形树索引，它在内部节点缓冲更新；键不排序，并且需要在内存中维护一个大的索引以获得良好性能。ForestDB [6] 使用 HB+ trie 来高效索引长键，提高了性能并减少了内部节点的空间开销。NVMKV [39] 是一个感知 FTL 的键值存储，它利用原生 FTL 功能，如稀疏寻址和事务支持。将多个请求分组为单个操作的向量接口也被提出用于键值存储 [52]。由于这些键值存储基于不同的数据结构，它们在性能方面各有不同的权衡；相反，WiscKey 提出了改进广泛使用的 LSM 树结构。

许多提出的技术旨在克服内存中键值存储的可扩展性瓶颈，例如 Mastree [38]、MemC3 [27]、Memcache [41]、MICA [36] 和 cLSM [28]。这些技术可以适用于 WiscKey 以进一步提高其性能。

---

## 6 结论

键值存储已成为数据密集型应用中的基本构建块。在本文中，我们提出了 WiscKey，一种新颖的基于 LSM 树的键值存储，它通过分离键和值来最小化读写放大。WiscKey 的数据布局和 I/O 模式针对 SSD 设备进行了高度优化。我们的结果表明，WiscKey 可以显著提高大多数工作负载的性能。我们希望 WiscKey 中的键值分离和各种优化技术能够启发下一代高性能键值存储。

---

## 致谢

我们感谢匿名审稿人和 Ethan Miller（我们的指导者）提供的反馈。我们感谢 ADSL 研究小组的成员、RocksDB 团队（Facebook）、Yinan Li（微软研究院）和 Bin Fan（Tachyon Nexus）在不同阶段对本工作的建议和意见。

本材料部分由 NSF 基金 CNS-1419199、CNS-1421033、CNS-1319405 和 CNS-1218405 以及 EMC、Facebook、Google、Huawei、Microsoft、NetApp、Seagate、Samsung、Veritas 和 VMware 的慷慨捐赠支持。本文所表达的任何观点、发现、结论或建议均为作者个人观点，不一定反映 NSF 或其他机构的观点。

---

## 参考文献

[1] Apache HBase. http://hbase.apache.org/ 2007.  
[2] Redis. http://redis.io/2009.  
[3] Fusion-IO ioDrive2. http://www.fusionio.com/products/iodrive2, 2015.  
[4] Riak. http://docs.basho.com/riak/, 2015.  
[5] RocksDB Blog. http://rocksdb.org/blog/ 2015.  
[6] Jung-Sang Ahn, Chiyoung Seo, Ravi Mayuram, Rahim Yaseen, Jin-Soo Kim, and Seungryoul Maeng. ForestDB: A Fast Key-Value Storage System for Variable-Length String Keys. _IEEE Transactions on Computers_, Preprint, May 2015.  
[7] Ashok Anand, Chitra Muthukrishnan, Steven Kappes, Aditya Akella, and Suman Nath. Cheap and Large CAMs for High-performance Dataintensive Networked Systems. In _Proceedings of the 7th Symposium on Networked Systems Design and Implementation (NSDI '10)_, San Jose, California, April 2010.  
[8] David Andersen, Jason Franklin, Michael Kaminsky, Amar Phanishayee, Lawrence Tan, and Vijay Vasudevan. FAWN: A Fast Array of Wimpy Nodes. In _Proceedings of the 22nd ACM Symposium on Operating Systems Principles (SOSP '09)_, Big Sky, Montana, October 2009.  
[9] Timothy G. Armstrong, Vamsi Ponnekanti, Dhruba Borthakur, and Mark Callaghan. LinkBench: A Database Benchmark Based on the Facebook Social Graph. In _Proceedings of the 2013 ACM SIGMOD International Conference on Management of Data (SIGMOD '13)_, New York, New York, June 2013.  
[10] Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau. _Operating Systems: Three Easy Pieces_. Arpaci-Dusseau Books, 0.9 edition, 2014.  
[11] Berk Atikoglu, Yuehai Xu, Eitan Frachtenberg, Song Jiang, and Mike Paleczny. Workload Analysis of a Large-Scale Key-Value Store. In _Proceedings of the USENIX Annual Technical Conference (USENIX '15)_, Santa Clara, California, July 2015.  
[12] Doug Beaver, Sanjeev Kumar, Harry C. Li, Jason Sobel, and Peter Vajgel. Finding a needle in Haystack: Facebook's photo storage. In _Proceedings of the 9th Symposium on Operating Systems Design and Implementation (OSDI '10)_, Vancouver, Canada, December 2010.  
[13] Michael A. Bender, Martin Farach-Colton, Jeremy T. Fineman, Yonatan Fogel, Bradley Kuszmaul, and Jelani Nelson. Cache-Oblivious Streaming B-trees. In _Proceedings of the Nineteenth ACM Symposium on Parallelism in Algorithms and Architectures (SPAA '07)_, San Diego, California, June 2007.  
[14] Adam L. Buchsbaum, Michael Goldwasser, Suresh Venkatasubramanian, and Jeffrey R. Westbrook. On External Memory Graph Traversal. In _Proceedings of the Eleventh Annual ACM-SIAM Symposium on Discrete Algorithms (SODA '00)_, San Francisco, California, January 2000.  
[15] Adrian M. Caulfield, Arup De, Joel Coburn, Todor I. Mollow, Rajesh K. Gupta, and Steven Swanson. Moneta: A High-Performance Storage Array Architecture for Next-Generation, Nonvolatile Memories. In _Proceedings of the 43nd Annual IEEE/ACM International Symposium on Microarchitecture (MICRO'10)_, Atlanta, Georgia, December 2010.  
[16] Fay Chang, Jeffrey Dean, Sanjay Ghemawat, Wilson C. Hsieh, Deborah A. Wallach, Michael Burrows, Tushar Chandra, Andrew Fikes, and Robert Gruber. Bigtable: A Distributed Storage System for Structured Data. In _Proceedings of the 7th Symposium on Operating Systems Design and Implementation (OSDI '06)_, pages 205-218, Seattle, Washington, November 2006.  
[17] Feng Chen, Rubao Lee, and Xiaodong Zhang. Essential Roles of Exploiting Internal Parallelism of Flash Memory Based Solid State Drives in High-speed Data Processing. In _Proceedings of the 17th International Symposium on High Performance Computer Architecture (HPCA-11)_, San Antonio, Texas, February 2011.  
[18] Jianjun Chen, Chris Douglas, Michi Mutsuzaki, Patrick Quaid, Raghu Ramakrishnan, Sriram Rao, and Russell Sears. Walnut: A Unified Cloud Object Store. In _Proceedings of the 2012 ACM SIGMOD International Conference on Management of Data (SIGMOD '12)_, Scottsdale, Arizona, May 2012.  
[19] John Colgrove, John D. Davis, John Hayes, Ethan L. Miller, Cary Sandvig, Russell Sears, Ari Tamches, Neil Vachharajani, and Feng Wang. Purity: Building Fast, Highly-Available Enterprise Flash Storage from Commodity Components. In _Proceedings of the 2015 ACM SIGMOD International Conference on Management of Data (SIGMOD '15)_, Melbourne, Australia, May 2015.  
[20] Brian F. Cooper, Raghu Ramakrishnan, Utkarsh Srivastava, Adam Silberstein, Philip Bohannon, Hans-Arno Jacobsen, Nick Puz, Daniel Weaver, and Ramana Yerneni. PNUTS: Yahoo!'s Hosted Data Serving Platform. In _Proceedings of the VLDB Endowment (PVLDB 2008)_, Auckland, New Zealand, August 2008.  
[21] Brian F. Cooper, Adam Silberstein, Erwin Tam, Raghu Ramakrishnan, and Russell Sears. Benchmarking Cloud Serving Systems with YCSB. In _Proceedings of the ACM Symposium on Cloud Computing (SOCC '10)_, Indianapolis, Indiana, June 2010.  
[22] Biplob Debnath, Sudipta Sengupta, and Jin Li. FlashStore: High Throughput Persistent Key-Value Store. In _Proceedings of the 36th International Conference on Very Large Databases (VLDB 2010)_, Singapore, September 2010.  
[23] Biplob Debnath, Sudipta Sengupta, and Jin Li. SkimpyStash: RAM Space Skimpy Key-value Store on Flash-based Storage. In _Proceedings of the 2011 ACM SIGMOD International Conference on Management of Data (SIGMOD '11)_, Athens, Greece, June 2011.  
[24] Giuseppe DeCandia, Deniz Hastorun, Madan Jampani, Gunavardhan Kakulapati, Avinash Lakshman, Alex Pilchin, Swami Sivasubramanian, Peter Vosshall, and Werner Vogels. Dynamo: Amazon's Highly Available Key-Value Store. In _Proceedings of the 21st ACM Symposium on Operating Systems Principles (SOSP '07)_, Stevenson, Washington, October 2007.  
[25] Facebook. RocksDB. http://rocksdb.org/, 2013.  
[26] Facebook. RocksDB 2015 H2 Roadmap. http://rocksdb.org/blog/2015/rocksdb-2015-h2-roadmap/, 2015.  
[27] Bin Fan, David G. Andersen, and Michael Kaminsky. MemC3: Compact and Concurrent MemCache with Dumber Caching and Smarter Hashing. In _Proceedings of the 10th Symposium on Networked Systems Design and Implementation (NSDI '13)_, Lombard, Illinois, April 2013.  
[28] Guy Golan-Gueta, Edward Bortnikov, Eshcar Hillel, and Idit Keidar. Scaling Concurrent Log-Structured Data Stores. In _Proceedings of the EuroSys Conference (EuroSys '15)_, Bordeaux, France, April 2015.  
[29] Tyler Harter, Dhruba Borthakur, Siying Dong, Amitanand Aiyer, Liyin Tang, Andrea C. Arpaci-Dusseau, and Remzi H. Arpaci-Dusseau. Analysis of HDFS Under HBase: A Facebook Messages Case Study. In _Proceedings of the 12th USENIX Symposium on File and Storage Technologies (FAST '14)_, Santa Clara, California, February 2014.  
[30] William Jannen, Jun Yuan, Yang Zhan, Amogh Akshintala, John Esmet, Yizheng Jiao, Ankur Mittal, Prashant Pandey, Phaneendra Reddy, Leif Walsh, Michael Bender, Martin Farach-Colton, Rob Johnson, Bradley C. Kuszmaul, and Donald E. Porter. BetrFS: A Right-Optimized Write-Optimized File System. In _Proceedings of the 13th USENIX Symposium on File and Storage Technologies (FAST '15)_, Santa Clara, California, February 2015.  
[31] Hyojun Kim, Nitin Agrawal, and Cristian Ungureanu. Revisiting Storage for Smartphones. In _Proceedings of the 10th USENIX Symposium on File and Storage Technologies (FAST '12)_, San Jose, California, February 2012.  
[32] Chunbo Lai, Song Jiang, Liqiong Yang, Shiding Lin, Guangyu Sun, Zhenyu Hou, Can Cui, and Jason Cong. Atlas: Baidu's Key-value Storage System for Cloud Data. In _Proceedings of the 31st International Conference on Massive Storage Systems and Technology (MSST '15)_, Santa Clara, California, May 2015.  
[33] Avinash Lakshman and Prashant Malik. Cassandra - A Decentralized Structured Storage System. In _The 3rd ACM SIGOPS International Workshop on Large Scale Distributed Systems and Middleware_, Big Sky Resort, Montana, Oct 2009.  
[34] Changman Lee, Dongho Sim, Jooyoung Hwang, and Sangyeun Cho. F2FS: A New File System for Flash Storage. In _Proceedings of the 13th USENIX Symposium on File and Storage Technologies (FAST '15)_, Santa Clara, California, February 2015.  
[35] Hyeontaek Lim, Bin Fan, David G. Andersen, and Michael Kaminsky. SILT: A Memory-efficient, High-performance Key-value Store. In _Proceedings of the 23rd ACM Symposium on Operating Systems Principles (SOSP '11)_, Cascais, Portugal, October 2011.  
[36] Hyeontaek Lim, Dongsu Han, David G. Andersen, and Michael Kaminsky. MICA: A Holistic Approach to Fast In-Memory Key-Value Storage. In _Proceedings of the 11th Symposium on Networked Systems Design and Implementation (NSDI '14)_, Seattle, Washington, April 2014.  
[37] Haohui Mai and Jing Zhao. Scaling HDFS to Manage Billions of Files with Key Value Stores. In _The 8th Annual Hadoop Summit_, San Jose, California, Jun 2015.  
[38] Yandong Mao, Eddie Kohler, and Robert Morris. Cache Craftiness for Fast Multicore Key-Value Storage. In _Proceedings of the EuroSys Conference (EuroSys '12)_, Bern, Switzerland, April 2012.  
[39] Leonardo Marmol, Swaminathan Sundararaman, Nisha Talagala, and Raju Rangaswami. NVMKV: A Scalable, Lightweight, FTL-aware Key-Value Store. In _Proceedings of the USENIX Annual Technical Conference (USENIX '15)_, Santa Clara, California, July 2015.  
[40] Changwoo Min, Kangnyeon Kim, Hyunjin Cho, Sang-Won Lee, and Young Ik Eom. SFS: Random Write Considered Harmful in Solid State Drives. In _Proceedings of the 10th USENIX Symposium on File and Storage Technologies (FAST '12)_, San Jose, California, February 2012.  
[41] Rajesh Nishtala, Hans Fugal, Steven Grimm, Marc Kwiatkowski, Herman Lee, Harry C. Li, Ryan McElroy, Mike Paleczny, Daniel Peek, Paul Saab, David Stafford, Tony Tung, and Venkateshwaran Venkataramani. Scaling Memcache at Facebook. In _Proceedings of the 10th Symposium on Networked Systems Design and Implementation (NSDI '13)_, Lombard, Illinois, April 2013.  
[42] Chris Nyberg, Tom Barclay, Zarka Cvetanovic, Jim Gray, and Dave Lomet. AlphaSort: A RISC Machine Sort. In _Proceedings of the 1994 ACM SIGMOD International Conference on Management of Data (SIGMOD '94)_, Minneapolis, Minnesota, May 1994.  
[43] Patrick O'Neil, Edward Cheng, Dieter Gawlick, and Elizabeth O'Neil. The Log-Structured Merge-Tree (LSM-tree). _Acta Informatica_, 33(4):351-385, 1996.  
[44] Simon Peter, Jialin Li, Irene Zhang, Dan R. K. Ports, Doug Woos, Arvind Krishnamurthy, and Thomas Anderson. Arrakis: The Operating System is the Control Plane. In _Proceedings of the 11th Symposium on Operating Systems Design and Implementation (OSDI '14)_, Broomfield, Colorado, October 2014.  
[45] Thanumalayan Sankaranarayana Pillai, Vijay Chidambaram, Ramnathan Alagappan, Samer Al-Kiswany, Andrea C. Arpaci-Dusseau, and Remzi H. Arpaci-Dusseau. All File Systems Are Not Created Equal: On the Complexity of Crafting Crash-Consistent Applications. In _Proceedings of the 11th Symposium on Operating Systems Design and Implementation (OSDI '14)_, Broomfield, Colorado, October 2014.  
[46] Kai Ren and Garth Gibson. TABLEFS: Enhancing Metadata Efficiency in the Local File System. In _Proceedings of the USENIX Annual Technical Conference (USENIX '13)_, San Jose, California, June 2013.  
[47] Kai Ren, Qing Zheng, Swapnil Patil, and Garth Gibson. IndexFS: Scaling File System Metadata Performance with Stateless Caching and Bulk Insertion. In _Proceedings of the International Conference for High Performance Computing, Networking, Storage and Analysis (SC '14)_, New Orleans, Louisiana, November 2014.  
[48] Sanjay Ghemawat and Jeff Dean. LevelDB. http://code.google.com/p/leveldb, 2011.  
[49] Russell Sears and Raghu Ramakrishnan. bLSM: A General Purpose Log Structured Merge Tree. In _Proceedings of the 2012 ACM SIGMOD International Conference on Management of Data (SIGMOD '12)_, Scottsdale, Arizona, May 2012.  
[50] Pradeep Shetty, Richard Spillane, Ravikant Malpani, Binesh Andrews, Justin Seyster, and Erez Zadok. Building Workload-Independent Storage with VT-Trees. In _Proceedings of the 11th USENIX Symposium on File and Storage Technologies (FAST '13)_, San Jose, California, February 2013.  
[51] Roshan Sumbaly, Jay Kreps, Lei Gao, Alex Feinberg, Chinmay Soman, and Sam Shah. Serving Large-scale Batch Computed Data with Project Voldemort. In _Proceedings of the 10th USENIX Symposium on File and Storage Technologies (FAST '12)_, San Jose, California, February 2012.  
[52] Vijay Vasudevan, Michael Kaminsky, and David G. Andersen. Using Vector Interfaces to Deliver Millions of IOPS from a Networked Key-value Storage Server. In _Proceedings of the ACM Symposium on Cloud Computing (SOCC '12)_, San Jose, California, October 2012.  
[53] Peng Wang, Guangyu Sun, Song Jiang, Jian Ouyang, Shiding Lin, Chen Zhang, and Jason Cong. An Efficient Design and Implementation of LSM-Tree based Key-Value Store on Open-Channel SSD. In _Proceedings of the EuroSys Conference (EuroSys '14)_, Amsterdam, Netherlands, April 2014.  
[54] Xingbo Wu, Yuehai Xu, Zili Shao, and Song Jiang. LSM-trie: An LSM-tree-based Ultra-Large Key-Value Store for Small Data. In _Proceedings of the USENIX Annual Technical Conference (USENIX '15)_, Santa Clara, California, July 2015.
