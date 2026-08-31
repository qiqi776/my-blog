---
title: CSS 基础与选择器
date: 2026-03-25
order: 1
---

## CSS 基础与选择器

### CSS 是什么

CSS 的全称是 **Cascading Style Sheets**，中文通常叫**层叠样式表**。它本质上是一门样式语言，用来描述网页元素的外观和布局。

它主要负责这些事情：

- 控制页面布局：元素放在哪里、占多大空间
- 定义文字样式：字体、大小、粗细、颜色、行高
- 设置背景与边框：背景色、背景图、圆角、阴影
- 实现响应式设计：针对手机、平板、桌面分别适配
- 添加动态效果：过渡、变换、动画
- 决定样式冲突时谁生效：也就是层叠、继承和优先级

#### CSS 的发展

CSS 最早发布于 `1996` 年。早期版本只能做比较基础的样式控制，比如：

- 字体
- 颜色
- 边距
- 边框
- 背景

但它当时的能力还比较弱：

- 不支持现代布局模型
- 动画和过渡能力有限
- 响应式设计还没有成熟方案

随后 `1998` 年发布了 `CSS2`，它加入了很多今天仍然非常重要的内容，比如：

- 定位
- 层叠顺序
- 伪元素
- 更完整的布局能力

之后又有 `CSS2.1` 作为修订版，进一步规范实现。

到了 `2010` 年之后，`CSS3` 逐步成为现代网页开发的主流基础。它带来了很多关键增强：

- 新布局模型
- 动画与过渡
- 变换
- 多背景
- 自定义字体
- 媒体查询
- 响应式设计

今天我们实际学习和使用的 CSS，通常就是 **CSS3 以及之前已经稳定下来的核心能力**。

### CSS 的核心作用

可以把 CSS 的主要任务概括成下面几类：

- **控制页面布局**：设置元素的位置、大小、边距、边框
- **控制文字外观**：设置字体、大小、颜色、粗细、装饰
- **实现响应式设计**：根据不同设备宽度调整页面样式
- **实现交互效果**：动画、渐变、旋转、缩放、过渡
- **处理样式冲突**：通过继承、层叠和优先级决定最终生效结果

### CSS 引入方式

CSS 常见的引入方式有三种：

- 行内样式
- 内部样式
- 外部样式表

在开始介绍之前，先看一个最简单的 HTML 页面：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>我是网站标题</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <p>我是一段文本，我想请问你要干嘛，为什么要黑我们家鸽鸽</p>
  </body>
</html>
```

#### 方式一：行内样式

最直接的方式，是在标签上使用 `style` 属性：

```html
<p style="color: green">我是一段文本，我想请问你要干嘛，为什么要黑我们家鸽鸽</p>
```

这里的 `color` 用来设置文本颜色，值 `green` 表示绿色。

如果还想把文字调成粗体，可以继续加属性，多个属性之间用分号 `;` 隔开：

```html
<p style="color: green; font-weight: 800">
  我是一段文本，我想请问你要干嘛，为什么要黑我们家鸽鸽
</p>
```

这种写法叫**行内样式**，它的特点是：

- 直接写在标签内部
- 只作用于当前元素
- 也会影响这个元素内部那些继承相关的样式

例如：

```html
<body>
  <p style="color: green; font-weight: 800">
    我是一段文本
    <span>我附加</span>
  </p>
  <p>我是另一段文本</p>
</body>
```

这里第一个 `p` 及其内部文本会受影响，但第二个 `p` 不会。

行内样式适合快速测试，不适合真实项目长期维护，因为：

- 样式和结构耦合太紧
- 难复用
- 改起来麻烦

#### 方式二：内部样式

第二种方式是在 HTML 的 `head` 中写一个 `<style>` 标签：

```html
<head>
  <meta charset="UTF-8" />
  <title>我是网站标题</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    p {
      color: green;
      font-weight: 800;
    }
  </style>
