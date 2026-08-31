---
title: JavaScript 核心机制
date: 2026-04-01
order: 2
---

## JavaScript 核心机制

### 函数初步

#### 什么是函数

函数可以理解为一段为了完成特定任务而封装起来的代码

它的核心价值有两个：

- 避免重复代码
- 让代码结构更清晰

例如下面这几行逻辑如果在多个地方都会重复出现，就适合提取成函数：

```js
console.log("H");
console.log("A");
a += 10;
```

把这些逻辑封装进函数后，以后只需要调用一次函数名即可

#### 创建和调用函数

函数声明的基本格式：

```js
function 函数名(参数列表) {
  函数体;
}
```

例如：

```js
function test() {
  console.log("我是第一句");
  console.log("我是第二句");
  console.log("我是第三句");
}
```

调用函数：

```js
test();
```

当代码执行到 `test()` 时，就会执行函数体中的全部内容

#### 函数提升

函数声明有一个重要特性：可以先调用，后定义

```js
sum();

function sum() {
  console.log("66666");
}
```

这是因为函数声明会在执行前被扫描并提升

需要注意，这个结论针对的是函数声明，不要无脑套用到所有函数写法上

#### 形式参数与实际参数

函数可以接收参数：

```js
function test(a) {
  console.log(`a + 10 = ${a + 10}`);
  console.log(`a - 10 = ${a - 10}`);
  console.log(`a ** 10 = ${a ** 10}`);
}

test(2);
```

这里：

- `a` 是形式参数
- `2` 是实际参数

形式参数本质上就是函数内部新创建的变量，只在函数作用域中有效

#### 参数作用域与值传递

初学者很容易误以为，把变量传进函数后，函数里操作的就是外部变量本身。对基本类型来说，这种理解是错误的

```js
function swap(a, b) {
  const tmp = a;
  a = b;
  b = tmp;
}

let a = 6;
let b = 9;
swap(a, b);
```

这段代码不能交换外部 `a` 和 `b` 的值，因为函数拿到的是值的副本，而不是直接拿到外部变量本身

#### 默认参数

如果调用函数时没有传参，那么对应形参默认是 `undefined`：

```js
function test(a) {
  console.log(a);
}

test(); // undefined
```

在 ES6 之后，可以为参数设置默认值：

```js
function test(a = 6) {
  console.log(a);
}

test();
test(100);
```

#### 返回值与 return

函数不仅能执行任务，还可以返回结果

```js
function sum(a, b) {
  return a + b;
}

const result = sum(10, 20);
console.log(result);
```

返回值可以继续参与运算：

```js
function sum(a, b) {
  return a + b;
}

const a = sum(sum(10, 20), 30);
console.log(a);
```

如果一个函数没有写 `return`，那么它的默认返回值就是 `undefined`：

```js
function test() {
  console.log("什么都不返回");
}

console.log(test());
```

#### return 的终止效果

`return` 一旦执行，函数会立刻结束，后面的代码不再执行

```js
function test(a) {
  if (a > 0) {
    return "6666";
  }

  console.log("HelloWorld");
  return "7777";
}

console.log(test(10));
```

在循环内部也是一样：

```js
function test() {
  for (let i = 0; i < 5; i++) {
    if (i === 3) {
      return;
    }
    console.log(i);
  }
}
```

上面代码会打印 `0 1 2`，当 `i === 3` 时函数直接结束

### 递归调用（选学）

#### 什么是递归

递归就是函数在内部调用自己

如果没有出口条件，递归就会无限进行，最终导致栈溢出：

```js
function test() {
  console.log("我正在调用自己...");
  test();
}
```

这种写法会报错：`Maximum call stack size exceeded`

#### 递归的两个必要条件

一个正确的递归通常要满足：

- 有明确的递归表达式
- 有明确的终止条件

#### 阶乘示例

```js
function factorial(n) {
  if (n === 1) {
    return 1;
  }

  return n * factorial(n - 1);
}

console.log(factorial(5));
```

这里：

- `n * factorial(n - 1)` 是递归表达式
- `n === 1` 是递归出口

递归适合描述“问题规模不断缩小，直到可以直接求解”的场景

### 对象和引用

#### 什么是对象

对象可以理解为现实世界中某个“实体”的抽象

现实中的对象通常有：

- 属性：描述它的特征
- 行为：描述它能做什么

在 JavaScript 中，对象就是一种可以存储多个属性和方法的复合数据类型

#### 创建对象

最简单的对象写法：

```js
const obj = {};
console.log(typeof obj); // "object"
```

更常见的是直接在对象中定义属性：

```js
const person = {
  name: "张三",
  age: 18,
  gender: "男",
};
```

对象中的属性格式是：

```js
属性名: 属性值;
```

#### 属性名

普通属性名可以直接写：

```js
const person = {
  name: "张三",
  age: 18,
};
```

如果属性名带特殊字符，可以写成字符串：

```js
const person = {
  "2$name": "张三",
  age: 18,
  gender: "男",
};
```

如果属性名来自变量，可以使用计算属性名：

```js
const key = "name";

const person = {
  [key]: "小明",
  age: 18,
  gender: "男",
};
```

#### 访问对象属性

访问属性有两种方式

点运算符：

```js
console.log(person.gender);
console.log(person.age);
```

方括号：

```js
console.log(person["age"]);
console.log(person["2$name"]);
```

当属性名需要动态决定时，方括号更灵活：

```js
const key = "2$name";
console.log(person[key]);
```

#### 不存在的属性

访问不存在的属性不会报错，而是得到 `undefined`：

```js
console.log(person.title);
```

#### 修改、添加和删除属性

修改属性：

```js
person.age = 16;
```

添加属性：

```js
person.school = "重庆邮电大学移通学院";
```

方括号写法也一样：

```js
person["age"] = 16;
```

删除属性可以使用 `delete`：

```js
delete person.age;
```

不过在实际开发中，频繁 `delete` 属性可能影响引擎优化。很多场景下，更推荐把值设为 `undefined` 或 `null`，而不是直接删掉属性

### 对象的方法

#### 方法是什么

对象不仅能存数据，还能存函数。对象中的函数通常称为方法

```js
const person = {
  name: "张三",
  age: 18,
  gender: "男",
  say: function () {
    console.log("大家好");
  },
};
```

调用方法：

```js
person.say();
```

#### this 的基本用法

在对象方法中，可以使用 `this` 表示当前调用该方法的对象：

```js
const person = {
  name: "张三",
  age: 18,
  gender: "男",
  say: function () {
    console.log(`大家好，我叫${this.name}`);
  },
};
```

当执行 `person.say()` 时，`this` 指向 `person`

#### 简写方法

ES6 之后，对象方法可以简写：

```js
const person = {
  name: "张三",
  age: 18,
  gender: "男",
  say() {
    console.log(`大家好，我叫${this.name}`);
  },
};
```

#### 不同对象调用各自的方法

```js
const person = {
  name: "小明",
  say() {
    console.log(`大家好，我叫${this.name}`);
  },
};

const person2 = {
  name: "小红",
  say() {
    console.log(`大家好，我叫${this.name}`);
  },
};

person.say();
person2.say();
```

这里两个对象执行相似的方法，但 `this` 会分别指向调用者自己，所以输出的名字不同

### 属性的遍历

#### for...in 遍历对象

