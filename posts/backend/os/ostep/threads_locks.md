---
title: 线程、锁与并发数据结构
date: 2026-04-08
order: 3
---

### 并发与线程

这一章引入同一进程内部的另一个重要抽象：**线程 `thread`**

之前的程序只有一个程序计数器 `PC`，而多线程程序里会有多个执行点，也就是多个程序计数器、寄存器集合和执行上下文。它和独立进程最大的区别在于：线程彼此共享同一个地址空间，因此它们能直接访问同一份数据

单个线程拥有的运行状态，和进程其实很相似：

- 程序计数器 `PC`
- 一组通用寄存器
- 自己的执行栈

如果两个线程运行在同一个 CPU 上，那么从线程 `T1` 切换到线程 `T2` 时，也会发生上下文切换。不过线程切换和进程切换有一个重要区别：

- 进程切换时，地址空间通常也要切换
- 线程切换时，地址空间保持不变

因此线程切换通常比进程切换更轻量。和 PCB 类似，系统也需要保存线程状态的数据结构，通常叫线程控制块 `TCB`

##### 多线程地址空间

多线程进程里，每个线程都要独立调用函数、保存局部变量、参数和返回地址，所以每个线程都有自己的栈。因此多线程进程的地址空间里，往往会同时存在多个栈区域

这带来两个直接后果：

- 原来“堆向一边长、栈向另一边长”的那种简洁布局没有那么漂亮了
- 一个线程函数里的局部变量在它自己的栈里，其他线程不能直接通过“自己的栈”看到这份数据

#### 实例：线程创建

最简单的线程程序，通常长这样：

```c
#include <stdio.h>
#include <assert.h>
#include <pthread.h>

void *mythread(void *arg) {
    printf("%s\n", (char *) arg);
    return NULL;
}

int main(int argc, char *argv[]) {
    // 创建线程
    pthread_t p1, p2;
    int rc;

    printf("main: begin\n");

    // 两个线程分别执行 `mythread()`，一个打印 `A`，一个打印 `B`
    rc = pthread_create(&p1, NULL, mythread, "A"); assert(rc == 0);
    rc = pthread_create(&p2, NULL, mythread, "B"); assert(rc == 0);

    // 主线程调用 `pthread_join()` 等待两个线程结束
    rc = pthread_join(p1, NULL); assert(rc == 0);
    rc = pthread_join(p2, NULL); assert(rc == 0);
    printf("main: end\n");
    return 0;
}
```

##### 为什么输出顺序不固定

很多人第一次接触线程时，会默认觉得执行顺序应该是：

```text
main: begin
A
B
main: end
```

但实际AB的顺序并不保证是这样。线程一旦被创建，什么时候运行，取决于调度器，而不是代码顺序

线程创建有点像函数调用，但又不是真正的普通函数调用。线程像是系统启动了一条新的执行流，它可能马上跑，也可能晚点跑，还会和创建者并行存在

这就是并发带来的第一层复杂度：程序不再只有一条明确的执行路径

#### 共享数据为什么更麻烦

一旦多个线程开始访问同一份共享数据，问题就会明显复杂起来

例如下面这个程序：

```c
#include <stdio.h>
#include <pthread.h>
#include "mythreads.h"

static volatile int counter = 0;

void *mythread(void *arg) {
    printf("%s: begin\n", (char *) arg);
    for (int i = 0; i < 1e7; i++) {
        counter = counter + 1;
    }
    printf("%s: done\n", (char *) arg);
    return NULL;
}

int main(int argc, char *argv[]) {
    pthread_t p1, p2;
    printf("main: begin (counter = %d)\n", counter);
    Pthread_create(&p1, NULL, mythread, "A");
    Pthread_create(&p2, NULL, mythread, "B");
    Pthread_join(p1, NULL);
    Pthread_join(p2, NULL);
    printf("main: done with both (counter = %d)\n", counter);
    return 0;
}
```

两个线程各自把 `counter` 加 `10000000` 次，那么最终结果应该是：

```text
20000000
```

但很多时候你会看到：

```text
main: done with both (counter = 19345221)
```

甚至每次运行，结果都不一样。这就是并发里最经典的现象之一：程序结果变得不确定 `indeterminate`

#### 核心问题：不可控的调度

问题的关键在于：

```c
counter = counter + 1;
```

它在底层通常会被编译成几条独立指令，例如在 x86 上可能类似这样：

```asm
mov 0x8049a1c, %eax # 从内存读出 `counter` 到寄存器 `eax`
add $0x1, %eax      # 把 `eax` 加 1
mov %eax, 0x8049a1c # 再把结果写回内存
```

假设此时 `counter = 50`，线程 1 执行：读出 `50`，在寄存器里加到 `51`，但还没来得及写回去，就发生了中断，线程 1 被切走了，接着线程 2 上来，也执行同样的逻辑，然后线程 1 恢复运行，把自己寄存器里的 `51` 也写回去。最终内存里还是 `51`

