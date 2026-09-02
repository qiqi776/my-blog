---
title: 日志formatter与日期格式优化
date: 2026-08-30
order: 6
---

本节我们需要实现日志系统中的 **Formatter** 与 **日期格式优化**。

## 1. 实现 Log_Record.h 文件

### 1.1 LogRecordView 的实现

```cpp
#ifndef PANS_SRC_LOGGER_LOG_RECORD_H
#define PANS_SRC_LOGGER_LOG_RECORD_H

#include <chrono>
#include <cstdint>
#include <source_location>
#include <string_view>

#include <pans/logger/log_level.h>
#include <pans/macros.h>

namespace pans::detail {

struct LogRecordView {
    LogLevel::Level m_level = LogLevel::Level::LOG_LV_DEBUG;
    std::string_view m_loggerName;
    std::string_view m_message;
    std::chrono::system_clock::time_point m_timestamp;
    std::chrono::steady_clock::duration m_elapsed;
    u64 m_threadId = 0;
    u64 m_fiberId = 0;
    std::string_view m_threadName;
    std::string_view m_fileName;
    std::string_view m_functionName;
    std::source_location m_location;
};

} // namespace pans::detail

#endif
```

这个结构体所有字符串字段都是 `std::string_view`，时间戳和持续时间是值类型，ID 是整数。这样设计的目的是让日志记录的元数据在传递过程中**零拷贝**，仅传递指针和长度，极大降低日志调用开销。

- `LogLevel::Level m_level`：日志级别，默认设为 `DEBUG`。

- `std::chrono::system_clock::time_point m_timestamp`：系统时间戳。`system_clock` 的 `time_point` 通常表示自 1970-01-01 以来的时间，具体精度取决于实现（通常是纳秒或微秒）。用于最终输出人类可读的时间字符串。

- `std::chrono::steady_clock::duration m_elapsed`：服务器启动后经过的时间，由 `steady_clock` 测量。`steady_clock` 是单调时钟，不受系统时间调整影响，适合测量时间间隔或记录自启动以来的相对时间。

- `std::string_view m_functionName`：函数名，由 `__FUNCTION__` 或 `__PRETTY_FUNCTION__` 宏提供。帮助快速定位日志发生的函数。

- `std::source_location m_location`：**C++20 新增的类型**，包含 `file_name()`, `function_name()`, `line()`, `column()` 四个方法。`std::source_location` 可以在调用点通过默认参数自动填充，无需手动写宏，而且能提供**列号**。

### 1.2 `LogRecordView` 在日志系统中的作用

整个日志流水线大致如下：

1. 用户调用日志宏，例如 `LOG_INFO("hello {}", name)`。
2. 宏内部通过 `std::source_location::current()` 捕获位置信息，并收集线程 ID、协程 ID、时间戳、elapsed 等信息，构造一个 `LogRecordView` 对象。
3. 日志消息的 `string_view` 也被存入该对象。
4. `LogRecordView` 被传递给 **Formatter**，由 formatter 根据配置的格式（例如 `"[%Y-%m-%d %H:%M:%S] [%l] %n: %v"`）将各个字段渲染成最终字符串，然后输出到目标（控制台、文件、网络等）。

因此，`LogRecordView` 是日志事件在内存中的标准化表示，它足够轻量，可以在线程间传递，也为 formatter 提供了所有必要的信息。

## 2 日志格式器 formatter

```cpp
#ifndef PANS_SRC_LOGGER_FORMATTER_H
#define PANS_SRC_LOGGER_FORMATTER_H

#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "logger/buffer.h"
#include "logger/buffer_config.h"
#include "logger/log_record.h"

using FormattedRecordBuffer = InlineBuffer<FORMATTED_RECORD_INLINE_CAPACITY>;
```

- 这里定义了一个别名 `FormattedRecordBuffer`。格式化后的日志记录如果长度不超过 256 字节，将在栈上缓冲区中完成，避免堆分配。

