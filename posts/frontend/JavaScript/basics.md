---
title: JavaScript 基础语法
date: 2026-03-29
order: 1
---

## JavaScript 基础语法

### JavaScript 是什么

JavaScript 本质上是一门运行在浏览器中的编程语言。它可以让网页从“只有内容和样式”变成“可交互、可响应、可动态变化”的应用

#### 什么叫动态网页

这里的“动态”不是单纯指动画，而是指页面内容会随着时间、状态、用户行为或服务器数据发生变化

静态网页：

- 页面内容在编写时基本已经确定
- 用户访问时，服务器直接返回固定文件
- 常见于简单展示页、纯静态文章页

动态网页：

- 页面内容可能由服务器实时生成，也可能由前端脚本动态更新
- 数据会随着用户操作、数据库内容或时间变化而变化
- 常见于电商、论坛、社交媒体、管理系统等

#### JavaScript 能做什么

- 控制页面中的数据变化
- 响应用户点击、输入、滚动、按键等操作
- 修改页面结构和样式
- 与服务器进行数据交互
- 在浏览器之外运行，如 `Node.js` 后端开发

#### JavaScript 的执行方式

JavaScript 通常被归类为解释型语言，它由浏览器中的 JavaScript 引擎执行。现代引擎也会对热点代码做即时编译优化，所以现在更准确的理解方式是：JavaScript 主要以解释执行为基础，同时结合了 `JIT` 优化机制

### 在页面中引入 JavaScript

#### 方式一：内部脚本

直接在 HTML 中使用 `<script>` 标签编写代码：

```html
<head>
  <meta charset="UTF-8" />
  <title>Title</title>
  <script>
    alert("Hello, World!");
  </script>
</head>
```

只要浏览器加载到这段代码，就会自动执行

#### 方式二：外部脚本文件

先创建一个独立的 `.js` 文件：

```js
alert("Hello, World!");
```

再通过 `<script src="..."></script>` 引入：

```html
<head>
  <meta charset="UTF-8" />
  <title>Title</title>
  <script src="js/script.js"></script>
</head>
```

这是实际开发中最常见的方式，因为它能让结构和行为分离，便于维护

#### 方式三：写在元素事件中

可以直接把 JavaScript 写进 HTML 标签的事件属性中：

```html
<body>
  <div onclick="alert('我是页面上的一段普通内容')">
    我是页面上的一段普通内容
  </div>
</body>
```

这种方式适合快速演示，但实际项目中通常不推荐大量使用，因为结构和行为耦合过重

#### script 标签的位置

`<script>` 可以写在 `head` 中，也可以写在 `body` 中。它们都会执行，但执行时机会不同，这会影响脚本是否能访问到页面元素。初学阶段先记住：

- 写在哪里，就在浏览器解析到哪里时执行
- 如果脚本依赖页面元素，通常要关注加载顺序

#### noscript 标签

当浏览器不支持 JavaScript 或用户手动禁用 JavaScript 时，可以通过 `<noscript>` 提供降级提示：

```html
<body>
  <div>我是页面上的一段普通内容</div>
  <noscript>请启用 JavaScript 以获得最佳体验</noscript>
</body>
```

### 在浏览器中直接测试 JavaScript

#### 使用控制台执行代码

有时候我们只是想临时测试一两行代码，并不想专门创建一个 HTML 文件。这时可以直接使用浏览器开发者工具中的 `Console`

常见操作：

- 按 `F12` 打开开发者工具
- 切换到 `Console` 面板
- 直接输入 JavaScript 代码并回车执行

例如：

```js
console.log("Hello JS");
1 + 1;
```

#### 控制台的作用

- 快速验证语法
- 调试变量和表达式结果
- 测试页面中已经加载的脚本
- 学习 DOM 和事件时非常方便

如果需要输入多行代码，可以使用 `Shift + Enter` 换行

### JavaScript 入门语法

#### 注释

注释不会参与程序执行，主要用于解释代码含义

单行注释：

```js
// 这段代码用于弹出提示框
alert("Hello, World!");
```

多行注释：

```js
/* 这段代码用于弹出提示框
并展示 Hello World */
alert("Hello, World!");
```

