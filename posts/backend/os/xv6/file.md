---
title: xv6 FS Lab：Large Files 与 Symbolic Links
date: 2026-03-24
order: 8
---

## lab8 file

### Task 1：Large Files

这个 lab 的 task1 要把 xv6 单个文件的最大大小从原来的 `268` 个 block 扩展到 `65803` 个 block。原始 xv6 的 inode 布局是 12 个 direct blocks + 1 个 singly-indirect block，最大文件大小是 12 + 256 = 268

我们需要改成 11 个 direct blocks + 1 个 singly-indirect block + 1 个 doubly-indirect block，于是最大文件大小变成 11 + 256 + 256 \* 256 = 65803

#### `kernel/fs.h`

这里定义磁盘 inode 的布局常量

```c
#define NDIRECT 11
#define NINDIRECT (BSIZE / sizeof(uint))
#define DNINDIRECT (NINDIRECT * NINDIRECT)
#define MAXFILE (NDIRECT + NINDIRECT + DNINDIRECT)
```

磁盘 inode 的 addrs[] 也要同步改成：

```c
uint addrs[NDIRECT+2];
```

内存中的 struct inode 必须和磁盘上的 struct dinode 保持一致，因此 kernel/file.h 中也要改：

```c
uint addrs[NDIRECT+2];
```

改完后 inode 的地址组织方式是：

```text
ip->addrs[0..10]     -> 11 个 direct block
ip->addrs[11]        -> 1 个 singly-indirect block
                       -> 256 个 data block 地址
ip->addrs[12]        -> 1 个 doubly-indirect block
                       -> 256 个 singly-indirect block 地址
                          -> 每个 singly-indirect block 再指向 256 个 data block
```

#### bmap()：

```c
static uint
bmap(struct inode *ip, uint bn)
{
  uint addr, *a;
  struct buf *bp;
  if(bn < NDIRECT){
    // ...
  }
  bn -= NDIRECT;
  if(bn < NINDIRECT){
    // ...
  }

  // 处理二级间接映射
  bn -= NINDIRECT;
  if (bn < DNINDIRECT) {
    uint first, second, *da;
    struct buf *bp1, *bp2;

    first = bn / NINDIRECT; // 在直接索引块中的偏移量
    second = bn % NINDIRECT; // 在一级索引块中的偏移量

    // 确认或分配直接索引块
    if ((addr = ip->addrs[NDIRECT + 1]) == 0) {
      // 未分配就从磁盘空闲块中申请一个
      addr = balloc(ip->dev);
      if (addr == 0)
        return 0;
      ip->addrs[NDIRECT + 1] = addr;
    }

    bp1 = bread(ip->dev, addr);
    da = (uint*)bp1->data;

    // 确认或分配一级索引块
    if ((addr = da[first]) == 0) {
      addr = balloc(ip->dev);
      if (addr == 0) {
        brelse(bp1);
        return 0;
      }
      da[first] = addr;
      log_write(bp1); // 修改了索引记录，需写入日志
    }
    brelse(bp1);

    bp2 = bread(ip->dev, addr);
    da = (uint *)bp2->data;

    // 确认或分配最终的物理数据块
    if ((addr = da[second]) == 0) {
      addr = balloc(ip->dev);
      if (addr) {
        da[second] = addr;
        log_write(bp2);
      }
    }
    brelse(bp2);
    return addr;
  }
  panic("bmap: out of range");
}
```

现在大文件虽然能写出来，但删除时不会释放双重间接块下的块，最终会泄漏磁盘块，我们需要修改一下 `itrunc()`

注意正确的释放顺序是先释放数据块，然后释放一级间接块，最后释放二级间接块

#### itrunc()：

```c
void
itrunc(struct inode *ip)
{
  int i, j;
  struct buf *bp, *bp2;
  uint *a, *b;

  for(i = 0; i < NDIRECT; i++){
    // ...
  }

  if(ip->addrs[NDIRECT]){
    // ...
  }

  // 检查是否使用二级间接映射
  if (ip->addrs[NDIRECT + 1]) {
    bp = bread(ip->dev, ip->addrs[NDIRECT + 1]);
    a = (uint *)bp->data;
    // 遍历一级索引块
    for (j = 0; j < NINDIRECT; j++) {
      if (a[j]) {
        bp2 = bread(ip->dev, a[j]);
        b = (uint *)bp2->data;
        // 清理底层物理数据块
        for (int k = 0; k < NINDIRECT; k++) {
          if (b[k]) {
            bfree(ip->dev, b[k]);
          }
        }
        // 释放缓冲区锁，并且释放对应物理块
        brelse(bp2);
        bfree(ip->dev, a[j]);
      }
    }
    brelse(bp);
    bfree(ip->dev, ip->addrs[NDIRECT + 1]);
    ip->addrs[NDIRECT + 1] = 0;
  }

  ip->size = 0;
  iupdate(ip);
}
```

### Task 2：Symbolic Links

lab 的 task2 要为 xv6 增加符号链接

