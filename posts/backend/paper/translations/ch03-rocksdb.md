---
title: 服务大规模应用的键值存储开发优先级的演进：RocksDB 的经验
date: 2026-08-10
order: 3
---

# 服务大规模应用的键值存储开发优先级的演进：RocksDB 的经验

**Siying Dong†、Andrew Kryczka†、Yanqin Jin† 和 Michael Stumm‡**

†Facebook Inc.，1 Hacker Way, Menlo Park, CA, U.S.A
‡University of Toronto, Toronto, Canada

发表于第19届 USENIX 文件与存储技术会议（FAST '21）论文集，2021年2月23–25日

---

## 摘要

RocksDB 是一个面向大规模分布式系统、并针对固态硬盘（SSD）进行优化的键值存储。本文描述了过去八年间我们在开发 RocksDB 时优先事项的演变过程。这一演变既是硬件发展趋势的结果，也是 RocksDB 在众多组织的大规模生产环境中长期运行所积累的丰富经验的产物。我们描述了 RocksDB 的资源优化目标为何以及如何从写放大迁移到空间放大，再到 CPU 利用率。从运行大规模应用中汲取的经验教训告诉我们：资源分配需要在不同的 RocksDB 实例之间进行管理；数据格式需要保持向后和向前兼容，以支持增量式软件发布；同时还需要对数据库复制和备份提供适当的支持。从故障处理中汲取的经验教训告诉我们：数据损坏错误需要在系统的每一层尽早被检测到。

---

## 1 引言

RocksDB [19, 54] 是 Facebook 于 2012 年基于 Google 的 LevelDB 代码库 [22] 创建的高性能持久化键值存储引擎。它针对固态硬盘（SSD）的特定特性进行了优化，面向大规模（分布式）应用，并被设计为一个嵌入到上层应用中的库组件。因此，每个 RocksDB 实例仅管理单台服务器节点上存储设备中的数据；它不处理任何跨主机操作（如复制和负载均衡），也不执行高级操作（如检查点）——它将这些操作的实现留给应用层，但提供适当的支持使应用能够有效地完成这些操作。

RocksDB 及其各个组件具有高度可定制性，使得存储引擎能够适应广泛的需求和工作负载；定制内容可以包括预写日志（WAL）的处理方式、压缩策略和合并压缩（compaction）策略（即去除无效数据并优化 LSM 树的过程，详见 §2）。RocksDB 可以调优为高写吞吐量或高读吞吐量，也可以调优为空间效率优先，或者在两者之间取得平衡。

由于其可配置性，RocksDB 被众多应用所采用，涵盖了广泛的使用场景。仅在 Facebook 内部，就有超过 30 个不同的应用使用 RocksDB，总计存储着数百 PB 的生产数据。除了被用作数据库的存储引擎（例如 MySQL [37]、Rocksandra [6]、CockroachDB [64]、MongoDB [40] 和 TiDB [27]）之外，RocksDB 还被用于以下具有截然不同特征的服务类型（总结于表 1）：

- **流处理**：RocksDB 被用于在 Apache Flink [12]、Kafka Stream [31]、Samza [43] 以及 Facebook 的 Stylus [15] 中存储暂存数据。
- **日志/队列服务**：RocksDB 被 Facebook 的 LogDevice [5]（同时使用 SSD 和 HDD）、Uber 的 Cherami [8] 以及 Iron.io [29] 所使用。
- **索引服务**：RocksDB 被 Facebook 的 Dragon [59] 和 Rockset [58] 所使用。
- **SSD 上的缓存**：内存缓存服务，如 Netflix 的 EVCache [7]、奇虎的 Pika [51] 和 Redis [46]，使用 RocksDB 将从 DRAM 中淘汰的数据存储到 SSD 上。

此前的一篇论文对使用 RocksDB 的若干数据库应用进行了分析 [11]。表 2 总结了从生产工作负载中获取的一些关键系统指标。

拥有一个能够支持多种不同使用场景的存储引擎，其优势在于同一个存储引擎可以跨不同应用使用。事实上，让每个应用自行构建存储子系统是有问题的，因为这样做极具挑战性。即使是简单的应用也需要使用校验和来防止介质损坏、保证崩溃后的数据一致性、以正确的顺序发出正确的系统调用以保证写入的持久性，以及正确处理文件系统返回的错误。一个成熟的通用存储引擎能够在所有这些领域提供精细化的能力。

当客户端应用运行在共同的基础设施中时，使用通用存储引擎还能带来额外的好处：监控框架、性能分析工具和调试工具都可以共享。例如，公司内不同应用的所有者可以利用同一个内部框架将统计数据报告到同一个仪表板，使用相同的工具监控系统，并通过相同的嵌入式管理服务来管理 RocksDB。这种整合不仅使专业知识能够在不同团队之间轻松复用，还使信息能够汇聚到统一的门户，并鼓励开发管理工具。

鉴于采用 RocksDB 的应用集如此多样，其开发优先级自然也在不断演变。本文描述了过去八年间我们的优先级如何随着我们从真实世界应用（包括 Facebook 内部和其他组织）中汲取实践经验教训以及观察到硬件趋势的变化而演变，这促使我们重新审视了一些早期的假设。我们还描述了 RocksDB 在近期的开发优先级。

§2 提供了关于 SSD 和日志结构合并（LSM）树 [45] 的背景知识。从一开始，RocksDB 就选择了 LSM 树作为其主要数据结构，以应对读写性能的不对称性和闪存 SSD 有限的耐久性。我们认为 LSM 树为 RocksDB 提供了良好的服务，并认为即使面对即将到来的硬件趋势，它们仍然是合适的选择（§3）。LSM 树数据结构是 RocksDB 能够适应具有不同需求的各类应用的原因之一。

§3 描述了我们的主要优化目标如何从最小化写放大转向最小化空间放大，以及从优化性能转向优化效率。

§4 描述了我们在服务大规模分布式系统中汲取的经验教训；例如：(i) 资源分配必须在多个 RocksDB 实例之间进行管理，因为单台服务器可能承载多个实例；(ii) 数据格式必须保持向后和向前兼容，因为 RocksDB 的软件更新是增量式部署/回滚的；(iii) 对数据库复制和备份提供适当的支持至关重要。

§5 描述了我们在故障处理方面的经验。大规模分布式系统通常使用复制来实现容错和高可用。然而，单节点故障必须得到妥善处理才能实现这一目标。我们发现，仅仅识别和传播文件系统及校验和错误是不够的。相反，每一层的故障（如位翻转）都必须尽早被识别，并且应用应能够指定策略，在可能的情况下以自动化方式处理这些故障。

§6 介绍了我们对改进键值接口的思考。虽然核心接口简单而强大且具有灵活性，但它限制了某些关键使用场景的性能。我们描述了对用户自定义时间戳的支持，该时间戳独立于键和值。

§8 列出了 RocksDB 可以从未来研究中受益的几个领域。

---

## 2 背景

闪存的特性深刻影响了 RocksDB 的设计。读写性能的不对称性和有限的耐久性对数据结构和系统架构的设计提出了挑战和机遇。因此，RocksDB 采用了闪存友好的数据结构，并针对现代硬件进行了优化。

### 2.1 基于闪存 SSD 的嵌入式存储

在过去十年中，我们见证了基于闪存的 SSD 在服务在线数据方面的普及。这种低延迟、高吞吐量的设备不仅挑战了软件充分利用其全部能力，还改变了许多有状态服务的实现方式。SSD 在读写方面均可提供数十万的每秒输入/输出操作数（IOPS），比旋转硬盘快数千倍。它还可以支持数百 MB 的带宽。然而，由于有限的编程/擦除周期数，高写带宽无法持续维持。这些因素为重新思考存储引擎的数据结构以针对这种硬件进行优化提供了机会。

SSD 的高性能在许多情况下还将性能和吞吐量的瓶颈从设备 I/O 转移到了网络。对于应用来说，将数据存储在本地 SSD 上而非使用远程数据存储服务变得更具吸引力。这增加了对嵌入到应用中的键值存储引擎的需求。

RocksDB 正是为了满足这些需求而创建的。我们希望创建一个灵活的键值存储，在使用本地 SSD 驱动器的同时，为广泛的应用提供服务，并针对 SSD 的特性进行优化。LSM 树在实现这些目标中发挥了关键作用。

### 2.2 RocksDB 架构

RocksDB 使用日志结构合并（LSM）树 [45] 作为存储数据的主要数据结构。

