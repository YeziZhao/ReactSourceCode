// 将原生事件对象event合成为react机制的合成事件对象。包含出发节点所在的ReactDOMComponent实例，以及阻止默认事件冒泡等方法。
// 合成事件对象的dispatchConfig属性记录相应的事件名，以获取触发事件组件实例及其止息父组件的绑定回调函数，同时该组实例和回调函数添加为合成事件对象的_dispatchInstance,_dispatchListners属性
'use strict';

// SyntheticAnimationEvent模块，基于SyntheticEvent合成的animation动效事件对象，专设animationName、elapsedTime、pseudoElement属性。

// SyntheticTransitionEvent模块，基于SyntheticEvent合成的transition动效事件对象，专设propertyName、elapsedTime、pseudoElement属性。

// SyntheticClipboardEvent模块，基于SyntheticEvent合成的剪贴面板事件对象，专设clipboardData属性。

// SyntheticCompositionEvent模块，基于SyntheticEvent合成的构图事件对象，专设data属性。

// SyntheticInputEvent模块，基于SyntheticEvent合成的输入框事件对象，专设data属性。

// SyntheticUIEvent模块，基于SyntheticEvent合成的UI事件对象，专设view、detail属性。

// SyntheticTouchEvent模块，基于SyntheticUIEvent合成的触摸事件对象，专设touches、targetTouches、changedTouches、altKey、metaKey、ctrlKey、shiftKey、getModifierState属性。

// SyntheticFocusEvent模块，基于SyntheticUIEvent合成的焦点事件对象，专设relatedTarget属性。

// SyntheticKeyboardEvent模块，基于SyntheticUIEvent合成的键盘事件对象，专设key、locations、altKey、metaKey、ctrlKey、shiftKey、getModifierState、charCode、keyCode、which属性。

// SyntheticMouseEvent模块，基于SyntheticUIEvent合成的鼠标事件对象，专设screenX、screenY、clientX、clientY、ctrlKey、shiftKey、altKey、metaKey、getModifierState、button、buttons、relatedTarget、pageX、pageY属性。

// SyntheticDragEvent模块，基于SyntheticMouseEvent合成的鼠标事件对象，专设dataTransfer属性。

// SyntheticWheelEvent模块，基于SyntheticMouseEvent合成的滚轮事件对象，专设eltaX、deltaY、deltaZ、deltaMode属性。

var PooledClass = require('PooledClass');
// 返回特定值的空函数
var emptyFunction = require('emptyFunction');
var warning = require('warning');

var didWarnForAddedNewProperty = false;

// 判断浏览器平台是否支持Proxy代理  
// var proxy=new Proxy(target,handler)调用代理对象的方法将转发给目标对象target；代理对象不同于目标对象  
// 句柄对象将重写代理对象的内建方法，否则将直接对目标对象起作用  
// 内建方法包含：  
// set(target,key,value,receiver)赋值，key作为属性名，value作为属性值  
// get(target,key,receiver)取值，key作为属性名  
// has(target,key)包含属性，key作为属性名，拦截key in target操作  
// deleteProperty(target,key)删除属性，key作为属性名，拦截delete proxy[key]操作  
// defineProperty(target,key,descriptor)定义属性，拦截Object.defineProperty(proxy,key,descriptor)操作，返回布尔值  
//    若目标对象不可扩展，使用代理对象的defineProperty扩展不存在的属性将报错  
//    若目标对象不可写或不可配置，使用代理对象的defineProperty不能更改这两个设置  
// preventExtensions(target)设定代理对象不可扩展，需要目标对象也同样不可扩展Object.isExtensible(target)=false  
// isExtensible(target)判断目标对象是否可扩展，拦截Object.isExtensible(proxy)操作  
// getOwnPropertyDescriptor(target,key)拦截Object.getOwnPropertyDescriptor(proxy,key)获取属性描述符操作  
// getPrototypeOf(target)获取原型对象__proto__，拦截Object.getPrototypeOf(proxy)  
// setPrototypeOf(target, proto)设置原型对象，拦截Object.setPrototypeOf(proxy)  
// apply(target,ctx,args)目标对象作为函数或基于apply、call方法使用时调用，ctx为上下文对象，args为参数  
// construct(target,args)使用new关键字将target作为构造函数时调用  
// ownKeys(target)数组形式获取对象的属性，拦截Object.getOwnPropertyNames(proxy)、Object.getOwnPropertySymbols(proxy)、Object.keys(proxy)操作  
  