```cpp
class Formatter final
{
public:
    class FormatItem { ... };

    explicit Formatter(std::string_view pattern);
    void format(const LogRecordView& record, FormattedRecordBuffer& output) const noexcept;
    [[nodiscard]] const std::string& getPattern() const noexcept { return m_pattern; }

private:
    int parse() noexcept;
    void addLiteral(std::string& literal) noexcept;

private:
    std::string m_pattern;
    std::vector<std::unique_ptr<FormatItem>> m_items;
};
```

定义一个 `Formatter` 类

- `Formatter` 被声明为 `final` 禁止继承。
- 构造函数接收一个 `std::string_view`，将其复制到内部的 `m_pattern`，因为 `string_view` 仅引用外部数据，不能保证其生命周期。
- `format` 方法遍历 `m_items`，调用每个 `FormatItem` 的 `format` 方法，将输出追加到 `FormattedRecordBuffer`。
- `getPattern` 返回内部存储的格式字符串。
- 私有成员 `m_pattern` 存储格式字符串，`m_items` 存储解析后的格式项序列。

```cpp
class FormatItem
{
public:
    virtual ~FormatItem() = default;
    virtual void format(const LogRecordView& record, FormattedRecordBuffer& output) const noexcept = 0;
};
```

- 这是一个**接口类**。虚析构函数 `virtual ~FormatItem() = default` 确保通过基类指针删除派生对象时能正确调用派生类析构函数。
- 纯虚函数 `format` 接收两个参数：
    - `const LogRecordView& record`：日志记录视图，包含所有待格式化的字段。
    - `FormattedRecordBuffer& output`：输出缓冲区，格式化结果追加到这里。
- 派生类将实现具体的格式化逻辑，例如输出时间戳、日志级别、线程 ID、消息等。

```cpp
int parse() noexcept;
void addLiteral(std::string& literal) noexcept;
```

- `parse` 负责解析 `m_pattern`，识别出字面量和占位符，并为每个占位符创建对应的 `FormatItem` 子类对象，同时将字面量合并到适当的位置。
- `addLiteral` 是一个辅助函数，用于将一个累积的字符串字面量包装成一个 `LiteralFormatItem`（例如继承 `FormatItem` 的类），并添加到 `m_items` 中。

## 3 formatter 具体实现

我们继续深入学习日志格式化器的**具体实现**。 `formatter.cpp` 实现了在 `formatter.h` 中声明的 `Formatter` 类，包含：

- 格式字符串的解析逻辑（`parse`）
- 各种 `FormatItem` 派生类（对应不同占位符）
- 基于工厂模式的格式项创建
- 日期时间格式化的**线程局部缓存优化**
- 整数到字符串的高效转换（`std::to_chars`）

`Formatter` 的工作流程：

1. 构造时传入格式字符串（pattern），例如 `"%d{%Y-%m-%d %H:%M:%S}.%u%Tthread=%t%Tfiber=%F%T[%p]%T%f:%l%T%M%T%m%n"`。
2. `parse()` 遍历 pattern，识别 `%` 开头的占位符和普通字面量，为每个占位符创建一个 `FormatItem` 子类对象，并存储到 `m_items` 列表中。
3. 运行时，`format()` 依次调用每个 `FormatItem` 的 `format()` 方法，将结果追加到 `FormattedRecordBuffer`（即 `InlineBuffer<256>`）中。

### 3.1 构造函数与 format 方法

```cpp
Formatter::Formatter(std::string_view pattern)
    : m_pattern(pattern)
{
    if(parse())
    {
        throw std::invalid_argument("invalid log format. parse failed.");
    }
}
```

- 构造函数将传入的格式字符串复制到 `m_pattern`。调用私有方法 `parse()`。如果解析失败，抛出 `std::invalid_argument` 异常，并附带错误信息。
- 注意：构造函数可以抛出异常，所以这里没有 `noexcept`。

