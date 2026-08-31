---
title: CSS3 变换、过渡与动画
date: 2026-03-28
order: 3
---

## CSS3 变换、过渡与动画


### 盒子模型进阶

#### 最大宽度和最小宽度

除了前面学过的 `width` 和 `height`，CSS 还提供了一组很实用的限制属性：

- `max-width`
- `min-width`
- `max-height`
- `min-height`

它们非常适合响应式场景，因为很多时候我们希望：

- 元素能跟随屏幕尺寸变化
- 但又不能无限变宽或无限变窄

例如：

```css
.container {
  width: 80%;
  max-width: 500px;
  min-width: 320px;
  margin: 0 auto;
}
```

这段代码的意思是：

- 宽度优先取父元素的 `80%`
- 但最大不超过 `500px`
- 最小不低于 `320px`
- 在宽屏时保持水平居中

这种写法在很多页面主体容器里都很常见。因为页面内容不可能随着窗口宽度无限拉伸，否则版面会越来越松散，阅读体验也会越来越奇怪。

要注意一点：

- 如果你需要的是固定尺寸，请优先使用普通的 `width` 和 `height`
- `max-*` / `min-*` 更适合拿来做限制条件，而不是替代固定尺寸

#### 轮廓 `outline`

轮廓和边框长得很像，但本质上不是一回事。

轮廓的特点有两个：

- 画在边框外面
- **不占据布局空间**

例如：

```css
.container {
  width: 200px;
  height: 100px;
  background-color: gray;
  outline-style: solid;
  outline-width: 2px;
  outline-color: black;
}
```

更常见的是简写：

```css
.container {
  outline: 2px solid black;
}
```

和边框相比，轮廓更像是一层额外描边，不参与盒模型尺寸计算，所以不会把盒子撑大。

#### `outline-offset`

轮廓还有一个很特别的属性：

```css
outline-offset
```

例如：

```css
.container {
  outline: 2px solid black;
  outline-offset: 5px;
}
```

它表示轮廓和盒子边缘之间再留出 `5px` 距离。

这个值甚至可以是负数：

```css
.container {
  outline-offset: -3px;
}
```

负数时，轮廓会往盒子内部“压进去”。

#### `outline` 的常见用途

前面其实你已经遇到过轮廓了，只是当时可能没意识到。例如浏览器默认给输入框的聚焦态，常常就会带一圈蓝色轮廓。

如果想取消它：

```css
input:focus {
  outline: none;
}
```

不过实际开发里不要无脑去掉聚焦轮廓。因为它对键盘导航和无障碍很重要。如果你要去掉，最好自己提供一个更清晰的替代样式。

### 盒子阴影

阴影是现代 UI 里非常常见的一种视觉手段。最常用的属性是：

```css
box-shadow
```

基本写法：

```css
box-shadow: offset-x offset-y blur-radius spread-radius color;
```

例如：

```css
.container {
  width: 200px;
  height: 100px;
  background-color: #d5d5d5;
  box-shadow: 0 0 10px gray;
}
```

它表示：

- 水平偏移 `0`
- 垂直偏移 `0`
- 模糊半径 `10px`
- 阴影颜色 `gray`

#### 阴影的几个核心参数

- `offset-x`：水平偏移
- `offset-y`：垂直偏移
- `blur-radius`：模糊半径，越大越柔和
- `spread-radius`：扩展半径，正值扩大，负值缩小
- `color`：阴影颜色

#### 阴影不会占布局空间

阴影和 `outline` 一样，不会改变盒子的布局尺寸，但它可能会被父元素裁剪。

例如外层容器这样写：

```css
.outer-box {
  width: 220px;
  height: 120px;
  overflow: hidden;
}
```

如果内部元素阴影太大，就会被直接截断。

#### 多重阴影

阴影不只能写一个，也可以写多个，用逗号分隔：

```css
.container {
  box-shadow:
    0 -4px 3px rgba(0, 42, 255, 0.12),
    0 4px 8px rgba(255, 0, 0, 0.2);
}
```

这在做层次感、霓虹感或者更复杂的 UI 质感时很常见。

#### 内阴影 `inset`

如果想让阴影出现在内部，可以加上：

```css
inset
```

例如：

```css
.container {
  box-shadow: 0 0 10px gray inset;
}
```

这会生成一个内阴影，而不是普通的外阴影。

#### 用阴影模拟 1px 边框

有时不同设备缩放比例不同，普通 `1px` 边框的观感并不总是稳定。这时可以用一个无模糊、无偏移、只有扩展半径的阴影来模拟：

```css
.box {
  box-shadow: 0 0 0 1px #ccc;
}
```

它看起来和边框很像，但实现方式不同。

#### `text-shadow`

除了盒子阴影，还有文字阴影：

```css
.title {
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.35);
}
```

它适合用来做：

- 浅色字压在复杂背景图上
- 标题发光效果
- 一点轻微的立体感

但要克制使用，阴影一旦过重，文字反而会难读。

### 行内元素的纵向对齐

前面我们知道，行内元素和行内块元素可以穿插在一行里，比如：

- 文本
- `a`
- `span`
- `img`

但它们在纵向上并不一定天然“对齐舒服”。这时就要靠：

```css
vertical-align
```

#### 常见值

- `baseline`
- `top`
- `middle`
- `bottom`

默认情况下，大多数行内元素采用：

```css
vertical-align: baseline;
```

也就是按基线对齐。

#### 什么时候会感觉“歪了”

最典型的场景就是文字和图片混排。你会经常发现图片看起来像有点下沉或上浮，这就是默认基线对齐带来的视觉差异。