文档注释风格：

```js
/**
 * 这段代码用于弹出提示框
 * 并展示 Hello World
 */
alert("Hello, World!");
```

#### 变量

变量用于保存可以变化的数据

早期 JavaScript 使用 `var` 声明变量：

```js
var a = 10;
console.log(a);
```

但现代 JavaScript 更推荐使用 `let`：

```js
let a = 10;
console.log(a);
```

变量名命名规则：

- 可以使用字母、数字、下划线 `_`、美元符 `$`
- 不能以数字开头
- 不能使用关键字
- 建议使用有意义的英文单词，做到见名知意

#### 赋值与修改

变量声明后可以修改值：

```js
let a = 10;
a = 20;
console.log(a);
```

如果多次赋值，以最后一次为准：

```js
let a = 10;
a = 20;
a = 30;
console.log(a);
```

#### 使用变量参与运算

```js
let a = 1 + 2;
console.log(a); // 3
```

```js
let a = 10;
a = a + 8;
console.log(a); // 18
```

```js
let a = 10;
a = a - 5;
console.log(a); // 5
```

```js
let a = 10;
a = a * a;
console.log(a); // 100
```

```js
let a = 10;
a = a / 2;
console.log(a); // 5
```

也可以一次声明多个变量：

```js
let a = 10,
  b = 9;
console.log(a - b);
```

#### 常量

常量使用 `const` 声明，一旦赋值后就不能再修改：

```js
const a = 10;
console.log(a);
```

如果尝试重新赋值，会直接报错：

```js
const a = 10;
a = 20; // Assignment to constant variable.
```

使用常量时要注意：

- 声明时必须立刻赋值
- 后续不能重新赋值
- 适合用于那些确定后不会变化的数据

#### 为什么不推荐 var

现代开发中一般不再推荐 `var`，主要原因有：

- 存在变量提升现象，容易让初学者迷惑
- 只有函数作用域，没有块级作用域
- 同一作用域内允许重复声明，容易埋下逻辑错误

因此，建议遵循下面的习惯：

- 可能变化的数据用 `let`
- 不会变化的数据用 `const`

#### console.log

`console.log()` 是最常见的调试输出方式，用来查看变量值、表达式结果和程序执行状态

```js
let a = 10;
console.log(a);
```

输出内容通常会显示来源文件和行号，这有助于快速定位代码位置

#### 标识符不能重复声明

使用 `let` 或 `const` 声明的变量，在同一作用域内不能重复声明：

```js
let a = 10;
let a = 20; // 报错
```

而 `var` 在这方面限制较弱，这也是它容易导致问题的原因之一

### 计算机中的二进制

#### 为什么程序员要懂一点二进制

计算机底层只认识二进制。理解二进制，有助于后续学习数据类型、内存、位运算和字符编码

#### 二进制的基本换算

例如十进制 `7`：

```text
111(二进制) = 2^2 + 2^1 + 2^0 = 7
```

如果有 `4 bit`，那么它最多可以表示：

- 最小值：`0000`，即 `0`
- 最大值：`1111`，即 `15`

#### 有符号数的表示

如果最高位拿来表示符号位：

- `0` 表示正数
- `1` 表示负数

那么 `4 bit` 的表示范围会发生变化

为了让计算机更方便做加减法，实际中通常使用补码来表示有符号整数

#### 补码的核心结论

- 正数的补码等于它本身
- 负数的补码等于原码按位取反后再加 `1`
- 使用补码后，计算机做加减法会更统一

例如在 `4 bit` 下，补码表示范围是：

- 最小值：`-8`
- 最大值：`+7`

这一部分属于扩展理解内容，入门阶段只需要先建立“计算机底层用二进制表示数据”的概念即可

### 入门小结

#### 需要掌握的重点

- JavaScript 是前端三件套之一，负责页面行为和交互
- JavaScript 可以写在内部脚本、外部脚本和元素事件中
- 会使用浏览器控制台快速测试代码
- 掌握注释、变量、常量、赋值和基础运算
- 优先使用 `let` 和 `const`，避免滥用 `var`
- 知道计算机底层使用二进制表示数据即可

#### 学习建议

