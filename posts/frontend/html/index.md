---
title: HTML
date: 2026-03-23
order: 1
---

## HTML 基础入门

### 1. HTML 语法基础

HTML（HyperText Markup Language，超文本标记语言）可以理解为网页的结构层。浏览器先读懂 HTML，才知道哪里是标题、段落、图片、链接和表单

#### 1.1 什么是标签

HTML 使用“标签”来标记内容。标签通常成对出现，由开始标签和结束标签组成

- 开始标签：`<p>`
- 结束标签：`</p>`

开始标签表示元素的开始，结束标签表示元素的结束

#### 1.2 什么是元素

一个 HTML 元素通常由三部分组成：

- 开始标签
- 内容
- 结束标签

例如：

```html
<p>这是一个段落</p>
```

其中：

- `<p>`：开始标签，表示段落开始
- `这是一个段落。`：元素内容
- `</p>`：结束标签，表示段落结束

#### 1.3 空元素

有些元素没有内容，也不需要结束标签，这类元素称为“空元素”

常见的空元素有：

- `<br>`：换行
- `<hr>`：水平线
- `<img>`：图片
- `<meta>`：元信息
- `<link>`：外部资源链接

#### 1.4 什么是属性

属性用于为 HTML 元素提供额外信息，写在开始标签中，通常采用 `名称="值"` 的形式

例如：

```html
<a href="https://www.google.com">访问 Google</a>
```

其中：

- `href`：属性名
- `"https://www.google.com"`：属性值

#### 1.5 HTML 文档的基本结构

一个最基础的 HTML 页面如下：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>我的第一个网页</title>
  </head>
  <body>
    <h1>你好，HTML！</h1>
    <p>这是我的第一个网页。</p>
  </body>
</html>
```

各部分含义如下：

- `<!DOCTYPE html>`：文档类型声明，告诉浏览器这是一个 HTML5 页面
- `<html>`：根元素，整个页面的内容都写在这里
- `<head>`：头部区域，存放网页的元信息
- `<meta charset="UTF-8">`：设置字符编码，避免中文乱码
- `<meta name="viewport" ...>`：适配移动端页面
- `<title>`：浏览器标签页显示的标题
- `<body>`：网页主体，所有可见内容都写在这里

#### 1.6 关键语法要点

- 嵌套：HTML 元素可以相互嵌套，且必须正确嵌套
- 小写：标签名虽然不区分大小写，但推荐统一使用小写
- 引号：属性值建议始终使用双引号包裹
- 语义化：尽量使用有意义的标签，而不是一味使用 `<div>`

### 2. 文本相关标签

#### 2.1 标题标签

HTML 提供了 6 级标题标签：`<h1>` 到 `<h6>`

- `<h1>`：最重要的标题
- `<h6>`：最次要的标题

通常一个页面只使用一个 `<h1>` 作为主标题，其他标题按层级递减使用

#### 2.2 段落标签

`<p>` 用于表示一个段落。浏览器会自动在段落之间留出间距

```html
<p>这是第一段。</p>
<p>这是第二段。</p>
```

#### 2.3 换行标签

`<br>` 用于在同一段内容中强制换行，而不是另起一个新段落

```html
<p>第一行<br />第二行</p>
```

#### 2.4 常用内联语义标签

- `<strong>`：表示重要内容，通常显示为粗体
- `<em>`：表示强调内容，通常显示为斜体
- `<span>`：通用行内容器，本身没有特殊样式，常配合 CSS 使用

例如：

```html
<p>这是 <strong>重要内容</strong>，这是 <em>强调内容</em>。</p>
<p><span style="color: red;">这段文字是红色的</span></p>
```

### 3. 注释与特殊符号

#### 3.1 HTML 注释

注释用于给代码添加说明，浏览器不会显示注释内容

语法如下：

```html
<!-- 这是一个注释 -->
```

#### 3.2 HTML 特殊符号

有些字符在 HTML 中有特殊含义，例如 `<` 和 `>` 用于标签。如果想直接显示这些字符，需要使用字符实体

常见字符实体如下：

- `&nbsp;`：不换行空格
- `&lt;`：`<`
- `&gt;`：`>`
- `&amp;`：`&`
- `&quot;`：`"`
- `&apos;`：`'`
- `&copy;`：`©`

示例：