**写入。** 每当数据被写入 RocksDB 时，它会被添加到一个名为 MemTable 的内存写缓冲区，以及一个磁盘上的预写日志（WAL）。MemTable 以跳表（skiplist）实现，以保持数据有序，插入和搜索的开销为 O(log n)。WAL 用于故障后的恢复，但并非强制性的。当 MemTable 的大小达到配置的大小时，(i) MemTable 和 WAL 变为不可变，(ii) 为后续写入分配新的 MemTable 和 WAL，(iii) MemTable 的内容被刷新到磁盘上的一个"有序字符串表"（SSTable）数据文件中，(iv) 已刷新的 MemTable 和关联的 WAL 被丢弃。每个 SSTable 以排序顺序存储数据，被划分为大小均匀的块。每个 SSTable 还有一个索引块，每个 SSTable 块对应一个索引条目，用于二分查找。

**合并压缩（Compaction）。** LSM 树有多层 SSTable，如图 1 所示。最新的 SSTable 由 MemTable 刷新创建，放置在 Level-0。高于 Level-0 的层级由合并压缩过程创建。给定层级的 SSTable 大小由配置参数限制。当 level-L 的大小目标被超出时，level-L 中的一些 SSTable 会被选中并与 level-(L+1) 中重叠的 SSTable 合并。在此过程中，已删除和被覆盖的数据被移除，表被优化以提升读性能和空间效率。这个过程逐步将写入的数据从 Level-0 迁移到最后一层。合并压缩的 I/O 是高效的，因为它可以并行化，并且只涉及整个文件的批量读写。

Level-0 的 SSTable 具有重叠的键范围，因为每个 SSTable 覆盖一个完整的有序运行（sorted run）。后续各层各自只包含一个有序运行，因此这些层中的 SSTable 包含其所在层有序运行的一个分区。

**读取。** 在读取路径中，键查找在每一层依次进行，直到找到该键或确定该键不存在于最后一层。查找首先搜索所有 MemTable，然后是所有 Level-0 SSTable，接着依次搜索更高各层的 SSTable。在每一层中使用二分查找。布隆过滤器（Bloom filter）用于消除对 SSTable 文件内不必要的搜索。扫描操作需要搜索所有层级。

RocksDB 支持多种不同类型的合并压缩。分层合并压缩（Leveled Compaction）从 LevelDB 继承并加以改进 [19]。在这种合并压缩风格中，各层被分配了指数递增的大小目标，如图 1 中虚线框所示。分层合并压缩（Tiered Compaction，在 RocksDB 中称为 Universal Compaction）类似于 Apache Cassandra 或 HBase 所使用的方式。多个有序运行被延迟地合并在一起，要么在有序运行数量过多时，要么在数据库总大小与最大有序运行大小的比率超过可配置阈值时。最后，FIFO 合并压缩在数据库达到大小限制时简单地丢弃旧文件，只执行轻量级的合并压缩。它面向内存缓存应用。

能够配置合并压缩的类型使 RocksDB 能够服务于广泛的使用场景。通过使用不同的合并压缩风格，RocksDB 可以被配置为读友好、写友好，或者针对特殊缓存工作负载的极致写友好。然而，应用所有者需要针对其特定使用场景考虑不同指标之间的权衡 [2]。更懒惰的合并压缩算法可以改善写放大和写吞吐量，但读性能会下降；而更激进的合并压缩则牺牲写性能但允许更快的读取。日志或流处理等服务可以使用写密集型配置，而数据库服务则需要平衡的方式。表 3 通过微基准测试结果展示了这种灵活性。

**表 3：RocksDB 5.9 下三种主要合并压缩类型的写放大、空间开销和读 I/O。** Tiered Compaction 的有序运行数设为 12，FIFO Compaction 使用每个键 20 位布隆过滤器。使用 Direct I/O，块缓存大小设为完全压缩后数据库大小的 10%。写放大计算为 SSTable 文件总写入量与 MemTable 刷新字节数的比值。不包括 WAL 写入。

|         | 合并压缩写放大 | 最大空间开销 | 平均空间开销 | 有布隆过滤器时每次 Get() 的 I/O 数 | 无过滤器时每次 Get() 的 I/O 数 | 每次迭代器 seek 的 I/O 数 |
| ------- | -------------- | ------------ | ------------ | ---------------------------------- | ------------------------------ | ------------------------- |
| Leveled | 16.07          | 9.8%         | 9.5%         | 0.99                               | 1.7                            | 1.84                      |
| Tiered  | 4.8            | 94.4%        | 45.5%        | 1.03                               | 3.39                           | 4.80                      |
| FIFO    | 2.14           | N/A          | N/A          | 1.16                               | 528                            | 967                       |

---

## 3 资源优化目标的演进

在此我们描述资源优化目标如何随时间演变：从写放大到空间放大，再到 CPU 利用率。

### 写放大

当我们开始开发 RocksDB 时，我们最初专注于节省闪存擦除周期，因此关注写放大，遵循当时社区的普遍观点（例如 [34]）。这对于许多应用来说确实是一个重要的目标，特别是对于那些写密集型工作负载的应用（表 1），在这些应用中它仍然是一个问题。

写放大在两个层面产生。SSD 本身会引入写放大：根据我们的观察，在 1.1 到 3 之间。存储和数据库软件也会产生写放大；有时可高达 100（例如，当不到 100 字节的更改导致整个 4KB/8KB/16KB 页被写出时）。

RocksDB 中的分层合并压缩通常表现出 10 到 30 之间的写放大，在许多情况下比使用 B 树好数倍。例如，在 MySQL 上运行 LinkBench 时，RocksDB 每个事务发出的写入量仅为 InnoDB（一种基于 B 树的存储引擎）的 5% [37]。尽管如此，10–30 范围的写放大对于写密集型应用来说仍然过高。因此我们添加了分层合并压缩（Tiered Compaction），将写放大降低到 4–10 的范围，尽管读性能较低；见表 3。图 2 描绘了 RocksDB 在不同数据摄入速率下的写放大。RocksDB 应用所有者通常在写入速率较高时选择减少写放大的合并压缩方法，而在写入速率较低时更激进地进行合并压缩以实现空间效率和读性能目标。

### 空间放大

经过几年的开发，我们观察到对于大多数应用来说，空间利用率远比写放大重要，因为闪存写入周期和写入开销都不是约束条件。事实上，实际使用的 IOPS 数量与 SSD 能提供的相比很低（但仍然足够高，使得即使忽略维护开销，HDD 也缺乏吸引力）。因此，我们将资源优化目标转向了磁盘空间。

幸运的是，LSM 树由于其非碎片化的数据布局，在优化磁盘空间方面也表现良好。然而，我们看到了通过减少 LSM 树中无效数据（即已删除和被覆盖的数据）来改进分层合并压缩的机会。我们开发了动态分层合并压缩（Dynamic Leveled Compaction），其中树中每一层的大小根据最后一层的实际大小自动调整（而不是静态设置每一层的大小）[19]。这种方法比分层合并压缩实现了更好且更稳定的空间效率。表 4 展示了在随机写入基准测试中测量的空间效率：动态分层合并压缩将空间开销限制在 13%，而分层合并压缩可能增加超过 25%。此外，分层合并压缩在最坏情况下的空间开销可高达 90%，而动态分层则保持稳定。事实上，对于 Facebook 的主要数据库之一 UDB，当 InnoDB 被 RocksDB 替换后，空间占用减少到了 50% [36]。

**表 4：RocksDB 空间效率的微基准测试测量结果：** 数据预先填充，每次写入针对从预填充键空间中随机选择的键。RocksDB 5.9 使用所有默认选项。恒定 2MB/s 写入速率。

| 键数（百万） | 完全压缩后大小 (GB) | 稳态数据库大小 (GB)  | 空间开销 (%) | 完全压缩后大小 (GB) | 稳态数据库大小 (GB)          | 空间开销 (%) |
| ------------ | ------------------- | -------------------- | ------------ | ------------------- | ---------------------------- | ------------ |
|              |                     | **动态分层合并压缩** |              |                     | **LevelDB 风格分层合并压缩** |              |
| 200          | 12.0                | 13.5                 | 12.4         | 12.0                | 15.1                         | 25.6         |
| 400          | 24.0                | 26.9                 | 11.8         | 24.0                | 26.9                         | 12.2         |
| 600          | 36.0                | 40.4                 | 12.2         | 36.4                | 42.5                         | 16.9         |
| 800          | 48.0                | 54.2                 | 12.7         | 48.3                | 57.9                         | 19.7         |
| 1,000        | 60.1                | 67.5                 | 12.4         | 60.3                | 73.8                         | 22.4         |

### CPU 利用率

有时会提出的一个关注点是，SSD 已经变得如此之快，以至于软件不再能够充分利用其全部潜力。也就是说，使用 SSD 后，瓶颈已经从存储设备转移到了 CPU，因此需要对软件进行根本性的改进。基于我们的经验，我们不认同这种担忧，也不认为它会在未来基于 NAND 闪存的 SSD 上成为问题，原因有二。首先，只有少数应用受到 SSD 提供的 IOPS 的限制；如 §4.2 所讨论的，大多数应用受到空间的限制。

