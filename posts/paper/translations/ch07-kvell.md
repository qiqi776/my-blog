---
title: Kvell：快速持久化键值存储系统的设计与实现
date: 2026-08-16
order: 7
---

# Kvell：快速持久化键值存储系统的设计与实现

Baptiste Lepers 悉尼大学

Oana Balmau 悉尼大学

Karan Gupta Nutanix

Willy Zwaenepoel 悉尼大学

## 摘要

现代块寻址NVMe SSD提供了更高的带宽，且随机访问与顺序访问性能相近。为早期存储设备设计的持久化键值存储（KV），无论是基于日志结构合并树（LSM）还是B树，都无法充分利用这些新设备的优势。为避免随机访问而设计的逻辑、为保持磁盘上数据有序而进行的昂贵操作，以及同步瓶颈，使得这些KV系统在NVMe SSD上受限于CPU性能。

我们提出了一种新的持久化KV设计。与早期设计不同，我们不再试图强制顺序访问，也不在磁盘上对数据进行排序。采用无共享架构以避免同步开销。结合设备访问的批量处理，这些设计决策使得读写性能接近设备带宽。最后，在内存中维护轻量级的局部排序即可提供足够的扫描性能。

我们将这一设计实现在Kvell中，这是第一个能够以最大带宽利用现代NVMe SSD的持久化KV系统。我们将Kvell与当前最先进的LSM和B树KV系统进行了对比，包括合成基准测试和生产环境负载。在读密集型工作负载下，Kvell的吞吐量至少是最接近竞品的2倍；在写密集型工作负载下达到5倍。对于主要包含扫描操作的工作负载，Kvell的性能与竞品相当或更优。Kvell的最大延迟比最佳竞品低一个数量级，即使在基于扫描的工作负载上也是如此。

**关键词** 键值存储，持久化，性能，SSD，NVMe，B+树，日志结构合并树（LSM）

## ACM引用格式：

Baptiste Lepers, Oana Balmau, Karan Gupta, and Willy Zwaenepoel. 2019. Kvell: the Design and Implementation of a Fast Persistent Key-Value Store. In _Proceedings of SOSP '19: ACM Symposium on Operating Systems Principles_ (SOSP '19). ACM, New York, NY, USA, 15 pages. https://doi.org/10.1145/3341301.3359628

## 1 引言

键值存储（KV）已成为为各类云应用提供存储服务的标准平台，包括缓存[44]、元数据管理[5]、消息队列[1]和在线购物[15]等。本文针对的是部署在提供持久化保证的块寻址存储设备上的KV系统（即数据和更新在故障情况下不会丢失），且工作集无法完全放入主存。

历史上，存储设备与CPU之间的速度差距如此之大，以至于投入CPU周期来优化存储访问是一种有益的权衡。因此，一些KV系统包含了复杂的索引结构，如B+树。日志结构合并（LSM）KV系统强制顺序写入，因为顺序写入比随机写入更高效。所有KV系统都包含某种形式的缓存。为了支持高效的范围扫描（检索给定键范围内的所有项），KV系统在内存和磁盘上都按排序顺序维护数据。尽管所有这些优化都需要消耗一定的CPU周期，但存储设备仍然是瓶颈，这些优化因缓解了该瓶颈而被证明是有益的。

当我们在块寻址NVMe SSD设备上测量最先进的KV系统性能时，发现CPU而非存储设备成为了瓶颈，这印证了早期的定性观察[40, 41]。NVMe SSD具有极高的带宽，且随机访问与顺序访问性能相当。因此，许多为传统存储设备开发的优化不再有用，反而适得其反，因为它们消耗的CPU周期加剧了CPU瓶颈。一个明显的例子是LSM KV系统强制顺序写入的尝试。在设备访问方面已无收益可言，而LSM KV系统所需的维护操作（主要是压缩）既加重了CPU负担，也

## 1. 无共享：所有数据结构按核分区，使得每个核几乎无需任何同步即可独立运行。

2. 磁盘上数据不排序。每个分区维护一个内存中的排序索引以支持高效扫描。
3. 不强制顺序访问，但批量执行I/O操作以减少昂贵的系统调用次数。批处理还提供了对设备队列长度的控制，使得同时实现低延迟和高吞吐量成为可能。
4. 无提交日志：更新只有在持久化到磁盘上的最终位置后才被确认。

除了提供更高的平均吞吐量外，通过消除一系列复杂的维护流程，这些原则还能带来更可预测的性能，无论是吞吐量还是延迟。其中一些设计决策并非没有权衡。例如，无共享架构存在负载不均衡的风险。缺少排序顺序会影响扫描性能。我们在评估中表明，对于主要由中等到大尺寸键值对（400B+）组成的工作负载，这些缺点被简化的CPU操作所带来的收益所抵消。

我们将这些技术实现在Kvell中，并证明Kvell与四种最先进的KV系统相比具有优势：RocksDB [15]和PebblesDB [43]（均为LSM KV），以及TokuMX [42]和WiredTiger [48]（均基于B树变体）。我们使用行业标准的YCSB基准测试，包括均匀分布和倾斜分布的键访问模式。此外，我们证明Kvell的吞吐量在整个实验过程中保持稳定，而其他系统则会出现性能低谷。我们在其他工作负载和平台上验证了这些结果。

**贡献。** 本文的贡献包括：

1. 对传统LSM和B树KV系统的分析，证明它们在NVMe SSD上受限于CPU性能。
2. 一种新的持久化KV设计范式，以利用NVMe SSD的特性，重点在于简化CPU的使用。
3. 实现这一新范式的Kvell KV系统。
4. 在合成基准测试和生产环境负载下，对Kvell与最先进的LSM和B树KV系统进行深入评估。

**路线图。** 本文其余部分组织如下。第2节展示SSD性能的演进。第3节讨论当前KV设计的局限性。第4节介绍Kvell的设计原则。第5节详细描述Kvell中采用的技术方案。第6节呈现Kvell的深入评估。第7节讨论相关工作，第8节总结全文。

## 2 SSD性能的演进

**硬件。** 我们考虑过去5年内推出的以下三种设备：

- **Config-SSD**：32核2.4GHz Intel Xeon，128GB RAM，480GB Intel DC S3500 SSD（2013年）。
- **Config-Amazon-8NVMe**：AWS i3.metal实例，36个CPU（72核）2.3GHz，488GB RAM，8块各1.9TB的NVMe SSD（品牌未知，2016年技术）。
- **Config-Optane**：4核4.2GHz Intel i7，60GB RAM，480GB Intel Optane 905P（2018年）。

**IOPS。** 表1显示了这三种设备的最大读写IOPS以及随机和顺序带宽。首先，IOPS和带宽都有了显著增长。其次，在旧设备上，随机写入明显慢于顺序写入，但在新设备上已不再如此。类似地，混合随机读写也不再像旧设备那样导致性能下降。例如，采用2018年第三季度发布的Intel Optane 905P驱动器的Config-Optane配置，无论读写混合比例如何，都能维持50万+ IOPS，且随机访问仅比顺序访问略慢。

**延迟和带宽。** 表2显示了所有三种设备在不同设备队列深度下的延迟和带宽测量结果（单核执行随机写入）。前代设备仅在少量并发I/O请求下才能维持亚毫秒级响应时间（Config-SSD为32个）。Config-Amazon-8NVMe和Config-Optane支持更高的并行度，两款驱动器都能在256个并发请求下以亚毫秒级延迟响应。当设备队列中请求过少时，两款驱动器都只能达到其带宽的一部分。因此，即使在现代设备上，也需要在发送过少并发请求（导致带宽次优）和发送过多请求（导致高延迟）之间保持精细的平衡。

**吞吐量下降。** 图1显示了所有三种设备上随时间变化的IOPS。该图也展示了设备技术的进步。例如，Config-SSD可以在40分钟内维持5万写IOPS，但随后其性能逐渐下降到1.1万IOPS。较新的SSD不存在此问题，并能随时间保持高且稳定的IOPS。

表1. 三种SSD在不同工作负载下的IOPS和带宽。新驱动器的IOPS和带宽显著提升，且随机访问与顺序访问之间的性能差异很小。

表2. 单核随机写入时，不同队列深度下的平均延迟和带宽。需要选择合适的队列长度，以同时实现低延迟和高带宽利用率。

<center>图1. 三种SSD随时间变化的IOPS。老一代SSD只能在短时间内以最大IOPS进行I/O突发。</center>