```html
<p>在 HTML 中，&lt;p&gt; 表示段落标签。</p>
<p>版权所有 &copy; 2026</p>
```

### 4. 行内元素与块级元素

HTML 元素按照显示方式，通常分为块级元素和行内元素

#### 4.1 块级元素

特点：

- 默认独占一行
- 通常可以设置宽高
- 常用于页面布局和分区

常见标签：

- `<div>`
- `<h1>` 到 `<h6>`
- `<p>`
- `<ul>`、`<ol>`、`<li>`
- `<table>`

#### 4.2 行内元素

特点：

- 默认在同一行内显示
- 宽度通常由内容决定
- 常用于包裹局部文本或内容片段

常见标签：

- `<span>`
- `<a>`
- `<strong>`
- `<em>`
- `<img>`

#### 4.3 `div` 与 `span`

- `<div>`：最常用的块级容器，用于页面分区和布局
- `<span>`：最常用的行内容器，用于包裹小段文本并单独设置样式

### 5. 图片

在网页中插入图片使用 `<img>` 标签

```html
<img src="images/photo.jpg" alt="一张风景照" width="300" height="200" />
```

#### 5.1 常用属性

- `src`：图片路径
- `alt`：图片无法显示时的替代文本，对无障碍和 SEO 很重要
- `width`：图片宽度
- `height`：图片高度

#### 5.2 路径写法

- 相对路径：`photo.jpg`、`images/photo.jpg`、`../photo.jpg`
- 绝对路径：`https://example.com/photo.jpg`

说明：

- `alt` 不是可选装饰，而是重要的可访问性信息
- 提前设置 `width` 和 `height`，可以减少页面加载时的跳动

### 6. 链接

超链接使用 `<a>` 标签创建

```html
<a href="https://www.google.com">访问 Google</a>
```

#### 6.1 常用属性

- `href`：目标地址
- `target`：打开方式
- `title`：鼠标悬停时显示的提示信息

#### 6.2 常见链接类型

外部链接：

```html
<a href="https://www.google.com" target="_blank" rel="noopener noreferrer"
  >Google</a
>
```

内部链接：

```html
<a href="about.html">关于我们</a>
```

锚点链接：

```html
<a href="#section1">跳转到第一部分</a>
```

如果使用锚点链接，需要页面中存在对应的 `id`：

```html
<h2 id="section1">第一部分</h2>
```

说明：

- `target="_blank"` 表示新标签页打开
- 新标签页打开外部链接时，建议同时加上 `rel="noopener noreferrer"`

### 7. 视频与音频

HTML5 提供了 `<video>` 和 `<audio>` 标签，可以直接在网页中嵌入媒体内容

#### 7.1 视频

```html
<video controls width="400">
  <source src="movie.mp4" type="video/mp4" />
  <source src="movie.webm" type="video/webm" />
  您的浏览器不支持 video 标签。
</video>
```

#### 7.2 音频

```html
<audio controls>
  <source src="music.mp3" type="audio/mpeg" />
  您的浏览器不支持 audio 标签。
</audio>
```

#### 7.3 常用属性

- `controls`：显示播放控件
- `autoplay`：自动播放
- `muted`：静音
- `loop`：循环播放
- `src`：媒体路径

说明：

- 现代浏览器通常会限制带声音的自动播放
- 推荐使用 `<source>` 提供多种格式，提高兼容性

### 8. 列表

HTML 中常见的列表有三种

#### 8.1 无序列表

用于展示没有先后顺序的内容

```html
<ul>
  <li>苹果</li>
  <li>香蕉</li>
  <li>橙子</li>
</ul>
```

#### 8.2 有序列表

用于展示有明确顺序的内容

```html
<ol>
  <li>打开电脑</li>
  <li>打开浏览器</li>
  <li>访问网页</li>
</ol>
```

#### 8.3 定义列表

用于展示术语及其解释

```html
<dl>
  <dt>HTML</dt>
  <dd>用于构建网页结构的标记语言。</dd>
  <dt>CSS</dt>
  <dd>用于设置网页样式的样式表语言。</dd>
</dl>
```

### 9. 表格

表格用于展示结构化数据

#### 9.1 核心标签

- `<table>`：表格容器
- `<tr>`：表格行
- `<th>`：表头单元格
- `<td>`：普通单元格

#### 9.2 基本示例