// es6的Reflect对象，将Object对象的内建方法移入Reflect对象中，Reflect.defineProperty等同Object.defineProperty  
// 使语言更合理、操作更单纯  
var isProxySupported = typeof Proxy === 'function';
// 销毁合成事件实例时必须被销毁或提示不能读取的属性  
var shouldBeReleasedProperties = [
  'dispatchConfig',
  '_targetInst',
  'nativeEvent',
  'isDefaultPrevented',
  'isPropagationStopped',
  '_dispatchListeners',
  '_dispatchInstances',
];

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
// EventInterface[propName]为真值且是函数时，以原生event对象为参数，获取合成事件对象的属性  
// EventInterface[propName]为否值时直接copy原生event对象的属性，做了兼容性处理的target属性除外  
var EventInterface = {
  type: null,
  target: null,
  // currentTarget is set when dispatching; no use in copying it here
  currentTarget: emptyFunction.thatReturnsNull,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function(event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null,
};

/**
 * Synthetic events are dispatched by event plugins, typically in response to a
 * top-level event delegation handler.
 *
 * These systems should generally use pooling to reduce the frequency of garbage
 * collection. The system should check `isPersistent` to determine whether the
 * event should be released into the pool after being dispatched. Users that
 * need a persisted event should invoke `persist`.
 *
 * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
 * normalizing browser quirks. Subclasses do not necessarily have to implement a
 * DOM interface; custom application-specific events can also subclass this.
 *
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {*} targetInst Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @param {DOMEventTarget} nativeEventTarget Target node.
 */
// react形式的合成事件对象，做兼容性处理  
// 添加dispatchConfig派发事件对象，react内部使用  
// _targetInst属性指向邻近的ReactDomComponent实例  
// nativeEvent属性指向原生事件对象  
// isDefaultPrevented属性判断默认事件是否被终止；preventDefault方法终止默认事件  
// isPropagationStopped属性判断事件冒泡是否被终止；stopPropagation方法终止事件冒泡  
  
// 参数dispatchConfig为react注入的派发事件形式，形式为  
//  {  
//    phasedRegistrationNames: {  
//      bubbled: onEvent,  
//      captured: onEvent + 'Capture'  
//    },  
//    dependencies: [topEvent]  
//  };  
// 参数targetInst为触发节点邻近的ReactDomComponent实例  
// 参数nativeEvent为浏览器原生事件对象，  
// 参数nativeEventTarget为触发事件的节点  
function SyntheticEvent(dispatchConfig, targetInst, nativeEvent, nativeEventTarget) {
  if (__DEV__) {
    // these have a getter/setter for warnings
    delete this.nativeEvent;
    delete this.preventDefault;
    delete this.stopPropagation;
  }

  this.dispatchConfig = dispatchConfig;
  this._targetInst = targetInst;
  this.nativeEvent = nativeEvent;

  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }
    if (__DEV__) {
      delete this[propName]; // this has a getter/setter for warnings
    }
    var normalize = Interface[propName];
     // EventInterface[propName]为真值函数时，接受原生event为参数，返回合成事件对象的属性 
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      // 除target外，其他属性和原生event保持等值  
      if (propName === 'target') {
        this.target = nativeEventTarget;
      } else {
        this[propName] = nativeEvent[propName];
      }
    }
  }

  var defaultPrevented = nativeEvent.defaultPrevented != null ?
    nativeEvent.defaultPrevented :
    nativeEvent.returnValue === false;
  if (defaultPrevented) {
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  } else {
    this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
  }
  this.isPropagationStopped = emptyFunction.thatReturnsFalse;
  return this;
}

Object.assign(SyntheticEvent.prototype, {
  // 终止默认事件 
  preventDefault: function() {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    if (!event) {
      return;
    }

    if (event.preventDefault) {
      event.preventDefault();
    } else if (typeof event.returnValue !== 'unknown') { // eslint-disable-line valid-typeof
      event.returnValue = false;
    }
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  },
  // 终止事件冒泡 
  stopPropagation: function() {
    var event = this.nativeEvent;
    if (!event) {
      return;
    }

    if (event.stopPropagation) {
      event.stopPropagation();
    } else if (typeof event.cancelBubble !== 'unknown') { // eslint-disable-line valid-typeof
      // The ChangeEventPlugin registers a "propertychange" event for
      // IE. This event does not support bubbling or cancelling, and
      // any references to cancelBubble throw "Member not found".  A
      // typeof check of "unknown" circumvents this issue (and is also
      // IE specific).
      event.cancelBubble = true;
    }

    this.isPropagationStopped = emptyFunction.thatReturnsTrue;
  },

  /**
   * We release all dispatched `SyntheticEvent`s after each event loop, adding
   * them back into the pool. This allows a way to hold onto a reference that
   * won't be added back into the pool.
   */
  // 事件结束后调用，之后判断SyntheticEvent实例的isPersistent，销毁SyntheticEvent实例数据  
  // SyntheticEvent实例通过PooledClass移入实例池中 
  persist: function() {
    this.isPersistent = emptyFunction.thatReturnsTrue;
  },

  /**
   * Checks if this event should be released back into the pool.
   *
   * @return {boolean} True if this should not be released, false otherwise.
   */
  // 事件结束后销毁SyntheticEvent实例数据的标识符  
  isPersistent: emptyFunction.thatReturnsFalse,

  /**
   * `PooledClass` looks for `destructor` on each instance it releases.
   */
  // PooledClass机制销毁实例数据时使用，生产环境销毁合成事件实例必要的属性，开发环境提示属性不可读取
  destructor: function() {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      if (__DEV__) {
        Object.defineProperty(this, propName, getPooledWarningPropertyDefinition(propName, Interface[propName]));
      } else {
        this[propName] = null;
      }
    }
    for (var i = 0; i < shouldBeReleasedProperties.length; i++) {
      this[shouldBeReleasedProperties[i]] = null;
    }
    if (__DEV__) {
      Object.defineProperty(
        this,
        'nativeEvent',
        getPooledWarningPropertyDefinition('nativeEvent', null)
      );
      Object.defineProperty(
        this,
        'preventDefault',
        getPooledWarningPropertyDefinition('preventDefault', emptyFunction)
      );
      Object.defineProperty(
        this,
        'stopPropagation',
        getPooledWarningPropertyDefinition('stopPropagation', emptyFunction)
      );
    }
  },

});

