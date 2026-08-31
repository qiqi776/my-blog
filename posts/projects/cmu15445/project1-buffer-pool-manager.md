---
title: CMU 15-445 Project 1：Buffer Pool Manager
date: 2026-03-16
order: 2
---

# CMU 15-445 Project 1：Buffer Pool Manager

## Task 1：自适应替换缓存（ARC）替换策略

### ARC 简介

ARC（Adaptive Replacement Cache）是一种缓存替换算法。相比传统的 LRU，ARC 在很多负载下通常表现更好，而实现复杂度和时间复杂度又与 LRU 接近，ARC 的主要优点有：

- 能在 recency（最近访问）和 frequency（访问频率）之间动态、自适应地平衡
- 不需要预先指定复杂参数
- 对不同工作负载具有较强的普适性
- 对顺序扫描这类模式有一定抵抗能力

LRU 只考虑最近是否访问，不考虑是否被多次访问过，这会带来一些问题。某些被频繁访问的热点数据会因为近期没有访问而被刷新掉。因此，仅靠 recency 往往不够，还需要某种方式近似捕获 frequency。

#### 核心思想

用两个 LRU 链表来近似同时维护 recency 和 frequency。

- `T1`：最近访问过一次的缓存页
- `T2`：最近访问过两次及以上的缓存页
- `B1`：`T1` 的 ghost list，记录最近从 `T1` 淘汰出去的页
- `B2`：`T2` 的 ghost list，记录最近从 `T2` 淘汰出去的页

可以把 ARC 拆成两层理解：

- **Cache Item**：真正在缓存中的内容，对应 `T1 + T2`
- **Cache Directory**：用于索引，记录缓存和历史信息的目录项，对应 `T1 + T2 + B1 + B2`

若缓存容量为 `c`，最终目标是维持：`|T1| + |T2| = c`与 `|T1| + |T2| + |B1| + |B2| <= 2c`

也就是说，真正驻留内存的数据最多是 `c`，但 ARC 会额外保留最多 `c` 个历史目录项。

#### 自适应参数

ARC 用一个参数 `p` 表示对 `T1` 的目标大小，`T1` 的目标大小为 `p`，`T2` 的目标大小为 `c - p`，这里的 `p` 不是固定值，而是动态变化的。

- `p` 大，说明系统更偏向 recency
- `p` 小，说明系统更偏向 frequency

#### 为什么需要 ghost list

`B1` 和 `B2` 的作用是告诉系统：最近淘汰掉的页，后来有没有很快又被访问到？

如果一个页命中 `B1`，则它原本属于“最近访问一次”的那类页，但我们把它淘汰后，它很快又回来了，说明 `T1` 可能太小了，因此应该增大 `p`

如果一个页命中 `B2`，则它原本属于“访问多次”的热点页，但我们还是把它淘汰了，说明 `T2` 可能太小了，因此应该减小 `p`

所以本质上是在给 ARC 提供一种反馈信号

#### 基本工作流程

一次访问通常分为四种情况：

- **命中 `T1` 或 `T2`**：说明缓存命中，该页移动到 `T2` 的头部。
- **命中 `B1`**：说明最近访问型页被淘汰得太快，增大 `p`，然后把该页重新放入 `T2`。
- **命中 `B2`**：说明高频页被淘汰得太快，减小 `p`，然后把该页重新放入 `T2`。
- **四个表都没命中**：说明是一个全新的页，将其放入 `T1`。

这样一来，新页先进入 `T1`，真正被再次访问的页进入 `T2`，被淘汰后又重新访问到的页，也会被快速提升到 `T2`。

#### 该算法的一些疑问与总结

从直觉上看，ARC 的自适应策略是有效的，但一些细节并没有被非常严格地论证，例如：

- 为什么 `p` 的调整量要设计成那样，而不是固定增减 1
- 为什么这种动态平衡一定优于其他可能的平衡方式
- 是否引入更多历史信息会进一步提升效果

这些问题论文中有讨论，但论证更多偏经验性，而不是完全形式化的最优性证明。