```html
<table border="1">
  <thead>
    <tr>
      <th>姓名</th>
      <th>年龄</th>
      <th>城市</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>张三</td>
      <td>20</td>
      <td>北京</td>
    </tr>
    <tr>
      <td>李四</td>
      <td>22</td>
      <td>上海</td>
    </tr>
  </tbody>
</table>
```

#### 9.3 合并单元格

- `colspan`：跨列
- `rowspan`：跨行

例如：

```html
<td colspan="2">合并两列</td>
<td rowspan="3">合并三行</td>
```

说明：

- `border="1"` 适合教学演示
- 实际开发中更推荐使用 CSS 控制表格样式

### 10. `iframe` 内联框架

`<iframe>` 用于在当前网页中嵌入另一个网页或外部内容

#### 10.1 基本示例

```html
<iframe
  src="https://example.com"
  width="600"
  height="400"
  style="border: none;"
></iframe>
```

#### 10.2 常用属性

- `src`：嵌入页面地址
- `width`、`height`：宽高
- `allowfullscreen`：允许全屏
- `sandbox`：限制嵌入内容权限，提升安全性

#### 10.3 常见用途

- 嵌入 YouTube 视频
- 嵌入地图
- 嵌入外部页面或第三方服务

说明：

- 很多网站会通过安全策略禁止被直接嵌入
- 实际使用中，应优先使用平台官方提供的嵌入地址

### 11. 其他常用标签补充

#### 11.1 `form` 与表单控件

表单用于收集用户输入

```html
<form action="/login" method="POST">
  <div>
    <label for="username">用户名：</label>
    <input type="text" id="username" name="username" />
  </div>

  <div>
    <label for="pwd">密码：</label>
    <input type="password" id="pwd" name="password" />
  </div>

  <button type="submit">登录</button>
</form>
```

#### 11.2 常见表单标签

- `<form>`：表单区域
- `<input>`：输入控件
- `<textarea>`：多行文本框
- `<button>`：按钮
- `<label>`：表单项说明文字

#### 11.3 常见 `input` 类型

- `text`：文本输入框
- `password`：密码输入框
- `radio`：单选按钮
- `checkbox`：复选框
- `submit`：提交按钮
- `file`：文件上传
- `date`：日期选择器
- `email`：邮箱输入
- `number`：数字输入

### 12. `head` 中的重要标签

虽然 `head` 中的内容不会直接显示在页面上，但它们非常重要

#### 12.1 常见标签

- `<title>`：设置网页标题
- `<meta charset="UTF-8">`：设置字符编码
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">`：移动端适配
- `<meta name="description" content="网页描述">`：页面描述，常用于 SEO
- `<link rel="stylesheet" href="style.css">`：引入外部 CSS
- `<script src="app.js"></script>`：引入外部 JavaScript

说明：

- CSS 通常通过 `<link>` 引入
- JavaScript 推荐使用外部文件，便于维护

## HTML 高级阶段

前面的内容解决的是“静态页面怎么写”，这一部分继续进入表单和用户输入，也就是网页如何从“展示内容”走向“接收数据”

### 1. HTML 表单

#### 1.1 用途

HTML 表单（`HTML Forms`）用于收集用户输入，并将数据发送给服务器处理。常见场景包括：

- 登录验证
- 注册账号
- 评论提交
- 搜索功能
- 文件上传

可以把表单理解为网页中的“数据入口”

#### 1.2 基本语法结构

表单使用 `<form>` 标签定义，基本结构如下：

```html
<form action="/submit" method="post">
  <!-- 各种输入控件 -->
</form>
```

##### `form` 的核心属性

| 属性名    | 说明                                           |
| --------- | ---------------------------------------------- |
| `action`  | 指定表单数据提交到的目标 URL，即服务器处理接口 |
| `method`  | 指定提交方式，通常为 `GET` 或 `POST`           |
| `enctype` | 指定数据编码方式，文件上传时尤其重要           |
| `name`    | 给表单起名字，便于脚本引用                     |
| `target`  | 指定提交结果打开的位置，如 `_self`、`_blank`   |

#### 1.3 GET 与 POST

HTML 表单最常见的两种提交方式是 `GET` 和 `POST`

| 提交方式 | 特点                   | 常用场景                       |
| -------- | ---------------------- | ------------------------------ |
| `GET`    | 参数附加在 URL 后面    | 查询、搜索、筛选等不敏感操作   |
| `POST`   | 参数放在 HTTP 请求体中 | 登录、注册、提交数据、文件上传 |

