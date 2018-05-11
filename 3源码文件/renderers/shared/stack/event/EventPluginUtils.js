// EventPluginUtils模块用于为为合成事件对象添加绑定的回调函数及关联的组件实例，或者获取绑定的回调函数并执行。
'use strict';
// 用于try-catch形式执行某个约定参数的回调函数  
var ReactErrorUtils = require('ReactErrorUtils');

var invariant = require('invariant');
var warning = require('warning');

/**
 * Injected dependencies:
 */

/**
 * - `ComponentTree`: [required] Module that can convert between React instances
 *   and actual node references.
 */
// 通过ReactDefaultInjection加载ReactDomComponentTree模块  
// 通过组件实例获取dom节点、或者通过dom节点获取组件实例 
var ComponentTree;
// 通过ReactDefaultInjection模块赋值为ReactDOMTreeTraversal模块  
// 供react合成事件对象获取_dispatchListeners、_dispatchInstances绑定回调函数及组件实例使用  
var TreeTraversal;
var injection = {
  injectComponentTree: function(Injected) {
    ComponentTree = Injected;
    if (__DEV__) {
      warning(
        Injected &&
        Injected.getNodeFromInstance &&
        Injected.getInstanceFromNode,
        'EventPluginUtils.injection.injectComponentTree(...): Injected ' +
        'module is missing getNodeFromInstance or getInstanceFromNode.'
      );
    }
  },
  injectTreeTraversal: function(Injected) {
    TreeTraversal = Injected;
    if (__DEV__) {
      warning(
        Injected && Injected.isAncestor && Injected.getLowestCommonAncestor,
        'EventPluginUtils.injection.injectTreeTraversal(...): Injected ' +
        'module is missing isAncestor or getLowestCommonAncestor.'
      );
    }
  },
};
// 判断是否鼠标、触控类结束事件 
function isEndish(topLevelType) {
  return topLevelType === 'topMouseUp' ||
         topLevelType === 'topTouchEnd' ||
         topLevelType === 'topTouchCancel';
}
// 判断是否鼠标、触控类进行中事件 
function isMoveish(topLevelType) {
  return topLevelType === 'topMouseMove' ||
         topLevelType === 'topTouchMove';
}
// 判断是否鼠标、触控类起始事件
function isStartish(topLevelType) {
  return topLevelType === 'topMouseDown' ||
         topLevelType === 'topTouchStart';
}


var validateEventDispatches;
if (__DEV__) {
   // 校验合成事件对象的绑定回调函数个数是否跟组件实例个数相匹配 
  validateEventDispatches = function(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchInstances = event._dispatchInstances;

    var listenersIsArr = Array.isArray(dispatchListeners);
    var listenersLen = listenersIsArr ?
      dispatchListeners.length :
      dispatchListeners ? 1 : 0;

    var instancesIsArr = Array.isArray(dispatchInstances);
    var instancesLen = instancesIsArr ?
      dispatchInstances.length :
      dispatchInstances ? 1 : 0;

    warning(
      instancesIsArr === listenersIsArr && instancesLen === listenersLen,
      'EventPluginUtils: Invalid `event`.'
    );
  };
}

/**
 * Dispatch the event to the listener.
 * @param {SyntheticEvent} event SyntheticEvent to handle
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @param {function} listener Application-level callback
 * @param {*} inst Internal component instance
 */