- 硬链接直接指向目标 inode
- 符号链接保存的是“目标路径字符串”。打开符号链接时，内核会继续按这个路径查找真正的目标

这次实验只要求：

- 实现 `symlink(target, path)` 系统调用
- 让 `open()` 支持跟随 symlink
- 支持 `O_NOFOLLOW`
- 检测 symlink 环，避免无限循环

不需要处理指向目录的符号链接，唯一需要知道如何跟随符号链接的系统调用是 `open()`

首先，为符号链接创建一个新的系统调用号

`kernel/syscall.h`

```c
#define SYS_symlink 22
```

`kernel/syscall.c`

```c
extern uint64 sys_symlink(void);
```

并在 syscall 表中加入：

```c
[SYS_symlink] sys_symlink,
```

`user/user.h`

```c
int symlink(const char*, char*);
```

`user/usys.pl`

```perl
entry("symlink");
```

在 `kernel/stat.h` 中增加新的 inode 类型，用于表示符号链接：

```c
#define T_DIR     1   // Directory
#define T_FILE    2   // File
#define T_DEVICE  3   // Device
#define T_SYMLINK 4   // SYMLINK
```

在 `kernel/fcntl.h` 增加 `open()` 的新 flag：

```c
#define O_RDONLY   0x000
#define O_WRONLY   0x001
#define O_RDWR     0x002
#define O_CREATE   0x200
#define O_TRUNC    0x400
#define O_NOFOLLOW 0x800
```

这里要求 `O_NOFOLLOW` 与现有位不冲突

并且要把 `symlinktest` 加进 Makefile 中从而能够编译 `user/symlinktest.c`：

```make
ifeq ($(LAB),fs)
UPROGS += \
	$U/_bigfile \
	$U/_symlinktest
endif
```

#### 实现 `sys_symlink()`

接下来需要实现 symlink(target, path) 系统调用，需要选择一个地方来存储符号链接的目标路径。实验中说可以把 symlink 当作一种特殊 inode：`T_SYMLINK`，symlink 的文件内容就是 `target` 路径字符串

这样不需要修改磁盘 inode 结构，也不需要额外元数据设计

注意目标 `target`不需要存在系统调用才能成功

```c
uint64 sys_symlink(void) {
  // 从用户态取出 target 和 path
  char target[MAXPATH], path[MAXPATH];
  struct inode *ip;

  if (argstr(0, target, MAXPATH) < 0 || argstr(1, path, MAXPATH) < 0)
    return -1;

  begin_op();
  // 创建一个新的 symlink inode
  if ((ip = create(path, T_SYMLINK, 0, 0)) == 0) {
    end_op();
    return -1;
  }

  // 把target 写进inode数据块
  if (writei(ip, 0, (uint64)target, 0, strlen(target) + 1) !=
      strlen(target) + 1) {
        iunlockput(ip);
    end_op();
    return -1;
  }

  iunlockput(ip);
  end_op();
  return 0;
}
```

#### 实现 `sys_open()`

`open()` 分成两种行为：

1. `O_NOFOLLOW` 没设置，如果路径对应的是 symlink，就继续读取它的目标路径，再 `namei()` 到新的 inode 上，直到得到非 symlink 文件

2. `O_NOFOLLOW` 设置了，应该打开symlink（而不是跟随symlink）

如果链接的文件也是一个符号链接，必须递归地跟随它，直到达到非链接文件。为了防止链接形成环，需要限制一下深度

```c
#define MAXSYMLINKS 10
```

当前实现中跟随深度到 10 层就报错

另外其他系统调用（例如 link 和 unlink）不应跟随符号链接；这些系统调用操作的是符号链接本身

```c
uint64
sys_open(void)
{
  char path[MAXPATH];
  char target[MAXPATH]; // 设置的最大深度
  int fd, omode;
  struct file *f;
  struct inode *ip;
  int n;
  int depth = 0;

  argint(1, &omode);
  if((n = argstr(0, path, MAXPATH)) < 0)
    return -1;

  begin_op();

  if(omode & O_CREATE){
    ip = create(path, T_FILE, 0, 0);
    if(ip == 0){
      end_op();
      return -1;
    }
  } else {
    if((ip = namei(path)) == 0){
      end_op();
      return -1;
    }
    ilock(ip);

    // 如果当前 inode 是 symlink，且没有指定 O_NOFOLLOW
    while (ip->type == T_SYMLINK && !(omode & O_NOFOLLOW)) {
      // 处理深度过大的情况
      if (depth++ >= MAXSYMLINKS) {
        iunlockput(ip);
        end_op();
        return -1;
      }

      // symlink 的“文件内容”里保存的是目标路径字符串
      // 这里把它读到 target 缓冲区里
      if (readi(ip, 0, (uint64)target, 0, MAXPATH) <= 0) {
        iunlockput(ip);
        end_op();
        return -1;
      }

      iunlockput(ip);

      // 按 target 重新查找真正的目标 inode
      if ((ip = namei(target)) == 0) {
        end_op();
        return -1;
      }
      ilock(ip);
    }
    // ...
  }
  // ...
}
```
