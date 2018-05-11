// 为ReactBrowserEventEmitter.ReactEventListener提供_handleTopLevel方法，用于构建合成事件对象，并执行组件实例的绑定函数。

'use strict';
// 存储绑定回调函数、构建合成事件对象（同时向合成事件对象注入绑定回调函数）、触发绑定回调函数的执行 
var EventPluginHub = require('EventPluginHub');
// 冒泡、捕获形式取出合成事件对象中的绑定函数并执行  
function runEventQueueInBatch(events) {
  // 将合成事件对象存储到eventQueue缓存中  
  EventPluginHub.enqueueEvents(events);  
  
  // 取出合成事件对象中的绑定回调函数，冒泡、捕获形式执行  
  EventPluginHub.processEventQueue(false);  
}
// 通过ReactBrowserEventEmitter模块，向ReactBrowserEventEmitter.ReactEventListener提供_handleTopLevel方法  
// 该方法用于构建合成事件对象及执行该对象的绑定回调
var ReactEventEmitterMixin = {

  /**
   * Streams a fired top-level event to `EventPluginHub` where plugins have the
   * opportunity to create `ReactEvent`s to be dispatched.
   */
  handleTopLevel: function(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget) {
    // 以数组形式获取合成事件对象，存储有事件名、绑定回调函数及相关组件实例  (//首先封装event事件)
    var events = EventPluginHub.extractEvents(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget
    );
    // 冒泡、捕获形式取出合成事件对象中的绑定函数并执行 (发送包装好的event)
    runEventQueueInBatch(events);
  },
};

module.exports = ReactEventEmitterMixin;