例如你可以显式改成：

```css
img {
  vertical-align: middle;
}
```

这样图片就会更接近文本中线位置。

要注意的是：

- `vertical-align` 只对行内元素和行内块元素有效
- 对普通块级元素无效

### 精灵图 `Sprite`

精灵图也叫雪碧图，它是一种把很多小图标合并到同一张大图里的做法。

核心思路是：

- 减少 HTTP 请求数量
- 通过背景图定位只显示大图中的一小块

例如：

```css
.vip-icon {
  display: inline-block;
  width: 40px;
  height: 40px;
  background-image: url("/img/sprites.png");
  background-position: -57px 0;
}
```

虽然现代前端里 SVG 图标和字体图标更常见，但精灵图依然是一个值得知道的经典技巧。尤其在老项目和部分游戏 UI 里，还能见到它。

### 颜色渐变

CSS3 的渐变可以让颜色在多个值之间平滑过渡。常见类型有两种：

- 线性渐变 `linear-gradient()`
- 径向渐变 `radial-gradient()`

#### 线性渐变 `linear-gradient()`

最简单的线性渐变：

```css
.container {
  width: 300px;
  height: 50px;
  background-image: linear-gradient(red, yellow);
}
```

默认方向是：

- 从上到下

如果想改成从左到右：

```css
background-image: linear-gradient(to right, red, yellow);
```

也可以写角度：

```css
background-image: linear-gradient(45deg, red, blue);
```

#### 多颜色渐变

```css
background-image: linear-gradient(
  to right,
  red,
  orange,
  yellow,
  green,
  blue,
  purple
);
```

还可以给颜色后面加百分比，控制它们在渐变中的停留位置：

```css
background-image: linear-gradient(to right, red 80%, yellow);
```

#### 渐变和图片一起使用

渐变也是一种背景图，所以它可以和普通图片叠在一起：

```css
background:
  linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(bg.jpg);
```

这个技巧特别适合：

- 给背景图压一层深色蒙版
- 增强前景文字可读性

#### `background-clip` 与渐变边框

背景不仅能铺满整个盒子，也可以只作用在某个盒模型区域。例如：

```css
.container {
  width: 300px;
  height: 50px;
  padding: 20px;
  background: linear-gradient(to right, red, blue) content-box;
  border: 2px solid gray;
}
```

这里的 `content-box` 表示：

- 渐变只显示在内容区域

如果配合多层背景和透明边框，还能做出渐变边框效果：

```css
.container {
  width: 300px;
  height: 50px;
  border-radius: 10px;
  background:
    linear-gradient(to right, white, white) padding-box,
    linear-gradient(to right, red, blue) border-box;
  border: 2px solid transparent;
}
```

这是一个非常实用的现代 UI 技巧。

#### 径向渐变 `radial-gradient()`

径向渐变是从中心向外扩散的：

```css
.container {
  width: 200px;
  height: 100px;
  background-image: radial-gradient(red, yellow);
}
```

默认情况下，它会根据盒子比例自动适应成椭圆形。

如果你想明确用圆形：

```css
background-image: radial-gradient(circle, red, yellow);
```

你还可以指定扩散范围，例如：

- `closest-side`
- `farthest-side`
- `closest-corner`
- `farthest-corner`

也能通过 `at` 改变中心点：

```css
background-image: radial-gradient(circle at left top, red, yellow);
```

### 滤镜 `filter`

`filter` 可以理解成“浏览器里的后期处理”，它能直接对元素做图形效果加工。

常见用途：

- 模糊
- 调亮 / 调暗
- 调整对比度
- 灰度化
- 反色
- 色相旋转
- 投影

#### `blur()`

```css
.container {
  filter: blur(5px);
}
```

会产生高斯模糊效果。

#### `brightness()`

```css
.container {
  filter: brightness(0.5);
}
```

默认亮度是 `1`，小于 `1` 会变暗，大于 `1` 会变亮。

#### `contrast()`

`contrast()` 用于调节对比度。对比度越高，颜色越鲜明；越低，画面越灰。

#### `grayscale()`

```css
.container {
  filter: grayscale(100%);
}
```

会把内容变成黑白灰效果。这类滤镜在一些纪念日页面上很常见。

#### 其他常见滤镜

- `invert()`：反色
- `sepia()`：复古棕色调
- `hue-rotate()`：色相偏移
- `drop-shadow()`：更贴近真实图形轮廓的投影

#### `drop-shadow()` 和 `box-shadow` 的区别

`box-shadow` 是按盒子外框投影，而 `drop-shadow()` 更接近“按实际绘制内容投影”。

所以：

- 透明背景图标
- 不规则图形
- 文字与透明 PNG

通常更适合 `drop-shadow()`。

而且多个滤镜也可以叠加使用，例如：

```css
filter: brightness(0.9) contrast(1.2) drop-shadow(0 0 4px gray);
```

### 背景过滤器 `backdrop-filter`

`backdrop-filter` 和 `filter` 很像，但作用对象不同。

你可以把它理解成：

> 不是处理盒子本身，而是处理盒子后面的内容。

这也是现代毛玻璃效果的核心来源。

例如：

```css
.card {
  width: 150px;
  height: 200px;
  padding: 10px 15px;
  border-radius: 15px;
  background-color: #ffffff60;
  backdrop-filter: blur(12px);
}
```

这样卡片背后的背景就会被模糊掉，而卡片本身内容仍然保持清晰。

它也支持和 `filter` 很接近的函数体系，例如：

