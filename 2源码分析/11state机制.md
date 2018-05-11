# 11 state机制
state 是React中重要的概念，React通过管理状态来实现对组件的管理。React通过this.state来访问state,通过this.setState来更新state。当this.setState()被调用的时候，React会重新调用render方法来重新渲染UI.

## 11.1 setState异步更新
state的值不能通过以下方式修改
```javascript
this.state.value = 1; // 错误的写法
```
setState通过一个队列机制实现state的更新，当执行setState时，会将需要更新的state合并后放入状态队列，而不会立即更新this.state.队列机制可以高效地批量更新state。如果不通过setState而直接修改this.state的值，那么该state将不会被放入状态队列中，当下次调用setState并对状态队列进行合并的时候，将会忽略之前直接被修改的值，而造成无法预知的错误。因此应该尽量使用setState方法来更新state.同时React也正是利用状态队列机制实现setState的一步更新，避免频繁重复更新state.
```javascript
// 将新的state合并到状态更新队列中
var nextState = this._processPendingState(nextProps, nextContext);
// 根据更新队列和shuldComponentUpdate的状态判断是否需要更新组件
var shouldUpdate = this._pendingForceUpdate || !inst.shouldComponentUpdate || inst.shouldComponentUpdate(nextProps, nextState, nextContent)
```
## 11.2 setState循环调用风险
- 当调用setState时，实际会执行enqueueSetState方法，并对partialState已经_pendingStateQueue更新队列进行合并操作。最终通过enqueueUpdate执行state更新。
- 而performUpdateIfNessary方法会获取_pendingElement, _pendingStaeQueue，_pendingFormUpdate，并调用receiveComponent和updateComponent进行组件更新。
- 如果在shouldComponentUpdate或componentWillUpdate方法中调用setState。此时this._pengdingStateQueue!=null。则performUpdateIfNessary方法就会调用updateComponent方法进行组件更新，但是updateComponent方法又会调用shouldComponentUpdate和componentWillUpdate方法，因此会造成循环调用。使得浏览器内存占满后崩溃。
![](/image/26.png)<br/>
[setState的源码](../3源码文件\isomorphic\modern\class\ReactComponent.js) 
```javascript
function ReactComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}
ReactComponent.prototype.setState = function(partialState, callback) {
    this.updater.enqueueSetState(this, partialState);
    if (callback) {
        this.updater.enqueueCallback(this, callback, 'setState');
    }
}
```
从构造函数中可以看出，this.updater对象默认是ReactNoopUpdateQueue。而每个组件在使用的实际是ReactUpdateQueue。从[ReactReconcileTransaction](../\3源码文件\renderers\dom\client\ReactReconcileTransaction.js)可以看出：
```javascript
getUpdateQueue: function() {
    return ReactUpdateQueue;
  },
```
而在[ReactCompositeComponent](../3源码文件\renderers\shared\stack\reconciler\ReactCompositeComponent.js)里面使用的都是该队列:
```javascript
mountComponent = function() {
    ...
    var updateQueue = transaction.getUpdateQueue();
}
```
因此我们需要看的是[ReactUpdateQueue](../\3源码文件\renderers\shared\stack\reconciler\ReactUpdateQueue.js)
```javascript
// 用于添加脏组件，并启动重绘
var ReactUpdates = require('ReactUpdates');

// 调用ReactUpdates.enqueueUpdate添加脏组件internalInstance，并重绘组
function enqueueUpdate(internalInstance) {
  ReactUpdates.enqueueUpdate(internalInstance);
}
// 用户自定义组件的setState
// 用于将更迭的state数据，推送到ReactCompositeCompnent实例internalInstance的_pendignStateQueue属性中。
// 以及调用reactUpdates.enqueueUpdate天去你家脏组件internalInstance并重绘组件
// 参数publicInstance为用户自定义组件ReactComponent实例  
// 参数partialState为state的部分重设值
enqueueSetState: function(publicInstance, partialState) {
// 获取ReactCompositeComponent实例，通过用户自定义组件实例publicInstance获得
var internalInstance = getInternalInstanceReadyForUpdate(
    publicInstance,
    'setState'
);
if (!internalInstance) {
    return;
}
// 将待更新的partialState添加到ReactCompositeComponent实例的_pendingStateQueue属性中  
var queue =internalInstance._pendingStateQueue || (internalInstance._pendingStateQueue = []);
queue.push(partialState);
// 添加脏组件internalInstance，并重绘组件  
enqueueUpdate(internalInstance);
},
```
## 11.3 setState调用栈
setState最终通过enqueueUpdate执行state更新。那么enqueueUpdate如何更新state的呢？
```javascript
import React, { Component } from 'react';
import PropTypes from 'prop-types';
class User extends Component {
    constructor(props) {
        super(props);
        this.state = {
            show: 0,
        };
    }
    componentDidMount() {
        this.setState({ show: this.state.show + 1});
        console.log(this.state.show);
        this.setState({ show: this.state.show + 1});
        console.log(this.state.show);
        setTimeout(() => {
            this.setState({ show: this.state.show + 1});
            console.log(this.state.show);

            this.setState({ show: this.state.show + 1});
            console.log(this.state.show);
        }, 0)
    }
    render() {
        let { num } = this.state;
        return (
            <p>{num}</p>
        );
    }
}
User.propTypes = propTypes;
export default User;
```
上面的例子最终的结果是： 0， 0 ， 2， 3。下面就来分析为什么。enqueueUpdate到底做了什么。
![](/image/27.png)<br/>
在ReactUpdates.enqueUpdate的代码如下：
```javascript
function enqueueUpdate(component) {
    ensureInjected();
    // 如果不处于批量更新模式
    if (batchingStrategy.isBatchingUpdates) {
        batchingStrategy.batchedUpdates(enqueueUpdate, component);
        return;
    }
    // 如果处理批量更新模式，则将该组件保存在dirtyComponents中
    dirtyComponents.push(component);
    ...
    component._updateBatchNumber = updateBatchNumber + 1;
}
```
如果isBatchingUpdates为true, 则对所有队列中的更新执行batchedUpdates方法。否则只是把当前组件(调用setState的组件)放入dirtyComponents中。例子中的4次setState调用的表现之所以不同，这里的逻辑起到了关键作用。
前两次setState的调用属于同一类，因为在同义词的调用栈中存在[会将其组件放入到dirtyComponents中]，不会立即更新组件。ReactUpdates是一个transaction，而它的initial 和close方法如下：
```javascript
// 组件更新前置钩子：将this.dirtyComponentsLength设置为dirtyComponent中脏组件的个数
// 组件更新后置钩子：重绘过程中添加脏组件，调用flushBatchedUpdates重绘添加的脏组件
var NESTED_UPDATES = {
  initialize: function() {
    this.dirtyComponentsLength = dirtyComponents.length;
  },
  close: function() {
    if (this.dirtyComponentsLength !== dirtyComponents.length) {
      // 在组件重绘过程中，再度添加脏组件，剔除dirtyComponents中已重绘的组件，调用flushBatchedUpdates重绘新添加的脏组件
      dirtyComponents.splice(0, this.dirtyComponentsLength);
      flushBatchedUpdates();
    } else {
      dirtyComponents.length = 0;
    }
  },
};
// 通过执行CallbackQueue回调函数队列机制，即this.callbackQueue
//  执行this.callbackQueue.enqueue(fn)注入组件更新完成后的回调callback，在runBatchedUpdates函数中实现  
// 通过Transaction添加前、后置钩子机制    
// 置钩子initialize方法用于清空回调队列；close用于触发组件更新完成后的回调callback
var UPDATE_QUEUEING = {
  initialize: function() {
    this.callbackQueue.reset();
  },
  close: function() {
    this.callbackQueue.notifyAll();
  },
};

```
flushBatchedUpdates()方法在close中调用了，而方法内部调用了runBatchedUpdates()方法，内部对脏组件进行了遍历，然后使用ReactReconciler.performUpdateIfNecessary()方法进行重绘。
```javascript
// 调用dirtyComponents中各组件的performUpdateIfNecessary以重绘该组件  
// 并将该组件更新完成的回调_pendingCallbacks添加到ReactUpdatesFlushTransaction后置钩子中 
function runBatchedUpdates(transaction) {
  var len = transaction.dirtyComponentsLength;
  // 以组件的挂载顺序排序 
  dirtyComponents.sort(mountOrderComparator);
  updateBatchNumber++;
  for (var i = 0; i < len; i++) {
    // 若组件尚未挂载，确保组件的performUpdateIfNecessary、_pendingCallbacks为空  
    var component = dirtyComponents[i];
    var callbacks = component._pendingCallbacks;
    component._pendingCallbacks = null;
    var markerName;
    if (ReactFeatureFlags.logTopLevelRenders) {
      var namedComponent = component;
      // Duck type TopLevelWrapper. This is probably always true.
      if (component._currentElement.type.isReactTopLevelWrapper) {
        namedComponent = component._renderedComponent;
      }
      markerName = 'React update: ' + namedComponent.getName();
    }
    // ReactReconciler.performUpdateIfNecessary间接调用component.performUpdateIfNecessary重绘组件  
    // transaction.reconcileTransaction即ReactReconcileTransaction实例  
    // 用于向组件提供updater参数，使setState等方法可用；以及挂载componentDidMount、componentDidUpdate回调  
    ReactReconciler.performUpdateIfNecessary(
      component,
      transaction.reconcileTransaction,
      updateBatchNumber
    );
  // 将组件更新完成后需要触发执行的callbacks回调函数添加到ReactUpdatesFlushTransaction后置钩子中  
    if (callbacks) {
      for (var j = 0; j < callbacks.length; j++) {
        transaction.callbackQueue.enqueue(
          callbacks[j],
          component.getPublicInstance()
        );
      }
    }
  }
}
```
在setTimeout中的两次setState的调用属于同一类。此时的isBatchingUpdates标志是false,通过ReactDefaultBatchingStrategy事务直接重绘了组件(在close方法中调用了ReactUpdates.flushBatchedUpdates.bind(ReactUpdates))。flushBatchedUpdates方法时用于重绘组件。
```javascript
var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function() {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  },
};
var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  // 实务结束调用
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates),
};

var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,
  batchedUpdates: function(callback, a, b, c, d, e) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;
    // 本次的isBatchingUpdates设置为true
    ReactDefaultBatchingStrategy.isBatchingUpdates = true;
    ....
    // 这里的callback实际传入的是ReactUpdates的enqueueUpdate方法。相当于步骤如下：
    // - 上一步骤调用ReactUpdates的enqueueUpdate中，isBatchingUpdates为false，进入当前实务
    // - 在实务的perform中调用callback（ReactUpdates.enqueueUpdate()），此时isBatchingUpdates为true, 将当前组件添加到脏组件中
    // - 在close方法中调用ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)，重绘脏组件
    transaction.perform(callback, null, a, b, c, d, e);
  },
};
```
flushBatchedUpdates方法中，ReactReconciler会调用组件实例的performUpdateIfNecessary. 如果接收了props, 就会调用此组件的receiveComponent, 再在里面调用updateComponent更新组件; 如果没有接受props, 但是有新的要更新的状态(_pendingStateQueue不为空)就会直接调用updateComponent来更新。随即达到重绘组件目的。