- 每学一个语法点，立刻在控制台或 `.js` 文件里写一遍
- 不要只看不练，变量和运算一定要亲手敲
- 先熟悉最基础的语法，再继续学习数据类型、流程控制、函数和 DOM

### 基本数据类型

#### 基本数据类型概览

JavaScript 一共有 `7` 种基本数据类型：

- `number`
- `string`
- `boolean`
- `undefined`
- `null`
- `symbol`
- `bigint`

除此之外，还有后续会重点学习的对象类型 `object`

本节先掌握最常用的四种：

- `number`
- `string`
- `boolean`
- `undefined`

#### Number 数字类型

数字类型用于表示整数和小数：

```js
const a = 5;
const b = -7;
const c = 5.5;
console.log(a, b, c);
```

较大的数字可以使用下划线增强可读性：

```js
const count = 1_000_000_000;
console.log(count);
```

`Number` 类型中还有两个特殊值：

- `Infinity`：正无穷
- `NaN`：不是数字

例如：

```js
console.log(1 / 0); // Infinity
console.log(0 / 0); // NaN
```

需要注意：

- JavaScript 中的普通数字本质上都是 `64` 位双精度浮点数
- `NaN` 的类型仍然是 `number`
- `NaN` 与任何值比较都不会相等，包括它自己

#### String 字符串类型

字符串用于表示文本，可以使用单引号、双引号或反引号：

```js
const a = "Hello";
const b = "World";
const c = `JavaScript`;
console.log(a, b, c);
```

空字符串也是合法字符串：

```js
const text = "";
console.log(text);
```

需要区分数字和数字字符串：

```js
const a = 255;
const b = "255";
console.log(a, b);
```

虽然它们看起来相似，但一个是数值，一个是文本

#### 常见转义字符

当字符串中需要表示特殊字符时，可以使用转义字符：

- `\'`：单引号
- `\"`：双引号
- `\\`：反斜杠
- `\n`：换行
- `\t`：制表符
- `\uXXXX`：Unicode 字符

例如：

```js
const text = "你干嘛\n哎哟";
console.log(text);
```

```js
const text = '今天来了"9"个大聪明';
console.log(text);
```

#### 字符串拼接

字符串可以通过 `+` 进行拼接：

```js
const start = "你干嘛";
const end = "哎哟";
console.log(start + end);
```

如果字符串和其他类型相加，最终也会转成字符串拼接：

```js
const count = 8;
const text = "今天一共有 " + count + " 名用户完成了签到";
console.log(text);
```

#### 模板字符串

模板字符串使用反引号包裹，支持插值和自由换行：

```js
const count = 8;
const text = `今天一共有 ${count} 名用户完成了签到`;
console.log(text);
```

```js
const text = `
手机就买苹果
电车就选特斯拉
超市就逛山姆
`;
console.log(text);
```

模板字符串在拼接变量和生成多行文本时更方便

#### Boolean 布尔类型

布尔值只有两个结果：

- `true`
- `false`

它通常用于表示判断结果：

```js
const isNumber = false;
console.log(isNumber);
```

```js
const a = 20;
const b = 30;
console.log(a > b); // false
```

#### Undefined 未定义

当变量声明了但没有赋值时，默认值就是 `undefined`：

```js
let a;
console.log(a);
```

也可以把变量重新设为 `undefined`，但实际开发中通常不建议主动这样做：

```js
let a = 10;
a = undefined;
console.log(a);
```

入门阶段先记住：

- `undefined` 表示“当前没有值”
- 它和 `null` 不是同一个概念

#### 其他基本数据类型

除了上面四种，JavaScript 还存在：

- `null`：表示“空值”
- `symbol`：表示唯一标识
- `bigint`：用于表示超大整数

这些内容可以在后续章节再展开

### 运算符

#### 什么是运算符

运算符就是对数据进行处理的符号

例如：

- `+` 用于加法
- `-` 用于减法
- `*` 用于乘法
- `/` 用于除法

参与运算的数据，称为操作数

#### 算术运算符

最常见的算术运算符有：

- `+`
- `-`
- `*`
- `/`
- `%`
- `**`

示例：