当对象属性数量不确定时，可以使用 `for...in` 遍历属性名：

```js
const person = {
  name: "小明",
  age: 18,
  gender: "男",
  school: "深圳职业技术学院",
};

for (const key in person) {
  console.log(key);
}
```

这里的 `key` 是属性名字符串，不是属性值

如果想同时拿到属性名和属性值：

```js
for (const key in person) {
  console.log(key, person[key]);
}
```

#### 遍历中修改属性

```js
for (const key in person) {
  person[key] = "已处理";
}

console.log(person);
```

### Symbol 符号类型

#### Symbol 的作用

`Symbol` 是 ES6 引入的基本数据类型，用来创建唯一标识符，主要目的是避免属性名冲突

创建 `Symbol`：

```js
const s = Symbol();
```

带描述信息：

```js
const s1 = Symbol("id");
const s2 = Symbol("id");

console.log(s1 === s2); // false
```

即使描述一样，两个 `Symbol` 依然不同

#### Symbol 作为对象属性名

```js
const s1 = Symbol();
const s2 = Symbol();

const person = {
  name: "小明",
  [s1]: 666,
};

person[s2] = 888;
```

此时两个符号属性不会冲突

访问 `Symbol` 属性时，必须拿到对应的 `Symbol` 本身：

```js
console.log(person[s1]);
```

#### Symbol.for

如果希望多个地方拿到同一个符号，可以使用全局注册表：

```js
const s1 = Symbol.for("token");
const s2 = Symbol.for("token");

console.log(s1 === s2); // true
```

#### 预置符号

JavaScript 还内置了一些特殊 `Symbol`，比如：

```js
const test = Symbol.toPrimitive;
console.log(test);
```

不过 `Symbol` 在普通业务开发中使用频率并不高，了解即可

### 引用类型

#### 基本类型与引用类型

JavaScript 的数据大致可以分为两类：

- 基本类型：`number`、`string`、`boolean`、`undefined`、`null`、`symbol`、`bigint`
- 引用类型：`object`、数组、函数等

#### 基本类型的赋值

基本类型保存的是值本身：

```js
let a = 10;
const b = a;

console.log(a, b);
```

这里 `b` 拿到的是 `a` 的值拷贝

#### 引用类型的赋值

引用类型变量保存的不是对象本体，而是对象的引用

```js
const p1 = {
  name: "小明",
  age: 18,
};

const p2 = p1;
```

此时 `p1` 和 `p2` 指向的是同一个对象

```js
p1.name = "东北雨姐";
console.log(p2);
```

修改 `p1`，`p2` 看到的结果也会变化

#### null 与 undefined

如果一个引用变量当前不指向任何对象，通常可以让它等于 `null`：

```js
const p2 = null;
```

它和 `undefined` 的区别可以先这样理解：

- `undefined`：通常表示系统默认的“还没有”
- `null`：通常表示开发者主动设置的“这里本来应该有，但现在为空”

实际开发里，如果你想明确表达“空对象”或“空引用”，通常更推荐使用 `null`

#### 引用类型的比较

引用类型比较的是是否指向同一个对象，而不是内容是否一样：

```js
const p1 = { name: "小明" };
const p2 = p1;
const p3 = { name: "小明" };

console.log(p2 === p1); // true
console.log(p3 === p1); // false
```

`p3` 和 `p1` 内容相同，但不是同一个对象，所以比较结果是 `false`

### 对象的类型转换

#### 对象如何转成基本类型

当对象参与字符串拼接、数学运算或宽松比较时，JavaScript 可能需要先把对象转换成基本类型

转换顺序大致是：

1. `Symbol.toPrimitive`
2. `valueOf()`
3. `toString()`

#### Symbol.toPrimitive

可以通过 `Symbol.toPrimitive` 自定义对象的转换逻辑：

```js
const p2 = {
  name: "小明",
};

p2[Symbol.toPrimitive] = function (hint) {
  console.log(hint);
  return this.name;
};

console.log(p2 + "AAA");
```

这里的 `hint` 可能是：

- `"string"`
- `"number"`
- `"default"`

返回值必须是基本类型，否则会报错

#### 默认 toString 与 valueOf

如果没有手动定义 `Symbol.toPrimitive`，JavaScript 会根据场景尝试调用默认的 `toString()` 和 `valueOf()`

例如对象默认转字符串时，通常会得到：

```js
const obj = { name: "小明" };
console.log(obj + "");
```

默认效果一般类似：

```text
[object Object]
```

这是 JavaScript 的历史行为

### 可选链

#### 为什么需要可选链

如果对象变量可能为 `null`，直接访问属性或调用方法会报错：

```js
let obj = {
  name: "小明",
  say() {
    console.log(`你好，我叫${this.name}`);
  },
};

obj = null;
// obj.say(); // 报错
// console.log(obj.name.length); // 报错
```

传统写法通常需要先判断：

```js
if (obj != null) {
  console.log(obj.name.length);
}
```

#### 可选链写法

ES2020 之后可以用 `?.` 简化这种判断：

```js
console.log(obj?.name?.length);
```

一旦链条上的某个位置是 `null` 或 `undefined`，表达式会直接返回 `undefined`，而不是继续向下访问

#### 可选链调用方法

```js
obj?.say?.();
```

这里表示：

- 如果 `obj` 不存在，直接返回 `undefined`
- 如果 `say` 不存在，也不调用

这就是可选链的核心用途：安全访问可能为空的对象和方法

### 函数类型

#### 函数也是一种值

在 JavaScript 中，函数不仅能调用，它本身也是一种数据

```js
function test() {
  console.log("Hello");
}

console.log(typeof test); // "function"
```

函数有自己独立的类型名 `function`，但本质上它仍然是一种特殊对象

可以简单理解为：

函数 = 一个可以被调用的对象

#### 函数可以赋值给变量

```js
function sayHello() {
  console.log("Hello World");
}

const fn = sayHello;
fn();
```

这里 `fn` 保存的是函数本身，而不是函数执行结果

#### 函数作为参数

```js
function sayHello() {
  console.log("Hello World");
}

function test(say) {
  say();
}

test(sayHello);
```

像这样被传进去再调用的函数，通常称为回调函数

也可以直接传匿名函数：

```js
function test(say) {
  say();
}

test(function () {
  console.log("Hello World");
});
```

#### 函数作为返回值

```js
function createFn() {
  return function () {
    console.log("我是被返回的函数");
  };
}

const fn = createFn();
fn();
```

这类写法是后面学习闭包的重要基础

### 函数的属性与方法

#### 可以给函数添加属性

因为函数本质上也是对象，所以也可以添加属性：

```js
function test() {
  console.log("Hello");
}

test.a = 10;
test.b = "我是函数的属性";

console.log(test.a);
console.log(test.b);
```

#### length 属性

函数的 `length` 表示定义时的形参数量：

```js
function sum(a, b, c) {}
console.log(sum.length); // 3
```

#### name 属性

函数的 `name` 表示函数名：

```js
function test() {}
console.log(test.name);
```

即使是匿名函数，在某些场景下也可能自动拥有名字：

```js
const fn = function () {};
console.log(fn.name); // "fn"
```

#### toString 方法

函数对象也有自己的 `toString()`：

```js
function test() {
  console.log("Hello World");
}

console.log(test.toString());
```