**延迟尖峰。** 图2显示了在Config-Amazon-8NVMe和Config-Optane上，队列深度为64时4K写入的延迟。老一代SSD在写密集型工作负载下，由于内部维护操作，会出现延迟尖峰。在Config-SSD上，我们在5小时后观察到高达100ms的延迟尖峰，而正常写入延迟为1.5ms。这些结果未在图2中显示，因为该设备的尖峰幅度会掩盖其他设备的结果。Config-Amazon-8NVMe驱动器也会出现周期性延迟尖峰。观察到的最大延迟为15ms（而第99百分位数为3ms）。在Config-Optane驱动器上，延迟尖峰不规则出现，其幅度通常小于1ms，观察到的最大值为3.6ms（而第99百分位数为700us）。

## 3 当前KV系统在NVMe SSD上的问题

目前持久化KV系统主要有两种范式：（1）LSM KV，被广泛认为是写密集型工作负载的最佳选择；（2）B树KV，被认为更适合读密集型工作负载。LSM KV被用于流行的系统，如RocksDB [15]和Cassandra [16]。B树及其变体被用于MongoDB [42, 48]。接下来我们将证明，这两种设计在NVMe SSD上都会受限于CPU性能，并且遭受严重的性能波动。我们超越了现有工作[6, 40, 41]，证明了这些观察同样适用于B树KV，并提供了CPU开销的详细分析。

<center>图2. AWS和Intel Optane上4K写请求（队列深度64）随时间变化的延迟。</center>

<center>3.1 CPU是瓶颈</center>

图3. Config-Optane。RocksDB（LSM KV）和WiredTiger（B树KV）的I/O带宽（左）和CPU消耗（右）时间线。两个系统都无法充分利用设备的全部I/O带宽。工作负载：YCSB A（50%写入-50%读取），均匀键分布，1KB键值项大小。

图3显示了在Config-Optane上，两种最先进的KV系统——RocksDB（LSM KV）和WiredTiger（B树KV）——的磁盘利用率（左）和CPU利用率（右）（其他KV系统结果类似）。本例使用YCSB核心工作负载A（写密集型）和均匀键分布。两个系统都使CPU饱和，且未能充分利用可用带宽。我们现在解释这些行为。

**CPU是LSM KV的瓶颈。** LSM KV通过将更新吸收到内存缓冲区[36, 39]中，针对写密集型工作负载进行了优化。当缓冲区满时，它被刷新到磁盘。刷新的缓冲区随后由后台线程合并到持久存储中维护的树状结构中。磁盘结构包含多个层级，大小递增。每个层级包含多个不可变的排序文件，且键范围不重叠（第一层级除外，它保留用于写入内存缓冲区）。为了在磁盘上维护此结构，LSM KV执行CPU和I/O密集型的维护操作，称为压缩（compaction），将数据从LSM树的较低层级合并到较高层级，维护项的顺序并丢弃重复项。

众所周知，压缩在旧设备上会竞争磁盘带宽[5, 6]，但合并、索引和内核代码也会竞争CPU时间，而在新设备上，CPU已成为主要瓶颈。性能分析显示，RocksDB将高达60%的CPU时间花费在压缩上（28%用于合并数据，15%用于构建索引，其余用于从磁盘读写数据）。压缩的需求源于LSM设计对顺序磁盘访问和在磁盘上保持数据有序的要求。这种设计在旧驱动器上是有益的，因为那时值得花费CPU周期来保持数据有序并确保长的顺序磁盘访问。

**CPU是B树KV的瓶颈。** 针对持久存储设计的B树有两种变体：B+树和Bε树。B+树将键值项存储在叶子节点中。内部节点仅包含键，用于路由。通常，内部节点驻留在内存中，叶子节点驻留在持久存储中。每个叶子节点持有一个排序的键值项范围，叶子节点通过链表链接，便于扫描。最先进的B+树（如WiredTiger）依赖缓存来获得良好性能[49]。更新首先写入每线程的提交日志，然后写入缓存。最终，当数据从缓存中淘汰时，树会更新为新信息。更新使用序列号，这对于扫描是必需的。读取操作经过缓存，仅在项未缓存时才访问树。

将数据持久化到树中的操作有两种类型：（1）检查点（checkpointing）和（2）淘汰（eviction）。检查点定期或在日志达到一定大小阈值时发生。检查点对于控制提交日志的大小是必要的。淘汰将缓存中的脏数据写入树。当缓存中的脏数据量超过一定阈值时触发淘汰。

Bε树是B+树的一种变体，在每个节点增加了临时存储键和值的缓冲区。最终，随着缓冲区变满，键值项会沿树结构向下流动并写入持久存储。

B树设计容易出现同步开销。对WiredTiger的性能分析显示，工作线程将总时间的47%花费在等待日志槽位上（在\_\_log_wait_for_earlier_slot函数中，该函数使用sched_yield系统调用进行忙等待）。问题源于无法足够快地推进更新的序列号。在更新的主代码路径中，排除在内核中花费的时间，WiredTiger仅花费18%的时间执行客户端请求逻辑，其余时间都在等待。WiredTiger还需要执行后台操作：从页缓存中淘汰脏数据占总时间的12%，管理提交日志占5%。在内核中花费的时间中，只有25%用于读写调用，其余时间花费在futex和yield函数上。

Bε树也受到同步开销的影响。由于Bε树在磁盘上保持数据有序，工作线程最终会修改共享数据结构，导致争用。对TokuMX的性能分析显示，线程将高达30%的时间花费在用于保护共享页面的锁或原子操作上。缓冲也被证明是Bε树中开销的主要来源。在YCSB A工作负载下，TokuMX花费超过20%的时间将数据从缓冲区移动到叶子节点中的正确位置。这些同步开销使其他开销相形见绌。

在现代NVMe SSD配置中，为了最小化与同步相关的CPU开销，尽可能减少共享是有益的。以前用于提供快速持久性保证的日志最终成为主要瓶颈。缓冲也引入了开销——这一观察已在内存KV系统中提出[26]，有趣的是，现在也适用于持久存储。

### 3.2 LSM和B树KV中的性能波动

除了受限于CPU性能外，LSM和B树KV都遭受显著的性能波动。图4显示了运行YCSB核心工作负载A的RocksDB [15]和WiredTiger [48]随时间变化的吞吐量波动。吞吐量每秒测量一次。在LSM和B树KV中，根本问题是类似的：客户端更新因维护操作而停滞。

在LSM KV中，吞吐量下降是因为有时更新需要等待压缩完成。当LSM树的第一层级已满时，更新需要等待，直到通过压缩腾出空间。然而，我们已经看到，当LSM KV在现代驱动器上运行时，压缩会遇到CPU瓶颈。随时间变化的吞吐量性能差异高达一个数量级：RocksDB平均维持6.3万请求/秒，但在写入停滞时降至1500。性能分析显示，写线程大约有22%的时间因等待内存组件被刷新而停滞。内存组件的刷新被延迟，因为压缩无法跟上更新的速度。

已提出了一些解决方案来减少压缩对性能的影响，例如延迟压缩[43]或

<center>图4. Config-Optane。RocksDB和WiredTiger中的吞吐量波动。工作负载：YCSB A（50%写入-50%读取），均匀键分布，1KB键值项大小。</center>

仅在系统空闲时运行压缩[6]，但这些解决方案并不适合高端SSD。例如，Config-Optane机器以2GB/s的速度刷新内存组件。将压缩延迟几秒以上会导致大量积压工作和空间浪费。

在B树中，用户工作负载也会因停滞而影响性能。用户写入因淘汰无法足够快地推进而停滞。停滞导致吞吐量下降一个数量级，从12万操作/秒降至8500操作/秒。我们得出结论，压缩和淘汰等维护操作在两种情况下都严重干扰用户工作负载，导致可能持续数秒的停滞。因此，新的KV设计应避免维护操作。

## 4 Kvell设计原则

为了高效地利用现代持久存储，KV系统现在需要强调低CPU开销。我们表明以下原则是在现代SSD上实现峰值性能的关键。

1. **无共享。** 在Kvell中，这体现为支持并行性并最小化KV工作线程之间的共享状态，以减少CPU开销。
2. **磁盘上不排序，但内存中保留索引。** Kvell将项无序地持久化到磁盘上的最终位置，避免了昂贵的重排序操作。
3. **目标是减少系统调用，而非顺序I/O。** Kvell不追求顺序磁盘访问，利用现代SSD上随机访问几乎与顺序访问一样高效的特点。相反，它通过批量I/O来最小化系统调用引起的CPU开销。
4. **无提交日志。** Kvell不缓冲更新，因此无需依赖提交日志，避免了不必要的I/O。

### 4.1 无共享

