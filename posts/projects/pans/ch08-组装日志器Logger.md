---
title: 组装日志器Logger
date: 2026-09-05
order: 8
---

前面的章节已经完成日志级别、日志记录、Formatter 和 Appender。本节把这些组件组装成用户真正使用的 `Logger`，并补齐两套日志调用方式：C++ 流式日志和 `printf` 风格日志。

## 1. Logger 的公开接口

```cpp
class PANS_API Logger final
{
public:
    class Impl;
    explicit Logger(std::string name = "root");
    ~Logger();

    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
    Logger(Logger&&) = delete;
    Logger& operator=(Logger&&) = delete;

    [[nodiscard]] bool shouldLog(LogLevel::Level level) const noexcept;
    void setLevel(LogLevel::Level level) noexcept;
    [[nodiscard]] LogLevel::Level getLevel() const noexcept;
    [[nodiscard]] std::string_view getName() const noexcept;

    void setFormatter(std::string_view pattern);
    [[nodiscard]] std::string getFormatterPattern() const;
    void addAppender(AppenderPtr appender);
    void removeAppender(const AppenderPtr& appender);
    void clearAppenders();

    void flush();
    void sync();

private:
    std::unique_ptr<Impl> m_impl;
    friend class detail::LoggerAccess;
};

using LoggerPtr = std::shared_ptr<Logger>;
[[nodiscard]] PANS_API LoggerPtr GetRootLogger();
[[nodiscard]] PANS_API LoggerPtr GetLogger(std::string_view name);
```

### 1.1 Pimpl 与对象所有权

`Logger` 使用 Pimpl 惯用法隐藏实现细节。公开头文件只需要知道存在一个 `Impl`，真正的成员和同步机制位于 `logger_impl.h`。

析构函数在 `.cc` 文件中定义，是因为 `std::unique_ptr<Impl>` 析构时必须看到完整的 `Impl` 类型。Logger 同时删除拷贝和移动操作，调用者通过 `LoggerPtr` 共享同一个日志器实例。

`Logger` 的构造函数是公开的，但项目通常通过 `GetRootLogger()` 或 `GetLogger(name)` 获取日志器。这样由管理器统一保存实例，可以保证同名 Logger 被复用。

### 1.2 Logger 管理的三类状态

- `m_level` 决定当前日志器接受哪些级别；
- `m_formatter` 决定日志记录如何排版；
- `m_appenders` 决定日志最终写到哪里。

`flush()` 和 `sync()` 则把相应操作转发给 Appender。Logger 没有 Appender 时，会尝试交给根 Logger 处理。

## 2. Logger::Impl 的真实结构

```cpp
class Logger::Impl
{
public:
    explicit Impl(std::string name);
    [[nodiscard]] bool shouldLog(LogLevel::Level level) const noexcept;
    void submit(const detail::LogRecordView& record) noexcept;
    void setLevel(LogLevel::Level level) noexcept;
    [[nodiscard]] LogLevel::Level getLevel() const noexcept;
    [[nodiscard]] std::string_view getName() const noexcept;
    void setFormatter(std::shared_ptr<const detail::Formatter> formatter);
    [[nodiscard]] std::shared_ptr<const detail::Formatter> getFormatter() const noexcept;
    void addAppender(AppenderPtr appender);
    void removeAppender(const AppenderPtr& appender);
    void clearAppenders();
    void flush();
    void sync();
    void setRoot(const LoggerPtr& root) noexcept;

private:
    std::string m_name;
    std::atomic<LogLevel::Level> m_level{LogLevel::Level::LOG_LV_DEBUG};
    mutable std::shared_mutex m_mutex;
    std::shared_ptr<const detail::Formatter> m_formatter;
    std::vector<AppenderPtr> m_appenders;
    LoggerPtr m_root;
};
```

### 2.1 级别使用原子变量

`setLevel()` 使用 `memory_order_release` 写入，`getLevel()` 使用 `memory_order_acquire` 读取：

```cpp
void Logger::Impl::setLevel(LogLevel::Level level) noexcept
{
    m_level.store(level, std::memory_order_release);
}

LogLevel::Level Logger::Impl::getLevel() const noexcept
{
    return m_level.load(std::memory_order_acquire);
}
```

日志级别是高频读取、低频修改的配置。使用原子变量可以让快速过滤不必获取互斥锁。