```cpp
void Formatter::format(const LogRecordView& record, FormattedRecordBuffer& output) const noexcept
{
    for(const auto& item : m_items)
    {
        item->format(record, output);
    }
}
```

- 遍历 `m_items` 中的每个 `unique_ptr<FormatItem>`，调用其虚函数 `format`。虚函数调用在这里可能产生一定开销，但相比日志 I/O 或其他操作通常可以接受。

### 3.2 AppendInteger

```cpp
template <typename T>
void AppendInteger(FormattedRecordBuffer& output, T value) noexcept
{
    std::array<char, 24> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    ASSERT_RETNONE2(result.ec == std::errc(), "trans " << value << " to chars failed.");
    output.append(buffer.data(), static_cast<std::size_t>(result.ptr - buffer.data()));
}
```

- 这是一个函数模板，用于将整数类型 `T` 转换为字符串并追加到输出缓冲区。
- 使用 **`std::to_chars`**（C++17 引入）进行转换。这是非常高效的整数转字符串方法，不涉及动态内存分配，直接写入调用者提供的 24 字节缓冲区。
- `std::to_chars` 返回一个 `to_chars_result` 结构，包含 `ec`（错误码）和 `ptr`。
- 如果转换成功（`ec == std::errc()`），则通过 `output.append` 将缓冲区中有效部分追加到日志缓冲区。
- 如果转换失败，`ASSERT_RETNONE2` 会记录错误并返回。

### 3.3 各种 `FormatItem` 派生类

每个派生类对应一种占位符，实现具体的格式化逻辑。它们都继承自 `Formatter::FormatItem` 并实现 `format` 方法。

```cpp
class LiteralFormatItem final : public Formatter::FormatItem
{
public:
    explicit LiteralFormatItem(std::string value)
        : m_value(std::move(value))
    {}
    void format(const LogRecordView&, FormattedRecordBuffer& output) const noexcept override
    {
        output.append(m_value);
    }
private:
    std::string m_value;
};
```

- 存储一个 `std::string` 字面量，格式化时直接追加该字符串。`format` 忽略 `record` 参数。

```cpp
void format(..., output) const noexcept override
{
    output.append(record.m_message);
}
```

- 直接输出 `LogRecordView` 中的 `m_message` 字段，即日志内容。

`LevelFormatItem`（级别）

```cpp
output.append(LogLevel::ToString(record.m_level));
```

- 调用之前学习的 `LogLevel::ToString` 获取级别的字符串表示（如 `"DEBUG"`），然后追加。

`ElapsedFormatItem`（启动后经过时间）

```cpp
AppendInteger(output, std::chrono::duration_cast<std::chrono::milliseconds>(record.m_elapsed).count());
```

- 将 `m_elapsed`（`steady_clock::duration`）转换为毫秒数，并使用 `AppendInteger` 输出整数。

`LoggerNameFormatItem`（日志器名）

```cpp
output.append(record.m_loggerName);
```

- 直接输出日志器名字。

`ThreadIdFormatItem`（线程 ID）

```cpp
AppendInteger(output, record.m_threadId);
```

- 线程 ID 是 `u64`，转换为十进制字符串输出。

`NewLineFormatItem`（换行）

```cpp
output.append('\n');
```

- 输出一个换行符。注意使用 `append(char)` 重载。

`DateTimeFormatItem`（日期时间）

```cpp
class DateTimeFormatItem final : public Formatter::FormatItem
{
public:
    explicit DateTimeFormatItem(std::string_view format)
        : m_format(format.empty() ? DEFAULT_DATE_FORMAT : format)
    {}
    void format(const LogRecordView& record, FormattedRecordBuffer& output) const noexcept override
    {
        static thread_local time_t last_second = 0;
        static thread_local char cached_date_time[20] = {'\0'};
        const auto duration = record.m_timestamp.time_since_epoch();
        const time_t current_second = static_cast<time_t>(std::chrono::duration_cast<std::chrono::seconds>(duration).count());
        if(current_second != last_second)
        {
            std::tm buffer{};
#if defined(_WIN32)
            const errno_t result = localtime_s(&buffer, &current_second);
            ASSERT_RETNONE2(result == 0, "failed to convert log time to local time");
#else
            const std::tm* result = localtime_r(&current_second, &buffer);
            ASSERT_RETNONE2(result != nullptr, "failed to convert log time to local time");
#endif
            const std::size_t size = std::strftime(cached_date_time, sizeof(cached_date_time), m_format.c_str(), &buffer);
            ASSERT_RETNONE2(size != 0, "failed to format log time");
            last_second = current_second;
        }

        output.append(cached_date_time);
    }

private:
    std::string m_format;
};
```

