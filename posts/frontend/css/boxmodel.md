---
title: CSS 盒模型与布局
date: 2026-03-26
order: 2
---

## CSS 盒模型与布局

### 盒子模型

#### 什么是盒子

在浏览器眼里，页面上的每一个元素都可以视为一个矩形盒子。这里的盒子不只是 `div`，而是所有 HTML 元素都适用，包括：

- `div`
- `span`
- `p`
- `img`
- `a`

例如：

```html
<span>十七张牌你能秒我</span>
```

即使是一个普通的 `span`，浏览器在渲染时依然会把它当成一个矩形区域处理。

一个完整的盒子模型包含 4 个部分：

- **content**：内容区
- **padding**：内边距
- **border**：边框
- **margin**：外边距

理解这四层，是后面所有布局的基础。

#### 内容区域 `content`

默认情况下，元素的宽高由内容和元素类型共同决定。这里要区分三类元素：

**行内元素：**

- 宽度由文本或其他行内内容撑开
- 高度由字体大小和行高决定
- 默认不能直接设置 `width` 和 `height`

**块级元素：**

- 宽度默认占满整行
- 高度由内部内容撑开
- 可以设置 `width` 和 `height`

**行内块元素：**

- 不独占一整行
- 但允许设置 `width` 和 `height`

例如：

```html
<div class="box">十七张牌你能秒我</div>
```

```css
.box {
  width: 200px;
  height: 100px;
}
```

这样盒子的宽度就是 `200px`，高度就是 `100px`。

如果你把 `div` 换成普通 `span`，通常就会发现 `width` 和 `height` 不按你预期工作，因为 `span` 默认是行内元素。

#### 行内块元素为什么特殊

像 `img` 这样的元素就是典型的**行内块元素**。它既保留了行内元素的排布特点：

- 可以和文本待在同一行

又具备块级元素的一部分能力：

- 可以设置宽高

这也是为什么图片既不会天然独占一行，又能自由调整尺寸。

#### 百分比和 `fit-content`

除了设置固定尺寸，我们还可以让盒子按内容自适应：

```css
.outer-box {
  width: fit-content;
}
```

它的意思可以理解成：宽度尽量贴合内容本身。

另外，盒子的尺寸也可以写成百分比：

```css
.outer-box {
  width: 400px;
  height: 100px;
}

.inner-box {
  width: 50%;
  height: 90%;
}
```

这里内部盒子的尺寸会相对于父元素计算：

- `50%` 宽度表示父元素宽度的一半
- `90%` 高度表示父元素高度的 `90%`

这种写法在响应式布局里非常常见。

#### `body` 和 `html`

整个页面的可见内容，最外层通常都放在 `body` 中，而 `body` 的父元素就是 `html`。

先记住下面几点：

- `html` 是根元素
- `body` 是主要可见内容容器
- `body` 默认是块级元素
- 浏览器通常会给 `body` 一些默认 `margin`

这也是为什么你刚写页面时，内容常常不会紧贴浏览器边缘。

### 背景样式

背景主要有两种：

- 背景颜色
- 背景图片

#### 背景颜色 `background-color`

最简单的是背景色：

```css
.box {
  background-color: cornflowerblue;
}
```

如果没有手动设置，背景颜色默认是：

```css
transparent
```

也就是透明。

背景色很适合用来做：

- 卡片底色
- 高亮块
- 模块分区
- 标签底板

#### 背景图片 `background-image`

背景图使用 `background-image`：

```css
.test-box {
  width: 200px;
  height: 200px;
  background-image: url("https://example.com/demo.jpg");
}
```

如果图片尺寸大于盒子，就会只显示其中一部分；如果图片小于盒子，默认还会重复平铺。

#### `background-size`

背景图大小由 `background-size` 控制：

```css
background-size: cover;
```

常见值包括：

- `auto`：默认值，按图片原始尺寸显示
- `cover`：保持比例并尽量铺满整个区域，可能裁切
- `contain`：保持比例并完整显示整张图，可能留白或重复

如果不想让小图重复铺开，还可以加上：

```css
background-repeat: no-repeat;
```

#### `background-position`

背景图的位置由 `background-position` 控制：

```css
background-position: center center;
```

常见写法：

- `left top`
- `center center`
- `right bottom`
- `50% 50%`
- `10px 20px`

它本质上是在控制图片相对于盒子的对齐方式。

#### `background` 简写

背景也有简写形式：

```css
.test {
  background: red no-repeat url("https://example.com/demo.jpg") 10px 20px /
    contain;
}
```

它大致等价于：

```css
.test {
  background-color: red;
  background-image: url("https://example.com/demo.jpg");
  background-repeat: no-repeat;
  background-position: 10px 20px;
  background-size: contain;
}
```

要特别注意一点：

- `background-position` 和 `background-size` 之间要用 `/` 分隔

### 边框

边框用来包围内容区和内边距，形成可见外框。

#### 基本边框

边框最基础的三个维度是：

- 宽度 `border-width`
- 样式 `border-style`
- 颜色 `border-color`

例如：

```css
.test {
  border-width: 1px;
  border-style: solid;
  border-color: red;
}
```

更常见的是直接用简写：

```css
.test {
  border: red 1px solid;
}
```

#### 常见边框样式

`border-style` 常见值包括：

- `none`
- `solid`
- `dashed`
- `dotted`
- `double`

其中最常用的是：

- `solid`
- `dashed`
- `dotted`

#### 单边边框

如果只想控制某一边：