总的来说，ARC 可以看成是在 LRU 基础上的一次重要增强：

- 用两个 LRU 链表近似同时维护 recency 和 frequency
- 用两个 ghost list 记录最近淘汰历史
- 用参数 `p` 动态调整两类数据的空间分配

因此，ARC 在不显著增加实现成本的前提下，通常能比 LRU 更稳定、更智能地适应不同负载，尤其是在工作负载变化较大或存在扫描模式时，优势会更加明显

### 代码实现

#### `RecordAccess()`

记录一次访问，并把页放到 ARC 认为合适的位置

```cpp
void ArcReplacer::RecordAccess(frame_id_t frame_id, page_id_t page_id, [[maybe_unused]] AccessType access_type) {
    // 断言检查frame_id合法性，加锁
    BUSTUB_ASSERT(frame_id >= 0 && static_cast<size_t>(frame_id) <= replacer_size_, "invalid frame id");
    std::scoped_lock lock(latch_);

    // 情况1：命中live页
    auto it = alive_map_.find(frame_id);
    if (it != alive_map_.end()) {
        // 查frame_id 找到说明页在缓存中
        auto entry = it->second;
        BUSTUB_ASSERT(entry->page_id_ == page_id, "frame is already associated with a different page");
        // 断言frame_id现在对应的是同一个page_id
        auto pos = alive_pos_.find(frame_id);
        BUSTUB_ASSERT(pos != alive_pos_.end(), "missing alive position");

        // 根据entry当前在MRU还是MFU，从原链表中删除
        if (entry->arc_status_ == ArcStatus::MRU) {
            mru_.erase(pos->second);
        } else if (entry->arc_status_ == ArcStatus::MFU) {
            mfu_.erase(pos->second);
        } else {
            BUSTUB_ASSERT(false, "alive entry must be in MRU or MFU");
        }

        // 统一插到mfu_头部，将状态改成MFU
        mfu_.push_front(frame_id);
        alive_pos_[frame_id] = mfu_.begin();
        entry->arc_status_ = ArcStatus::MFU;
        return;
    }

    auto ghost_it = ghost_map_.find(page_id);
    if (ghost_it != ghost_map_.end()) {
        auto entry = ghost_it->second;
        auto ghost_pos_it = ghost_pos_.find(page_id);
        BUSTUB_ASSERT(ghost_pos_it != ghost_pos_.end(), "missing ghost position");

        // 情况2：页已经被淘汰，但其之前属于“最近访问一次”
        if (entry->arc_status_ == ArcStatus::MRU_GHOST) {
            size_t delta = 1;
            // 调整参数p 默认加1
            if (mru_ghost_.size() < mfu_ghost_.size()) {
                // 如果满足，则按|MFU_GHOST| / |MRU_GHOST| 增加
                delta = mfu_ghost_.size() / mru_ghost_.size();
            }
            // 限制不超过总容量，将该页删除
            mru_target_size_ = std::min(replacer_size_, mru_target_size_ + delta);
            mru_ghost_.erase(ghost_pos_it->second);
        } else if (entry->arc_status_ == ArcStatus::MFU_GHOST) {
            // 情况3：页已经被淘汰，但其之前属于“高频访问页”
            size_t delta = 1;
            // 默认减1，按规则进行调整
            if (mfu_ghost_.size() < mru_ghost_.size()) {
                delta = mru_ghost_.size() / mfu_ghost_.size();
            }
            if (delta > mru_target_size_) {
                mru_target_size_ = 0;
                // 最小减到0
            } else {
                mru_target_size_ -= delta;
            }
            mfu_ghost_.erase(ghost_pos_it->second);
        } else {
            BUSTUB_ASSERT(false, "ghost entry must be in MRU_GHOST or MFU_GHOST");
        }
        // 将该页从mfu_ghost_和ghost索引中删掉
        ghost_pos_.erase(page_id);
        ghost_map_.erase(ghost_it);

        // 将该页作为新live条目查到mfu_表头，因为“被淘汰后又被访问”本身就说明它不是一次性页
        auto new_entry = std::make_shared<FrameStatus>(page_id, frame_id, false, ArcStatus::MFU);
        mfu_.push_front(frame_id);
        alive_map_[frame_id] = new_entry;
        alive_pos_[frame_id] = mfu_.begin();
        return;
    }

    // 情况4：四个列表都未命中，说明这是一个新页
    size_t mru_side_size = mru_.size() + mru_ghost_.size();
    size_t total = mru_.size() + mfu_.size() + mru_ghost_.size() + mfu_ghost_.size();

    // 需要先检查ghost是否需要裁剪
    if (mru_side_size == replacer_size_) {
        // MRU 已经占满了 ARC 允许的半边空间，需要删除mru_ghost_的表尾
        BUSTUB_ASSERT(!mru_ghost_.empty(), "mru ghost should not be empty when mru side is full");
        page_id_t victim_page_id = mru_ghost_.back();
        mru_ghost_.pop_back();
        ghost_pos_.erase(victim_page_id);
        ghost_map_.erase(victim_page_id);
    } else if (mru_side_size < replacer_size_ && total == 2 * replacer_size_) {
        // 四张表已经达到上限 2c，需要删除mfu_ghost的表尾
        BUSTUB_ASSERT(!mfu_ghost_.empty(), "mfu ghost should not be empty when total size reaches 2c");
        page_id_t victim_page_id = mfu_ghost_.back();
        mfu_ghost_.pop_back();
        ghost_pos_.erase(victim_page_id);
        ghost_map_.erase(victim_page_id);
    }

    // 创建一个新的 live 条目，插入 mru_ 表头
    // 新条目的 evictable_ 被设成 false
    auto new_entry = std::make_shared<FrameStatus>(page_id, frame_id, false, ArcStatus::MRU);
    mru_.push_front(frame_id);
    alive_map_[frame_id] = new_entry;
    alive_pos_[frame_id] = mru_.begin();
}

```