- `blur()`
- `brightness()`
- `grayscale()`

`backdrop-filter` 特别适合：

- 毛玻璃卡片
- 半透明导航栏
- 浮层面板

### 二维和三维变换

到这里，前面的内容已经把：

- 盒模型
- 背景
- 阴影
- 渐变
- 滤镜

这些视觉工具都补齐了。接下来就要进入真正的“动起来”和“转起来”的部分，也就是：

- `transform`
- 二维变换
- 三维变换
- 过渡

`transform` 的核心意义在于：

> 在不改变文档流的前提下，改变元素的视觉表现。

也就是说，一个元素可以在视觉上移动、旋转、缩放、倾斜，但它在布局里的原始占位通常不会因此被重新计算。

这一点和前面相对定位造成的“视觉偏移但原位置仍保留”有一点相似，但 `transform` 更适合做交互和动画效果。后续继续往下讲二维、三维变换和过渡时，就会真正用到它。

#### 二维变换 `2D Transform`

二维变换指的是在 `X` 轴和 `Y` 轴组成的平面内做变化。最常见的几类包括：

- 平移 `translate()`
- 缩放 `scale()`
- 旋转 `rotate()`
- 倾斜 `skew()`

它们都通过同一个属性完成：

```css
transform
```

##### `translate()`

`translate()` 用于平移元素：

```css
.box {
  width: 100px;
  height: 100px;
  background-color: red;
  transform: translate(10px, 20px);
}
```

这表示：

- 水平移动 `10px`
- 垂直移动 `20px`

这里有一个很关键的理解：

- `translate()` 改变的是**视觉渲染位置**
- 而不是盒子在文档流中的真实占位

所以它和 `position: relative` 有点像，都会出现“看上去移动了，但原位置仍然保留”的效果。但两者的本质还是不一样：

- `relative` 更像元素本身偏移了
- `translate()` 更像是浏览器把它渲染到了另一个地方

这也是为什么 `translate()` 特别适合做动画和交互效果。

还可以单独控制某一个方向：

```css
transform: translateX(10px);
transform: translateY(20px);
```

##### `scale()`

`scale()` 用于缩放元素：

```css
.box {
  transform: scale(1.5);
}
```

表示元素放大到原来的 `1.5` 倍。

它默认会围绕元素中心点缩放。也可以分别设置横向和纵向比例：

```css
transform: scale(1.5, 2);
```

这表示：

- 水平方向放大 `1.5` 倍
- 垂直方向放大 `2` 倍

##### `rotate()`

`rotate()` 用于旋转元素：

```css
transform: rotate(45deg);
```

这表示元素围绕中心旋转 `45` 度。

##### `skew()`

`skew()` 用于倾斜元素：

```css
transform: skew(20deg, 10deg);
```

它会让原本的矩形看起来像一个平行四边形，常见于一些装饰性 UI 和特殊标题设计。

#### `transform-origin`

默认情况下，变换的原点是元素中心，也就是：

```css
center center
```

但你可以通过 `transform-origin` 改变这个基点：

```css
.box {
  transform-origin: left top;
  transform: rotate(45deg);
}
```

这时元素就不再围绕中心旋转，而是围绕左上角旋转。

这在做：

- 门板打开
- 卡片翻转
- 从某个角开始缩放

这类效果时特别重要。

#### 组合变换

多个变换可以写在同一个 `transform` 中，用空格分隔：

```css
.box {
  transform: translate(100px) rotate(45deg) scale(1.2);
}
```

要特别注意：

> **变换顺序非常重要。**

因为先旋转再平移，和先平移再旋转，最终结果可能完全不同。原因在于前面的变换会改变后续变换所参考的坐标系。

#### 三维变换 `3D Transform`

三维变换在二维基础上引入了：

- `Z` 轴

你可以把 `Z` 轴理解成“离你更近或更远”的方向。于是元素除了左右和上下，还可以产生一种“近大远小”的立体感。

最常见的 3D 变换包括：

- `rotateX()`
- `rotateY()`
- `rotateZ()`
- `translateZ()`

例如：

```css
.inner-box {
  width: 100px;
  height: 100px;
  background-color: red;
  transform: rotateY(80deg);
}
```

这表示元素围绕 `Y` 轴旋转。

#### `perspective`

如果没有景深，很多 3D 旋转看起来只像“变窄了”，而没有真正的立体感。要让浏览器模拟“近大远小”，就需要：

```css
perspective
```

通常它写在父元素上：

```css
.outer-box {
  perspective: 500px;
}
```

它的意思可以理解成：观察者距离这个 3D 场景有多远。

- 数值越小，立体感越强
- 数值越大，越接近平面效果

#### `translateZ()`

有了景深之后，沿 `Z` 轴移动才真正有意义：

```css
transform: translateZ(80px);
```

含义：

- 正值：更靠近屏幕外侧，看起来更大
- 负值：更远离观察者，看起来更小

#### `transform-style: preserve-3d`

如果一个元素做了 3D 变换，它里面的子元素默认可能会被“压扁回平面”。要保留嵌套元素之间的 3D 空间关系，需要：

```css
transform-style: preserve-3d;
```

这在做复杂 3D 卡片、立方体、翻牌组件时几乎是必备设置。

### 透明效果

透明度最常见的写法有两类：

- 颜色里的 Alpha 通道，例如 `rgba()`
- 整体透明度属性 `opacity`

这里重点补充的是：

```css
opacity
```

例如：

```css
.box {
  background-color: red;
  opacity: 0.5;
}
```

它表示整个元素透明度为 `50%`。

