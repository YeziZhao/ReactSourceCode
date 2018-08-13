// react的事件机制区别于浏览器原生的在节点上绑定回调函数的机制。
// react将绑定函数以组件实例为属性存入缓存listenerBank中
// 事件触发时构建合成事件对象event，
// 取出linstenerBank中存储的绑定函数，并赋值给event._dispatchListeners，随后取出该回调函数并执行。
// 只有处理特殊的兼容性问题时，react才会给dom节点绑定具体的回调函数。

// EventPluginHub模块用于存储绑定回调函数、构建合成事件对象（同时向合成事件对象注入绑定回调函数）、触发绑定回调函数的执行。
'use strict';

var EventPluginRegistry = require('EventPluginRegistry');
// 为合成事件对象添加绑定的回调函数及关联的组件实例，或者获取绑定的回调函数并执行
var EventPluginUtils = require('EventPluginUtils');
// 用于try-catch形式执行某个约定参数的回调函数
var ReactErrorUtils = require('ReactErrorUtils');
// 复合数组或元素，构成新的数组后返回
var accumulateInto = require('accumulateInto');
// 遍历数组，执行某个函数
var forEachAccumulated = require('forEachAccumulated');
var invariant = require('invariant');

/**
 * Internal store for event listeners
 */
// 以{eventName:{ ['.'+inst._rootNodeID]: listener }}形式存储回调函数 
var listenerBank = {};

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
// 数组形式缓存合成事件对象
var eventQueue = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @param {boolean} simulated If the event is simulated (changes exn behavior)
 * @private
 */
  
