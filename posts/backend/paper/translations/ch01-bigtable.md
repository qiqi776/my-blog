---
title: Bigtable：一种用于结构化数据的分布式存储系统
date: 2026-08-10
order: 1
---

**Bigtable：一种用于结构化数据的分布式存储系统**

Fay Chang, Jeffrey Dean, Sanjay Ghemawat, Wilson C. Hsieh, Deborah A. Wallach Mike Burrows, Tushar Chandra, Andrew Fikes, Robert E. Gruber

{fay, jeff, sanjay, wilsonh, kerr, m3b, tushar, fikes, gruber}@google.com

Google公司

---

**摘要**

Bigtable 是一个用于管理结构化数据的分布式存储系统，旨在扩展到非常庞大的规模：在数千台商用服务器上存储PB级的数据。Google的许多项目都在Bigtable中存储数据，包括网络索引、Google Earth和Google Finance。这些应用对Bigtable提出了非常不同的要求，无论是数据大小（从URL到网页再到卫星图像）还是延迟需求（从后端批量处理到实时数据服务）。尽管需求各异，Bigtable仍成功地为所有这些Google产品提供了灵活、高性能的解决方案。在本文中，我们描述了Bigtable提供的简单数据模型，该模型让客户端能够动态控制数据布局和格式，并描述了Bigtable的设计与实现。

---

## 1 引言

在过去两年半的时间里，我们在Google设计、实现并部署了一个用于管理结构化数据的分布式存储系统，称为Bigtable。Bigtable旨在可靠地扩展到PB级数据和数千台机器。Bigtable已实现了几个目标：广泛的适用性、可扩展性、高性能和高可用性。超过六十个Google产品和项目使用Bigtable，包括Google Analytics、Google Finance、Orkut、个性化搜索、Writely和Google Earth。这些产品将Bigtable用于各种要求苛刻的工作负载，从面向吞吐量的批处理作业到对最终用户延迟敏感的数据服务。这些产品使用的Bigtable集群配置范围很广，从几台到数千台服务器不等，并存储多达数百TB的数据。

[文本[114, 855, 483, 900], [513, 318, 881, 543]]

在许多方面，Bigtable类似于数据库：它共享了数据库的许多实现策略。并行数据库[14]和内存数据库[13]已经实现了可扩展性和高性能，但Bigtable提供了与这些系统不同的接口。Bigtable不支持完整的关系数据模型；相反，它为客户端提供了一个简单的数据模型，该模型支持对数据布局和格式的动态控制，并允许客户端推理底层存储中表示的数据的局部性属性。数据使用可以是任意字符串的行名和列名进行索引。Bigtable也将数据视为未解释的字节字符串，尽管客户端经常将各种形式的结构化和半结构化数据序列化到这些字符串中。客户端可以通过仔细选择其模式来控制数据的局部性。最后，Bigtable的模式参数让客户端可以动态控制是从内存还是从磁盘提供数据。

第2节更详细地描述了数据模型，第3节概述了客户端API。第4节简要描述了Bigtable所依赖的底层Google基础设施。第5节描述了Bigtable实现的基本原理，第6节描述了我们为提高Bigtable性能所做的一些改进。第7节提供了Bigtable性能的测量数据。我们在第8节描述了几个如何在Google使用Bigtable的例子，并在第9节讨论了我们在设计和支持Bigtable过程中学到的一些经验教训。最后，第10节描述了相关工作，第11节给出了我们的结论。

---

## 2 数据模型

Bigtable是一个稀疏的、分布式的、持久的、多维度的排序映射表。该映射表由行键、列键和时间戳索引；映射表中的每个值都是一个未解释的字节数组。

(row:string, column:string, time:int64) → string

---

图1：存储网页的示例表的一个切片。行名是反转的URL。“contents”列族包含页面内容，“anchor”列族包含引用该页面的任何锚点的文本。CNN的主页被Sports Illustrated和MY-look主页都引用了，因此该行包含名为“anchor:cnnsi.com”和“anchor:my.look.ca”的列。每个锚点单元格有一个版本；“contents”列有三个版本，分别对应时间戳 \(t_3\)、\(t_5\) 和 \(t_6\)。

在检查了类Bigtable系统的各种潜在用途之后，我们确定了这个数据模型。作为一个推动我们一些设计决策的具体例子，假设我们想要保留大量网页及相关信息的副本，这些信息可供许多不同的项目使用；我们称这个特定的表为Webtable。在Webtable中，我们将使用URL作为行键，网页的各个方面作为列名，并将网页内容存储在“contents:”列下，时间戳为获取它们的时间，如图1所示。

---

### 行

表中的行键是任意字符串（目前最大为64KB，尽管对于我们的大多数用户来说，10-100字节是典型大小）。对单个行键下的数据的每次读取或写入都是原子的（无论在该行中读取或写入多少不同的列），这一设计决策使得客户端在存在对同一行的并发更新时，更容易推理系统的行为。

Bigtable按行键的字典顺序维护数据。表的行范围被动态分区。每个行范围称为一个**tablet**，它是分布和负载均衡的单位。因此，短行范围的读取效率很高，并且通常只需要与少量机器通信。客户端可以通过选择行键来利用此属性，从而为其数据访问获得良好的局部性。例如，在Webtable中，通过反转URL的主机名组件，将同一域中的页面分组到连续的行中。例如，我们将 maps.google.com/index.html 的数据存储在键 com.google.maps/index.html 下。将来自同一域的页面存储在一起，使得某些主机和域分析更加高效。

---

### 列族

列键被分组为称为**列族**的集合，列族构成了访问控制的基本单位。存储在列族中的所有数据通常属于同一类型（我们将同一列族中的数据一起压缩）。必须先创建列族，然后才能在该族中的任何列键下存储数据；族创建后，可以使用该族内的任何列键。我们的意图是，表中不同列族的数量要少（最多几百个），并且在操作期间族很少更改。相比之下，一个表可以有无限数量的列。

列键使用以下语法命名：`family:qualifier`。列族名称必须是可打印的，但限定符可以是任意字符串。Webtable的一个示例列族是“language”，它存储编写网页所用的语言。我们在“language”族中只使用一个列键，它存储每个网页的语言ID。此表的另一个有用的列族是“anchor”；该族中的每个列键代表一个单独的锚点，如图1所示。限定符是引用站点的名称；单元格内容是链接文本。

访问控制以及磁盘和内存记账都在列族级别执行。在我们的Webtable示例中，这些控制允许我们管理几种不同类型的应用程序：一些添加新的基础数据，一些读取基础数据并创建派生列族，还有一些仅被允许查看现有数据（甚至可能出于隐私原因不允许查看所有现有族）。

---

### 时间戳

Bigtable中的每个单元格都可以包含同一数据的多个版本；这些版本由时间戳索引。Bigtable时间戳是64位整数。它们可以由Bigtable分配，在这种情况下它们表示微秒级的“实时时间”，或者由客户端应用程序显式分配。需要避免冲突的应用程序必须自行生成唯一的时间戳。单元格的不同版本按时间戳递减顺序存储，以便可以首先读取最新版本。

为了使版本化数据的管理不那么繁琐，我们支持每个列族两个设置，告诉Bigtable自动垃圾回收单元格版本。客户端可以指定仅保留单元格的最后 `n` 个版本，或者仅保留足够新的版本（例如，只保留过去七天内写入的值）。