它通常会返回函数源码的字符串形式

### call、apply 和 bind

#### call 与 apply

函数可以用 `call()` 和 `apply()` 调用：

```js
function test(a, b) {
  console.log(a, b);
}

test.call(null, 1, "HHH");
test.apply(null, [1, "HHH"]);
```

它们和直接调用函数的效果类似，区别主要在于：

- `call` 参数逐个传
- `apply` 参数放数组里传

#### this 丢失问题

对象方法一旦被单独拿出来，`this` 可能丢失原本指向：

```js
const person = {
  name: "小明",
  say() {
    console.log(`大家好，我叫${this.name}`);
  },
};

const func = person.say;
func();
```

这时 `this` 不再稳定指向 `person`

#### 用 call/apply 手动指定 this

```js
const func = person.say;
func.call(person);
func.apply(person);
```

这里第一个参数就是你希望 `this` 指向的对象

#### bind 生成绑定后的新函数

```js
const func = person.say.bind(person);
func();
```

`bind` 不会立刻调用函数，而是返回一个已经绑定好 `this` 的新函数

### 函数与对象阶段小结

#### 需要掌握的重点

- 函数是完成特定任务的代码单元，支持参数和返回值
- `return` 会立即结束函数执行
- 对象可以存储属性和方法，方法里的 `this` 通常指向调用者
- `for...in` 可以遍历对象属性
- `Symbol` 用于创建唯一标识，避免属性名冲突
- 引用类型保存的是引用，不是对象本体
- 可选链 `?.` 可以安全访问可能为空的对象
- 函数本质上也是对象，因此可以赋值、传参、返回、添加属性
- `call`、`apply`、`bind` 的核心作用是控制函数调用时的 `this`

#### 学习建议

- 函数、对象、`this` 这三部分一定要自己敲代码验证
- 初学阶段不要只记定义，要用控制台反复验证“谁在调用、谁是 this”
- 对象的引用关系和函数的 `call/apply/bind` 是最容易混乱的地方，需要多练

### 构造函数

#### 为什么需要构造函数

对象字面量适合创建少量对象：

```js
const p1 = { name: "小明", age: 18 };
const p2 = { name: "小红", age: 20 };
const p3 = { name: "小刚", age: 22 };
```

但如果要批量创建很多结构相同、数据不同的对象，这种写法会不断重复

构造函数的作用，就是像“模具”一样批量创建同一类对象

#### 构造函数的基本写法

构造函数本质上也是普通函数，只是它的用途是创建对象。按照约定，构造函数名通常首字母大写：

```js
function Person() {
  this.name = "默认名字";
  this.age = 0;
}
```

创建对象时要配合 `new`：

```js
const p1 = new Person();
console.log(p1);
```

#### 带参数的构造函数

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

const p1 = new Person("小明", 18);
const p2 = new Person("小红", 17);
console.log(p1, p2);
```

这样就可以用同一个构造函数生产多个结构一致但内容不同的对象

#### new 背后做了什么

可以先把 `new Person()` 粗略理解成下面的过程：

```js
const obj = {};
Person.call(obj, "小明", 18);
// 返回 obj
```

当然，真正的 `new` 机制比这个更完整，还会处理原型链接和返回值规则，但入门阶段这样理解已经足够

#### 忘记写 new 的问题

如果构造函数调用时忘记写 `new`，就不会正确创建新对象：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

const p1 = Person("小明", 18);
console.log(p1); // undefined
```

这时还可能产生严重副作用：

- 在非严格模式下，`this` 可能错误指向全局对象
- 导致意外污染全局变量

所以只要是构造函数调用，就必须确认前面有 `new`

#### 构造函数中的方法

构造函数里当然也可以定义方法：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
  this.say = function () {
    console.log(`我叫${this.name}`);
  };
}

const p1 = new Person("小明", 18);
p1.say();
```

#### 这种写法的隐患

这种写法能用，但有一个问题：每创建一个实例，都会重新创建一个新的函数对象

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
  this.say = function () {
    console.log(`我叫${this.name}`);
  };
}

const p1 = new Person("小明", 18);
const p2 = new Person("小红", 17);
console.log(p1.say === p2.say); // false
```

虽然两个 `say` 的功能一样，但它们不是同一个函数对象。实例一多，就会产生额外的内存浪费

解决这个问题的标准方式，就是把公共方法放到原型对象上

### 原型链

#### prototype 是什么

在 JavaScript 中，每个函数天生都带有一个 `prototype` 属性，这个属性指向一个对象，我们把它称为原型对象

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

console.log(Person.prototype);
```

#### constructor 属性

原型对象上默认有一个 `constructor` 属性，它会指回构造函数本身：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

console.log(Person.prototype.constructor === Person); // true
```

可以先记住这层关系：

- 构造函数有 `prototype`
- 原型对象有 `constructor`

#### 原型对象用来存什么

构造函数更适合存放“对象自己独有的数据”

原型对象更适合存放“所有实例共享的内容”，比如公共属性、公共方法

例如：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.gender = "男";

const person = new Person("小明", 18);
console.log(person.gender);
```

这里 `gender` 并不在 `person` 自身上，而是在它的原型对象上

#### 共享属性

原型上的内容是所有实例共享的：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.gender = { key: 666 };

const p1 = new Person("小明", 18);
const p2 = new Person("小红", 17);

p1.gender.key = 999;
console.log(p2.gender);
```

这里 `p2.gender.key` 也会变成 `999`，因为它们访问的是同一个原型对象上的同一个属性值

#### 遮蔽效应

如果给实例本身重新赋一个同名属性，并不会修改原型上的值，而是会在实例自己身上创建一个新属性：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.gender = "男";

const p1 = new Person("小明", 18);
const p2 = new Person("小红", 17);

p1.gender = "Hello";
console.log(p1.gender); // Hello
console.log(p2.gender); // 男
```

这就是属性遮蔽

#### 用原型共享方法

把公共方法放到原型上，是构造函数配合原型最典型的用法：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

Person.prototype.say = function () {
  console.log(`我的名字是 ${this.name}`);
};

const p1 = new Person("小明", 18);
const p2 = new Person("小红", 17);

console.log(p1.say === p2.say); // true
```

这样所有实例共享同一个 `say` 函数对象

#### **proto** 与 [[Prototype]]

每个普通对象内部都有关联原型的隐藏链接，规范层面通常写作 `[[Prototype]]`

在很多运行环境中，可以通过 `__proto__` 访问到它：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

const p = new Person("小明", 18);
console.log(p.__proto__ === Person.prototype); // true
```

不过要注意：

- `__proto__` 更偏历史兼容写法
- 实际开发里更推荐用 `Object.getPrototypeOf()`

例如：

```js
console.log(Object.getPrototypeOf(p) === Person.prototype); // true
```

#### 原型对象也有原型

原型对象自己也不是终点，它也会继续向上连接：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}

console.log(Object.getPrototypeOf(Person.prototype) === Object.prototype); // true
console.log(Object.getPrototypeOf(Object.prototype)); // null
```

正常对象的原型链顶端通常就是 `Object.prototype`，再往上就是 `null`

#### 属性查找规则

当你访问 `obj.xxx` 时，JavaScript 会按这个顺序查找：