```js
console.log(1 + 2);
console.log(2 - 3);
console.log(2 * 10);
console.log(3 / 2);
console.log(10 % 3);
console.log(2 ** 3);
```

说明：

- `%` 表示取余
- `**` 表示幂运算

#### 一元正负号

加号和减号除了参与二元运算，也可以作为一元运算符表示正负：

```js
let a = +2;
let b = -2;
let c = -a;
console.log(a, b, c);
```

#### 自增与自减

`++` 表示自增 `1`，`--` 表示自减 `1`：

```js
let a = 6;
a++;
console.log(a);
```

前置和后置的结果不同：

```js
let a = 6;
const b = a++;
console.log(a, b); // 7 6
```

```js
let a = 6;
const b = ++a;
console.log(a, b); // 7 7
```

建议：

- 前置 `++a`：先自增，再取值
- 后置 `a++`：先取值，再自增
- 不要在复杂表达式里连续混用 `++` 和 `--`，可读性很差

#### 字符串与加号

`+` 不仅能做加法，还能做字符串拼接：

```js
const text1 = "你干嘛";
const text2 = "哎哟";
console.log(text1 + text2);
```

要特别注意运算顺序：

```js
let a = "Hello World";
a = 9 + 9 + a;
console.log(a); // 18Hello World
```

#### 括号运算符

括号可以强制提升运算优先级：

```js
const a = 3 * (5 + 2);
console.log(a);
```

如果表达式稍微复杂，优先使用括号，而不是死记优先级

#### 赋值运算符

最基础的赋值运算符是 `=`：

```js
let a = 10;
console.log(a);
```

还可以连等赋值：

```js
let a, b;
a = b = 10;
console.log(a, b);
```

复合赋值可以简化常见写法：

- `+=`
- `-=`
- `*=`
- `/=`
- `%=`
- `**=`

例如：

```js
let a = 20;
a += 10;
console.log(a);
```

#### 比较运算符

常见比较运算符有：

- `===`
- `!==`
- `==`
- `!=`
- `>`
- `>=`
- `<`
- `<=`

推荐优先使用严格比较：

- `===`：值和类型都相等
- `!==`：值或类型不相等

例如：

```js
const a = 2;
const b = 4;
console.log(a === b);
```

宽松比较会发生隐式类型转换：

```js
const a = 2;
const b = "2";
console.log(a == b); // true
```

因此在实际开发中，一般不推荐使用 `==` 和 `!=`

#### 字符串比较

字符串也可以比较大小，比较规则是按字符的 Unicode 编码逐个比较：

```js
const a = "aaaa";
const b = "abbb";
console.log(a < b);
```

如果前面的字符相同，就继续比较后面的字符

#### NaN 的比较规则

`NaN` 很特殊：

- 不等于任何值
- 不大于任何值
- 不小于任何值
- 连 `NaN === NaN` 也是 `false`

#### 逻辑运算符

常见逻辑运算符有：

- `&&`：逻辑与
- `||`：逻辑或
- `!`：逻辑非

示例：

```js
const a = 8;
const isEven = a % 2 === 0;
const isPositive = a > 0;
console.log(isEven && isPositive);
```

```js
const a = -8;
const isOdd = a % 2 === 1;
const isPositive = a > 0;
console.log(isOdd || isPositive);
```

```js
const a = -8;
const isPositive = a > 0;
console.log(!isPositive);
```

#### 短路求值

逻辑运算符存在短路行为：

- `A && B`：如果 `A` 已经是假，直接返回 `A`
- `A || B`：如果 `A` 已经是真，直接返回 `A`

这意味着 JavaScript 的 `&&` 和 `||` 返回的不一定是布尔值，也可能是原始操作数本身

例如：

```js
console.log(0 && 1); // 0
console.log(1 && 2); // 2
console.log(0 || 1); // 1
console.log(2 || 3); // 2
```

#### 真值与假值

在逻辑运算中，JavaScript 会把值分成真值和假值

入门阶段先记住常见假值：

- `false`
- `0`
- `-0`
- `""`
- `null`
- `undefined`
- `NaN`
- `0n`

除了这些以外，大部分值都可以视为真值

如果想把一个值明确转成布尔值，可以使用双重取反：