其次，我们发现任何配备高端 CPU 的服务器都有足够的计算能力来充分利用一块高端 SSD。在我们的环境中，RocksDB 从未出现过无法充分利用 SSD 性能的问题。当然，可以配置一个使 CPU 成为瓶颈的系统；例如，一个 CPU 配多个 SSD 的系统。然而，有效的系统通常是配置均衡的系统，当今的技术允许做到这一点。密集的写主导工作负载也可能导致 CPU 成为瓶颈。对于其中一些情况，可以通过配置 RocksDB 使用更轻量级的压缩选项来缓解。对于其他情况，工作负载可能根本不适合 SSD，因为它会超出使 SSD 持续 2-5 年的典型闪存耐久性预算。

为了验证我们的观点，我们调查了 42 个不同的 ZippyDB [65] 和 MyRocks 生产部署，每个部署服务于不同的应用。图 3 展示了结果。大多数工作负载受到空间约束。一些确实是 CPU 密集型的，但主机通常不会被完全利用，以便为增长和处理数据中心或区域级故障留出余量（或者由于配置错误）。这些部署中的大多数包含数百台主机，因此平均值可以反映这些使用场景的资源需求，考虑到工作负载可以在这些主机之间自由（重新）平衡（§4）。

尽管如此，减少 CPU 开销已经成为一个重要的优化目标，因为减少空间放大的低垂果实已经被摘取。减少 CPU 开销可以提升少数确实受 CPU 约束的应用的性能。更重要的是，减少 CPU 开销的优化允许更具成本效益的硬件配置——直到几年前，CPU 和内存的价格相对于 SSD 来说还算合理，但 CPU 和内存的价格已大幅上涨，因此降低 CPU 开销和内存使用变得更加重要。早期降低 CPU 开销的努力包括引入前缀布隆过滤器、在索引查找之前应用布隆过滤器，以及其他布隆过滤器改进。仍有进一步改进的空间。

### 适应新技术

与 SSD 相关的新架构改进可能会轻易颠覆 RocksDB 的相关性。例如，开放通道 SSD [50, 66]、多流 SSD [68] 和 ZNS [4] 有望改善查询延迟并节省闪存擦除周期。然而，这些新技术只会使使用 RocksDB 的少数应用受益，因为大多数应用受到空间约束，而非擦除周期或延迟约束。此外，让 RocksDB 直接适应这些技术将挑战统一的 RocksDB 体验。一个值得探索的可能路径是将这些技术的适应委托给底层文件系统，也许由 RocksDB 提供额外的提示。

存储内计算可能提供显著的收益，但尚不清楚有多少 RocksDB 应用能真正从中受益。我们怀疑 RocksDB 适应存储内计算将具有挑战性，可能需要对整个软件栈的 API 进行更改才能充分利用。我们期待未来关于如何最好地实现这一点的研究。

**分离式（远程）存储**似乎是一个更有趣的优化目标，也是当前的优先事项。到目前为止，我们的优化假设闪存是本地连接的，因为我们的系统基础设施主要以此方式配置。然而，更快的网络现在允许更多的 I/O 远程服务，因此使用远程存储运行 RocksDB 的性能对越来越多的应用变得可行。使用远程存储，更容易同时充分利用 CPU 和 SSD 资源，因为它们可以按需单独配置（这在本地连接 SSD 的情况下要困难得多）。因此，为远程闪存存储优化 RocksDB 已成为优先事项。我们目前正通过尝试整合和并行化 I/O 来应对长 I/O 延迟的挑战。我们已经使 RocksDB 能够处理瞬态故障、向底层系统传递 QoS 要求，并报告性能分析信息。然而，还有更多工作要做。

**存储级内存（SCM）** 是一项有前景的技术。我们正在研究如何最好地利用它。有几种可能性值得考虑：1. 将 SCM 用作 DRAM 的扩展——这引出了如何用混合 DRAM 和 SCM 实现关键数据结构（如块缓存或 MemTable）的问题，以及在尝试利用其提供的持久性时会引入什么开销；2. 将 SCM 用作数据库的主存储，但我们注意到 RocksDB 往往受空间或 CPU 瓶颈限制，而非 I/O；3. 将 SCM 用于 WAL，但这引出了仅凭这一使用场景是否足以证明 SCM 成本合理性的问题，考虑到我们只需要一个小的暂存区，之后数据就会被移到 SSD。

### 主要数据结构再审视

我们不断重新审视 LSM 树是否仍然合适的问题，但始终得出肯定的结论。SSD 的价格尚未下降到足以改变大多数使用场景的空间和闪存耐久性瓶颈，而用 CPU 或 DRAM 来替代 SSD 使用的方案只对少数应用有意义。虽然主要结论保持不变，但我们经常听到用户对低于 RocksDB 所能提供的写放大的需求。尽管如此，我们注意到当对象较大时，可以通过分离键和值来降低写放大（例如 WiscKey [35] 和 ForrestDB [1]），因此我们正在将此功能添加到 RocksDB 中（称为 BlobDB）。

---

## 4 服务大规模系统的经验教训

RocksDB 是各种具有不同需求的大规模分布式系统的构建模块。随着时间推移，我们了解到需要在资源管理、WAL 处理、批量文件删除、数据格式兼容性和配置管理方面进行改进。

### 资源管理

大规模分布式数据服务通常将数据分片（shard），分布到多台服务器节点上进行存储。分片的大小是有限制的，因为分片是负载均衡和复制的单位，并且分片在节点之间以原子方式复制。因此，每台服务器节点通常承载数十或数百个分片。在我们的场景中，每个分片由一个独立的 RocksDB 实例服务，这意味着一台存储主机上将运行许多 RocksDB 实例。这些实例可以全部运行在一个地址空间中，也可以各自运行在自己的地址空间中。

一台主机可能运行多个 RocksDB 实例这一事实对资源管理有影响。鉴于实例共享主机资源，资源需要在全局（每台主机）和局部（每个实例）两个层面进行管理，以确保公平和高效地使用。在单进程模式下运行时，全局资源限制很重要，包括 (1) 写缓冲区和块缓存的内存，(2) 合并压缩 I/O 带宽，(3) 合并压缩线程，(4) 总磁盘使用量，以及 (5) 文件删除速率（如下所述），并且这些限制可能需要按每个 I/O 设备设置。局部资源限制也是需要的，例如确保单个实例不能过度使用任何资源。RocksDB 允许应用为每种类型的资源创建一个或多个资源控制器（实现为传递给不同 DB 对象的 C++ 对象），并且也可以在每个实例的基础上进行设置。最后，支持 RocksDB 实例之间的优先级排序很重要，以确保资源优先分配给最需要的实例。

在一个进程中运行多个实例时学到的另一个教训：大量生成非池化线程可能会带来问题，特别是如果线程是长期存活的。过多的线程会增加 CPU 争用的概率，导致过度的上下文切换开销，使调试变得极其困难，并造成 I/O 尖峰。如果 RocksDB 实例需要使用可能进入睡眠或等待条件的线程来执行某些工作，那么最好使用大小和资源使用可以轻松限制的线程池。

当 RocksDB 实例运行在独立进程中时，全局（每台主机）资源管理更具挑战性，因为每个分片只有局部信息。可以应用两种策略。第一种，每个实例被配置为保守地使用资源，而非贪婪地。以合并压缩为例，每个实例可以启动比"正常"更少的合并压缩，只在合并压缩落后时才增加。这种策略的缺点是全局资源可能未被充分利用，导致资源使用次优。第二种在操作上更具挑战性的策略是让实例之间共享资源使用信息，并相应地调整，以尝试更全局地优化资源使用。在 RocksDB 中改进主机级资源管理还需要更多工作。

### WAL 处理

传统数据库倾向于在每次写操作时强制写入预写日志（WAL）以确保持久性。相比之下，大规模分布式存储系统通常为了性能和可用性而复制数据，并以各种一致性保证来做到这一点。例如，如果同一数据的副本存在于多个副本中，且一个副本变得损坏或不可访问，则存储系统使用来自其他未受影响主机的有效副本来重建故障主机的副本。对于这样的系统，RocksDB 的 WAL 写入就不那么关键了。此外，分布式系统通常有自己的复制日志（例如 Paxos 日志），在这种情况下 RocksDB 的 WAL 完全不需要。

我们了解到，提供调整 WAL 同步行为的选项以满足不同应用的需求是有帮助的。具体来说，我们引入了差异化的 WAL 操作模式：(i) 同步 WAL 写入，(ii) 缓冲 WAL 写入，以及 (iii) 完全不写 WAL。对于缓冲 WAL 处理，WAL 在后台以低优先级定期写入磁盘，以免影响到 RocksDB 的流量延迟。

### 限速文件删除