1. 先在对象自身找
2. 自身没有，就去它的原型对象找
3. 原型对象没有，就继续沿着原型链往上找
4. 找到 `null` 为止

如果最后还没找到：

- 读取属性时得到 `undefined`
- 调用不存在的方法时会报错
- 赋值时会在当前对象自身创建属性

这条“层层向上查找”的链路，就是原型链

### Object 方法

#### hasOwnProperty 与 in

`hasOwnProperty()` 用于判断某个属性是不是对象自己本身拥有的：

```js
const obj = { name: "小明", age: 18 };
console.log(obj.hasOwnProperty("name")); // true
console.log(obj.hasOwnProperty("gender")); // false
```

它不会去原型链上查找

如果要连原型链一起检查，可以用 `in`：

```js
const obj = { a: 1 };
Object.prototype.b = 2;

console.log("a" in obj); // true
console.log("b" in obj); // true
console.log(obj.hasOwnProperty("a")); // true
console.log(obj.hasOwnProperty("b")); // false
```

#### Object.hasOwn

现代 JavaScript 里也可以直接使用 `Object.hasOwn()`：

```js
const obj = { name: "小明" };

console.log(Object.hasOwn(obj, "toString")); // false
console.log(Object.hasOwn(obj, "name")); // true
```

它和 `hasOwnProperty()` 的目标一样，只是调用方式更直接

#### propertyIsEnumerable

`propertyIsEnumerable()` 用于判断属性是否是对象自己的属性，并且是否可枚举：

```js
const obj = { age: 18 };
console.log(obj.propertyIsEnumerable("age"));
```

这个方法实际使用频率不高，了解即可

#### isPrototypeOf

`isPrototypeOf()` 用于判断某个对象是否出现在另一个对象的原型链上：

```js
function Person(name) {
  this.name = name;
}

const person = new Person("小红");

console.log(Object.prototype.isPrototypeOf(person)); // true
console.log(Person.prototype.isPrototypeOf(person)); // true
```

#### Object.keys

`Object.keys()` 获取对象自身所有可枚举的字符串属性名：

```js
const person = {
  name: "小明",
  age: 18,
};

const keys = Object.keys(person);
console.log(keys);
```

#### Object.getOwnPropertyNames 与 Object.getOwnPropertySymbols

`Object.getOwnPropertyNames()` 可以获取对象自身所有字符串属性名，包括不可枚举属性

```js
const obj = { name: "小明" };
console.log(Object.getOwnPropertyNames(obj));
```

如果是符号属性，要用 `Object.getOwnPropertySymbols()`：

```js
const obj = {};
const s = Symbol();
obj[s] = "秘密";

console.log(Object.getOwnPropertySymbols(obj));
```

#### Object.values 与 Object.entries

获取所有值：

```js
const person = {
  name: "小明",
  age: 18,
};

console.log(Object.values(person));
```

获取所有键值对：

```js
const entries = Object.entries(person);
console.log(entries);
```

还可以使用 `Object.fromEntries()` 把键值对重新转回对象：

```js
const obj = Object.fromEntries(entries);
console.log(obj);
```

#### Object.assign

`Object.assign()` 用于把一个或多个源对象的属性复制到目标对象：

```js
const target = {};
const obj = { name: "小明" };
const person = { age: 18 };

Object.assign(target, obj, person);
console.log(target);
```

需要特别注意：

- 后面的同名属性会覆盖前面的
- 它是浅拷贝，不是深拷贝

#### Object.is

`Object.is()` 用于更精确地判断两个值是否相同：

```js
console.log(Object.is(NaN, NaN)); // true
console.log(NaN === NaN); // false
```

```js
console.log(Object.is(+0, -0)); // false
console.log(+0 === -0); // true
```

大多数场景下 `===` 已经够用，但 `Object.is()` 在处理特殊值时更准确

#### freeze、seal 与 preventExtensions

冻结对象：

```js
const obj = { name: "小明" };

Object.freeze(obj);
obj.name = "你干嘛";

console.log(Object.isFrozen(obj)); // true
console.log(obj);
```

`Object.freeze()` 之后：

- 不能改
- 不能删
- 不能加

密封对象：

```js
const obj = { name: "小明", age: 18 };

Object.seal(obj);
obj.name = "哎哟";
delete obj.age;
obj.key = "新属性";

console.log(Object.isSealed(obj)); // true
console.log(obj);
```

`Object.seal()` 之后：

- 可以改已有属性
- 不能删
- 不能加

阻止扩展：

```js
const obj = { name: "小明", age: 18 };

Object.preventExtensions(obj);
obj.name = "知识学爆";
delete obj.age;
obj.key = "新属性";

console.log(Object.isExtensible(obj)); // false
console.log(obj);
```

`Object.preventExtensions()` 之后：

- 可以改
- 可以删
- 不能加

#### Object.create

`Object.create()` 可以基于指定原型对象创建新对象：

```js
const obj = Object.create(Object.prototype);
console.log(obj);
console.log(Object.getPrototypeOf(obj) === Object.prototype); // true
```

也可以创建一个没有原型的对象：

```js
const obj = Object.create(null);
console.log(obj);
console.log(Object.getPrototypeOf(obj)); // null
```

这种对象没有原型链上的默认方法：

```js
const obj = Object.create(null);
// obj.toString(); // 报错
```

### 对象属性进阶（选学）

#### Object.defineProperty

除了直接赋值创建属性外，也可以使用 `Object.defineProperty()` 更细致地定义属性：

```js
const obj = {
  name: "小明",
  age: 18,
};

Object.defineProperty(obj, "key", {
  value: "初始值",
});

console.log(obj);
```

#### 属性描述符

属性描述符中最常见的几个配置项有：

- `value`
- `enumerable`
- `writable`
- `configurable`

例如：

```js
const obj = {};

Object.defineProperty(obj, "key", {
  value: "初始值",
  enumerable: false,
  writable: false,
  configurable: false,
});

obj.key = 666;
console.log(obj.key);
```

含义如下：

- `enumerable: false`：遍历时看不到
- `writable: false`：只读
- `configurable: false`：不能删，也不能重新定义配置

#### 获取属性描述符

可以通过 `Object.getOwnPropertyDescriptor()` 读取某个属性的描述信息：

```js
const obj = { name: "小明" };
const descriptor = Object.getOwnPropertyDescriptor(obj, "name");
console.log(descriptor);
```

如果想一次拿多个属性描述符，可以使用：

- `Object.defineProperties()`
- `Object.getOwnPropertyDescriptors()`

#### getter 和 setter

属性还可以通过 `get` / `set` 自定义“读取行为”和“写入行为”：

```js
const obj = {};

Object.defineProperty(obj, "key", {
  get() {
    return "结果: " + this._key;
  },
  set(value) {
    this._key = value * value;
  },
});

obj.key = 5;
console.log(obj.key);
```

这里真正存数据的是 `_key`，而 `key` 变成了一个“受控属性”

#### getter/setter 的限制

如果一个属性使用了 `get` / `set`，那么它就不应该再和 `value`、`writable` 混用

另外，不要在 `set` 里再次给自己赋值：

```js
const obj = {};

Object.defineProperty(obj, "key", {
  set(value) {
    this.key = value;
  },
});
```

这会导致递归调用，最终栈溢出

### 类型判断

#### typeof 的局限

`typeof` 对基本类型判断很好用：

