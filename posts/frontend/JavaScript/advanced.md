---
title: JavaScript 进阶特性
date: 2026-03-31
order: 3
---

## JavaScript 进阶特性

### 函数进阶

#### 函数的注释

没有注释的函数，很多时候只能“猜意思”：

```js
function fn(a, b) {
  return (a * b) / 2;
}
```

这段代码也许是在求三角形面积，也可能在做别的事。为了让函数用途更明确，JavaScript 里常用 `JSDoc` 风格注释来补充说明

最基础的写法：

```js
/**
 * 计算三角形的面积
 */
function fn(a, b) {
  return (a * b) / 2;
}
```

编辑器通常能直接识别这类注释，并在悬停时显示提示

#### JSDoc 参数说明

可以使用 `@param` 描述参数：

```js
/**
 * 计算三角形的面积
 * @param {number} a 底边长度
 * @param {number} b 高度
 */
function fn(a, b) {
  return (a * b) / 2;
}
```

#### 返回值说明

可以继续补充返回值信息：

```js
/**
 * 计算三角形的面积
 * @param {number} a 底边长度
 * @param {number} b 高度
 * @returns {number} 三角形面积
 */
function fn(a, b) {
  return (a * b) / 2;
}
```

#### 使用示例

也可以写上 `@example`：

```js
/**
 * 计算三角形的面积
 * @param {number} a 底边长度
 * @param {number} b 高度
 * @returns {number} 三角形面积
 * @example
 * fn(4, 2) // 4
 */
function fn(a, b) {
  return (a * b) / 2;
}
```

JSDoc 的价值不只是“写注释”，更重要的是让编辑器、类型提示和文档生成工具都能理解你的函数

### 即时调用函数

#### 什么是 IIFE

有时候我们只想执行一段函数逻辑一次，执行完就结束，不希望额外污染外部作用域。这时可以使用即时调用函数，也叫 `IIFE`

基本形式：

```js
(function hello(text) {
  console.log(`Hello World! ${text}`);
})("You");
```

更常见的是匿名形式：

```js
(function (text) {
  console.log(`Hello World! ${text}`);
})("You");
```

#### 为什么会有这种写法

在 `let` 和 `const` 出现之前，`var` 只有函数作用域，没有块级作用域，因此 IIFE 曾经被大量用来“手动制造一个独立作用域”

现在有了 `let` 和 `const`，这种写法已经没有过去那么常用了，但在旧代码和一些工具库源码里仍然会见到

### 剩余参数

#### 为什么需要剩余参数

有些函数参数个数并不固定，比如：

```js
console.log("A", "B", "C");
```

前面我们学过 `arguments`，它能获取调用时传入的所有参数：

```js
function test() {
  console.log(arguments);
  console.log(arguments[0]);
  console.log(arguments.length);
}
```

但 `arguments` 不是数组，用起来不够直接

#### 剩余参数语法

ES6 引入了剩余参数：

```js
function test(...args) {
  console.log(args);
}

test(1, 2, 4, 5);
```

这里的 `args` 是一个真正的数组，因此后续处理起来更方便

#### 规则

剩余参数有两个关键限制：

- 只能出现一次
- 必须放在形参列表最后

例如：

```js
function test(text, ...args) {
  console.log(text);
  console.log(args);
}
```

现代 JavaScript 中，优先推荐使用剩余参数，而不是 `arguments`

### 箭头函数

#### 箭头函数的基本写法

普通函数：

```js
function add(a, b) {
  return a + b;
}
```

箭头函数：

```js
const add = (a, b) => {
  return a + b;
};
```

它本质上仍然是函数，只是语法更简洁

#### 进一步简写

如果只有一个参数，可以省略参数外层括号：

```js
const square = (x) => {
  return x * x;
};
```

可以简写为：

```js
const square = (x) => {
  return x * x;
};
```

如果函数体只有一行 `return`，还可以继续简化：

```js
const square = (x) => x * x;
```

