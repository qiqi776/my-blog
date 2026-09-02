---
title: 日志终端的抽象Appender
date: 2026-09-02
order: 7
---

我们继续学习日志系统的另一个核心组件：Appender（日志输出器）。

## 1 Appender.h 实现

```cpp
#ifndef PANS_INCLUDE_PANS_LOGGER_APPENDER_H
#define PANS_INCLUDE_PANS_LOGGER_APPENDER_H

#include <memory>
#include <string>

#include <pans/export.h>
#include <pans/logger/log_level.h>

namespace pans {
class PANS_API Appender final
{
    public:
    class Impl;   // 前向声明的内部实现类
    ...
private:
    std::unique_ptr<Impl> m_impl;
};
} // namespace pans
#endif
```

#### 设计模式：Pimpl

Pimpl (Pointer to Implementation)，即“指向实现的指针”。主要思想是将类的私有数据成员和实现细节隐藏在 .cpp 文件中，只在头文件中保留一个指向实现类的不完整类型指针。这样做的好处：

- **隐藏实现细节**：用户代码只看到接口，看不到内部数据结构，降低了耦合。
- **减少编译依赖**：修改实现不需要重新编译包含头文件的用户代码。
- **二进制兼容性**：当库升级时，如果接口不变，实现可以随意变化。

这里的 `Impl` 声明是 `class Impl;` 只是前向声明，没有定义。真正的定义会在 `appender.cpp` 中给出。在头文件中，我们只声明了一个不完整的类型，并用 `std::unique_ptr<Impl>` 指向它，这是一种常见做法。

```cpp
~Appender() = default;
```

这里将析构函数声明为 `default`，而不是在 .cpp 中定义。对于 `std::unique_ptr`，如果使用默认析构函数，它会在 `Appender` 的析构函数被调用时自动调用 `delete` 释放 `Impl` 对象。然而，默认析构函数是在**编译器看到 `Appender` 类定义时生成的**。但在头文件中，`Impl` 是不完整类型，此时生成析构函数会导致编译错误，因为编译器不知道如何删除一个不完整类型的对象。

但是这里写作 `~Appender() = default;` 是在类内声明了一个默认析构函数，它并不是内联展开的，而是要求编译器在需要的地方生成。由于我们直接在头文件中使用 `= default`，它变成了一个声明，而定义会在编译器认为合适的位置生成。实际上，标准规定对于含有不完整类型成员的类，如果析构函数是默认的，必须确保在完整类型可见的地方生成析构函数。通常编译器会在包含 `Appender` 的翻译单元中实例化，但这里可能会出现问题。

然而，`std::unique_ptr<Impl>` 的析构函数本身要求 `Impl` 是完整的（因为要调用 `delete`）。但是 `std::unique_ptr` 有一个特殊设计：它的析构函数可以在不完整类型下实例化，但只有在生成 `unique_ptr` 的析构函数的代码处才需要完整类型。如果 `Appender` 的析构函数是 `default`，那么它的定义会在编译器认为需要的地方生成，可能是在头文件中被隐式内联。为了避免这个问题，通常的做法是在头文件中**只声明**析构函数，然后在 .cpp 文件中定义 `Appender::~Appender() = default;`，此时 `Impl` 已经完整。但这里却直接在头文件中使用了 `= default`，这是否会出错？

实际上，`std::unique_ptr` 的析构函数在 C++ 标准库中使用了 `static_assert` 检查 `sizeof(T) > 0` 来要求完整类型，但这只在 `unique_ptr` 的析构函数被实例化时发生。如果 `Appender` 的析构函数是默认的，编译器在生成 `Appender` 的析构函数时，会调用 `m_impl` 的析构函数，此时需要 `Impl` 完整。但在头文件中，`Impl` 不完整，所以如果 `Appender` 的析构函数被实例化，就会编译错误。然而，由于 `Appender` 的析构函数是 `= default`，编译器可能会推迟生成，直到某个源文件需要它，而在那个源文件中可能包含了 `Impl` 的完整定义。这是一种常见的“技巧”，但需要确保正确性。更安全的做法是像其他资料推荐的那样，在头文件中声明 `~Appender();`，然后在 .cpp 中定义 `Appender::~Appender() = default;`。这个项目选择在这里直接 `= default`，可能是为了简洁，并且编译器通常可以处理这种情况，但存在风险。不过我们不需要过于纠结，可以认为框架作者已知晓并处理好了。