### 2.2 读写锁保护共享状态

Formatter、Appender 容器和根 Logger 相关操作由 `m_mutex` 保护。读取配置时使用 `std::shared_lock`，修改容器时使用 `std::unique_lock`。多个线程可以同时读取，但添加或删除 Appender 时必须独占访问。

Logger 构造时会检查名称不能为空，并创建默认 Formatter：

```cpp
constexpr std::string_view DEFAULT_LOG_PATTERN =
    "%d{%Y-%m-%d %H:%M:%S}.%u%Tthread=%t%Tfiber=%F%T[%p]%T%f:%l%T%m%n";

Logger::Impl::Impl(std::string name)
    : m_name(std::move(name))
{
    if (m_name.empty())
    {
        throw std::invalid_argument("logger name cannot be empty");
    }
    m_formatter = std::make_shared<const detail::Formatter>(DEFAULT_LOG_PATTERN);
}
```

默认格式包含时间、启动后经过的时间、线程 ID、协程 ID、日志级别、文件、行号、消息和换行符。Formatter 的具体占位符由上一节负责解析，本节只负责把它安装到 Logger 中。

## 3. shouldLog：日志的第一道过滤

```cpp
bool Logger::Impl::shouldLog(LogLevel::Level level) const noexcept
{
    if (static_cast<u8>(level) < static_cast<u8>(getLevel()))
    {
        return false;
    }

    {
        std::shared_lock<std::shared_mutex> lock(m_mutex);
        if (!m_appenders.empty())
        {
            return true;
        }
    }

    return m_root != nullptr && m_root->shouldLog(level);
}
```

判断顺序很重要：

1. 先比较级别，低于阈值的日志直接返回；
2. 当前 Logger 有 Appender 时，可以继续记录；
3. 当前 Logger 没有 Appender，则询问根 Logger。

因此，`GetLogger("network")` 创建的子 Logger 可以只设置名称和级别，实际输出复用根 Logger 的 Appender。只有当子 Logger 自己添加了 Appender 后，日志才会走自己的输出链路。

## 4. submit：从记录到 Appender

```cpp
void Logger::Impl::submit(const detail::LogRecordView& record) noexcept
{
    if (static_cast<u8>(record.m_level) < static_cast<u8>(getLevel()))
    {
        return;
    }

    std::shared_lock<std::shared_mutex> lock(m_mutex);
    if (m_appenders.empty())
    {
        lock.unlock();
        if (m_root != nullptr)
        {
            m_root->m_impl->submit(record);
        }
        return;
    }

    try
    {
        detail::FormattedRecordBuffer formatted_record;
        m_formatter->format(record, formatted_record);
        for (const AppenderPtr& appender : m_appenders)
        {
            detail::AppenderAccess::Append(
                appender, record.m_level, formatted_record.view());
        }
    }
    catch (...)
    {
        constexpr std::string_view message =
            "pans logger: record formatting failed\n";
        std::fwrite(message.data(), 1, message.size(), stderr);
    }
}
```

### 4.1 提交前再次过滤

宏调用前会通过 `shouldLog()` 过滤一次，`submit()` 仍然再次检查级别。这是合理的防御式设计：Logger 的配置可能在两次检查之间被其他线程修改，最终提交边界不能假设调用者已经完成过滤。

### 4.2 没有 Appender 时回退

回退前显式释放当前读锁，再调用根 Logger。这样可以避免持有子 Logger 的锁时继续进入其他 Logger，降低锁嵌套和潜在死锁风险。

### 4.3 格式化和输出都必须保护

`submit()` 声明为 `noexcept`。`FormattedRecordBuffer` 采用小缓冲区优化，但长日志仍可能触发堆分配；Appender 容器遍历也可能涉及异常路径。因此实现将格式化和分发放进 `try/catch`，失败时只向 `stderr` 输出固定提示，不能让日志异常终止业务线程。

## 5. LoggerAccess：受控访问私有实现

```cpp
namespace detail {

class LoggerAccess final
{
public:
    static void Submit(Logger& logger,
                       const LogRecordView& record) noexcept;
    static void SetRoot(Logger& logger,
                        const LoggerPtr& root) noexcept;
};

} // namespace detail
```

`LoggerAccess` 是内部权限桥梁。它被声明为 `Logger` 的友元，但不把 `m_impl` 暴露给所有调用者：