RocksDB 通常通过文件系统与底层存储设备交互。这些文件系统是闪存 SSD 感知的；例如，带有实时丢弃（realtime discard）的 XFS 可能在文件被删除时向 SSD 发出 TRIM 命令 [28]。TRIM 命令通常被认为能改善性能和闪存耐久性 [21]，我们的生产经验也验证了这一点。然而，它也可能导致性能问题。TRIM 比我们最初认为的更具破坏性：除了更新地址映射（通常在 SSD 的内部存储器中），SSD 固件还需要将这些更改写入 FTL¹ 的闪存日志中，这反过来可能触发 SSD 的内部垃圾回收，导致大量数据移动，并对前台 I/O 延迟产生负面影响。为避免 TRIM 活动尖峰及相关的 I/O 延迟增加，我们引入了文件删除的速率限制，以防止多个文件被同时删除（这在合并压缩后会发生）。

> ¹ FTL：闪存转换层（Flash Translation Layer）。

### 数据格式兼容性

大规模分布式应用在许多主机上运行其服务，并且期望零停机时间。因此，软件更新在主机之间增量式推出；当出现问题时，更新会被回滚。鉴于持续部署 [56]，这些软件更新频繁发生；RocksDB 每月发布一个新版本。因此，磁盘上的数据在不同软件版本之间保持向后和向前兼容非常重要。新升级（或回滚）的 RocksDB 实例必须能够理解前一个实例存储在磁盘上的数据。此外，RocksDB 数据文件可能需要在分布式实例之间复制以进行副本构建或负载均衡，而这些实例可能运行不同版本。缺乏向前兼容性保证在某些 RocksDB 部署中造成了操作困难，这促使我们添加了该保证。

RocksDB 不遗余力地确保数据保持向前和向后兼容（新功能除外）。这在技术和流程上都具有挑战性，但我们发现这些努力是值得的。对于向后兼容性，RocksDB 必须能够理解之前写入磁盘的所有格式；这增加了软件和维护的复杂性。对于向前兼容性，需要理解未来的数据格式，我们的目标是至少维持一年的向前兼容性。这部分可以通过使用通用技术来实现，如 Protocol Buffer [63] 或 Thrift [62] 所使用的技术。对于配置文件条目，RocksDB 需要能够识别新字段，并尽最大努力猜测如何应用配置或何时丢弃。我们持续使用不同版本的 RocksDB 数据测试不同版本的 RocksDB。

### 配置管理

RocksDB 具有高度可配置性，以便应用可以针对其工作负载进行优化。然而，我们发现配置管理是一个挑战。最初，RocksDB 继承了 LevelDB 的参数配置方法，其中参数选项直接嵌入在代码中。这导致了两个问题。首先，参数选项通常与存储在磁盘上的数据绑定，当使用一个选项创建的数据文件无法被新配置了另一个选项的 RocksDB 实例打开时，会造成潜在的兼容性问题。其次，代码中未明确指定的配置选项会自动设置为 RocksDB 的默认值。当 RocksDB 软件更新包含默认配置参数的更改（例如，增加内存使用或合并压缩并行度）时，应用有时会经历意想不到的后果。

为解决这些问题，RocksDB 首先引入了让 RocksDB 实例使用包含配置选项的字符串参数打开数据库的能力。后来 RocksDB 引入了可选地将选项文件与数据库一起存储的支持。我们还引入了两个工具：(i) 一个验证工具，用于验证打开数据库的选项是否与目标数据库兼容；(ii) 一个迁移工具，将数据库重写为与所需选项兼容（尽管此工具功能有限）。

RocksDB 配置管理中一个更严重的问题是大量的配置选项。在 RocksDB 的早期，我们做出了支持高度定制的设计选择：我们引入了许多新的调节旋钮，并引入了可插拔组件的支持，所有这些都是为了让应用实现其性能潜力。这被证明是早期获得关注的成功策略。然而，现在的一个常见抱怨是有太多的选项，理解它们的效果太困难了；即，指定"最优"配置变得非常困难。

比拥有大量配置参数需要调优更令人畏惧的是，最优配置不仅取决于嵌入了 RocksDB 的系统，还取决于上层应用产生的工作负载。例如，考虑 ZippyDB [65]，这是一个内部开发的大规模分布式键值存储，在其节点上使用 RocksDB。ZippyDB 服务于众多不同的应用，有时单独服务，有时在多租户设置中服务。尽管在可能的情况下，在所有 ZippyDB 使用场景中使用统一配置付出了巨大努力，但不同使用场景的工作负载差异如此之大，当性能重要时，统一配置在实际中不可行。表 5 显示，在我们采样的 39 个 ZippyDB 部署中，有超过 25 种不同的配置。

**表 5：39 个 ZippyDB 部署中使用的不同配置数量**

| 配置领域 | 合并压缩 I/O | 压缩 | SSTable 文件 | 可插拔功能 |
| -------- | ------------ | ---- | ------------ | ---------- | --- |
| 配置数量 | 14           | 4    | 2            | 7          | 6   |

对于将嵌入了 RocksDB 的系统交付给第三方的场景，调优配置参数也特别具有挑战性。考虑一个第三方在其应用中使用 MySQL 或 ZippyDB 等数据库的情况。第三方通常对 RocksDB 以及如何最好地调优它知之甚少。而数据库所有者也没有太大意愿为其客户调优系统。

这些真实世界的经验教训触发了我们配置支持策略的变化。我们在改善开箱即用性能和简化配置方面投入了大量精力。我们当前的重点是提供自动适应性，同时继续支持广泛的显式配置，因为 RocksDB 继续服务于专业化应用。我们注意到，在保持显式可配置性的同时追求适应性会带来显著的代码维护开销，但我们认为拥有统一存储引擎的好处超过了代码复杂性。

### 复制和备份支持

RocksDB 是一个单节点库。使用 RocksDB 的应用负责复制和备份（如果需要的话）。每个应用以自己的方式实现这些功能（有合理的理由），因此 RocksDB 提供适当的支持来帮助这些功能非常重要。

通过从现有副本复制所有数据来引导新副本可以通过两种方式完成。第一种，可以从源副本读取所有键，然后写入目标副本（逻辑复制）。在源端，RocksDB 通过提供最小化对并发在线查询影响的能力来支持数据扫描操作；例如，提供不缓存这些操作结果的选项，从而防止缓存污染。在目标端，支持批量加载并针对此场景进行了优化。

第二种，引导新副本可以通过直接复制 SSTable 和其他文件来完成（物理复制）。RocksDB 通过识别当前时间点的现有数据库文件并防止它们被删除或修改来辅助物理复制。支持物理复制是 RocksDB 将数据存储在底层文件系统上的重要原因，因为它允许每个应用使用自己的工具。我们认为 RocksDB 直接使用块设备接口或与 FTL 深度集成的潜在性能收益不超过上述好处。

备份是大多数数据库和其他应用的重要功能。对于备份，应用与复制一样有逻辑与物理的选择。备份和复制之间的一个区别是应用通常需要管理多个备份。虽然大多数应用实现自己的备份（以适应自己的需求），但 RocksDB 为备份需求简单的应用提供了一个备份引擎供其使用。

我们看到了该领域两个需要进一步改进的方面，但两者都需要对键值 API 进行更改；它们在 §6 中讨论。第一个涉及在不同副本上以一致的顺序应用更新，这引入了性能挑战。第二个涉及一次发出一个写入请求的性能问题，以及副本可能落后且应用可能希望这些副本更快追赶的事实。不同的应用已经实现了各种解决方案来解决这些问题，但它们都有局限性 [20]。挑战在于应用不能乱序发出写入，也不能使用自己的序列号进行快照读取，因为 RocksDB 目前不支持使用用户自定义时间戳的多版本控制。

---

## 5 故障处理的经验教训

通过生产经验，我们学到了关于故障处理的三个主要教训。第一，数据损坏需要尽早检测，以最小化数据不可用或丢失的风险，并在此过程中精确定位错误的来源。第二，完整性保护必须覆盖整个系统，以防止静默损坏暴露给 RocksDB 客户端或传播到其他副本（见图 4）。第三，错误需要以差异化的方式处理。

### 静默损坏的频率

RocksDB 用户通常出于性能原因不使用 SSD 的数据保护（例如 DIF/DIX），存储介质损坏通过 RocksDB 块校验和检测，这是所有成熟数据库的常规功能，因此我们在此跳过分析。CPU/内存损坏确实很少发生，且难以准确量化。使用 RocksDB 的应用通常运行数据一致性检查来比较副本的完整性。这能捕获错误，但这些错误可能是由 RocksDB 或客户端应用引入的（例如，在复制、备份或恢复数据时）。