- `m_format`：存储日期时间格式字符串（例如 `"%Y-%m-%d %H:%M:%S"`）。在构造函数中，如果传入的格式为空，则使用默认格式 `DEFAULT_DATE_FORMAT`（定义在文件开头：`"%Y-%m-%d %H:%M:%S"`）。

```cpp
static thread_local time_t last_second = 0;
static thread_local char cached_date_time[20] = {'\0'};
```

- `thread_local` 关键字表示这两个变量在每个线程中有独立的副本。
- `last_second` 记录上次格式化时的时间戳。
- `cached_date_time` 存储上次格式化得到的日期时间字符串。

**为什么用 `thread_local`？**  
日志格式化可能在多线程中并发执行，缓存必须线程安全。使用 `thread_local` 可以避免加锁，每个线程独立缓存，非常高效且正确。

```cpp
const auto duration = record.m_timestamp.time_since_epoch();
const time_t current_second = static_cast<time_t>(std::chrono::duration_cast<std::chrono::seconds>(duration).count());
if(current_second != last_second)
{
    // 重新计算日期时间
    ...
    last_second = current_second;
}
output.append(cached_date_time);
```

1. 从 `record.m_timestamp`（`system_clock::time_point`）获取持续时间。
2. 将持续时间转换为**秒**，得到当前秒级时间戳 `current_second`。
3. 如果 `current_second` 与缓存的 `last_second` 不同，说明进入了新的一秒，需要重新计算日期时间字符串。
4. 重新计算时，调用 `localtime_s`（Windows）或 `localtime_r`（POSIX）将 `time_t` 转换为本地时间 `std::tm`，然后使用 `strftime` 按照 `m_format` 格式化为字符串，存入 `cached_date_time`。
5. 更新 `last_second = current_second`。
6. 无论是否更新，都将 `cached_date_time` 追加到输出缓冲区。

**优化的关键**：

- 如果同一秒内有多条日志，`current_second` 不变，就不会执行 `localtime` 和 `strftime`，而是直接复用 `cached_date_time`。这避免了系统调用和格式化开销。
- `localtime` 系列函数通常涉及时区转换，可能加锁（`localtime_r` 是线程安全版本但仍有开销），`strftime` 也较慢。缓存能极大提升吞吐量。
- 缓存容量 `cached_date_time[20]` 足够容纳默认格式 `"%Y-%m-%d %H:%M:%S"`（19 个字符 + 空字符），但如果用户自定义格式更长（比如包含毫秒或时区），可能溢出。这里没有做长度检查，存在潜在风险，但示例中默认格式是安全的。更好的做法是动态确定长度或使用足够大的缓冲区（如 64）。

**注意**：`strftime` 返回 0 表示输出缓冲区太小或格式错误。代码中用 `ASSERT_RETNONE2(size != 0, ...)` 进行断言。

- `MicrosecondsFormatItem`

```cpp
void format(..., output) const noexcept override
{
    const auto total_microseconds = std::chrono::duration_cast<std::chrono::microseconds>(record.m_timestamp.time_since_epoch()).count();
    std::int64_t microseconds = total_microseconds % 1'000'000;
    if(microseconds < 0)
    {
        microseconds += 1'000'000;
    }
    AppendInteger(output, microseconds);
}
```

