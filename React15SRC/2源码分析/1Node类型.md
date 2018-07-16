# 1 Virtual DOM模型
Vitual DOM对于React来说，就像是一个虚拟空间，React的所有工作几乎都在Virutal DOM中完成。其中，Virtual DOM模型负责Virtual DOM底层框架的构造工作，它拥有一套完整的Virtual DOM标签，并且负责虚拟节点及其属性的构建、更新、删除等工作。那么，Virual DOM模型到底是如何构建虚拟节点的，如何更新节点属性的呢？
其实构建一套简易的Virtual DOM把你给不复杂，只需要具备DOM标签的基本元素就行：
- 标签名
- 节点属性(样式，属性，事件)
- 子节点
- 标识id
```javascript
{
    tagName: 'div', // 标签名
    properties: { // 属性
        style: {} 
    }, 
    children: [], // 子节点
    key: 1 // 唯一标识
}
```
Virtual DOM中的节点称为ReactNode,在react15版本中的类型如下。
- ReactElement(最终是ReactCompositeComponent || ReactDOMComponent)
- ReactFragment(null | void | boolean || Iterable<ReactNode>)
- ReactText(string || number)
- ReactCoroutine
- ReactYield
```javascript
export type ReactNode = ReactElement<any> | ReactCoroutine | ReactYield | ReactText | ReactFragment;
export type ReactText = string | number;
export type ReactFragment = ReactEmpty | Iterable<ReactNode>;
export type ReactEmpty = null | void | boolean;

// ReactElement类型
export type ReactElement = {
  $$typeof: any, // 这个标签允许我们唯一标识这是一个React元素
  type: any, // 该元素的内置属性
  key: any, // 该元素的内置属性
  ref: any, // 该元素的内置属性
  props: any, // 该元素的内置属性
  _owner: ReactInstance, // 记录负责创建此元素的组件。

  // __DEV__
  // 验证标志当前使变化的，我们将它放入到外部的store,因此我们能冻结整个对象。一旦它们在常用的开发环境中实现，就可以用WeakMap代替。
  _store: {
    validated: boolean,
  },
  // 临时帮助检测对象，检测this和owner不同的情况，我们会发出警告。我们想摆脱owner，使用箭头函数替换ref。只要`this`和owner是一样的，行为就不会发生变化
  _self: ReactElement,
  _shadowChildren: any,
  // 表示文件名，行号和/或其他信息的注释对象（由转译器或其他方式添加）。
  _source: Source,
};
export type ReactCoroutine = {
  $$typeof: Symbol | number,
  key: null | string,
  children: any,
  // This should be a more specific CoroutineHandler
  handler: (props: any, yields: Array<ReifiedYield>) => ReactNodeList,
  props: mixed,
};
type ReifiedYield = { continuation: Object, props: Object };
export type ReactYield = {
  $$typeof: Symbol | number,
  key: null | string,
  props: Object,
  continuation: mixed
};
export type ReactInstance = {
  // ReactCompositeComponent
  mountComponent: any,
  performInitialMountWithErrorHandling: any,
  performInitialMount: any,
  getHostNode: any,
  unmountComponent: any,
  receiveComponent: any,
  performUpdateIfNecessary: any,
  updateComponent: any,
  attachRef: (ref: string, component: ReactInstance) => void,
  detachRef: (ref: string) => void,
  getName: () => string,
  getPublicInstance: any,
  _rootNodeID: number,

  // ReactDOMComponent
  _tag: string,

  // instantiateReactComponent
  _mountIndex: number,
  _mountImage: any,
  // __DEV__
  _debugID: DebugID,
  _warnedAboutRefsInRender: boolean,
}
```