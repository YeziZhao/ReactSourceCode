//ReactEventListener模块通过ReactDefaultInjection模块加载为ReactBrowserEventEmitter模块的ReactEventListener属性，
// 提供的功能是react方式监听节点事件，在事件回调中执行ReactEventListener.dispatchEvent方法——构建合成事件对象、
// 并执行该系列合成事件对象的绑定回调，当存在脏组件时，重绘组件。
'use strict';
// 用于绑定非捕获类或捕获类事件，返回值用于解绑事件 
var EventListener = require('EventListener');
var ExecutionEnvironment = require('ExecutionEnvironment');
var PooledClass = require('PooledClass');
// 由组件实例获取节点；或者由节点获取组件实例 
var ReactDOMComponentTree = require('ReactDOMComponentTree');
// ReactUpdates.batchedUpdates执行回调，存在脏组件时，重绘组件
var ReactUpdates = require('ReactUpdates');

var getEventTarget = require('getEventTarget');
// 获取滚动时的偏移量
var getUnboundedScrollPosition = require('getUnboundedScrollPosition');

/**
 * Find the deepest React component completely containing the root of the
 * passed-in instance (for use when entire React trees are nested within each
 * other). If React trees are not nested, returns null.
 */
// 调用组件挂载在ReactDom.render生成的元素container下，findParent查询由ReactDom.render生成的父级组件 
function findParent(inst) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  while (inst._hostParent) {
    inst = inst._hostParent;
  }
  var rootNode = ReactDOMComponentTree.getNodeFromInstance(inst);
  var container = rootNode.parentNode;
  return ReactDOMComponentTree.getClosestInstanceFromNode(container);
}

// Used to store ancestor hierarchy in top level callback
// 该实例作为handleTopLevelImpl函数的参数，传递原生事件、事件名  
// 参数topLevelType为事件名，nativeEvent为原生事件对象  
function TopLevelCallbackBookKeeping(topLevelType, nativeEvent) {
  this.topLevelType = topLevelType;
  this.nativeEvent = nativeEvent;
  this.ancestors = [];
}
Object.assign(TopLevelCallbackBookKeeping.prototype, {
  destructor: function() {
    this.topLevelType = null;
    this.nativeEvent = null;
    this.ancestors.length = 0;
  },
});
PooledClass.addPoolingTo(
  TopLevelCallbackBookKeeping,
  PooledClass.twoArgumentPooler
);
// 构建合成事件对象，并执行合成事件对象中的绑定回调函数
function handleTopLevelImpl(bookKeeping) {
  /// nativeEventTarget为触发事件的节点元素 
  var nativeEventTarget = getEventTarget(bookKeeping.nativeEvent);
  // 由触发节点元素获取最近的reactDomComponent实例 
  var targetInst = ReactDOMComponentTree.getClosestInstanceFromNode(
    nativeEventTarget
  );

  // Loop through the hierarchy, in case there's any nested components.
  // It's important that we build the array of ancestors before calling any
  // event handlers, because event handlers can modify the DOM, leading to
  // inconsistencies with ReactMount's node cache. See #1105.
  var ancestor = targetInst;
   //bookKeeping.ancestors保存的是组件。
  do {
    bookKeeping.ancestors.push(ancestor);
    ancestor = ancestor && findParent(ancestor);
  } while (ancestor);

  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i];
    // 构建合成事件对象，并执行该对象的绑定回调函数_dispatchListeners 
    ReactEventListener._handleTopLevel(
      bookKeeping.topLevelType,
      targetInst,
      bookKeeping.nativeEvent,
      getEventTarget(bookKeeping.nativeEvent)
    );
  }
}

function scrollValueMonitor(cb) {
  var scrollPosition = getUnboundedScrollPosition(window);
  cb(scrollPosition);
}
// react方式监听节点事件，绑定ReactEventListener.dispatchEvent派发事件方法，回调中构建合成事件对象并执行合成事件对象绑定回调的  
var ReactEventListener = {
  _enabled: true,
  _handleTopLevel: null,

  WINDOW_HANDLE: ExecutionEnvironment.canUseDOM ? window : null,
// 通过ReactDefaultInjection模块赋值_handleTopLevel=ReactEventEmitterMixin.handleTopLevel  
  setHandleTopLevel: function(handleTopLevel) {
    ReactEventListener._handleTopLevel = handleTopLevel;
  },
// 是否允许派发react事件，即在组件重绘后调用合成事件对象的绑定回调函数  
  setEnabled: function(enabled) {
    ReactEventListener._enabled = !!enabled;
  },
// 判断是否允许派发react事件
  isEnabled: function() {
    return ReactEventListener._enabled;
  },


  /**
   * Traps top-level events by using event bubbling.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} element Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
   // 冒泡方式绑定事件，回调设为ReactEventListener.dispatchEvent，构建合成事件对象并执行该对象的回调  
  trapBubbledEvent: function(topLevelType, handlerBaseName, element) {
    if (!element) {
      return null;
    }
    return EventListener.listen(
      element,
      handlerBaseName,
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
  },

  /**
   * Traps a top-level event by using event capturing.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} element Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  // 捕获方式绑定事件，回调设为ReactEventListener.dispatchEvent，构建合成事件对象并执行该对象的回调  
  trapCapturedEvent: function(topLevelType, handlerBaseName, element) {
    if (!element) {
      return null;
    }
    return EventListener.capture(
      element,
      handlerBaseName,
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
  },
  // 监听滚动事件，滚动时执行refresh回调，传参为滚动偏移量  
  monitorScrollValue: function(refresh) {
    var callback = scrollValueMonitor.bind(null, refresh);
    EventListener.listen(window, 'scroll', callback);
  },
 // 在浏览器事件发生时，构建合成事件对象，并调用合成事件对象的绑定回调；若回调中导致state改变，则重绘组件 
  dispatchEvent: function(topLevelType, nativeEvent) {
    // 判断是否允许派发react事件，不允许则返回  
    if (!ReactEventListener._enabled) {
      return;
    }
    // 创建bookKeeping实例，为handleTopLevelImpl回调函数传递事件名和原生事件对象  
    var bookKeeping = TopLevelCallbackBookKeeping.getPooled(
      topLevelType,
      nativeEvent
    );
    try {
      // Event queue being processed in the same cycle allows
      // `preventDefault`.
      // 执行handleTopLevelImpl，若存在state改变引起的脏组件时，重绘组件
      ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    } finally {
      // 清空bookKeeping实例数据  
      TopLevelCallbackBookKeeping.release(bookKeeping);
    }
  },
};

module.exports = ReactEventListener;