```cpp
Appender(const Appender&) = delete;
Appender& operator=(const Appender&) = delete;
Appender(Appender&&) = delete;
Appender& operator=(Appender&&) = delete;
```

这四行分别删除了拷贝构造函数、拷贝赋值运算符、移动构造函数、移动赋值运算符。

```cpp
void setLevel(LogLevel::Level level) noexcept;
[[nodiscard]] LogLevel::Level getLevel() const noexcept;
```

Appender 可以设置一个日志级别阈值。当 Logger 产生一条日志时，只有当该日志级别高于或等于 Appender 的级别时，才会输出到该 Appender。这允许用户对不同目的地设置不同的过滤条件，比如控制台只输出 DEBUG 级别以上的，文件记录 INFO 以上等。

```cpp
void flush();
void sync();
```

- `flush`：通常用于将数据从应用进程缓冲区输出到操作系统的缓冲区。
- `sync`：要求操作系统把数据从操作系统的缓冲区提交到磁盘的缓冲区中。

这两个函数没有 `noexcept`，因为它们可能会失败（比如磁盘满、网络错误等）。

```cpp
private:
    explicit Appender(std::unique_ptr<Impl> impl) noexcept;
    std::unique_ptr<Impl> m_impl;
    friend class detail::AppenderAccess;
```

构造函数是私有的，这意味着外部不能直接创建 `Appender` 对象。因为 Appender 的创建应该通过工厂函数进行，以便集中管理实现细节。

在 `namespace detail` 中前置声明了 `class AppenderAccess;`，然后在 `Appender` 中声明 `friend class detail::AppenderAccess;`。这个 `AppenderAccess` 类并不是我们常见的设计，而是一种友元代理：通过将友元授予一个专门的访问类，而不是直接授予工厂函数，可以更灵活地控制哪些代码能够访问私有成员。

`m_impl` 持有一个指向实现类的独占指针，确保 `Appender` 销毁时自动释放实现对象。

```cpp
using AppenderPtr = std::shared_ptr<Appender>;

[[nodiscard]] PANS_API AppenderPtr MakeStdoutAppender();
[[nodiscard]] PANS_API AppenderPtr MakeFileAppender(std::string file_name);
```

- `AppenderPtr` 是 `std::shared_ptr<Appender>` 的别名。使用共享指针是因为多个 Logger 可以共享同一个 Appender，这样引用计数可以管理生命周期。
- `MakeStdoutAppender()`：创建一个输出到标准输出的 Appender。
- `MakeFileAppender(std::string file_name)`：创建一个输出到文件的 Appender，接收文件名。

两个函数都标记 `PANS_API` 导出，并且 `[[nodiscard]]` 提醒不要忽略返回的指针。它们返回共享指针，而不是裸指针或 unique_ptr，以方便共享。

## 2 文件角色与包含

```cpp
#ifndef PANS_SRC_LOGGER_APPENDER_IMPL_H
#define PANS_SRC_LOGGER_APPENDER_IMPL_H

#include <atomic>
#include <cstdio>
#include <mutex>
#include <string_view>

#include <pans/logger/appender.h>

class Appender::Impl
{
public:
    virtual ~Impl() = default;
    void append(LogLevel::Level level, std::string_view formatted_record) noexcept;
    void setLevel(LogLevel::Level level) noexcept;
    [[nodiscard]] LogLevel::Level getLevel() const noexcept;
    void flush();
    void sync();

protected:
    virtual void writeUnlocked(std::string_view formatted_record) noexcept = 0;
    virtual void flushUnlocked() noexcept = 0;
    virtual void syncUnlocked() noexcept = 0;

    std::mutex m_mutex;

private:
    std::atomic<LogLevel::Level> m_level{LogLevel::Level::LOG_LV_DEBUG};
};
```

### 2.1 Impl 的作用

在 `appender.h` 中，`Appender` 持有一个 `std::unique_ptr<Impl> m_impl;`。`Impl` 封装了 Appender 的具体输出行为。使用 Pimpl 模式，将实现细节从公开接口中分离，允许我们随意修改内部实现而不影响。

### 2.2 公有接口