```js
const a = "Hello";
console.log(!!a); // true
```

#### 三元运算符

三元运算符可以根据条件返回不同结果：

```js
条件 ? 表达式1 : 表达式2;
```

例如：

```js
const a = 8;
const text = a % 2 === 0 ? "Even" : "Odd";
console.log(text);
```

#### 空值合并运算符

空值合并运算符是 `??`，它的规则是：

- 如果左边是 `null` 或 `undefined`，返回右边
- 否则返回左边本身

例如：

```js
let a;
console.log(a ?? "Hello World");
```

这和 `||` 不完全一样。`||` 会把所有假值都当作“需要备选”，而 `??` 只关心 `null` 和 `undefined`

#### 空值合并赋值与逻辑赋值

这些写法都很常见：

- `??=`
- `||=`
- `&&=`

例如：

```js
let a;
a ??= "Hello World";
console.log(a);
```

```js
let b = 0;
b ||= 100;
console.log(b);
```

```js
let c = 1;
c &&= 666;
console.log(c);
```

#### 运算符优先级

入门阶段先记住大致顺序即可，从高到低通常可以理解为：

- 括号
- 一元运算符，如 `!`、正负号、前置 `++ --`
- 幂运算 `**`
- 乘除取余 `* / %`
- 加减 `+ -`
- 比较运算符
- 相等与不相等
- 逻辑与 `&&`
- 逻辑或 `||` 与空值合并 `??`
- 三元运算符
- 赋值运算符

真正写代码时，优先使用括号让意图更明确，不要依赖记忆去硬算复杂表达式

### 数据类型与运算符小结

#### 需要掌握的重点

- 基本数据类型里，最常见的是 `number`、`string`、`boolean`、`undefined`
- `Infinity` 和 `NaN` 都属于 `number` 类型中的特殊值
- 字符串支持拼接、转义字符和模板字符串
- 比较运算优先使用 `===` 和 `!==`
- 逻辑运算符存在短路行为，返回值不一定是布尔值
- `??` 只会在左侧是 `null` 或 `undefined` 时才取默认值

#### 学习建议

- 每种数据类型都亲手在控制台打印一遍
- 针对 `+`、`==`、`&&`、`||` 多做几组测试，理解隐式转换和短路规则
- 表达式一旦变复杂，就主动加括号，不要炫技

### 补充运算符与类型处理

#### 逗号运算符（选学）

逗号运算符 `,` 可以把多个表达式连接在一起，并依次执行这些表达式，最终整个表达式的结果是最后一个表达式的值

例如：

```js
const result = (1 + 2, 3 + 4);
console.log(result); // 7
```

需要注意：

- 逗号运算符的优先级很低
- 在赋值表达式里使用时，通常要配合括号
- 实际开发中使用频率很低，了解即可

#### 位运算符（选学）

位运算会直接操作数字的二进制位

在 JavaScript 中，数字虽然通常按 `64` 位浮点数处理，但进行位运算时会先临时转换为 `32` 位有符号整数，再执行位运算

常见位运算符：

- `&`：按位与
- `|`：按位或
- `^`：按位异或
- `~`：按位取反

按位与：

```js
const a = 9;
const b = 3;
console.log(a & b); // 1
```

```text
9 = 1001
3 = 0011
结果 = 0001
```

按位或：

```js
const a = 9;
const b = 3;
console.log(a | b); // 11
```

```text
9 = 1001
3 = 0011
结果 = 1011
```

按位异或：

```js
const a = 9;
const b = 3;
console.log(a ^ b); // 10
```

```text
9 = 1001
3 = 0011
结果 = 1010
```

按位取反：

```js
const a = 127;
console.log(~a); // -128
```

#### 位移运算符（选学）

常见位移运算符：

- `<<`：左移
- `>>`：有符号右移
- `>>>`：无符号右移

左移示例：

```js
const a = 1 << 2;
console.log(a); // 4
```

```text
1 = 00000001
4 = 00000100
```

右移示例：

```js
const a = 8 >> 2;
console.log(a); // 2
```

```text
8 = 00001000
2 = 00000010
```

负数右移时，高位会使用符号位补齐：

```js
const a = -8 >> 2;
console.log(a); // -2
```