在我们的Webtable示例中，我们将存储在“contents:”列中的已爬取页面的时间戳设置为实际爬取这些页面版本的时间。上面描述的垃圾回收机制让我们能够只为每个页面保留最近三个版本。

---

## 3 API

Bigtable API提供了创建和删除表及列族的函数。它还提供了更改集群、表和列族元数据（如访问控制权限）的函数。

客户端应用程序可以在Bigtable中写入或删除值、查找单个行的值，或迭代表中的数据子集。图2显示了使用RowMutation抽象执行一系列更新的C++代码。（为保持示例简短，省略了不相关的细节。）对`Apply`的调用对Webtable执行原子变更操作：它向 `www.cnn.com` 添加一个锚点，并删除另一个锚点。

图3显示了使用Scanner抽象迭代特定行中所有锚点的C++代码。客户端可以迭代多个列族，并且有几种机制来限制扫描产生的行、列和时间戳。例如，我们可以将上述扫描限制为只生成列名与正则表达式 `anchor:.*cnn.com` 匹配的锚点，或者只生成时间戳在当前时间十天内的锚点。

```
Scanner scanner(T);
ScanStream *stream;
stream = scanner.FetchColumnFamily("anchor");
stream->SetReturnAllVersions();
scanner.Lookup("com.cnn.www");
for (; !stream->Done(); stream->Next()) {
    printf("%s %s %ld %s\n",
           scanner.RowName(),
           stream->ColumnName(),
           stream->MicroTimestamp(),
           stream->Value());
}
```

<center>图3：从Bigtable读取数据。</center>

Bigtable支持其他几个特性，允许用户以更复杂的方式操作数据。首先，Bigtable支持单行事务，可用于对存储在单行键下的数据执行原子性的读-改-写序列。Bigtable目前不支持跨行键的通用事务，尽管它提供了一个接口，用于在客户端批量写入跨行键的数据。其次，Bigtable允许将单元格用作整数计数器。最后，Bigtable支持在服务器的地址空间中执行客户端提供的脚本。这些脚本使用Google开发的一种用于处理数据的语言Sawzall [28]编写。目前，我们基于Sawzall的API不允许客户端脚本写回Bigtable，但它允许各种形式的数据转换、基于任意表达式的过滤以及通过各种运算符进行汇总。

Bigtable可以与MapReduce [12]一起使用，MapReduce是Google开发的一个用于运行大规模并行计算的框架。我们编写了一组包装器，允许将Bigtable用作MapReduce作业的输入源和输出目标。

---

## 4 构建模块

Bigtable建立在Google基础设施的其他几个部分之上。Bigtable使用分布式Google文件系统（GFS）[17]来存储日志和数据文件。一个Bigtable集群通常在一个共享机器池中运行，该池运行各种其他分布式应用程序，并且Bigtable进程通常与其他应用程序的进程共享相同的机器。Bigtable依赖于集群管理系统来调度作业、管理共享机器上的资源、处理机器故障以及监控机器状态。

Google SSTable文件格式内部用于存储Bigtable数据。SSTable提供了一个持久的、有序的、不可变的从键到值的映射，其中键和值都是任意字节字符串。提供了查找与指定键关联的值的操作，以及迭代指定键范围内所有键/值对的操作。在内部，每个SSTable包含一系列块（通常每个块大小为64KB，但这是可配置的）。块索引（存储在SSTable的末尾）用于定位块；索引在打开SSTable时加载到内存中。查找可以通过一次磁盘寻道完成：我们首先通过对内存中的索引执行二分查找来找到合适的块，然后从磁盘读取相应的块。可选地，SSTable可以完全映射到内存中，这允许我们执行查找和扫描而无需访问磁盘。

Bigtable依赖于一个高可用、持久的分布式锁服务，称为Chubby [8]。一个Chubby服务由五个活动副本组成，其中一个被选为主副本并主动处理请求。当大多数副本正在运行且可以相互通信时，该服务是存活的。Chubby使用Paxos算法[9, 23]在发生故障时保持其副本的一致性。Chubby提供了一个由目录和小文件组成的命名空间。每个目录或文件都可以用作锁，对文件的读写是原子的。Chubby客户端库提供了Chubby文件的一致性缓存。每个Chubby客户端都与Chubby服务维护一个会话。如果客户端无法在租约到期时间内续订其会话租约，则客户端的会话将过期。当客户端的会话过期时，它将失去所有锁和打开的句柄。Chubby客户端还可以在Chubby文件和目录上注册回调，以接收更改或会话过期的通知。

Bigtable将Chubby用于各种任务：确保任何时候最多只有一个活动的主服务器；存储Bigtable数据的引导位置（见第5.1节）；发现tablet服务器并最终确定tablet服务器的死亡（见第5.2节）；存储Bigtable模式信息（每个表的列族信息）；以及存储访问控制列表。如果Chubby长时间不可用，Bigtable将变得不可用。我们最近在跨越11个Chubby实例的14个Bigtable集群中测量了这种影响。由于Chubby不可用（由Chubby中断或网络问题引起）而导致存储在Bigtable中的某些数据不可用的Bigtable服务器小时数的平均百分比为 \(0.0047\%\)。受Chubby不可用影响最大的单个集群的百分比为 \(0.0326\%\)。

---

## 5 实现

[文本[114, 855, 483, 900], [512, 91, 880, 120]]

Bigtable实现有三个主要组件：一个链接到每个客户端的库，一个主服务器，以及许多tablet服务器。Tablet服务器可以动态添加（或移除）到集群中，以适应工作负载的变化。

主服务器负责将tablet分配给tablet服务器，检测tablet服务器的添加和过期，平衡tablet服务器的负载，以及回收GFS中的文件。此外，它还处理模式更改，如表和列族的创建。

每个tablet服务器管理一组tablet（通常我们每个tablet服务器有大约十到一千个tablet）。Tablet服务器处理已加载tablet的读写请求，并拆分变得过大的tablet。

与许多单主分布式存储系统[17, 21]一样，客户端数据不经过主服务器：客户端直接与tablet服务器通信进行读写。由于Bigtable客户端不依赖主服务器获取tablet位置信息，大多数客户端从不与主服务器通信。因此，主服务器在实践中负载很轻。

一个Bigtable集群存储多个表。每个表由一组tablet组成，每个tablet包含与一个行范围相关的所有数据。最初，每个表只包含一个tablet。随着表的增长，它自动拆分为多个tablet，默认情况下每个tablet大小约为100-200 MB。

---

### 5.1 Tablet位置

我们使用类似于 \(\mathbf{B}^{+}\) 树[10]的三级层次结构来存储tablet位置信息（图4）。

<center>图4：Tablet位置层次结构。</center>

第一级是存储在Chubby中的一个文件，包含根tablet的位置。根tablet包含一个特殊的METADATA表中所有tablet的位置。每个METADATA tablet包含一组用户tablet的位置。根tablet只是METADATA表中的第一个tablet，但被特殊对待——它永远不会被拆分——以确保tablet位置层次结构不超过三级。

METADATA表在行键下存储tablet的位置，该行键是tablet的表标识符及其结束行的编码。每个METADATA行在内存中存储大约1KB的数据。在128 MB METADATA tablet的适度限制下，我们的三级位置方案足以寻址 \(2^{34}\) 个tablet（或在128 MB tablet中为 \(2^{61}\) 字节）。