```cpp
void detail::LoggerAccess::Submit(
    Logger& logger, const LogRecordView& record) noexcept
{
    logger.m_impl->submit(record);
}
```

日志行对象只需要调用 `LoggerAccess::Submit`，而公共 API 不需要增加一个面向内部的 `submit()` 方法。`SetRoot` 也采用相同方式，由 Logger 管理器为新建的命名 Logger 设置根 Logger。

## 6. LogLine：流式日志的临时对象

`pans/include/pans/logger/log.h` 中提供了两套宏。流式日志的核心是 `LogLine`：

```cpp
class PANS_API LogLine final
{
public:
    LogLine(Logger& logger, LogLevel::Level level,
            u32 line, std::string_view file_name);
    ~LogLine() noexcept;

    LogLine(const LogLine&) = delete;
    LogLine& operator=(const LogLine&) = delete;
    LogLine(LogLine&&) = delete;
    LogLine& operator=(LogLine&&) = delete;

    [[nodiscard]] std::ostream& stream() noexcept;

private:
    struct Impl;
    static constexpr std::size_t LOG_LINE_IMPL_SIZE = 1024;
    alignas(std::max_align_t) std::byte m_implStorage[LOG_LINE_IMPL_SIZE];
};
```

`LogLine` 没有直接使用 `std::unique_ptr<Impl>`，而是预留一块 1024 字节的对齐存储，把 `Impl` 放在对象内部。这样创建一条短日志时不需要为 `LogLine::Impl` 单独分配堆内存。

构造函数通过 `std::construct_at` 原地构造实现对象，析构函数再提交记录并调用 `std::destroy_at`：

```cpp
LogLine::~LogLine() noexcept
{
    Impl& impl = getImpl();
    LoggerAccess::Submit(impl.m_logger, impl.getRecord());
    std::destroy_at(&impl);
}
```

这解释了流式表达式为什么可以自然工作：

```cpp
PANS_LOG_INFO(logger) << "user=" << user_id;
```

宏创建的临时 `LogLine` 先返回一个 `std::ostream&`，所有 `operator<<` 都只写入内存缓冲区；完整表达式结束时临时对象析构，才把整条记录提交给 Logger。

## 7. 日志记录携带哪些上下文

`LogLine::Impl` 构造时一次性采集日志上下文：

```cpp
Impl(Logger& logger, LogLevel::Level level,
     u32 line, std::string_view file_name)
    : m_logger(logger)
    , m_level(level)
    , m_line(line)
    , m_fileName(file_name)
    , m_timestamp(std::chrono::system_clock::now())
    , m_elapsed(GetElapsedTime())
    , m_threadId(GetThreadId())
    , m_fiberId(GetFiberId())
    , m_threadName(GetThreadName())
    , m_streamBuffer(m_inlineBuffer)
    , m_stream(&m_streamBuffer)
{}
```

最终生成的 `LogRecordView` 包括：

- 日志级别和 Logger 名称；
- 消息文本；
- 墙上时钟时间和进程启动后的经过时间；
- 线程 ID、协程 ID 和线程名称；
- 源文件名称和行号。

所有 `string_view` 都指向仍然有效的存储：文件名来自编译器的 `__FILE__`，Logger 名称属于 Logger，消息内容属于当前 `LogLine` 的内联缓冲区，并且在析构提交前一直有效。

## 8. PANS_LOG 宏的两种调用方式

### 8.1 流式日志

```cpp
#define PANS_LOG_LEVEL(logger, level) \
    if (auto pans_log_logger = (logger); !pans_log_logger) {} \
    else if (const auto pans_log_level = (level); \
             !pans_log_logger->shouldLog(pans_log_level)) {} \
    else pans::detail::LogLine(\
        *pans_log_logger, pans_log_level, __LINE__, __FILE__).stream()
```

宏先把 Logger 表达式保存到局部变量，避免复杂表达式被重复求值；Logger 为空或级别不满足时，不会构造 `LogLine`，消息表达式也不会执行。

```cpp
PANS_LOG_DEBUG(logger) << "debug message";
PANS_LOG_INFO(logger) << "id=" << id << " name=" << name;
```

### 8.2 printf 风格日志