##### 例子对比

`GET` 提交后，地址栏可能变成：

```text
/search?keyword=html
```

`POST` 提交时，参数不会直接显示在地址栏中，而是放在请求体里

##### 补充说明

- `POST` 并不等于“绝对安全”
- 真正的安全性仍依赖 `HTTPS`、后端验证和权限控制
- 更准确地说，`POST` 更适合提交敏感数据或较长数据

#### 1.4 表单的组成部分

一个表单通常由多种输入控件组成，例如：

- `<input>`：文本、密码、邮箱、数字、日期、文件等输入
- `<textarea>`：多行文本输入框
- `<select>`：下拉菜单
- `<button>` 或 `<input type="submit">`：提交按钮
- `<label>`：文本标签，用于说明输入内容

#### 1.5 一个完整的表单示例

```html
<form action="/register" method="post">
  <div>
    <label for="username">用户名：</label>
    <input type="text" id="username" name="username" required />
  </div>

  <div>
    <label for="email">邮箱：</label>
    <input type="email" id="email" name="email" required />
  </div>

  <div>
    <label for="password">密码：</label>
    <input type="password" id="password" name="password" required />
  </div>

  <button type="submit">注册</button>
</form>
```

当点击“注册”按钮时，浏览器会：

- 收集输入的数据
- 按 `POST` 方式打包
- 发送请求到 `/register`
- 等待服务器响应，例如“注册成功”或错误提示

#### 1.6 小贴士

- 表单中每个需要提交的数据项都应该有 `name` 属性，否则不会被发送
- `label` 的 `for` 属性要和输入框的 `id` 对应
- 提交按钮既可以使用 `<button type="submit">`，也可以使用 `<input type="submit">`
- 在前后端分离项目中，通常会用 JavaScript 拦截默认提交，再用 `fetch` 或 `axios` 手动发送到 API

### 2. 文本输入框 `<input>`

#### 2.1 用途

`<input>` 标签用于创建单行输入字段，是 HTML 中最通用的输入控件

通过不同的 `type`，它可以收集多种类型的数据，例如：

- 文本
- 密码
- 邮箱
- 数字
- 日期
- 文件

最基本的例子：

```html
<input type="text" name="username" />
```

#### 2.2 核心属性详解

| 属性名         | 示例                                  | 说明                       |
| -------------- | ------------------------------------- | -------------------------- |
| `type`         | `text`、`password`、`email`、`number` | 决定输入框类型             |
| `name`         | `name="user"`                         | 表单提交时的字段名         |
| `value`        | `value="默认值"`                      | 输入框默认内容             |
| `placeholder`  | `placeholder="请输入用户名"`          | 提示文字，不会被提交       |
| `required`     | `required`                            | 必填项，浏览器会自动验证   |
| `readonly`     | `readonly`                            | 只读，不可修改             |
| `disabled`     | `disabled`                            | 禁用，不能聚焦，也不会提交 |
| `maxlength`    | `maxlength="20"`                      | 限制最大输入长度           |
| `autocomplete` | `on` / `off`                          | 是否启用浏览器自动填充     |

#### 2.3 常见输入类型

##### 1. 普通文本

```html
<input type="text" name="username" />
```

##### 2. 密码框

```html
<input type="password" name="password" />
```

浏览器会将输入内容显示为圆点或星号

##### 3. 邮箱输入

```html
<input type="email" name="email" />
```

浏览器会检查格式是否像邮箱，例如是否包含 `@`

##### 4. 数字输入

```html
<input type="number" name="age" />
```

通常只能输入数字，部分浏览器会显示上下调节按钮

##### 5. 电话号码

```html
<input type="tel" name="phone" />
```

在移动端通常会调出更适合输入电话号码的键盘

##### 6. 搜索框

```html
<input type="search" name="keyword" />
```

部分浏览器会提供清空按钮等搜索体验优化

#### 2.4 示例：登录表单

```html
<form action="/login" method="post">
  <div>
    <label for="user">用户名：</label>
    <input
      type="text"
      id="user"
      name="username"
      placeholder="请输入用户名"
      required
      minlength="3"
    />
  </div>

  <div>
    <label for="pwd">密码：</label>
    <input
      type="password"
      id="pwd"
      name="password"
      placeholder="请输入密码"
      required
      minlength="6"
    />
  </div>

  <button type="submit">登录</button>
</form>
```