- `virtual ~Impl() = default` 虚析构函数，确保通过基类指针删除派生类对象时能正确调用派生类析构函数。`Impl` 作为抽象基类，其派生类可能持有文件句柄等资源，所以必须有虚析构。

- `void append(LogLevel::Level level, std::string_view formatted_record) noexcept` 这是日志输出的**统一入口**。调用者传入日志级别和已经格式化好的字符串。该方法会：
    1. 检查日志级别是否达到 Appender 的过滤阈值。
    2. 加锁（`std::lock_guard`）保证多线程安全。
    3. 调用纯虚函数 `writeUnlocked` 执行实际的写入操作。

- `void setLevel(LogLevel::Level level) noexcept` 设置日志级别阈值，通过原子操作直接存储，无需加锁，高效且线程安全。

- `[[nodiscard]] LogLevel::Level getLevel() const noexcept` 获取当前级别，同样通过原子变量读取，`[[nodiscard]]` 提醒不要忽略返回值。

- `void flush();` 和 `void sync()` 刷新缓冲区或强制同步。它们通常会加锁然后调用相应的纯虚函数 `flushUnlocked` / `syncUnlocked`。注意这两个函数没有 `noexcept`，因为底层 I/O 可能失败并抛出异常。

### 2.3 纯虚函数

```cpp
protected:
    virtual void writeUnlocked(std::string_view formatted_record) noexcept = 0;
    virtual void flushUnlocked() noexcept = 0;
    virtual void syncUnlocked() noexcept = 0;

    std::mutex m_mutex;
```

这三个纯虚函数是模板方法模式中的原语操作，由派生类实现。它们被称为 `Unlocked`，表示调用这些函数时**已经持有互斥锁**，不需要再自行加锁。这样的设计使得基类 `Impl` 可以集中处理锁和级别检查，派生类只需专注于真正的输出。

- `writeUnlocked`：将格式化字符串写入具体目的地（如 stdout、文件）。
- `flushUnlocked`：刷新内部缓冲区。
- `syncUnlocked`：强制将数据同步到磁盘（例如调用 `fsync`）。

由于它们被声明为纯虚函数，`Impl` 是抽象基类，不能直接实例化。

### 2.4 数据成员

```cpp
protected:
    std::mutex m_mutex;
private:
    std::atomic<LogLevel::Level> m_level{LogLevel::Level::LOG_LV_DEBUG};
```

- `std::mutex m_mutex`：互斥锁，保护 `writeUnlocked` 等写入操作，防止多个线程同时向同一个 Appender 写入导致数据交错。它被放在 `protected` 区域，允许派生类在必要时直接使用（虽然通常派生类不需要直接访问，因为锁已由基类方法管理）。
- `std::atomic<LogLevel::Level> m_level`：日志级别阈值，使用原子类型存储。因为 `setLevel` 和 `getLevel` 可能被多个线程调用，使用原子可以避免数据竞争，且无需加锁。默认值为 `DEBUG`，即输出所有级别。

### 2.5 AppenderAccess 友元代理类

```cpp
namespace detail {

class AppenderAccess final
{
public:
    [[nodiscard]] static AppenderPtr MakeStdoutAppender();
    [[nodiscard]] static AppenderPtr MakeFileAppender(std::string file_name);
    static void Append(const AppenderPtr& appender, LogLevel::Level level, std::string_view formatted_record) noexcept;
};

} // namespace detail
```

在公开头文件 `appender.h` 中，`Appender` 的构造函数是私有的，且声明了 `friend class detail::AppenderAccess;`。只有 `AppenderAccess` 类可以访问 `Appender` 的私有成员，包括私有构造函数和 `m_impl`。

这样做的原因：

- 禁止外部直接创建 `Appender` 对象，强制通过工厂函数（`MakeStdoutAppender`、`MakeFileAppender`）创建，以便内部正确初始化 `Impl`。
- 将“有权访问私有成员”的权限赋予一个专门的类，而不是直接授予多个工厂函数，方便统一管理和扩展。
- `AppenderAccess` 提供了静态方法 `Append`，允许在外部（如 Logger 类中）以统一方式向 Appender 写入日志，而无需将 `Appender::Impl` 暴露给外界。

```cpp
static void Append(const AppenderPtr& appender, LogLevel::Level level, std::string_view formatted_record) noexcept;
```