注意这里的“整个元素”包括：

- 背景
- 边框
- 文本
- 子元素

也就是说，`opacity` 是整体一起变透明，而不是只对背景生效。

### 过渡效果 `transition`

在没有过渡时，样式变化通常是瞬间发生的。比如鼠标悬停一个按钮，颜色会一下子跳过去。

而 `transition` 的作用，就是让两个状态之间出现平滑过渡。

#### 最基础的两项

过渡最少要定义两个东西：

- 对哪个属性过渡
- 过渡持续多久

例如：

```css
transition-property: background-color;
transition-duration: 0.3s;
```

更常见的是直接使用简写：

```css
transition: background-color 0.3s;
```

#### 一个按钮放大效果

```css
button {
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  border: none;
  background-color: rebeccapurple;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}
```

这样鼠标移上去时，按钮就会有一个轻微放大的过渡效果。

#### `transition-timing-function`

过渡不只是“动多久”，还包括“怎么动”。

常见速度曲线有：

- `linear`
- `ease`
- `ease-in`
- `ease-out`
- `ease-in-out`
- `steps(n)`

例如：

```css
transition: transform 0.2s ease-in;
```

表示：

- 一开始慢
- 然后逐渐加速

#### `cubic-bezier()`

如果预设曲线还不够，你也可以自己定义：

```css
transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
```

甚至可以做出类似回弹、果冻的效果：

```css
transition: transform 0.2s cubic-bezier(0.68, -0.55, 0.27, 1.55);
```

#### `transition-delay`

如果你希望延迟一会儿再开始过渡：

```css
transition: transform 0.2s 1s ease-in;
```

这里的 `1s` 就是延迟时间。

#### 一个经典坑：`height: auto` 不能直接过渡

很多人第一次做折叠面板时，都会写出这种代码：

```css
.test-box {
  height: 20px;
  overflow: hidden;
  transition: height 0.3s ease-in-out;
}

.test-box:hover {
  height: auto;
}
```

结果是：

- 状态变了
- 但过渡没发生

原因很简单：浏览器没法对 `auto` 这种“不确定值”做中间帧插值。

一种常见替代方案是改用：

```css
max-height
```

例如：

```css
.test-box {
  max-height: 20px;
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;
}

.test-box:hover {
  max-height: 999px;
}
```

这时浏览器就能预测一个确定的终点，因此过渡可以顺利执行。

### UI 设计：发光按钮

前面学了阴影和过渡之后，就已经足够做一些很有质感的按钮了。

一个典型思路是：

- 按钮本体使用纯色
- 阴影使用同色系半透明颜色
- 悬停时轻微放大并增强阴影

例如：

```css
button {
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition:
    transform 0.3s ease,
    box-shadow 0.5s ease;
}

button:hover {
  transform: scale(1.05);
}
```

再分别给不同按钮配置不同颜色的阴影，就能做出比较现代的“玻璃感”或“霓虹感”按钮。

### UI 设计：3D 翻转卡片

3D 翻转卡片是一个非常经典的综合练习，因为它同时会用到：

- `perspective`
- `transform-style: preserve-3d`
- `rotateY()`
- `transition`
- `backface-visibility`

#### `backface-visibility`

这个属性的作用是：

> 当元素背面对着屏幕时，要不要让它可见。

例如：

```css
backface-visibility: hidden;
```

表示当元素背朝用户时，直接隐藏。

#### 翻转卡片的核心思路

一个典型翻转卡片通常分成三层：

- 最外层：提供景深
- 中间层：真正执行翻转
- 两个面：正面和背面

核心逻辑是：

1. 正面默认朝前
2. 背面先旋转 `180deg`
3. 鼠标悬停时，中间容器整体再旋转 `180deg`

这样正面就转过去了，而背面正好转回来。

这种结构是 CSS 3D 组件里非常经典的一类。

### 函数和变量

CSS 里很多看起来像“值”的东西，其实背后都是函数。我们前面其实已经用过很多次了，例如：

- `rgb()`
- `rgba()`
- `linear-gradient()`
- `translate()`
- `rotate()`
- `blur()`

CSS 函数的统一形式就是：

```css
属性: 函数名(参数1, 参数2, ...);
```

#### `calc()`

`calc()` 用于做动态计算：

```css
.content {
  width: calc(100% - 200px);
}
```

这表示：

- 总宽度减去 `200px`

它特别适合做“一个区域固定宽度，另一个区域吃掉剩余空间”这类场景。

要注意：

- `+` 和 `-` 两边必须留空格

#### `attr()`

`attr()` 可以从 HTML 属性里取值，最常见的场景是伪元素内容：

```css
a::after {
  content: attr(href);
}
```

它在组件库和一些调试展示中比较常见。

#### `min()`、`max()`、`clamp()`

这三个函数在响应式里非常强大。

`min()`：取多个值中较小的那个

```css
width: min(500px, 90%);
```

`max()`：取多个值中较大的那个

```css
width: max(300px, 50%);
```

`clamp()`：同时设置最小值、理想值、最大值

```css
font-size: clamp(1rem, 2.5vw, 2rem);
```

这表示：

- 最小不小于 `1rem`
- 优先跟随 `2.5vw`
- 最大不超过 `2rem`

它是现代流体排版里非常常见的写法。

### CSS 变量

CSS 变量的核心是：

- 先定义一个可复用值
- 再在不同地方用 `var()` 引用

通常把变量放在 `:root`：

```css
:root {
  --primary-color: #099bf6;
  --secondary-color: #7bbfed;
  --text-color: #373737;
}
```