#### `Evict()`

按 ARC 规则，从当前可淘汰的 live 页里选一个 victim，并把它移到对应 ghost list

```cpp
auto ArcReplacer::Evict() -> std::optional<frame_id_t> {
  // 加锁
  std::scoped_lock lock(latch_);

  // 如果当前没有任何可淘汰的 frame，直接返回空
  if (curr_size_ == 0) {
    return std::nullopt;
  }

  auto evict_from = [&](std::list<frame_id_t> &live_list, ArcStatus from_status,
                        ArcStatus ghost_status) -> std::optional<frame_id_t> {
    // 从链表尾部向前遍历，因为表尾表示最老的页
    for (auto it = live_list.rbegin(); it != live_list.rend(); ++it) {
      frame_id_t victim_frame_id = *it;

      // 根据 victim_frame_id 找到其 live 元信息
      auto alive_it = alive_map_.find(victim_frame_id);
      BUSTUB_ASSERT(alive_it != alive_map_.end(), "frame in list missing from alive_map_");

      auto entry = alive_it->second;
      // 断言当前条目的状态和目标链表一致
      BUSTUB_ASSERT(entry->arc_status_ == from_status, "frame status does not match live list");

      // 如果该页当前不可淘汰，则跳过，继续寻找更早的候选页
      if (!entry->evictable_) {
        continue;
      }

      page_id_t victim_page_id = entry->page_id_;
      // 断言该页尚未出现在 ghost list 中，避免重复记录
      BUSTUB_ASSERT(ghost_map_.find(victim_page_id) == ghost_map_.end(), "page already exists in ghost list");

      // 找到该 frame 在 live 链表中的位置
      auto pos = alive_pos_.find(victim_frame_id);
      BUSTUB_ASSERT(pos != alive_pos_.end(), "frame in alive_map_ missing from alive_pos_");

      // 将该页从 live 链表和 live 索引中删除
      live_list.erase(pos->second);
      alive_pos_.erase(pos);
      alive_map_.erase(alive_it);

      // 将该条目转化为 ghost 条目
      entry->frame_id_ = INVALID_FRAME_ID;
      entry->evictable_ = false;
      entry->arc_status_ = ghost_status;

      // 根据原来来自 MRU 还是 MFU，将 page_id 插入对应 ghost 链表头部
      if (ghost_status == ArcStatus::MRU_GHOST) {
        mru_ghost_.push_front(victim_page_id);
        ghost_pos_[victim_page_id] = mru_ghost_.begin();
      } else {
        BUSTUB_ASSERT(ghost_status == ArcStatus::MFU_GHOST, "invalid ghost status");
        mfu_ghost_.push_front(victim_page_id);
        ghost_pos_[victim_page_id] = mfu_ghost_.begin();
      }

      // 在 ghost_map_ 中登记这条历史记录
      ghost_map_[victim_page_id] = entry;
      // 可淘汰页数量减 1
      curr_size_--;
      // 返回被淘汰的 frame_id
      return victim_frame_id;
    }

    // 如果这一侧没有找到任何可淘汰的页，则返回空
    return std::nullopt;
  };

  // 如果当前 MRU 实际大小大于等于目标大小，优先从 MRU 淘汰
  if (mru_.size() >= mru_target_size_) {
    if (auto victim = evict_from(mru_, ArcStatus::MRU, ArcStatus::MRU_GHOST); victim.has_value()) {
      return victim;
    }
    // 如果 MRU 一侧没有可淘汰页，则退而求其次，从 MFU 淘汰
    return evict_from(mfu_, ArcStatus::MFU, ArcStatus::MFU_GHOST);
  }

  // 如果当前 MRU 实际大小小于目标大小，优先从 MFU 淘汰
  if (auto victim = evict_from(mfu_, ArcStatus::MFU, ArcStatus::MFU_GHOST); victim.has_value()) {
    return victim;
  }
  // 如果 MFU 一侧没有可淘汰页，则尝试从 MRU 淘汰
  return evict_from(mru_, ArcStatus::MRU, ArcStatus::MRU_GHOST);
}
```

