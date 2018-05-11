// EventPropagators模块用于向SyntheticEvent等合成对象实例添加_dispatchListeners、_dispatchInstances属性，存储react组件实例及其同类事件的绑定回调函数。
'use strict';
// 存储获取绑定事件的回调函数
var EventPluginHub = require('EventPluginHub');
var EventPluginUtils = require('EventPluginUtils');
// accumulateInto(a,b)合并a和b，构成新的数组后返回  
// 当首参为数组，次参为数组时，次参数组拼接到首参数组后  
// 当首参为数组，次参不是数组时，次参作为数组项添加到首参数组中  
// 当首参不是数组，次参是数组，首参转化为数组首项，并拼接次参数组  
var accumulateInto = require('accumulateInto');
// forEachAccumulated(arr, cb, scope)  
// 当首参为数组时，遍历数组项执行回调cb，传参为arr中每一项；  
// 首参非数组时，以scope为上下文执行cb，传参为arr  
var forEachAccumulated = require('forEachAccumulated');
var warning = require('warning');

import type { PropagationPhases } from 'EventConstants';
// 获取绑定事件的回调函数
var getListener = EventPluginHub.getListener;

/**
 * Some event types have a notion of different registration names for different
 * "phases" of propagation. This finds listeners by a given phase.
 */
// 获取绑定事件的回调函数，通过参数event、propagationPhase获取注册事件名registrationName  
// 通过注册事件名和关联的react组件实例从EventPluginHub模块的listenerBank存储中获取绑定事件的回调函数  
function listenerAtPhase(inst, event, propagationPhase: PropagationPhases) {
  // 获取注册事件名，如onClick事件的event.dispatchConfig为{  
  //   phasedRegistrationNames: {  
  //     bubbled: "onClick",  
  //     captured: "onClickCapture"  
  //   },  
  //   dependencies: ["topClick"]  
  // }  
  // react合成事件对象的dispatchConfig属性在SyntheticEvent等模块构建合成事件对象时赋值  
  // 同时SyntheticEvent等构造函数获得的参数dispatchConfig又通过EventPlugins如SimpleEventPlugin等模块设值并传入  
  // "onClick"事件的registrationName终值为"onClick"或"onClickCapture"  
  // 对应EventPluginHub模块listenerBank存储回调函数listener的属性名  
  var registrationName =
    event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(inst, registrationName);
}

/**
 * Tags a `SyntheticEvent` with dispatched listeners. Creating this function
 * here, allows us to not have to bind or create functions for each event.
 * Mutating the event's members allows us to not have to create a wrapping
 * "dispatch" object that pairs the event with the listener.
 */
// 获取绑定事件的回调函数，并将回调函数和react实例写入event的_dispatchInstances、_dispatchListeners属性中  
// 参数phase为'captured'或'bubbled' 
function accumulateDirectionalDispatches(inst, phase, event) {
  if (__DEV__) {
    warning(
      inst,
      'Dispatching inst must not be null'
    );
  }
  // 获取绑定事件的回调函数  
  var listener = listenerAtPhase(inst, event, phase);
   // 将react实例和回调函数写入event的_dispatchInstances、_dispatchListeners属性中  
  if (listener) {
    event._dispatchListeners =
      accumulateInto(event._dispatchListeners, listener);
    event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
  }
}

/**
 * Collect dispatches (must be entirely collected before dispatching - see unit
 * tests). Lazily allocate the array to conserve memory.  We must loop through
 * each event and perform the traversal for each one. We cannot perform a
 * single traversal for the entire collection of events because each event may
 * have a different target.
 */
// 通过event对象触发事件组件实例，获取直系父组件的实例和同类绑定事件(包含触发事件实例)，添加到event对象中，供事件冒泡、捕获使用  
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginUtils.traverseTwoPhase(
      event._targetInst,
      accumulateDirectionalDispatches,
      event
    );
  }
}

/**
 * Same as `accumulateTwoPhaseDispatchesSingle`, but skips over the targetID.
 */
// 通过event对象触发事件组件实例，获取直系父组件的实例和同类绑定事件(排除触发事件实例)，添加到event对象中，供事件冒泡、捕获使用 
function accumulateTwoPhaseDispatchesSingleSkipTarget(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    var targetInst = event._targetInst;
    var parentInst =
      targetInst ? EventPluginUtils.getParentInstance(targetInst) : null;
    // 通过EventPluginUtils.traverseTwoPhase调用ReactDOMTreeTraversal的traverseTwoPhase  
    // ReactDOMTreeTraversal由ReactDefaultInjection模块添加到EventPluginUtils模块中  
    // 正向或反向遍历触发事件实例的直系父组件以获取父组件的绑定回调函数  
    EventPluginUtils.traverseTwoPhase(
      parentInst,
      accumulateDirectionalDispatches,
      event
    );
  }
}


/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
// 针对组件实例inst，将其同类事件绑定函数添加到合成事件对象event中  
function accumulateDispatches(inst, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(inst, registrationName);
    if (listener) {
      event._dispatchListeners =
        accumulateInto(event._dispatchListeners, listener);
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
// 合成事件对象只添加触发事件实例的绑定回调函数
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event);
  }
}
// 合成事件对象添加触发事件实例及其直系父组件的绑定回调函数 
function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}
// 合成事件对象添加触发事件实例的直系父组件的绑定回调函数，排除触发事件实例 
function accumulateTwoPhaseDispatchesSkipTarget(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingleSkipTarget);
}
  
// 参数leave鼠标移开状态的SyntheticMouseEvent类合成事件对象  
// 参数enter鼠标进入状态的SyntheticMouseEvent类合成事件对象  
// 参数from鼠标移开的react组件实例  
// 参数to鼠标进入的react组件实例  
// 向上获取from实例、处于鼠标移开状态的祖先组件实例的绑定回调函数，添加到合成事件对象leave中  
// 同时向上获取to实例、处于鼠标进入状态的祖先组件实例的绑定回调函数，添加到合成事件对象to中 
function accumulateEnterLeaveDispatches(leave, enter, from, to) {
  EventPluginUtils.traverseEnterLeave(
    from,
    to,
    accumulateDispatches,
    leave,
    enter
  );
}

// 针对一组合成事件对象，每个对象均添加触发事件实例的绑定回调函数  
function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}



/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing event a
 * single one.
 *
 * @constructor EventPropagators
 */
// EventPropagators模块为SyntheticEvent等合成对象实例添加_dispatchListeners、_dispatchInstances属性  
// _dispatchListeners属性以数组形式记录绑定回调函数  
// _dispatchInstances属性以数组形式记录被绑定事件的相应react组件实例  
var EventPropagators = {
  // accumulateDirectDispatchesSingle(event)  
  // 合成事件对象添加触发事件实例及其直系父组件的绑定回调函数，含捕获和冒泡事件  
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
   // accumulateTwoPhaseDispatches(events)  
  // 合成事件对象添加触发事件实例的直系父组件的绑定回调函数，排除触发事件实例，含捕获和冒泡事件  
  accumulateTwoPhaseDispatchesSkipTarget: accumulateTwoPhaseDispatchesSkipTarget,
   // accumulateDirectDispatches(events)  
  // 针对一组合成事件对象，每个对象均添加触发事件实例的绑定回调函数，含捕获和冒泡事件  
  accumulateDirectDispatches: accumulateDirectDispatches,
  // accumulateEnterLeaveDispatches(leave,enter,from,to)   
  // leave鼠标移开、enter鼠标移入合成事件对象添加相应父组件实例的绑定回调函数  
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches,
};

module.exports = EventPropagators;