客户端库缓存tablet位置。如果客户端不知道tablet的位置，或者发现缓存的位置信息不正确，则它会递归地在tablet位置层次结构中向上移动。如果客户端的缓存为空，位置算法需要三次网络往返，包括一次从Chubby读取。如果客户端的缓存是过时的，位置算法可能需要多达六次往返，因为过时的缓存条目仅在未命中时才发现（假设METADATA tablet不会频繁移动）。尽管tablet位置存储在内存中，因此不需要GFS访问，但我们通过让客户端库预取tablet位置来进一步减少这种成本：每当它读取METADATA表时，它会读取多个tablet的元数据。

我们还在METADATA表中存储辅助信息，包括与每个tablet相关的所有事件的日志（例如，何时服务器开始为其服务）。此信息有助于调试和性能分析。

---

### 5.2 Tablet分配

每个tablet一次分配给一个tablet服务器。主服务器跟踪活动tablet服务器的集合，以及tablet到tablet服务器的当前分配，包括哪些tablet未分配。当一个tablet未分配，并且有足够空间容纳该tablet的tablet服务器可用时，主服务器通过向tablet服务器发送tablet加载请求来分配该tablet。

Bigtable使用Chubby来跟踪tablet服务器。当tablet服务器启动时，它会在一个特定的Chubby目录中创建一个唯一命名的文件，并获取该文件的独占锁。主服务器监视此目录（服务器目录）以发现tablet服务器。如果tablet服务器失去其独占锁，则它停止为其tablet提供服务：例如，由于网络分区导致服务器失去其Chubby会话。（Chubby提供了一种高效机制，允许tablet服务器检查它是否仍然持有其锁，而不会产生网络流量。）只要文件仍然存在，tablet服务器将尝试在其文件上重新获取独占锁。如果文件不再存在，则tablet服务器将永远无法再次提供服务，因此它会终止自身。每当tablet服务器终止时（例如，因为集群管理系统正在从集群中移除tablet服务器的机器），它会尝试释放其锁，以便主服务器更快地重新分配其tablet。

主服务器负责检测tablet服务器何时不再为其tablet提供服务，并尽快重新分配这些tablet。为了检测tablet服务器何时不再为其tablet提供服务，主服务器定期向每个tablet服务器询问其锁的状态。如果tablet服务器报告它已失去其锁，或者如果主服务器在最近几次尝试中无法联系到服务器，则主服务器尝试在该服务器的文件上获取独占锁。如果主服务器能够获取该锁，则Chubby是存活的，并且该tablet服务器要么已死，要么在连接Chubby时遇到问题，因此主服务器通过删除其服务器文件来确保该tablet服务器永远无法再次提供服务。一旦服务器的文件被删除，主服务器可以将先前分配给该服务器的所有tablet移动到未分配tablet的集合中。为了确保Bigtable集群不易受主服务器和Chubby之间网络问题的影响，如果主服务器的Chubby会话过期，它会终止自身。然而，如上所述，主服务器故障不会改变tablet到tablet服务器的分配。

当主服务器由集群管理系统启动时，它需要先发现当前的tablet分配，然后才能更改它们。主服务器在启动时执行以下步骤。（1）主服务器在Chubby中获取唯一的主服务器锁，以防止并发的主服务器实例。（2）主服务器扫描Chubby中的服务器目录以查找活动服务器。（3）主服务器与每个活动tablet服务器通信，以发现已分配给每个服务器的tablet。（4）主服务器扫描METADATA表以了解所有tablet的集合。每当此扫描遇到尚未分配的tablet时，主服务器会将该tablet添加到未分配tablet的集合中，这使得该tablet有资格进行分配。

一个复杂情况是，在METADATA tablet被分配之前，无法扫描METADATA表。因此，在开始此扫描（步骤4）之前，如果在步骤3中未发现根tablet的分配，则主服务器将根tablet添加到未分配tablet的集合中。此添加确保根tablet将被分配。由于根tablet包含所有METADATA tablet的名称，主服务器在扫描根tablet后就会知道所有METADATA tablet。

现有tablet的集合仅在创建或删除表、将两个现有tablet合并为一个更大的tablet，或将现有tablet拆分为两个更小的tablet时发生变化。主服务器能够跟踪这些更改，因为除了最后一个之外，所有更改都由它发起。Tablet拆分被特殊对待，因为它们由tablet服务器发起。Tablet服务器通过在METADATA表中记录新tablet的信息来提交拆分。当拆分提交后，它通知主服务器。如果拆分通知丢失（要么

---

### 5.3 Tablet服务

如第5.1节所述，每个tablet的持久状态存储在GFS中，使用一组SSTable以及一个重做日志（即提交日志），这些日志包含最近插入的数据。与许多数据库系统类似，我们使用一个称为内存表的内存中缓存来加速最近写入数据的访问。读取操作首先查询内存表，然后查询SSTable的合并视图。

---

### 5.4 压实

随着写入操作的执行，内存表的大小会增加。当内存表大小达到阈值时，内存表被冻结，创建一个新的内存表，并将冻结的内存表转换为SSTable并写入GFS。这种次要压实过程有两个目标：它减少了tablet服务器的内存使用量，并且如果此服务器宕机，它减少了恢复期间必须从提交日志中读取的数据量。在压实发生时，传入的读写操作可以继续。

每次次要压实都会创建一个新的SSTable。如果这种行为不受限制地继续，读取操作可能需要合并来自任意数量SSTable的更新。相反，我们通过定期在后台执行合并压实来限制此类文件的数量。合并压实读取几个SSTable和内存表的内容，并写出一个新的SSTable。一旦压实完成，输入的SSTable和内存表就可以被丢弃。

将所有SSTable重写为恰好一个SSTable的合并压实称为主要压实。由非主要压实产生的SSTable可能包含特殊的删除条目，这些条目会抑制仍存活的旧SSTable中已删除的数据。另一方面，主要压实产生的SSTable不包含删除信息或已删除的数据。Bigtable循环遍历其所有tablet，并定期对其应用主要压实。这些主要压实允许Bigtable回收被删除数据使用的资源，并且还允许它确保已删除数据及时从系统中消失，这对于存储敏感数据的服务很重要。

<center>图5：Tablet表示</center>

从METADATA表读取其元数据。此元数据包含组成tablet的SSTable列表和一组重做点，这些重做点是指向可能包含该tablet数据的任何提交日志的指针。服务器将SSTable的索引读入内存，并通过应用自重做点以来已提交的所有更新来重建内存表。

当写入操作到达tablet服务器时，服务器检查其格式是否正确，以及发送者是否有权执行变更操作。授权通过从Chubby文件中读取允许的写入者列表来执行（这几乎总是在Chubby客户端缓存中命中）。有效的变更操作被写入提交日志。组提交用于提高大量小型变更操作的吞吐量[13, 16]。写入提交后，其内容将插入到内存表中。

当读取操作到达tablet服务器时，同样会检查其格式正确性和授权。有效的读取操作在SSTable序列和内存表的合并视图上执行。由于SSTable和内存表是按字典顺序排序的数据结构，因此可以高效地形成合并视图。

在tablet拆分和合并期间，传入的读写操作可以继续。

---

### 5.4 压实