#### `SetEvictable()`

`SetEvictable()` 负责修改某个 live frame 当前能不能被淘汰。

在 buffer pool 里，页被访问时通常会被 pin 住，被 pin 的页不能淘汰。当 pin count 下降到 0 时，这个 frame 才重新变成可淘汰，所以 ARC 不光要知道页处在哪个队列，还要知道这个候选页现在有没有资格被赶出去。

```cpp
void ArcReplacer::SetEvictable(frame_id_t frame_id, bool set_evictable) {
  BUSTUB_ASSERT(frame_id >= 0 && static_cast<size_t>(frame_id) <= replacer_size_, "invalid frame id");
  std::scoped_lock lock(latch_);

  auto it = alive_map_.find(frame_id);
  if (it == alive_map_.end()) {
    return;
  }

  if (it->second->evictable_ == set_evictable) {
    return;
  }

  it->second->evictable_ = set_evictable;
  if (set_evictable) {
    curr_size_++;
  } else {
    curr_size_--;
  }
}
```

#### `Remove()`

外部指定直接删掉某个 frame。

```cpp
void ArcReplacer::Remove(frame_id_t frame_id) {
  // 加锁
  std::scoped_lock lock(latch_);

  // alive_map_中不存在frame_id，直接返回
  auto it = alive_map_.find(frame_id);
  if (it == alive_map_.end()) {
    return;
  }

  auto entry = it->second;
  BUSTUB_ASSERT(entry->evictable_, "cannot remove a non-evictable frame");

  // 判断该页位置，并从对应队列中删除
  if (entry->arc_status_ == ArcStatus::MRU) {
    auto pos = alive_pos_.find(frame_id);
    BUSTUB_ASSERT(pos != alive_pos_.end(), "missing MRU position");
    mru_.erase(pos->second);
  } else if (entry->arc_status_ == ArcStatus::MFU) {
    auto pos = alive_pos_.find(frame_id);
    BUSTUB_ASSERT(pos != alive_pos_.end(), "missing MFU position");
    mfu_.erase(pos->second);
  } else {
    BUSTUB_ASSERT(false, "alive entry must be in MRU or MFU");
  }

  alive_pos_.erase(frame_id);
  alive_map_.erase(it);
  curr_size_--;
}
```