</head>
```

因为样式被单独写到了 `style` 标签中，浏览器并不知道它们应该作用到谁，所以这里必须借助**选择器**来限定作用范围。

上面的 `p` 就表示：选中页面中的所有 `p` 标签。

内部样式适合：

- 单页面练习
- 小型 demo
- 临时实验

但如果页面一多，样式还是不方便维护。

#### 方式三：外部样式表

实际开发中最常见的方式，是把 CSS 单独写进 `.css` 文件中，例如 `style.css`：

```css
p {
  color: green;
  font-weight: 800;
}
```

然后在 HTML 中用 `<link>` 引入：

```html
<link rel="stylesheet" type="text/css" href="style.css" />
```

这里：

- `rel="stylesheet"` 表示引入的是样式表
- `href` 填写的是 CSS 文件路径

外部样式表的优点最明显：

- 结构和样式分离
- 多页面可以复用同一份样式
- 后期维护最方便
- 浏览器可以缓存 CSS 文件

所以在真实项目里，**外部样式表是默认主流方案**。

### 选择器

选择器的作用，就是**决定样式到底应用到哪些元素上**。

也可以反过来理解：选择器就是用来“选中元素”的。

CSS 规则的基本写法如下：

```css
选择器 {
  属性: 值;
}
```

### 基本选择器

#### 标签选择器

标签选择器也叫**元素选择器**，直接写标签名即可：

```css
p {
  color: blueviolet;
}
```

这表示页面中所有 `p` 标签都会变成紫色。

例如：

```html
<body>
  <p>Hello World</p>
  <p>This is a paragraph.</p>
</body>
```

标签选择器是最简单的选择器类型。只要是 HTML 标签，都可以这样选，比如：

- `p`
- `div`
- `body`
- `html`

#### 类选择器

类选择器通过元素的 `class` 属性来选中元素，写法是：

```css
.test {
  color: blueviolet;
}
```

先看 HTML：

```html
<p class="test bold">Hello World</p>
<p>This is a paragraph.</p>
<p class="test">This is another paragraph.</p>
```

再看 CSS：

```css
.test {
  color: blueviolet;
}

.bold {
  font-weight: 800;
}
```

这样只要元素的 `class` 属性中包含对应类名，样式就会生效。

类选择器的特点：

- 一个元素可以同时有多个类
- 一个类可以复用在很多元素上
- 类选择器在实际开发里使用非常多

相比 `id`，类通常更灵活。

#### ID 选择器

ID 选择器通过元素的 `id` 属性来选中元素，写法是：

```css
#title {
  color: blueviolet;
  font-weight: bold;
}
```

对应 HTML：

```html
<p id="title">Hello World</p>
<p>This is a paragraph.</p>
<p>This is another paragraph.</p>
```

`id` 的特点是：

- 在同一个页面中应该唯一
- 不能乱重复
- 通常更适合做“唯一标识”

关于 `id` 命名，一般要注意：

- 只能由字母、数字、下划线组成
- 建议以字母开头
- 大小写敏感

在样式开发中，通常更推荐优先使用类选择器，而不是大量依赖 `id` 选择器。因为 `class` 更适合复用和组合，`id` 更像是给后面 JavaScript 精准定位元素准备的。

#### 通配符选择器

通配符选择器用 `*` 表示，意思是选中页面中的所有元素：

```css
* {
  color: blueviolet;
}
```

它会影响：

- `html`
- `body`
- `p`
- `div`
- 以及页面中的其他所有元素

通配符常见于样式重置，例如：

```css
* {
  margin: 0;
  padding: 0;
}
```

但也要谨慎使用，因为它作用范围太大。

#### 交集选择器

交集选择器适合“必须同时满足多个条件”的情况。

例如：

```css
p.test {
  color: blueviolet;
}
```

这个选择器的意思是：

- 先要求元素是 `p`
- 再要求它还带有 `test` 类

只有同时满足这两个条件，才会被选中。

再比如：

```css
p.test#p1 {
  color: blueviolet;
}
```

这里就是三个条件的交集：

- 是 `p`
- 有类 `test`
- `id` 是 `p1`

需要注意交集选择器的顺序不要乱写，否则容易产生歧义。

#### 并集选择器

并集选择器适合“多个不同选择器共享同一组样式”的场景，使用逗号 `,` 分隔：

```css
p,
a,
div {
  color: blueviolet;
}
```

它等价于：

```css
p {
  color: blueviolet;
}

a {
  color: blueviolet;
}

div {
  color: blueviolet;
}
```

并集选择器的价值在于：

- 少写重复代码
- 统一维护同类样式

### 高级选择器

基本选择器已经能覆盖很多场景，但实际开发里经常会遇到更复杂的结构，这时就要用组合选择器和属性选择器。

#### 后代选择器

后代选择器用于选中某个元素内部的后代元素，使用空格连接：

HTML：

```html
<div class="content">
  <p>Hello World</p>
  <div>
    <p>This is a paragraph</p>
    <div>Click here</div>
  </div>