我们发现，在 RocksDB 层面引入的损坏频率可以通过比较同时具有主索引和辅助索引的 MyRocks 数据库表来估算；任何不一致都应该是在 RocksDB 层面引入的，包括 CPU 或内存损坏。根据我们的测量，在 RocksDB 层面引入的损坏大约每 100PB 数据每三个月发生一次。更糟的是，在 40% 的情况下，损坏已经传播到了其他副本。

数据损坏也发生在数据传输过程中，通常是由于软件错误。例如，底层存储系统在处理网络故障时的一个错误，导致我们在一段时间内，每传输一 PB 物理数据大约看到 17 次校验和不匹配。

### 多层保护

数据损坏需要尽早检测，以最小化停机时间和数据丢失。大多数 RocksDB 应用的数据在多台主机上有副本；当检测到校验和不匹配时，损坏的副本被丢弃并用正确的副本替换。然而，只有在正确副本仍然存在时，这才是一个可行的选择。

如今，RocksDB 在多个层面对文件数据进行校验和验证，以识别其下方各层的损坏。这些以及计划中的应用层校验和如图 4 所示。多层校验和很重要，主要是因为它们有助于尽早检测损坏，并且它们防护不同类型的威胁。块校验和继承自 LevelDB，防止在文件系统层或以下被损坏的数据暴露给客户端。文件校验和于 2020 年添加，防止由底层存储系统引起的损坏传播到其他副本，以及在通过网络传输 SSTable 文件时引起的损坏。对于 WAL 文件，交接校验和（handoff checksums）支持在写入时高效地尽早检测损坏。

**块完整性。** 每个 SSTable 块或 WAL 片段都附有一个校验和，在数据创建时生成。与仅在文件移动时验证的文件校验和不同，此校验和在每次读取数据时都会被验证，因为其范围更小。这样做可以防止被存储层损坏的数据暴露给 RocksDB 客户端。

**文件完整性。** 文件内容在传输操作中特别容易被损坏；例如，在备份或分发 SSTable 文件时。为解决此问题，SSTable 由其自己的校验和保护，在表创建时生成。SSTable 的校验和记录在元数据的 SSTable 文件条目中，并在 SSTable 文件被传输到任何地方时进行验证。然而，我们注意到其他文件（如 WAL 文件）仍未以这种方式保护。

**交接完整性。** 一种尽早检测写入损坏的成熟技术是对要写入底层文件系统的数据生成交接校验和，并将其与数据一起传递下去，由下层进行验证 [48, 70]。我们希望使用这样的写入 API 来保护 WAL 写入，因为与 SSTable 不同，WAL 受益于每次追加时的增量验证。不幸的是，本地文件系统很少支持这一点——一些专用栈，如 Oracle ASM [49]，确实支持。

另一方面，当运行在远程存储上时，写入 API 可以更改为接受校验和，挂接到存储服务的内部 ECC。RocksDB 可以使用现有 WAL 片段校验和上的校验和组合技术来高效计算写入交接校验和。由于我们的存储服务执行写入时验证，我们预期损坏检测延迟到读取时的情况将极为罕见。

### 端到端保护

虽然上述保护层在许多情况下防止了客户端被暴露于损坏数据，但它们并不全面。上述保护的一个缺陷是数据在文件 I/O 层之上未受保护；例如，MemTable 和块缓存中的数据。在此层面损坏的数据将无法检测，因此最终会暴露给用户。此外，刷新或合并压缩操作可以持久化损坏的数据，使损坏变成永久性的。

**键值完整性。** 为解决此问题，我们正在实现逐键值校验和，以检测在文件 I/O 层之上发生的损坏。此校验和将随键/值一起传输到任何被复制的地方，尽管在已有替代完整性保护的文件数据中我们会省略它。

### 基于严重性的错误处理

RocksDB 遇到的大多数故障是底层存储系统返回的错误。这些错误可能源于多种问题，从严重问题（如只读文件系统）到瞬态问题（如磁盘满或访问远程存储时的网络错误）。早期，RocksDB 对此类问题的反应要么是简单地向客户端返回错误消息，要么是永久停止所有写操作。

如今，我们的目标是仅在错误不可本地恢复时才中断 RocksDB 操作；例如，瞬态网络错误不应需要用户干预来重启 RocksDB 实例。为实现这一点，我们改进了 RocksDB，使其在遇到被分类为瞬态的错误后定期重试恢复操作。因此，我们获得了操作上的好处，因为客户端不需要为相当一部分发生的故障手动干预 RocksDB。

---

## 6 键值接口的经验教训

核心键值（KV）接口出人意料地多才多艺。几乎所有存储工作负载都可以由具有 KV API 的数据存储来服务；我们很少见到无法使用此接口实现功能的应用。这也许就是 KV 存储如此流行的原因。KV 接口是通用的。键和值都是变长字节数组。应用在决定将什么信息打包到每个键和值中具有极大的灵活性，并且可以自由选择丰富的编码方案。因此，是应用负责解析和解释键和值。KV 接口的另一个好处是其可移植性。从一个键值系统迁移到另一个相对容易。然而，虽然许多使用场景通过此简单接口实现了最优性能，但我们注意到它可能限制某些应用的性能。

例如，在 RocksDB 之外构建并发控制是可能的，但难以使其高效，特别是如果需要支持两阶段提交，其中在提交事务之前需要某些数据持久性。我们为此添加了事务支持，被 MyRocks（MySQL+RocksDB）使用。我们继续添加功能；例如，间隙/下一键锁定和大事务支持。

在其他情况下，限制是由键值接口本身造成的。因此，我们已经开始研究对基本键值接口的可能扩展。其中一个扩展是对用户自定义时间戳的支持。

### 版本和时间戳

在过去几年中，我们逐渐理解了数据版本控制的重要性。我们得出结论，版本信息应成为 RocksDB 中的一等公民，以正确支持多版本并发控制（MVCC）和时间点读取等功能。为实现这一点，RocksDB 需要能够高效地访问不同版本。

到目前为止，RocksDB 内部使用 56 位序列号来标识 KV 对的不同版本。序列号由 RocksDB 生成，并在每次客户端写入时递增（因此，所有数据在逻辑上按排序顺序排列）。客户端应用无法影响序列号。然而，RocksDB 允许应用获取数据库的快照（Snapshot），之后 RocksDB 保证在快照时存在的所有 KV 对将持续存在，直到应用显式释放快照。因此，具有相同键的多个 KV 对可以共存，通过它们的序列号来区分。

这种版本控制方法是不够的，因为它不满足许多应用的需求。要从过去的状态读取，必须在之前的时间点已经获取了快照。RocksDB 不支持获取过去的快照，因为没有 API 来指定时间点。此外，支持时间点读取效率低下。最后，每个 RocksDB 实例分配自己的序列号，快照只能在每个实例的基础上获取。这使具有多个（可能已复制的）分片的应用的版本控制变得复杂，每个分片都是一个 RocksDB 实例。总之，创建提供跨分片一致性读取的数据版本基本上是不可能的。

应用可以通过在键或值中编码时间戳来绕过这些限制。然而，无论哪种情况都会经历性能下降。在键中编码会牺牲点查找的性能，而在值中编码会牺牲对同一键乱序写入的性能，并使读取旧版本的键变得复杂。我们认为应用指定的时间戳将更好地解决这些限制，其中应用可以用全局可理解的时间戳标记其数据，并且在键或值之外这样做。

我们已添加了对应用指定时间戳的基本支持，并使用 DB-Bench 评估了这种方法。结果如表 6 所示。每个工作负载有两个步骤：第一步填充数据库，我们测量第二步期间的性能。例如，在"fill_seq + read_random"中，我们通过按升序写入大量键来填充初始数据库，在第二步中执行随机读取操作。相对于基线（应用将时间戳编码为键的一部分，对 RocksDB 透明），应用指定的时间戳 API 可以带来 1.2 倍或更好的吞吐量提升。改进来自于将时间戳作为独立于用户键的元数据处理，因为这样可以使用点查找而非迭代器来获取键的最新值，布隆过滤器可以识别不包含该键的 SSTable。此外，SSTable 覆盖的时间戳范围可以存储在其属性中，可用于排除只可能包含过时值的 SSTable。

**表 6：使用时间戳 API 的 DB_bench 微基准测试看到 ≥1.2 倍的吞吐量提升。**

| 工作负载                         | 吞吐量提升 |
| -------------------------------- | ---------- |
| fill_seq + read_random           | 1.2        |
| fill_seq + read_while_writing    | 1.9        |
| fill_random + read_random        | 1.9        |
| fill_random + read_while_writing | 2.0        |

我们希望这一功能将使用户更容易在其系统中实现多版本控制，用于单节点 MVCC、分布式事务或多主复制中的冲突解决。然而，更复杂的 API 使用起来不那么直观，可能容易被误用。此外，数据库将比不存储时间戳消耗更多磁盘空间，并且对其他系统的可移植性也会降低。