于是两次加一，最后只增长了一次

##### 竞态条件与临界区

上面这种现象有几个非常重要的术语

##### 竞态条件 `race condition`

当多个线程并发执行，最终结果依赖于它们“谁先跑到哪一步”时，就出现了竞态条件

##### 临界区 `critical section`

像这种访问共享变量、共享数据结构、共享资源的代码片段，通常叫临界区。在这个例子里，更新 `counter` 的那段代码就是临界区

##### 不确定性 `indeterminate`

如果程序里存在竞态条件，那么同一份代码在不同运行中可能给出不同结果，这样的程序就是不确定的

##### 互斥 `mutual exclusion`

我们真正想要的是一个线程进入临界区时，其他线程不能同时进入。这个性质叫互斥，也就是在任意时刻，临界区里最多只允许一个线程执行

#### 对原子性的需求

理想情况下，我们希望“加一”这个动作能像一条不可分割的指令那样执行，也就是要么整个完成，要么根本没开始。这就叫原子性 `atomicity`

如果硬件能直接提供这样的指令，例如：

```text
memory-add 0x8049a1c, $0x1
```

那么问题就简单多了，因为这条指令在执行过程中不会被拆开，也就不会在中间切出去导致竞争。但现实中，硬件不可能为每种高级数据结构和并发场景都提供现成指令。所以真正的做法是让硬件提供一小组足够底层的同步原语，然后由操作系统和程序员在上层构建锁、条件变量等并发机制

#### 等待与唤醒

并发问题不只是一群线程同时更新共享变量。还有另一类很常见的交互：一个线程必须等另一个线程做完某件事，自己才能继续，例如：

- 线程发起 I/O 之后进入休眠
- 等待磁盘返回结果
- 结果回来后再被唤醒继续执行

所以并发后面通常会分成两大类机制：

1. **原子性 / 互斥**：解决竞态条件
2. **等待 / 唤醒**：解决线程协作

也就是后面会遇到的：

- 锁 `lock`
- 条件变量 `condition variable`

### 线程 API

理解了线程带来的并发问题之后，下一步就是看 POSIX 线程库里最常用的接口。

#### 线程创建

多线程程序的第一步，当然是创建线程。POSIX 提供的接口是：

```c
#include <pthread.h>

int pthread_create(
    pthread_t *thread,              // 输出参数：新线程标识写到这里
    const pthread_attr_t *attr,     // 线程属性，通常传 NULL
    void *(*start_routine)(void *), // 线程入口：void *func(void *arg)
    void *arg                       // 传给线程函数的参数
);
```

第一次看这个声明时，很多人会被第三个参数吓到，其实重点只有一个：线程入口函数长这样

```c
void *func(void *arg)
```

统一用 `void *` 是为了通用：参数能传任意类型，返回值也能带回任意类型

##### 一个最简单的创建例子

```c
#include <pthread.h>

typedef struct myarg_t {
    int a;
    int b;
} myarg_t;

void *mythread(void *arg) {
    myarg_t *m = (myarg_t *) arg;
    printf("%d %d\n", m->a, m->b);
    return NULL;
}

int main(int argc, char *argv[]) {
    pthread_t p;
    int rc;

    myarg_t args;
    args.a = 10;
    args.b = 20;

    rc = pthread_create(&p, NULL, mythread, &args);
    ...
}
```

这里的套路很固定：创建前打包，线程里解包

#### 线程完成

创建线程之后，如果主线程希望等它执行完，再继续后面的逻辑，就要用：

```c
int pthread_join(
    pthread_t thread, // 等哪个线程
    void **value_ptr  // 返回值写到哪里；不关心就传 NULL
);
```

可以把 `pthread_join()` 理解成等待某个线程彻底结束，并顺便把它的返回值拿回来

##### 一个 join 例子

```c
#include <stdio.h>
#include <pthread.h>
#include <assert.h>
#include <stdlib.h>

typedef struct myarg_t {
    int a;
    int b;
} myarg_t;

typedef struct myret_t {
    int x;
    int y;
} myret_t;

void *mythread(void *arg) {
    myarg_t *m = (myarg_t *) arg;
    printf("%d %d\n", m->a, m->b);

    myret_t *r = malloc(sizeof(myret_t));
    r->x = 1;
    r->y = 2;
    return (void *) r;
}

int main(int argc, char *argv[]) {
    pthread_t p;
    myret_t *m;
    myarg_t args;

    args.a = 10;
    args.b = 20;

    pthread_create(&p, NULL, mythread, &args);
    pthread_join(p, (void **) &m);
    printf("returned %d %d\n", m->x, m->y);
    return 0;
}
```

这里的逻辑很直接：主线程创建一个工作线程，工作线程收到参数后打印它们，再在堆上分配一个返回结构体并把地址作为 `void *` 返回，最后主线程通过 `pthread_join()` 拿到这个返回指针

##### 不需要参数或返回值时