- 计算自纪元以来的微秒总数，然后取模 1,000,000 得到当前秒内的微秒部分。
- 处理负数情况（1970 年之前的时间），加 1,000,000 使其为正。
- 使用 `AppendInteger` 输出微秒整数。注意它输出的是纯数字，没有前导零。如果需要固定宽度（如 6 位），可以在格式化时自行处理，但这里似乎作为独立字段使用，不保证宽度。

- `FileNameFormatItem`（文件名）

```cpp
output.append(record.m_fileName);
```

- `LineFormatItem`（行号）

```cpp
AppendInteger(output, record.m_location.line());
```

- 使用 `std::source_location` 的 `line()` 方法获取行号（无符号整数），输出十进制。

- `FunctionNameFormatItem`（函数名）

```cpp
output.append(record.m_functionName);
```

- `TabFormatItem`（制表符）

```cpp
output.append('\t');
```

- `FiberIdFormatItem`（协程 ID）

```cpp
AppendInteger(output, record.m_fiberId);
```

- `ThreadNameFormatItem`（线程名）

```cpp
output.append(record.m_threadName);
```

### 3.4 工厂模式与格式项创建

为了将字符指令（如 `'m'`, `'p'`, `'d'`）映射到具体的 `FormatItem` 派生类，代码使用了一个**工厂函数注册表**。

```cpp
using FormatItemFactory = std::unique_ptr<Formatter::FormatItem> (*)(std::string_view);
```

定义了一个函数指针类型，指向接受 `std::string_view` 并返回 `unique_ptr<FormatItem>` 的函数。

```cpp
template <typename Item>
[[nodiscard]] std::unique_ptr<Formatter::FormatItem> CreateSimpleFormatItem(std::string_view)
{
    return std::make_unique<Item>();
}

template <typename Item>
[[nodiscard]] std::unique_ptr<Formatter::FormatItem> CreateConfiguredFormatItem(std::string_view format)
{
    return std::make_unique<Item>(format);
}
```

- `CreateSimpleFormatItem`：用于无需额外参数的格式项，忽略传入的格式字符串。
- `CreateConfiguredFormatItem`：用于需要格式字符串的格式项（如 `DateTimeFormatItem`），将格式字符串转发给构造函数。

利用模板，可以为每个具体格式项类生成对应的工厂函数。

```cpp
[[nodiscard]] const std::unordered_map<char, FormatItemFactory>& GetFormatItemFactories()
{
    static const std::unordered_map<char, FormatItemFactory> FORMAT_ITEM_FACTORIES{
        {'m', &CreateSimpleFormatItem<MessageFormatItem>},
        {'p', &CreateSimpleFormatItem<LevelFormatItem>},
        {'r', &CreateSimpleFormatItem<ElapsedFormatItem>},
        {'c', &CreateSimpleFormatItem<LoggerNameFormatItem>},
        {'t', &CreateSimpleFormatItem<ThreadIdFormatItem>},
        {'n', &CreateSimpleFormatItem<NewLineFormatItem>},
        {'d', &CreateConfiguredFormatItem<DateTimeFormatItem>},
        {'u', &CreateSimpleFormatItem<MicrosecondsFormatItem>},
        {'f', &CreateSimpleFormatItem<FileNameFormatItem>},
        {'l', &CreateSimpleFormatItem<LineFormatItem>},
        {'M', &CreateSimpleFormatItem<FunctionNameFormatItem>},
        {'T', &CreateSimpleFormatItem<TabFormatItem>},
        {'F', &CreateSimpleFormatItem<FiberIdFormatItem>},
        {'N', &CreateSimpleFormatItem<ThreadNameFormatItem>},
    };
    return FORMAT_ITEM_FACTORIES;
}
```