#### 返回对象时的注意点

下面这种写法是错误的：

```js
const fn = () => {
  name: "Tom";
};
```

因为花括号会被当成函数体，而不是对象字面量。正确写法要额外包一层括号：

```js
const fn = () => ({ name: "Tom" });
```

#### 箭头函数没有自己的 arguments

箭头函数里不能直接使用自己的 `arguments`，需要用剩余参数代替：

```js
const fn = (...args) => {
  console.log(args);
};
```

#### 箭头函数最重要的点：没有自己的 this

普通对象方法：

```js
const obj = {
  name: "小明",
  say() {
    console.log(this.name);
  },
};

obj.say(); // 小明
```

如果改成箭头函数：

```js
const obj = {
  name: "小明",
  say: () => {
    console.log(this.name);
  },
};

obj.say(); // 通常是 undefined
```

原因是箭头函数没有自己的 `this`。它会直接继承定义时外层作用域中的 `this`，而不是在调用时重新决定

可以简单记成：

- 普通函数：`this` 由调用方式决定
- 箭头函数：`this` 由定义位置决定

#### 适合用箭头函数的场景

当你不需要 `this` 时，箭头函数非常适合写回调：

```js
const arr = [1, 2, 3];
const result = arr.map((x) => x * 2);
console.log(result);
```

```js
const arr = [1, 2, 3];
arr.forEach((x) => console.log(x));
```

现代 JavaScript 里，回调函数大多都会优先使用箭头函数

### 解构语法

#### 数组解构

没有解构时，代码通常像这样：

```js
const arr = [10, 20, 30];

const a = arr[0];
const b = arr[1];
const c = arr[2];
```

使用数组解构：

```js
const arr = [10, 20, 30, 40];
const [a, b, c] = arr;

console.log(a, b, c);
```

#### 跳过元素

```js
const arr = [10, 20, 30, 40];
const [, b, c] = arr;

console.log(b, c);
```

#### 默认值

```js
const arr = [10];
const [a, b = 100] = arr;

console.log(a, b);
```

#### 剩余元素

```js
const arr = [1, 2, 3, 4];
const [a, ...rest] = arr;

console.log(a);
console.log(rest);
```

#### 对象解构

对象解构按属性名匹配，而不是按顺序：

```js
const person = {
  name: "小明",
  age: 18,
};

const { name, age } = person;
console.log(name, age);
```

#### 重命名

```js
const person = {
  name: "小明",
  age: 18,
};

const { name: userName, age } = person;
console.log(userName, age);
```

#### 默认值

```js
const person = {
  name: "小明",
};

const { name, age = 18 } = person;
console.log(name, age);
```

#### 对象剩余属性

```js
const obj = {
  name: "小明",
  age: 18,
  city: "北京",
};

const { name, ...others } = obj;
console.log(name);
console.log(others);
```

#### 函数参数中的解构

函数参数里使用解构非常常见：

```js
function printUser({ name, age }) {
  console.log(name);
  console.log(age);
}

const person = {
  name: "小明",
  age: 18,
};

printUser(person);
```

多个参数也可以混合使用：

```js
function printUser({ name, age }, text, { type }) {
  console.log(name);
  console.log(age);
  console.log(text);
  console.log(type);
}
```

### 展开运算符

#### 合并数组

不用展开运算符时，常见写法是：

```js
const arr1 = [1, 2, 3];
const arr2 = [4, 5];
const arr3 = arr1.concat(arr2);
console.log(arr3);
```

使用展开运算符后：

```js
const arr1 = [1, 2, 3];
const arr2 = [4, 5];
const arr3 = [6, 7];
const arr4 = [8, 9];

const arr5 = [...arr1, ...arr2, ...arr3, ...arr4];
console.log(arr5);
```

#### 复制数组

数组是引用类型，直接赋值只会复制引用：

```js
const arr1 = [1, 2, 3];
const arr2 = arr1;

arr2.push(4);
console.log(arr1);
```