</div>
```

CSS：

```css
.content p {
  color: blueviolet;
}
```

它的意思是：

- 先找到所有 `.content`
- 再选中这些元素内部所有层级的 `p`

如果继续往下写：

```css
.content div p {
  color: blueviolet;
}
```

那就表示：

- 先找 `.content`
- 再找其中的 `div`
- 再找这些 `div` 后代里的 `p`

后代选择器在真实开发里非常常见，因为页面结构经常是层层嵌套的。

#### 子选择器

子选择器只选择**直接子元素**，使用 `>` 连接：

```css
.content > p {
  color: blueviolet;
}
```

它和后代选择器的区别在于：

- 后代选择器：不限层级，只要在里面就行
- 子选择器：只能是一层直接子元素

所以 `.content > p` 不会选中更深层嵌套里的 `p`。

#### 相邻兄弟选择器

相邻兄弟选择器用于选择某个元素后面紧挨着的那个兄弟元素，使用 `+`：

HTML：

```html
<div class="content"></div>
<p>Hello World</p>
<p>This is a paragraph</p>
```

CSS：

```css
.content + p {
  color: blueviolet;
}
```

这里会选中：

- 紧跟在 `.content` 后面的第一个 `p`

它不会影响后面第二个 `p`。

#### 通用兄弟选择器

通用兄弟选择器使用 `~`，表示选中某元素之后所有符合条件的兄弟元素：

```css
.content ~ p {
  color: blueviolet;
}
```

它的作用范围比 `+` 更大，因为它不只选相邻的一个，而是选后面所有符合条件的兄弟元素。

#### 属性选择器

属性选择器根据标签的属性和值来选中元素。

先看 HTML：

```html
<a href="https://www.baidu.com">我是百度</a>
<a href="https://www.bing.com">我是必应</a>
<div>大家一般用哪一个作为搜索引擎呢？</div>
```

如果想精确选中百度链接，可以这样写：

```css
[href="https://www.baidu.com"] {
  color: blueviolet;
}
```

更常见的做法，是配合标签名一起写得更精确：

```css
a[href="https://www.baidu.com"] {
  color: blueviolet;
}
```

如果只是想选中所有带 `href` 属性的 `a` 标签：

```css
a[href] {
  color: blueviolet;
}
```

如果想匹配属性值中包含某段内容：

```css
a[href*="bing"] {
  color: blueviolet;
}
```

这里的 `*=` 表示“属性值中至少包含一次这个片段”。

如果想忽略大小写，还可以加 `i`：

```css
a[href*="Bing" i] {
  color: blueviolet;
}
```

属性选择器也能和类、标签、后代选择器继续组合，例如：

```css
a[href*="Bing" i].test {
  color: blueviolet;
}
```

```css
body > a[href*="Bing" i] {
  color: blueviolet;
}
```

### 选择器优先级

当多个规则同时命中同一个元素，而且它们设置了相同属性时，就会发生样式冲突。浏览器这时不会“随机选一个”，而是按优先级决定谁生效。

优先级通常可以表示为一个四元组：

```text
(a, b, c, d)
```

其中：

- `a`：行内样式数量
- `b`：`id` 选择器数量
- `c`：类选择器、属性选择器、伪类数量
- `d`：元素选择器和伪元素数量

#### 优先级怎么比较

比较方式很简单：

- 从左到右依次比较
- 哪一位先大，谁优先级就更高
- 后面的位不再继续比较

先看例子：

HTML：

```html
<p class="test" id="aaa">This is a paragraph</p>
```

CSS：

```css
.test {
  color: red;
} /* (0, 0, 1, 0) */

#aaa {
  color: blue;
} /* (0, 1, 0, 0) */

#aaa.test {
  color: green;
} /* (0, 1, 1, 0) */
```

比较过程如下：

- `.test` 和 `#aaa`：前者是 `(0,0,1,0)`，后者是 `(0,1,0,0)`，因为第二位 `1 > 0`，所以 `#aaa` 更高
- `#aaa` 和 `#aaa.test`：前两位一样，比较第三位，`1 > 0`，所以 `#aaa.test` 更高

因此最终生效的是：

```css
#aaa.test {
  color: green;
}
```

#### 复杂不等于一定更高

选择器看起来更复杂，不代表它一定更高。

例如：

