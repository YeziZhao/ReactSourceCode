// ReactReconcileTransaction模块用于在组件元素挂在前后执行指定的构造函数，特别是componentDidMount,componentDIdUpdate生命周期调用方法。
// 其次是向组件注入updater参数，实现setState,replcaceState、forceUpdate方法
'use strict';
// 回调函数队列，经过PooledClass工厂化，使用getPooled方法创建实例，release方法销毁实例数据，即回调函数及其上下文
var CallbackQueue = require('CallbackQueue');
// pooledClass.addPoolingTo(copyContructor)：用于创建构造函数copyContructor转化为工厂函数
// 用于管理实例数据的创建和销毁，并将销毁的实例添加到实例池CopyContructor.instancePool中
var PooledClass = require('PooledClass');
// ReactBorserEventEmitter模块的isEnabled,setEnabled方法默认使用ReactEventListenter模块的同名方法
var ReactBrowserEventEmitter = require('ReactBrowserEventEmitter');
// 输入框、文本框、contentEditable节点选中文案相关操作 
var ReactInputSelection = require('ReactInputSelection');
var ReactInstrumentation = require('ReactInstrumentation');
// 当前对象会继承Transaction的某构造函数的实例，将拥有perform(method, args)方法
// 实现功能为：method函数执行前后，调用成对的前置钩子initialize，后置钩子函数close.initialize为close提供参数
var Transaction = require('Transaction');
// 作为组件构造函数ReactComponent的第三个参数updater传入
// 组件内的setState/replaceState,forceUpdate方法都通过ReactUpdateQueue的响应方法实现
var ReactUpdateQueue = require('ReactUpdateQueue');

// 缓存选中文案的数据后，再行选中文案
var SELECTION_RESTORATION = {
  // 获取选中节点及文案的信息
  initialize: ReactInputSelection.getSelectionInformation,
  // 以initialize选中文案的信息选中相关节点及文案 
  close: ReactInputSelection.restoreSelection,
};

/**
 * Suppresses events (blur/focus) that could be inadvertently dispatched due to
 * high level DOM manipulations (like temporarily removing a text input from the
 * DOM).
 */
// 组件绘制过程中截断事件派发，ReactBrowserEventEmitter.ReactEventListener._enabled置否实现 
var EVENT_SUPPRESSION = {
  /**
   * @return {boolean} The enabled status of `ReactBrowserEventEmitter` before
   * the reconciliation.
   */
  initialize: function() {
    var currentlyEnabled = ReactBrowserEventEmitter.isEnabled();
    ReactBrowserEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },

  /**
   * @param {boolean} previouslyEnabled Enabled status of
   *   `ReactBrowserEventEmitter` before the reconciliation occurred. `close`
   *   restores the previous value.
   */
  close: function(previouslyEnabled) {
    ReactBrowserEventEmitter.setEnabled(previouslyEnabled);
  },
};

// 通过CallbackQueue回调函数队列机制，即this.reactMountReady  
// 执行this.reactMountReady.enqueue(fn)注入componentDidMount、componentDidUpdate方法  
// 通过Transaction添加前、后置钩子机制  
// 前置钩子initialize方法用于清空回调队列；close用于触发回调函数componentDidMount、componentDidUpdate执行  
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function() {
    this.reactMountReady.reset();
  },

  /**
   * After DOM is flushed, invoke all registered `onDOMReady` callbacks.
   */
  close: function() {
    this.reactMountReady.notifyAll();
  },
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [
  SELECTION_RESTORATION,
  EVENT_SUPPRESSION,
  ON_DOM_READY_QUEUEING,
];

if (__DEV__) {
  TRANSACTION_WRAPPERS.push({
    initialize: ReactInstrumentation.debugTool.onBeginFlush,
    close: ReactInstrumentation.debugTool.onEndFlush,
  });
}