对于常见的单点读和写操作，处理请求的工作线程无需与其他线程进行任何同步。每个线程处理给定键子集的请求，并维护一组线程私有的数据结构来管理这些键。关键的数据结构包括：（i）一个轻量级的内存B树索引，用于跟踪键在持久存储中的位置；（ii）I/O队列，负责高效地从持久存储中存储和检索信息；（iii）空闲列表，部分在内存中的磁盘块列表，包含用于存储项的空闲位置；以及（iv）页缓存——Kvell使用自己的内部页缓存，不依赖操作系统级别的结构。扫描是唯一需要在内存B树索引上进行最少同步的操作。

这种无共享方法是与常规KV设计的关键区别，在常规设计中，所有或大部分主要数据结构由所有工作线程共享。常规方法需要为每个请求进行同步，而Kvell完全避免了这一点。按请求分区可能导致负载不均衡，但我们发现，采用合适的分区策略，其影响很小。

### 4.2 磁盘上不排序，但内存中保留索引

Kvell不对工作线程工作集中的数据进行排序。由于Kvell不排序键，它可以将项持久化到磁盘上的最终位置。这种磁盘上完全没有排序的特性减少了插入项的开销（即找到正确的插入位置），并消除了与磁盘上维护操作（或写入磁盘前排序）相关的CPU开销。将键无序存储尤其有利于写操作，并有助于实现低尾延迟。

在扫描期间，连续的键不再位于同一磁盘块中，这似乎是一个缺点。然而，令人惊讶的是，对于中等和大尺寸键值项的工作负载（例如，YCSB基准测试或我们生产环境负载中的扫描，如第6节所示），扫描性能并未受到显著影响。

### 4.3 目标是减少系统调用，而非顺序I/O

在Kvell中，所有操作（包括扫描）都执行随机磁盘访问。由于随机访问与顺序访问一样高效，Kvell不会浪费CPU周期来强制顺序I/O。

与LSM KV类似，Kvell也批量处理磁盘请求。但其目标不同。LSM KV主要使用I/O批处理和排序键值项来利用顺序磁盘访问。Kvell批量I/O请求的主要目标是减少系统调用次数，从而降低CPU开销。

批处理存在权衡。如第2节所述，磁盘需要始终保持忙碌以达到峰值IOPS，但只有当其硬件队列中的请求数少于给定数量时（例如Config-Optane上的256个），才能以亚毫秒级延迟响应。一个高效的系统应向磁盘推送足够的请求以使其保持忙碌，但不应

用大量请求淹没它们，否则会导致高延迟。

在多磁盘配置中，每个工作线程只在一个磁盘上存储文件。这一设计决策对于限制每个磁盘的待处理请求数量至关重要。实际上，由于工作线程之间不通信，它们不知道其他工作线程已向某个磁盘发送了多少请求。如果工作线程将数据存储在一个磁盘上，那么发往某个磁盘的请求数受限于（批处理大小 × 每个磁盘的工作线程数）。如果工作线程访问所有磁盘，那么某个磁盘可能会有（批处理大小 × 工作线程总数）个待处理请求。

由于请求根据键分配给工作线程，且工作线程只访问一个磁盘，因此可以设计一个主要访问位于一个磁盘上的数据的工作负载，而使其他磁盘空闲。然而，在表现出倾斜访问模式的工作负载中，数据倾斜会被内部页缓存吸收。因此，大部分负载不均衡并不会导致磁盘I/O。

### 4.4 无提交日志

Kvell仅在更新已持久化到磁盘上的最终位置后才确认更新，而不依赖提交日志。一旦更新提交给工作线程，它将在下一个I/O批次中被持久化到磁盘。移除提交日志使得Kvell能够将磁盘带宽仅用于有意义的客户端请求处理。

## 5 Kvell实现

尽管Kvell的设计原则看似简单，但在实践中正确实现它们却具有挑战性。Kvell的源代码可在 https://github.com/BLepers/Kvell 获取。

### 5.1 客户端操作接口

Kvell实现了与LSM KV相同的核心接口：写入 Update(k,v)、读取 Get(k) 和范围扫描 Scan(k1,k2)。Update(k,v) 将值 v 与键 k 关联。Update(k,v) 仅在值已持久化到磁盘后才返回。Get(k) 返回键 k 的最新值。Scan(k1,k2) 返回键 k1 和 k2 之间的键值项范围。

### 5.2 磁盘数据结构

为避免碎片化，大小范围相近的项存储在同一文件中。我们称每个这样的文件为一个块区（slab）。Kvell以块粒度访问块区，块大小即我们机器上的页大小（4KB）。

如果项小于页大小（即一页可容纳多个项），Kvell会在块区中的项前添加时间戳、键大小和值大小。大于4K的项在磁盘上每个块的开头有一个时间戳头。对于小于页大小的项，更新采用原地更新方式。对于较大的项，更新包括将项追加到块区，然后在原来位置写入一个墓碑标记（tombstone）。当项的大小改变时，Kvell首先将更新后的项写入其新的块区，然后从旧块区中删除它。

### 5.3 内存数据结构

**索引。** Kvell依赖快速、轻量级的内存索引，具有可预测的插入和查找时间，以定位项在磁盘上的位置。Kvell为每个工作线程使用一个内存B树来存储项在磁盘上的位置。项通过（键的前缀）进行索引。我们使用前缀而非哈希值，以保留键的顺序用于范围扫描。B树在磁盘上存储中/大型项时性能较差，但当数据（主要）适合内存且键较小时，速度很快。Kvell利用这一特性，仅使用B树来存储查找信息（前缀和位置信息共占13B）。

Kvell的树实现目前平均每个项使用19B（存储前缀、位置信息和B树结构），对于1亿个项，这相当于1.7GB的RAM。在YCSB工作负载（1KB项）中，索引占数据库大小的1.7%。我们发现这个值在实践中是合理的。Kvell目前不显式支持将部分B树刷新到磁盘，但B树数据是从一个mmap-ed文件中分配的，可以由内核分页出去。

**页缓存。** Kvell维护自己的内部页缓存，以避免从持久存储中频繁获取页。页缓存的大小是一个系统参数。页缓存在索引中记录哪些页被缓存，并按照LRU顺序从缓存中淘汰页。

确保索引中的查找和插入具有最小的CPU开销对于良好性能至关重要。我们页缓存的第一个实现使用了快速的uthash哈希表作为索引。然而，当页缓存很大时，哈希插入可能需要长达100ms（用于扩容哈希表），从而推高尾延迟。切换到B树消除了这些延迟尖峰。

**空闲列表。** 当一个项从块区中删除时，其在块区中的位置被插入到一个每块区（per-slab）的内存栈中，我们称之为块区的空闲列表。然后在磁盘上该项的位置写入一个墓碑标记。为了限制内存使用，我们只在内存中保留最后 N 个被释放的位置（N 当前设置为64）。目标是限制内存使用，同时保留在每批I/O中重用多个空闲位置而无需额外磁盘访问的能力。

当第 (N+1) 个项被释放时，Kvell使其磁盘墓碑标记指向第一个被释放的位置。然后Kvell从内存栈中移除第一个被释放的位置，并插入第 (N+1) 个被释放的位置。当第 (N+2) 个项被释放时，其墓碑标记指向第二个被释放的位置，依此类推。简而言之，Kvell维护 N 个独立的栈，其头在内存中，其余部分在磁盘上。这使得Kvell

可以在每批I/O中重用多达 N 个空闲位置。如果只有一个栈，Kvell需要从磁盘顺序读取 N 个墓碑标记才能找到接下来的 N 个空闲位置。

### 5.4 高效执行I/O

Kvell依赖Linux的异步I/O API（AIO）将请求发送到磁盘，每批最多64个请求。通过批量处理请求，Kvell将系统调用开销分摊到多个客户端请求上。我们选择使用Linux异步I/O，因为它提供了一种通过单次系统调用执行多个I/O的方法。我们估计，如果在同步I/O API中有类似的调用，性能大致相同。

我们拒绝了两种流行的I/O替代方案：（1）依赖OS页缓存的mmap（例如RocksDB），以及（2）使用read和write直接I/O系统调用（例如TokuMX）。这两种技术都比使用AIO接口效率低。表3总结了我们的发现，展示了在Config-Optane上随机写入4K块（涉及设备上的读-修改-写）时可达到的最大IOPS。访问的数据集是可用RAM的3倍。

表3. Config-Optane。不同磁盘访问技术下的最大IOPS。

| 技术                         | IOPS |
| :--------------------------- | :--- |
| OS页缓存 + MMap（1线程）     | 10K  |
| OS页缓存 + MMap（8线程）     | 60K  |
| 直接I/O读写（1线程）         | 88K  |
| 异步I/O（1线程，队列深度1）  | 91K  |
| 异步I/O（1线程，队列深度64） | 376K |