无符号右移会使用 `0` 补高位：

```js
const a = -1 >>> 1;
console.log(a); // 2147483647
```

入门阶段只需要先记住：

- 左移常常相当于乘以 `2` 的若干次幂
- 右移常常相当于除以 `2` 的若干次幂
- 但它们本质是位操作，不要简单等同于普通乘除法

#### typeof 类型运算符

`typeof` 用来查看一个值的类型，返回值是一个字符串

例如：

```js
const a = 1;
console.log(typeof a); // "number"
```

常见结果：

- `"undefined"`
- `"boolean"`
- `"number"`
- `"string"`
- `"bigint"`
- `"symbol"`
- `"object"`
- `"function"`

例如：

```js
console.log(typeof "Hello"); // "string"
console.log(typeof true); // "boolean"
console.log(typeof undefined); // "undefined"
console.log(typeof []); // "object"
```

需要注意一个历史遗留问题：

```js
console.log(typeof null); // "object"
```

这并不代表 `null` 真的是对象，而是 JavaScript 的历史兼容行为

#### 隐式类型转换

隐式类型转换指的是：JavaScript 在运算或比较时，自动把某个值转换成另一种类型

例如：

```js
const a = 2;
const b = true;
console.log(a + b); // 3
```

这里的 `true` 会先被转换为数字 `1`

如果参与 `+` 运算的一方是字符串，则更容易发生字符串拼接：

```js
const a = 2;
const b = "true";
console.log(a + b); // "2true"
```

减法、乘法、除法通常会优先尝试把操作数转成数字：

```js
const a = 2;
const b = "22";
console.log(b - a); // 20
```

```js
const a = "10";
const b = "22";
console.log(b - a); // 12
```

宽松比较也会发生隐式类型转换：

```js
const a = 22;
const b = "22";
console.log(a == b); // true
```

这也是为什么实际开发中更推荐使用 `===` 和 `!==`

#### 显式类型转换

显式类型转换指的是：我们主动调用函数，把一个值转成另一种类型

常见方式：

- `Number()`
- `parseInt()`
- `parseFloat()`
- `String()`
- `Boolean()`
- `.toString()`

例如：

```js
const a = 22;
console.log(a.toString()); // "22"
```

```js
console.log(Number("123")); // 123
console.log(String(true)); // "true"
console.log(Boolean(1)); // true
```

### 流程控制

#### 流程控制是什么

流程控制用于决定代码应该如何执行。常见的流程结构有三种：

- 顺序结构
- 选择结构
- 循环结构

#### 顺序结构

默认情况下，JavaScript 代码会按照从上到下的顺序执行：

```js
console.log("A");
console.log("B");
console.log("C");
console.log("D");
```

执行顺序就是 `A B C D`

#### 代码块与作用域

代码块由一对花括号 `{}` 组成：

```js
{
  // 语句
}
```

代码块中的语句依然按顺序执行，但它还有一个重要作用：配合 `let` 和 `const` 形成块级作用域

例如：

```js
{
  const a = 10;
  console.log(a);
}
```

```js
{
  const a = 10;
}
console.log(a); // 报错
```

块级作用域支持嵌套：

```js
{
  {
    const a = 10;
  }
  // 这里无法访问 a
}
```

而 `var` 不受块级作用域限制，这也是它不推荐继续使用的重要原因之一：

```js
{
  var a = 10;
}
console.log(a); // 10
```

#### if 单分支语句

`if` 用于在条件成立时执行代码：

```js
if (表达式) {
  代码块;
}
```

例如：

```js
const a = 10;
if (a === 10) {
  console.log("Hello World");
}
```

如果代码块中只有一条语句，也可以省略花括号，但不推荐在新手阶段这样写：

```js
if (a === 10) console.log("Hello World");
```

#### if-else 双分支语句

如果条件不成立，还想执行另一套逻辑，可以配合 `else`：

```js
const a = NaN;
if (a) {
  console.log("Hello World");
} else {
  console.log("Crazy Thursday vivo ￥50");
}
```

需要注意，`if` 中的条件不一定非要是布尔值。其他类型也会先按照真值和假值规则转换后再判断

例如：