如果线程不需要参数，可以直接传 `NULL`。如果你不关心线程返回值，`pthread_join()` 的第二个参数也可以直接传 `NULL`。所以在很多简单程序里，你会看到：

```c
pthread_join(p, NULL);
```

##### 一个非常经典的坑：不要返回栈上的地址

下面这段代码看起来很像前面的例子，但其实是错的：

```c
void *mythread(void *arg) {
    myret_t r;   // 在线程自己的栈上
    r.x = 1;
    r.y = 2;
    return (void *) &r;
}
```

问题在于 `r` 是线程栈上的局部变量，当线程函数返回时，这块栈空间就失效了。主线程通过 `pthread_join()` 拿到的会是一个已经失效的地址，这类问题通常表现成打印出莫名其妙的值、偶尔运行正常、偶尔崩溃，而且非常难排查。所以如果线程要返回一块结构化数据，通常要在堆上分配，或者由调用者提前分配好空间。总之，不要返回指向线程栈上局部变量的指针

##### 传简单参数时可以更直接

如果线程只需要一个简单值，例如一个整数，也可以不专门打包结构体，例如：

```c
void *mythread(void *arg) {
    int m = (int) arg;
    printf("%d\n", m);
    return (void *) (arg + 1);
}

int main(int argc, char *argv[]) {
    pthread_t p;
    int m;
    pthread_create(&p, NULL, mythread, (void *) 100);
    pthread_join(p, (void **) &m);
    printf("returned %d\n", m);
    return 0;
}
```

这种写法在教学代码里偶尔会看到，但在真实程序里通常更推荐用结构体打包参数，因为它更清晰，也更不容易踩到类型转换的坑

##### 线程创建后立刻 join 有什么意义

如果你写出这样的代码：

```c
pthread_create(...);
pthread_join(...);
```

那它看起来就像创建一个线程，然后马上等它结束

这种写法当然可以工作，但如果程序里始终只有这一条执行流，那其实和普通函数调用差别已经不大了

真正能体现线程价值的通常是一次创建多个线程，让它们并行执行任务，最后统一 `join`，例如并行做计算、并行处理多个请求，或者让一组 worker 持续工作

#### 锁

除了创建线程和等待线程，线程库里最核心的一组 API，就是锁

最基础的两个调用是：

```c
int pthread_mutex_lock(pthread_mutex_t *mutex);
int pthread_mutex_unlock(pthread_mutex_t *mutex);
```

它们的语义很直白：`lock()` 用来尝试拿锁，`unlock()` 用来释放锁

典型写法：

```c
pthread_mutex_t lock;

pthread_mutex_lock(&lock);
x = x + 1;
pthread_mutex_unlock(&lock);
```

意思是，如果当前没有其他线程持有这个锁，我就拿到它并进入临界区；如果锁已经被别人持有，我就得等。获取锁失败时，线程通常不会继续往下执行，而是阻塞在加锁调用里

##### 锁一定要正确初始化

上面的代码还少了一步关键动作：初始化锁。POSIX 提供了两种常见方法

##### 静态初始化

```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
```

##### 动态初始化

```c
pthread_mutex_t lock;
int rc = pthread_mutex_init(&lock, NULL);
assert(rc == 0);
```

第二种方式更灵活，因此很多代码更喜欢这种写法。相应地，当锁用完之后，还可以调用：

```c
pthread_mutex_destroy(&lock);
```

##### 锁调用也可能失败

很多初学者会默认认为 `pthread_mutex_lock()` 一定能拿到锁，其实不是。像大多数库函数一样，这些调用也可能失败，所以更规范的做法是检查返回值，至少在教学代码里断言它成功

例如包装一个辅助函数：

```c
void Pthread_mutex_lock(pthread_mutex_t *mutex) {
    int rc = pthread_mutex_lock(mutex);
    assert(rc == 0);
}
```

这样你就不会因为某次加锁失败还继续往下执行，结果让多个线程一起冲进临界区

##### 其他锁接口

除了普通阻塞式加锁，pthread 还提供了一些变体：

```c
int pthread_mutex_trylock(pthread_mutex_t *mutex);
int pthread_mutex_timedlock(pthread_mutex_t *mutex,
                            struct timespec *abs_timeout);
```

它们的含义分别是：`trylock` 在锁被占用时立刻失败返回，不一直等；`timedlock` 则是在等到某个超时时刻还没拿到锁时返回

多数普通代码其实不太需要这两个接口，但它们在避免无限阻塞、做超时控制或调试死锁问题时很有用

#### 条件变量

并发不只有“抢锁进入临界区”，还有一种非常常见的协作模式：一个线程先睡下，等另一个线程把条件准备好，再把它叫醒

pthread 里对应的主要 API 是：

```c
int pthread_cond_wait(
    pthread_cond_t *cond,   // 等待队列
    pthread_mutex_t *mutex  // 调用时必须已持有；wait 内部会先释放，醒来后再重新拿回
);
int pthread_cond_signal(pthread_cond_t *cond); // 唤醒一个等待者
```