浏览器会在提交前自动检查必填项、最小长度等规则

#### 2.5 HTML5 新增的输入类型

除了常见的 `text`、`password`，HTML5 还新增了许多实用输入类型

| 类型             | 功能                     |
| ---------------- | ------------------------ |
| `url`            | 输入网址，并自动验证格式 |
| `color`          | 颜色选择器               |
| `range`          | 使用滑块选择数值         |
| `date`           | 日期选择器               |
| `datetime-local` | 本地日期时间选择器       |
| `file`           | 文件选择与上传           |

这些类型在移动端尤其有价值，因为系统通常会自动弹出更合适的键盘或选择界面

#### 2.6 小结

- `<input>` 是最常用的表单控件
- `type` 决定输入方式和验证规则
- `name` 很重要，没有它通常无法参与表单提交
- `placeholder` 用于提示，`required` 用于基本验证
- HTML5 新输入类型可以明显提升用户体验

### 3. 表单提交

#### 3.1 什么是表单提交

当用户填写完表单并点击提交按钮后，浏览器会执行以下动作：

- 收集表单中所有带有 `name` 的输入值
- 按 `method` 指定的方式打包数据
- 发送到 `action` 指定的服务器地址
- 等待服务器返回响应，例如“登录成功”或“密码错误”

#### 3.2 `form` 的关键属性

| 属性      | 示例                  | 说明             |
| --------- | --------------------- | ---------------- |
| `action`  | `/login`              | 数据发送目标     |
| `method`  | `post` 或 `get`       | 提交方式         |
| `target`  | `_self`、`_blank`     | 提交结果显示位置 |
| `enctype` | `multipart/form-data` | 数据编码方式     |

#### 3.3 提交按钮的几种方式

##### 1. 使用 `<button type="submit">`

```html
<button type="submit">提交</button>
```

这是最常见、最灵活的写法

说明：

- `type="submit"` 会触发表单默认提交行为
- 如果 `button` 在 `form` 中省略 `type`，浏览器通常会把它当作 `submit`

##### 2. 使用 `<input type="submit">`

```html
<input type="submit" value="提交" />
```

这是较传统的写法，效果与上面类似，只是写法更简洁

##### 3. 使用 JavaScript 提交

```html
<form id="loginForm">
  <input type="text" name="username" required />
  <input type="password" name="password" required />
  <button type="submit">登录</button>
</form>

<script>
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const formData = new FormData(form);

    fetch("/api/login", {
      method: "POST",
      body: formData,
    });
  });
</script>
```

这种方式常见于前后端分离项目

#### 3.4 GET 与 POST 的区别

| 对比项           | GET              | POST                     |
| ---------------- | ---------------- | ------------------------ |
| 参数位置         | URL 中           | 请求体中                 |
| 是否显示在地址栏 | 是               | 否                       |
| 数据长度         | 有限制           | 一般更灵活               |
| 是否适合敏感数据 | 不适合           | 更适合                   |
| 常见用途         | 搜索、过滤、导航 | 登录、注册、提交表单     |
| 是否缓存         | 浏览器可能缓存   | 通常不作为可缓存表单提交 |

##### 结论

- 搜索框通常使用 `GET`
- 登录、注册、提交数据通常使用 `POST`

#### 3.5 编码类型 `enctype`

`enctype` 指定浏览器发送表单数据时使用的编码方式

| 编码方式                            | 说明         | 典型用途           |
| ----------------------------------- | ------------ | ------------------ |
| `application/x-www-form-urlencoded` | 默认方式     | 普通文本表单       |
| `multipart/form-data`               | 分块发送数据 | 文件上传，必须使用 |
| `text/plain`                        | 纯文本方式   | 不常用，多用于调试 |

##### 文件上传示例

```html
<form action="/upload" method="post" enctype="multipart/form-data">
  <input type="file" name="avatar" />
  <button type="submit">上传</button>
</form>
```

如果上传文件，却没有设置 `enctype="multipart/form-data"`，文件通常无法被正确上传

#### 3.6 表单验证与阻止提交

HTML5 提供了一些常见的内置验证规则：

- `required`：必填项
- `minlength` / `maxlength`：长度范围
- `pattern`：正则表达式验证
- `min` / `max`：数值范围限制
- `type="email"`：邮箱格式验证