第一种方法是依赖操作系统级别的页缓存。在单线程情况下，这种方法性能次优，因为它一次只能发出一个磁盘读取（当发生页错误时，预读值设为0，因为数据是随机访问的）。此外，脏页仅定期刷新到磁盘。这导致大部分时间队列深度次优，随后出现I/O突发。当数据集不完全适合RAM时，内核还必须从进程的虚拟地址空间中映射和取消映射被换出的页，这会产生显著的CPU开销。在多线程情况下，页缓存在刷新LRU时会受到锁开销的影响（平均每刷新32KB到磁盘就有一个锁），以及系统使远程核心的TLB条目失效的速度的影响。实际上，当一个页从虚拟地址空间取消映射时，虚拟到物理的映射需要在所有访问过该页的核心上失效，由于IPI通信[33]而产生显著开销。

第二种方法是依赖直接I/O。然而，当请求同步执行时，直接I/O的read/write系统调用无法填充磁盘队列（每个线程1个待处理请求）。由于无需处理复杂

**算法1 单页键值对的主KV路径**

```
1  客户端线程：
2      worker_id1 = prefix(k1) % nb_workers
3      queues[worker_id1].push({k1, GET, callback1})
4      worker_id2 = prefix(k2) % nb_workers
5      queues[worker_id2].push({(k2,v2), UPDATE, callback2})
6
7  工作线程：
8      将I/O推送到磁盘 (io_submit 异步I/O)
9
10     int processed_requests = 0;
11     while(request r = queues[my_id].pop()
12            &  processed_requests++ &  batch_size)
13         location = [file, index] = lookup(prefix(r.key))
14         page = get_page_from_cache(location)
15         switch r.action:
16             case GET:
17                 if(!location || page.contains_data)
18                     callback(... page) // 同步调用
19                 else
20                     read_async(page, callback) // 入队I/O
21                 break;
22             case UPDATE:
23                 file = get_file_based_on_size((k,v))
24                 if(!location)
25                     ... // 异步添加项到文件
26                 else if(location.file != file) // 大小改变
27                     ... // 从旧块区删除，添加到新块区
28                 else if(!page.contains_data) // 页未缓存
29                     // 首先异步读取数据...
30                     get({(k,v), UPDATE, callback });
31                 else // ...然后更新并异步刷新页
32                     更新缓存页
33                     write_async(location, callback)
34
35      events = get 已处理的I/O (io_getevents 异步I/O)
36      foreach(e in events)
37          callback(... e.page)
```

将页从虚拟地址空间映射和取消映射的逻辑，这种技术优于mmap方法。

相比之下，批量I/O每批只需要一次系统调用，并允许Kvell控制设备队列长度以实现低延迟和高带宽。

尽管理论上I/O批处理技术可以应用于LSM和B树KV，但实现需要大量工作。在B树中，不同的操作可能对I/O产生冲突影响（例如，插入导致的叶子节点分裂，随后是两个叶子节点的合并）。此外，由于重排序，数据可能在磁盘上移动，这也使得异步批处理请求难以实现。LSM KV中已经通过内存组件实现了写请求的批处理。然而，批处理在读取路径上略微增加了复杂性，因为工作线程需要确保所有需要读取的文件不会被压缩线程移除。

### 5.5 客户端操作实现

算法1总结了Kvell的架构。为简单起见，该算法仅显示单页KV项。当一个

请求进入系统时，它根据其键被分配给一个工作线程（算法1第3行和第5行）。工作线程执行磁盘I/O并处理客户端请求的逻辑。

**Get(k)。** 读取一项（算法1第17-22行）包括从索引中获取其在磁盘上的位置并读取相应的页。如果该页已被缓存，则无需访问持久存储，值将同步返回给客户端。如果没有，则处理该请求的工作线程将其推入其I/O引擎队列。

**Update(k,v)。** 更新一项（算法1第24-35行）包括首先读取存储它的页，修改值，然后将页写入磁盘。删除一项包括写入一个墓碑值并将该项位置添加到块区的空闲列表中。当添加新项时重用被释放的位置，如果没有空闲位置则追加项。Kvell仅在更新后的项已完全持久化到磁盘后才确认更新完成（即，当io_getevents系统调用通知我们对应于该更新的磁盘写入已完成时，算法1第37行）。脏数据会立即刷新到磁盘，因为Kvell的页缓存不用于缓冲更新。通过这种方式，Kvell提供了比最先进的KV系统更强的持久性保证。例如，RocksDB仅在提交日志同步到磁盘的粒度上保证持久性。在典型配置中，同步仅在几个更新一批的情况下发生。

**Scan(k1,k2)。** 扫描包括（1）从索引中获取键的位置和（2）读取相应的页。为了计算键列表，Kvell扫描所有索引：一个线程依次短暂地锁定、扫描和解锁所有工作线程的索引，最后合并结果以获取需要从KV读取的键列表。然后使用Get()命令发出读取请求，该命令绕过索引查找（因为Kvell已经访问过索引）。扫描是唯一需要线程间共享的操作。Kvell返回扫描触及的每个键关联的最新值。相比之下，RocksDB和WiredTiger都在KV快照上执行扫描。

### 5.6 故障模型和恢复

Kvell的当前实现针对无故障运行进行了优化。在崩溃的情况下，所有块区都被扫描，内存中的索引被重建。尽管扫描最大化了顺序磁盘带宽，但在非常大的数据集上恢复仍可能需要几分钟。

如果一个项在磁盘上出现两次（例如，如果在将项从一个块区迁移到另一个块区的过程中发生崩溃），则只有最新的项被保留在内存索引中，另一个项被插入空闲列表。对于大于块大小的项，Kvell使用时间戳头来丢弃仅被部分写入的项。

Kvell是为即使在电源故障情况下也能原子写入4KB页面的驱动器设计的。这个约束可以通过避免原地修改页面来消除，将新值写入新页面，然后在第一次写入被完全确认后将旧位置添加到块区的空闲列表中。

## 6 评估

### 6.1 目标

我们使用各种生产环境和合成工作负载评估Kvell，并将其与最先进的KV系统进行比较。评估旨在回答以下问题：

1. 在现代SSD上，Kvell在吞吐量、性能波动以及读、写和扫描的尾延迟方面与现有KV系统相比如何？
2. Kvell在大型数据库和生产工作负载上的表现如何？
3. 在超出其设计范围的工作负载（小项、内存受限极端环境和旧驱动器）中，使用Kvell的权衡和局限性是什么？

### 6.2 实验设置

**硬件。** 我们使用第2节中描述的三种硬件配置。我们的重点是Config-Optane，因为它是三者中拥有最新驱动器的配置。我们也在Config-Amazon-8NVMe中评估Kvell，旨在展示系统在大型配置中的行为。最后，我们在Config-SSD中评估Kvell，展示在旧硬件上使用Kvell的权衡。

**工作负载。** 我们使用YCSB [10]和来自Nutanix的两个生产工作负载。我们的重点是YCSB基准测试，因为它包含各种类型的工作负载，能够更全面地展示Kvell的行为。表4总结了YCSB核心工作负载。我们对所有YCSB工作负载都评估了均匀和Zipfian键分布。KV项大小为1024B，小测试的总数据集大小约为100GB（1亿个键），大测试为5TB（50亿个键）。生产工作负载是两个写密集型工作负载，读写扫描比例为57:41:2。KV项大小范围在250B到1KB之间，中位数为400B。生产工作负载的总数据集大小为256GB。两个工作负载之间的区别在于数据倾斜度：生产工作负载1更接近均匀键分布，而生产工作负载2更加倾斜。

**现有KV系统。** 我们将Kvell与四种最先进的系统进行比较：（1）RocksDB 6.2 [15]，由Facebook开发的LSM KV存储，在工业界广泛使用；（2）PebblesDB [43]，一个最近的学术LSM KV存储，在LSM维护开销方面有显著改进；（3）TokuMX [42]，一个Bε树[7]，作为

表4. YCSB核心工作负载描述。

表4. YCSB核心工作负载描述。

| 工作负载 | 描述                                            |
| :------- | :---------------------------------------------- |
| YCSB A   | 写密集型：50% 更新，50% 读取                    |
| YCSB B   | 读密集型：5% 更新，95% 读取                     |
| YCSB C   | 只读：100% 读取                                 |
| YCSB D   | 读最新：5% 更新，95% 读取                       |
| YCSB E   | 扫描密集型：5% 更新，95% 扫描；平均扫描长度50项 |
| YCSB F   | 50% 读-修改-写，50% 读取                        |