可以把条件变量理解成线程之间的一种等待 / 通知机制

##### 一个典型用法

```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;

pthread_mutex_lock(&lock);
while (ready == 0)                // 条件不满足就睡
    pthread_cond_wait(&cond, &lock);
pthread_mutex_unlock(&lock);
```

配套的另一个线程中可能这样写：

```c
pthread_mutex_lock(&lock);
ready = 1;                        // 先改共享状态
pthread_cond_signal(&cond);       // 再发通知
pthread_mutex_unlock(&lock);
```

##### 为什么 `wait()` 需要同时传条件变量和锁

这个 API 一开始看会让人困惑：

```c
pthread_cond_wait(&cond, &lock);
```

为什么等一个条件，还要把锁一起传进去？原因是 `pthread_cond_wait()` 在睡眠前会自动释放锁，被唤醒后返回之前又会重新拿回锁。这一步非常关键，否则如果等待线程一直抱着锁睡着了，别的线程根本没法拿到锁，也就没法修改条件并唤醒它

所以 `pthread_cond_wait()` 干的是一个复合操作：释放锁，进入睡眠，被唤醒后重新获取锁，再返回给调用者

##### 为什么要用 `while` 而不是 `if`

很多教材都会强调这一点：

```c
while (ready == 0)
    pthread_cond_wait(&cond, &lock); // 醒来后重新检查条件
```

不要写成：

```c
if (ready == 0)
    pthread_cond_wait(&cond, &lock);
```

原因在于，被唤醒并不等于条件一定已经满足。更安全的理解应该是：被唤醒只是一个“也许条件变了”的提示，而不是绝对事实

所以线程醒来之后，应该重新检查条件。这不仅能防止某些实现里的意外唤醒，也能防止多个等待线程竞争时出现逻辑错误

##### 不要自己拿一个标志位瞎 spin

有些人看到条件变量的写法，会觉得太麻烦了，于是改成这种形式：

```c
while (ready == 0)
    ; // spin
```

然后另一个线程：

```c
ready = 1;
```

千万别这么干。主要有两个问题：第一，性能很差，这种自旋会白白烧 CPU；第二，非常容易写错，这种“自己拿个标志位做同步”的写法，在真实程序里出 bug 的概率高得惊人

因此，只要你的问题本质上是等待某个条件成立，那就应该直接使用锁和条件变量

#### 编译与运行

只要程序使用了 pthread，就需要包含头文件 `pthread.h`，并在编译链接时带上 `-pthread`

例如：

```bash
gcc -o main main.c -Wall -pthread
```

如果你忘了 `-pthread`，通常会出现链接失败或找不到线程相关符号，所以在写 pthread 程序时，`-pthread` 基本是固定搭配

### 锁

前面两章分别回答了两个问题：为什么并发会出问题，以及程序员在用户态能使用哪些线程 API

这一章则进入真正的核心：锁到底是什么，以及它是怎么被实现出来的

如果说上一章里的 `pthread_mutex_lock()` 只是一个接口，那么这一章就是在解释这个接口背后到底需要哪些硬件支持、哪些操作系统支持，以及什么样的设计权衡

#### 锁的基本思想

锁的目标非常朴素：把一段临界区代码保护起来，保证任意时刻最多只有一个线程进入

例如原来这段共享变量更新代码：

```c
balance = balance + 1;
```

如果它是临界区，那么加上锁之后会变成：

```c
lock_t mutex;

lock(&mutex);
balance = balance + 1;
unlock(&mutex);
```

这里的 `mutex` 就是一把锁。锁本质上也是一个变量，只不过这个变量记录的是锁当前是否可用，以及是否已经被某个线程持有

从抽象层面看，锁通常只有两种状态：可用 `available / unlocked`，或者已持有 `acquired / locked / held`

当然在真实实现里，它往往还会带更多信息，例如谁持有锁、有哪些线程在等待、等待队列的顺序

但从使用者角度，理解成“锁现在空着还是被占着”已经足够了

##### `lock()` 和 `unlock()` 的语义

它们的语义很简单：`lock()` 尝试获取锁，`unlock()` 负责释放锁

假设线程 A 先调用 `lock(&mutex)`，如果此时锁是空闲的，它就会立即拿到锁并进入临界区。随后线程 B 再来调用 `lock(&mutex)` 时，就不会继续往下执行，而必须等待到 A 调用 `unlock()`

因此，锁的意义可以概括成一句话：把原本不可控的并发调度，局部变成程序员可控的串行执行

#### Pthread 锁

POSIX 线程库里，锁通常叫互斥量 `mutex`，因为它提供的就是互斥：一个线程在临界区里时，其他线程不能同时进去

典型写法如下：

```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

pthread_mutex_lock(&lock);
balance = balance + 1;
pthread_mutex_unlock(&lock);
```