示例：

```html
<form action="/submit" method="post">
  <input type="email" name="email" required />
  <input type="text" name="code" pattern="\d{4}" required />
  <button type="submit">提交</button>
</form>
```

如果用户未填写或格式不正确，浏览器会自动阻止提交并提示

如果需要更灵活的逻辑，可以使用 JavaScript：

```html
<form id="myForm">
  <input type="text" id="username" required />
  <button type="submit">提交</button>
</form>

<script>
  const myForm = document.getElementById("myForm");

  myForm.addEventListener("submit", function (event) {
    const username = document.getElementById("username").value.trim();

    if (username.length < 3) {
      event.preventDefault();
      alert("用户名至少 3 个字符");
    }
  });
</script>
```

#### 3.7 小结

- `action` 决定提交到哪里
- `method` 决定如何提交
- 提交可以由 `submit` 按钮或 JavaScript 触发
- HTML5 内置验证能提升体验
- 文件上传时必须使用 `multipart/form-data`

### 4. 日期与时间输入

HTML5 提供了多种与日期、时间有关的输入控件

#### 4.1 常见类型

| 类型             | 作用               | 示例                            |
| ---------------- | ------------------ | ------------------------------- |
| `date`           | 选择日期           | `<input type="date">`           |
| `time`           | 选择时间           | `<input type="time">`           |
| `datetime-local` | 选择本地日期和时间 | `<input type="datetime-local">` |
| `month`          | 选择月份           | `<input type="month">`          |
| `week`           | 选择周             | `<input type="week">`           |

#### 4.2 示例

```html
<form>
  <label>生日：</label>
  <input type="date" name="birthday" />

  <label>预约时间：</label>
  <input type="time" name="appointment_time" />

  <label>会议时间：</label>
  <input type="datetime-local" name="meeting_time" />

  <label>账单月份：</label>
  <input type="month" name="billing_month" />

  <label>教学周：</label>
  <input type="week" name="study_week" />
</form>
```

#### 4.3 常用属性

| 属性          | 示例                 | 说明                 |
| ------------- | -------------------- | -------------------- |
| `min` / `max` | `min="2025-01-01"`   | 限制可选范围         |
| `value`       | `value="2025-11-12"` | 默认值               |
| `step`        | `step="60"`          | 步长，常用于时间输入 |

#### 4.4 注意事项

- 日期格式通常要求使用标准格式，如 `YYYY-MM-DD`
- 不同浏览器的日期选择器样式可能不同
- `datetime-local` 不包含时区信息，只表示本地日期和时间

### 5. 下拉列表 `<select>`

#### 5.1 用途

`<select>` 用于让用户从预设选项中选择一个或多个值，常见于：

- 城市选择
- 职业选择
- 分类选择

#### 5.2 语法结构

- `<select>`：定义下拉菜单
- `<option>`：定义每个选项
- `value`：指定提交给后端的实际值

示例：

```html
<select name="city">
  <option value="beijing">北京</option>
  <option value="shanghai">上海</option>
  <option value="guangzhou">广州</option>
</select>
```

#### 5.3 常用属性

| 属性       | 说明           | 示例                |
| ---------- | -------------- | ------------------- |
| `name`     | 提交字段名     | `name="city"`       |
| `value`    | 选项值         | `value="shanghai"`  |
| `selected` | 默认选中项     | `<option selected>` |
| `multiple` | 支持多选       | `<select multiple>` |
| `size`     | 显示多少行选项 | `<select size="3">` |

#### 5.4 示例

```html
<select name="city">
  <option value="">请选择城市</option>
  <option value="beijing">北京</option>
  <option value="shanghai" selected>上海</option>
  <option value="shenzhen">深圳</option>
</select>
```

多选示例：

```html
<select name="skills" multiple size="3">
  <option value="html">HTML</option>
  <option value="css">CSS</option>
  <option value="js">JavaScript</option>
</select>
```

### 6. 文本域 `<textarea>`

#### 6.1 用途

`<textarea>` 用于输入多行文本，适合：

- 留言
- 评论
- 个人简介
- 反馈建议

与 `<input type="text">` 不同，`textarea` 可以自动换行，容纳更长的内容

#### 6.2 语法

`<textarea>` 是成对标签，内容写在开始标签和结束标签之间