MongoDB [35]的存储引擎；（4）WiredTiger 3.2 [48]配置为使用B+树。我们使用其LevelDB接口查询WiredTiger，该接口我们从WiredTiger 3.1移植而来。我们也尝试了CouchDB [2]，一个优化的B+树实现，但由于其性能始终慢于TokuMX，未在评估中报告结果。

**系统配置。** 所有系统分配相同数量的内存，使用cgroups设置。内存大小是数据集大小的三分之一，以确保请求既从内存服务，也从持久存储服务。当数据库大于可用RAM大小的3倍时，我们不使用cgroups（即应用程序可以使用全部可用RAM）。对于B树，我们配置块大小为4KB。两个LSM KV都配置为最多5层和两个128MB的内存组件（一个活跃，一个不可变）。此外，我们将预写式日志设置为缓冲1MB，以便它不频繁刷新，不会使LSM KV处于劣势。

### 6.3 主要实验设置下的结果

#### 6.3.1 吞吐量

图5显示了在Config-Optane上，Kvell和竞品系统在均匀和Zipfian键分布下的YCSB平均吞吐量。

**写密集型工作负载（YCSB A和F）。** 在YCSB A工作负载（50%读取，50%写入）上，Kvell的性能是TokuMX的15倍，是WiredTiger和RocksDB的8倍，是PebblesDB的5.8倍。在此工作负载中，未缓存的读取导致1次I/O，缓存的读取导致0次I/O，未缓存的写入导致2次I/O（1次读取 + 1次写入），缓存的写入导致1次I/O（1次写入）。由于页缓存包含数据库的1/3，平均每个请求导致1.17次磁盘I/O，这意味着最大理论吞吐量为500K IOPS / 1.17 = 428K 请求/秒。Kvell维持平均420K 请求/秒的吞吐量。因此，如图6所示，Kvell在不成为CPU瓶颈的情况下，以峰值带宽的98%利用磁盘。在此工作负载中，Kvell花费20%的时间在页缓存和内存索引进行的B树查找上，20%的时间在I/O函数上，60%的时间在等待上。

如第3节所述，LSM KV受限于压缩成本。WiredTiger受限于日志争用（占总周期的50%）。TokuMX受限于

<center>图5. Config-Optane。YCSB工作负载在均匀和Zipfian键分布下的平均吞吐量。Kvell在写密集型工作负载上比次优竞品高出5.8倍，在读密集型工作负载上高出2.2倍，同时提供良好的扫描性能（在均匀分布下与最优系统相当，在Zipfian分布下好32%）。</center>

共享数据结构和不必要的缓冲上的争用（两者占总周期的50%）。

**读密集型工作负载（YCSB B， C， D）。** Kvell在YCSB B上比现有KV系统高2.2倍，在YCSB C上高2.7倍，几乎以满IOPS利用磁盘。在YCSB C上，Kvell花费40%的时间在查找上，20%的时间在I/O函数上，40%的时间在等待上。在这些工作负载中，现有KV系统性能次优是因为它们的共享缓存或因为它们不批量处理读取请求到磁盘（每次读取一次系统调用）。例如，RocksDB花费高达41%的时间在pread()系统调用上，并且受限于CPU。

**扫描工作负载（YCSB E）。** 也许令人惊讶的是，Kvell在扫描密集型工作负载中表现出色，无论是在均匀还是Zipfian键分布下。注意，为了公平起见，我们修改了YCSB工作负载，使其在Kvell中随机顺序插入键。默认情况下，YCSB按顺序插入键。

在Zipfian工作负载下，Kvell比所有系统至少好25%。由于工作负载的倾斜性，热数据被Kvell的缓存捕获。无共享设计，加上低开销的缓存实现，使Kvell相对于竞品具有优势。

在均匀工作负载下，Kvell比PebblesDB高5倍，比WiredTiger高33%，与RocksDB性能相当（13.9K次扫描/秒对比14.4K次扫描/秒）。由于Kvell不在磁盘上保持数据有序，它平均每个扫描项访问一页。相比之下，保持数据有序的RocksDB，粗略地说每页访问三个项（页大小为4K，项大小为1K）。因此，RocksDB的最大吞吐量大约是Kvell的三倍。图7显示了每个系统的吞吐量时间线，

<center>图6. Config-Optane。Kvell在YCSB A（均匀分布）上的I/O带宽（左）和CPU利用率（右）。Kvell在不成为CPU瓶颈的情况下使用了全部磁盘I/O带宽。</center>

证实了这一推理。对于YCSB E，RocksDB的峰值吞吐量达到55Kops/s，而Kvell的最大值为18Kops/s。然而，RocksDB的维护操作干扰了客户端负载，导致大幅波动，而Kvell的吞吐量稳定在15Kops/s左右。因此，平均而言，RocksDB和Kvell性能相似。

### 6.3.2 随时间变化的吞吐量

图7显示了Kvell、RocksDB、PebblesDB和WiredTiger随时间变化的吞吐量。吞吐量每秒测量一次。除了提供高平均吞吐量外，Kvell不会受到维护操作引起的性能波动的影响。在YCSB A中，RocksDB的吞吐量降至最低1.4K请求/秒，PebblesDB的吞吐量降至10K请求/秒，WiredTiger的吞吐量降至8.5K请求/秒。在仅包含5%更新的扫描密集型工作负载中，RocksDB的吞吐量降至1.8K次扫描/秒，PebblesDB降至1.1K次扫描/秒。这些下降频繁发生。

相比之下，Kvell的性能在短暂的预热阶段（页缓存填满的时间）后保持恒定。Kvell在YCSB A上维持最低400K请求/秒，在预热阶段后维持15K次扫描/秒。

#### 6.3.3 尾延迟

表5显示了Kvell、RocksDB、PebblesDB和WiredTiger的第99百分位数和最大延迟。LSM KV的尾延迟超过9秒，WiredTiger的最大延迟为3秒。这是由于维护操作直接影响了LSM和B树KV的尾延迟。这样的数字在LSM KV中并不罕见，已在先前的工作[6]中报道过。相比之下，Kvell在提供强大持久性保证的同时，提供了低最大延迟（3.9ms）。

| 延迟 | Kvell | RocksDB | PebblesDB | WiredTiger |
| :--- | :---- | :------ | :-------- | :--------- |
| 99p  | 2.4ms | 5.4ms   | 2.8ms     | 4.7ms      |
| 最大 | 3.9ms | 9.6s    | 9.4s      | 3s         |

表5. YCSB A工作负载（写密集型）上的第99百分位数和最大请求延迟。

<center>图7. Config-Optane。Kvell、RocksDB、PebblesDB和WiredTiger在YCSB A（写密集型）、YCSB B（读密集型）、YCSB C（只读）和YCSB E（扫描密集型）均匀键分布下的吞吐量时间线。吞吐量每秒测量一次。Kvell提供了高且稳定的吞吐量，而LSM和B树KV则因维护操作而有显著波动。</center>

#### 6.4 替代配置和工作负载

#### 6.4.1 Config-Amazon-8NVMe上的YCSB

图8显示了均匀键分布下YCSB的平均吞吐量。所有系统配置为使用30GB缓存（数据库大小的1/3）。在YCSB A上，Kvell平均比RocksDB高6.7倍，比PebblesDB高8倍，比TokuMX高13倍，比WiredTiger高9.3倍。对于YCSB E，Kvell略优于RocksDB，且快于其他系统。尽管结果概况与上述Config-Optane类似，但我们可以看到Kvell与竞品之间的性能差距在扩大，因为Kvell能够更好地利用磁盘，而其他系统则受限于CPU。

AWS磁盘根据读写比率具有不同的最大IOPS。Kvell在混合读写操作的工作负载上最大化磁盘IOPS。在这些工作负载上，Kvell花费50%的时间等待，20%在查找上，10%管理回调（malloc和free），20%在I/O函数上。在均匀键分布下，Kvell在3.8M req/s时受限于CPU，使用了磁盘可持续的3.3M只读IOPS的75%。然而，它仍然比现有KV系统快5.6倍。在Config-Amazon-8NVMe机器上，在此类工作负载下受限于CPU是意料之中的。当核心在I/O函数之外花费超过边际比例的CPU周期时，这台机器无法达到峰值只读IOPS。在微基准测试中，我们测量到每个I/O请求使用超过3us的CPU周期会将可达到的IOPS限制在最大IOPS的75%。尽管有这些限制，Kvell即使在扫描工作负载上也优于现有KV系统，因为其开销更低（即页缓存无争用和请求批量处理到磁盘）。

<center>图8. Config-Amazon-8NVMe。YCSB平均吞吐量，均匀键分布。Kvell在所有方面都优于竞品系统。</center>

