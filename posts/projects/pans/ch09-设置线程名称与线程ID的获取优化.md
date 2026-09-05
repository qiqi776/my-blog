---
title: 设置线程名称与线程ID的获取优化
date: 2026-09-04
order: 9
---

这一节为 `pans` 补充两个跨平台基础工具：`StringUtils` 和线程工具函数。

`StringUtils` 负责 UTF-8 与 `std::wstring` 之间的转换；线程工具则负责获取当前线程 ID、设置线程名称和读取线程名称。

## 1. 为什么要自己封装

不同操作系统对宽字符、线程 ID 和线程名称的定义并不完全一致：

- Windows 的 `wchar_t` 通常是 16 位，使用 UTF-16；Linux 的 `wchar_t` 通常是 32 位，使用 UTF-32。
- Linux 可以通过系统调用获取内核线程 ID；Windows 则提供自己的线程 ID 接口。
- Linux 的线程名称有长度限制，Windows 使用线程描述对象保存名称。
- `std::thread::id` 适合 C++ 程序内部比较，但不一定是操作系统工具能直接识别的线程 ID。

## 2.StringUtils 接口设计

### 2.1 纯静态工具类

```cpp
#ifndef PANS_INCLUDE_PANS_UTILS_STRING_UTILS_H
#define PANS_INCLUDE_PANS_UTILS_STRING_UTILS_H

#include <cstring>
#include <cstdarg>
#include <string_view>

#include <pans/export.h>

namespace pans {

class PANS_API StringUtils final
{
public:
    StringUtils() = delete;

    [[nodiscard]] static std::string WStringToString(std::wstring_view text) noexcept;
    [[nodiscard]] static std::wstring StringToWString(std::string_view text) noexcept;
};

} // namespace pans

#endif
```

`StringUtils` 没有任何对象状态，所有操作都是静态函数，因此通过 `StringUtils() = delete` 禁止实例化，明确表达它是一个工具类。

两个接口都使用 `std::string_view` 或 `std::wstring_view` 作为输入，避免为了传参额外复制字符串；返回值使用拥有内存的 `std::string` 或 `std::wstring`，因为转换结果需要在函数返回后继续存在。

函数声明为 `noexcept`，实现内部会捕获异常。转换失败时结合项目已有的 `ASSERT_RETVAL2` 或 `ASSERT_NOEFFECT2` 宏报告错误，并返回空字符串。

## 3. UTF-8 编码与 Unicode 码点

UTF-8 使用 1 到 4 个字节表示一个 Unicode 码点：

| 码点范围               | UTF-8 字节数 |
| ---------------------- | ------------ |
| `U+0000` - `U+007F`    | 1            |
| `U+0080` - `U+07FF`    | 2            |
| `U+0800` - `U+FFFF`    | 3            |
| `U+10000` - `U+10FFFF` | 4            |

实现首先定义 Unicode 的合法上限，以及 UTF-16 高、低代理项的范围：

```cpp
constexpr u32 MAX_UNICODE_CODE_POINT = 0x10FFFF;
constexpr u32 HIGH_SURROGATE_FIRST = 0xD800;
constexpr u32 HIGH_SURROGATE_LAST = 0xDBFF;
constexpr u32 LOW_SURROGATE_FIRST = 0xDC00;
constexpr u32 LOW_SURROGATE_LAST = 0xDFFF;

static_assert(sizeof(wchar_t) == 2 || sizeof(wchar_t) == 4,
              "StringUtils requires a UTF-16 or UTF-32 wchar_t");
```

这里的 `static_assert` 是编译期约束。实现只考虑 UTF-16 和 UTF-32 两种常见的 `wchar_t` 表示，如果平台使用其他宽字符大小，就应该在编译阶段直接暴露问题，而不是产生难以排查的运行时乱码。

### 3.1 将码点追加为 UTF-8