```js
console.log(typeof 10); // "number"
console.log(typeof "hello"); // "string"
console.log(typeof true); // "boolean"
console.log(typeof undefined); // "undefined"
console.log(typeof {}); // "object"
```

但一到对象细分类型，`typeof` 就不够用了

```js
function Student(name) {
  this.name = name;
}

function Phone(id) {
  this.id = id;
}

console.log(typeof new Student("小明")); // "object"
console.log(typeof new Phone("iPhone 17")); // "object"
```

#### instanceof

这时可以用 `instanceof`：

```js
对象 instanceof 构造函数;
```

例如：

```js
function Student(name) {
  this.name = name;
}

function Phone(id) {
  this.id = id;
}

const student = new Student("小明");

console.log(student instanceof Student); // true
console.log(student instanceof Object); // true
console.log(student instanceof Phone); // false
```

它判断的本质可以简单理解为：

右侧构造函数的 `prototype`，是否出现在左侧对象的原型链上

#### Symbol.hasInstance

从机制层面看，`instanceof` 的行为和构造函数上的 `Symbol.hasInstance` 有关：

```js
function Student(name) {
  this.name = name;
}

console.log(Student[Symbol.hasInstance]);
```

这部分属于更底层的实现细节，知道它存在即可

### 包装对象

#### 什么是包装对象

JavaScript 中有三种常见包装对象：

- `Number`
- `String`
- `Boolean`

它们的意义是：把基本类型临时包装成对象，从而让基本类型也能调用属性和方法

#### 数字包装对象

普通数字是基本类型：

```js
const n1 = 10;
```

也可以显式创建数字包装对象：

```js
const n2 = new Number(10);
const n3 = new Number("10");
const n4 = Number("10");

console.log(typeof n2); // "object"
console.log(typeof n4); // "number"
```

注意：

- `new Number(10)` 得到的是对象
- `Number(10)` 得到的是普通数字

#### 常用实例方法

保留小数位：

```js
const n = 6.666;
console.log(n.toFixed(1));
```

转成指定进制字符串：

```js
const n = 17;
console.log(n.toString(2));
```

本地化显示：

```js
const n = 10000000;
console.log(n.toLocaleString());
```

货币格式：

```js
const n = 10000000;
console.log(n.toLocaleString("zh-CN", { style: "currency", currency: "CNY" }));
```

科学计数法：

```js
const n = 660000000;
console.log(n.toExponential());
```

精度控制：

```js
const n = 6.666666;
console.log(n.toPrecision(4));
```

#### 自动装箱

实际开发中，通常不需要手动 `new Number()`，因为 JavaScript 会在必要时自动完成临时包装：

```js
const n = 660000000;
console.log(n.toLocaleString());
```

这就是自动装箱

#### Number 的静态方法和属性

常见静态方法：

```js
const n = 66;
console.log(Number.isNaN(n));
console.log(Number.isInteger(n));
console.log(Number.isFinite(n));
```

常见静态属性：

```js
console.log(Number.MAX_VALUE);
console.log(Number.MIN_VALUE);
console.log(Number.MAX_SAFE_INTEGER);
console.log(Number.MIN_SAFE_INTEGER);
```

判断是否为安全整数：

```js
console.log(Number.isSafeInteger(9007199254740991));
console.log(Number.isSafeInteger(9007199254740992));
```

浮点误差相关：

```js
console.log(0.1 + 0.2 < 0.3 + Number.EPSILON);
```

字符串转数字：

```js
console.log(Number.parseFloat("1.234"));
console.log(Number.parseInt("12.5"));
```

### BigInt 大整数

#### 为什么需要 BigInt

普通 `number` 存在最大安全整数限制：

```js
const n = 9007199254740991;
console.log(n + 1);
console.log(n + 2);
```

超过安全范围后，整数计算可能丢失精度

为了解决这个问题，ES2020 引入了 `BigInt`

#### 创建 BigInt

最常见写法是在整数后面加 `n`：

```js
const a = 123n;
const b = 900719925474099199999n;
```

也可以用 `BigInt()` 转换：

```js
const a = BigInt(123);
const b = BigInt("900719925474099199999");
```

#### BigInt 的运算规则

`BigInt` 只能和 `BigInt` 一起做算术运算：

```js
const a = 11n;
const b = 2n;
const c = 6;

console.log(a + b);
// console.log(a + c); // 报错
```

不过可以比较大小：

```js
console.log(c > a);
console.log(10n === 10); // false
console.log(10n == 10); // true
```

如果要混合运算，就必须先显式转换：

```js
const a = 11n;
const b = 2;

console.log(a + BigInt(b));
console.log(Number(a) + b);
```

#### BigInt 的常见方法

```js
const a = 11n;

console.log(a.toString(2));
console.log(a.toLocaleString());
```

#### BigInt.asIntN 与 BigInt.asUintN

这两个静态方法可以把一个 `BigInt` 按指定比特位截断：

```js
console.log(BigInt.asIntN(4, 28n)); // -4n
console.log(BigInt.asUintN(4, 28n)); // 12n
```

注意：

- 它们返回的仍然是 `BigInt`
- `asIntN` 按有符号整数处理
- `asUintN` 按无符号整数处理

#### BigInt 的使用建议

虽然 `BigInt` 能表示非常大的整数，但日常业务开发里依然应优先使用 `number`，原因包括：

- 很多工具函数默认围绕 `number` 设计
- 混合运算必须手动转换
- 使用成本更高
- `JSON` 默认不支持 `BigInt`

### 对象与高级类型阶段小结

#### 需要掌握的重点

- 构造函数用于批量创建结构一致的对象，调用时必须配合 `new`
- 原型对象适合存放所有实例共享的属性和方法
- 原型链决定了对象访问属性时的查找路径
- `Object` 提供了大量和属性、冻结、拷贝、原型相关的工具方法
- `typeof` 适合判断基本类型，`instanceof` 更适合细分引用类型
- 包装对象让基本类型可以临时像对象一样工作
- `BigInt` 用来解决超大整数精度问题，但日常场景不应滥用

#### 学习建议

- 构造函数和原型链一定要自己画图理解，不要只背文字定义
- 把“实例自己的属性”和“原型共享的属性”分开理解，这是关键
- `Object.assign()` 的浅拷贝、`instanceof` 的原型链判断、`BigInt` 的类型限制，都是高频考点和易错点

### 字符串包装对象

#### 字符串也会被临时包装

字符串本身是基本数据类型：

```js
const str = "hello";
console.log(typeof str); // "string"
```

JavaScript 在“需要的时候”会把字符串临时包装成 `String` 对象，因此我们可以直接调用很多字符串方法：

```js
const str = "Hello World";
console.log(str.length);
console.log(str.charAt(1));
```

虽然也可以手动创建包装对象：

```js
const str = new String("HelloWorld");
console.log(typeof str); // "object"
```

但实际开发中不建议这么做，直接使用基本类型字符串即可

#### length 属性

`length` 用于获取字符串长度：

```js
const str = "Hello World";
console.log(str.length);
```

字符串是不可变的，`length` 只是读取属性，不能拿来修改字符串长度

#### 获取字符

最经典的方法是 `charAt()`：

```js
const str = "Hello World";
console.log(str.charAt(1)); // "e"
```

ES2022 新增了 `at()`：