```css
.aaa.bbb {
  color: red;
} /* (0, 0, 2, 0) */

#ccc {
  color: blue;
} /* (0, 1, 0, 0) */
```

虽然 `.aaa.bbb` 更“长”，但 `#ccc` 的优先级更高，因为它有一个 `id`。

#### 行内样式优先级最高

例如：

```html
<p class="test" style="color: blue">This is a paragraph</p>
```

```css
.test {
  color: red;
}
```

这里：

- `.test` 的优先级是 `(0, 0, 1, 0)`
- 行内样式是 `(1, 0, 0, 0)`

所以最终一定用行内样式的 `blue`。

#### 同优先级时，后写的覆盖先写的

如果两个规则优先级完全相同，那么就比声明顺序，后写的覆盖先写的。

例如：

```html
<p class="t1 t2">This is a paragraph</p>
```

```css
.t1 {
  color: blue;
}

.t2 {
  color: red;
}
```

`.t1` 和 `.t2` 的优先级相同，都是 `(0, 0, 1, 0)`，因此后写的 `.t2` 生效。

#### `!important`

有时候我们可以用 `!important` 强行提高某个属性的优先级：

```css
p.t1 {
  color: blue;
  background-color: yellow;
}

.t1 {
  color: red !important;
  background-color: aqua;
}
```

虽然 `p.t1` 的整体优先级更高，但 `color: red !important;` 会强制让这个属性赢下来。

不过 `!important` 不是推荐的常规手段。它更像是最后兜底的“强制覆盖”，用多了会让样式系统很难维护。

### CSS 样式继承

有些 CSS 属性会自动从父元素传给子元素，这就是**继承**。

例如：

```html
<div class="t1">
  <p>This is a paragraph</p>
</div>
```

```css
.t1 {
  color: red;
}
```

虽然颜色写在父元素 `.t1` 上，但内部的 `p` 文本通常也会显示成红色。

#### 常见会继承的属性

常见自动继承的属性主要集中在文本相关内容，例如：

- `color`
- `font-family`
- `font-size`
- `line-height`
- `visibility`
- `cursor`

#### 常见不会继承的属性

很多盒子模型相关属性不会自动继承，例如：

- `margin`
- `padding`
- `border`
- `width`
- `height`

所以继承并不是“所有样式都会往下传”，而是只有部分属性有这种行为。

#### 如何取消继承效果

最直接的方法，就是给子元素手动设定自己的值：

```html
<div class="t1">
  <p style="color: gray">This is a paragraph</p>
</div>
```

如果不想手写具体颜色，也可以使用一些特殊值。

例如：

```html
<div class="t1">
  <p style="color: initial">This is a paragraph</p>
</div>
```

这里的 `initial` 表示把属性恢复到初始值。

常见几个特殊值如下：

- `initial`：恢复到属性初始值
- `inherit`：强制继承父元素的值
- `unset`：如果该属性本来可继承，就继承；否则就恢复初始值
- `revert`：回退到浏览器或用户样式表中的上一层规则

### 选学：Emmet 快速生成 HTML

写 HTML 时，有些结构很重复，手动敲会很慢。很多 IDE 都内置了 **Emmet**，可以用很短的表达式快速生成结构。

#### 最简单的例子

直接输入：

```text
div
```

然后按 `Tab`，就能快速生成：

```html
<div></div>
```

#### 快速生成多个元素

如果要生成三个 `div`：

```text
div*3
```

按下 `Tab` 后会得到三个连续的 `div`。

#### 生成嵌套结构

如果想生成一个 `div` 内部嵌套一个 `button`：

```text
div>button
```

它会生成：

```html
<div>
  <button></button>
</div>
```

如果是兄弟结构：

```text
button+button
```

就会生成两个并列的 `button`。

#### 生成带类名和文本的元素

例如：

```text
div.test
```

会生成：

```html
<div class="test"></div>
```

如果还想带文本：

```text
div{我是文本}
```

会生成：

```html
<div>我是文本</div>
```

如果要批量编号：

```text
div#test$*3
```

会生成：

```html
<div id="test1"></div>
<div id="test2"></div>
<div id="test3"></div>
```

Emmet 本身不是 CSS 内容，但它和选择器思维有很强联系，学完选择器之后会特别顺手。

### 字体样式

网页中最重要的信息载体通常就是文字，因此字体样式几乎是最常用的一类 CSS。只要文字显示得舒服、层级清楚，页面的整体质感往往就已经有了基本保证。

常见的字体相关属性包括：