和前面的抽象版伪代码完全是同一个意思

这里有一点很重要，不同数据结构通常会用不同的锁保护。这样做的意义是增加并发度，否则如果所有临界区都共用一把“大锁”，虽然简单，但线程之间会互相卡得非常厉害。这就是后面常说的粗粒度锁和细粒度锁

#### 评价锁

在讨论锁实现之前，先要明确评判标准。一把锁是不是“好锁”，通常看三个维度

##### 正确性

最基本的要求当然是能不能真的实现互斥。如果两个线程依然能同时冲进临界区，那锁就根本没完成它的使命

##### 公平性

第二个维度是等待锁的线程是否有公平的机会获得它。更极端一点问，就是某个线程会不会永远拿不到锁，也就是发生饿死 `starvation`

##### 性能

最后是使用锁到底付出了多少代价。性能通常要分几种场景来看：

1. **无竞争时**：只有一个线程拿锁 / 释放锁，开销多大
2. **单 CPU 多线程竞争时**：一个线程拿着锁，其他线程怎么办
3. **多 CPU 多线程竞争时**：多个处理器同时争同一把锁，表现如何

后面不同的锁实现，本质上都在正确性、公平性和性能这三点之间做权衡

#### 控制中断

在单处理器时代，一个非常早期、也非常直接的想法是进入临界区前先关闭中断，离开临界区后再打开中断

例如：

```c
void lock() {
    DisableInterrupts();
}

void unlock() {
    EnableInterrupts();
}
```

它为什么看起来能工作？因为在单 CPU 上，如果中断被关掉，就不会被时钟打断，线程一旦进入临界区，就能一直跑到结束

##### 这个办法为什么不好

它的问题很多。第一，它需要信任调用者。如果任何普通程序都能随便关中断，那它完全可以一上来就关中断，然后死循环，整个系统都会失去控制。第二，它不支持多处理器，你在 CPU 0 上关掉中断，并不能阻止 CPU 1 上的线程也进入同一个临界区。第三，它会导致中断延迟甚至丢失，例如磁盘 I/O 已经完成，但 CPU 迟迟没处理中断，那么等待 I/O 的线程就无法及时被唤醒。第四，性能也不一定理想，现代 CPU 上开关中断本身就是一类比较重的操作

所以结论是，在用户态把“关中断”当作通用同步方案几乎不可行，操作系统内核内部有时会短暂使用它，但范围非常有限

#### 测试并设置指令（原子交换）

既然单纯依靠软件不够，我们就需要硬件帮忙。最经典、最早的一类硬件原语就是测试并设置 `test-and-set`，也就是原子交换 `atomic exchange`

可以把它想象成这样一个原子操作：

```c
int TestAndSet(int *old_ptr, int new) {
    int old = *old_ptr;
    *old_ptr = new;
    return old;
}
```

它的关键不是这三行伪代码本身，而是整件事是原子发生的，也就是一边读旧值、一边写新值，中间不会被其他线程插进来

##### 第一次失败的尝试：普通标志位

如果没有 test-and-set，很多人会先想到这种写法：

```c
typedef struct lock_t { int flag; } lock_t;

void init(lock_t *mutex) {
    mutex->flag = 0;
}

void lock(lock_t *mutex) {
    while (mutex->flag == 1)
        ; // spin
    mutex->flag = 1;
}

void unlock(lock_t *mutex) {
    mutex->flag = 0;
}
```

看起来逻辑很合理，先看 `flag` 是不是 `1`，如果不是，就把它设成 1。但问题在于“看”和“设”是分开的两步。于是线程 1 看到 `flag == 0` 后，还没来得及写回 1，就被切走；线程 2 也看到 `flag == 0`，也进入。最后两个线程都把 `flag` 设成 1，临界区还是被同时进入了

所以这种写法既不正确，也不安全

#### 实现可用的自旋锁

如果硬件提供了 test-and-set，那么锁就能写成：