```js
const a = 1;
if (a) {
  console.log("会执行");
}
```

#### else if 多分支语句

当有多个条件分支时，可以使用 `else if`：

```js
const score = 85;

if (score >= 90) {
  console.log("优秀");
} else if (score >= 70) {
  console.log("良好");
} else if (score >= 60) {
  console.log("及格");
} else {
  console.log("不及格");
}
```

多分支判断会按顺序从上往下匹配，命中一个分支后，后续分支不再执行

#### if 的嵌套

`if` 语句支持嵌套使用：

```js
const score = 20;

if (score < 60) {
  if (score > 30) {
    console.log("学习 JavaScript");
  } else {
    console.log("学习 TypeScript");
  }
}
```

#### switch 语句

`switch` 更适合做“按固定值分支”的判断

基本结构：

```js
switch (目标) {
  case 匹配值:
    代码;
    break;
  default:
    代码;
}
```

例如：

```js
const level = "A";

switch (level) {
  case "A":
    console.log("去尖子班");
    break;
  case "B":
    console.log("去平行班");
    break;
  case "C":
    console.log("去基础班");
    break;
  default:
    console.log("未分类");
}
```

需要注意：

- `switch` 更适合精确匹配，不适合区间判断
- `case` 的匹配本质上按严格相等来判断
- 每个 `case` 后通常都要写 `break`，否则会继续向下执行，出现穿透现象
- `default` 表示都不匹配时执行的分支

#### for 循环

`for` 循环适合已知循环次数的场景

基本结构：

```js
for (表达式1; 表达式2; 表达式3) {
  循环体;
}
```

含义如下：

- 表达式1：循环开始前执行一次
- 表达式2：每轮循环开始前判断
- 表达式3：每轮循环结束后执行

例如：

```js
for (let i = 0; i < 3; i++) {
  console.log("大烟杆嘴里塞，我只抽第五代");
}
```

循环变量如果用 `let` 声明，它只在循环内部有效：

```js
for (let i = 0; i < 3; i++) {
  console.log(i);
}
```

```js
console.log(i); // 报错
```

#### for 循环的省略写法

`for` 的三个表达式都可以省略，但要非常谨慎：

```js
let i = 0;
for (; i < 3; i++) {
  console.log(i);
}
```

如果三个表达式全都省略：

```js
for (;;) {
  // 无限循环
}
```

这会形成死循环

#### 嵌套循环

循环也可以嵌套：

```js
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    console.log(`i = ${i}, j = ${j}`);
  }
}
```

#### break 与 continue

在循环中可以使用：

- `break`：直接结束整个循环
- `continue`：跳过当前这一轮，进入下一轮

示例：

```js
for (let i = 0; i < 3; i++) {
  if (i === 1) continue;
  console.log(i);
}
```

```js
for (let i = 0; i < 3; i++) {
  if (i === 1) break;
  console.log(i);
}
```

在多层循环中，`break` 和 `continue` 默认只作用于最近的一层循环

#### 标签语句（选学）

如果要在多层循环中直接跳出外层循环，可以使用标签：

```js
outer: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (i === j) break outer;
    console.log(`i = ${i}, j = ${j}`);
  }
}
```

这属于进阶写法，实际开发中不常用，了解即可

#### while 循环

`while` 更适合“不确定具体循环次数，但知道循环条件”的场景

基本结构：

```js
while (条件) {
  循环体;
}
```

例如：

```js
let i = 100;

while (i > 1) {
  console.log(i);
  i /= 2;
}
```

`while` 同样支持 `break` 和 `continue`

需要特别注意：如果更新条件的语句放错位置，很容易出现死循环

例如：

```js
let i = 100;

while (i > 1) {
  if (i === 50) continue;
  i /= 2;
  console.log(i);
}
```

上面这段代码会在 `i === 50` 时一直卡住，因为更新语句被跳过了

#### do-while 循环

`do...while` 的特点是：先执行一次循环体，再判断条件

```js
let i = 10;

do {
  console.log("Hello World");
  i++;
} while (i < 10);
```

即使条件一开始不成立，循环体也至少会执行一次

### 本章练习

#### 编程练习

可以尝试独立完成下面几个练习：