使用方式：

```css
.main-btn {
  color: var(--primary-color);
  background-color: var(--secondary-color);
}
```

这特别适合管理：

- 主题色
- 字体大小
- 圆角
- 间距系统

#### 变量覆盖

CSS 变量也遵循层叠规则，所以它们是可以被覆盖的。

例如：

```css
body button {
  --primary-color: #ef0505;
}
```

如果这个选择器优先级更高，那么这里定义的同名变量就会覆盖掉 `:root` 里的值。

#### 变量的备用值

`var()` 还支持备选值：

```css
background-color: var(--secondary-color, #fff);
```

如果前面的变量不存在，就会退回使用后面的默认值。

### UI 设计：暗黑模式

CSS 变量最适合用来做主题切换，比如暗黑模式。

思路非常简单：

1. 在 `:root` 里定义亮色主题变量
2. 给 `body.dark` 重新定义一套深色变量
3. 页面所有颜色都只使用变量，不直接写死

例如：

```css
:root {
  --bg-color: #f5f5f5;
  --card-bg: #ffffff;
  --text-color: #333333;
  --btn-bg: #3498db;
}

body.dark {
  --bg-color: #2c3e50;
  --card-bg: #34495e;
  --text-color: #ecf0f1;
  --btn-bg: #e74c3c;
}
```

这样只需要通过 JavaScript 切换一下 `body` 的类名，整个页面主题就能一起变。

### AT 规则 `@rules`

CSS 里还有一类很特殊的语句，它们不是“给某个元素设样式”，而是告诉浏览器应该如何处理整段样式规则。这类语句都以 `@` 开头，通常叫：

- `At-rules`
- 或 `@规则`

你前面其实已经遇到过了，比如：

- `@font-face`

它就是一类典型的 `@规则`，用来定义字体资源，可以把本地或远程字体注册成一个可以直接在 `font-family` 中使用的名字。

例如：

```css
@font-face {
  font-family: "YuanShen";
  src: url("../font/yuanshen.ttf");
}
```

定义好之后，就可以像普通字体一样使用：

```css
body {
  font-family: "YuanShen", sans-serif;
}
```

后续继续往下学时，你还会遇到很多常见的 `@规则`，例如：

- `@media`
- `@keyframes`
- `@supports`
- `@import`

它们会分别用于：

- 响应式
- 动画
- 特性检测
- 样式导入

可以先把它理解成：

- 普通选择器规则负责“元素长什么样”
- `@规则` 负责“这些样式应该在什么条件下、以什么方式生效”

### 媒体查询

媒体查询 `Media Queries` 是响应式设计最核心的能力之一。它允许我们根据设备特性或环境条件，动态切换不同的样式规则。

基本语法：

```css
@media 媒体类型 and (媒体特性) {
  /* 条件满足时生效 */
}
```

很多时候媒体类型可以省略，此时默认就是：

- `all`

常见媒体类型有：

- `screen`：屏幕设备，例如电脑、平板、手机
- `print`：打印预览和打印环境
- `all`：所有设备

#### 按屏幕宽度切换样式

最常见的媒体查询，就是根据浏览器宽度切换布局。例如：

```css
.container {
  width: 200px;
  height: 50px;
  background-color: red;
}

@media (max-width: 768px) {
  .container {
    background-color: green;
  }
}
```

这里的意思是：

- 默认背景是红色
- 当视口宽度小于等于 `768px` 时，改成绿色

常见尺寸相关媒体特性包括：

- `width`
- `min-width`
- `max-width`
- `height`
- `min-height`
- `max-height`

通常：

- `min-width` 更适合“从小到大增强”
- `max-width` 更适合“从大到小覆盖”

#### 打印样式

媒体查询不仅能判断屏幕尺寸，也能判断输出环境。例如打印时：

```css
@media print {
  .container {
    background-color: blue;
  }
}
```

这样进入打印预览时，这段样式才会生效。

#### 其他常见媒体特性

除了宽高，还有一些非常实用的条件：

- `orientation`：横屏 / 竖屏
- `resolution`：分辨率和缩放相关
- `prefers-color-scheme`：系统浅色 / 深色偏好

#### 媒体查询和层叠顺序

`@media` 本身不参与选择器优先级计算。真正比较优先级时，仍然是里面写的那些选择器在比。

所以实际开发里通常建议：

- 把媒体查询写在普通样式后面
- 让它作为“条件覆盖层”出现

这样在同等优先级下，更容易得到你想要的覆盖效果。

### 深色模式

媒体查询还能读取用户的系统偏好，其中最常见的就是深色模式：

```css
@media (prefers-color-scheme: dark) {
  body {
    background-color: #121212;
    color: #eeeeee;
  }
}
```

这表示：

- 如果用户系统当前偏好深色模式
- 就自动启用这一套深色主题样式

这和前面通过 CSS 变量做主题切换并不冲突。实际开发里常见的组合方式是：

- 用 `prefers-color-scheme` 做自动初始判断
- 再配合 CSS 变量和类名切换做手动主题切换

### 动画

前面学过的 `transition` 只能完成“一个状态到另一个状态”的平滑变化，而动画 `animation` 则可以定义更复杂的多阶段过程。

动画的核心是：

- `@keyframes`

它用来定义关键帧，也就是动画在某些关键进度下应该长什么样。

例如：

```css
@keyframes Test {
  0% {
    transform: translateX(0px);
  }
  50% {
    transform: translateX(100px);
  }
  100% {
    transform: translateX(0px);
  }
}
```

这个动画表示：