```html
<textarea name="comment" rows="5" cols="40"></textarea>
```

说明：

- `rows` 表示可见行数
- `cols` 表示每行参考宽度

#### 6.3 常用属性

| 属性          | 说明         | 示例                          |
| ------------- | ------------ | ----------------------------- |
| `name`        | 提交字段名   | `name="comment"`              |
| `rows`        | 可见行数     | `rows="5"`                    |
| `cols`        | 每行字符宽度 | `cols="40"`                   |
| `placeholder` | 占位提示     | `placeholder="请输入评论..."` |
| `maxlength`   | 最大字符数   | `maxlength="200"`             |
| `readonly`    | 只读         | `readonly`                    |
| `disabled`    | 禁用         | `disabled`                    |

#### 6.4 示例

```html
<label for="comment">评论内容：</label>
<textarea
  id="comment"
  name="comment"
  rows="5"
  cols="40"
  maxlength="200"
  placeholder="请输入评论..."
></textarea>
```

### 7. 表单提交与验证补充

这一部分与你前面的章节有重复内容，这里整理成补充版，方便系统理解

#### 7.1 表单提交语法

```html
<form action="submit.php" method="post">
  <input type="text" name="username" />
  <button type="submit">提交</button>
</form>
```

说明：

- `action` 指定提交地址
- `method` 指定提交方式
- `get` 适合查询类操作
- `post` 适合提交类操作

#### 7.2 常用按钮类型

| 类型     | 说明                          |
| -------- | ----------------------------- |
| `submit` | 提交表单                      |
| `reset`  | 重置表单                      |
| `button` | 普通按钮，通常配合 JavaScript |

示例：

```html
<button type="submit">提交</button>
<button type="reset">重置</button>
<button type="button">普通按钮</button>
```

#### 7.3 HTML 内置验证

HTML5 常见验证属性如下：

| 属性           | 作用           | 示例                                      |
| -------------- | -------------- | ----------------------------------------- |
| `required`     | 必填字段       | `<input required>`                        |
| `type="email"` | 验证邮箱格式   | `<input type="email">`                    |
| `pattern`      | 自定义正则验证 | `<input pattern="\d{4}">`                 |
| `min` / `max`  | 限制数值范围   | `<input type="number" min="1" max="100">` |
| `maxlength`    | 最大字符数     | `<input maxlength="20">`                  |

示例：

```html
<form>
  <input type="email" placeholder="请输入邮箱" required />
  <input type="number" min="1" max="100" required />
  <button type="submit">提交</button>
</form>
```

如果格式错误，浏览器会自动阻止提交

#### 7.4 JavaScript 自定义验证

如果内置验证不够，可以用 JavaScript 实现更复杂的逻辑，例如：

- 两次密码是否一致
- 用户名是否已被占用
- 多字段联动校验

结论：

- HTML 内置验证简单易用
- JavaScript 验证更灵活
- 实际开发中，前端验证和后端验证都必须有

## HTML 矢量图与图像映射

当基础标签和表单都掌握之后，HTML 还剩下一些常见但不总是高频的能力，比如 SVG 和图像映射。这一部分更像补充工具箱

### 8. HTML 矢量图

在 HTML 中，常见的图形相关方式主要有两种：

- `SVG`
- `map`

其中最重要的是 `SVG`

### 9. SVG

#### 9.1 什么是 SVG

SVG 是 `Scalable Vector Graphics` 的缩写，即“可缩放矢量图形”

它和 `jpg`、`png` 这类位图不同：

- 位图由像素点组成，放大后会失真、变模糊
- SVG 由 XML 描述的路径、线条、形状和颜色构成，放大后依然清晰

SVG 的核心优势是：

- 可无限缩放而不失真
- 非常适合图标、Logo、图表等场景

#### 9.2 `<svg>` 标签

`<svg>` 是一个容器标签，用于在 HTML 页面中直接定义或嵌入 SVG 图形

可以像普通元素一样设置画布大小：

- `width`
- `height`

例如：

```html
<svg width="120" height="120" viewBox="0 0 120 120">
  <circle cx="60" cy="60" r="40" fill="skyblue" stroke="black"></circle>
</svg>
```

#### 9.3 在 HTML 中使用 SVG 的两种方式

##### 方式一：作为 `<img>` 的 `src`

如果 SVG 是单独文件，例如 `logo.svg`，可以这样使用：