这是日志输出的**统一静态入口**。外部代码（如 Logger）无需知道 `Appender` 的内部 `Impl` 结构，只需调用 `AppenderAccess::Append(appender, level, record)`，由该方法：

1. 通过 `appender` 获取其内部的 `m_impl` 指针（因为 `AppenderAccess` 是友元，可以访问私有成员）。
2. 调用 `impl->append(level, record)`，完成级别过滤、加锁和实际写入。

### 2.6 整体流程

1. Logger 产生一条日志，经过 Formatter 格式化后得到字符串 `formatted_record` 和级别 `level`。
2. Logger 调用 `detail::AppenderAccess::Append(appender, level, formatted_record)`。
3. `AppenderAccess::Append` 访问 `appender` 的私有 `m_impl`，调用 `impl->append(level, record)`。
4. `Impl::append` 内部：
    - 读取原子变量 `m_level`，如果 `level < m_level`，则直接返回（不输出）。
    - 否则，使用 `std::lock_guard<std::mutex> lock(m_mutex);` 加锁。
    - 调用虚函数 `writeUnlocked(record)`。
5. 具体派生类（如 `StdoutAppenderImpl`）的 `writeUnlocked` 执行实际写入（例如 `fwrite` 到 `stdout` 或写文件）。
6. 如果需要刷新或同步，Logger 或用户调用 `appender->flush()` / `appender->sync()`，类似地通过 `Impl` 的公有方法加锁并调用对应的纯虚函数。

## 3 Appender 具体实现

### 3.1 Appender 构造与公有方法的实现

```cpp
#include "logger/appender_impl.h"

#include <cerrno>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <system_error>
#include <utility>

#include <pans/macros.h>

#if defined(_WIN32)
#include <io.h>
#else
#include <unistd.h>
#endif

Appender::Appender(std::unique_ptr<Impl> impl) noexcept
    : m_impl(std::move(impl))
{}
```

构造函数是私有的。它接收一个 `unique_ptr<Impl>`，通过 `std::move` 将其所有权转移给成员 `m_impl`。`noexcept` 保证不抛出异常（移动 `unique_ptr` 不会抛出）。

```cpp
void Appender::setLevel(LogLevel::Level level) noexcept
{
    m_impl->setLevel(level);
}

LogLevel::Level Appender::getLevel() const noexcept
{
    return m_impl->getLevel();
}

void Appender::flush()
{
    m_impl->flush();
}

void Appender::sync()
{
    m_impl->sync();
}
```

这些方法只是简单地调用 `m_impl` 的对应方法。这种转发模式是 Pimpl 的典型做法，公开接口保持简洁，实现细节都在 `Impl` 中。

### 3.2 Appender::Impl 的关键成员函数

```cpp
void Appender::Impl::append(LogLevel::Level level, std::string_view formatted_record) noexcept
{
    if(static_cast<std::uint8_t>(level) < static_cast<std::uint8_t>(getLevel()))
    {
        return;
    }

    try
    {
        std::lock_guard<std::mutex> lock(m_mutex);
        writeUnlocked(formatted_record);
        if(level == LogLevel::Level::LOG_LV_FATAL)
        {
            flushUnlocked();
        }
    }
    catch(...)
    {
        constexpr std::string_view message = "pans logger: appender operation failed\n";
        std::fwrite(message.data(), 1, message.size(), stderr);
    }
}
```

#### 级别过滤

- 首先比较传入的日志级别 `level` 与 Appender 设置的阈值 `getLevel()`。`static_cast<std::uint8_t>` 将枚举转换为其底层整数类型（`LogLevel::Level` 底层是 `uint8_t`），以便进行数值比较。由于枚举值按严重程度递增（DEBUG=1, INFO=2, ..., FATAL=5），数值越小级别越低。如果 `level < getLevel()`，说明该日志级别低于阈值，直接返回。默认阈值是 `DEBUG`（1），所以所有级别都能输出。

#### 加锁与写入

- 获取互斥锁，调用 `writeUnlocked(formatted_record)`，由派生类实现具体的输出。如果日志级别是 `FATAL`，额外调用 `flushUnlocked()`，确保这条严重错误立即写入操作系统缓冲区，防止程序崩溃时丢失。