1. 寻找所有 `1000` 以内的水仙花数。水仙花数指一个三位数，其各位数字的三次幂之和等于它本身，例如 `153`
2. 打印一个九九乘法表
3. 判断一个给定字符串是否为回文串
4. 判断一个给定数字是整数还是小数

#### 选择题精选

1. JavaScript 是一种什么样的编程语言？
   A. 编译型语言
   B. 解释型语言
   C. 机器语言
   D. 汇编语言

2. 在 HTML 中引入外部 JavaScript 文件，正确的语法是？
   A. `<script link="main.js"></script>`
   B. `<script href="main.js"></script>`
   C. `<script src="main.js"></script>`
   D. `<link rel="script" href="main.js">`

3. JavaScript 中关于单行注释和多行注释，描述正确的是？
   A. 单行注释使用 `#`
   B. 多行注释使用 `$`
   C. 单行注释使用 `//`，多行注释使用 `/* */`
   D. JavaScript 不支持多行注释

4. 使用 ES6 规范声明一个“只读常量”，应该使用哪个关键字？
   A. `var`
   B. `let`
   C. `const`
   D. `define`

5. 下列哪个不是 JavaScript 的基本数据类型？
   A. `String`
   B. `Number`
   C. `Boolean`
   D. `Array`

6. 执行 `console.log(typeof NaN)` 的输出结果是？
   A. `"number"`
   B. `"NaN"`
   C. `"undefined"`
   D. `"object"`

7. 表达式 `10 + "5"` 的计算结果是？
   A. `15`
   B. `50`
   C. `"15"`
   D. `"105"`

8. 以下哪个变量名是非法的？
   A. `$price`
   B. `_index`
   C. `2nd_user`
   D. `userName`

9. 现代 JavaScript 开发中，不再推荐使用 `var` 声明变量的主要原因是？
   A. `var` 声明的变量不可修改
   B. `var` 存在变量提升且没有块级作用域
   C. `var` 占用的内存比 `let` 大
   D. `var` 只能存储数字类型

10. 在 JavaScript 中，`1 / 0` 的执行结果是？
    A. 抛出异常并停止运行
    B. `NaN`
    C. `0`
    D. `Infinity`

11. 关于补码，下列描述错误的是？
    A. 计算机内部使用补码进行减法运算
    B. 正数的补码与其原码相同
    C. 补码解决了“正负 0”的问题
    D. `4` 位二进制补码能表示的最大正数是 `8`

12. 在 JavaScript 中，`console.log(0.1 + 0.2)` 的执行结果是什么？
    A. `0.3`
    B. `0`
    C. `"0.10.2"`
    D. 以上说法都不对

13. 在 `switch` 语句中，用于防止穿透执行的关键字是？
    A. `stop`
    B. `break`
    C. `continue`
    D. `default`

14. `for (A; B; C)` 中，`B` 代表的是？
    A. 循环初始值
    B. 循环判断条件
    C. 循环结束后的更新语句
    D. 循环体内容

15. 下列哪种循环结构能保证循环体至少执行一次？
    A. `for`
    B. `while`
    C. `do...while`
    D. `if...else`

16. 在 `while` 循环中使用 `continue` 时，若更新条件的语句位于 `continue` 之后，最可能导致的结果是？
    A. 语法错误
    B. 立即退出循环
    C. 形成无限循环
    D. 程序崩溃

### 全章小结

#### 需要掌握的重点

- 基本数据类型里，最常见的是 `number`、`string`、`boolean`、`undefined`
- `Infinity` 和 `NaN` 都属于 `number` 类型中的特殊值
- 字符串支持拼接、转义字符和模板字符串
- 比较运算优先使用 `===` 和 `!==`
- JavaScript 存在隐式类型转换，写表达式时要特别注意
- `if`、`switch`、`for`、`while`、`do...while` 是最常见的流程控制语句
- `break` 和 `continue` 能控制循环节奏，但也可能带来死循环风险

#### 学习建议

- 运算符部分不要只背规则，要亲手多做几组测试
- 选择结构和循环结构一定要自己写一遍，不要只停留在阅读理解
- 一旦表达式或判断条件变复杂，就主动加括号提升可读性