- `font-family`
- `font-size`
- `font-weight`
- `font-style`
- `color`
- `line-height`

#### 文本字体 `font-family`

字体决定了文字的整体气质。选得好，页面会更舒服；选得差，哪怕布局没问题，读起来也会觉得别扭。

不同系统默认字体并不完全一样，例如：

- Windows 常见默认字体是 `Segoe UI`
- macOS 和 iOS 常见默认字体是 `San Francisco`
- Android 常见默认字体是 `Roboto`
- Linux 则更依赖发行版和桌面环境，常见有 `Noto Sans`、`DejaVu Sans` 等

也就是说，同一个页面在不同系统上，即使完全不写 `font-family`，默认显示效果也可能不同。

在 CSS 中，可以通过 `font-family` 指定字体：

```css
p {
  font-family: "Microsoft YaHei";
}
```

如果字体名中有空格，建议使用引号包起来。

#### 为什么通常要写多个备选字体

不同操作系统的字体库并不一样。比如：

- Windows 上常见 `Microsoft YaHei`
- macOS 上常见 `PingFang SC`

因此更稳妥的写法通常是准备一组备选字体：

```css
p {
  font-family: "Microsoft YaHei", "PingFang SC";
}
```

浏览器会从左到右依次尝试：

- 第一种字体存在就直接用
- 第一种不存在，就继续尝试后面的字体

#### 通用字体族

除了具体字体名称，CSS 还支持**通用字体族**。它的意思不是“必须用某个精确字体”，而是告诉系统：

- 我要的是哪一类字体风格

常见通用字体族包括：

- `serif`：衬线字体，适合偏正式、传统感的文本
- `sans-serif`：无衬线字体，现代、简洁，网页里最常见
- `monospace`：等宽字体，适合代码
- `cursive`：手写风格字体
- `fantasy`：装饰性比较强的艺术字体

例如：

```css
p {
  font-family: monospace;
}
```

这表示“请给我一个等宽字体”，至于具体是哪个等宽字体，交给系统自己决定。

最常见的写法，是把通用字体族放在最后做兜底：

```css
p {
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
```

这意味着：

- 优先用前面列出的具体字体
- 如果都没有，就至少退回到一个无衬线字体

#### 自定义字体 `@font-face`

如果系统字体不够用，也可以把字体文件直接放进项目中，自定义导入。

常见字体文件格式有：

- `.ttf`
- `.woff`
- `.woff2`

例如：

```css
@font-face {
  font-family: "YuanShen";
  src: url("../font/yuanshen.ttf");
}
```

然后就可以像普通字体一样使用：

```css
p {
  font-family: "YuanShen", sans-serif;
}
```

这里的 `url()` 不一定非得是本地文件路径，也可以是网络地址。

不过自定义字体也有明显成本：

- 字体文件通常很大
- 用户访问页面时也要下载这些字体
- 网络环境一般比本地开发慢得多

所以很多真实网站会优先用系统字体，而不是动不动就加载一大个自定义字体包。

#### 字体样式通常写在外层

文本相关样式大多支持继承，因此设置字体时，通常会把它尽量写在外层元素上，例如：

```css
body {
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
}
```

这样整个页面大部分文本都会自动继承，避免每个标签都单独写一遍。

#### 字体大小 `font-size`

文字大小直接影响页面层级和可读性。普通文本在多数浏览器下默认大约是 `16px`，当然这也可能受到用户设置或浏览器默认配置影响。

使用 `font-size` 可以手动指定大小：

```css
p {
  font-size: 25px;
}
```

这时所有 `p` 标签里的文字都会变大。

我们也可以覆盖标签默认大小，例如：

```css
h1,
h2 {
  font-size: 20px;
}
```

这样就能把标题标签自带的默认字号覆盖掉。

#### 绝对尺寸

`font-size` 可以直接写预设值：

```css
h1 {
  font-size: small;
}

h2 {
  font-size: medium;
}

p {
  font-size: large;
}
```

这类值属于绝对尺寸，常见有：

- `small`
- `medium`
- `large`
- `x-large`

但实际开发里，大家更常用 `px`、`em`、`rem`。

#### 为什么要注意小数像素

例如：

```css
.test {
  font-size: 18.5px;
}
```

虽然现代浏览器大多已经可以很好处理小数像素，但它依然可能在不同设备或不同渲染环境下带来细微差异。初学阶段如果只是做普通页面，优先用整数 `px` 会更直观。