随着写入操作的执行，内存表的大小会增加。当内存表大小达到阈值时，内存表被冻结，创建一个新的内存表，并将冻结的内存表转换为SSTable并写入GFS。这种次要压实过程有两个目标：它减少了tablet服务器的内存使用量，并且如果此服务器宕机，它减少了恢复期间必须从提交日志中读取的数据量。在压实发生时，传入的读写操作可以继续。

每次次要压实都会创建一个新的SSTable。如果这种行为不受限制地继续，读取操作可能需要合并来自任意数量SSTable的更新。相反，我们通过定期在后台执行合并压实来限制此类文件的数量。合并压实读取几个SSTable和内存表的内容，并写出一个新的SSTable。一旦压实完成，输入的SSTable和内存表就可以被丢弃。

将所有SSTable重写为恰好一个SSTable的合并压实称为主要压实。由非主要压实产生的SSTable可能包含特殊的删除条目，这些条目会抑制仍存活的旧SSTable中已删除的数据。另一方面，主要压实产生的SSTable不包含删除信息或已删除的数据。Bigtable循环遍历其所有tablet，并定期对其应用主要压实。这些主要压实允许Bigtable回收被删除数据使用的资源，并且还允许它确保已删除数据及时从系统中消失，这对于存储敏感数据的服务很重要。

---

## 6 改进

前一节中描述的实现需要进行一些改进，才能达到我们用户所需的高性能、高可用性和高可靠性。本节更详细地描述实现的某些部分，以突出这些改进。

---

### 局部性组

客户端可以将多个列族分组为一个局部性组。为每个tablet中的每个局部性组生成一个单独的SSTable。将通常不会一起访问的列族分隔到不同的局部性组中，可以实现更高效的读取。例如，Webtable中的页面元数据（如语言和校验和）可以放在一个局部性组中，而页面内容可以放在另一个组中：一个想要读取元数据的应用程序不需要通读所有页面内容。

此外，一些有用的调优参数可以按局部性组指定。例如，可以将局部性组声明为驻留在内存中。用于内存局部性组的SSTable在tablet服务器中延迟加载到内存中。一旦加载，属于此类局部性组的列族就可以在不访问磁盘的情况下读取。此功能对于频繁访问的小数据段非常有用：我们在内部将其用于METADATA表中的位置列族。

---

### 压缩

客户端可以控制是否压缩局部性组的SSTable，以及如果压缩，使用哪种压缩格式。用户指定的压缩格式应用于每个SSTable块（其大小可通过局部性组特定的调优参数控制）。虽然我们通过单独压缩每个块损失了一些空间，但我们受益于可以读取SSTable的小部分而无需解压整个文件。许多客户端使用一种两遍自定义压缩方案。第一遍使用Bentley和McIlroy的方案[6]，它在大窗口内压缩长公共字符串。第二遍使用一种快速压缩算法，在数据的小型16 KB窗口内查找重复项。这两遍压缩都非常快——在现代机器上编码速度为100–200 MB/s，解码速度为400–1000 MB/s。

尽管我们在选择压缩算法时强调速度而不是空间缩减，但这种两遍压缩方案的效果出奇地好。例如，在Webtable中，我们使用这种压缩方案来存储网页内容。在一个实验中，我们将大量文档存储在一个压缩的局部性组中。为了实验的目的，我们将自己限制为每个文档只存储一个版本，而不是存储所有可用版本。该方案实现了10:1的空间缩减。这比HTML页面上典型的Gzip 3:1或4:1的缩减要好得多，这是因为Webtable行的布局方式：来自单个主机的所有页面都存储在一起。这使得Bentley-McIlroy算法能够识别来自同一主机的页面中大量的共享模板。许多应用，不仅仅是Webtable，都选择它们的行名以便将相似的数据聚集在一起，因此实现了非常好的压缩比。当我们在Bigtable中存储同一值的多个版本时，压缩比会变得更好。

---

### 用于提高读取性能的缓存

为了提高读取性能，tablet服务器使用两级缓存。扫描缓存是一个更高级别的缓存，它缓存SSTable接口返回给tablet服务器代码的键值对。块缓存是一个较低级别的缓存，它缓存从GFS读取的SSTable块。扫描缓存对于倾向于重复读取相同数据的应用程序最有用。块缓存对于倾向于读取最近刚读取的数据附近数据的应用程序很有用（例如，顺序读取，或热点行中同一局部性组内不同列的随机读取）。

---

### 布隆过滤器

如第5.3节所述，读取操作必须从构成tablet状态的所有SSTable中读取。如果这些SSTable不在内存中，我们可能会进行许多磁盘访问。我们通过允许客户端指定应为特定局部性组中的SSTable创建布隆过滤器[7]来减少访问次数。布隆过滤器允许我们询问一个SSTable是否可能包含特定行/列对的任何数据。对于某些应用，用于存储布隆过滤器的一小部分tablet服务器内存大大减少了读取操作所需的磁盘寻道次数。我们使用布隆过滤器也意味着大多数对不存在的行或列的查找不需要访问磁盘。

---

### 提交日志实现

如果我们为每个tablet的提交日志保留一个单独的日志文件，则在GFS中会同时写入大量文件。根据每个GFS服务器上底层文件系统实现的不同，这些写入可能会导致大量磁盘寻道，以写入不同的物理日志文件。此外，每个tablet使用单独的日志文件也会降低组提交优化的效果，因为组可能会更小。为了解决这些问题，我们将变更操作附加到每个tablet服务器的单个提交日志中，将不同tablet的变更操作混合在同一个物理日志文件中[18, 20]。

使用一个日志在正常操作期间提供了显著的性能优势，但它使恢复变得复杂。当一个tablet服务器宕机时，它服务的tablet将被移动到大量其他tablet服务器：每个服务器通常加载原始服务器的一小部分tablet。为了恢复tablet的状态，新的tablet服务器需要从原始tablet服务器写入的提交日志中重新应用该tablet的变更操作。然而，这些tablet的变更操作是混合在同一个物理日志文件中的。一种方法是让每个新的tablet服务器读取这个完整的提交日志文件，并仅应用其需要恢复的tablet所需的条目。然而，在这种方案下，如果100台机器每台都从故障tablet服务器分配到一个tablet，那么日志文件将被读取100次（每台服务器读取一次）。

我们通过首先按键{表，行名，日志序列号}的顺序对提交日志条目进行排序来避免重复读取日志。在排序后的输出中，特定tablet的所有变更操作都是连续的，因此可以通过一次磁盘寻道和随后的顺序读取来高效地读取。为了并行化排序，我们将日志文件分区为64 MB的段，并在不同的tablet服务器上并行地对每个段进行排序。此排序过程由主服务器协调，并在tablet服务器指示它需要从某个提交日志文件恢复变更操作时启动。

将提交日志写入GFS有时会因各种原因导致性能波动（例如，参与写入的GFS服务器机器崩溃，或者到达特定三台GFS服务器集合的网络路径遭遇网络拥塞或负载过重）。为了保护变更操作免受GFS延迟尖峰的影响，每个tablet服务器实际上有两个日志写入线程，每个线程写入自己的日志文件；这两个线程中一次只有一个处于活动使用状态。如果对活动日志文件的写入性能不佳，则日志文件写入切换到另一个线程，并且提交日志队列中的变更操作由新激活的日志写入线程写入。日志条目包含序列号，以允许恢复过程消除由此日志切换过程导致的重复条目。