// 作为SyntheticEvent构造函数中的this.constructor.Interface 
SyntheticEvent.Interface = EventInterface;

if (__DEV__) {
  if (isProxySupported) {
    /*eslint-disable no-func-assign */
    // 将SyntheticEvent修改为代理对象，除construct、apply的内建方法直接作用于原SyntheticEvent对象 
    SyntheticEvent = new Proxy(SyntheticEvent, {
      // 当创建的代理对象SyntheticEvent作为构造函数使用new关键字调用时执行 
      construct: function(target, args) {
        return this.apply(target, Object.create(target.prototype), args);
      },
      // 当创建的代理对象SyntheticEvent作为函数调用时，其返回的实例设置超纲属性时将予以警告  
      // 销毁实例数据时，超纲属性不会被销毁
      apply: function(constructor, that, args) {
        return new Proxy(constructor.apply(that, args), {
          set: function(target, prop, value) {
            if (prop !== 'isPersistent' &&
                !target.constructor.Interface.hasOwnProperty(prop) &&
                shouldBeReleasedProperties.indexOf(prop) === -1) {
              warning(
                didWarnForAddedNewProperty || target.isPersistent(),
                'This synthetic event is reused for performance reasons. If you\'re ' +
                'seeing this, you\'re adding a new property in the synthetic event object. ' +
                'The property is never released. See ' +
                'https://fb.me/react-event-pooling for more information.'
              );
              didWarnForAddedNewProperty = true;
            }
            target[prop] = value;
            return true;
          },
        });
      },
    });
    /*eslint-enable no-func-assign */
  }
}
/**
 * Helper to reduce boilerplate when creating subclasses.
 *
 * @param {function} Class
 * @param {?object} Interface
 */
// 用于生成子类 
SyntheticEvent.augmentClass = function(Class, Interface) {
  var Super = this;

  var E = function() {};
   
  // 继承SyntheticEvent类的原型方法preventDefault、stopPropagation、persist、isPersistent、destructor
  E.prototype = Super.prototype;
  var prototype = new E();

  Object.assign(prototype, Class.prototype);
  Class.prototype = prototype;
  Class.prototype.constructor = Class;
  // Class构造函数使用时预先将SyntheticEvent作为普通函数使用生成实例  
  // 再使用SyntheticEvent.augmentClass修改Class类的原型对象  
  Class.Interface = Object.assign({}, Super.Interface, Interface);
  // 使Class具有SyntheticEvent构造函数形式的生成子类的功能  
  Class.augmentClass = Super.augmentClass;

  PooledClass.addPoolingTo(Class, PooledClass.fourArgumentPooler);
};

PooledClass.addPoolingTo(SyntheticEvent, PooledClass.fourArgumentPooler);

module.exports = SyntheticEvent;

/**
  * Helper to nullify syntheticEvent instance properties when destructing
  *
  * @param {object} SyntheticEvent
  * @param {String} propName
  * @return {object} defineProperty object
  */
function getPooledWarningPropertyDefinition(propName, getVal) {
  var isFunction = typeof getVal === 'function';
  return {
    configurable: true,
    set: set,
    get: get,
  };

  function set(val) {
    var action = isFunction ? 'setting the method' : 'setting the property';
    warn(action, 'This is effectively a no-op');
    return val;
  }

  function get() {
    var action = isFunction ? 'accessing the method' : 'accessing the property';
    var result = isFunction ? 'This is a no-op function' : 'This is set to null';
    warn(action, result);
    return getVal;
  }

  function warn(action, result) {
    var warningCondition = false;
    warning(
      warningCondition,
      'This synthetic event is reused for performance reasons. If you\'re seeing this, ' +
      'you\'re %s `%s` on a released/nullified synthetic event. %s. ' +
      'If you must keep the original synthetic event around, use event.persist(). ' +
      'See https://fb.me/react-event-pooling for more information.',
      action,
      propName,
      result
    );
  }
}