---

## 7 相关工作

我们在 RocksDB 上的工作受益于多个领域的广泛研究。

### 存储引擎库

许多存储引擎已被构建为嵌入到应用中的库。RocksDB 的 KV 接口比例如 BerkeleyDB [44]、SQLite [47] 和 Hekaton [18] 更原始。此外，RocksDB 与这些系统的不同之处在于专注于现代服务器工作负载的性能，这些工作负载需要高吞吐量和低延迟，通常运行在高端 SSD 和多核 CPU 上。这不同于具有更通用目标的系统，或为更快存储介质构建的系统 [18, 30]。

### 面向 SSD 的键值存储

多年来，大量工作致力于优化键值存储，特别是针对 SSD。早在 2011 年，SILT [34] 就提出了一个在内存效率、CPU 和性能之间取得平衡的键值存储。ForestDB [45] 使用 HB+ 树在日志之上进行索引。TokuDB [32] 和其他数据库使用分形树/Bε 树。LOCS [67]、NoFTL-KV [66] 和 FlashKV [69] 针对开放通道 SSD 以提升性能。虽然 RocksDB 受益于这些努力，但我们改善性能的定位和策略是不同的，我们继续依赖 LSM 树。一些研究比较了 RocksDB 与其他数据库（如 InnoDB [41]、TokuDB [19][37] 和 WiredTiger [10]）的性能。

### LSM 树改进

许多系统也使用 LSM 树并改进了其性能。写放大通常是主要优化目标；例如 WiscKey [35]、PebblesDB [52]、IAM-tree [25] 和 TRIAD [3]。这些系统在优化写放大方面比 RocksDB 走得更远，而 RocksDB 更关注不同指标之间的权衡。SlimDB [53] 针对空间效率优化了 LSM 树；RocksDB 也专注于删除无效数据。Monkey [17] 试图在 DRAM 和 IOPS 之间取得平衡。bLSM [57]、VT-tree [60] 和 cLSM [24] 优化 LSM 树的整体性能。

### 大规模存储系统

存在众多分布式存储系统 [13, 14, 16, 26, 38, 64]。它们通常具有跨多个进程、主机和数据中心的复杂架构。它们不能直接与 RocksDB 比较，RocksDB 是单节点上的存储引擎库。其他系统（例如 MongoDB、MySQL [42]、Microsoft SQL Server [38]）可以使用模块化存储引擎；它们解决了与 RocksDB 面临的类似挑战，包括故障处理和时间戳使用。

**故障处理。** 校验和经常被用于检测数据损坏 [9, 23, 42]。我们关于需要端到端和交接校验和的论点仍然呼应了经典的端到端论证 [55]，类似于其他人使用的策略：[61]、ZFS [71]、Linux [48] 和 [70]。我们关于更早检测损坏的论点类似于 [33]，该文献认为领域特定的检查是不够的。

**时间戳支持。** 一些存储系统提供时间戳支持：HBase [26]、WiredTiger [39] 和 BigTable [14]；Cassandra [13] 支持时间戳作为普通列。在这些系统中，时间戳是自 UNIX 纪元以来的毫秒数。Hekaton [18] 使用单调递增的计数器来分配时间戳，类似于 RocksDB 的序列号。RocksDB 正在进行的用户时间戳工作可以与上述努力互补。我们希望带有用户自定义时间戳扩展的键值 API 能够使上层系统更容易以低性能和效率开销支持数据版本控制相关功能。

---

## 8 未来工作与开放问题

除了完成上述改进（包括为分离式存储优化、键值分离、多层校验和和应用指定时间戳）之外，我们计划统一分层和分级合并压缩并改善适应性。然而，一些开放问题可以从进一步研究中受益。

1. 如何使用 SSD/HDD 混合存储来提高效率？
2. 当存在大量连续删除标记时，如何减轻对读取器的性能影响？
3. 如何改进我们的写限流算法？
4. 能否开发一种高效的方式来比较两个副本以确保它们包含相同的数据？
5. 如何最好地利用 SCM？是否仍应使用 LSM 树，以及如何组织存储层次？
6. 能否有一个通用的完整性 API 来处理 RocksDB 和文件系统层之间的数据交接？

---

## 9 结论

RocksDB 已从一个服务小众应用的键值存储成长为当前在众多工业级大规模分布式应用中广泛采用的地位。LSM 树作为主要数据结构为 RocksDB 提供了良好的服务，因为它展现出良好的写放大和空间放大特性。然而，我们对性能的看法已随时间演变。虽然写放大和空间放大仍然是主要关注点，但额外的关注已转向 CPU 和 DRAM 效率，以及远程存储。

从运行大规模应用中汲取的经验教训告诉我们：资源分配需要在不同的 RocksDB 实例之间进行管理；数据格式需要保持向后和向前兼容以支持增量式软件部署；需要对数据库复制和备份提供适当的支持；配置管理需要简单明了且最好是自动化的。从故障处理中汲取的经验教训告诉我们：数据损坏错误需要在系统的每一层更早地被检测到。键值接口因其简单性而广受欢迎，但在性能方面存在一些限制。对接口的简单修订可能会带来更好的平衡。

### 致谢

我们将 RocksDB 的成功归功于 Facebook 所有现任和前任 RocksDB 团队成员、开源社区中所有做出贡献的人，以及 RocksDB 用户。我们特别感谢 Mark Callaghan，多年来该项目的导师，以及 Dhruba Borthakur，RocksDB 的首席创始成员。我们也感谢 Mark Callaghan 对论文的评论以及 Mahesh Balakrishnan。最后，我们感谢我们的 shepherd Ethan Miller 和匿名审稿人提出的宝贵意见。

---

## 附录 A：RocksDB 功能时间线

| 年份     | 性能                                                                       | 可配置性                                       | 功能                                                           |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **2012** | 多线程合并压缩                                                             |                                                | 合并压缩过滤器；锁定 SSTable 防止删除                          |
| **2013** | 分级合并压缩；前缀布隆过滤器；MemTable 布隆过滤器；MemTable 刷新独立线程池 | 可插拔 MemTable；可插拔文件格式                | 合并操作符（Merge Operator）                                   |
| **2014** | FIFO 合并压缩；合并压缩速率限制器；缓存友好的布隆过滤器                    | 基于字符串的配置选项；动态配置更改             | 备份引擎；支持多键空间（"列族"）；物理检查点                   |
| **2015** | 动态分层合并压缩；文件删除限速；Level 0 和 1 并行合并压缩                  | 独立配置文件；配置兼容性检查器                 | SSTable 文件集成的批量加载；乐观和悲观事务                     |
| **2016** | 最后一层不同压缩；并行 MemTable 插入                                       | 跨实例的 MemTable 总大小上限；合并压缩迁移工具 | DeleteRange()                                                  |
| **2017** | 底层合并压缩独立线程池；两级文件索引；Level 0 到 Level 0 合并压缩          | 块缓存和 MemTable 的单一内存限制               |                                                                |
| **2018** | 字典压缩；数据块的哈希索引                                                 |                                                | 空间不足错误的自动恢复；查询跟踪和重放工具                     |
| **2019** | 批量 MultiGet() 与并行 I/O                                                 | 使用对象注册表配置插件函数                     | 辅助实例（Secondary instance）                                 |
| **2020** | 多线程单文件压缩                                                           |                                                | 全文件校验和；从可重试错误自动恢复；用户自定义时间戳的部分支持 |

---

## 附录 B：经验教训回顾

我们学到的一些教训包括：

1. 存储引擎能够调优以适应不同的性能特征非常重要。（§1）
2. 空间效率是使用 SSD 的大多数应用的瓶颈。（§3，空间放大）
3. CPU 开销变得越来越重要，以使系统更高效地运行。（§3，CPU 利用率）
4. 当许多 RocksDB 实例运行在同一主机上时，全局的、每台主机的资源管理是必要的。（§4，资源管理）
5. 使 WAL 处理可配置（同步 WAL 写入、缓冲 WAL 写入或禁用 WAL）为应用提供了性能优势。（§4，WAL 处理）
6. SSD TRIM 操作有利于性能，但文件删除需要限速以防止偶发的性能问题。（§4，限速文件删除）
7. RocksDB 需要同时提供向后和"向前"兼容性。（§4，数据格式兼容性）
8. 自动配置适应性有助于简化配置管理。（§4，配置管理）
9. 数据复制和备份需要得到适当支持。（§4，复制和备份支持）
10. 尽早检测数据损坏比最终检测到更有益。（§5）
11. CPU/内存损坏确实会发生，虽然非常罕见，有时无法通过数据复制来处理。（§5）
12. 完整性保护必须覆盖整个系统，以防止损坏的数据（例如由 CPU/内存中的位翻转引起的）暴露给客户端或其他副本；仅在数据静止或通过网络传输时检测损坏是不够的。（§5）
13. 用户经常要求 RocksDB 从瞬态 I/O 错误（如空间不足或由网络问题引起的错误）中自动恢复。（§5）
14. 错误处理需要根据其原因和后果以差异化方式处理。（§5）
15. 键/值接口用途广泛，但存在一些性能限制；为键/值添加时间戳可以在性能和简单性之间提供良好的平衡。（§6）