---

### 加速Tablet恢复

如果主服务器将tablet从一个tablet服务器移动到另一个tablet服务器，源tablet服务器首先对该tablet执行次要压实。此压实通过减少tablet服务器提交日志中未压实状态的数量来缩短恢复时间。完成此压实后，tablet服务器停止为该tablet提供服务。在实际卸载tablet之前，tablet服务器会执行另一次（通常非常快的）次要压实，以消除在第一次次要压实执行期间到达的tablet服务器日志中任何剩余的未压实状态。第二次次要压实完成后，可以在另一个tablet服务器上加载该tablet，而无需恢复任何日志条目。

---

### 利用不可变性

除了SSTable缓存之外，Bigtable系统的其他各个部分都因我们生成的所有SSTable都是不可变的这一事实而得到简化。例如，在从SSTable读取时，我们不需要对文件系统的访问进行任何同步。因此，对行的并发控制可以非常高效地实现。唯一同时被读取和写入访问的可变数据结构是内存表。为了减少在读取内存表期间的争用，我们使每个内存表行都采用写时复制，并允许读取和写入并行进行。

由于SSTable是不可变的，永久删除已删除数据的问题被转化为对过时SSTable的垃圾回收。每个tablet的SSTable都在METADATA表中注册。主服务器通过对SSTable集合进行标记-清除垃圾回收[25]来移除过时的SSTable，其中METADATA表包含根集合。

最后，SSTable的不可变性使我们能够快速拆分tablet。我们不是为每个子tablet生成一组新的SSTable，而是让子tablet共享父tablet的SSTable。

---

## 7 性能评估

我们搭建了一个包含 \(N\) 个tablet服务器的Bigtable集群，以测量Bigtable在 \(N\) 变化时的性能和可扩展性。Tablet服务器配置为使用1 GB内存，并写入一个由1786台机器组成的GFS存储单元，每台机器配有两个400 GB IDE硬盘。\(N\) 台客户端机器生成了用于这些测试的Bigtable负载。（我们使用与tablet服务器相同数量的客户端，以确保客户端永远不会成为瓶颈。）每台机器都有两个双核Opteron 2 GHz芯片，足够的内存来容纳所有运行进程的工作集，以及一个千兆以太网链路。这些机器布置在一个两级树形交换网络中，根部的总带宽约为100-200 Gbps。所有机器都位于同一托管设施中，因此任意两台机器之间的往返时间小于一毫秒。

Tablet服务器和主服务器、测试客户端以及GFS服务器都运行在同一组机器上。每台机器都运行一个GFS服务器。其中一些机器还运行tablet服务器、客户端进程，或来自其他作业的进程，这些作业在与这些实验同时使用该机器池。

\(R\) 是测试中涉及的Bigtable行键的不同数量。选择 \(R\) 是为了使每个基准测试在每个tablet服务器上读取或写入大约1 GB的数据。

顺序写入基准测试使用了名称为 0 到 \(R - 1\) 的行键。这个行键空间被划分为 \(10N\) 个大小相等的范围。这些范围由一个中央调度器分配给 \(N\) 个客户端，一旦客户端完成处理先前分配的范围，调度器就会分配下一个可用范围。这种动态分配有助于减轻客户端机器上运行的其他进程导致的性能变化的影响。我们在每个行键下写入一个字符串。每个字符串都是随机生成的，因此不可压缩。此外，不同行键下的字符串是不同的，因此不可能进行跨行压缩。随机写入基准测试类似，不同之处在于行键在写入前立即对 \(R\) 取模进行哈希处理，以便写入负载在基准测试的整个持续时间内大致均匀地分布在整个行空间上。

顺序读取基准测试以与顺序写入基准测试完全相同的方式生成行键，但不是写入行键，而是读取存储在该行键下的字符串（由先前调用的顺序写入基准测试写入）。类似地，随机读取基准测试模拟了随机写入基准测试的操作。

扫描基准测试类似于顺序读取基准测试，但使用Bigtable API提供的支持来扫描行范围内的所有值。使用扫描减少了基准测试执行的RPC数量，因为单个RPC从tablet服务器获取大量值序列。

随机读取（内存）基准测试类似于随机读取基准测试，但包含基准测试数据的局部性组被标记为驻留在内存中，因此读取从tablet服务器的内存中得到满足，而无需进行GFS读取。仅针对此基准测试，我们将每个tablet服务器的数据量从1 GB减少到100 MB，以便它能够舒适地容纳在tablet服务器可用的内存中。

图6展示了我们在向Bigtable读写1000字节值时基准测试性能的两个视图。表格显示了每个tablet服务器每秒的操作数；图表显示了每秒的总操作数。

<center>表格显示了每个tablet服务器的速率；图表显示了总速率。</center>

---

### 单Tablet服务器性能

让我们首先考虑只有一个tablet服务器时的性能。随机读取比所有其他操作慢一个数量级或更多。每次随机读取涉及通过网络从GFS向tablet服务器传输一个64 KB的SSTable块，其中仅使用一个1000字节的值。Tablet服务器每秒执行大约1200次读取，这相当于从GFS读取大约75 MB/s的数据。由于网络栈、SSTable解析和Bigtable代码的开销，这个带宽足以使tablet服务器的CPU饱和，并且也几乎足以使我们系统中使用的网络链路饱和。大多数具有这种访问模式的Bigtable应用将块大小减小到更小的值，通常是8KB。

从内存中随机读取要快得多，因为每次1000字节的读取都是从tablet服务器的本地内存中满足的，而无需从GFS获取大的64 KB块。

随机和顺序写入的性能优于随机读取，因为每个tablet服务器将所有传入写入附加到一个提交日志中，并使用组提交将这些写入高效地流式传输到GFS。随机写入和顺序写入的性能之间没有显著差异；在这两种情况下，对tablet服务器的所有写入都记录在同一个提交日志中。

顺序读取的性能优于随机读取，因为从GFS获取的每个64 KB SSTable块都存储到我们的块缓存中，在缓存中它被用来服务接下来的64个读取请求。

扫描甚至更快，因为tablet服务器可以在单个客户端RPC的响应中返回大量值，因此RPC开销分摊到大量值上。

---

### 扩展性

随着系统中tablet服务器的数量从1增加到500，总吞吐量急剧增加，增长超过一百倍。例如，随着tablet服务器数量增加500倍，

---

表1：Bigtable集群中tablet服务器数量的分布。

<table>
<tr><td>Tablet服务器数量</td><td>集群数量</td></tr>
<tr><td>0</td><td>19</td></tr>
<tr><td>20</td><td>49</td></tr>
<tr><td>50</td><td>99</td></tr>
<tr><td>100</td><td>499</td></tr>
<tr><td>&gt; 500</td><td>12</td></tr>
</table>

内存随机读取的性能随着tablet服务器数量增加500倍而提高了近300倍。发生这种行为是因为此基准测试的性能瓶颈是单个tablet服务器的CPU。