`AppendUtf8` 根据码点所在范围生成对应的首字节和后续字节。UTF-8 的后续字节都具有 `10xxxxxx` 的形式，因此可以通过右移和 `0x3F` 掩码逐段取出低 6 位：

```cpp
void AppendUtf8(std::string& output, u32 code_point)
{
    if (code_point <= 0x7F)
    {
        output.push_back(static_cast<char>(code_point));
    }
    else if (code_point <= 0x7FF)
    {
        output.push_back(static_cast<char>(0xC0U | (code_point >> 6U)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    }
    else if (code_point <= 0xFFFF)
    {
        output.push_back(static_cast<char>(0xE0U | (code_point >> 12U)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    }
    else
    {
        output.push_back(static_cast<char>(0xF0U | (code_point >> 18U)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 12U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | ((code_point >> 6U) & 0x3FU)));
        output.push_back(static_cast<char>(0x80U | (code_point & 0x3FU)));
    }
}
```

调用者必须在进入这个函数前完成合法性检查，否则超过 `U+10FFFF` 的值可能被错误编码。

### 3.2 严格解码 UTF-8

反方向转换由 `DecodeUtf8CodePoint` 完成。函数维护一个 `offset`，每次从输入中读取一个完整的 UTF-8 字符，并把结果写入 `code_point`。

解码过程有几层检查：

1. 首字节决定当前字符包含几个字节；
2. 输入剩余长度必须足够；
3. 每个后续字节必须满足 `10xxxxxx` 格式；
4. 码点不能使用非最短编码；
5. 码点不能超过 `U+10FFFF`；
6. 代理项范围不能直接作为 Unicode 码点出现。

其中，首字节使用 `0xC2` 而不是 `0xC0` 作为两字节序列的起点，正是为了拒绝过长编码。比如 ASCII 字符不应该被编码成两字节形式，否则同一个字符会出现多种字节表示，既不规范，也可能造成安全问题。

## 4. 宽字符串转换

### 4.1 `WStringToString`

宽字符串转 UTF-8 时，Linux 的 UTF-32 可以直接把每个 `wchar_t` 视为码点，但仍要检查范围和代理项。Windows 的 UTF-16 则需要特殊处理代理对：

```cpp
if constexpr (sizeof(wchar_t) == 2)
{
    if (IsHighSurrogate(code_point))
    {
        ++i;
        ASSERT_RETVAL2(i < text.size(), {}, "宽字符串包含不完整的 UTF-16 代理对");

        const u32 low_surrogate = static_cast<u32>(text[i]);
        ASSERT_RETVAL2(IsLowSurrogate(low_surrogate), {},
                       "宽字符串包含非法 UTF-16 代理对");

        code_point = 0x10000U
            + ((code_point - HIGH_SURROGATE_FIRST) << 10U)
            + (low_surrogate - LOW_SURROGATE_FIRST);
    }
    else
    {
        ASSERT_RETVAL2(!IsLowSurrogate(code_point), {},
                       "宽字符串包含孤立的 UTF-16 低代理项");
    }
}
```

UTF-16 用一对 16 位值表示超出 `U+FFFF` 的字符：第一个是高代理项，第二个是低代理项。只有两者成对出现时，才能还原出一个有效的 21 位 Unicode 码点。

如果输入以高代理项结尾，或者高代理项后面不是低代理项，函数立即返回空字符串。孤立的低代理项也会被拒绝。

### 4.2 `StringToWString`

UTF-8 转宽字符串的核心步骤是先循环解码码点，然后根据 `wchar_t` 大小选择输出方式：

```cpp
while (offset < text.size())
{
    u32 code_point = 0;
    const bool decoded = DecodeUtf8CodePoint(text, offset, code_point);
    ASSERT_RETVAL2(decoded, {}, "字符串包含非法 UTF-8 编码");

    if constexpr (sizeof(wchar_t) == 2)
    {
        if (code_point <= 0xFFFF)
        {
            result.push_back(static_cast<wchar_t>(code_point));
        }
        else
        {
            code_point -= 0x10000;
            result.push_back(static_cast<wchar_t>(HIGH_SURROGATE_FIRST + (code_point >> 10U)));
            result.push_back(static_cast<wchar_t>(LOW_SURROGATE_FIRST + (code_point & 0x3FFU)));
        }
    }
    else
    {
        result.push_back(static_cast<wchar_t>(code_point));
    }
}
```