- 这是一个函数，返回一个静态的 `unordered_map`，将字符指令映射到对应的工厂函数指针。
    - `m`：消息内容
    - `p`：日志级别（level，可能取自 priority）
    - `r`：elapsed 毫秒数
    - `c`：日志器名（logger name）
    - `t`：线程 ID
    - `n`：换行
    - `d`：日期时间（可配置格式）
    - `u`：微秒
    - `f`：文件名
    - `l`：行号
    - `M`：函数名
    - `T`：制表符
    - `F`：协程 ID
    - `N`：线程名

```cpp
[[nodiscard]] std::unique_ptr<Formatter::FormatItem> CreateFormatItem(char directive, std::string_view format)
{
    const auto& factories = GetFormatItemFactories();
    const auto it = factories.find(directive);
    ASSERT_RETVAL2(it != factories.end(), nullptr, "unknown logger format directive: " << directive);
    return it->second(format);
}
```

- 根据指令字符在映射表中查找工厂函数。
- 如果找不到，记录错误并返回 `nullptr`。
- 否则调用工厂函数并传入可选的格式字符串（对于简单工厂会忽略），返回创建的格式项对象。

### 3.5 解析格式字符串：parse()

```cpp
int Formatter::parse() noexcept
{
    std::string literal;
    for(std::size_t index = 0; index < m_pattern.size(); ++index)
    {
        if(m_pattern[index] != '%')
        {
            literal.push_back(m_pattern[index]);
            continue;
        }
        ASSERT_RETVAL2(index + 1 < m_pattern.size(), -1, "logger format pattern ends with an incomplete directive");
        const char directive = m_pattern[++index];
        if(directive == '%')
        {
            literal.push_back('%');
            continue;
        }
        addLiteral(literal);
        std::string_view item_format;
        if(index + 1 < m_pattern.size() && m_pattern[index + 1] == '{')
        {
            const std::size_t closing_brace = m_pattern.find('}', index + 2);
            ASSERT_RETVAL2(closing_brace != std::string::npos && closing_brace != (index + 2), -2, "missing a closing brace or empty");
            item_format = std::string_view(m_pattern).substr(index + 2, closing_brace - index - 2);
            index = closing_brace;
        }
        m_items.push_back(CreateFormatItem(directive, item_format));
    }
    addLiteral(literal);
    for(const auto& item : m_items)
    {
        ASSERT_RETVAL2(item != nullptr, -3, "logger formatter contains a null format item");
    }

    return 0;
}
```

- `std::string literal` 用于暂时存储连续的非占位符字符（字面量）。
- 遍历 `m_pattern`：
    - 如果当前字符不是 `%`，则将其追加到 `literal`。
    - 如果是 `%`，说明可能是一个占位符的开始，暂停字面量收集。

- 检查 `%` 后是否还有字符（`index + 1 < m_pattern.size()`），如果没有，说明格式字符串以 `%` 结尾，无效，返回 `-1`。
- 移动 `index` 到下一个字符，即指令字符 `directive = m_pattern[++index]`。
- 如果指令字符本身也是 `%`（即 `%%`），表示转义百分号，向字面量中添加一个 `%`，然后继续循环。这样用户可以输出字面 `%` 字符。
- 否则，说明是一个真正的格式化占位符：
    - 调用 `addLiteral(literal)` 将之前累积的字面量生成一个 `LiteralFormatItem` 并加入 `m_items`，然后清空 `literal`。
    - 接下来检查是否有 `{...}` 子格式（仅对 `%d` 有意义）。如果当前指令后紧跟 `{`，则查找下一个 `}`，提取中间的字符串作为 `item_format`，并更新 `index` 到 `}` 位置，以便外层循环继续。
    - 然后调用 `CreateFormatItem(directive, item_format)` 创建对应的格式项并加入 `m_items`。

- 循环结束后，再次调用 `addLiteral(literal)` 将最后剩余的字面量加入。
- 遍历 `m_items`，检查是否有 `nullptr`（可能是未知指令导致 `CreateFormatItem` 返回空），如果有则返回 `-3`。
- 全部成功返回 0。

以默认格式为例：
`"%d{%Y-%m-%d %H:%M:%S}.%u%Tthread=%t%Tfiber=%F%T[%p]%T%f:%l%T%M%T%m%n"`