然而，性能并不是线性增加的。对于大多数基准测试，当从1个tablet服务器增加到50个时，每台服务器的吞吐量显著下降。这种下降是由于多服务器配置中的负载不平衡造成的，通常是由于其他进程争用CPU和网络。我们的负载均衡算法试图处理这种不平衡，但不能做到完美，主要有两个原因：重新平衡被限制以减少tablet的移动次数（移动时tablet在短时间内不可用，通常少于一秒），并且我们的基准测试生成的负载会随着基准测试的进行而转移。

随机读取基准测试显示出最差的扩展性（服务器数量增加500倍，总吞吐量仅增加100倍）。发生这种行为是因为（如上所述）我们为每次1000字节的读取传输一个大的64KB块。这种传输使网络中各种共享的千兆链路饱和，因此随着机器数量的增加，每台服务器的吞吐量显著下降。

---

## 8 实际应用

截至2006年8月，在不同的Google机器集群中运行着388个非测试Bigtable集群，总共约有24,500个tablet服务器。表1显示了每个集群中tablet服务器的大致分布。其中许多集群用于开发目的，因此在相当长的时间内处于空闲状态。一组由14个繁忙集群组成的集群，总共有8069个tablet服务器，其总请求量超过每秒120万次，传入RPC流量约为741 MB/s，传出RPC流量约为16 GB/s。

[文本[115, 842, 483, 902], [512, 91, 880, 136]]

表2提供了当前正在使用的一些表的数据。一些表存储提供给用户的数据，而另一些表存储用于批处理的数据；这些表在总大小、平均单元格大小、从内存提供数据的百分比以及表模式的复杂性方面差异很大。在本节的其余部分，我们将简要描述三个产品团队如何使用Bigtable。

---

### 8.1 Google Analytics

Google Analytics (analytics.google.com) 是一项帮助网站管理员分析其网站流量模式的服务。它提供聚合统计数据，如每日独立访客数和每日每URL页面浏览量，以及网站跟踪报告，如给定用户之前查看过特定页面后做出购买行为的用户百分比。

为了启用该服务，网站管理员在其网页中嵌入一个小型JavaScript程序。每当页面被访问时，该程序就会被调用。它记录有关Google Analytics中请求的各种信息，例如用户标识符和有关正在获取的页面的信息。Google Analytics汇总这些数据并将其提供给网站管理员。

我们简要描述Google Analytics使用的两个表。原始点击表（200 TB）为每个最终用户会话维护一行。行名是一个包含网站名称和会话创建时间的元组。这种模式确保访问同一网站的会话是连续的，并且按时间顺序排序。该表压缩后为其原始大小的 \(14\%\)。

汇总表（20 TB）包含每个网站的各类预定义汇总。此表由定期调度的MapReduce作业从原始点击表生成。每个MapReduce作业从原始点击表中提取最近的会话数据。整个系统的吞吐量受限于GFS的吞吐量。该表压缩后为其原始大小的 \(29\%\)。

---

### 8.2 Google Earth

Google运营着一系列服务，通过基于Web的Google Maps界面 (maps.google.com) 和Google Earth (earth.google.com) 自定义客户端软件，为用户提供访问世界表面高分辨率卫星图像的能力。这些产品允许用户在世界表面上导航：他们可以平移、查看和标注不同分辨率级别的卫星图像。该系统使用一个表来预处理数据，并使用一组不同的表来服务客户端数据。

预处理管道使用一个表来存储原始图像。在预处理期间，图像被清理并合并为最终的服务数据。该表包含大约70 TB的数据，因此从磁盘提供服务。图像已经被有效压缩，因此禁用了Bigtable压缩。

---

表2：生产环境中使用的几个表的特征。表大小（压缩前测量）和单元格数量表示近似大小。对于禁用压缩的表，不给出压缩比。

图像表中的每一行对应于一个单独的地理区域。行的命名方式确保相邻的地理区域存储在一起。该表包含一个列族来跟踪每个区域的数据来源。此列族有大量的列：基本上每个原始数据图像对应一列。由于每个区域仅由少数图像构建，因此此列族非常稀疏。

预处理管道在很大程度上依赖于在Bigtable上运行的MapReduce来转换数据。在某些MapReduce作业期间，整个系统每个tablet服务器处理超过1 MB/s的数据。

服务系统使用一个表来索引存储在GFS中的数据。该表相对较小（500 GB），但必须能够在每个数据中心以低延迟每秒处理数万次查询。因此，该表托管在数百个tablet服务器上，并包含内存列族。

---

### 8.3 个性化搜索

个性化搜索 (www.google.com/psearch) 是一项可选加入的服务，记录用户在Google各种属性（如网页搜索、图片和新闻）上的查询和点击。用户可以浏览其搜索历史以重新访问旧的查询和点击，并且可以根据其历史Google使用模式请求个性化搜索结果。

个性化搜索将每个用户的数据存储在Bigtable中。每个用户都有一个唯一的userid，并被分配一个以该userid命名的行。所有用户操作都存储在一个表中。为每种类型的操作保留一个单独的列族（例如，有一个列族存储所有网页查询）。每个数据元素使用相应用户操作发生的时间作为其Bigtable时间戳。个性化搜索使用基于Bigtable的MapReduce生成用户配置文件。这些用户配置文件用于个性化实时搜索结果。

个性化搜索数据跨多个Bigtable集群复制，以提高可用性并减少因距离客户端较远而产生的延迟。个性化搜索团队最初在Bigtable之上构建了一个客户端复制机制，以确保所有副本的最终一致性。当前系统现在使用内置于服务器中的复制子系统。

个性化搜索存储系统的设计允许其他组在其自己的列中添加新的每用户信息，该系统现在被许多其他需要存储每用户配置选项和设置的Google属性使用。在许多组之间共享一个表导致了异常大量的列族。为了帮助支持共享，我们在Bigtable中添加了一个简单的配额机制，以限制任何特定客户端在共享表中的存储消耗；该机制为使用此系统存储每用户信息的各个产品组之间提供了一些隔离。

---

## 9 经验教训

在设计、实现、维护和支持Bigtable的过程中，我们获得了有用的经验并学到了一些有趣的教训。

我们学到的一个教训是，大型分布式系统容易受到多种类型的故障影响，而不仅仅是许多分布式协议中假设的标准网络分区和故障-停止故障。例如，我们曾看到由以下所有原因引起的问题：内存和网络损坏、大的时钟偏差、机器挂起、长时间且不对称的网络分区、我们使用的其他系统（例如Chubby）中的错误、GFS配额溢出，以及计划内和计划外的硬件维护。随着我们对这些问题获得了更多经验，我们通过更改各种协议来解决它们。例如，我们在RPC机制中添加了校验和。我们还通过

---

消除系统某一部分对另一部分的假设来处理一些问题。例如，我们不再假设给定的Chubby操作只能返回一组固定错误中的一个。

我们学到的另一个教训是，在明确新功能将如何被使用之前，延迟添加新功能是很重要的。例如，我们最初计划在我们的API中支持通用事务。然而，由于我们没有立即使用它们的需求，我们没有实现它们。现在我们在Bigtable上运行了许多实际应用程序，我们已经能够检查它们的实际需求，并发现大多数应用程序只需要单行事务。在人们要求分布式事务的地方，最重要的用途是维护二级索引，我们计划添加一种专门的机制来满足这一需求。新机制将不如分布式事务通用，但会更高效（特别是对于跨越数百行或更多行的更新），并且还将与我们乐观跨数据中心复制方案更好地交互。