在 UTF-16 平台上，`U+10000` 以上的码点需要重新拆成高、低代理项；UTF-32 平台则可以直接写入一个 `wchar_t`。

两个公开转换函数都使用 `try/catch` 保护内存分配等可能抛异常的操作。即便函数声明了 `noexcept`，也不能让异常穿过边界，否则会触发 `std::terminate`。

## 5. 线程工具接口

```cpp
#ifndef PANS_INCLUDE_PANS_UTILS_THREAD_UTILS_H
#define PANS_INCLUDE_PANS_UTILS_THREAD_UTILS_H

#include <string>
#include <string_view>

#include <pans/export.h>
#include <pans/macros.h>

namespace pans {

[[nodiscard]] PANS_API u64 GetThreadId() noexcept;
PANS_API void SetThreadName(std::string name);
[[nodiscard]] PANS_API std::string_view GetThreadName() noexcept;

} // namespace pans

#endif
```

这里的接口只描述“当前线程”，不需要额外传入线程对象。调用线程工具的代码可以直接写入日志、断言和调试输出中，避免将平台 API 泄漏到业务层。

## 6. 跨平台获取线程 ID

```cpp
u64 GetThreadId() noexcept
{
#if defined(__linux__)
    static thread_local const u64 THREAD_ID =
        static_cast<u64>(::syscall(SYS_gettid));
#elif defined(_WIN32)
    static thread_local const u64 THREAD_ID =
        static_cast<u64>(::GetCurrentThreadId());
#else
    static thread_local const u64 THREAD_ID = static_cast<u64>(
        std::hash<std::thread::id>{}(std::this_thread::get_id()));
#endif
    return THREAD_ID;
}
```

Linux 分支调用 `gettid` 系统调用，得到可以在 `top -H -p <pid>` 等工具中观察到的内核线程 ID。Windows 分支使用 `GetCurrentThreadId`。其他平台没有统一的原生实现，因此退化为当前 `std::thread::id` 的哈希值。

ID 使用 `static thread_local` 缓存：每个线程第一次调用时完成一次获取，之后直接返回缓存值。线程 ID 在线程生命周期内不会变化，这样既保持语义正确，也避免日志高频调用时反复进入系统调用。

## 7. 线程名称的保存与同步

线程名称同时存在两个层面：

- `t_thread_name` 保存应用程序侧的完整名称，供 `GetThreadName()` 返回；
- `SetNativeThreadName` 将名称同步给操作系统，供调试器和系统监控工具查看。

```cpp
constexpr std::string_view DEFAULT_THREAD_NAME = "UNKNOWN";
thread_local std::string t_thread_name = GetNativeThreadName();
```

使用 `thread_local` 很关键。线程 A 修改名称不能影响线程 B；每个线程都拥有自己独立的字符串对象和初始化过程。线程第一次访问这个变量时，会尝试读取操作系统已经设置的原生线程名称。

### 7.1 读取原生线程名称

Linux 使用 `pthread_getname_np` 读取名称，并准备 16 字节缓冲区。Linux 线程名称最多包含 15 个有效字节，最后一个字节需要留给字符串结束符 `\0`。

Windows 使用 `GetThreadDescription` 获取宽字符串。该 API 返回的内存由系统分配，因此代码用 `LocalFreeDeleter` 配合 `std::unique_ptr` 管理释放，避免忘记调用 `LocalFree`：

```cpp
struct LocalFreeDeleter
{
    void operator()(wchar_t* value) const noexcept
    {
        if (value != nullptr)
        {
            (void)::LocalFree(value);
        }
    }
};
```