```js
const str = "Hello World";
console.log(str.at(0)); // "H"
console.log(str.at(-2)); // "l"
```

`at()` 的优势是支持负数索引

还可以通过方括号访问：

```js
const str = "Hello World";
console.log(str[2]); // "l"
```

但需要注意：字符串是不可变的，拿到字符后不能通过下标方式改回去

#### 获取字符码点

```js
const str = "Hello World";
console.log(str.charCodeAt(0));
```

这会返回指定位置字符对应的 UTF-16 编码值

#### 查找字符串

查找首次出现的位置：

```js
const str = "Hello World";
console.log(str.indexOf("e")); // 1
console.log(str.indexOf("World")); // 6
console.log(str.indexOf("k")); // -1
```

查找最后一次出现的位置：

```js
const str = "Hello World";
console.log(str.lastIndexOf("l")); // 9
```

如果只是判断是否包含某个子串，更推荐 `includes()`：

```js
const str = "javascript";
console.log(str.includes("script")); // true
console.log(str.includes("java")); // true
```

判断开头和结尾：

```js
const str = "hello.js";
console.log(str.startsWith("hello"));
console.log(str.endsWith(".js"));
```

#### 截取字符串

`substring()`：

```js
const str = "庆祝的酒为你开好，千万不要膨胀得太早";
console.log(str.substring(0, 8));
console.log(str.substring(9));
```

`slice()`：

```js
const str = "庆祝的酒为你开好，千万不要膨胀得太早";
console.log(str.slice(0, 8));
console.log(str.slice(9));
console.log(str.slice(9, -2));
console.log(str.slice(-4));
```

相比 `substring()`，`slice()` 更灵活，因为它支持负数索引。日常开发里更常用 `slice()`

#### 替换字符串

只替换第一个匹配项：

```js
const str = "Hello World";
console.log(str.replace("l", "x"));
console.log(str.replace("Hello", "Crazy"));
```

替换全部匹配项：

```js
const str = "Hello World";
console.log(str.replaceAll("l", "x"));
```

#### 去除和补齐空白

去除首尾空白：

```js
const str = "  hello  ";
console.log(str.trim());
```

也可以单独处理：

```js
const str = "  hello  ";
console.log(str.trimStart());
console.log(str.trimEnd());
```

补齐字符串长度：

```js
const str = "5";
console.log(str.padStart(3, "0")); // "005"
console.log(str.padEnd(3, "0")); // "500"
```

#### 大小写转换

```js
const str = "Hello";
console.log(str.toUpperCase());
console.log(str.toLowerCase());
```

#### 拆分、拼接和重复

拆分为数组：

```js
const str = "Hello World You Like This";
console.log(str.split(" "));
```

拼接字符串：

```js
const str1 = "全民制作人们";
const str2 = "大家好";

console.log(str1 + str2);
console.log(str1.concat(str2));
```

一般更推荐直接使用 `+` 或模板字符串

重复字符串：

```js
const str = "Hi";
console.log(str.repeat(4));
```

#### String 的静态方法

码点转字符：

```js
console.log(String.fromCodePoint(97));
console.log(String.fromCodePoint(97, 98, 99));
```

保持原始字符串格式：

```js
console.log("Hello\nWorld");
console.log(String.raw`Hello\nWorld`);
```

`String.raw()` 常和标签模板一起出现，日常业务里不算高频，知道作用即可

### 布尔包装对象

#### Boolean 包装对象

布尔基本类型只有两个值：

- `true`
- `false`

对应的包装对象是 `Boolean`：

```js
const b1 = new Boolean(true);
const b2 = new Boolean(false);
```

不过和 `Number`、`String` 一样，实际开发中也不建议手动 `new Boolean()`

#### valueOf

布尔包装对象最核心的方法是 `valueOf()`，它可以取出原始布尔值：

```js
const b = new Boolean(false);
console.log(b.valueOf()); // false
```

#### 最大陷阱

最容易出错的点是：

```js
const b = new Boolean(false);

if (b) {
  console.log("条件成立");
} else {
  console.log("条件不成立");
}
```

结果是“条件成立”

原因不是它内部包着 `false`，而是因为它本质上是对象，而对象在逻辑判断里属于真值

所以结论很明确：

- 基本布尔值可以直接参与判断
- `Boolean` 包装对象不要拿来做条件判断
- 实战中尽量避免手动 `new Boolean()`

### 数组

#### 数组是什么

数组可以理解为“按顺序存放多个数据的一组结构”

它也是对象的一种特殊形式，但比普通对象更适合表达列表型数据

#### 创建数组

最推荐的创建方式是字面量：

```js
const arr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
```

也可以使用构造函数：

```js
const arr1 = new Array(1, 2, 3);
const arr2 = new Array(5);
```

需要注意：

- `new Array(1, 2, 3)` 是包含三个元素的数组
- `new Array(5)` 是创建长度为 5 的空数组

因此实际开发里强烈推荐用 `[]`，更直观，不容易踩坑

#### 访问元素

通过下标访问：

```js
const arr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
console.log(arr[5]);
```

也可以使用 `at()`：

```js
const arr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
console.log(arr.at(5));
console.log(arr.at(-2));
```

#### 遍历数组

普通 `for`：

```js
const arr = [31, 28, 31];

for (let i = 0; i < arr.length; i++) {
  console.log(`${i + 1}月的天数有: ${arr[i]}`);
}
```

`for...of`：

```js
const arr = [31, 28, 31];

for (const num of arr) {
  console.log(num);
}
```

`forEach()`：

```js
const arr = [31, 28, 31];

arr.forEach(function (item, index, array) {
  console.log(index, item, array);
});
```

#### 越界访问

访问不存在的下标会得到 `undefined`：

```js
const arr = [1, 2, 3];
console.log(arr[12]);
```

可以用 `in` 判断某个下标是否真实存在：

```js
const arr = ["a", "b", "c"];
console.log(0 in arr); // true
console.log(3 in arr); // false
console.log("length" in arr); // true
```

#### 修改元素

```js
const arr = [31, 28, 31];
arr[1] = "Hello";
console.log(arr[1]);
```

如果给超出长度的位置赋值，数组会自动扩容：

```js
const arr = [];
arr[3] = "World";
console.log(arr);
console.log(arr.length); // 4
```

这里中间会出现空槽，也叫稀疏数组

#### length 属性

数组的 `length` 不只是只读信息，它还能直接改数组长度：

```js
const arr = [1, 2, 3, 4, 5, 6];
arr.length = 3;
console.log(arr);
```

这样会直接截断数组

#### fill

快速填充数组：

```js
const arr = [10, 20, 30];
arr.fill(666);
console.log(arr);
```

### 二维和多维数组

#### 二维数组

数组元素本身也可以是数组：

```js
const arr = [
  [1, 2],
  [3, 4],
  [5, 6],
];

console.log(arr);
```

访问二维数组元素需要多次下标：

```js
const arr = [
  [31, 29, 31],
  [31, 28, 31],
  [31, 28, 31],
];

console.log(arr[0]); // 第一行
console.log(arr[0][2]); // 第一行第三列
```

#### 多维数组

更高维的数组当然也可以存在：

```js
const arr = [
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [
    [6, 7, 8],
    [9, 10, 11],
  ],
];
```