如果想复制出一个新数组，可以用展开运算符：

```js
const arr1 = [1, 2, 3];
const arr2 = [...arr1];

arr2.push(4);
console.log(arr1);
console.log(arr2);
```

不过这依然是浅拷贝

#### 展开对象

对象也可以展开：

```js
const obj1 = {
  name: "小明",
  age: 18,
};

const obj2 = {
  ...obj1,
  city: "北京",
};

console.log(obj2);
```

属性冲突时，后面的覆盖前面的：

```js
const base = { a: 1, b: 2 };
const extra = { b: 100, c: 3 };

const result = { ...base, ...extra };
console.log(result);
```

#### 复制对象

```js
const obj1 = { name: "小明" };
const obj2 = { ...obj1 };

obj2.name = "小红";
console.log(obj1.name);
console.log(obj2.name);
```

对象展开同样只是浅拷贝

#### 展开作为函数参数

```js
const arr = [5, 8, 16];

function sum(a, b) {
  return a + b;
}

console.log(sum(...arr));
```

更准确地说，函数调用里的展开适用于可迭代对象，最常见就是数组和字符串。普通对象不能直接这样作为参数展开

### 标签模板

#### 什么是标签模板

模板字符串我们已经学过：

```js
const name = "小明";
const age = 18;

const str = `我叫${name}，今年${age}岁`;
console.log(str);
```

所谓标签模板，就是用一个函数“接管”模板字符串的解析过程

#### 基本写法

```js
function tag(strs, value) {
  console.log(strs);
  console.log(value);
}

const name = "小明";
tag`你好，${name}`;
```

这里：

- `strs` 是被拆分后的字符串数组
- 后面的参数是每个插值表达式的值

并且 `strs.length` 永远比插值表达式数量多 1

#### 一个格式化示例

```js
function format(strs, ...values) {
  return strs.reduce((res, str, i) => {
    const value = values[i];
    return (
      res + str + (typeof value === "number" ? value.toFixed(2) : (value ?? ""))
    );
  }, "");
}

const price = 12.3456;
const msg = format`商品价格：${price} 元`;
console.log(msg);
```

#### String.raw

`String.raw` 就是一个典型的标签模板函数：

```js
const name = "小明";
console.log(String.raw`你好，${name} 我爱你 \n 你牛逼`);
```

它会尽可能保留转义字符的原始形式

### 生成器

#### 普通函数的问题

普通函数要么不执行，要么一旦调用就一路执行到底：

```js
function fn() {
  console.log(1);
  console.log(2);
  console.log(3);
}

fn();
```

如果我们想让函数“执行到一半先暂停”，普通函数做不到。生成器就是为这种需求准备的

#### 生成器的写法

生成器函数要在 `function` 后面加 `*`：

```js
function* gen() {}
```

调用生成器不会立刻执行函数体，而是返回一个生成器对象：

```js
function* gen() {
  console.log("我是第一阶段");
}

const generator = gen();
console.log(generator);
```

#### next 和 yield

要推进执行，需要调用 `next()`：

```js
function* gen() {
  console.log("我是第一阶段");
  yield;
  console.log("我是第二阶段");
  yield;
  console.log("我是第三阶段");
}

const generator = gen();
generator.next();
generator.next();
generator.next();
```

每次执行到 `yield`，生成器都会暂停，等待下一次 `next()`

#### next 的返回值

`next()` 会返回一个对象：

```js
function* gen() {
  console.log("我是第一阶段");
  yield 233;
  console.log("我是第二阶段");
  yield 666;
  console.log("我是第三阶段");
}

const generator = gen();
console.log(generator.next());
console.log(generator.next());
console.log(generator.next());
```

它的结构通常是：

```js
{ value: xxx, done: boolean }
```

其中：

- `value` 是当前阶段产出的值
- `done` 表示生成器是否已经结束

#### 无限序列示例

