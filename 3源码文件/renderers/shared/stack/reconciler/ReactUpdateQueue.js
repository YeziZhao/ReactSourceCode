// ReactUpdateQueue模块，一则作为用户自定义组件ReactComponent的参数updater，
// 供ReactComponent实例的setState、replaceState、forceUpdate方法调用ReactUpdateQueue模块的方法，用于更新state，并重绘组件；
// 一则为用户自定义组件ReactComponent提供isMount方法判断组件是否挂载完成；
// 一则为ReactMount模块使用，在该模块中挂载设定用户自定义组件ReactComponent元素的父节点为reactNode时，父节点更新引起的组件元素变动，
// 将调用ReactUpdateQueue模块的方法实现组件重绘，及执行回调函数。
'use strict';
// 开发环境下，ReactClass组件被实例化或其render方法被调用时，向ReactCurrentOwner.current添加ReactCompositeComponent实例    
// 实例化完成或render方法执行完成，ReactCurrentOwner.current置为null   
var ReactCurrentOwner = require('ReactCurrentOwner');
// 由ReactComponent实例publicInstance映射获得ReactCompositeComponent实例internalInstance
var ReactInstanceMap = require('ReactInstanceMap');
// 调试工具 
var ReactInstrumentation = require('ReactInstrumentation');
// 用于添加脏组件，并启动重绘
var ReactUpdates = require('ReactUpdates');
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错
var invariant = require('invariant');
// warning(condition,format) condition为否值，替换format中的"%s"，并console.error警告   
var warning = require('warning');

// 调用ReactUpdates.enqueueUpdate添加脏组件internalInstance，并重绘组
function enqueueUpdate(internalInstance) {
  ReactUpdates.enqueueUpdate(internalInstance);
}

function formatUnexpectedArgument(arg) {
  var type = typeof arg;
  if (type !== 'object') {
    return type;
  }
  var displayName = arg.constructor && arg.constructor.name || type;
  var keys = Object.keys(arg);
  if (keys.length > 0 && keys.length < 20) {
    return `${displayName} (keys: ${keys.join(', ')})`;
  }
  return displayName;
}
// 由用户自定义组件ReactComponent实例publicInstance,获取对于的ReactCompositeComponent实例
function getInternalInstanceReadyForUpdate(publicInstance, callerName) {
  // 由用户自定义组价ReactComponent实例publicInstance，获得react内部使用ReactCompositeComponent实例internalInstance
  var internalInstance = ReactInstanceMap.get(publicInstance);
   // 无法取得ReactCompositeComponent实例，警告
  if (!internalInstance) {
    if (__DEV__) {
      var ctor = publicInstance.constructor;
      // Only warn when we have a callerName. Otherwise we should be silent.
      // We're probably calling from enqueueCallback. We don't want to warn
      // there because we already warned for the corresponding lifecycle method.
      warning(
        !callerName,
        '%s(...): Can only update a mounted or mounting component. ' +
        'This usually means you called %s() on an unmounted component. ' +
        'This is a no-op. Please check the code for the %s component.',
        callerName,
        callerName,
        ctor && (ctor.displayName || ctor.name) || 'ReactClass'
      );
    }
    return null;
  }
  // 组件的render方法执行过程中，更新state，警告
  if (__DEV__) {
    warning(
      ReactCurrentOwner.current == null,
      '%s(...): Cannot update during an existing state transition (such as ' +
      'within `render` or another component\'s constructor). Render methods ' +
      'should be a pure function of props and state; constructor ' +
      'side-effects are an anti-pattern, but can be moved to ' +
      '`componentWillMount`.',
      callerName
    );
  }

  return internalInstance;
}

/**
 * ReactUpdateQueue allows for state updates to be scheduled into a later
 * reconciliation step.
 */