```c
typedef struct lock_t {
    int flag;
} lock_t;

void init(lock_t *lock) {
    lock->flag = 0;
}

void lock(lock_t *lock) {
    while (TestAndSet(&lock->flag, 1) == 1)
        ; // spin
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

这次之所以行得通，是因为如果锁原来是 0，test-and-set 会原子地把它变成 1 并返回旧值 0，当前线程看到返回值是 0，就知道自己拿到了锁；如果锁原来已经是 1，返回值就是 1，线程继续自旋。这类锁就叫自旋锁 `spin lock`，顾名思义，没拿到锁的线程不会睡觉，而是一直循环检查

#### 评价自旋锁

- 正确性：它是正确的，因为一次只有一个线程能把 0 原子换成 1，所以确实实现了互斥

- 公平性：它通常不公平，因为谁先在某一时刻撞上“锁刚变空闲”的瞬间，谁就拿到锁。这意味着某些线程理论上可能一直抢不到，于是出现饿死

- 性能：在单 CPU 上，自旋锁很糟糕。如果持锁线程被抢占了，其他线程只能在一个 CPU 上白白转圈，浪费整个时间片。在多 CPU 上，如果临界区很短，自旋锁反而常常还不错，因为一个 CPU 上的线程拿着锁，另一个 CPU 上的线程自旋一小会儿，也许锁很快就释放了，不至于太浪费。所以自旋锁的常见使用前提是临界区很短、持锁时间很短，而且处在多处理器环境

#### 比较并交换

另一类常见硬件原语是比较并交换 `compare-and-swap`，也叫 `compare-and-exchange`

```c
int CompareAndSwap(int *ptr, int expected, int new) {
    int actual = *ptr;
    if (actual == expected)
        *ptr = new;
    return actual;
}
```

它的语义是先看 `*ptr` 当前是不是 `expected`，如果是就把它改成 `new`，无论如何都返回原来的实际值

基于它也能实现锁：

```c
void lock(lock_t *lock) {
    while (CompareAndSwap(&lock->flag, 0, 1) == 1)
        ; // spin
}
```

逻辑和 test-and-set 很接近，只有看到旧值确实是 `0` 的线程，才能成功把它改成 `1`

在实现简单自旋锁时，它和 test-and-set 的行为差不多，但从能力上讲，compare-and-swap 更强大，后面很多无锁算法都会用到它

#### 链接的加载和条件式存储指令

还有一类硬件原语是 `Load-Linked` 和 `Store-Conditional`，可以理解成两步协作完成的原子更新

```c
int LoadLinked(int *ptr) {
    return *ptr;
}

int StoreConditional(int *ptr, int value) {
    if (no one has updated *ptr since the LoadLinked to this address) {
        *ptr = value;
        return 1;
    } else {
        return 0;
    }
}
```

它的思路是先通过 `LoadLinked()` 读出一个值，后续尝试用 `StoreConditional()` 写回，只有在这段期间内没有其他线程改过这个地址时，写入才会成功

```c
void lock(lock_t *lock) {
    while (1) {
        while (LoadLinked(&lock->flag) == 1)
            ; // spin until free
        if (StoreConditional(&lock->flag, 1) == 1)
            return;
    }
}
```

这里的直觉是先观察锁是不是空闲，如果空闲，就尝试“带条件地”写成 1；如果在此期间别人已经抢先写过，当前写入会失败，然后重试。这种机制的本质也是让“检查 + 更新”变成受硬件保证的一次受控原子序列

#### 获取并增加

另一种常见原子指令是获取并增加 `fetch-and-add`，伪代码如下：

```c
int FetchAndAdd(int *ptr) {
    int old = *ptr;
    *ptr = old + 1;
    return old;
}
```

它会原子地返回旧值，同时让该位置加一

基于它可以实现一种更公平的锁，也就是 ticket lock

实现如下：

```c
typedef struct lock_t {
    int ticket;
    int turn;
} lock_t;

void lock_init(lock_t *lock) {
    lock->ticket = 0;
    lock->turn = 0;
}

void lock(lock_t *lock) {
    int myturn = FetchAndAdd(&lock->ticket);
    while (lock->turn != myturn)
        ; // spin
}