## Task 2：磁盘管理器

磁盘按固定大小 page 管理，每页 `8192` 字节

- `DiskManager` 负责 `page_id -> 文件偏移` 的映射
- `DiskScheduler` 在 `DiskManager` 前面加一层异步调度，后台线程串行处理请求
- `BufferPoolManager` 负责内存页缓存；缺页时通过 `DiskScheduler` 去磁盘读写

**DiskManager** 维护一个逻辑映射表 `pages_`，记录 `page_id -> offset`。真实数据库文件是一个普通文件流 `db_io_`，还有一个单独的日志文件 `log_io_`，文件初始容量由 `page_capacity_` 控制，不够时会扩容。

### `DiskManager`

task2 的实现代码很简单，重点可以看一下 DiskManager 如何工作

`WritePage()`

```cpp
void DiskManager::WritePage(page_id_t page_id, const char *page_data) {
  std::scoped_lock scoped_db_io_latch(db_io_latch_);
  size_t offset;
  if (pages_.find(page_id) != pages_.end()) {
    // 如果这个 page_id 已经存在，取已有 offset
    offset = pages_[page_id];
  } else {
    // 否则新分配一个 offset
    offset = AllocatePage();
  }

  // seekp(offset) 后把 BUSTUB_PAGE_SIZE 字节写进去
  db_io_.seekp(offset);
  db_io_.write(page_data, BUSTUB_PAGE_SIZE);
  if (db_io_.bad()) {
    LOG_DEBUG("I/O error while writing page %d", page_id);
    return;
  }

  // 更新 pages_[page_id] = offset
  num_writes_ += 1;
  pages_[page_id] = offset;

  // 刷新写入磁盘
  db_io_.flush();
}
```

`ReadPage()`

```cpp
void DiskManager::ReadPage(page_id_t page_id, char *page_data) {
  std::scoped_lock scoped_db_io_latch(db_io_latch_);
  size_t offset;
  // 查 page_id 对应 offset；若不存在也会先分配一个
  if (pages_.find(page_id) != pages_.end()) {
    offset = pages_[page_id];
  } else {
    offset = AllocatePage();
  }

  // Check if we have read beyond the file length.
  int file_size = GetFileSize(db_file_name_);
  if (file_size < 0) {
    LOG_DEBUG("I/O error: Fail to get db file size");
    return;
  }
  if (offset > static_cast<size_t>(file_size)) {
    LOG_DEBUG("I/O error: Read page %d past the end of file at offset %lu", page_id, offset);
    return;
  }

  pages_[page_id] = offset;

  // seekg(offset) 再读一整页
  db_io_.seekg(offset);
  db_io_.read(page_data, BUSTUB_PAGE_SIZE);

  if (db_io_.bad()) {
    LOG_DEBUG("I/O error while reading page %d", page_id);
    return;
  }

  // Check if the file ended before we could read a full page.
  int read_count = db_io_.gcount();
  if (read_count < BUSTUB_PAGE_SIZE) {
    LOG_DEBUG("I/O error: Read page %d hit the end of file at offset %lu, missing %d bytes", page_id, offset,
              BUSTUB_PAGE_SIZE - read_count);
    db_io_.clear();
    memset(page_data + read_count, 0, BUSTUB_PAGE_SIZE - read_count);
  }
}
```

`DeletePage()`

```cpp
void DiskManager::DeletePage(page_id_t page_id) {
  std::scoped_lock scoped_db_io_latch(db_io_latch_);
  if (pages_.find(page_id) == pages_.end()) {
    return;
  }

  // 把旧 offset 放进 free_slots_
  size_t offset = pages_[page_id];
  free_slots_.push_back(offset);
  // 删除 pages_ 映射,以后新页可以复用这些空槽
  pages_.erase(page_id);
  num_deletes_ += 1;
}

```