- 一开始在原地
- 中间移动到右边 `100px`
- 最后再回到原点

定义完关键帧之后，还要把它应用到元素上：

```css
.container {
  width: 100px;
  height: 100px;
  background-color: red;
  animation-name: Test;
  animation-duration: 3s;
  animation-delay: 0s;
}
```

#### 常用动画属性

- `animation-name`：动画名称
- `animation-duration`：动画时长
- `animation-delay`：动画延迟
- `animation-timing-function`：速度曲线
- `animation-iteration-count`：播放次数
- `animation-direction`：播放方向
- `animation-fill-mode`：前后状态保留
- `animation-play-state`：运行 / 暂停

#### 速度曲线

和过渡一样，动画也支持速度曲线：

```css
animation-timing-function: ease-out;
```

这会让动画呈现“先快后慢”的效果。

#### 循环次数

默认情况下动画只播放一次。如果希望播放多次：

```css
animation-iteration-count: 3;
```

如果要无限循环：

```css
animation-iteration-count: infinite;
```

#### 播放方向

常见值有：

- `normal`
- `reverse`
- `alternate`
- `alternate-reverse`

例如：

```css
animation-direction: reverse;
```

表示反向播放。

#### `animation-fill-mode`

它决定动画在开始前和结束后，元素是否要保留某一帧状态。

常见值：

- `none`
- `forwards`
- `backwards`
- `both`

例如：

```css
animation-fill-mode: forwards;
```

表示动画播完后停留在最后一帧。

#### 鼠标悬停暂停动画

有些时候我们希望鼠标移上去时动画暂停，移开后继续，可以这样写：

```css
.container:hover {
  animation-play-state: paused;
}
```

#### 多个动画叠加

一个元素并不只能应用一个动画，也可以同时应用多个动画：

```css
@keyframes Test2 {
  0% {
    background-color: red;
  }
  50% {
    background-color: blue;
  }
  100% {
    background-color: yellow;
  }
}

.container {
  animation-name: Test, Test2;
  animation-duration: 3s, 2s;
  animation-timing-function: ease-in;
  animation-fill-mode: forwards;
}
```

如果属性只写一个值，通常表示所有动画共用同一组设置；如果想分别控制，则可以写成逗号分隔的多组值。

#### `animation` 简写

和 `transition` 一样，动画也有简写形式：

```css
animation: name duration timing-function delay iteration-count direction
  fill-mode play-state;
```

例如：

```css
animation: move 1s ease-in-out 0.3s infinite alternate forwards;
```

### 层叠优先级控制 `@layer`

`@layer` 是 CSS Cascade Layers，也就是层叠层。它的价值在于：

- 显式管理样式来源
- 控制不同样式组之间的优先级顺序
- 避免项目越写越乱，最后只能用更高权重和 `!important` 硬压

可以先声明层的顺序：

```css
@layer reset, base, components, utilities;
```

这表示：

- `reset` 最低
- `utilities` 最高

然后就可以把样式放到不同层中：

```css
@layer utilities {
  .container {
    background-color: dodgerblue;
  }
}

@layer base {
  .container {
    background-color: red;
  }
}
```

虽然 `.container` 在 `base` 里写得更靠后，但真正生效的仍然是 `utilities` 里的蓝色，因为层级更高。

#### `@layer` 和选择器权重

在同一个层内部，仍然遵循普通的 CSS 比较规则：

- 选择器优先级
- 声明顺序

但是跨层之后，先比较层，再比较选择器。

#### `!important` 和层的关系

如果使用了 `!important`，它会把优先级强行拉到更高层次。

更有意思的是：

- 当大家都用了 `!important`
- 层的优先级顺序会反转

也就是前面声明的层反而会更高。

#### 未分层样式

还要注意一个非常关键的点：

- **未使用 `@layer` 的普通样式，优先级高于已分层的普通样式**

例如：

```css
@layer utilities {
  .container {
    background-color: dodgerblue;
  }
}

.container {
  background-color: red;
}
```

这里最终生效的会是红色，因为未分层样式默认处在更高的位置。

所以如果你决定使用 `@layer` 管理优先级，最好整组样式都纳入分层，否则体系会失去意义。

### 其他常用 AT 规则

除了 `@font-face`、`@media`、`@keyframes` 和 `@layer`，还有几个也很常见。

#### `@import`

它可以在 CSS 文件内部引入其他 CSS 文件：

```css
@import "css/normalize.css";
```

也可以在导入时指定层：

```css
@import url("reset.css") layer(reset);
@import url("components.css") layer(components);
```

不过实际开发里，还是更推荐在 HTML 里用 `link` 标签引入 CSS，因为：

- `@import` 会影响加载顺序
- 容易阻塞后续样式解析

#### `@supports`

它用于做特性检测，只有浏览器支持某个 CSS 能力时，才启用其中的样式。

例如：

```css
@supports (backdrop-filter: blur(10px)) {
  .card {
    backdrop-filter: blur(10px);
  }
}
```

这对于：

- 新特性渐进增强
- 老浏览器兼容降级

都非常有用。

#### `@container`

前面 `@media` 是根据视口来判断，而 `@container` 是根据父容器尺寸来判断，也叫容器查询。

例如：

```css
@container (min-width: 400px) {
  .item {
    font-size: 18px;
  }
}
```

它特别适合组件化开发，因为组件不必依赖整个窗口大小，而可以根据自己所处容器的宽度自动调整样式。

### UI 设计：自定义弹窗

这一节可以把前面学到的：