void unlock(lock_t *lock) {
    FetchAndAdd(&lock->turn);
}
```

它的思路很像排队叫号，`ticket` 是发号器，`turn` 表示当前轮到谁。每个线程来获取锁时，先拿到一个自己的号 `myturn`，然后一直等，直到全局 `turn` 走到自己的号码为止。释放锁时，持锁线程把 `turn` 加一，轮到下一个线程。相比普通 test-and-set 自旋锁，它最大的好处是更公平，因为线程是按照拿号顺序进入临界区的，不容易出现某个线程一直抢不到锁的情况

#### 自旋太多：怎么办

虽然硬件原语让我们终于能实现“正确的锁”，但还有一个大问题，没拿到锁的线程会一直自旋，浪费 CPU

在单处理器上尤其严重。假设线程 A 拿着锁被中断了，此时线程 B 上来只会一直自旋，但锁根本不可能被释放，因为持锁线程 A 现在没有 CPU 运行

这就是自旋锁最让人难受的地方：它正确，但很多时候很浪费

于是下一个关键问题就变成怎样避免无意义地自旋

#### 简单方法：主动让出 CPU

最直接的想法是，没拿到锁时别傻转了，主动把 CPU 让出去，例如：

```c
void lock() {
    while (TestAndSet(&flag, 1) == 1)
        yield();
}
```

这里的 `yield()` 表示当前线程主动放弃 CPU，让调度器去运行别的线程。这个办法比纯自旋强一些，尤其在单 CPU 下更合理，但它仍然有明显问题，大量线程竞争时会产生很多上下文切换，还是可能不公平，某些线程依然可能长期拿不到锁，所以它只是一个过渡方案，不算真正成熟的设计

#### 使用队列：休眠替代自旋

要进一步解决问题，就需要不只是让线程“别一直自旋”，还要明确控制“谁下一次能拿到锁”。于是就引出了等待队列、线程睡眠和线程唤醒

以 Solaris 的思路为例，系统提供 `park()` 让当前线程睡眠，`unpark(threadID)` 唤醒某个线程。结合等待队列后，锁的大致思路变成：先用一把很小的内部保护锁 `guard` 保护锁自身的数据结构；如果主锁空闲，就直接拿到；如果主锁已被持有，就把自己放进等待队列并调用 `park()` 睡眠；持锁线程释放锁时，再从队列里取出一个线程并 `unpark()`。这样没拿到锁的线程就不会空耗 CPU，而是直接睡眠等待

这种方案并没有把“自旋”彻底消灭，因为获取或释放锁时，为了保护内部状态，线程还要短暂自旋拿 `guard`。但这里的关键区别在于，这个自旋时间极短，保护的只是锁内部几个字段和队列操作，而不是用户自己定义的整个临界区，所以这种混合方案通常是值得的

排队和睡眠看起来很好，但还有个细节坑很致命。假设线程 A 准备睡，它已经发现自己拿不到锁，并准备调用 `park()`，但就在它真正睡下之前，调度器切走了它。此时持锁线程 B 刚好释放锁，并调用 `unpark(A)`。如果这个唤醒信号发生得太早，而 A 随后又真的执行了 `park()`，它就可能错过这次唤醒，然后永远睡下去。这就是经典的 wakeup / waiting race。为了解决它，系统通常会增加额外机制，例如 `setpark()`，或者把“释放锁 + 睡眠”这件事交给内核原子处理

#### 不同操作系统，不同实现

Linux 上对应的一套著名机制叫 futex，它的思路和 Solaris 的 `park/unpark` 类似，但形式更贴近 Linux 内核和用户态协作，比如 `futex_wait(address, expected)` 和 `futex_wake(address)`

如果某个地址上的值等于预期值，就睡眠；否则立刻返回；唤醒时则通知等待在该地址上的线程

Linux 的许多真实锁实现，本质上都是无竞争时尽量走纯用户态快路径，有竞争时再落入内核，用 futex 睡眠 / 唤醒。这也是现代锁设计里非常重要的一条原则：把“无竞争”优化到极致，因为这是最常见情况

#### 两阶段锁

最后，还有一种很实用的折中思路：先短暂自旋，如果还拿不到，再睡眠，这就叫两阶段锁 `two-phase lock`。它的直觉很自然，如果锁马上就会被释放，那直接睡下去有点亏，因为睡眠 / 唤醒本身也有代价；但如果锁明显拿不到，那一直自旋又太浪费。所以它会先自旋一小会儿，如果还失败，再调用内核原语睡眠

Linux 里的很多锁本质上都属于这种混合方案

### 基于锁的并发数据结构

有了一把锁之后，怎么把它用到具体数据结构上？

#### 并发计数器

计数器是最简单的共享数据结构之一

```c
typedef struct counter_t {
    int value;
} counter_t;

void init(counter_t *c) {
    c->value = 0;
}

void increment(counter_t *c) {
    c->value++;
}

void decrement(counter_t *c) {
    c->value--;
}

int get(counter_t *c) {
    return c->value;
}
```

这种实现简洁，但在并发环境里显然不安全，因为 `value++` 不是原子操作，多个线程同时更新时会发生竞态

##### 最直接的做法：一把大锁

最直接的并发版本，就是把锁塞进计数器对象里

```c
typedef struct counter_t {
    int value;
    pthread_mutex_t lock;
} counter_t;

void init(counter_t *c) {
    c->value = 0;
    Pthread_mutex_init(&c->lock, NULL);
}

void increment(counter_t *c) {
    Pthread_mutex_lock(&c->lock);
    c->value++;
    Pthread_mutex_unlock(&c->lock);
}

void decrement(counter_t *c) {
    Pthread_mutex_lock(&c->lock);
    c->value--;
    Pthread_mutex_unlock(&c->lock);
}