`AllocatePage()`

先优先复用 `free_slots_`，没有空槽就扩文件，然后把新页放到文件末尾

```cpp
auto DiskManager::AllocatePage() -> size_t {
  if (!free_slots_.empty()) {
    auto offset = free_slots_.back();
    free_slots_.pop_back();
    return offset;
  }

  if (pages_.size() + 1 >= page_capacity_) {
    page_capacity_ *= 2;
    std::filesystem::resize_file(db_file_name_, (page_capacity_ + 1) * BUSTUB_PAGE_SIZE);
  }
  return pages_.size() * BUSTUB_PAGE_SIZE;
}
```

`DiskScheduler` 作为 `DiskManager` 的调度层，负责维护一个线程安全队列 `request_queue_` 和一个后台线程 `background_thread_`。

内部包含一个 `DiskRequest` 结构体：

```cpp
struct DiskRequest {
  bool is_write_;
  char *data_;
  page_id_t page_id_;
  std::promise<bool> callback_;
};
```

`Channel` 是线程安全队列，`Put()` 负责生产者入队，`Get()` 负责消费者阻塞取队列元素

```cpp
template <class T>
class Channel {
 public:
  Channel() = default;
  ~Channel() = default;

  void Put(T element) {
    std::unique_lock<std::mutex> lk(m_);
    q_.push(std::move(element));
    lk.unlock();
    cv_.notify_all();
  }

  auto Get() -> T {
    std::unique_lock<std::mutex> lk(m_);
    cv_.wait(lk, [&]() { return !q_.empty(); });
    T element = std::move(q_.front());
    q_.pop();
    return element;
  }

 private:
  std::mutex m_;
  std::condition_variable cv_;
  std::queue<T> q_;
};
```

### 代码实现

这部分的实现很简单，完成 `Schedule()` 和 `StartWorkerThread()` 两个函数即可。

```cpp
void DiskScheduler::Schedule(std::vector<DiskRequest> &requests) {
  for (auto &request : requests) {
    request_queue_.Put(std::make_optional(std::move(request)));
  }
}

void DiskScheduler::StartWorkerThread() {
  while (true) {
    auto request_opt = request_queue_.Get();

    if (!request_opt.has_value()) {
      return;
    }

    auto request = std::move(request_opt.value());

    if (request.is_write_) {
      disk_manager_->WritePage(request.page_id_, request.data_);
    } else {
      disk_manager_->ReadPage(request.page_id_, request.data_);
    }

    request.callback_.set_value(true);
  }
}

```

## Task3：缓冲池管理器

### 缓冲池管理器

task3 需要实现 BufferPoolManager，主要负责调用 DiskScheduler 从磁盘读取内存，调度脏页写入磁盘，在内存满时驱逐页面以腾出空间给新页面，同时保证并发下同一页只有一份且不被错误淘汰

Bustub 提供了 `FrameHeader` 辅助类，用于管理内存中的帧

```cpp
class FrameHeader {
 // ...
 private:
 // ...
  // 当前 frame 的编号
  const frame_id_t frame_id_;
  // 该页对应的读写锁
  std::shared_mutex rwlatch_;
  // 该页当前被多少个线程 / guard 占用
  std::atomic<size_t> pin_count_;
  // 该页是否被修改过但尚未刷盘
  bool is_dirty_;
  // 真正存放页内容的内存空间
  std::vector<char> data_;
  // 当前这个 frame 正在存放哪个 page
  std::optional<page_id_t> page_id_{std::nullopt};
};

```

而在 BufferPoolManager 中