---

## 附录 C：设计选择再审视

一些值得注意的重新审视的设计选择包括：

1. 可定制性对用户总是好的。（§4，配置管理）
2. RocksDB 可以对 CPU 位翻转视而不见。（§5）
3. 遇到任何 I/O 错误时恐慌是可以的。（§5）

---

## 参考文献

[1] Jung-Sang Ahn, Chiyoung Seo, Ravi Mayuram, Rahim Yaseen, Jin-Soo Kim, and Seungryoul Maeng. ForestDB: A fast key-value storage system for variable-length string keys. _IEEE Trans. on Computers_, 65(3):902–915, 2015.

[2] Manos Athanassoulis, Michael S Kester, Lukas M Maas, Radu Stoica, Stratos Idreos, Anastasia Ailamaki, and Mark Callaghan. Designing access methods: The RUM conjecture. In _Proc. Intl. Conf on Extending Database Technology (EDBT)_, volume 2016, pages 461–466, 2016.

[3] Oana Balmau, Diego Didona, Rachid Guerraoui, Willy Zwaenepoel, Huapeng Yuan, Aashray Arora, Karan Gupta, and Pavan Konka. TRIAD: Creating synergies between memory, disk and log in log-structured key-value stores. In _Proc. USENIX Annual Technical Conference (USENIX-ATC'17)_, pages 363–375, 2017.

[4] Matias Bjørling. Zone Append: A new way of writing to zoned storage. In _Proc. Usenix Linux Storage and Filesystems Conference (VAULT'20)_, 2020.

[5] Facebook Engineering Blog. LogDevice: A distributed data store for logs. https://engineering.fb.com/core-data/logdevice-a-distributed-data-store-for-logs/. [Online; retrieved September 2020].

[6] Instagram Engineering Blog. Open-sourcing a 10x reduction in Apache Cassandra tail latency. https://instagram-engineering.com/open-sourcing-a-10x-reduction-in-apache-cassandra-tail-latency-d64f86b43589. [Online; retrieved September 2020].

[7] Netflix Technology Blog. Application data caching using SSDs: The Moneta project: Next generation EVCache for better cost optimization. https://netflixtechblog.com/application-data-caching-using-ssds-5bf25df851ef. [Online; retrieved September 2020].

[8] Uber Engineering Blog. Cherami: Uber Engineering's durable and scalable task queue in Go. https://eng.uber.com/cherami-message-queue-system/. [Online; retrieved September 2020].

[9] Dhruba Borthakur. HDFS architecture guide. _Hadoop Apache Project_, 53(1-13):2, 2008.

[10] Mark Callaghan. MongoRocks and WiredTiger versus LinkBench on a small server. http://smalldatum.blogspot.com/2016/10/mongorocks-and-wiredtiger-versus.html. [Online; retrieved Jan 2021].

[11] Zhichao Cao, Siying Dong, Sagar Vemuri, and David H.C. Du. Characterizing, modeling, and benchmarking RocksDB key-value workloads at Facebook. In _18th USENIX Conf. on File and Storage Technologies (FAST'20)_, pages 209–223, February 2020.

[12] Paris Carbone, Asterios Katsifodimos, Stephan Ewen, Volker Markl, Seif Haridi, and Kostas Tzoumas. Apache Flink: Stream and batch processing in a single engine. _Bulletin of the IEEE Computer Society Technical Committee on Data Engineering_, 38(4), 2015.

[13] Apache Cassandra. https://cassandra.apache.org/. [Online; retrieved September 2020].

[14] Fay Chang, Jeffrey Dean, Sanjay Ghemawat, Wilson C Hsieh, Deborah A Wallach, Mike Burrows, Tushar Chandra, Andrew Fikes, and Robert E Gruber. Bigtable: A distributed storage system for structured data. _ACM Trans. on Computer Systems (TOCS)_, 26(2):1–26, 2008.

[15] Guoqiang Jerry Chen, Janet L Wiener, Shridhar Iyer, Anshul Jaiswal, Ran Lei, Nikhil Simha, Wei Wang, Kevin Wilfong, Tim Williamson, and Serhat Yilmaz. Realtime data processing at Facebook. In _Proc. Intl. Conf. on Management of Data_, pages 1087–1098, 2016.

[16] James F Corbett, Jeffrey Dean, Michael Epstein, Andrew Fikes, Christopher Frost, Jeffrey John Furman, Sanjay Ghemawat, Andrey Gubarev, Christopher Heiser, Peter Hochschild, et al. Spanner: Google's globally distributed database. _ACM Trans. on Computer Systems (TOCS)_, 31(3):1–22, 2013.

[17] Niv Dayan, Manos Athanassoulis, and Stratos Idreos. Monkey: Optimal navigable key-value store. In _Proc. Intl. Conf. on Management of Data (SIGMOD'17)_, pages 79–94, 2017.

[18] Cristian Diaconu, Craig Freedman, Erik Ismert, Per-Ake Larson, Pravin Mittal, Ryan Stonecipher, Nitin Verma, and Mike Zwilling. Hekaton: SQL server's memory-optimized OLTP engine. In _Proc. ACM SIGMOD Intl. Conf. on Management of Data (SIGMOD'13)_, pages 1243–1254, 2013.

[19] Siying Dong, Mark Callaghan, Leonidas Galanis, Dhruba Borthakur, Tony Savor, and Michael Stumm. Optimizing space amplification in RocksDB. In _Proc. Conf. on Innovative Data Systems Research (CIDR'17)_, 2017.

[20] Jose Faleiro. The dangers of logical replication and a practical solution. In _Proc. 18th Intl. Workshop on High Performance Transaction Systems (HPTS'19)_, 2019.

[21] Tasha Frankie, Gordon Hughes, and Ken Kreutz-Delgado. A mathematical model of the trim command in NAND-flash SSDs. In _Proc. 50th Annual Southeast Regional Conf. (ACM-SE'12)_, pages 1–6, 2012.

[22] S. Ghemawat and J. Dean. LevelDB. https://github.com/google/leveldb, 2011.

[23] Sanjay Ghemawat, Howard Gobioff, and Shun-Tak Leung. The Google File System. In _Proc. 19th ACM Symp. on Operating Systems Principles (SOSP'13)_, pages 29–43, 2003.

[24] Guy Golan-Gueta, Edward Bortnikov, Eshcar Hillel, and Idit Keidar. Scaling concurrent log-structured data stores. In _Proc. European Conf. on Computer Systems (EUROSYS'15)_, pages 1–15, 2015.

[25] Caixin Gong, Shuibing He, Yili Gong, and Yingchun Lei. On integration of appends and merges in log-structured merge trees. In _Proc. 48th Intl. Conf. on Parallel Processing (ICPP'19)_, pages 1–10, 2019.

[26] Apache HBase. https://hbase.apache.org/. [Online; retrieved September 2020].

[27] Dongxu Huang, Qi Liu, Qiu Cui, Zhuhe Fang, Xiaoyu Ma, Fei Xu, Li Shen, Liu Tang, Yuxing Zhou, Menglong Huang, Wan Wei, Cong Liu, Jian Zhang, Jianjun Li, Xuelian Wu, Lingyu Song, Ruoxi Sun, Shuaipeng Yu, Lei Zhao, Nicholas Cameron, Liquan Pei, and Xin Tang. TiDB: A Raft-based HTAP database. _Proc. VLDB Endow._, 13(12):3072–3084, August 2020.

[28] Intel. Trim overview. https://www.intel.com/content/www/us/en/support/articles/000016148/memory-and-storage.html. [Online; retrieved January 2021].

[29] Iron.io. Confluent https://www.iron.io. [Online; retrieved September 2020].

[30] Hideaki Kimura. FOEDUS: OLTP engine for a thousand cores and NVRAM. In _Proc. SIGMOD Intl. Conf. on Management of Data (SIGMOD'15)_, pages 691–706, 2015.

[31] Jay Kreps. Introducing Kafka Streams: Stream processing made simple. Confluent https://www.confluent.io/blog/introducing-kafka-streams-stream-processing-made-simple/. [Online; retrieved September 2020].

[32] B Kuszmaul. How TokuDB fractal tree indexes work. Technical report, TokuTek, 2010.

[33] Chuck Lever. End-to-end data integrity requirements for NFS. Oracle Corp. https://datatracker.ietf.org/meeting/83/materials/slides-slides-83-nfsv4-2/. [Online; retrieved September 2020].

[34] Hyeontaek Lim, Bin Fan, David G Andersen, and Michael Kaminsky. SILT: A memory-efficient, high-performance key-value store. In _Proc. 23rd ACM Symp. on Operating Systems Principles (SOSP'11)_, pages 1–13, 2011.

[35] Lanyue Lu, Thanumalayan Sankaranarayana Pillai, Hariharan Gopalakrishnan, Andrea C Arpaci-Dusseau, and Remzi H Arpaci-Dusseau. WiscKey: Separating keys from values in SSD-conscious storage. _ACM Trans. on Storage (TOS)_, 13(1):1–28, 2017.

[36] Yoshinori Matsunobu. Migrating a database from InnoDB to MyRocks. Facebook Engineering Blog https://engineering.fb.com/core-data/migrating-a-database-from-innodb-to-myrocks/, 2017. [Online; retrieved September 2020].

[37] Yoshinori Matsunobu, Siying Dong, and Herman Lee. MyRocks: LSM-tree database storage engine serving Facebook's Social Graph. _Proc. VLDB Endowment_, 13(12):3217–3230, August 2020.

[38] Microsoft. Microsoft SQL Server. https://www.microsoft.com/en-us/sql-server/. [Online; retrieved September 2020].

[39] MongoDB. WiredTiger Storage Engine. https://docs.mongodb.com/manual/core/wiredtiger/. [Online; retrieved September 2020].

[40] MongoRocks. RocksDB storage engine module for MongoDB. https://github.com/mongodb-partners/mongo-rocks. [Online; retrieved September 2020].

[41] MySQL. Introduction to InnoDB. https://dev.mysql.com/doc/refman/5.6/en/innodb-introduction.html. [Online; retrieved September 2020].

[42] MySQL. MySQL. https://www.mysql.com/. [Online; retrieved September 2020].

[43] Shadi A Noghabi, Kartik Paramasivam, Yi Pan, Navina Ramesh, Jon Bringhurst, Indranil Gupta, and Roy H Campbell. Samza: Stateful scalable stream processing at LinkedIn. _Proc. of the VLDB Endowment_, 10(12):1634–1645, 2017.

[44] Michael A Olson, Keith Bostic, and Margo I Seltzer. Berkeley DB. In _USENIX Annual Technical Conference, FREENIX Track_, pages 183–191, 1999.

[45] Patrick O'Neil, Edward Cheng, Dieter Gawlick, and Elizabeth O'Neil. The log-structured merge-tree (LSM-tree). _Acta Informatica_, 33(4):351–385, 1996.

[46] Keren Ouaknine, Oran Agra, and Zvika Guz. Optimization of RocksDB for Redis on flash. In _Proc. Intl. Conf. on Compute and Data Analysis_, pages 155–161, 2017.

[47] Mike Owens. _The definitive guide to SQLite_. Apress, 2006.

[48] Martin K Petersen. Linux data integrity extensions. In _Linux Symposium_, volume 4, page 5, 2008.

[49] Martin K. Petersen and Sergio Leunissen. Eliminating silent data corruption with Oracle Linux. Oracle Corp. https://oss.oracle.com/~mkp/docs/data-integrity-webcast.pdf. [Online; retrieved September 2020].

[50] Ivan Luiz Picoli, Niclas Hedam, Philippe Bonnet, and Pinar Tözün. Open-channel SSD (What is it good for). In _Proc. Conf. on Innovative Data Systems Research (CIDR'20)_, 2020.

[51] Qihoo. Confluent https://github.com/Qihoo360/pika. [Online; retrieved September 2020].

[52] Pandian Raju, Rohan Kadekodi, Vijay Chidambaram, and Ittai Abraham. PebblesDB: Building key-value stores using fragmented log-structured merge trees. In _Proc. 26th Symp. on Operating Systems Principles (SOSP'17)_, pages 497–514, 2017.

[53] Kai Ren, Qing Zheng, Joy Arulraj, and Garth Gibson. SlimDB: A space-efficient key-value storage engine for semi-sorted data. _Proc. of the VLDB Endowment_, 10(13):2037–2048, 2017.

[54] RocksDB.org. A persistent key-value store for fast storage environments. https://rocksdb.org. [Online; retrieved September 2020].

[55] Jerome H Saltzer, David P Reed, and David P Clark. End-to-end arguments in system design. _ACM Trans. on Computer Systems (TOCS)_, 2(4):277–288, 1984.

[56] Tony Savor, Mitchell Douglas, Michael Gentili, Laurie Williams, Kent Beck, and Michael Stumm. Continuous deployment at Facebook and OANDA. In _2016 IEEE/ACM 38th International Conference on Software Engineering Companion (ICSE-C)_, pages 21–30. IEEE, 2016.

[57] Russell Sears and Raghu Ramakrishnan. bLSM: a general purpose log-structured merge tree. In _Proc. Intl. Conf. on Management of Data (SIGMOD'12)_, pages 217–228, 2012.

[58] Arun Sharma. How we use RocksDB at Rockset. Rockset Blog https://rockset.com/blog/how-we-use-rocksdb-at-rockset/. [Online; retrieved September 2020].

[59] Arun Sharma. LogDevice: A distributed data store for logs. Facebook Engineering Blog https://engineering.fb.com/data-infrastructure/dragon-a-distributed-graph-query-engine/. [Online; retrieved September 2020].

[60] Pradeep J Shetty, Richard P Spillane, Ravikant R Malpani, Binesh Andrews, Justin Seyster, and Erez Zadok. Building workload-independent storage with VT-trees. In _Proc. 11th USENIX Conf. on File and Storage Technologies (FAST'13)_, pages 17–30, 2013.

[61] Gopalan Sivathanu, Charles P Wright, and Erez Zadok. Enhancing file system integrity through checksums. Technical report, Citeseer, 2004.

[62] Mark Slee, Aditya Agarwal, and Marc Kwiatkowski. Thrift: Scalable cross-language services implementation. Facebook White Paper, 5(8), 2007.

[63] Google Open Source. Protobuf. https://opensource.google/projects/protobuf. [Online; retrieved September 2020].

[64] Rebecca Taft, Irfan Sharif, Andrei Matei, Nathan VanBenschoten, Jordan Lewis, Tobias Grieger, Kai Niemi, Andy Woods, Anne Birzin, Raphael Poss, Paul Bardea, Amruta Ranade, Ben Darnell, Bram Gruneer, Justin Jaffray, Lucy Zhang, and Peter Mattis. CockroachDB: The resilient geo-distributed SQL database. In _Proc. ACM SIGMOD Intl. Conf. on Management of Data (SIGMOD'20)_, pages 1493–1509, 2020.

[65] Amy Tai, Andrew Kryczka, Shobhit O. Kanaujia, Kyle Jamieson, Michael J. Freedman, and Asaf Cidon. Who's afraid of uncorrectable bit errors? Online recovery of flash errors with distributed redundancy. In _2019 USENIX Annual Technical Conference (USENIX ATC'19)_, pages 977–992, Renton, WA, July 2019.

[66] Tobias Vinçon, Sergej Hardock, Christian Riegger, Julian Oppermann, Andreas Koch, and Ilia Petrov. NoFTL-KV: Tackling write-amplification on KV-stores with native storage management. In _Proc. 21st Intl. Conf. on Extending Database Technology (EDBT'18)_, pages 457–460, 2018.

[67] Peng Wang, Guangyu Sun, Song Jiang, Jian Ouyang, Shiding Lin, Chen Zhang, and Jason Cong. An efficient design and implementation of LSM-tree based key-value store on open-channel SSD. In _Proc. 9th European Conf. on Computer Systems (EUROSYS'14)_, pages 1–14, 2014.

[68] Fei Yang, K Dou, S Chen, JU Kang, and S Cho. Multi-streaming RocksDB. In _Proc. Non-Volatile Memories Workshop_, 2015.

[69] Jiacheng Zhang, Youyou Lu, Jiwu Shu, and Xiongjun Qin. FlashKV: Accelerating KV performance with open-channel SSDs. _ACM Trans on Embedded Computing Systems (TECS)_, 16(5s):1–19, 2017.

[70] Yupu Zhang, Daniel S Myers, Andrea C Arpaci-Dusseau, and Remzi H Arpaci-Dusseau. Zettabyte reliability with flexible end-to-end data integrity. In _Proc. 29th IEEE Symp. on Mass Storage Systems and Technologies (MSST'13)_, pages 1–14, 2013.

[71] Yupu Zhang, Abhishek Rajimwale, Andrea C Arpaci-Dusseau, and Remzi H Arpaci-Dusseau. End-to-end data integrity for file systems: A ZFS case study. In _Proc. 8th USENIX Conf. on File and Storage Technologies (FAST'10)_, pages 29–42, 2010.