与Config-Optane的情况一样，LSM和B树KV会出现吞吐量波动和高尾延迟（10+秒）。在YCSB E中，RocksDB的每秒吞吐量经常低于6K次扫描/秒（而平均为57K次扫描/秒）。在运行维护操作时，RocksDB、PebblesDB和WiredTiger只能维持其平均速度的一小部分（例如，在YCSB A上，RocksDB为平均值的5%）。

我们在Kvell中观察到的最大延迟为20ms（YCSB A的99p为12ms），YCSB C为12ms（99p为2.9ms）。

#### 6.4.2 Nutanix生产工作负载

图9 A显示了RocksDB、PebblesDB、TokuMX、WiredTiger和Kvell在Nutanix的两个写密集型生产工作负载上的性能。在第一个生产工作负载中，21%的读请求从缓存服务，在第二个工作负载中，99%的读请求从缓存服务。在平均吞吐量方面，Kvell在两个生产工作负载中都比RocksDB（性能次优的竞品）高出约4倍。Kvell在第一个生产工作负载中成功最大化磁盘带宽，在第二个生产工作负载中使用了78%的磁盘带宽（在第二个工作负载中，磁盘仅用于更新，所有其他请求都从缓存服务）。

与之前的实验类似，RocksDB随时间的吞吐量波动很大，低至3K请求/秒。另一方面，Kvell的吞吐量波动极小。在延迟方面，Kvell在最大延迟方面比RocksDB高出多达3个数量级（RocksDB为8秒，而Kvell为2.5ms），在第99百分位数上高出一个数量级（RocksDB为12ms，而Kvell为1.7ms）。

#### 6.4.3 Config-Amazon-8NVMe上的5TB YCSB数据库

图9 B显示了Kvell在包含50亿个键（5TB）的数据库上运行YCSB基准测试的性能。与之前的实验一样，Kvell配置为使用30GB页缓存。我们进行此实验是为了测试Kvell随数据集大小的可扩展性。

<center>图9. A. Config-Optane。生产工作负载平均吞吐量。Kvell在两种工作负载中都比所有竞品系统高出约4倍。B. Config-Amazon-8NVMe。Kvell在均匀键分布的5TB YCSB数据集上的吞吐量。Kvell在所有工作负载中都随数据集大小扩展。</center>

在此实验中，Kvell仅缓存0.6%的项。由于键被均匀访问，大多数读写操作都从磁盘服务。在YCSB A中，这导致平均每个请求1.5次I/O，即最大吞吐量为1.4M IOPS / 1.5 = 935K请求/秒。Kvell实现了866K请求/秒，即峰值带宽的92%。在YCSB C和E上，Kvell分别执行高达2.7M请求/秒和52K次扫描/秒；这些数字略低于1亿项数据集上的结果，因为缓存的数据较少，且内存索引中的查找平均需要多25%的时间来完成。

### 6.5 权衡与局限性

#### 6.5.1 平均延迟

Kvell批量提交I/O请求。在饱和IOPS（大批量）和最小化平均延迟（小批量）之间存在权衡。对于Config-Optane上的YCSB A，Kvell在每个工作线程批量处理64个请求时最大化磁盘带宽，平均延迟为158us。当批量大小为32个请求时，平均延迟降至76us，磁盘使用率为其最大带宽的88%。

#### 6.5.2 项大小的影响

对于未缓存的项，项大小不影响Get()和Update()请求的性能。然而，项大小影响保持项有序的KV系统的扫描速度。图10显示了RocksDB、执行压缩时的RocksDB和Kvell在YCSB E（扫描为主）上随项大小变化的平均吞吐量。由于Kvell不在磁盘上对项排序，无论项大小如何，它平均每个扫描项读取一个4KB页，因此性能恒定。对于小项，RocksDB优于Kvell，因为它比Kvell读取的页数少（对于64B项少64倍）。随着项大小的增长，保持项有序的优势减小。

在所有项大小下，RocksDB在运行压缩时只能维持其吞吐量的一小部分。虽然Kvell

<center>图10. Config-Amazon-8NVMe。RocksDB和KVell在YCSB E（扫描为主）上的吞吐量。</center>

并非为处理小项而设计，但它在所有配置下都提供了可预测的性能。

#### 6.5.3 内存大小的影响

表6显示了在Config-Amazon-8NVMe上，索引大小与可用RAM比率不同时，索引可执行的查找次数。当索引适合RAM时，工作线程在均匀工作负载下总共可执行1500万次查找/秒（在Zipfian访问模式下，由于数据缓存更好，可达2400万次）。当索引大小是分配RAM的5倍时，均匀工作负载下的这个数字降至109K次查找/秒。因此，当索引不适合RAM时，它们可能成为瓶颈。

KVell仅支持将索引部分刷新到磁盘以避免在索引超过可用RAM时崩溃，但并未针对这种情况进行优化。在实践中，索引的内存开销足够低，以至于在大多数工作负载下它们都能适合RAM（例如，在YCSB的情况下，100GB数据集的索引为1.7GB）。

表6. Config-Amazon-8NVMe。在受限内存环境下，拥有1亿个键时，内存索引可维持的操作数（查找或插入）。

| 索引大小 / RAM | Zipf - 操作/秒 | 均匀 - 操作/秒 |
| :------------- | :------------- | :------------- |
| 0.8            | 24M            | 15M            |
| 1.0            | 32.4M          | 1.4M           |
| 1.2            | 614K           | 540K           |
| 2.6            | 348K           | 156K           |
| 5.2            | 80K            | 109K           |

#### 6.5.4 旧驱动器（Config-SSD）

在Config-SSD上，KVell在读写方面与LSM KV相当，但在扫描方面的平均性能相对较低（KVell为3K次扫描/秒，而RocksDB为15K次扫描/秒，PebblesDB为5K次扫描/秒）。在旧驱动器上，花费CPU周期优化磁盘访问平均而言是有益的，并且没有系统受限于CPU。压缩仍然竞争磁盘资源，造成延迟尖峰（18秒以上）和吞吐量波动（RocksDB上极端情况为11次扫描/秒对比15K平均值）。KVell的延迟仅受峰值磁盘延迟限制（Config-SSD上为100ms）。因此，在旧驱动器上使用KVell与LSM KV相比是一种权衡：如果稳定性和延迟可预测性很重要，KVell是比LSM KV更好的选择，但对于扫描为主的工作负载，LSM KV在旧驱动器上提供更高的平均性能。

### 6.6 恢复时间

KVell的恢复时间取决于数据库大小，而其他系统的恢复时间主要取决于提交日志的最大大小。对于所有系统，我们使用提交日志的默认配置，并在YCSB数据库（1亿个键，100GB）上测量恢复时间。我们通过在YCSB A工作负载运行中杀死数据库来模拟崩溃，并在Config-Amazon-8NVMe上测量数据库的恢复时间。

KVell需要6.6秒来扫描数据库并从崩溃中恢复，最大化磁盘带宽。RocksDB和WiredTiger平均分别需要18秒和24秒来恢复。两个系统主要花费时间从其提交日志重放查询和重建索引。尽管KVell针对无故障运行进行了优化，并且必须扫描整个数据库才能从崩溃中恢复，但其恢复时间与现有系统相比仍然具有优势。

## 7 相关工作

### 7.1 面向SSD的KV系统

LSM [36, 39]是写优化KV系统最普遍的设计之一，例如用于LevelDB [11]、RocksDB [15]、HyperLevelDB [18]、HyperDex [13]和Cassandra [16]。为了使最初为硬盘设计的LSM KV适应SSD，已经做了大量工作。WiscKey [30]和HashKV [8]通过将键排序在LSM树中，同时将值单独存储在日志中，对SSD进行了优化。与KVell类似，它们探索了打破顺序性的想法，然而，这两个系统仍然执行昂贵的后台压缩，与客户端操作竞争。

PebblesDB [43]使用分片LSM树，通过将压缩推迟到LSM树的最后一层来减少压缩的影响。SILK为LSM KV提出了一种I/O调度器，以减少压缩对客户端请求延迟的影响[6]。TRIAD [5]结合使用不同技术来减少写放大。在高负载下，所有三个系统最终都需要运行压缩，导致客户端操作的延迟尖峰和吞吐量下降。

SlimDB [45]利用SSD，改进了LSM KV中的索引和过滤方案，以获得良好的读取性能。NovelLSM [21]、PapyrusKV [22]和NVMrocks [14]将LSM设计适配到持久内存，平滑了RAM和SSD之间的过渡。这些LSM增强仍然保留了键的顺序性，这与KVell不同。

BetrFS [19]和TokuMX [42]利用Bε树[7]在写优化和读优化数据结构之间取得平衡，仍然利用键的顺序顺序。