不过日常业务开发里，二维数组最常见，更高维使用频率明显更低

### 添加和删除元素

#### push 和 pop

尾部添加：

```js
const arr = [1, 2, 3];
arr.push(4);
arr.push(5, 6, 7);
console.log(arr);
```

`push()` 会直接修改原数组，返回更新后的长度

尾部删除：

```js
const arr = [1, 2, 3];
const last = arr.pop();

console.log(arr);
console.log(last);
```

#### unshift 和 shift

头部添加：

```js
const arr = [2, 3];
arr.unshift(1);
arr.unshift(-1, 0);
console.log(arr);
```

头部删除：

```js
const arr = [1, 2, 3];
const first = arr.shift();

console.log(arr);
console.log(first);
```

可以这样记：

- `shift` 系列处理头部
- `pop` 系列处理尾部

#### delete 删除数组元素

`delete` 虽然也能“删”数组元素，但不推荐：

```js
const arr = [1, 2, 3, 4, 5];
delete arr[2];

console.log(arr);
console.log(arr.length); // 5
console.log(arr[2]); // undefined
```

它不会真正收缩数组长度，而是留下空槽，容易产生混乱

#### splice

`splice()` 是数组里的万能修改器，既能删，也能插，还能替换

删除元素：

```js
const arr = [1, 2, 3, 4];
const removed = arr.splice(1, 1);

console.log(arr);
console.log(removed);
```

插入或替换：

```js
const arr = [1, 2, 3, 4];
arr.splice(1, 1, "A", "B");
console.log(arr);
```

参数规则：

- 第一个参数：起始下标
- 第二个参数：删除数量
- 后续参数：要插入的新元素

#### toSpliced

如果不想修改原数组，可以使用 ES2023 的 `toSpliced()`：

```js
const arr = [1, 2, 3, 4];
console.log(arr.toSpliced(1, 1, "A", "B"));
console.log(arr);
```

#### with

ES2023 新增的 `with()` 用于返回一个“替换指定位置后”的新数组：

```js
const arr = [1, 2, 3, 4];
console.log(arr.with(2, "Hello"));
console.log(arr);
```

#### copyWithin

`copyWithin()` 会在数组内部复制一段数据并覆盖到另一个位置：

```js
const arr = [1, 2, 3, 4];
arr.copyWithin(2, 0, 2);
console.log(arr);
```

它会修改原数组，但不会改变数组长度

### 数组的查找

#### indexOf 和 lastIndexOf

从前往后查找：

```js
const arr = [10, 20, 30, 20, 40];
console.log(arr.indexOf(20)); // 1
console.log(arr.indexOf("20")); // -1
```

从后往前查找：

```js
const arr = [10, 20, 30, 20, 40];
console.log(arr.lastIndexOf(20)); // 3
```

它们使用严格相等比较

#### find 和 findIndex

按自定义条件查找第一个元素：

```js
const arr = [10, 25, 30, 5];

const result = arr.find(function (item) {
  return item > 20;
});

console.log(result);
```

如果想得到下标，用 `findIndex()`：

```js
const arr = [10, 25, 30, 5];

const index = arr.findIndex(function (item) {
  return item > 20;
});

console.log(index);
```

#### includes

判断数组是否包含某元素：

```js
const arr = [10, 20, 30];

console.log(arr.includes(20));
console.log(arr.includes(99));
console.log(arr.includes(20, 2));
```

一个重要区别：

```js
console.log([NaN].indexOf(NaN)); // -1
console.log([NaN].includes(NaN)); // true
```

如果只是判断“有没有”，实际开发里更推荐 `includes()`

#### every 和 some

所有元素都满足条件：

```js
const arr = [10, 20, 30];

console.log(
  arr.every(function (item) {
    return item > 0;
  }),
);
```

至少一个元素满足条件：

```js
const arr = [10, 20, 30];

console.log(
  arr.some(function (item) {
    return item >= 20;
  }),
);
```

### 数组的排序

#### sort

默认排序按字符串顺序处理：

```js
const arr = [1, 5, 2, 7, 3, 8, 0];
arr.sort();
console.log(arr);
```

数字排序一般都要传比较函数：

```js
const arr = [1, 5, 2, 7, 3, 8, 0];

arr.sort(function (a, b) {
  return a - b;
});

console.log(arr);
```

需要注意比较函数规则：

- 返回负数：`a` 排前面
- 返回正数：`b` 排前面
- 返回 `0`：保持相对顺序

倒序可以写成：

```js
const arr = [1, 5, 2, 7, 3, 8, 0];

arr.sort(function (a, b) {
  return b - a;
});

console.log(arr);
```

#### toSorted

如果不想修改原数组，可以使用 `toSorted()`：

```js
const arr = [1, 5, 2];
const newArr = arr.toSorted((a, b) => a - b);

console.log(newArr);
console.log(arr);
```

#### reverse 和 toReversed

反转原数组：

```js
const arr = [1, 2, 3, 4];
arr.reverse();
console.log(arr);
```

返回新数组但不改原数组：

```js
const arr = [1, 2, 3, 4];
console.log(arr.toReversed());
console.log(arr);
```

### 数组的拼接与截取

#### concat

合并数组：

```js
const arr1 = [1, 2];
const arr2 = [3, 4];

const newArr = arr1.concat(arr2);
console.log(newArr);
```

`concat()` 返回新数组，不改原数组

#### join

把数组拼成字符串：

```js
const arr = [1, 5, 2, 7, 3, 8, 0];

console.log(arr.join());
console.log(arr.join(""));
console.log(arr.join("-"));
```

#### slice

截取数组片段：

```js
const arr = [10, 20, 30, 40, 50];
const newArr = arr.slice(1, 4);

console.log(newArr);
```

它支持负数索引，并且不会修改原数组

#### Object.groupBy

`Object.groupBy()` 可以根据规则把数组分组到对象中：

```js
const inventory = ["AAA", "AA", "BBBB", "BB", "CCC"];

const result = Object.groupBy(inventory, function (item) {
  return item.length;
});

console.log(result);
```

这在“按某种规则分类数组元素”时非常方便

### 数组的函数式方法

#### map

`map()` 的作用是把数组中的每一项映射成新值，并返回一个新数组：

```js
let arr = [10, 20, 30, 40, 50];

arr = arr.map(function (value) {
  return value + "";
});

console.log(arr);
```

#### flat

`flat()` 用于展平嵌套数组：

```js
const arr = [1, [2, 3], 4];
console.log(arr.flat());
```

支持指定展开层数：

```js
const arr = [1, [2, [3, [4]]]];
console.log(arr.flat(2));
console.log(arr.flat(Infinity));
```

#### flatMap

`flatMap()` 可以理解为先 `map()`，再做一层 `flat(1)`：

```js
const arr = [
  { a: 1, b: 2 },
  { c: 3, d: 4 },
];

console.log(
  arr.flatMap(function (value) {
    return Object.keys(value);
  }),
);
```

#### filter

按条件过滤元素：

```js
const arr = [10, 20, 30, 40, 50];

const result = arr.filter(function (element) {
  return element > 20;
});

console.log(result);
```

#### reduce

`reduce()` 是最强大也最容易绕晕的数组方法之一。它的核心思想是：把一组数据逐步累积成一个结果

基本格式：

```js
arr.reduce(function (acc, cur, index, array) {
  return 新的累计值;
}, 初始值);
```