var ReactUpdateQueue = {

  /**
   * Checks whether or not this composite component is mounted.
   * @param {ReactClass} publicInstance The instance we want to test.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  // 自定义组件的isMounted方法调用，判断组件元素是否渲染完成，执行render方法  
  isMounted: function(publicInstance) {
    if (__DEV__) {
      var owner = ReactCurrentOwner.current;
      if (owner !== null) {
        warning(
          owner._warnedAboutRefsInRender,
          '%s is accessing isMounted inside its render() function. ' +
          'render() should be a pure function of props and state. It should ' +
          'never access something that requires stale data from the previous ' +
          'render, such as refs. Move this logic to componentDidMount and ' +
          'componentDidUpdate instead.',
          owner.getName() || 'A component'
        );
        owner._warnedAboutRefsInRender = true;
      }
    }
    // 获取对应的ReactCompositeComponent实例internalInstance
    var internalInstance = ReactInstanceMap.get(publicInstance);
    if (internalInstance) {
      // During componentWillMount and render this will still be null but after
      // that will always render to something. At least for now. So we can use
      // this hack.
      return !!internalInstance._renderedComponent;
    } else {
      return false;
    }
  },

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @param {string} callerName Name of the calling function in the public API.
   * @internal
   */
  // 由用户自定义组件的set State， replace State， formUpdate方法的调用，重绘组件后触发回掉
  // 参数publicInstance:为用户自定义组件ReactComponent实例  
  // 参数callback为回调: 添加到关联的ReactCompositeComponent实例的_pendingCallbacks属性中  
  // 参数callerName为函数名: 校验callback时报错提示需要  
  enqueueCallback: function(publicInstance, callback, callerName) {
    // 校验callback是否函数 
    ReactUpdateQueue.validateCallback(callback, callerName);
    // 获取ReactCompositeComponent实例，通过用户自定义组件实例publicInstance获得
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance);

    // Previously we would throw an error if we didn't have an internal
    // instance. Since we want to make it a no-op instead, we mirror the same
    // behavior we have in other enqueue* methods.
    // We also need to ignore callbacks in componentWillMount. See
    // enqueueUpdates.
    if (!internalInstance) {
      return null;
    }

    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    // TODO: The callback here is ignored when setState is called from
    // componentWillMount. Either fix it or disallow doing so completely in
    // favor of getInitialState. Alternatively, we can disallow
    // componentWillMount during server-side rendering.
    // 添加脏组件internalInstance，并重绘组件
    enqueueUpdate(internalInstance);
  },
  // 由ReactMount调用，添加ReactUpdateQueue.enqueElementInternal发起组件重绘后的回掉
  enqueueCallbackInternal: function(internalInstance, callback) {
    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    // 添加脏组件internalInstance，并重绘组件
    enqueueUpdate(internalInstance);
  },

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldComponentUpdate`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  // 由用户自定义组件的forceUpdate方法调用，强制重绘组件  
  // 参数publicInstance为用户自定义组件ReactComponent实例
  enqueueForceUpdate: function(publicInstance) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'forceUpdate'
    );

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingForceUpdate = true;
  // 添加脏组件internalInstance，并重绘组件
    enqueueUpdate(internalInstance);
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  // 由用户自定义组件的replaceState方法调用
  // 用于将更迭的state数据，推送到关联的ReactCompsiteComponent实例internalInstance的_pendingStateQueue属性中。
  //  以及调用reactUpdates.enqueueUpdate添加脏组件insternalInstance,并重绘组件
  // 参数publicInstance：为用户自定义组件ReactComponent实例  
  // 参数completeState： 为state的部分重设值  
  enqueueReplaceState: function(publicInstance, completeState) {
    // 获取ReactCompositeComponent实例，通过用户自定义组件实例publicInstance获得
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'replaceState'
    );

    if (!internalInstance) {
      return;
    }
    // 将待更新的completeState添加到ReactCompositeComponent实例的_pendingStateQueue属性中  
    internalInstance._pendingStateQueue = [completeState];
    internalInstance._pendingReplaceState = true;
  // 添加脏组件internalInstance，并重绘组件
    enqueueUpdate(internalInstance);
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep  
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @internal
   */
  // 用户自定义组件的setState
  // 用于将更迭的state数据，推送到ReactCompositeCompnent实例internalInstance的_pendignStateQueue属性中。
  // 以及调用reactUpdates.enqueueUpdate天去你家脏组件internalInstance并重绘组件
  // 参数publicInstance为用户自定义组件ReactComponent实例  
  // 参数partialState为state的部分重设值
  enqueueSetState: function(publicInstance, partialState) {
    if (__DEV__) {
      ReactInstrumentation.debugTool.onSetState();
      warning(
        partialState != null,
        'setState(...): You passed an undefined or null state object; ' +
        'instead, use forceUpdate().'
      );
    }
    // 获取ReactCompositeComponent实例，通过用户自定义组件实例publicInstance获得
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'setState'
    );

    if (!internalInstance) {
      return;
    }
  // 将待更新的partialState添加到ReactCompositeComponent实例的_pendingStateQueue属性中  
    var queue =
      internalInstance._pendingStateQueue ||
      (internalInstance._pendingStateQueue = []);
    queue.push(partialState);
  // 添加脏组件internalInstance，并重绘组件  
    enqueueUpdate(internalInstance);
  },

  enqueueElementInternal: function(internalInstance, nextElement, nextContext) {
    internalInstance._pendingElement = nextElement;
    // TODO: introduce _pendingContext instead of setting it directly.
    internalInstance._context = nextContext;
    enqueueUpdate(internalInstance);
  },

  validateCallback: function(callback, callerName) {
    invariant(
      !callback || typeof callback === 'function',
      '%s(...): Expected the last optional `callback` argument to be a ' +
      'function. Instead received: %s.',
      callerName,
      formatUnexpectedArgument(callback)
    );
  },

};

module.exports = ReactUpdateQueue;