- 固定定位
- 半透明遮罩
- Flex 布局
- 卡片样式
- 圆角与边框

综合起来，做一个自定义弹窗。

典型结构如下：

```html
<div class="dialog-modal">
  <div class="dialog-card">
    <div class="dialog-card__header">
      <h4>重要通知</h4>
    </div>
    <div class="dialog-card__content">
      柏码将于2025年12月32日免费赠送各位学员一套 小米17Pro手机 +
      钢化膜套装，请于当天早上9点到群内 领取，过时不候
    </div>
    <div class="dialog-card__footer">
      <button disabled>领取</button>
      <button>不领取</button>
    </div>
  </div>
</div>
```

配合下面的布局：

```css
.dialog-modal {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.dialog-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 350px;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 10px;
}
```

这就是一个很典型的“固定遮罩 + 居中卡片”模式。

### UI 设计：移动端适配

前面做出来的桌面端页面，如果直接放到手机上，通常会出现：

- 间距过大
- 导航挤压
- 字号不协调
- 图片定位跑偏

这时就需要用前面学到的媒体查询，把页面做成移动端适配版本。

比较常见的思路是：

- 大屏走桌面布局
- 小于某个宽度后切换为单列布局
- 缩小边距和字号
- 调整导航展示方式

### UI 设计：顶部导航栏下拉菜单

这类效果通常会综合使用：

- 定位
- `:hover`
- 过渡
- 阴影
- `z-index`

如果再复杂一些，还会配合 JavaScript 做点击展开、延迟关闭和移动端交互。

### 其他内容

到这里 CSS 的主干内容已经差不多了，剩下再补几组很常见但不太容易单独归类的知识点。

#### 表格样式

HTML 表格同样可以用 CSS 美化。最基础的边框写法通常是：

```css
table,
th,
td {
  border: 1px solid #ccc;
}
```

如果你发现边框变成双线，一般是因为每个单元格都有各自的边框，这时可以通过：

```css
table {
  width: 100%;
  border-collapse: collapse;
}
```

把它们合并成单线。

为了让内容更舒服一些，也可以继续补：

```css
th,
td {
  padding: 10px;
  text-align: left;
}
```

还可以用伪类快速做斑马纹：

```css
tr:nth-child(even) {
  background-color: #f2f2f2;
}
```

#### 比例尺寸 `aspect-ratio`

如果希望一个盒子始终保持固定宽高比，例如视频区域、头像区域、封面区域，就可以使用：

```css
aspect-ratio
```

例如 16:9：

```css
.video-container {
  width: 80%;
  aspect-ratio: 16 / 9;
}
```

正方形则是：

```css
.profile-pic {
  width: 150px;
  aspect-ratio: 1 / 1;
}
```

这比以前的 `padding-top hack` 直观得多。

#### 滚动穿透 `overscroll-behavior`

“滚动穿透”指的是：

- 你在一个内部滚动区域里滚动
- 滚到底之后继续滚
- 外层页面也跟着滚了

这个体验通常出现在弹窗、侧边抽屉、面板组件里。

CSS 里可以通过：

```css
overscroll-behavior: contain;
```

进行限制。

常见值：

- `auto`
- `contain`
- `none`

`contain` 的意思是：

- 把滚动限制在当前元素内
- 尽量不要把滚动继续传给外层

不过它并不是对所有场景都百分百完美，复杂交互里往往还会配合 JavaScript 一起处理。

#### 用户选择 `user-select`

这个属性用来控制文本能不能被选中：

```css
user-select: none;
```

常见值有：

- `none`
- `auto`
- `text`
- `all`

很典型的用途包括：

- 按钮文字不希望被误选中
- 拖拽控件不希望产生蓝色选区
- 代码块点击一次就全选

例如代码块：

```css
code {
  user-select: all;
}
```

#### 浏览器私有前缀

早期很多新 CSS 特性在标准未完全稳定时，都需要浏览器私有前缀，例如：

- `-webkit-`
- `-moz-`
- `-ms-`
- `-o-`

例如：

```css
.box {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
}
```

不过现代前端开发里，大多数时候已经不需要手动去写这些前缀了，后续的构建工具通常会自动帮你补上。

#### 性能优化 `will-change`

`will-change` 用来告诉浏览器：

> 这个元素等会儿可能会发生某种变化，请提前准备。

例如：

```css
.element {
  will-change: transform, opacity;
}
```

它最常用于：

- 即将发生的过渡或动画
- 需要 GPU 合成层优化的元素
- 经常变化的位置和透明度效果

但要特别注意：

- `will-change` 不能滥用
- 开太多会占内存
- 反而可能拖慢页面

所以它更像是一把手术刀，而不是万能优化开关。

### 本章练习

#### 选择题

1. 关于 `max-width` 和 `min-width` 属性，下列说法错误的是？

- A. `max-width` 用于设置元素的最大宽度，当浏览器窗口小于该值时，元素宽度会自适应缩小。
- B. `min-width` 用于设置元素的最小宽度，即使内容很少，宽度也不会低于此值。
- C. 如果同时设置了 `width: 80%` 和 `max-width: 500px`，当父容器宽度为 `1000px` 时，该元素宽度为 `800px`。
- D. 这些属性常用于响应式布局，防止元素在不同屏幕尺寸下过度变形。

2. 关于 CSS 轮廓 `outline` 与边框 `border` 的区别，描述正确的是？

- A. `outline` 会占据盒子的空间，从而影响布局。
- B. `outline` 总是绘制在 `border` 的内部。
- C. `outline` 不占据空间，绘制在边框之外，可能会遮挡外部其他元素。
- D. `outline` 不能像 `border` 一样设置颜色和样式。