// 冒泡及捕获方式执行已添加到合成事件对象event中的绑定回调函数  
// simulated为真值启用try-catch语句；为否值且是开发环境时，创建虚拟节点和虚拟事件触发执行绑定的回调函数_dispatchListeners  
var executeDispatchesAndRelease = function(event, simulated) {
  if (event) {
     // 以冒泡及捕获方式执行绑定的回调函数，执行完成后清空event的currentTarget、_dispatchListeners、_dispatchInstances属性  
    EventPluginUtils.executeDispatchesInOrder(event, simulated);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};
// 开发环境下，创建虚拟节点和虚拟事件、将绑定的回调函数作为虚拟事件的回调，以此冒泡及捕获执行绑定的回调函数  
// 生产环境使用try-catch形式执行已添加到合成事件对象event中的绑定回调函数 
var executeDispatchesAndReleaseSimulated = function(e) {
  return executeDispatchesAndRelease(e, true);
};
// 以try-catch形式、冒泡及捕获方式执行已添加到合成事件对象event中的绑定回调函数
var executeDispatchesAndReleaseTopLevel = function(e) {
  return executeDispatchesAndRelease(e, false);
};

var getDictionaryKey = function(inst) {
  // Prevents V8 performance issue:
  // https://github.com/facebook/react/pull/7232
  //inst为组建的实例化对象,_rootNodeID为组件的唯一标识
  // ReactCompositeComponent、ReactDomComponent实例均有_rootNodeID属性  
  return '.' + inst._rootNodeID;
};
// 判断是否交互型元素
function isInteractive(tag) {
  return (
    tag === 'button' || tag === 'input' ||
    tag === 'select' || tag === 'textarea'
  );
}
// ReactDomComponent组件元素是交互型元素，同时设置props.disabled为true
function shouldPreventMouseEvent(name, type, props) {
  switch (name) {
    case 'onClick':
    case 'onClickCapture':
    case 'onDoubleClick':
    case 'onDoubleClickCapture':
    case 'onMouseDown':
    case 'onMouseDownCapture':
    case 'onMouseMove':
    case 'onMouseMoveCapture':
    case 'onMouseUp':
    case 'onMouseUpCapture':
      return !!(props.disabled && isInteractive(type));
    default:
      return false;
  }
}

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
// react事件机制不是将回调函数绑定在dom节点上，而是通过触发事件的dom节点获取组件实例和绑定的回调函数  
// 并将该这批组件实例和绑定回调函数注入到合成事件对象当中，随后取出执行  
// 针对特殊的兼容性问题，才调用PluginModule.didPutListener方法为dom节点绑定具体的回调函数  
  
// EventPluginHub模块:
//putListener方法:存储实例的绑定回调函数  
// extractEvents:用于构建合成事件对象，并向该对象注入绑定的回调函数及其相应的组件实例  
// processEventQueue:取出合成事件对象的系列绑定回调函数并执行  
var EventPluginHub = {

  /**
   * Methods for injecting dependencies.
   */
  // 向EventPluginRegistry模块注入事件插件模块  
  // ReactDefaultInjection模块加载的SimpleEventPlugin、EnterLeaveEventPlugin、ChangeEventPlugin、SelectEventPlugin、BeforeInputEventPlugin模块  
  injection: {

    /**
     * @param {array} InjectedEventPluginOrder
     * @public
     */
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,

    /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     */
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName,

  },

  /**
   * Stores `listener` at `listenerBank[registrationName][key]`. Is idempotent.
   *
   * @param {object} inst The instance, which is the source of events.inst为组件实例化对象
   * @param {string} registrationName Name of listener (e.g. `onClick`). 事件名称
   * @param {function} listener The callback to store. listerner为我们写的回掉函数
   */
  // 将回调函数存储到listenerBank中，事件触发时取出作为合成事件对象的_dispatchListeners属性  
  // 同时调用PluginModule.didPutListener处理兼容性问题 
  putListener: function(inst, registrationName, listener) {
    invariant(
      typeof listener === 'function',
      'Expected %s listener to be a function, instead got type %s',
      registrationName, typeof listener
    );

    var key = getDictionaryKey(inst);
    var bankForRegistrationName =
      listenerBank[registrationName] || (listenerBank[registrationName] = {});
      // 以'.'+ inst.rootNodeId为key,以listner为值，存储到listenerBank中
    bankForRegistrationName[key] = listener;
    // 处理兼容性问题，如SimpleEventPlugin模块处理手机端Safari非交互节点不绑定回调函数的问题  
    var PluginModule =
      EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.didPutListener) {
      PluginModule.didPutListener(inst, registrationName, listener);
    }
  },

  /**
   * @param {object} inst The instance, which is the source of events.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
  // EventPluginUtils模块中使用  
  // 事件触发时，取出存储在listenerBank中的绑定回调函数，添加到合成事件对象的_dispatchListeners属性中  
  getListener: function(inst, registrationName) {
    // TODO: shouldPreventMouseEvent is DOM-specific and definitely should not
    // live here; needs to be moved to a better place soon
    var bankForRegistrationName = listenerBank[registrationName];
    if (shouldPreventMouseEvent(registrationName, inst._currentElement.type, inst._currentElement.props)) {
      return null;
    }
    var key = getDictionaryKey(inst);
    return bankForRegistrationName && bankForRegistrationName[key];
  },

  /**
   * Deletes a listener from the registration bank.
   *
   * @param {object} inst The instance, which is the source of events.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   */
  // 删除listenerBank中实例inst、事件名registrationName的相关绑定回调函数  
  // 同时调用PluginModule.willDeleteListener解绑兼容性处理类事件 
  deleteListener: function(inst, registrationName) {
    var PluginModule =
      EventPluginRegistry.registrationNameModules[registrationName];
    if (PluginModule && PluginModule.willDeleteListener) {
      PluginModule.willDeleteListener(inst, registrationName);
    }

    var bankForRegistrationName = listenerBank[registrationName];
    // TODO: This should never be null -- when is it?
    if (bankForRegistrationName) {
      var key = getDictionaryKey(inst);
      delete bankForRegistrationName[key];
    }
  },

  /**
   * Deletes all listeners for the DOM element with the supplied ID.
   *
   * @param {object} inst The instance, which is the source of events.
   */
   // 删除listenerBank中所有绑定回调函数  
  // 同时调用PluginModule.willDeleteListener解绑兼容性处理类事件  
  deleteAllListeners: function(inst) {
    var key = getDictionaryKey(inst);
    for (var registrationName in listenerBank) {
      if (!listenerBank.hasOwnProperty(registrationName)) {
        continue;
      }

      if (!listenerBank[registrationName][key]) {
        continue;
      }

      var PluginModule =
        EventPluginRegistry.registrationNameModules[registrationName];
      if (PluginModule && PluginModule.willDeleteListener) {
        PluginModule.willDeleteListener(inst, registrationName);
      }

      delete listenerBank[registrationName][key];
    }
  },

  /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
   // 数组形式获取合成事件对象，存储有事件名、绑定回调函数及相关组件实例
  extractEvents: function(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget) {
    var events;
    
    // 获取各类事件插件模块，ReactDefaultInjection模块加载的SimpleEventPlugin、EnterLeaveEventPlugin、ChangeEventPlugin、SelectEventPlugin、BeforeInputEventPlugin模块  
    // 该插件模块内含extractEvents方法用于提取对应事件类型的合成事件对象  
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0; i < plugins.length; i++) {
      // Not every plugin in the ordering may be loaded at runtime.
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        // 获取合成事件对象，该对象的dispatchConfig记录事件名，用以获取组件实例的绑定回调函数  
        // _dispatchListeners属性记录绑定的会回调函数，_dispatchInstances记录关联的react组件实例  
        var extractedEvents = possiblePlugin.extractEvents(
          topLevelType,
          targetInst,
          nativeEvent,
          nativeEventTarget
        );
         // 将获取到的合成事件对象extractedEvents添加到events中  
        if (extractedEvents) {
          events = accumulateInto(events, extractedEvents);
        }
      }
    }
    return events;
  },

  /**
   * Enqueues a synthetic event that should be dispatched when
   * `processEventQueue` is invoked.
   *
   * @param {*} events An accumulation of synthetic events.
   * @internal
   */
  // 将合成事件对象存储到eventQueue缓存中 
  enqueueEvents: function(events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  },

  /**
   * Dispatches all synthetic events on the event queue.
   *
   * @internal
   */
  // 派发事件，即冒泡、捕获执行绑定的回调函数
  processEventQueue: function(simulated) {
    // Set `eventQueue` to null before processing it so that we can tell if more
    // events get enqueued while processing.
    var processingEventQueue = eventQueue;
    eventQueue = null;
    if (simulated) {
      forEachAccumulated(
        processingEventQueue,
        executeDispatchesAndReleaseSimulated
      );
    } else {
      forEachAccumulated(
        processingEventQueue,
        executeDispatchesAndReleaseTopLevel
      );
    }
    invariant(
      !eventQueue,
      'processEventQueue(): Additional events were enqueued while processing ' +
      'an event queue. Support for this has not yet been implemented.'
    );
    // This would be a good time to rethrow if any of the event handlers threw.
     // 抛出绑定回调函数执行过程中捕获到的错误 
    ReactErrorUtils.rethrowCaughtError();
  },

  /**
   * These are needed for tests only. Do not use!
   */
  // 测试使用，清空listenerBank中存储的事件回调函数  
  __purge: function () {  
    listenerBank = {};  
  },  
    
  // 测试使用，获取存储有事件回调函数的listenerBank  
  __getListenerBank: function() {
    return listenerBank;
  },

};

module.exports = EventPluginHub;