#### 相对尺寸 `em`

`em` 表示相对于当前元素字体大小的倍数。

例如：

```html
<div class="test">
  只是雪豹已失联
  <p>大烟杆嘴里塞，我只抽第五代</p>
</div>
```

```css
.test {
  font-size: 12px;
}

.test p {
  font-size: 1.5em;
}
```

这里：

- 父元素字体大小是 `12px`
- 子元素 `1.5em` 就相当于 `18px`

如果写成：

```css
.test p {
  font-size: 1.1em;
}
```

那么结果就是 `13.2px`。

#### 相对尺寸 `rem`

`rem` 和 `em` 类似，但它不是相对于当前元素，而是相对于根元素 `html`。

例如：

```html
<html lang="en" style="font-size: 10px">
  <body>
    <div class="test">
      只是雪豹已失联
      <p>大烟杆嘴里塞，我只抽第五代</p>
    </div>
  </body>
</html>
```

```css
.test {
  font-size: 1.5rem;
}

.test p {
  font-size: 1.1rem;
}
```

此时所有 `rem` 的计算都以根元素字体大小为基准。

`rem` 的优势在于：

- 更统一
- 更适合做全局尺寸控制
- 响应式开发时尤其好用

例如原本是 `24px`，根元素是 `16px`，那么：

```css
.test {
  font-size: 1.5rem;
}
```

因为 `24 ÷ 16 = 1.5`。

#### 文本字重 `font-weight`

`font-weight` 用来控制字体粗细。常见值是 `100` 到 `900`：

```css
.test {
  font-weight: 400;
}
```

通常：

- `400` 表示常规
- `700` 表示粗体

也可以写成预设值：

- `normal`
- `bold`
- `lighter`
- `bolder`

例如：

```css
.test {
  font-weight: 700;
}
```

或者：

```css
.test {
  font-weight: bold;
}
```

需要注意的是，不是所有字体都支持完整的 `100-900` 全部字重。当字体本身不支持某些细分字重时，浏览器会：

- 选择一个最接近的字重
- 或者尝试模拟粗细效果

所以实际开发里，尽量优先使用大多数字体都比较稳定支持的值，例如：

- `100`
- `400`
- `700`

#### 字体风格 `font-style`

`font-style` 控制字体风格。

默认值是：

```css
.test {
  font-style: normal;
}
```

如果想要斜体：

```css
.test {
  font-style: italic;
}
```

除了 `italic`，还有一个相近的值 `oblique`，也可以让文字倾斜：

```css
.test {
  font-style: oblique;
}
```

更进一步，还可以指定倾斜角度：

```css
.test {
  font-style: oblique 30deg;
}
```

`italic` 和 `oblique` 的区别主要在于：

- `italic` 更倾向于使用字体真正设计好的斜体版本
- `oblique` 更像是浏览器对正体做倾斜处理

不过在大多数日常页面里，知道它们都能实现斜体效果就已经够用了。

#### 字体颜色 `color`

字体颜色用 `color` 控制：

```css
.test {
  color: red;
}
```

除了颜色名，还可以使用更灵活的颜色表示方式。

#### RGB 颜色

显示器的颜色本质上来自红、绿、蓝三种颜色的组合，也就是 `RGB`：

- `rgb(0, 0, 0)`：黑色
- `rgb(255, 255, 255)`：白色
- `rgb(255, 0, 0)`：红色
- `rgb(0, 255, 0)`：绿色
- `rgb(0, 0, 255)`：蓝色

例如：

```css
.test {
  color: rgb(255, 0, 0);
}
```

#### 十六进制颜色

更常见的写法是十六进制：

- `#000000`：黑色
- `#FFFFFF`：白色
- `#FF0000`：红色
- `#0000FF`：蓝色

例如：

```css
.test {
  color: #ff0000;
}
```

十六进制通常更短，也更符合前端开发里的常见习惯。

#### 带透明度的颜色

如果想给颜色加透明度，可以用 `rgba()`：

```css
.test {
  color: rgba(255, 0, 0, 0.5);
}
```

这里最后一个参数是 `Alpha` 通道，取值范围通常是 `0` 到 `1`：

- `0`：完全透明
- `1`：完全不透明

也可以使用带透明度的十六进制写法：

```css
.test {
  color: #ff00007f;
}
```

它和 `rgba(255, 0, 0, 0.5)` 大致等价。

### 文本样式