计算总和：

```js
const arr = [1, 2, 3, 4];

const sum = arr.reduce(function (acc, cur) {
  return acc + cur;
}, 0);

console.log(sum);
```

执行过程可以理解为：

```text
acc = 0
acc = 0 + 1
acc = 1 + 2
acc = 3 + 3
acc = 6 + 4
```

#### Array.isArray

判断一个值是不是数组：

```js
const arr = [1, 2, 3, 4];
console.log(Array.isArray(arr));
console.log(Array.isArray({}));
```

### 类型数组（选学）

#### 什么是类型数组

普通数组非常灵活，什么类型都能装：

```js
const arr = [1, "hello", true, {}, []];
```

而类型数组更接近强类型语言中的定长数值数组：

- 元素类型固定
- 每个元素占用固定字节
- 内存连续
- 更适合处理二进制数据和高性能场景

#### 常见类型数组

常见的类型数组包括：

- `Int8Array`
- `Uint8Array`
- `Int16Array`
- `Uint16Array`
- `Int32Array`
- `Uint32Array`
- `Float32Array`
- `Float64Array`

#### 创建类型数组

```js
const arr = new Int8Array(5);
console.log(arr);
```

它不能用 `[]` 字面量创建

#### 固定类型带来的结果

```js
const arr = new Int8Array(5);
arr[0] = 255;
console.log(arr);
```

由于 `Int8Array` 只能存 8 位有符号整数，因此超出范围的值会被截断处理

#### ArrayBuffer

类型数组背后依赖的是 `ArrayBuffer`，它可以看作原始内存块：

```js
const buffer = new ArrayBuffer(8);
console.log(buffer);
```

`ArrayBuffer` 本身不能直接操作，要通过视图来读写，比如各种 TypedArray

可以简单理解为：

- `ArrayBuffer`：内存块
- `TypedArray`：读写这个内存块的视图

这类内容在日常业务开发中不算高频，了解其定位即可

### 本章练习

#### 编程练习

可以尝试完成下面几题：

1. 统计数组中不同元素的出现次数。例如 `["a", "b", "a", "c", "b", "a"]` 最终得到各元素出现频次
2. 实现二分搜索：给定升序数组和目标值，返回目标下标，找不到返回 `-1`
3. 力扣“爬楼梯”问题
4. 力扣“有效的括号”问题

#### 选择题精选

1. 下列关于函数的说法，正确的是？
   A. 函数必须先声明才能调用
   B. 函数调用时，形参和实参类型必须一致
   C. 函数可以没有返回值
   D. 函数只能在声明位置之后使用

2. 关于 `return` 的描述，错误的是？
   A. `return` 可以返回任意类型的数据
   B. `return` 会结束函数的执行
   C. 一个函数必须写 `return`
   D. 没有 `return` 时默认返回 `undefined`

3. 执行下面代码，输出结果是？

```js
function test(a) {
  console.log(a);
}
test();
```

A. 报错
B. `null`
C. `undefined`
D. `0`

4. 下面哪一项是递归函数必须具备的条件？
   A. 必须有循环语句
   B. 必须有返回值
   C. 必须有递归出口
   D. 必须调用其他函数

5. 执行下面代码，输出结果是？

```js
function test() {
  for (let i = 0; i < 5; i++) {
    if (i === 3) return;
    console.log(i);
  }
}
test();
```

A. `0 1 2 3`
B. `0 1 2`
C. `1 2 3`
D. `0 1 2 3 4`

6. 下列哪种方式可以正确创建一个对象？
   A. `const obj = ()`
   B. `const obj = []`
   C. `const obj = {}`
   D. `const obj = new Object[]`

7. 访问对象中属性名包含特殊字符的属性，必须使用？
   A. 点运算符
   B. 方括号
   C. `typeof`
   D. `delete`

8. 访问一个对象中不存在的属性时，返回值是？
   A. `null`
   B. `false`
   C. 报错
   D. `undefined`

9. 关于 `delete` 删除对象属性的说法，正确的是？
   A. `delete` 会删除变量
   B. `delete` 不会影响性能
   C. `delete` 会破坏对象结构优化
   D. `delete` 删除失败会报错

10. 关于对象方法中 `this` 的指向，正确的是？
    A. `this` 永远指向函数定义的位置
    B. `this` 永远指向 `window`
    C. `this` 由函数调用方式决定
    D. `this` 不能出现在对象方法中

11. 执行下面代码，输出结果是？

```js
const person = {
  name: "小明",
  say() {
    console.log(this.name);
  },
};
const fn = person.say;
fn();
```

A. 小明
B. `undefined`
C. 报错
D. `person`

12. 下列哪种方式可以修正上题中的 `this` 指向？
    A. `fn()`
    B. `fn.call(person)`
    C. `fn.bind()`
    D. `person.say()`

13. 关于 `Symbol` 的描述，错误的是？
    A. `Symbol` 是基本数据类型
    B. `Symbol` 可以作为对象属性名
    C. `Symbol.for` 每次都会创建新 Symbol
    D. `Symbol` 可以避免属性名冲突

14. 关于基本类型和引用类型的区别，正确的是？
    A. 引用类型存储的是值本身
    B. 基本类型存储的是引用
    C. 引用类型比较的是地址
    D. 基本类型存储在堆内存

15. 执行下面代码，输出结果是？

```js
const a = { x: 1 };
const b = a;
b.x = 2;
console.log(a.x);
```

A. `1`
B. `2`
C. `undefined`
D. 报错

16. 对象参与隐式类型转换时，优先级最高的是？
    A. `toString`
    B. `valueOf`
    C. `constructor`
    D. `Symbol.toPrimitive`

17. 下列哪一项不是函数的特点？
    A. 可以作为参数传递
    B. 可以作为返回值
    C. 不能拥有属性
    D. `typeof` 结果为 `function`

18. `function sum(a, b) {}` 中，`sum.length` 的值是？
    A. `0`
    B. `1`
    C. `2`
    D. `undefined`

19. 关于构造函数的说法，错误的是？
    A. 构造函数本质是普通函数
    B. 构造函数必须有 `return`
    C. 构造函数一般首字母大写
    D. `new` 会创建新对象

20. 关于原型对象的描述，正确的是？
    A. `prototype` 只存在于对象上
    B. `prototype` 用来存放私有属性
    C. `prototype` 中的属性可被实例共享
    D. `prototype` 与构造函数无关

### 全章小结

#### 需要掌握的重点

- 字符串和布尔值虽然是基本类型，但在需要时会发生自动装箱
- 不建议手动创建 `String`、`Boolean` 包装对象，尤其不要使用 `new Boolean(false)` 做判断
- 数组是最重要的列表结构，必须熟悉创建、访问、遍历、增删改查和排序操作
- `splice`、`map`、`filter`、`reduce`、`sort`、`find`、`includes` 是高频数组方法
- `delete` 不适合删除数组元素，它会制造空槽
- 类型数组用于高性能二进制数据处理，普通业务场景了解即可

#### 学习建议

- 数组方法不要靠背，直接在控制台写 5 到 10 组小例子验证
- 重点分清哪些方法会修改原数组，哪些方法会返回新数组
- `reduce`、`sort`、`splice` 是最容易混乱的三个点，建议单独练熟