```cpp
#define PANS_LOG_FMT_LEVEL(logger, level, format, ...) \
    if (auto pans_log_logger = (logger); !pans_log_logger) {} \
    else if (const auto pans_log_level = (level); \
             !pans_log_logger->shouldLog(pans_log_level)) {} \
    else pans::detail::LogPrintf(\
        *pans_log_logger, pans_log_level, __LINE__, __FILE__, \
        (format) __VA_OPT__(,) __VA_ARGS__)
```

`LogPrintf` 先使用固定大小的数组调用 `vsnprintf`。如果返回值表明缓冲区不够，再根据所需长度创建 `std::vector<char>` 并进行第二次格式化。两次访问可变参数之间使用 `va_copy`，因为第一次 `vsnprintf` 可能改变 `va_list` 的当前位置。

```cpp
PANS_LOG_FMT_INFO(logger, "user=%d name=%s", user_id, name.c_str());
```

如果格式字符串为空指针，输出 `<null-format>`；格式化失败则输出 `<format-error>`。`LogPrintf` 最终仍然通过 `LogLine` 的析构路径提交，因此两种调用方式共享相同的上下文和 Formatter。

## 9. LoggerManager 与单例访问

```cpp
class LoggerManager final
{
public:
    LoggerManager()
        : m_root(std::make_shared<Logger>("root"))
    {
        m_root->addAppender(MakeStdoutAppender());
        m_loggers.emplace("root", m_root);
    }

    LoggerPtr getLogger(std::string_view name)
    {
        ASSERT_RETVAL2(!name.empty(), nullptr,
                       "logger name cannot be empty");
        std::lock_guard<std::mutex> lock(m_mutex);
        const auto iterator = m_loggers.find(std::string(name));
        if (iterator != m_loggers.end())
        {
            return iterator->second;
        }

        auto logger = std::make_shared<Logger>(std::string(name));
        detail::LoggerAccess::SetRoot(*logger, m_root);
        m_loggers.emplace(logger->getName(), logger);
        return logger;
    }
};

LoggerManager& GetLoggerManager()
{
    static LoggerManager manager;
    return manager;
}
```

函数内的静态对象提供线程安全的首次初始化。管理器构造根 Logger，并默认挂载标准输出 Appender。命名 Logger 保存在 `std::unordered_map` 中，同名请求返回相同的 `LoggerPtr`。

注意，管理器只负责创建和注册 Logger；命名 Logger 默认没有自己的 Appender，而是通过 `m_root` 回退到根 Logger。因此普通模块可以直接使用 `PANS_LOG_NAME("network")`，日志仍然会输出到根 Logger 的标准输出。

## 10. Appender 的绑定与刷新

Logger 可以绑定多个 Appender：

```cpp
auto logger = std::make_shared<pans::Logger>("test");
logger->addAppender(pans::MakeStdoutAppender());
logger->addAppender(pans::MakeFileAppender(output_path.string()));
```

同一条格式化记录会依次交给每一个 Appender。每个 Appender 还会根据自己的级别再次过滤，因此 Logger 级别和 Appender 级别可以分别配置。

```cpp
logger->removeAppender(appender);
logger->clearAppenders();
logger->flush();
logger->sync();
```

`flush()` 适合把用户态缓冲区尽快推向操作系统；`sync()` 进一步要求输出目标完成同步。Logger 没有 Appender 时，这两个操作同样会向根 Logger 回退。

## 11. 最新测试程序

`tests/test_logger.cpp` 同时验证标准输出、文件输出、流式宏、格式化宏和快捷宏：

```cpp
const std::filesystem::path output_path =
    std::filesystem::temp_directory_path() / "test_logger.log";
std::ofstream(output_path, std::ios::binary | std::ios::trunc);

auto logger = std::make_shared<pans::Logger>("test");
logger->addAppender(pans::MakeStdoutAppender());
logger->addAppender(pans::MakeFileAppender(output_path.string()));

PANS_LOG_DEBUG(logger) << "debug message";
PANS_LOG_INFO(logger) << "info message";
PANS_LOG_FMT_ERROR(logger, "error=%d", 42);
```

测试还把 `logger` 赋给 `g_logger`，然后使用：

```cpp
auto g_logger = logger;
LOG_INFO << "c=" << c << " i=" << i;
```

这组宏约定了业务代码中的全局变量名称是 `g_logger`。程序结束前调用 `logger->sync()`，再检查临时目录中的 `test_logger.log`，可以确认同样的记录同时写入标准输出和日志文件。