前面介绍的是文字本身的外观，这一部分更关注文本段落整体的排版效果。

#### 首行缩进 `text-indent`

在中文排版中，段落首行缩进很常见。如果只靠手动塞空格，不仅不稳定，也不方便维护。

更合理的方式是使用 `text-indent`：

```css
.test p {
  text-indent: 2em;
}
```

这里使用 `2em` 很合适，因为它正好表示“两个字”的宽度感。

#### 水平对齐 `text-align`

`text-align` 控制块级元素内部内容的水平对齐方式：

```css
.test p {
  text-align: left;
}
```

常见值包括：

- `left`
- `right`
- `center`
- `justify`
- `start`
- `end`

其中：

- `left` / `right` 是绝对左右
- `start` / `end` 会根据文本书写方向动态决定

例如：

```html
<p dir="rtl">这是一段从右往左阅读的内容</p>
```

如果内容方向是从右往左，那么：

- `start` 更接近 `right`
- `end` 更接近 `left`

`justify` 则表示两端对齐，它会通过调整字间距或词间距，让文本左右边缘都尽量整齐。

要特别注意一点：`text-align` 影响的是**块级元素内部的行内内容**。如果你把它直接写在一个本身就是行内元素、而且没有额外宽度空间的元素上，往往不会看到效果。

#### 文本修饰 `text-decoration`

`text-decoration` 用来给文本添加下划线、删除线、上划线等修饰。

默认情况通常是：

```css
.test p span {
  text-decoration: none;
}
```

如果想加下划线：

```css
.test p span {
  text-decoration: underline;
}
```

如果想加删除线并设置颜色和样式：

```css
.test p span {
  text-decoration: line-through red dashed;
}
```

`text-decoration` 是一个简写属性，它背后对应的单独属性包括：

- `text-decoration-line`
- `text-decoration-style`
- `text-decoration-color`
- `text-decoration-thickness`

例如：

```css
.test p span {
  text-decoration-line: line-through;
  text-decoration-style: dashed;
  text-decoration-color: red;
  text-decoration-thickness: 2px;
}
```

#### 去掉链接下划线

`a` 标签默认通常自带下划线。如果不想显示：

```css
a {
  text-decoration: none;
}
```

这是非常常见的写法。

#### 文本大小写 `text-transform`

`text-transform` 可以改变英文文本的大小写形式：

```css
.test p {
  text-transform: uppercase;
}
```

常见值包括：

- `none`
- `uppercase`
- `lowercase`
- `capitalize`

其中 `capitalize` 表示让每个单词首字母大写。

#### 行高 `line-height`

行高对阅读体验影响非常大。默认值通常是：

```css
.test p {
  line-height: normal;
}
```

如果文本显得拥挤，可以把行高调大：

```css
.test p {
  line-height: 1.8;
}
```

直接写数字时，表示当前字体大小的倍数。

实际阅读类文本里，一个比较舒服的范围通常是：

- `1.5`
- `1.6`
- `1.8`

相比固定写成 `px`，使用倍数通常更灵活，因为字体大小变了，行高也会自然跟着变。

#### 字间距 `letter-spacing`

`letter-spacing` 用来控制字符之间的距离：

```css
.test p {
  letter-spacing: 2px;
}
```

默认值一般是 `normal`。

虽然它能用，但日常正文里一般不建议乱调，因为字间距改得太大会明显影响可读性。

#### 词间距 `word-spacing`

`word-spacing` 用于控制单词之间的间距：

```css
.test p {
  word-spacing: 10px;
}
```

它更适合英文或以单词为单位的语言环境。中文里因为没有天然空格分词，这个属性存在感会低很多。

#### 文本换行

浏览器默认会尽量保证单词完整，不会随便把一个英文单词拆成两半。因此有些时候你会看到一行末尾明明还有空间，但下一个单词还是被整体挪到了下一行。

控制换行时，最容易混淆的几组属性有：

- `word-break`
- `overflow-wrap`
- `text-wrap`
- `white-space`

#### `word-break`

`word-break` 主要控制单词是否允许被强制拆开：

```css
p {
  word-break: normal;
}
```

常见值：

- `normal`：默认规则，尽量不拆单词
- `break-all`：到行尾就可以强制拆分

例如：

```css
p {
  word-break: break-all;
}
```

这样英文单词在行尾也可以被拆开。

#### `overflow-wrap`

如果一个单词本身就长得离谱，已经长到整行都放不下，比如一整串连续字符，这时即使 `word-break: normal`，它也可能直接溢出。