如第3节所述，虽然树对于小键效率很高，但对于中大型键（即Kvell的目标工作负载）性能不佳。

更普遍地说，CPU开销限制快速磁盘性能的观察已在先前的工作中提出，并提出了新的KV设计。SILT [28]是为闪存驱动器设计的KV系统。SILT探索了使用小型内存索引来高效查找磁盘的想法，但依赖昂贵的后台操作来将数据转换并合并到磁盘上的HashStores和SortedStores中。相比之下，Kvell不需要后台操作即可将数据持久化到磁盘。Udepot [24]使用内存哈希表来查找存储在NVMe驱动器上的数据。Udepot使用锁来防止磁盘页面和内存结构上的竞争，使用垃圾收集器来避免磁盘碎片化，并且不支持扫描。Papagiannis等人[40, 41]提出了替代的KV设计，在SSD和NVMe驱动器上倾向于随机I/O以减少CPU开销。在Tucana [40]中，Papagiannis等人修改了Bε树，移除了索引级别的缓冲。Tucana仍然依赖叶子级别的缓冲来实现良好性能，并依赖页缓存来缓存数据。在Kvell中，我们表明缓冲在快速驱动器上不再有用，页缓存严重限制了性能，并且单个共享数据结构上的争用可能导致不必要的开销。在Kreon [41]中，Papagiannis等人修改了LSM KV以减少压缩的开销。他们仅在磁盘上排序键，并使用小的随机I/O将它们合并到LSM树的不同层中。Kreon依赖缓冲来实现良好性能，并且每分钟仅将其L0刷新到磁盘一次以实现峰值吞吐量。与传统的LSM设计类似，积累的维护工作导致CPU使用率尖峰，这可能导致性能波动。相比之下，Kvell不使用任何维护操作，并提供稳定的吞吐量。

LOCS [47]、BlueCache [51]和NVMKV [32]是在SSD上的高效KV系统，将FTL操作暴露给操作系统。这种SSD很少见，且优化与特定硬件设计绑定。在这项工作中，我们表明低级别的硬件特定优化并非必需，并且可以通过通用系统调用以低延迟和最大磁盘带宽执行I/O操作。

Mickens等人[34]和Klimovic等人[23]采用存储解耦，以便在数据中心充分利用全部磁盘带宽。Kvell旨在在单机上充分利用全部磁盘带宽。

### 7.2 面向字节寻址持久内存的KV系统

大量工作提出了针对字节寻址持久内存（PM）优化的数据结构[4, 17, 50, 53, 54]。HiKV [50]是一种混合KV存储。HiKV专注于改善对存储在PM中的哈希表执行请求的延迟。该哈希表用于快速查找，而存储在RAM中的全局B+树用于加速范围查询。Kvell在块设备上面临不同的延迟挑战，它无序存储数据以避免昂贵的迁移，并使用每线程结构来避免系统中的争用点。Bullet [17]使用交叉引用日志在KV存储中的DRAM和PM访问之间创建无缝过渡。Zuo等人[54]提出了一种针对PM优化的写优化哈希索引方案。该技术优化了点查询，但不支持高效的范围查询。各种树算法也被适配为直接在PM中持久化数据，无需DRAM结构[3, 9, 25, 38, 46, 52]。相比之下，Kvell专注于快速的块寻址SSD，我们认为这仍将是大型数据存储更具成本效益的选择。SLM-DB [20]结合了LSM设计和B树以利用PM。与Kvell一样，它维护一个B树索引用于快速查找（SLM-DB的索引位于PM中，而Kvell将其维护在DRAM中）。SLM-DB依赖压缩操作来排序持久化数据。

### 7.3 面向内存数据存储的KV系统

与Kvell类似，MICA [29]和Minos [12]采用分区设计，将非重叠的KV项分片分配给每个系统线程。然而，Minos不是根据键范围分区，而是根据KV项大小分区。Masstree [31]结合了并发B+树和trie，强调缓存的有效利用。与Kvell不同，Masstree假设整个工作集都适合内存。RAMCloud [37]是一个基于DRAM的KV存储，强调快速并行恢复。Li等人[27]开发了一个全栈内存KV存储，实现了高吞吐量，同时考虑了硬件属性以创建高效设计——Kvell也考虑了硬件属性。

## 8 结论

现有的KV存储设计在老一代SSD上效率很高，但在现代SSD上性能次优。我们已经证明，一种依赖于无共享架构、磁盘上无序数据和批量随机I/O的流线型方法，在快速驱动器上优于现有KV系统，即使对于扫描工作负载也是如此。我们已在Kvell中原型实现了这些想法。Kvell提供了高且可预测的性能以及强大的延迟保证。

**致谢。** 我们要感谢我们的 shepherd Michael Kaminsky 和匿名审稿人提供的所有有益评论和建议。这项工作部分得到了瑞士国家科学基金会授权号 513954 和 514009 以及 Nutanix, Inc. 的资助。

## 参考文献

[1] Amitansand S Aiyer, Mikhail Bautin, Guoqiang Jerry Chen, Pritam Damania, Prakash Khemani, Kannan Muthukkaruppan, Karthik Ranganathan, Nicolas Spiegelberg, Liyin Tang, and Madhuwanti Vaidya. 2012. Storage Infrastructure Behind Facebook Messages: Using HBase at Scale. _IEEE Data Eng. Bull._ 35, 2 (2012).

[2] J Chris Anderson, Jan Lehnardt, and Noah Slater. 2010. _CouchDB: The Definitive Guide: Time to Relax._ "O'Reilly Media, Inc."

[3] Joy Arulraj, Justin Levandoski, Umar Farooq Minhas, and Per-Ake Larson. 2018. BzTree: A High-Performance Latch-Free Range Index for Non-Volatile Memory. _Proceedings of the VLDB Endowment_ 11, 5 (2018).

[4] Joy Arulraj and Andrew Pavlo. 2019. Non-Volatile Memory Database Management Systems. _Synthesis Lectures on Data Management_ 11, 1 (2019).

[5] Oana Balmau, Diego Didona, Rachid Guerraoui, Willy Zwaenepoel, Huapeng Yuan, Aashray Arora, Karan Gupta, and Pavan Konka. 2017. TRIAD: Creating Synergies Between Memory, Disk and Log in Log Structured Key-value Stores. In _Proceedings of USENIX ATC_.

[6] Oana Balmau, Florin Dinu, Willy Zwaenepoel, Karan Gupta, Ravishankar Chandhiraamoothi, and Diego Didona. 2019. SILK: Preventing Latency Spikes in Log-Structured Merge Key-Value Stores. In _Proceedings of USENIX ATC_.

[7] Michael A. Bender, Martin Farach-Colton, William Jannen, Rob Johnson, Bradley C. Kuszmaul, Donald E. Porter, Jun Yuan, and Yang Zhan. 2015. An Introduction to Be-trees and Write-Optimization. _Jogin:_ 40, 5 (2015).

[8] Helen H. W. Chan, Yongkun Li, Patrick P. C. Lee, and Yinlong Xu. 2018. HashKV: Enabling Efficient Updates in KV Storage via Hashing. In _Proceedings of USENIX ATC_.

[9] Shimin Chen and Qin Jin. 2015. Persistent B+-trees in Non-Volatile Main Memory. _Proceedings of the VLDB Endowment_ 8, 7 (2015).

[10] Brian F. Cooper, Adam Silberstein, Erwin Tam, Raghu Ramakrishnan, and Russell Sears. 2010. Benchmarking Cloud Serving Systems with YCSB. In _Proceedings of SoCC_.

[11] Jeffrey Dean and Sanjay Ghemawat. 2018. LevelDB. https://github.com/google/leveldb.

[12] Diego Didona and Willy Zwaenepoel. 2018. Size-aware Sharding For Improving Tail Latencies in In-memory Key-value Stores. In _Proceedings of NSDL_.

[13] Robert Escriva, Bernard Wong, and Emin Gun Sirer. 2012. HyperDex: A Distributed, Searchable Key-Value Store. In _Proceedings of SIGCOMM_.

[14] Facebook. 2017. NVMRocks: RocksDB on Non-Volatile Memory Systems. http://istc-bigdata.org/index.php/nvmrocks-rocksdb-on-non-volatile-memory-systems.

[15] Facebook. 2018. RocksDB: a Persistent Key-Value Store for Fast Storage Environments. https://rocksdb.org.

[16] Apache Software Foundation. 2018. Cassandra NoSQL Key-Value Store. http://cassandra.apache.org/.