FATAL 通常表示程序即将终止或遇到不可恢复错误，日志可能至关重要，必须尽快持久化。因此在写入后立即 flush 是一种合理的策略。

#### 异常处理

- `append` 声明为 `noexcept`，意味着它不能抛出异常。但加锁操作 `std::lock_guard` 的构造函数可能抛出 `std::system_error`（例如死锁检测或资源不足），`writeUnlocked` 虽然声明为 `noexcept`，但不能完全保证内部不抛异常。为了严格遵守 `noexcept`，我们用 `try-catch(...)` 捕获所有异常。捕获后，打印一条固定的错误信息到 `stderr`，告知用户 Appender 操作失败，但不会让异常传播到日志调用者。使用 `std::fwrite` 而不是 `std::cerr` 是为了避免在异常处理中再次抛出异常，因为 `fwrite` 是 C 函数，不会抛 C++ 异常。

### 3.3 setLevel 与 getLevel：原子操作

```cpp
void Appender::Impl::setLevel(LogLevel::Level level) noexcept
{
    m_level.store(level, std::memory_order_release);
}

LogLevel::Level Appender::Impl::getLevel() const noexcept
{
    return m_level.load(std::memory_order_acquire);
}
```

- `store` 使用 `memory_order_release`，`load` 使用 `memory_order_acquire`，形成一对 release-acquire 同步。这样，如果一个线程设置了新级别，另一个线程读取时能看到之前所有写操作的结果。
- 使用原子操作使得 `setLevel` 和 `getLevel` 无需加锁，非常高效。

### 3.4 flush 与 sync：加锁后调用纯虚函数

```cpp
void Appender::Impl::flush()
{
    std::lock_guard<std::mutex> lock(m_mutex);
    flushUnlocked();
}

void Appender::Impl::sync()
{
    std::lock_guard<std::mutex> lock(m_mutex);
    syncUnlocked();
}
```

- 这两个方法没有 `noexcept`，因为 `lock_guard` 可能抛异常，且底层操作也可能抛异常。调用者需要处理可能的异常。
- 加锁后调用派生类实现的 `flushUnlocked` 或 `syncUnlocked`。

### 3.5 具体 Appender 实现

```cpp
class StdoutAppenderImpl final : public Appender::Impl
{
    protected:
    void writeUnlocked(std::string_view formatted_record) noexcept override
    {
        std::cout.write(formatted_record.data(), static_cast<std::streamsize>(formatted_record.size()));
    }

    void flushUnlocked() noexcept override
    {
        std::cout.flush();
    }

    void syncUnlocked() noexcept override
    {
        flushUnlocked();
    }
};
```

#### StdoutAppenderImpl：输出到标准输出

- 继承 `Appender::Impl` 并实现三个纯虚函数。
- `writeUnlocked` 使用 `std::cout.write` 将字符串写入标准输出流。注意使用 `write` 而不是 `operator<<`，因为它不进行格式化，性能更好，而且适合二进制安全输出。
- `flushUnlocked` 调用 `std::cout.flush()` 刷新 C++ 流缓冲区，强制输出。
- `syncUnlocked` 直接调用 `flushUnlocked()`，因为标准输出通常无法也不必要进行 `fsync`（同步到磁盘没有意义，stdout 可能是终端或管道）。

由于基类 `append` 已经加了锁，所以多个线程同时写 stdout 时不会交错。

```cpp
class FileAppenderImpl final : public Appender::Impl
{
public:
    explicit FileAppenderImpl(const std::string& file_name)
    {
        if(file_name.empty())
        {
            throw std::invalid_argument("logger file name cannot be empty");
        }
        m_file = std::fopen(file_name.c_str(), "ab");
        if(m_file == nullptr)
        {
            throw std::system_error(errno, std::generic_category(), "failed to open logger file: " + file_name);
        }
    }

    ~FileAppenderImpl() override
    {
        if(m_file != nullptr)
        {
            std::fflush(m_file);
            std::fclose(m_file);
        }
    }

protected:
    void writeUnlocked(std::string_view formatted_record) noexcept override
    {
        std::fwrite(formatted_record.data(), 1, formatted_record.size(), m_file);
    }

    void flushUnlocked() noexcept override
    {
        std::fflush(m_file);
    }

    void syncUnlocked() noexcept override
    {
        flushUnlocked();
#if defined(_WIN32)
        ::_commit(::_fileno(m_file));
#else
        ::fdatasync(::fileno(m_file));
#endif
    }

private:
    std::FILE* m_file = nullptr;
};
```