3. 在使用 `box-shadow` 设置阴影时，如果希望阴影显示在盒子内部，需要添加哪个关键字？

- A. `inside`
- B. `inset`
- C. `inner`
- D. `internal`

4. 行内元素的 `vertical-align` 默认对齐方式是？

- A. `top`
- B. `middle`
- C. `bottom`
- D. `baseline`

5. 下列关于精灵图 `Sprite` 的优点，描述最准确的是？

- A. 可以让图片在网页上自动旋转和缩放。
- B. 通过将多张小图合并为一张大图，减少 HTTP 请求数量，加快页面加载速度。
- C. 可以直接在 CSS 中修改图片的颜色和分辨率。
- D. 是为了让图片具有 3D 效果。

6. 若要实现一个从左到右的红色到黄色的线性渐变背景，正确的写法是？

- A. `background-image: linear-gradient(to right, red, yellow);`
- B. `background-image: linear-gradient(to left, red, yellow);`
- C. `background-image: linear-gradient(red, yellow);`
- D. `background-image: radial-gradient(circle, red, yellow);`

7. 想要给一个透明背景的 PNG 图片添加符合其不规则形状的投影，应该使用哪个属性？

- A. `box-shadow`
- B. `filter: blur()`
- C. `filter: drop-shadow()`
- D. `text-shadow`

8. 关于 CSS3 的二维变换 `transform: translate(10px, 20px)`，下列说法正确的是？

- A. 元素会在文档流中真正移动，原本的位置会被其他元素占据。
- B. 元素只是视觉上发生了偏移，原本占据的空间依然保留，不脱离文档流。
- C. 该属性只能用于块级元素，行内元素无效。
- D. 它是通过修改 `margin` 值来实现移动的。

9. 在制作 3D 翻转卡片时，为了让子元素在旋转时保持其 3D 立体空间，需要在父元素上设置什么属性？

- A. `perspective: 1000px;`
- B. `transform: rotateY(180deg);`
- C. `transform-style: preserve-3d;`
- D. `backface-visibility: hidden;`

10. 为什么给元素的 `height` 设置过渡效果时，从 `0px` 变到 `auto` 不会产生动画？

- A. 因为 `height` 属性不支持过渡。
- B. 因为 `auto` 是不确定的计算值，浏览器无法计算中间状态。
- C. 因为必须配合 `width` 一起变化。
- D. 因为过渡时间太短。

11. 使用 `calc()` 函数进行计算时，下列写法正确的是？

- A. `width: calc(100%-20px);`
- B. `width: calc(100% - 20px);`
- C. `width: calc(100% +20px);`
- D. `width: calc(100%* 20px);`

12. 在 CSS 中定义变量时，变量名必须以什么开头？

- A. `$`
- B. `@`
- C. `--`
- D. `var-`

13. 如果希望一个 CSS 动画无限次循环播放，应该将 `animation-iteration-count` 设置为哪个值？

- A. `loop`
- B. `always`
- C. `infinite`
- D. `100%`

14. 为了检测用户系统是否开启了深色模式，应该使用哪个媒体查询特性？

- A. `(theme: dark)`
- B. `(prefers-color-scheme: dark)`
- C. `(display-mode: dark)`
- D. `(system-color: dark)`

15. 如何使用 `aspect-ratio` 创建一个宽高比为 `4:3` 的容器？

- A. `aspect-ratio: 4 by 3;`
- B. `aspect-ratio: 4, 3;`
- C. `aspect-ratio: 4:3;`
- D. `aspect-ratio: 4 / 3;`

16. 根据 CSS 层叠层 `@layer` 的优先级规则，在不使用 `!important` 的情况下，下列哪个优先级最高？

- A. 先声明的 `@layer` 中的样式
- B. 后声明的 `@layer` 中的样式
- C. 未分层的普通样式
- D. `:root` 中定义的样式

17. 为了防止弹窗内部滚动到底部时带动整个页面背景继续滚动，可以在弹窗滚动容器上使用哪个 CSS 属性？

- A. `overflow: hidden`
- B. `scroll-snap-type: y mandatory`
- C. `overscroll-behavior: contain`
- D. `user-select: none`

### 本章小结

这一章把 CSS3 里几组非常重要、也非常实战的能力串到了一起：

- 进阶盒模型控制
- 阴影与轮廓
- 精灵图与渐变
- `filter` 与 `backdrop-filter`
- `transform`
- `transition`
- `animation`
- 函数和变量
- 媒体查询与深色模式
- `@layer`、`@supports`、`@container`
- `aspect-ratio`、`overscroll-behavior`、`will-change`

真正要掌握的重点，不只是“知道这些属性存在”，而是理解它们各自解决什么问题：

- `transform` 负责视觉变换
- `transition` 负责状态之间的平滑连接
- `animation` 负责更复杂的多阶段运动
- `filter` 负责后期处理
- CSS 变量负责建立可维护的设计系统
- `calc / min / max / clamp` 负责动态计算和响应式控制
- 媒体查询负责让样式根据设备环境切换
- `@layer` 负责显式梳理层叠优先级

如果前面的盒模型和布局是在解决“页面怎么排”，那这一章更多是在解决：

- 页面怎么变得更灵动
- 怎么适配不同环境
- 怎么让样式系统更可维护

到这里，CSS 的主干知识已经基本串起来了。后面无论你是继续做动画、做响应式页面，还是进入工程化开发，这一章的内容都会不断被拿出来反复使用。