解析过程会生成如下格式项序列：

1. `DateTimeFormatItem`，格式为 `"%Y-%m-%d %H:%M:%S"`
2. `LiteralFormatItem`，内容 `"."`
3. `MicrosecondsFormatItem`
4. `TabFormatItem`
5. `LiteralFormatItem`，内容 `"thread="`
6. `ThreadIdFormatItem`
7. `TabFormatItem`
8. `LiteralFormatItem`，内容 `"fiber="`
9. `FiberIdFormatItem`
10. `TabFormatItem`
11. `LiteralFormatItem`，内容 `"["`
12. `LevelFormatItem`
13. `LiteralFormatItem`，内容 `"]"`
14. `TabFormatItem`
15. `FileNameFormatItem`
16. `LiteralFormatItem`，内容 `":"`
17. `LineFormatItem`
18. `TabFormatItem`
19. `FunctionNameFormatItem`
20. `TabFormatItem`
21. `MessageFormatItem`
22. `NewLineFormatItem`

这样每次 `format` 时依次执行这些项，就能输出类似：
`2026-08-30 14:30:00.123456	thread=123	fiber=0	[DEBUG]	main.cpp:42	main	User logged in`

## 4 性能测试

在服务器等高频日志场景中，日志可能每秒钟产生成百上千条。每条日志几乎都会包含时间戳，而时间戳的格式化通常需要调用 `localtime_r`（或 `localtime_s`）和 `strftime`，这两个函数涉及系统时区转换和格式化处理，开销相对较大。如果每条日志都执行一次，会消耗大量 CPU。

一个简单的观察是：**同一秒内所有日志的秒级时间字符串是完全相同的**。因此，我们可以缓存上一次格式化得到的时间字符串，只有当秒数发生变化时才重新计算。这样，同一秒内后续日志只需直接使用缓存的字符串，几乎零开销。

这个测试程序通过对比三种循环（空循环、每次都格式化、带缓存的格式化）的执行时间，量化了优化的效果。

### 4.1 函数 test_time(int times)

接收一个整数 `times`，表示每个循环要执行的迭代次数，用于控制测试规模。

```cpp
const std::string& format = "%Y-%m-%d %H:%M:%S";
static thread_local time_t last_second = 0;
static thread_local char cached_date_time[20] = {'\0'};
```

- `format` 是日期格式字符串，稍后会在 `strftime` 中使用。
- `last_second` 和 `cached_date_time` 是**线程局部**（`thread_local`）静态变量，用于缓存。在优化循环中会用到。它们被声明为 `static thread_local`，意味着每个线程有自己独立的副本，避免多线程竞争。

### 4.2 基准空循环

```cpp
auto t1 = std::chrono::steady_clock::now();
for(int i = 0; i < times; ++i)
{
    // 空循环体
}
auto t2 = std::chrono::steady_clock::now();
```

这个循环什么都不做，只测量循环本身（迭代、条件判断等）的固定开销。后续两个循环都包含这个基础开销，因此要在最后减去它，得到纯粹由操作本身带来的额外耗时。

### 4.3 原始方法：每次循环都格式化时间

```cpp
for(int i = 0; i < times; ++i)
{
    struct tm tm;
    time_t now = time(0);               // 获取当前时间（秒级）
    localtime_r(&now, &tm);             // 转换为本地时间 tm 结构
    char buf[64];
    strftime(buf, sizeof(buf), format.c_str(), &tm); // 格式化为字符串
}
auto t3 = std::chrono::steady_clock::now();
```

这里每一步都执行完整的流程：

- `time(0)` 获取当前 Unix 时间戳（秒）。
- `localtime_r` 将时间戳转换为本地日历时间（年、月、日、时、分、秒等），该函数会考虑时区设置，可能涉及锁或其他系统调用。
- `strftime` 根据格式字符串将 `tm` 结构格式化为字符串。