```html
<img src="logo.svg" alt="网站 Logo" width="120" />
```

这是最简单的方式，适合直接展示现成图标或 Logo

##### 方式二：内联 SVG

把 SVG 代码直接写进 HTML：

```html
<svg width="120" height="120" viewBox="0 0 120 120">
  <rect
    x="10"
    y="10"
    width="100"
    height="100"
    fill="orange"
    stroke="black"
  ></rect>
</svg>
```

这种方式最灵活，因为：

- 可以直接用 CSS 改颜色
- 可以用 JavaScript 控制元素
- 可以制作动画和交互效果

#### 9.4 SVG 常见属性

| 属性               | 说明                          |
| ------------------ | ----------------------------- |
| `viewBox`          | 定义 SVG 内部坐标系和缩放规则 |
| `fill`             | 填充颜色                      |
| `stroke`           | 描边颜色                      |
| `width` / `height` | SVG 显示尺寸                  |

说明：

- `viewBox` 很重要，它决定图形如何缩放和适配容器
- `fill` 作用于形状内部颜色
- `stroke` 控制边线颜色

#### 9.5 SVG 的常见用途

SVG 适合用于：

- 图标（Icons）
- Logo
- 数据图表（Charts）
- 简单插画
- 可缩放图形界面元素

很多图标库，例如 Font Awesome、Iconfont，都会提供 SVG 格式图标，原理就是基于 SVG

### 10. `map` 图像映射

#### 10.1 什么是 `map`

`map` 标签与 `SVG` 完全不同。它是一种较早期的 HTML 功能，用于为一张普通图片定义多个可点击区域

例如：

- 一张世界地图
- 点击“美国”跳到 A 页面
- 点击“中国”跳到 B 页面

这就是图像映射（Image Map）

#### 10.2 工作原理

图像映射通常由三部分配合完成：

- `<img>`：显示图片
- `usemap`：指定关联的映射名称
- `<map>`：定义热点区域集合
- `<area>`：定义具体的可点击区域

基本思路是：

- 在 `<img>` 上写 `usemap="#shapesmap"`
- 再用 `<map name="shapesmap">` 定义映射
- 在 `<map>` 中使用多个 `<area>` 定义不同区域

#### 10.3 `<area>` 的关键属性

| 属性     | 说明             |
| -------- | ---------------- |
| `shape`  | 热点区域形状     |
| `coords` | 区域坐标         |
| `href`   | 点击后跳转的链接 |
| `alt`    | 区域的替代文本   |

##### `shape` 的常见取值

- `rect`：矩形
- `circle`：圆形
- `poly`：多边形

##### `coords` 的写法

如果以图片左上角为原点 `(0,0)`：

- `rect`：`x1, y1, x2, y2`
- `circle`：`centerX, centerY, radius`
- `poly`：`x1, y1, x2, y2, x3, y3, ...`

#### 10.4 示例

假设有一张 `200 x 100` 的图片，左边是一个圆，右边是一个矩形：

```html
<img
  src="shapes.png"
  alt="圆形和矩形"
  width="200"
  height="100"
  usemap="#shapesmap"
/>

<map name="shapesmap">
  <area
    shape="circle"
    coords="50, 50, 40"
    href="circle-page.html"
    alt="圆形区域"
  />

  <area
    shape="rect"
    coords="110, 10, 190, 90"
    href="rect-page.html"
    alt="矩形区域"
  />
</map>
```

说明：

- 点击左侧圆形区域会跳到 `circle-page.html`
- 点击右侧矩形区域会跳到 `rect-page.html`

#### 10.5 总结

- `map` 可以给一张普通图片定义多个点击区域
- 它在现代开发中使用较少
- 如果要做复杂、可缩放、可交互的图形，更推荐使用 `SVG`
- `SVG` 更灵活，也更方便配合 CSS 和 JavaScript

## 本章总结

这一部分的核心知识点包括：

- `form` 用于收集和提交用户输入
- `action` 决定提交目标，`method` 决定提交方式
- 常见输入控件有 `input`、`textarea`、`select`、`button`
- `GET` 常用于查询，`POST` 常用于提交
- 文件上传必须使用 `enctype="multipart/form-data"`
- HTML5 提供了丰富的输入类型和内置验证能力
- `SVG` 用于高质量、可缩放图形
- `map` 用于图像热点区域，但现代开发中较少使用