```css
.test {
  border-top: red 1px solid;
}
```

也可以拆开写：

```css
.test {
  border-top-color: red;
  border-top-width: 1px;
  border-top-style: solid;
}
```

其他三个方向同理：

- `border-right`
- `border-bottom`
- `border-left`

#### 边框会让盒子变大

默认情况下，边框会增加盒子的最终实际尺寸。

例如：

```css
.test-box {
  width: 300px;
  height: 100px;
  border: red 2px solid;
}
```

这里最终盒子的实际大小不再是 `300 x 100`，而会变成：

- 宽度 `304px`
- 高度 `104px`

因为四条边都加上了边框宽度。

#### 圆角 `border-radius`

现代 UI 里，圆角非常常见：

```css
.test {
  border-radius: 12px;
}
```

圆角半径越大，边角越圆滑。如果半径特别大，就会逐渐接近胶囊或椭圆效果。

还可以单独控制某一个角：

```css
.test {
  border-top-left-radius: 20px;
}
```

也可以使用简写：

```css
.test {
  border-radius: 100px 10px;
  border-radius: 100px 20px 10px;
  border-radius: 50px 20px 10px 30px;
}
```

### 内边距 `padding`

内边距指的是**内容区域和边框之间的空白区域**。

例如：

```css
.test-box {
  width: 200px;
  height: 50px;
  background-color: cornflowerblue;
  padding: 20px;
  border: red 2px solid;
}
```

这样内容就不会紧贴着边框，而是和边框之间留出 `20px` 的缓冲空间。

这在卡片、按钮、输入框这类组件里非常重要。没有内边距的内容通常会显得很挤。

#### `padding` 简写规则

```css
.test {
  padding: 10px;
  padding: 10px 20px;
  padding: 10px 20px 30px;
  padding: 10px 20px 30px 40px;
}
```

含义分别是：

- 1 个值：四边相同
- 2 个值：上下、左右
- 3 个值：上、左右、下
- 4 个值：上、右、下、左

#### `box-sizing`

盒模型里一个非常关键的属性是：

```css
box-sizing
```

默认值是：

```css
content-box
```

表示 `width` / `height` 只计算内容区，不包含 `padding` 和 `border`。

如果改成：

```css
box-sizing: border-box;
```

就表示：

- 你写下的 `width` / `height`
- 直接代表盒子的最终总宽高
- `padding` 和 `border` 会被算进内部

例如：

```css
.test-box {
  width: 300px;
  height: 100px;
  padding: 20px;
  border: 3px solid red;
  box-sizing: border-box;
}
```

这时盒子的最终大小仍然是 `300 x 100`，你不需要再额外手算减法。

#### 行内元素上的 `padding`

行内元素也可以写 `padding`，但要注意：

- 左右内边距通常表现正常
- 上下内边距虽然会被渲染
- 但不会像块级元素那样真正参与垂直布局计算

这也是为什么很多场景里，需要先把元素改成 `inline-block` 或块级，再去控制盒模型。

### 外边距 `margin`

外边距控制的是**元素和外界之间的距离**。它不属于元素内部空间，而是元素外部和其他元素之间的留白。

例如：

```css
.test {
  margin: 20px;
}
```

它会让盒子和外部元素之间都隔开 `20px`。

#### `margin` 简写规则

和 `padding` 一样：

```css
.test {
  margin: 20px;
  margin: 20px 10px;
  margin: 20px 10px 15px;
  margin: 20px 10px 15px 5px;
}
```

也可以单独写：

```css
.test {
  margin-top: 20px;
  margin-right: 20px;
  margin-bottom: 20px;
  margin-left: 20px;
}
```

#### `margin: auto`

`margin` 有一个非常常见的值：

```css
margin: auto;
```

它最典型的用途，是让块级元素水平居中：

```css
.card {
  width: 300px;
  margin: 0 auto;
}
```

它表示：

- 上下外边距为 `0`
- 左右外边距由浏览器自动平分

从而实现横向居中。

#### `margin` 折叠

`margin` 有一个很容易踩坑的行为，叫**margin 折叠**。

例如两个相邻块级元素都设置：

```css
margin: 20px;
```

你可能以为它们垂直之间应该相隔 `40px`，但实际往往只有 `20px`。因为相邻块级元素在垂直方向上的上下外边距会折叠，而不是简单相加。

常见折叠场景有三类：

- 相邻块级兄弟元素
- 父元素和第一个子元素的 `margin-top`
- 没有内容、没有 `padding`、没有 `border` 的空块元素自身上下 `margin`

避免折叠的常见办法包括：

- 给父元素加一点 `padding-top`
- 给父元素加一点 `border-top`
- 让父元素形成新的块格式化上下文 `BFC`

### 用户代理样式

浏览器为了让没有写 CSS 的网页也能有一个基础排版，通常会自带一套默认样式，这就是**用户代理样式表 `user agent stylesheet`**。

例如：

- `body` 默认常常有 `margin`
- `p` 默认常有上下外边距
- `h1 ~ h6` 默认有字号和粗细

这也是为什么你什么都不写，页面看起来依然不是完全“裸奔”。

#### 为什么要统一默认样式

问题在于：

- 不同浏览器默认样式并不完全相同
- 同一个页面在不同浏览器里可能看起来有细微差异

为了减少这些差异，工程里通常会引入一份样式归一化文件，比如 `normalize.css`。

引入方式：

```html
<link rel="stylesheet" href="css/normalize.css" />
```