#### `FileAppenderImpl`：输出到文件

- 检查文件名非空，否则抛出 `std::invalid_argument`。使用 `std::fopen(file_name.c_str(), "ab")` 以**追加模式**打开文件。`"ab"` 表示二进制追加，如果文件不存在则创建，如果存在则在末尾追加。如果打开失败（返回 `nullptr`），抛出 `std::system_error`，携带系统错误码 `errno` 和错误信息。

- 先 `fflush` 刷新缓冲区，再 `fclose` 关闭文件。注意析构函数不会被 `noexcept` 修饰，但关闭文件一般不会抛出异常。

- 使用 `std::fwrite` 写入文件，参数为数据指针、元素大小（1 字节）、元素个数、文件指针。不检查返回值，忽略可能的写入错误（磁盘满等）。在日志系统中，通常选择忽略错误，以免影响主程序运行。

- `std::fflush(m_file)` 将 C 标准库缓冲区刷到操作系统内核缓冲区。

- 首先调用 `flushUnlocked()`，确保用户态数据进入内核。然后调用平台特定的强制同步函数：
    - Windows：`_commit(_fileno(m_file))`，将文件描述符对应数据强制写入磁盘。
    - POSIX：`fdatasync(fileno(m_file))`，只同步文件数据（不更新元数据，比 `fsync` 稍快）。

**为什么使用 C 文件 API 而不是 C++ 流？**  
C++ 文件流（`std::ofstream`）虽然易用，但控制底层同步（如 `fdatasync`）比较困难。C 的 `FILE*` 配合 `fileno` 可以方便地调用系统级同步函数，且性能可控。此外，`FILE*` 在异常处理中更简单（不会抛出 C++ 异常）。

### 3.6 AppenderAccess 的实现

```cpp
AppenderPtr detail::AppenderAccess::MakeStdoutAppender()
{
    return AppenderPtr(new Appender(std::make_unique<StdoutAppenderImpl>()));
}

AppenderPtr detail::AppenderAccess::MakeFileAppender(std::string file_name)
{
    return AppenderPtr(new Appender(std::make_unique<FileAppenderImpl>(file_name)));
}

void detail::AppenderAccess::Append(const AppenderPtr& appender, LogLevel::Level level, std::string_view formatted_record) noexcept
{
    if(appender != nullptr)
    {
        appender->m_impl->append(level, formatted_record);
    }
}
```

- `MakeStdoutAppender` 创建一个 `StdoutAppenderImpl`，包装进 `unique_ptr`，然后传给 `Appender` 的私有构造函数，最后用 `new Appender(...)` 的结果构造 `shared_ptr`。
- `MakeFileAppender` 类似，但会传递文件名，可能抛出异常（由 `FileAppenderImpl` 构造函数）。
- `Append` 方法检查 `appender` 是否为空，然后直接访问其私有成员 `m_impl`，调用 `append`。由于 `AppenderAccess` 是 `Appender` 的友元，所以可以访问私有成员。

**为什么用 `new Appender(...)` 而不是 `std::make_shared<Appender>(...)`？**  
因为 `Appender` 的构造函数是私有的，`std::make_shared` 无法访问私有构造函数（它没有友元权限）。而 `AppenderAccess` 是友元，可以调用私有构造函数，所以使用 `new` 创建裸指针再传给 `shared_ptr` 是正确做法。这样可以保持构造的私密性。

### 3.7 公开工厂函数

```cpp
AppenderPtr MakeStdoutAppender()
{
    return detail::AppenderAccess::MakeStdoutAppender();
}

AppenderPtr MakeFileAppender(std::string file_name)
{
    return detail::AppenderAccess::MakeFileAppender(std::move(file_name));
}
```

这两个是定义在 `pans` 命名空间中的公开工厂函数。它们只是将调用转发给 `AppenderAccess` 的静态方法。

`std::move(file_name)` 将文件名参数移动给 `MakeFileAppender`，避免不必要的拷贝。由于参数按值传递，调用者传入的字符串会被移动到内部。