我们从支持Bigtable中学到的一个实际教训是，适当的系统级监控（即，同时监控Bigtable本身以及使用Bigtable的客户端进程）的重要性。例如，我们扩展了我们的RPC系统，以便对于RPC的样本，它保留了代表该RPC执行的重要操作的详细跟踪。此功能使我们能够检测并修复许多问题，例如tablet数据结构上的锁争用、提交Bigtable变更操作时对GFS的慢写入，以及在METADATA tablet不可用时对METADATA表的卡住访问。另一个有用的监控示例是，每个Bigtable集群都在Chubby中注册。这使我们能够跟踪所有集群，发现它们有多大，查看它们正在运行我们软件的哪个版本，它们接收了多少流量，以及是否存在任何问题，例如意外的大延迟。

我们学到的最重要的教训是简单设计的价值。考虑到我们系统的规模（大约100,000行非测试代码），以及代码随时间以意想不到的方式演变的事实，我们发现代码和设计清晰度对代码维护和调试非常有帮助。这方面的一个例子是我们的tablet服务器成员协议。我们的第一个协议很简单：主服务器定期向tablet服务器发放租约，如果租约过期，tablet服务器会终止自身。不幸的是，此协议在网络问题存在时显著降低了可用性，并且对主服务器恢复时间也很敏感。我们多次重新设计了该协议，直到我们拥有一个性能良好的协议。然而，由此产生的协议过于复杂，并且依赖于Chubby功能的行为，而这些功能很少被其他应用程序使用。我们发现我们花费了大量时间调试晦涩的边缘情况，不仅在Bigtable代码中，也在Chubby代码中。最终，我们废弃了这个协议，转而采用一个更新更简单的协议，该协议仅依赖于广泛使用的Chubby功能。

---

## 10 相关工作

Boxwood项目[24]的组件在某些方面与Chubby、GFS和Bigtable重叠，因为它提供了分布式协商、锁定、分布式块存储和分布式B树存储。在存在重叠的每种情况下，Boxwood的组件似乎都针对比相应Google服务更低级别的层次。Boxwood项目的目标是提供构建更高级别服务（如文件系统或数据库）的基础设施，而Bigtable的目标是直接支持希望存储数据的客户端应用程序。

许多最近的项目已经解决了在广域网上提供分布式存储或更高级别服务的问题，通常是在“互联网规模”上。这包括从CAN [29]、Chord [32]、Tapestry [37]和Pastry [30]等项目开始的分布式哈希表工作。这些系统解决了Bigtable不会出现的问题，例如高度可变的带宽、不受信任的参与者或频繁的重新配置；去中心化控制和拜占庭容错不是Bigtable的目标。

就应用程序开发人员可能获得的分布式数据存储模型而言，我们认为分布式B树或分布式哈希表提供的键值对模型过于局限。键值对是一个有用的构建块，但它不应该是提供给开发人员的唯一构建块。我们选择的模型比简单的键值对更丰富，并支持稀疏的半结构化数据。尽管如此，它仍然足够简单，适用于非常高效的平面文件表示，并且它足够透明（通过局部性组），允许我们的用户调整系统的重要行为。

一些数据库供应商已经开发了可以存储大量数据的并行数据库。Oracle的Real Application Cluster数据库[27]使用共享磁盘存储数据（Bigtable使用GFS）和分布式锁管理器（Bigtable使用Chubby）。IBM的DB2并行版[4]基于类似于Bigtable的无共享[33]架构。每个DB2服务器负责表中行的子集，并将其存储在本地关系数据库中。这两个产品都提供了带有事务的完整关系模型。

---

Bigtable局部性组实现了类似于其他系统的压缩和磁盘读取性能优势，这些系统使用基于列而非行的存储方式在磁盘上组织数据，包括C-Store [1, 34]和商业产品如Sybase IQ [15, 36]、SenSage [31]、KDB+ [22]以及MonetDB/X100 [38]中的ColumnBM存储层。另一个将数据垂直和水平分区到平面文件中并实现良好数据压缩比的系统是AT&T的Daytona数据库[19]。局部性组不支持CPU缓存级别的优化，例如Ailamaki [2]所描述的。

Bigtable使用内存表和SSTable存储tablet更新的方式类似于日志结构合并树（Log-Structured Merge Tree）[26]存储索引数据更新的方式。在这两个系统中，排序数据在被写入磁盘之前在内存中缓冲，读取必须合并来自内存和磁盘的数据。

C-Store和Bigtable有许多共同特征：两个系统都使用无共享架构，并有两种不同的数据结构，一种用于最近的写入，一种用于存储长期数据，并具有将数据从一种形式移动到另一种形式的机制。这两个系统在API方面有显著不同：C-Store的行为类似于关系数据库，而Bigtable提供更低级别的读写接口，并旨在支持每台服务器每秒数千次这样的操作。C-Store也是一个“读优化的关系型DBMS”，而Bigtable在读取密集型和写入密集型应用中都提供了良好的性能。

Bigtable的负载均衡器需要解决与无共享数据库（例如[11, 35]）面临的相同类型的负载和内存平衡问题。我们的问题稍微简单一些：（1）我们不考虑同一数据的多个副本的可能性，可能由于视图或索引而采用替代形式；（2）我们让用户告诉我们哪些数据属于内存，哪些数据应该保留在磁盘上，而不是试图动态确定这一点；（3）我们没有需要执行或优化的复杂查询。

---

## 11 结论

我们描述了Bigtable，一个在Google用于存储结构化数据的分布式系统。Bigtable集群自2005年4月起投入生产使用，在此之前我们花费了大约七人年的设计和实现时间。截至2006年8月，有六十多个项目正在使用Bigtable。我们的用户喜欢Bigtable实现提供的高性能和高可用性，并且他们可以根据资源需求随时间的变化，通过简单地向系统添加更多机器来扩展其集群的容量。

鉴于Bigtable不寻常的接口，一个有趣的问题是我们的用户适应使用它有多困难。新用户有时不确定如何最好地使用Bigtable接口，特别是如果他们习惯于使用支持通用事务的关系数据库。然而，许多Google产品成功使用Bigtable这一事实表明我们的设计在实践中运行良好。

我们正在实现几个额外的Bigtable功能，例如支持二级索引和用于构建具有多个主副本的跨数据中心复制Bigtable的基础设施。我们也已经开始将Bigtable作为一种服务部署给产品组，以便各个组无需维护自己的集群。随着我们的服务集群扩展，我们将需要处理Bigtable内部更多的资源共享问题[3, 5]。

最后，我们发现在Google构建我们自己的存储解决方案有显著优势。通过为Bigtable设计我们自己的数据模型，我们获得了很大的灵活性。此外，我们对Bigtable实现及其所依赖的其他Google基础设施的控制意味着我们可以随着瓶颈和低效的出现而消除它们。

---

## 致谢

我们感谢匿名审稿人、David Nagle以及我们的导师Brad Calder对本论文的反馈。Bigtable系统大大受益于我们在Google的众多用户的反馈。此外，我们感谢以下人员对Bigtable的贡献：Dan Aguayo, Sameer Ajmani, Zhifeng Chen, Bill Coughran, Mike Epstein, Healfdene Goguen, Robert Griesemer, Jeremy Hylton, Josh Hyman, Alex Khesin, Joanna Kulik, Alberto Lerner, Sherry Listgarten, Mike Maloney, Eduardo Pinheiro, Kathy Polizzi, Frank Yellin, 和 Arthur Zwieginecw。