```js
function* counter() {
  let i = 0;
  while (true) {
    yield i++;
  }
}

const c = counter();
console.log(c.next().value);
console.log(c.next().value);
console.log(c.next().value);
```

生成器不会一次性把所有值都生成出来，而是“要一个给一个”

#### for...of 遍历生成器

生成器对象本身也是可迭代的：

```js
function* gen() {
  yield 233;
  yield 666;
  yield 999;
}

for (const value of gen()) {
  console.log(value);
}
```

### 对象进阶

#### 属性的继承

现实世界中经常存在继承关系，比如：

- 学生是一种人
- 美术生是一种学生

继承的目标通常是：

- 复用已有属性
- 复用已有方法
- 在此基础上增加自己的扩展内容

#### 一个最基础的例子

```js
function Student(name, age) {
  this.name = name;
  this.age = age;
}

function ArtStudent(name, age, level) {
  this.level = level;
}
```

这里 `ArtStudent` 和 `Student` 明显有重复信息。更合理的做法是复用 `Student` 的初始化逻辑

#### 借用父构造函数初始化属性

```js
function Student(name, age) {
  this.name = name;
  this.age = age;
}

function ArtStudent(name, age, level) {
  Student.call(this, name, age);
  this.level = level;
}

const a = new ArtStudent("小明", 18, "高级");
console.log(a.name);
console.log(a.age);
console.log(a.level);
```

这里 `Student.call(this, ...)` 的作用是：

- 在当前新对象上执行 `Student`
- 把 `name` 和 `age` 初始化到当前实例上

#### 建立原型继承关系

如果只是 `call()` 父构造函数，只能继承实例属性，不能继承父类原型上的方法。要继续复用方法，还要建立原型链关系：

```js
function Student(name, age) {
  this.name = name;
  this.age = age;
}

Student.prototype.say = function () {
  console.log(`我是学生：${this.name}`);
};

function ArtStudent(name, age, level) {
  Student.call(this, name, age);
  this.level = level;
}

ArtStudent.prototype = Object.create(Student.prototype);
ArtStudent.prototype.constructor = ArtStudent;

ArtStudent.prototype.draw = function () {
  console.log(`我的绘画等级是：${this.level}`);
};

const a = new ArtStudent("小明", 18, "高级");
a.say();
a.draw();
```

这就是更现代、也更合理的构造函数继承写法

#### 为什么不用 Child.prototype = new Parent()

旧代码里常见这种写法：

```js
Child.prototype = new Parent();
```

它的问题在于：

- 会额外执行一次父构造函数
- 可能把本不该共享的实例属性挂到原型上
- 行为容易让初学者混淆

因此更推荐使用：

```js
Child.prototype = Object.create(Parent.prototype);
```

#### constructor 的修正

当你重写了子构造函数的 `prototype` 之后，通常还要把 `constructor` 指回来：

```js
ArtStudent.prototype.constructor = ArtStudent;
```

否则：

```js
const a = new ArtStudent("小明", 18, "高级");
console.log(a.constructor === ArtStudent); // true
```

如果不修正，`constructor` 可能会错误地指向父构造函数

### 本章小结

#### 需要掌握的重点

- `JSDoc` 可以让函数用途、参数和返回值更清晰
- `IIFE` 曾经常用于制造独立作用域，现在了解即可
- 剩余参数比 `arguments` 更现代、更清晰
- 箭头函数没有自己的 `this` 和 `arguments`
- 解构和展开运算符是现代 JavaScript 的高频语法
- 标签模板可以把模板字符串交给函数自定义解析
- 生成器可以把函数执行过程拆成多个阶段
- 构造函数继承通常要结合 `call()` 和 `Object.create()`

#### 学习建议

- 箭头函数的 `this` 是这章最容易出错的点，一定要自己在控制台多试几组
- 解构、展开、剩余参数这三者长得像，但语义不同，要分开记
- 生成器先掌握“暂停与恢复”的核心思想，不用一开始就死抠底层实现