这类情况可以交给 `overflow-wrap` 处理：

```css
p {
  overflow-wrap: break-word;
}
```

它更像是对超长单词的补救规则，而不是平时常规换行逻辑的主控制器。

#### `text-wrap`

`text-wrap` 用来控制文本是否允许自动换行。默认通常是：

```css
p {
  text-wrap: wrap;
}
```

如果改成：

```css
p {
  text-wrap: nowrap;
}
```

文本就不会自动换行，而是可能直接超出容器。

不过这个属性相对较新，如果需要更稳妥的兼容性，很多时候仍然会优先使用 `white-space`。

#### 空白处理 `white-space`

HTML 默认会把多个空格和换行折叠成一个空格显示。`white-space` 可以改变浏览器处理空白和换行的方式。

默认值通常是：

```css
p {
  white-space: normal;
}
```

常见值包括：

- `normal`：多个空白折叠，按默认规则换行
- `pre`：保留空格和换行，但不自动换行
- `pre-wrap`：保留空格和换行，同时允许自动换行
- `pre-line`：保留换行，但空格仍会折叠
- `nowrap`：不允许自动换行

这几个值在处理代码片段、聊天消息、用户输入内容时特别有用。

### 本章练习

下面这些问题可以拿来快速检查你是否真的掌握了这一章。

#### 常见选择题

哪个 CSS 属性用于设置文本的字体系列？

- `A` `font-size`
- `B` `font-family`
- `C` `font-weight`
- `D` `font-style`

以下哪个值可以用在 `font-weight` 属性中以设置文本为加粗？

- `A` `normal`
- `B` `bold`
- `C` `light`
- `D` 以上全部

如果想让文本倾斜，可以使用哪个 CSS 属性？

- `A` `font-style: italic;`
- `B` `font-weight: bold;`
- `C` `text-decoration: underline;`
- `D` `font-family: serif;`

以下关于 `text-decoration` 属性的描述，哪个是正确的？

- `A` 用于设置文本阴影
- `B` 用于添加下划线、删除线或上划线
- `C` 用于控制文本间距
- `D` 用于设置文本背景色

如何在 CSS 中设置文本的行高？

- `A` `line-height`
- `B` `font-size`
- `C` `letter-spacing`
- `D` `word-spacing`

以下哪个 CSS 属性可以用来改变文本的字间距？

- `A` `letter-spacing`
- `B` `word-spacing`
- `C` `text-indent`
- `D` `text-align`

想让段落中的第一行缩进两个字符，应该使用哪个 CSS 属性？

- `A` `padding-left`
- `B` `margin-left`
- `C` `text-indent`
- `D` `line-height`

在 CSS 中，哪个属性可以用来设置文本颜色？

- `A` `font-color`
- `B` `text-color`
- `C` `color`
- `D` `font-style`

下面哪个选择器能选中所有 `class="active"` 的元素？

- `A` `#active`
- `B` `.active`
- `C` `active`
- `D` `*active`

下面哪个选择器能选中所有 `<p>` 标签内的 `<span>` 元素？

- `A` `p span`
- `B` `p > span`
- `C` `p + span`
- `D` `p ~ span`

下面哪个选择器能选中所有直接子元素为 `<li>` 的 `<ul>` 元素中的 `li`？

- `A` `ul > li`
- `B` `ul li`
- `C` `ul + li`
- `D` `ul ~ li`

下面哪个选择器能选中所有 `class` 中包含 `"btn"` 的元素？

- `A` `[class*="btn"]`
- `B` `[class^="btn"]`
- `C` `[class$="btn"]`
- `D` `[class~="btn"]`

### 本章小结

到这里，这一章的重点已经基本完整了。真正需要掌握的不是“会背几个属性名”，而是下面这几组核心关系：

- 选择器决定样式作用范围
- 优先级决定冲突时谁生效
- 继承决定哪些样式会自动向下传递
- `font-family`、`font-size`、`font-weight`、`font-style`、`color` 构成了字体样式的核心
- `text-indent`、`text-align`、`text-decoration`、`line-height`、`white-space` 等属性共同决定文本排版效果

如果这些内容都理解了，后面再学习盒子模型、布局、响应式和动画时，你就不会总停留在“知道属性名，但不知道为什么这么写”的状态。CSS 真正难的地方，从来不是记忆，而是理解“规则如何共同作用”。
