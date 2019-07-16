# Mini-React

React 简易版实现

安装依赖：npm i

运行：npm start

## React.render

负责调度整个流程

## React.createElement

生成一个Element类型的实例对象（virtual-dom）

## Element类

生成virtual-dom，实际是一个js对象，包含type，props属性。

type：要渲染的元素类型信息

- 字符串，数值
- 原生dom节点
- 自定义组件

props：包含元素属性信息，以及子节点信息

## createUnit

工厂方法，根据需要渲染的Element类型实例对象，实例化对应的Unit对象。

## Unit类

基类封装公用的属性以及方法，具体的渲染，更新操作交由子类实现

## TextUnit类

继承Unit类，负责字符串，数值类型元素的渲染，以及更新操作

## NativeUnit类

继承Unit类，负责原生dom节点的渲染，以及更新操作，dom-diff算法的实现

## CompositeUnit类

继承Unit类，负责自定义组件的渲染，CompositeUnit会基于TextUnit类，NativeUnit类实现渲染以及更新

## 实现

- React.render 负责调度整个流程
- React.createElement 生成一个Element类型的实例对象（virtual-dom）
- 调用 createUnit方法 生成一个对应Unit 类型的实例对象（子类实现具体的渲染以及更新操作）
- 再调用对象的 getMarkUp 返回 dom字符串，最后再写到 container 节点中
- 首次渲染时使用批处理 一次性将dom节点对应的字符串插入页面 优化渲染性能
- 后面更新 会调用dom-diff算法直接操作对应的节点

## Virtual DOM 算法

算法实现

- 步骤一：用JS对象模拟DOM树1，并根据DOM树1构建一个对应的DOM树字符串，批处理插入到页面
- 步骤二：当状态变更的时候，重新构造一棵新DOM树2。深度优先遍历，比较DOM树1和DOM树2，记录两棵树差异
- 步骤三：把差异应用到真正的DOM树上

diff 策略

- Web UI 中 DOM 节点跨层级的移动操作特别少，可以忽略不计。
- 拥有相同类的两个组件将会生成相似的树形结构，拥有不同类的两个组件将会生成不同的树形结构。
- 对于同一层级的一组子节点，它们可以通过唯一key进行区分
- React 对树的算法进行了优化，即对树进行分层比较，两棵树只会对同一层次的节点进行比较
  - 当出现节点跨层级移动时，并不会出现想象中的移动操作，而是将原节点删除，以原节点为根节点的树被整个重新创建
- 如果节点类型变化，删除原节点，以原节点为根节点的树被整个重新创建
- 如果是同一类型的组件，首先会比较props更新属性，然后递归处理子节点，记录差异，深度遍历完子节点，打补丁更新渲染
  - 删除老的没有使用的属性
  - 处理新的props 覆盖旧的prop或者添加新的prop
  - 当节点处于同一层级时，React diff 提供了三种节点操作,分别为：INSERT(插入)、MOVE(移动)和 REMOVE(删除)
    - INSERT 新的 component 类型不在老集合里， 即是全新的节点，需要对新节点执行插入操作
    - MOVE 在老集合有新 component 类型，就需要做移动操作，可以复用以前的 DOM 节点
    - REMOVE 老 component 不在新集合里的，也需要执行删除操作