// 执行绑定的回调函数lister，以event为参数；simulated为真值时，执行过程使用try-catch语句  
function executeDispatch(event, simulated, listener, inst) {
  var type = event.type || 'unknown-event';
  // 获取触发事件的dom节点  
  event.currentTarget = EventPluginUtils.getNodeFromInstance(inst);
  if (simulated) {
    // 以try-catch方式执行linsenter，event作为参数 
    ReactErrorUtils.invokeGuardedCallbackWithCatch(
      type,
      listener,
      event
    );
  } else {
    // 生产环境以try-catch方式执行linsenter，event作为参数  
    // 开发环境创建react节点和'react-'+type事件，绑定并触发事件，listener.bind(event)作为事件的回调  
    ReactErrorUtils.invokeGuardedCallback(type, listener, event);
  }
  event.currentTarget = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches.
 */
// 由触发事件组件实例冒泡及捕获遍历并执行该组件实例及其父组件实例的绑定回调函数  
// 当遇到event.isPropagationStopped()返回真值时，阻止事件传播  
function executeDispatchesInOrder(event, simulated) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchInstances = event._dispatchInstances;
  // 开发环境校验合成事件对象的绑定回调函数个数是否跟组件实例个数相匹配  
  if (__DEV__) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and Instances are two parallel arrays that are always in sync.
      // 执行绑定的回调函数  
      executeDispatch(
        event,
        simulated,
        dispatchListeners[i],
        dispatchInstances[i]
      );
    }
  } else if (dispatchListeners) {
    executeDispatch(event, simulated, dispatchListeners, dispatchInstances);
  }
  event._dispatchListeners = null;
  event._dispatchInstances = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches, but stops
 * at the first dispatch execution returning true, and returns that id.
 *
 * @return {?string} id of the first dispatch execution who's listener returns
 * true, or null if no listener returned true.
 */
// 以冒泡及捕获方式执行绑定的回调函数，回调函数返回真值阻止事件传播，并返回当前回调函数的关联组件实例
function executeDispatchesInOrderStopAtTrueImpl(event) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchInstances = event._dispatchInstances;
  if (__DEV__) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and Instances are two parallel arrays that are always in sync.
       // 回调函数返回真值阻止事件传播  
      if (dispatchListeners[i](event, dispatchInstances[i])) {
        return dispatchInstances[i];
      }
    }
  } else if (dispatchListeners) {
    if (dispatchListeners(event, dispatchInstances)) {
      return dispatchInstances;
    }
  }
  return null;
}

/**
 * @see executeDispatchesInOrderStopAtTrueImpl
 */
// 以冒泡及捕获方式执行绑定的回调函数，回调函数返回真值阻止事件传播，并返回当前回调函数的关联组件实例  
// 执行完成后清空event的currentTarget、_dispatchListeners、_dispatchInstances属性  
function executeDispatchesInOrderStopAtTrue(event) {
  var ret = executeDispatchesInOrderStopAtTrueImpl(event);
  event._dispatchInstances = null;
  event._dispatchListeners = null;
  return ret;
}

/**
 * Execution of a "direct" dispatch - there must be at most one dispatch
 * accumulated on the event or it is considered an error. It doesn't really make
 * sense for an event with multiple dispatches (bubbled) to keep track of the
 * return values at each dispatch execution, but it does tend to make sense when
 * dealing with "direct" dispatches.
 *
 * @return {*} The return value of executing the single dispatch.
 */
// 合成事件对象只有一个绑定函数时，获取该绑定函数、并传入event合成对象后执行该函数  
function executeDirectDispatch(event) {
  // 开发环境校验合成事件对象的绑定回调函数个数是否跟组件实例个数相匹配 
  if (__DEV__) {
    validateEventDispatches(event);
  }
  var dispatchListener = event._dispatchListeners;
  var dispatchInstance = event._dispatchInstances;
   // 确保合成事件对象只有单个绑定的回调函数  
  invariant(
    !Array.isArray(dispatchListener),
    'executeDirectDispatch(...): Invalid `event`.'
  );
   // 获取事件触发节点，添加为event.currentTarget属性 
  event.currentTarget = dispatchListener ? EventPluginUtils.getNodeFromInstance(dispatchInstance) : null;
   // 直接调用绑定事件的回调函数，传参为合成事件对象event  
  var res = dispatchListener ? dispatchListener(event) : null;
  // 清空合成事件对象的currentTarget、_dispatchListeners、_dispatchInstances属性，事件触发时再次添加  
  event.currentTarget = null;
  event._dispatchListeners = null;
  event._dispatchInstances = null;
  // 返回绑定回调的执行结果
  return res;
}