/**
 * Currently:
 * - The order that these are listed in the transaction is critical:
 * - Suppresses events.
 * - Restores selection range.
 *
 * Future:
 * - Restore document/overflow scroll positions that were unintentionally
 *   modified via DOM insertions above the top viewport boundary.
 * - Implement/integrate with customized constraint based layout system and keep
 *   track of which dimensions must be remeasured.
 *
 * @class ReactReconcileTransaction
 */
function ReactReconcileTransaction(useCreateElement: boolean) {
  // 调用事务初始化函数，设置transactionWrapper, 初始化wrapperInitData=[]，是close的参数。并将_isInTransaction设置为false（事务进行中标识）
  this.reinitializeTransaction();
  // 浏览器端渲染使用，虽然浏览器端渲染使用ReactServerRenderingTransaction  
  // 客户端渲染设置此值为否，是ReactDOMComponent、ReactDOMTextComponent模块执行mountComponent的需要  
  this.renderToStaticMarkup = false;
  // 用于挂载回调函数，如componentDidMount、componentDidUpdate等 ,通过Transcation机制，作为后置钩子执行 
  this.reactMountReady = CallbackQueue.getPooled(null);
  // 参数useCreateElement决定创建dom节点的时候是使用document.createElement方法，还是拼接字符串
  this.useCreateElement = useCreateElement;
}

var Mixin = {
 // 通过Transaction模块设定前置及后置钩子，[{initialize,close}]形式  
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  },

  // 获取this.reactMountReady，用于添加回调函数如getReactMountReady().enqueue(fn)。添加声明周期处理函数 
  getReactMountReady: function() {
    return this.reactMountReady;
  },

   // 作为组件构造函数ReactComponent的第三个参数updater传入  
  // 组件内的setState、replaceState、forceUpdate方法都通过调用ReactUpdateQueue的相应方法实现
  getUpdateQueue: function() {
    return ReactUpdateQueue;
  },

  // 获取this.reactMountReady中添加的回调函数componentDidMount、componentDidUpdate的个数
  checkpoint: function() {
    // 获取回调函数队列中的回调函数个数
    return this.reactMountReady.checkpoint();
  },
  // 将this.reactMountReady中添加的回调函数个数设为checkpoint 
  rollback: function(checkpoint) {
     // 将回调函数队列中的回调函数个数设定为参数checkpoint
    this.reactMountReady.rollback(checkpoint);
  },

  // 清空this.reactMountReady中的回调函数componentDidMount、componentDidUpdate，再销毁this.reactMountReady  
  destructor: function() {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;
  },
};

// reinitializeTransaction方法，用于重置钩子函数  
// getTransactionWrappers方法，用于添加钩子函数，[{initialize,close}]形式  
// perform(method)执行前后钩子函数、及method函数  
// method函数为ReactMount模块中的mountComponentIntoNode函数  
Object.assign(ReactReconcileTransaction.prototype, Transaction, Mixin);
// 通过PooledClass模块管理实例的创建ReactReconcileTransaction.getPooled  
// 及实例数据的销毁ReactReconcileTransaction.release 
PooledClass.addPoolingTo(ReactReconcileTransaction);
// 通过ReactUpdates模块输出接口: ReactUpdates.ReactReconcileTransaction  
// 实现功能为在mountComponentIntoNode函数调用指定的钩子函数，包括用户配置的componentDidMount、componentDidUpdate回调  
// 使用方式为getPooled方法创建实例，release方法销毁实例数据  
// perform方法执行mountComponentIntoNode函数，及前后钩子函数  
// getReactMountReady().enqueue(fn):添加用户配置的componentDidMount、componentDidUpdate回调  
// getReactMountReady().checkpoint():方法获取回调个数  
// getReactMountReady().rollback(checkpoint): 将回调个数设为checkpoint  
// 另一实现功能为向组件实例注入updater参数，将向setState、replaceState、forceUpdate方法提供函数功能  
module.exports = ReactReconcileTransaction;