int get(counter_t *c) {
    Pthread_mutex_lock(&c->lock);
    int rc = c->value;
    Pthread_mutex_unlock(&c->lock);
    return rc;
}
```

这种写法的优点非常明确：简单、正确、容易审查，也往往是并发数据结构的第一步

##### 问题：它不扩展

所有线程都抢同一把锁，任何一次自增、自减、读取都要串行化，线程数一多，性能会急剧下降。计数器这种“每次操作都极短、但操作次数极多”的数据结构，尤其容易被锁开销拖死

##### 懒惰计数器 `sloppy counter`

为了解决“单锁计数器不扩展”的问题，可以采用一种经典折中方案：一个全局计数器，每个 CPU 一个局部计数器，每个局部计数器有自己的锁，全局计数器也有自己的锁

它的核心思路是，线程平时只更新自己所属 CPU 的局部计数器；当局部值累计到一定阈值 `S` 时，再一次性把局部值加到全局计数器里，然后把局部值清零

这样做的好处是，绝大多数更新都只碰本地锁，不同 CPU 上的线程几乎不互相竞争，因此更新吞吐量很高。代价是全局计数器不再总是精确值，而是一个“有延迟的近似值”

这是一种典型的准确性换扩展性

##### 阈值 `S` 的意义

懒惰计数器最关键的参数就是阈值 `S`

如果 `S` 很小，局部计数器很快就要回刷到全局，全局值更准确，但争抢全局锁更频繁，性能会下降。反过来，如果 `S` 很大，更新大多停留在局部，全局锁竞争更少，性能更好，但全局值和真实值的偏差也会更大

所以这里没有绝对正确的设置，只有当前业务更在意精确值，还是更在意高并发吞吐

##### 这个例子说明了什么

懒惰计数器很值得记住，因为它很好地说明了并发数据结构设计中的一个常见套路：不要急着把所有操作都精确同步到一个全局热点上

如果可以，先局部处理，再批量合并，通常会比“每次都抢全局锁”快很多

#### 并发链表

链表比计数器更复杂，因为它不只是改一个整数，而是要操作节点和指针

一个最基础的并发链表做法仍然很直接：整个链表一把锁，插入和查找时都先拿锁

这种结构通常长这样：`list_t` 里有 `head`，再加一个 `pthread_mutex_t lock`。插入时就是拿锁、分配节点、改头指针、解锁；查找时则是拿锁、从头遍历、找到或走到末尾，再解锁

##### 链表的大锁版本为什么值得先写

这种做法的优点和计数器一样：正确性容易保证，代码结构清晰，出问题时也容易排查

而且链表这种结构里，很多程序的并发瓶颈并不一定就在它身上，所以如果简单方案已经够快，根本没必要继续复杂化

##### 一个很实际的工程细节：缩小临界区

链表插入里有一个很重要的代码习惯：`malloc()` 这类线程安全、但不操作共享链表结构的工作，最好放在临界区之外

原因很简单：临界区越短越好，锁持有时间越短越好，异常路径也会更简单。正确的重构方向不是“把整个函数全锁住”，而是只把真正修改共享结构的那几行圈进锁里

##### 过手锁 `hand-over-hand locking`

如果想进一步提升并发度，一种直觉上的办法是不给整个链表一把锁，而是给每个节点一把锁。遍历时先拿下一个节点的锁，再放当前节点的锁

这就是过手锁，也叫锁耦合 `lock coupling`。它的想法看起来很合理，因为多个线程可以同时走在链表不同位置，不再因为一把全局锁完全串行化

但实际效果经常不如想象中好。原因在于，遍历每个节点都要加锁和解锁，开销非常大，而链表本身缓存局部性又差。于是最终可能出现并发度更高，但总吞吐反而没提升多少，甚至更差的结果

所以锁粒度更细，不等于性能一定更好

#### 并发队列

队列是另一种高频结构。它的一个关键特征在于，入队主要碰尾部，出队主要碰头部

Michael 和 Scott 提出的一个经典并发队列做法就是准备一把 `headLock` 和一把 `tailLock`。这样入队时只拿尾锁，出队时只拿头锁，于是入队和出队可以并行发生，而不用像“大锁队列”那样彼此完全阻塞

这个队列实现里常会放一个 dummy node，也就是 sentinel node。初始化时先塞一个空节点进去，让 `head` 和 `tail` 一开始都指向它

这样做的好处是把“空队列”和“非空队列”的边界处理统一了，很多代码会简单很多。它本质上是并发数据结构里非常常见的技巧：多加一个哨兵节点，换更规整的边界逻辑

这个队列比链表的过手锁更成功，核心就在于访问模式天然分离：入队几乎只动尾部，出队几乎只动头部

因此把锁按功能拆开后，确实能减少无意义冲突

这说明并发数据结构优化最值得做的时候，往往不是强行细粒度，而是数据结构本身就存在天然可分离的访问热点

#### 并发散列表

散列表通常是最适合做并发拆分的数据结构之一

最简单的想法是让整个哈希表由多个桶组成，每个桶本质上是一个链表，并各自维护自己的锁。这样插入和查找的流程就变成：先算 `bucket = key % BUCKETS`，只去对应桶上操作，只拿那个桶自己的锁。这比“整张哈希表一把大锁”效果好得多，因为不同 key 很可能落到不同桶，不同线程就不会抢同一把锁

这是一种非常经典也非常实用的并发设计：分片 `sharding`，也就是按桶拆锁

##### 为什么散列表通常比链表更容易扩展

原因其实很简单：链表的所有操作都要沿着同一条结构走，而散列表天然把数据打散到多个桶里，所以散列表的并发优化，经常不是因为锁实现更神，而是因为数据本身就更容易被切分，这也是很多系统里喜欢把热点结构哈希化、分桶化的根本原因