```cpp
class BufferPoolManager {
 public:
  // ...
 private:
  // ...
  // page_table_ 用来判断某个页是否已经在内存中，并保证同一个页不会出现两份副本
  std::unordered_map<page_id_t, frame_id_t> page_table_;
  // free_frames_ 存的是还没被占用的 frame
  std::list<frame_id_t> free_frames_;
  // replacer_ 记录 frame 的访问情况和淘汰情况
  std::shared_ptr<ArcReplacer> replacer_;
  // disk_scheduler_ 负责真正把页从磁盘读进 frame 或把 frame 里的脏页写回磁盘
  std::shared_ptr<DiskScheduler> disk_scheduler_;
  // ...
};
```

### 整体访问流程

`CheckedReadPage()` 或 `CheckedWritePage()`，这里以 `CheckedReadPage` 为例

```cpp
auto BufferPoolManager::CheckedReadPage(page_id_t page_id, AccessType access_type) -> std::optional<ReadPageGuard> {
  std::shared_ptr<FrameHeader> frame;
  std::unique_lock<std::mutex> bpm_lock(*bpm_latch_);

  auto page_it = page_table_.find(page_id);
  // 页已经在内存中
  if (page_it != page_table_.end()) {
    frame = frames_[page_it->second];
    frame->pin_count_.fetch_add(1);
    // 更新ARC访问历史
    replacer_->RecordAccess(frame->frame_id_, page_id, access_type);
    replacer_->SetEvictable(frame->frame_id_, false);
  } else {
    // 页不在内存中，申请空闲frame
    auto frame_opt = AcquireFrame();
    // 没有 返回nullopt
    if (!frame_opt.has_value()) {
      return std::nullopt;
    }
    // 建立frame和page的映射
    frame = frame_opt.value();
    frame->page_id_ = page_id;
    page_table_[page_id] = frame->frame_id_;

    auto promise = disk_scheduler_->CreatePromise();
    auto future = promise.get_future();

    // 从磁盘读取新页
    DiskRequest request{false, frame->GetDataMut(), page_id, std::move(promise)};
    std::vector<DiskRequest> requests;
    requests.push_back(std::move(request));
    disk_scheduler_->Schedule(requests);
    future.get();

    // 更新状态
    frame->pin_count_.store(1);
    replacer_->RecordAccess(frame->frame_id_, page_id, access_type);
    replacer_->SetEvictable(frame->frame_id_, false);
  }

  bpm_lock.unlock();
  return ReadPageGuard(page_id, frame, replacer_, bpm_latch_, disk_scheduler_);
}
```

`ReadPageGuard` 和 `WritePageGuard` 表示这个线程现在持有某页的共享读/独占写权限

### Flush 的实现思路

`FlushPage(page_id)`

- 在刷之前先拿 page 的共享锁
- 保证刷出去的是一致内容

```cpp
auto BufferPoolManager::FlushPage(page_id_t page_id) -> bool {
  std::scoped_lock bpm_lock(*bpm_latch_);

  auto page_it = page_table_.find(page_id);
  if (page_it == page_table_.end()) {
    return false;
  }

  auto frame = frames_[page_it->second];
  frame->rwlatch_.lock_shared();
  FlushFrameUnsafe(frame);
  frame->rwlatch_.unlock_shared();
  return true;
}
```

`FlushPageUnsafe(page_id)`

- 只要这个页在内存里，就把它刷出去
- 但不加 page latch
- 所以它可能看到并发中的页面状态

`FlushAllPagesUnsafe()` / `FlushAllPages()`

- 就是把单页 flush 扩展到所有内存页

### 其余实现

`DeletePage(page_id)` 要处理三种情况：

- 页不在内存里，直接通知 disk 层回收
- 页在内存里且 `pin_count_ > 0`，不能删，返回 `false`
- 页在内存里且没被 pin，清空状态，通知 disk 层回收

`NewPage()`

- NewPage() 只负责分配一个新的 page_id
- 它并不负责把页放入 buffer pool
- 真正把新页装入内存仍然要通过 CheckedReadPage() / CheckedWritePage()

`GetPinCount(page_id)`

- GetPinCount() 用于测试某个页当前的 pin count 是否正确
- 若页不在内存中，则返回 std::nullopt
- 若页在内存中，则返回对应 frame 的 pin_count