也可以直接使用 CDN：

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.min.css"
/>
```

这样能让不同浏览器在很多基础样式上更统一。

### 滚动区域 `overflow`

当内容超出盒子大小时，浏览器默认会让它直接溢出显示。要控制这种行为，就需要 `overflow`。

例如：

```css
.box {
  width: 200px;
  height: 100px;
  background-color: #f0f0f0;
  white-space: nowrap;
}
```

如果内部文本很长，内容就会直接跑出盒子。

#### `overflow: auto`

```css
.box {
  overflow: auto;
}
```

这表示：

- 不溢出时不显示滚动条
- 溢出时自动出现滚动条

#### 其他常见值

- `visible`：默认，溢出内容照样显示
- `hidden`：超出部分隐藏，但仍是滚动容器
- `scroll`：始终显示滚动条
- `clip`：直接裁切，不保留滚动能力

#### 分方向控制

也可以分别控制水平和垂直方向：

```css
.box {
  overflow-y: auto;
  overflow-x: hidden;
}
```

#### 页面本身的滚动

当整个页面内容超出视口高度时，浏览器窗口也会出现滚动条。通常真正的滚动容器更接近 `html`。

如果你这样写：

```css
html {
  overflow: hidden;
}
```

页面滚动条就会消失，用户无法正常滚动页面。

### UI 设计：卡片为什么看起来舒服

很多现代页面都大量使用卡片，而卡片之所以“看起来舒服”，往往不是因为它多复杂，而是因为盒模型控制得比较合理。

#### 1. 背景和边界感

卡片首先要让用户明确感知到“这是一个独立区域”。最常见的做法有：

- 使用区别于页面背景的浅色背景
- 加一条细边框
- 或者后续加一点阴影

如果背景和页面底色太接近，卡片会显得没有边界。

#### 2. 内边距

没有内边距的卡片通常会显得很压抑，因为内容紧贴边缘，没有“呼吸空间”。

而内边距过大，又会显得空洞。

比较常见的经验值通常按 `4` 的倍数去调，例如：

- `8px`
- `12px`
- `16px`
- `20px`
- `24px`

#### 3. 圆角

现代 UI 里，圆角常常能让元素显得更柔和，减少直角带来的紧绷感。

但圆角也不能无脑拉太大。一个比较实用的经验是：

> 圆角半径通常不要明显大于内边距。

否则卡片会显得过于圆滑，甚至带一点气泡感。

### UI 设计：颜色

颜色在 UI 设计里绝对不是“好看就行”，它本质上承担的是四类任务：

- 传达信息
- 引导注意力
- 建立品牌感
- 拉开层级关系

很多初学者做页面时最大的问题，不是不会写 CSS，而是颜色乱选。颜色一旦选得不合理，页面通常会出现这些问题：

- 风格不统一，看起来像不同页面拼起来的
- 对比不足，重点不明显，内容看不清
- 对比过强，颜色之间互相打架，页面刺眼
- 情绪混乱，颜色表达和内容语义不一致
- 层级不清楚，不知道哪里才是重点

#### 颜色不是越多越好

一个很重要的经验是：

> 颜色首先是信息载体，其次才是装饰。

因此大多数成熟界面都不会堆太多颜色，更不会轻易上“彩虹配色”。因为颜色一多，页面里的每一个元素都在抢注意力，最后反而没有重点。

一种常见而稳定的配色方式是：

- **主色 `Primary`**：品牌识别、主按钮、关键视觉
- **辅色 `Secondary`**：辅助内容、分区背景、次级信息
- **强调色 `Accent`**：提醒、警告、悬停、反馈

#### 主色、辅色、强调色怎么配

主色和辅色通常应该：

- 保持在同一色系附近
- 有明显但不过分的层次差异
- 不抢夺同一层级的注意力

强调色则应该和前两者拉开距离，用于提示“这里值得看一眼”。它不需要大量出现，但一旦出现，最好能快速抓住注意力。

#### 颜色也有情绪

颜色不仅影响美观，还会带来心理暗示。最常见的直觉包括：

- **蓝色**：科技、可信赖、冷静
- **红色**：警告、禁止、危险、热情
- **绿色**：安全、通过、自然、清新
- **黄色**：提醒、注意、高能提示

所以颜色不能脱离内容语义乱用。比如错误提示做成绿色、成功提示做成红色，用户会天然觉得别扭。

### 布局

前面学的是“一个盒子长什么样”，现在要进入下一层问题：

> 多个盒子在页面里应该怎么排？

这就是布局。

布局决定的是：

- 元素如何排列
- 元素之间如何换行
- 元素如何伸缩
- 元素如何对齐
- 元素在页面中的空间关系是什么

#### 普通文档流 `Normal Flow`

浏览器默认使用的是**普通文档流**。

在普通流里，几种常见元素的排列方式如下：

- **块级元素**：从上到下依次排列，独占一行
- **行内元素**：从左到右排列，不独占一行
- **行内块元素**：像文字一样排布，但允许设置宽高

很多简单页面，只靠普通流就能完成。但如果你想做固定导航、浮动按钮、重叠元素、两列三列布局，就必须进入更高级的布局方式。

### 定位布局

定位布局主要用来解决“元素应该钉在哪里”这类问题。

核心属性是：

```css
position
```

默认值是：

```css
position: static;
```

也就是不启用特殊定位，完全按普通文档流排列。

#### 相对定位 `relative`

相对定位的特点是：

- 相对于元素原本位置发生偏移
- **不脱离文档流**

例如：

```css
.inner-box {
  width: 100px;
  height: 50px;
  background-color: cornflowerblue;
  position: relative;
  left: 10px;
}
```

这表示元素会在“原本位置”的基础上向右偏移 `10px`。

要特别注意：

- 视觉上它的位置变了
- 但它原本在文档流里占据的位置仍然保留

所以后面的兄弟元素排版时，仍然会把它当成“还在原位”。

#### 绝对定位 `absolute`

绝对定位的特点是：

- **脱离文档流**
- 相对于最近的“已定位祖先元素”进行定位

例如：

```css
.inner-box {
  width: 100px;
  height: 50px;
  background-color: cornflowerblue;
  position: absolute;
  right: 10px;
}
```

如果它的所有祖先都没有设置非 `static` 的定位，那么它最终就会以视口或最外层包含块为参考。

也正因为它脱离文档流，所以原本它占据的位置会被腾出来，其他元素不会再为它留空位。

#### 子绝父相

如果你希望绝对定位的子元素相对于父元素移动，而不是相对于整个页面移动，最常见的写法就是：

- 父元素：`position: relative`
- 子元素：`position: absolute`

这就是常说的：

> **子绝父相**

它的本质不是口诀，而是：

- 父元素通过 `relative` 创建了一个新的定位参考系
- 子元素的 `absolute` 于是就不再参考整个页面，而是参考这个父元素

#### 固定定位 `fixed`

固定定位和绝对定位很像，但它始终以**视口**为参考：

```css
.inner-box {
  position: fixed;
  top: 10px;
}
```

它的特点是：

- 脱离文档流
- 默认参考浏览器窗口
- 页面滚动时依然固定在原位置

这类定位适合：

- 回到顶部按钮
- 浮动提示
- 固定导航栏
- 客服按钮

#### 粘滞定位 `sticky`

`sticky` 可以理解成 `relative` 和 `fixed` 的结合体。

它在没滚到阈值前，表现得像相对定位；滚到阈值后，又会像固定定位一样“粘”住。

例如：

```css
.sticky-box {
  position: sticky;
  top: 30px;
}
```

使用 `sticky` 时要记住两点：

- 必须设置 `top`、`bottom`、`left`、`right` 中的至少一个
- 父容器和滚动容器不能把它的活动空间压得太小

它非常适合做：

- 吸顶导航
- 目录侧栏
- 滚动中的小标题

### 包含块 `Containing Block`

理解定位时，必须补一个概念：**包含块**。

你可以把包含块理解成：

> 一个元素计算尺寸和定位时所参考的那块区域。

这个概念在两类场景里尤其重要：

- 百分比尺寸
- 定位偏移

#### 静态 / 相对定位时

当元素处于普通流或相对定位时，它通常参考最近的块级祖先元素内容区。

#### 绝对定位时

当元素是 `absolute` 时，它会寻找最近的、`position` 不为 `static` 的祖先元素，并以这个祖先元素的内边距区域为参考。

这正是“子绝父相”的底层原理。

#### 固定定位时

当元素是 `fixed` 时，它默认参考视口，也就是浏览器窗口。

所以理解包含块之后，你就更容易回答这些问题：

- 为什么 `width: 50%` 不是你以为的那 `50%`
- 为什么这个绝对定位元素跑到了页面边缘
- 为什么加了一个 `relative` 之后位置 suddenly 正常了

### Z 轴顺序

前面讨论的都是 X 轴和 Y 轴，也就是左右和上下。但网页其实还存在一个第三维：

- **Z 轴**

你可以把它理解成“谁盖在谁上面”。

如果两个元素发生重叠，默认情况下：

- 后写在 HTML 里的元素，通常更容易盖住前面的元素

但如果你想明确控制覆盖顺序，就要用：

```css
z-index
```

例如：

```css
.a {
  z-index: 20;
}