---

## 参考文献

[1] ABADI, D. J., MADDEN, S. R., AND FERREIRA, M. C. Integrating compression and execution in column-oriented database systems. Proc. of SIGMOD (2006).
[2] AILAMAKI, A., DEWITT, D. J., HILL, M. D., AND SKOUNAKIS, M. Weaving relations for cache performance. In The VLDB Journal (2001), pp. 169-180.
[3] BANGA, G., DRUSCHEL, P., AND MOGUL, J. C. Resource containers: A new facility for resource management in server systems. In Proc. of the 3rd OSDI (Feb. 1999), pp. 45-58.
[4] BARU, C. K., FECTEAU, G., GOYAL, A., HSIAO, H., JHINGRAN, A., PADMANABHAN, S., COPELAND, G. P. AND WILSON, W. G. DB2 parallel edition. IBM Systems Journal 34, 2 (1995), 292-322.
[5] BAVIER, A., BOWMAN, M., CHUN, B., CULLER, D., KARLIN, S., PETERSON, L., ROSCOE, T., SPALINK, T., AND WAWRZONIAK, M. Operating system support for planetary-scale network services. In Proc. of the 1st NSDI (Mar. 2004), pp. 253-266.
[6] BENTLEY, J. L. AND MCILROY, M. D. Data compression using long common strings. In Data Compression Conference (1999), pp. 287-295.
[7] BLOOM, B. H. Space/time trade-offs in hash coding with allowable errors. CACM 13, 7 (1970), 422-426.
[8] BURROWS, M. The Chubby lock service for loosely-coupled distributed systems. In Proc. of the 7th OSDI (Nov. 2006).
[9] CHANDRA, T., GRIESEMER, R., AND REDSTONE, J. Paxos made live - An engineering perspective. In Proc. of PODC (2007).
[10] COMER, D. Ubiquitous B-tree. Computing Surveys 11, 2 (June 1979), 121-137.
[11] COPELAND, G. P., ALEXANDER, W., BOUGHTER, E. E., AND KELLER, T. W. Data placement in Bubba. In Proc. of SIGMOD (1988), pp. 99-108.
[12] DEAN, J. AND GHEMAWAT, S. MapReduce: Simplified data processing on large clusters. In Proc. of the 6th OSDI (Dec. 2004), pp. 137-150.
[13] DEWITT, D., KATZ, R., OLKEN, F., SHAPIRO, L., STONEBRAKER, M., AND WOOD, D. Implementation techniques for main memory database systems. In Proc. of SIGMOD (June 1984), pp. 1-8.
[14] DEWITT, D. J. AND GRAY, J. Parallel database systems: The future of high performance database systems. CACM 35, 6 (June 1992), 85-98.
[15] FRENCH, C. D. One size fits all database architectures do not work for DSS. In Proc. of SIGMOD (May 1995), pp. 449-450.
[16] GAWLICK, D. AND KINKADE, D. Varieties of concurrency control in IMS/VS fast path. Database Engineering Bulletin 8, 2 (1985), 3-10.
[17] GHEMAWAT, S., GOBIOFF, H., AND LEUNG, S.-T. The Google file system. In Proc. of the 19th ACM SOSP (Dec. 2003), pp. 29-43.
[18] GRAY, J. Notes on database operating systems. In Operating Systems - An Advanced Course, vol. 60 of Lecture Notes in Computer Science. Springer-Verlag, 1978.
[19] GREER, R. Daytona and the fourth-generation language Cymbal. In Proc. of SIGMOD (1999), pp. 525-526.
[20] HAGMANN, R. Reimplementing the Cedar file system using logging and group commit. In Proc. of the 11th SOSP (Dec. 1987), pp. 155-162.
[21] HARTMAN, J. H. AND OUSTERHOUT, J. K. The Zebra striped network file system. In Proc. of the 14th SOSP (Asheville, NC, 1993), pp. 29-43.
[22] KX.COM. kx.com/products/database.php. Product page.
[23] LAMPORT, L. The part-time parliament. ACM TOCS 16, 2 (1998), 133-169.
[24] MACCOMRICK, J., MURPHY, N., NAJORK, M., THEKKATH, C. A., AND ZHOU, L. Boxwood: Abstractions as the foundation for storage infrastructure. In Proc. of the 6th OSDI (Dec. 2004), pp. 105-120.
[25] MCCARTHY, J. Recursive functions of symbolic expressions and their computation by machine. CACM 3, 4 (Apr. 1960), 184-195.
[26] O'NEIL, P., CHENG, E., GAWLICK, D., AND O'NEIL, E. The log-structured merge-tree (LSM-tree). Acta Inf. 33, 4 (1996), 351-385.
[27] ORACLE.COM. www.oracle.com/technology/products/database/clustering/index.html. Product page.
[28] PIKE, R., DORWARD, S., GRIESEMER, R., AND QUINLAN, S. Interpreting the data: Parallel analysis with Sawzall. Scientific Programming Journal 13, 4 (2005), 227-298.
[29] RATNASAMY, S., FRANCIS, P., HANDLEY, M., KARP, R., AND SHENKER, S. A scalable content-addressable network. In Proc. of SIGCOMM (Aug. 2001), pp. 161-172.
[30] ROWSTRON, A. AND DRUSCHEL, P. Pastry: Scalable, distributed object location and routing for large-scale peer-to-peer systems. In Proc. of Middleware 2001 (Nov. 2001), pp. 329-350.
[31] SENSAGE.COM. sensage.com/products-sensage.htm. Product page.
[32] STOICA, I., MORRIS, R., KARGER, D., KAASHOEK, M. F., AND BALAKRISHNAN, H. Chord: A scalable peer-to-peer lookup service for Internet applications. In Proc. of SIGCOMM (Aug. 2001), pp. 149-160.
[33] STONEBRAKER, M. The case for shared nothing. Database Engineering Bulletin 9, 1 (Mar. 1986), 4-9.
[34] STONEBRAKER, M., ABADI, D. J., BATKIN, A., CHEN, X., CHERNIACK, M., FERREIRA, M., LAU, E., LIN, A., MADDEN, S., O'NEIL, E., O'NEIL, P., RASIN, A., TRAN, N., AND ZDONIK, S. C-Store: A column-oriented DBMS. In Proc. of VLDB (Aug. 2005), pp. 553-564.
[35] STONEBRAKER, M., AOKI, P. M., DEVINE, R., LITWIN, W., AND OLSON, M. A. Mariposa: A new architecture for distributed data. In Proc. of the Tenth ICDE (1994), IEEE Computer Society, pp. 54-65.
[36] SYBASE.COM. www.sybase.com/products/database-servers/sybaseiq. Product page.
[37] ZHAO, B. Y., KUBIATOWICZ, J., AND JOSEPH, A. D. Tapestry: An infrastructure for fault-tolerant wide-area location and routing. Tech. Rep. UCB/CSD-01-1141, CS Division, UC Berkeley, Apr. 2001.
[38] ZUKOWSKI, M., BONCZ, P. A., NES, N., AND HEMAN, S. MonetDB/X100 - A DBMS in the CPU cache. IEEE Data Eng. Bull. 28, 2 (2005), 17-22.