/**
 * @param {SyntheticEvent} event
 * @return {boolean} True iff number of dispatches accumulated is greater than 0.
 */
// 判断合成事件对象是否有绑定的回调函数 
function hasDispatches(event) {
  return !!event._dispatchListeners;
}

/**
 * General utilities that are useful in creating custom Event Plugins.
 */
// 为合成事件对象添加绑定的回调函数及关联的组件实例，或者获取绑定的回调函数并执行  
var EventPluginUtils = {
    /** 特定事件类型判断 **/  
  
  // 判断是否鼠标、触控类结束事件  
  isEndish: isEndish,  
  // 判断是否鼠标、触控类进行中事件  
  isMoveish: isMoveish,  
  // 判断是否鼠标、触控类起始事件  
  isStartish: isStartish,  


  /** 特定事件的绑定回调函数 **/  
  
  // executeDirectDispatch(event)  
  // 合成事件对象只有一个绑定函数时，获取该绑定函数、并传入event合成对象后执行该函数  
  executeDirectDispatch: executeDirectDispatch,  
  // executeDispatchesInOrder(event,simulated)  
  // 以冒泡及捕获方式执行绑定的回调函数，执行完成后清空event的currentTarget、_dispatchListeners、_dispatchInstances属性  
  executeDispatchesInOrder: executeDispatchesInOrder,  
  // executeDispatchesInOrder(event)  
  // 以冒泡及捕获方式执行绑定的回调函数，回调函数返回真值阻止事件传播，并返回当前回调函数的关联组件实例  
  // 执行完成后清空event的currentTarget、_dispatchListeners、_dispatchInstances属性  
  executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,  
  // 判断合成事件对象是否有绑定的回调函数  
  hasDispatches: hasDispatches,  


  // 通过dom节点获取组件实例，EventPluginUtils模块内部使用  
  getInstanceFromNode: function(node) {
    // 通过ReactDefaultInjection模块加载ReactDomComponentTree模块，由dom节点获取组件实例  
    return ComponentTree.getInstanceFromNode(node);
  },
  // 通过组件实例获取dom节点，EventPluginUtils模块内部使用 
  getNodeFromInstance: function(node) {
    return ComponentTree.getNodeFromInstance(node);
  },
   // 判断组件实例a是否为b的父组件
  isAncestor: function(a, b) {
    // 通过ReactDefaultInjection模块加载ReactDOMTreeTraversal模块，判断组件实例a是否为b的父组件  
    return TreeTraversal.isAncestor(a, b);
  },
   // 获取组件实例a、b所共有的同个祖先组件实例  
  getLowestCommonAncestor: function(a, b) {
    return TreeTraversal.getLowestCommonAncestor(a, b);
  },
  // 获取父组件 
  getParentInstance: function(inst) {
    return TreeTraversal.getParentInstance(inst);
  },


  /** 向合成事件对象添加绑定的回调函数及关联的组件实例 **/  

   // 遍历target的直系父组件，执行fn函数，以获取该父组件的冒泡、捕获阶段的绑定回调函数 
  traverseTwoPhase: function(target, fn, arg) {
    return TreeTraversal.traverseTwoPhase(target, fn, arg);
  },
   // 遍历rom的直系父组件（直到与to共有的祖先组件位置），执行fn，以获取该父组件绑定的鼠标离开事件的回调函数  
  // 遍历to的直系父组件（直到与from共有的祖先组件位置），执行fn，以获取该父组件绑定的鼠标移入事件的回调函数 
  traverseEnterLeave: function(from, to, fn, argFrom, argTo) {
    return TreeTraversal.traverseEnterLeave(from, to, fn, argFrom, argTo);
  },

   // 注入ComponentTree和TreeTraversal  
  // 通过ReactDefaultInjection模块将加载ReactDomComponentTree、ReactDOMTreeTraversal模块  
  injection: injection,
};

module.exports = EventPluginUtils;