.b {
  z-index: 10;
}
```

数值越大，通常越靠前。

不过有个前提：

- `z-index` 只对非 `static` 定位元素有效

也就是说，常见要配合：

- `relative`
- `absolute`
- `fixed`
- `sticky`

一起使用。

### 层级上下文 `Stacking Context`

很多人学到 `z-index` 时，会误以为“只要数值大就一定在最上面”。这并不完全对，因为真正比较覆盖顺序时，还要看**层级上下文**。

你可以把层级上下文理解成一个独立的小空间：

- 在这个空间里的元素，彼此比较 `z-index`
- 但它们不能跨出这个空间，直接和外层世界乱比

#### 什么情况会创建层级上下文

这一阶段先记住几个最常见的：

- 元素有非 `static` 定位并设置了 `z-index`
- 元素使用了 `position: fixed`
- `sticky` 在粘滞状态下

还有一些更高级的触发条件，例如：

- `opacity`
- `transform`
- `filter`

#### 为什么子元素 `z-index: 999` 还是压不过别人

这是层级上下文最常见的坑。

如果父元素自己创建了新的层级上下文，那么子元素即使 `z-index: 999`，也只能在父元素这个小空间里赢。它没法跳出去和外层兄弟元素直接比较。

所以很多时候并不是“你孩子不够强”，而是“你爹所在的上下文层级就低”。

### 网格布局 `Grid`

如果说定位布局擅长“把某个元素放到某个位置”，那么 Grid 更适合做：

- 面板布局
- 卡片墙
- 控制台页面
- 二维排版

Grid 的核心特点是：

> **它是二维布局。**

也就是它同时管理：

- 行
- 列

#### 开始使用 Grid

先把容器设成网格：

```css
.grid-box {
  display: grid;
}
```

它的直接子元素就会自动变成网格项 `Grid Item`。

#### 列与行

最基础的定义方式：

```css
.grid-box {
  display: grid;
  grid-template-columns: 100px 100px 100px;
  grid-template-rows: 100px 100px;
}
```

这表示：

- 3 列，每列 `100px`
- 2 行，每行 `100px`

#### `fr` 单位

固定像素很直观，但不够灵活。Grid 里非常常用的单位是：

```css
fr
```

它表示“剩余空间的一份”。

例如：

```css
.grid-box {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
```

这就是 3 等分。

如果写成：

```css
grid-template-columns: 1fr 2fr 1fr;
```

那么中间列宽度就是两边的两倍。

#### `repeat()` 和 `gap`

重复写很多列时，可以用：

```css
repeat(3, 1fr)
```

例如：

```css
.grid-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 100px);
  gap: 10px;
}
```

这里：

- `repeat()` 负责简化重复值
- `gap` 负责网格之间的沟槽间距

#### 自动扩列

Grid 非常适合响应式卡片墙，常见写法是：

```css
.grid-box {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
```

这段代码的意思是：

- 每列最窄不少于 `200px`
- 如果空间够大，就自动多塞几列
- 每列还能按剩余空间继续伸展

这是很多资源列表页和卡片列表页都特别爱用的写法。

#### 显式网格和隐式网格

你手动定义出来的行和列，叫**显式网格**。

如果内容超出你定义的范围，浏览器会自动补出新的行或列，这部分就叫**隐式网格**。

这时可以用：

- `grid-auto-rows`
- `grid-auto-columns`

来控制这些自动补出来的格子尺寸。

#### 元素跨行跨列

Grid 很强大的一点是：元素可以跨越多个格子。

例如：

```css
.grid-item.first {
  grid-column: 1 / 3;
}
```

表示它从第 1 条列线开始，到第 3 条列线结束，也就是横跨 2 列。

也可以写成：

```css
.grid-item.first {
  grid-column: span 2;
}
```

如果想横跨整行：

```css
.grid-item.first {
  grid-column: 1 / -1;
}
```

#### 网格对齐

Grid 里对齐有三类：

- `*-content`：控制整个网格在容器里的排布
- `*-items`：控制所有网格项在单元格里的对齐
- `*-self`：控制某一个网格项在单元格里的对齐

同时它又分两个方向：

- `justify-*`：行轴方向
- `align-*`：块轴方向

所以你会看到这些属性：

- `justify-content`
- `align-content`
- `justify-items`
- `align-items`
- `justify-self`
- `align-self`

它们的思路其实都一样，只是控制对象不同。

#### 网格区域 `grid-template-areas`

Grid 还有一个很适合做页面原型的能力，就是直接用名字“画布局”：

```css
.grid-box {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 40px 140px 40px;
  grid-template-areas:
    "header header header"
    "nav content content"
    "nav footer footer";
}
```

然后再给子元素起区域名：

```css
.header {
  grid-area: header;
}

.nav {
  grid-area: nav;
}

.content {
  grid-area: content;
}

.footer {
  grid-area: footer;
}
```

这种写法最大的优点是：

- 语义特别清楚
- 一眼就能看出页面结构

### 弹性布局 `Flex`

如果说 Grid 是二维布局，那么 Flex 就是一维布局。

它非常适合：

- 导航栏
- 按钮组
- 横向卡片排布
- 居中对齐
- 自适应伸缩

很多实际页面里，Flex 的使用频率甚至比 Grid 更高。

#### 开始使用 Flex

```css
.flex-box {
  display: flex;
}
```

这样父元素就成了 **Flex 容器**，直接子元素就会变成 **Flex 项目**。

默认情况下，它们会：

- 横向排列
- 按顺序排在一行里
- 即使本来是块级元素，也不再独占整行

#### `gap`

和 Grid 一样，Flex 也支持：

```css
gap: 10px;
```

这样项目之间就能直接留间距，而不用到处手写 `margin`。

#### `flex-wrap`

默认情况下，Flex 项目会尽量挤在一行里，必要时被压缩。

如果你希望排不下时自动换行：

```css
.flex-box {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
```

这样项目就会保持自己的合理尺寸，在空间不足时换到下一行。

### 盒模型与基础布局小结

从盒模型走到布局，CSS 的思路其实一直很一致：

- 先理解单个盒子怎么占空间
- 再理解多个盒子怎么互相排列
- 最后再理解重叠、层级、滚动和响应式这些更复杂的问题

这一部分你最应该真正掌握的是：

- `content / padding / border / margin`
- `box-sizing`
- `overflow`
- `position`
- `absolute / relative / fixed / sticky`
- `z-index` 和层级上下文
- `Grid` 的二维思维
- `Flex` 的一维思维

如果这些概念已经在你脑子里形成了一套稳定模型，后面再继续学布局和 UI，你就不会只是“照着写”，而会开始真正知道每一个盒子为什么会出现在那个位置。

### Flex 对齐方式

Flexbox 的核心在于它引入了两个特别重要的概念：

- **主轴 `Main Axis`**
- **交叉轴 `Cross Axis`**

默认情况下：

- 主轴是水平方向，从左到右
- 交叉轴是垂直方向，从上到下

#### `flex-direction`

主轴方向由 `flex-direction` 决定：

```css
.flex-box {
  display: flex;
  flex-direction: column;
}
```

常见取值：

- `row`：默认，主轴水平从左到右
- `row-reverse`：主轴水平从右到左
- `column`：主轴垂直从上到下
- `column-reverse`：主轴垂直从下到上

一旦主轴方向变了，后面所有基于主轴和交叉轴的对齐规则也会跟着一起换方向。

#### `flex-flow`

`flex-direction` 和 `flex-wrap` 还有一个简写形式：

```css
flex-flow: row-reverse wrap;
```

它等价于：

```css
flex-direction: row-reverse;
flex-wrap: wrap;
```

#### `justify-content`

`justify-content` 控制的是**主轴**上的对齐方式。

常见值：

- `flex-start`
- `flex-end`
- `center`
- `space-between`
- `space-around`
- `space-evenly`

例如：

```css
.flex-box {
  display: flex;
  gap: 10px;
  justify-content: center;
}
```

这表示所有项目在主轴方向上向中间靠拢。

#### `align-items`

`align-items` 控制的是**交叉轴**上的整体对齐。

例如：

```css
.flex-box {
  display: flex;
  gap: 10px;
  height: 200px;
  align-items: center;
}
```

这会让所有 Flex 项目在交叉轴方向上居中。

#### `align-content`

`align-content` 也是控制交叉轴，但它控制的是**多行整体**的排布方式。

所以它只有在下面这种情况下才有意义：

- 容器允许换行
- 项目真的换成了多行

例如：

```css
.flex-box {
  display: flex;
  flex-wrap: wrap;
  height: 300px;
  gap: 10px;
  align-content: space-between;
}
```

这时多行项目会在交叉轴上被拉开并分布。

#### `align-self`

如果你只想控制某一个项目，而不是所有项目，可以用：

```css
.flex-item.special {
  align-self: end;
}
```

它会覆盖父容器的 `align-items`，只对当前项目生效。

### Flex 空间分配

Flex 的另一大核心能力，是它能控制项目在空间不足或有剩余空间时，如何收缩和扩张。

#### `flex-shrink`

`flex-shrink` 控制空间不足时，项目怎么缩小。

默认值是：

```css
flex-shrink: 1;
```

表示：

- 空间不够时，项目允许缩小

如果你不希望它被压缩：

```css
.flex-item {
  flex-shrink: 0;
}
```

这样项目就会尽量保持自己的原始尺寸。

#### `flex-grow`

`flex-grow` 控制有剩余空间时，项目怎么扩张。

默认值是：

```css
flex-grow: 0;
```

表示：

- 即使还有多余空间，项目也不主动长大

如果写成：

```css
.flex-item {
  flex-grow: 1;
}
```

那么所有项目就会平分剩余空间。

如果某个项目是：

```css
flex-grow: 2;
```

那它会比 `1` 的项目多分一倍空间。

#### `flex-basis`

`flex-basis` 可以理解为项目在主轴上的“基础尺寸”：

```css
.flex-item {
  flex-basis: 100px;
}
```

默认值通常是 `auto`，也就是由内容或 `width/height` 决定。

#### `flex` 简写

`flex-grow`、`flex-shrink` 和 `flex-basis` 可以一起简写成：

```css
.flex-item {
  flex: 1 0 auto;
}
```

等价于：

```css
.flex-item {
  flex-grow: 1;
  flex-shrink: 0;
  flex-basis: auto;
}
```

一些很常见的写法：

- `flex: 0 1 auto`：默认行为
- `flex: 1`：等价于 `flex: 1 1 0%`
- `flex: auto`：等价于 `flex: 1 1 auto`
- `flex: none`：等价于 `flex: 0 0 auto`

#### 用 Flex 做经典页面结构

Flex 很适合做“头部 + 侧边栏 + 主体 + 底部”这种结构。

例如：

```css
.main-window {
  height: 240px;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
}

.main-content__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
```

这种布局写起来通常比传统方法清晰得多。

### 浮动布局 `float`（选学）

`float` 是旧时代网页布局里非常典型的一种方案。虽然现在整体页面布局更推荐 `Flex` 和 `Grid`，但 `float` 仍然值得了解，因为：

- 老代码里常见
- 图文环绕效果至今仍然很好用

#### `float` 的本质

```css
.float-box {
  float: left;
}
```

常见值：

- `left`
- `right`
- `none`

浮动的本质是：

- 元素脱离普通文档流
- 向左或向右“贴边”
- 后续行内内容会围绕它排布

所以它最自然的用途就是：

- 图片浮动
- 文本环绕

#### 浮动带来的问题

`float` 的副作用也很多，最典型的是：

- 父元素高度塌陷

因为子元素一旦都浮动了，父元素会误以为“里面没内容”，从而高度变成 `0`。

#### 清除浮动

常见解决方法有三类：

- 在末尾加一个清除浮动的元素
- 让父元素创建 `BFC`
- 使用 `::after` 伪元素做 clearfix

现代代码里，更推荐用：

- `Flex`
- `Grid`

来做页面整体布局；`float` 更适合作为补充知识。

### 表格布局 `display: table`（选学）

在 `Flex` 和 `Grid` 出现之前，还有人会通过：

- `display: table`
- `display: table-row`
- `display: table-cell`

来模拟表格布局。

它能解决一部分多列排版问题，但缺点也非常明显：

- 结构臃肿
- 语义混乱
- 响应式很差
- 不如现代布局灵活

所以理解即可，不建议作为现代项目主力方案。

### 行内布局容器

前面我们说过：

- `display: flex` 会把容器变成块级 Flex 容器
- `display: grid` 会把容器变成块级 Grid 容器

但有些时候，你希望它保留布局能力，同时又像行内元素一样和文本并排。这时可以用：

- `inline-flex`
- `inline-grid`

例如：

```css
.flex-box {
  display: inline-flex;
  gap: 10px;
}
```

这样容器本身就不会再独占一行。

### 块级格式化上下文 `BFC`

`BFC` 是 CSS 布局里一个特别重要但一开始容易被忽略的概念。

你可以把它理解成：

> 一个独立的布局结界。

在这个结界里，内部元素的布局和外部元素相互隔离。

#### BFC 的几个关键特性

- 内部布局不会直接影响外部
- 同一个 BFC 里的相邻块级元素会发生垂直 `margin` 折叠
- BFC 可以包含内部浮动元素
- BFC 的区域不会和浮动元素重叠

#### 常见的创建方式

下面这些情况都能创建 BFC：

- 根元素 `html`
- 浮动元素
- `absolute` / `fixed`
- `inline-block`
- `flex` / `inline-flex`
- `grid` / `inline-grid`
- `overflow` 不为 `visible`

其中最常用也最容易记住的一种是：

```css
.box {
  overflow: hidden;
}
```

#### BFC 能解决什么

最常见的两个用途是：

- 解决浮动导致的父元素高度塌陷
- 阻止某些 `margin` 折叠问题

所以很多时候，你看到某段代码只是简单加了个：

```css
overflow: hidden;
```

背后不一定是为了裁剪内容，很可能只是为了让这个盒子形成 BFC。

### UI 设计：轻量视差

很多首页会做一种很常见的质感效果：

- 内容在滚动
- 背景像被固定住一样

这类效果可以用 `background-attachment` 做一个轻量版。

例如：

```css
body {
  margin: 0;
  background-size: 100% 500px;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-image: url("/img/background.jpeg");
}
```

其中：

- `scroll`：默认，背景跟着内容一起滚
- `fixed`：背景固定在视口上
- `local`：背景跟随元素内部内容滚动

`fixed` 很适合做简单的首页视觉增强。但如果你想实现更复杂、更真实的视差效果，通常还是会交给 JavaScript。

### UI 设计：顶部导航栏

顶部导航栏通常是一个非常适合练手的 UI 组件，因为它会综合用到：

- `position: fixed` 或 `sticky`
- Flex 对齐
- 间距系统
- 字体与颜色层级
- 图标库

常见图标库包括：

- `Font Awesome`
- `iconfont`
- `IconPark`

顶部导航栏的基本设计思路通常是：

- 左侧放品牌标识
- 中间或右侧放导航项
- 重要按钮和普通链接做明显层级区分
- 高度不要太矮，通常要留足点击区域

### 选择器进阶

前面学的是标签、类、ID、属性、后代这些基础选择器。接下来要进入更灵活的一层：

- **伪类**
- **伪元素**
- **嵌套选择器**

### 伪类选择器

伪类选择器用来选择“处于某种状态”的元素，它不创造新元素，而是给已有元素在某个条件下套样式。

写法以一个冒号开头：

```css
a:hover {
  color: red;
}
```

#### 交互状态伪类

最常见的一组包括：

- `:link`
- `:visited`
- `:hover`
- `:active`
- `:focus`

例如：

```css
a:link {
  color: green;
}

a:visited {
  color: red;
}

a:hover {
  color: purple;
  text-decoration: none;
}

a:active {
  color: orange;
}
```

如果这几个一起写，通常要记住一个老规则：

- `LVHA`

也就是：

- `:link`
- `:visited`
- `:hover`
- `:active`

这样更容易得到符合预期的覆盖效果。

`input:focus` 也非常常用，例如：

```css
input:focus {
  background: green;
}
```

#### 结构伪类

结构伪类根据元素在 DOM 里的位置来选中它们。

常见有：

- `:first-child`
- `:last-child`
- `:nth-child()`
- `:only-child`
- `:nth-of-type()`

例如：

```css
li:first-child {
  font-weight: bold;
}

li:last-child {
  font-style: italic;
}

li:nth-child(even) {
  background-color: #f2f2f2;
}
```

这种写法特别适合做：

- 斑马纹列表
- 特定位置元素高亮
- 结构化排版

#### `:not`

如果想“除了某个条件之外都选中”，可以用：

```css
li:not(:first-child) {
  font-weight: bold;
}
```

它表示：

- 选中所有不是第一个子元素的 `li`

#### `:where` 和 `:is`

有时多个选择器共享同样的后缀条件，可以写成：

```css
:where(header, main, footer) p:hover {
  color: red;
  cursor: pointer;
}
```

这在语义上非常清晰。和它相似的还有 `:is()`，区别主要在于：

- `:where()` 基本不增加优先级负担
- `:is()` 会按内部选择器参与优先级计算

#### `:has`

`:has()` 是一个特别强的伪类，可以根据“是否拥有某种后代或兄弟结构”来反向选择父元素。

例如：

```css
div:has(> a) {
  background-color: green;
}
```

它表示：

- 只要 `div` 里有直接子元素 `a`
- 这个 `div` 就变绿

它非常适合做一些以前很难纯 CSS 解决的“父元素条件样式”。

### 伪元素选择器

伪元素和伪类不同。它不是选择“某种状态”，而是：

- 选择元素的某个特殊部分
- 或创建一个并不存在于 DOM 树里的“虚拟内容”

标准写法是双冒号：

```css
::before
::after
```

虽然老浏览器也支持单冒号写法，但现在最好还是用双冒号来明确区分。

#### 常见伪元素

例如输入框占位文本：

```css
input::placeholder {
  color: #bc8cd3;
}
```

再比如列表项前面的标记：

```css
li::marker {
  content: "🚀";
}
```

再比如首字母和选中文本：

```css
p::first-letter {
  font-size: 1.5rem;
  font-weight: bold;
  color: brown;
}

p::selection {
  color: white;
  background-color: #c582f1;
}
```

#### `::before` 和 `::after`

这是最常用、也最灵活的一组伪元素。

例如：

```css
p::before {
  content: "";
  width: 20px;
  height: 20px;
  margin-right: 5px;
  display: inline-block;
  background-color: red;
}
```

这里会在 `p` 的内容前面插入一个小红块。

使用时一定要记住：

- 必须写 `content`
- 否则这个伪元素等于不存在

它们特别适合做：

- 装饰图标
- 小角标
- 分割线
- 不想为纯装饰额外加 HTML 标签的场景

但也要注意：

- 它们不是真实 DOM 节点
- 不适合承载真正重要的语义内容
- JavaScript 也不能像操作普通元素那样直接操作它们

### 嵌套选择器

嵌套选择器是较新的 CSS 语法，它允许你把子规则直接写在父规则内部，让样式结构更接近 HTML 结构。

例如，以前你可能这样写：

```css
.card {
  background-color: white;
  border-radius: 8px;
}

.card h2 {
  font-size: 1.5rem;
  color: #333;
}

.card p {
  line-height: 1.6;
}
```

现在可以写成：

```css
.card {
  background-color: white;
  border-radius: 8px;

  h2 {
    font-size: 1.5rem;
    color: #333;
  }

  p {
    line-height: 1.6;
  }
}
```

这种写法更直观，也更方便维护组件样式。

#### `&` 占位符

当你需要明确引用“父选择器本身”时，就要用：

```css
&
```

例如：

```css
.card {
  &::before {
    content: "demo";
  }

  &.child {
    background: red;
  }
}
```

这里：

- `&::before` 等于 `.card::before`
- `&.child` 等于 `.card.child`

如果没有 `&`，很多伪元素和拼接选择器都不会按你期望的方式工作。

### UI 设计：抄官网练布局

当你把盒模型、定位、Grid、Flex、伪类和伪元素这些内容都学到这里之后，最有效的练习方式其实已经不再是“再看一遍语法”，而是：

> **找一个你觉得做得不错的网站，照着临摹它的布局和视觉结构。**

这是训练 CSS 最有效的方法之一，因为它会逼着你把零散知识真正串起来：

- 这个区域为什么要用 Flex，而不是 Grid
- 这个导航栏为什么用固定定位或粘滞定位
- 这里的间距为什么看起来舒服
- 这个按钮为什么一眼就像“主按钮”
- 为什么别人页面一眼看上去更稳，而你的页面显得乱

如果你想练企业官网风格，像苹果官网这类站点就很适合作为练习对象。它们的特点通常是：

- 大块留白很多
- 层级控制非常克制
- 字体和颜色体系很统一
- 卡片、横幅、导航栏、按钮都很讲究节奏感

练习时建议不要一开始就追求 100% 还原，而是先拆问题：

1. 先还原整体结构
2. 再还原布局方式
3. 再调间距和对齐
4. 最后再抠颜色、字体和交互细节

这样你会更容易真正提升，而不是停留在“对着样子堆代码”。

### 练习

可以用下面这些问题快速自测。

#### 选择题

1. 关于标准盒模型 `content-box`，正确的是：

- A. `width` 包含内容、`padding` 和 `border`
- B. `width` 只包含内容区域
- C. `width` 包含内容和 `padding`
- D. `width` 包含内容和 `margin`

2. 如果一个元素设置了 `box-sizing: border-box;`，那么 `width` 表示的是：

- A. 内容宽度
- B. 内容 + `padding`
- C. 内容 + `padding` + `border`
- D. 内容 + `padding` + `border` + `margin`

3. 下列哪种定位方式**不会**脱离文档流：

- A. `absolute`
- B. `fixed`
- C. `relative`
- D. `float`

4. 在 Flex 布局中，`justify-content` 默认控制的是：

- A. 交叉轴
- B. 块轴
- C. 主轴
- D. 行内轴

5. 关于 `::before`，正确的是：

- A. 不需要 `content` 也能显示
- B. 是 DOM 中真实存在的节点
- C. 默认是行内元素
- D. 只能用于 `div`

6. 下列哪个伪类表示第一个子元素：

- A. `:first-child`
- B. `:first-of-type`
- C. `:nth-child(1n)`
- D. `:only-child`

### 全文小结

到这里，这份文档已经把从盒模型一路走到布局，再到选择器进阶和一些 UI 设计思路的主线串起来了。

真正要掌握的，不是零散属性，而是这几层能力：

- **盒模型能力**：知道一个盒子到底占多大空间
- **布局能力**：知道多个盒子怎么排列、怎么对齐、怎么伸缩
- **层级能力**：知道重叠时谁在上面、谁被压住
- **选择能力**：知道样式到底该作用到谁
- **UI 判断能力**：知道什么样的间距、颜色和边界更舒服

如果这些东西你已经不再只是“认识名词”，而是能根据页面问题反推出该用哪类属性，那你的 CSS 就真正开始进入可控阶段了。