读取 Windows 名称后，再调用 `StringUtils::WStringToString` 转成项目统一使用的 UTF-8 字符串。

### 7.2 设置原生线程名称

Linux 的设置逻辑会把名称截断到 15 个字节，再调用 `pthread_setname_np`：

```cpp
std::array<char, 16> native_name{};
const std::size_t name_size = std::min(name.size(), native_name.size() - 1);
std::memcpy(native_name.data(), name.data(), name_size);
(void)pthread_setname_np(pthread_self(), native_name.data());
```

这里限制的是字节数，不是汉字数量。一个 UTF-8 汉字通常占 3 个字节，因此中文名称可能在字符中间被截断，系统侧名称不一定是完整的 UTF-8 文本。应用侧的 `t_thread_name` 仍保存完整名称，所以日志中的线程名称不会因为系统限制而丢失。

Windows 则先通过 `StringUtils::StringToWString` 转成宽字符串，再调用 `SetThreadDescription`。其他平台暂时不设置原生名称，但保留应用层名称，接口行为仍然可用。

## 8. 空名称与默认名称

```cpp
void SetThreadName(std::string name)
{
    if (name.empty())
    {
        ASSERT_NOEFFECT2(false, "you passed empty thread name");
        std::string native_name = GetNativeThreadName();
        t_thread_name = native_name.empty()
            ? std::string(DEFAULT_THREAD_NAME)
            : std::move(native_name);
        return;
    }

    t_thread_name = std::move(name);
    SetNativeThreadName(t_thread_name);
}
```

空名称不是一个正常的线程命名操作，因此先用 `ASSERT_NOEFFECT2` 提示调用者，但不让程序因为这个输入直接退出。随后重新读取系统名称；如果系统也没有名称，则使用 `UNKNOWN` 作为稳定的兜底值。

正常设置名称时，先移动到线程本地字符串，再同步给操作系统。这样即使某个平台不支持原生线程名称，`GetThreadName()` 依然可以返回应用层设置的内容。

## 9. 测试程序的观察方式

`tests/test_thread_utils.cpp` 采用逐阶段输出和 `sleep` 的方式，方便在程序运行期间打开另一个终端观察线程信息：

```cpp
std::cout << "1: main thread id: " << pans::GetThreadId() << std::endl;
std::cout << "2: main thread name: " << pans::GetThreadName() << std::endl;
sleep(30);

pans::SetThreadName("main_thread");
std::cout << "3: main thread name: " << pans::GetThreadName() << std::endl;
sleep(10);

pans::SetThreadName("花间客真帅");
std::cout << "4: main thread name: " << pans::GetThreadName() << std::endl;
```

测试重点不是等待时间本身，而是观察以下现象：

1. 主线程和子线程的 ID 不同；
2. 子线程初始名称与主线程互不影响；
3. 设置普通英文名称后，应用层和系统侧都能看到名称；
4. 中文名称在应用层保持完整，但 Linux 系统名称受 15 字节限制；
5. 设置过长名称时，系统侧会截断；
6. 传入空字符串时，名称恢复为系统名称或 `UNKNOWN`。

测试程序还创建一个 worker 线程，验证 `thread_local` 存储不会在线程之间共享：

```cpp
std::thread worker([]() {
    std::cout << "6: son thread id: " << pans::GetThreadId() << std::endl;
    std::cout << "7: son thread name: " << pans::GetThreadName() << std::endl;
    sleep(10);
    pans::SetThreadName("son-thread-long-name");
    std::cout << "8: son thread name: " << pans::GetThreadName() << std::endl;
});
worker.join();
```

在 Linux 上，可以根据程序 PID 执行：

```bash
top -H -p <pid>
```

也可以使用 `ps -T` 查看线程列表。具体工具显示名称的列会因系统版本和命令参数不同而变化，但线程 ID 应与程序输出中的原生线程 ID 相互对应。