[17] Yihe Huang, Matej Pavlovic, Virendra Marathe, Margo Seltzer, Tim Harris, and Steve Byan. 2018. Closing the Performance Gap Between Volatile and Persistent Key-Value Stores Using Cross-Referencing Logs. In _Proceedings of USENIX ATC_.

[18] Hyperdex. 2018. HyperLevelDB. https://github.com/rescrv/HyperLevelDB.

[19] William Jannen, Jun Yuan, Yang Zhan, Amogh Akshintala, John Esmet, Yizheng Jiao, Ankur Mittal, Prashant Pandey, Phaneendra Reddy, Leif Walsh, Michael Bender, Martin Farach-Colton, Rob Johnson, Bradley C. Kuszmaul, and Donald E. Porter. 2015. BetrFS: Write-Optimization in a Kernel File System. _ACM Transactions on Storage (TOS)_ 11, 4 (2015).

[20] Olzhas Kaiyrakhmet, Songyi Lee, Beomseok Nam, Sam H Noh, and Young-ri Choi. 2019. SLM-DB: Single-Level Key-Value Store with Persistent Memory. In _Proceedings of FAST_.

[21] Sudarsun Kannan, Nitish Bhat, Ada Gavrilovska, Andrea Arpac-Dusseau, and Remzi Arpaci-Dusseau. 2018. Redesigning LSMs for Nonvolatile Memory with NovelLSM. In _Proceedings of USENIX ATC_.

[22] Jungwon Kim, Seyong Lee, and Jeffrey S Vetter. 2017. PapyrusKV: a High-Performance Parallel Key-Value Store for Distributed NVM Architectures. In _Proceedings of SC_.

[23] Ana Klimovic, Christos Kozyrakis, Eno Thereska, Binu John, and Sanjeev Kumar. 2016. Flash Storage Disaggregation. In _Proceedings of EuroSys_.

[24] Kornilios Kourtis, Nikolas Ioannou, and Ioannis Koltsidas. 2019. Reaping the Performance of Fast NVM Storage with uDepot. In _Proceedings of FAST_.

[25] Se Kwon Lee, K Hyun Lim, Hyunsub Song, Beomseok Nam, and Sam H Noh. 2017. WORT: Write Optimal Radix Tree for Persistent Memory Storage Systems. In _Proceedings of FAST_.

[26] Viktor Leis, Michael Haubenschild, Alfons Kemper, and Thomas Neumann. 2018. LeanStore: In-memory Data Management Beyond Main Memory. In _Proceedings of ICDE_.

[27] Sheng Li, Hyeontaek Lim, Victor W Lee, Jung Ho Ahn, Anuj Kalia, Michael Kaminsky, David G Andersen, O Seongil, Sukhan Lee, and Pradeep Dubey. 2016. Achieving One Billion Key-Value Requests Per Second on a Single Server. _IEEE Micro_ 36, 3 (2016).

[28] Hyeontaek Lim, Bin Fan, David G Andersen, and Michael Kaminsky. 2011. SILT: A Memory-Efficient, High-Performance Key-Value Store. In _Proceedings of OSDI_.

[29] Hyeontaek Lim, Dongsu Han, David G Andersen, and Michael Kaminsky. 2014. MICA: A Holistic Approach to Fast In-Memory Key-Value Storage. In _Proceedings of NSDI_.

[30] Lanyue Lu, Thanumalayan Sankaranarayana Pillai, Andrea C. Arpac-Dusseau, and Remzi H. Arpaci-Dusseau. 2016. WiscKey: Separating Keys from Values in SSD-conscious Storage. In _Proceedings of FAST_.

[31] Yandong Mao, Eddie Kohler, and Robert Tappan Morris. 2012. Cache Craftiness for Fast Multicore Key-Value Storage. In _Proceedings of EuroSys_.

[32] Leonardo Marmol, Swaminathan Sundararaman, Nisha Talagala, and Raju Rangaswami. 2015. NVMKV: A Scalable, Lightweight, FTL-aware Key-Value Store. In _Proceedings of USENIX ATC_.

[33] Mel Gorman. 2015. mm: Send one IPI per CPU to TLB Flush All Entries After Unmapping Pages. https://lore.kernel.org/patchwork/patch/575960/.

[34] James Mickens, Edmund B Nightingale, Jeremy Elson, Darren Gehring, Bin Fan, Asim Kadav, Vijay Chidambaram, Osama Khan, and Krishna Nareddy. 2014. Blizzard: Fast, Cloud-Scale Block Storage for Cloud-Oblivious Applications. In _Proceedings of NSDI_.

[35] MongoDB. 2018. MongoDB. https://www.mongodb.com/.

[36] Patrick O'Neil, Edward Cheng, Dieter Gawlick, and Elizabeth O'Neil. 1996. The Log-structured Merge-tree (LSM-tree). _Acta Inf._ 33, 4 (1996).

[37] Diego Ongaro, Stephen M Rumble, Ryan Stutsman, John Ousterhout, and Mendel Rosenblum. 2011. Fast Crash Recovery in RAMCloud. In _Proceedings of SOSP_.

[38] Ismail Oukid, Johan Lasperas, Anisoca Nica, Thomas Willhalm, and Wolfgang Lehner. 2016. FPTree: A Hybrid SCM-DRAM Persistent and Concurrent B-Tree for Storage Class Memory. In _Proceedings of SIGMOD_.

[39] John Ousterhout and Fred Douglas. 1989. Beating the I/O Bottleneck: A Case for Log-Structured File Systems. _ACM SIGOPS Operating Systems Review_ 23, 1 (1989).

[40] Anastasios Papagiannis, Giorgos Saloustos, Pilar González-Férez, and Angelos Bila. 2016. Tucana: Design and Implementation of a Fast and Efficient Scale-up Key-Value Store. In _Proceedings of USENIX ATC_.

[41] Anastasios Papagiannis, Giorgos Saloustos, Pilar González-Férez, and Angelos Bila. 2018. An Efficient Memory-Mapped Key-Value Store for Flash Storage. In _Proceedings of SoCC_.

[42] Percona. 2018. TokuMX. https://www.percona.com/software/mongo-database/percona-tokumx.

[43] Pandian Raju, Rohan Kadekodi, Vijay Chidambaram, and Ittai Abraham. 2017. PebblesDB: Building Key-Value Stores Using Fragmented Log-Structured Merge Trees. In _Proceedings of SOSP_.

[44] RedisLabs. 2019. Redis: In-Memory Data Structure Store, Used as a Database, Cache and Message Broker. https://redis.io/.

[45] Kai Ren, Qing Zheng, Joy Arulraj, and Garth Gibson. 2017. SlimDB: A Space-efficient Key-value Storage Engine for Semi-Sorted Data. _Proceedings of VLDB Endowment_ 10, 13 (2017).

[46] Shivaram Venkataraman, Niraj Tolia, Parthasarathy Ranganathan, Roy H Campbell, et al. 2011. Consistent and Durable Data Structures for Non-Volatile Byte-Addressable Memory. In _Proceedings of FAST_.

[47] Peng Wang, Guangyu Sun, Song Jiang, Jian Ouyang, Shiding Lin, Chen Zhang, and Jason Cong. 2014. An Efficient Design and Implementation of LSM-Tree Based Key-Value Store on Open-Channel SSD. In _Proceedings of EuroSys_.

[48] WiredTiger. 2018. WiredTiger. http://www.wiredtiger.com/.

[49] WiredTiger. 2019. WiredTiger Caching and Eviction. http://source.wiredtiger.com/3.2.0/tune_cache.html.

[50] Fei Xia, Dejun Jiang, Jin Xiong, and Ninghui Sun. 2017. HiKV: a Hybrid Index Key-Value Store for DRAM-NVM Memory Systems. In _Proceedings of USENIX ATC_.

[51] Shuotao Xu, Sungjin Lee, Sang-Woo Jun, Ming Liu, Jamey Hicks, et al. 2016. Bluecache: A Scalable Distributed Flash-Based Key-Value Store. _Proceedings of the VLDB Endowment_ 10, 4 (2016).

[52] Jun Yang, Qingsong Wei, Cheng Chen, Chundong Wang, Khai Leong Yong, and Bingsheng He. 2015. NV-Tree: Reducing Consistency Cost for NVM-Based Single Level Systems. In _Proceedings of FAST_.

[53] Yiying Zhang, Jian Yang, Amirsaman Memaripour, and Steven Swanson. 2015. Mojim: A Reliable and Highly-Available Non-Volatile Memory System. In _ACM SIGARCH Computer Architecture News_, Vol. 43.

[54] Pengfei Zuo, Yu Hua, and Jie Wu. 2018. Write-Optimized and High-Performance Hashing Index Scheme for Persistent Memory. In _Proceedings of OSDI_.