这个循环测量的是原始未优化方法的执行时间。

### 4.4 优化方法：缓存秒级字符串

```cpp
for(int i = 0; i < times; ++i)
{
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    time_t current_second = std::chrono::duration_cast<std::chrono::seconds>(duration).count();
    long micros = std::chrono::duration_cast<std::chrono::microseconds>(duration % std::chrono::seconds(1)).count();

    if (current_second != last_second) {
        struct tm buf;
        localtime_r(&current_second, &buf);
        strftime(cached_date_time, sizeof(cached_date_time), "%Y-%m-%d %H:%M:%S", &buf);
        last_second = current_second;
    }
}
auto t4 = std::chrono::steady_clock::now();
```

这个循环模拟优化后的逻辑：

- 首先用 `std::chrono::system_clock::now()` 获取当前时间点，相比 `time(0)` 可能更精确且更符合 C++ 风格。
- 提取秒级时间戳 `current_second` 和微秒部分 `micros`（尽管这里没有使用微秒，只是为了展示可能的需求）。
- 如果 `current_second` 与缓存中的 `last_second` 不同，说明进入了新的一秒，此时才调用 `localtime_r` 和 `strftime` 重新生成时间字符串，并更新缓存。
- 如果秒数未变，则直接跳过转换，使用之前的 `cached_date_time`（虽然这里循环内没有使用它，但实际日志中会直接输出该缓存字符串）。

因此，优化循环的大部分迭代只执行了 `now()`、时间戳转换和一次比较，开销远小于每次调用 `localtime_r` + `strftime`。

### 4.5 时间测量与输出

```cpp
auto base = t2 - t1;         // 空循环基础耗时
auto diff1 = t3 - t2 - base; // 原始方法额外耗时
auto diff2 = t4 - t3 - base; // 优化方法额外耗时

// 转换为纳秒
auto base_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(base).count();
auto diff1_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(diff1).count();
auto diff2_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(diff2).count();

std::cout << "基础耗时: " << base_ns << " ns" << std::endl;
std::cout << "原耗时: " << diff1_ns << " ns" << std::endl;
std::cout << "现耗时: " << diff2_ns << " ns" << std::endl;
std::cout << "优化倍数: " << (double)diff1_ns / diff2_ns << std::endl;
```

- 通过减去基准时间，得到每个循环中实际业务操作（时间获取、格式化等）的净耗时。
- `优化倍数` 等于原始方法净耗时除以优化方法净耗时，数值越大说明优化效果越明显。

### 4.6 优化总结

最后测下来在本机有个将近七倍的提升。

#### 系统调用的开销

`localtime_r` 和 `strftime` 是相对重的函数：

- `localtime_r` 需要将 UTC 时间转换为本地时间，涉及时区数据库查询（可能读取文件或内存映射），并且线程安全版本内部可能仍有一些同步措施。
- `strftime` 需要解析格式字符串，并将 `tm` 结构中的各个字段按照指定格式转换为字符串，涉及较多的字符处理。

这两个函数的性能消耗是 `std::chrono::system_clock::now()` 的 10~15 倍，说明它们确实是瓶颈。

#### 缓存命中率

在高频日志场景下，同一秒内可能会产生大量日志（例如每秒数千条）。如果每条日志都执行一次 `localtime_r` + `strftime`，那么每一秒内这些调用都是重复的，因为它们的结果完全相同。缓存后，只有第一条日志（或秒切换后的第一条）执行转换，后续所有日志直接使用缓存字符串，节省了大量时间。

#### 测试中的实际情况

在测试循环中，如果 `times` 很大，循环可能在几毫秒内完成，整个循环几乎都处于同一秒内。优化循环只在第一次迭代时执行转换（因为 `last_second` 初始为 0，与第一个 `current_second` 不同），之后所有迭代都命中缓存，因此 `diff2` 非常小，导致优化倍数很大（可能几十甚至上百倍）。这有点极端，但真实日志场景中确实存在类似情况。
