/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconciler
 */

'use strict';
// 创建、销毁、比对reactElement的refs属性相关  
var ReactRef = require('ReactRef');
var ReactInstrumentation = require('ReactInstrumentation');

var warning = require('warning');

/**
 * Helper to call ReactRef.attachRefs with this composite component, split out
 * to avoid allocations in the transaction mount-ready queue.
 */
// 创建reactElement的refs属性
function attachRefs() {
  ReactRef.attachRefs(this, this._currentElement);
}

var ReactReconciler = {

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {?object} the containing host component instance
   * @param {?object} info about the host container
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  // 将组件绘制到文档中，并执行componentDidMount方法，组件实例添加refs属性  
  // 参数internalInstance为用户自定义组件ReactComponent或ReactDomComponent实例  
  // 参数transaction为ReactReconcileTransaction实例，用于挂载componentDidMount后置钩子的回调函数  
  //    及提供ReactComponent的参数updater，使setState诸方法可用  
  // ReactMount模块中调用，用于挂载reactComponent，包括用户自定义组件或ReactDomComponent  
  // ReacrCompositeComponent模块中调用，用于挂载已实例化的用户自定义组件下的指定子组件  
  mountComponent: function(
    internalInstance,
    transaction,
    hostParent,
    hostContainerInfo,
    context,
    parentDebugID // 0 in production and for roots
  ) {
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onBeforeMountComponent(
          internalInstance._debugID,
          internalInstance._currentElement,
          parentDebugID
        );
      }
    }
    // 将组件实例转化为DomLazyTree后添加到文档中，并执行componentDidMount方法  
    var markup = internalInstance.mountComponent(
      transaction,
      hostParent,
      hostContainerInfo,
      context,
      parentDebugID
    );
    // 向ReactReconcileTransaction实例的后置钩子中添加attachRefs回调函数，组件绘制完成后执行
    if (internalInstance._currentElement &&
        internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onMountComponent(
          internalInstance._debugID
        );
      }
    }
    return markup;
  },

  /**
   * Returns a value that can be passed to
   * ReactComponentEnvironment.replaceNodeWithMarkup.
   */
  // ReactCompositeComponent中，传入ReactReconciler.getHostNode的internalInstance为用户自定义组件的子组件  
  // 待更新元素的实例或构造函数不同、需要销毁再创建组件实例时，供_replaceNodeWithMarkup方法替换已挂载在文档的节点  
  getHostNode: function(internalInstance) {
    return internalInstance.getHostNode();
  },

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
    // 卸载组件元素，并移除组件元素的refs属性  
  // ReactMount模块中调用，用于卸载reactComponent，包括用户自定义组件或ReactDomComponent  
  // ReacrCompositeComponent模块中调用，用于卸载已实例化的用户自定义组件下的指定子组件  
  unmountComponent: function(internalInstance, safely) {
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onBeforeUnmountComponent(
          internalInstance._debugID
        );
      }
    }
    // 移除组件元素的refs属性
    ReactRef.detachRefs(internalInstance, internalInstance._currentElement);
    // 卸载组件元素
    internalInstance.unmountComponent(safely);
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onUnmountComponent(
          internalInstance._debugID
        );
      }
    }
  },

  /**
   * Update a component using a new element.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactElement} nextElement
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @internal
   */
  // 组件元素的props改变，包含props.children改变，或其context属性改变  
  // 调用receiveComponent方法重绘组件元素，更新组件元素的refs属性  
  // 上层组件即用户自定义组件的state更新时，引起子组件的props或context变更，子组件可以是用户自定义组件或ReactDomComponent  
  // 由上层组件调用ReactReconciler.receiveComponent方法发起  
  // 上层组件的ReactReconciler.receiveComponent方法又由ReactReconciler.performUpdateIfNecessary发起  
  receiveComponent: function(
    internalInstance, nextElement, transaction, context
  ) {
    var prevElement = internalInstance._currentElement;

    if (nextElement === prevElement &&
        context === internalInstance._context
      ) {
      // Since elements are immutable after the owner is rendered,
      // we can do a cheap identity compare here to determine if this is a
      // superfluous reconcile. It's possible for state to be mutable but such
      // change should trigger an update of the owner which would recreate
      // the element. We explicitly check for the existence of an owner since
      // it's possible for an element created outside a composite to be
      // deeply mutated and reused.

      // TODO: Bailing out early is just a perf optimization right?
      // TODO: Removing the return statement should affect correctness?
      return;
    }

    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onBeforeUpdateComponent(
          internalInstance._debugID,
          nextElement
        );
      }
    }
    // 判断组件元素的refs属性是否需要更新
    var refsChanged = ReactRef.shouldUpdateRefs(
      prevElement,
      nextElement
    );
    // 移除组件元素的refs属性 
    if (refsChanged) {
      ReactRef.detachRefs(internalInstance, prevElement);
    }
    // 更新组件，内部调用render方法重新生成待渲染的元素ReactElement  
    // 当internalInstance为用户自定义组件时，其下包含的子节点也将得到更新  
    internalInstance.receiveComponent(nextElement, transaction, context);
    // 更新refs属性
    if (refsChanged &&
        internalInstance._currentElement &&
        internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }

    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onUpdateComponent(
          internalInstance._debugID
        );
      }
    }
  },

  /**
   * Flush any dirty changes in a component.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
   // 调用setState、forceUpdate方法重绘组件时触发的流程，用于重绘组件
  performUpdateIfNecessary: function(
    internalInstance,
    transaction,
    updateBatchNumber
  ) {
    // internalInstance._updateBatchNumber把组件添加到脏组件时+1，重绘  
    // updateBatchNumber当ReactUpdates.flushBatchedUpdates方法执行时自增1  
    // 意义是当组件被添加到脏组件的时候，及须重绘组件，这一过程通常由ReactUpdates.enqueueUpdate方法完成  
    if (internalInstance._updateBatchNumber !== updateBatchNumber) {
      // The component's enqueued batch number should always be the current
      // batch or the following one.
      warning(
        internalInstance._updateBatchNumber == null ||
        internalInstance._updateBatchNumber === updateBatchNumber + 1,
        'performUpdateIfNecessary: Unexpected batch number (current %s, ' +
        'pending %s)',
        updateBatchNumber,
        internalInstance._updateBatchNumber
      );
      return;
    }
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onBeforeUpdateComponent(
          internalInstance._debugID,
          internalInstance._currentElement
        );
      }
    }
     // internalInstance包含_pendingElement、_pendingStateQueue、_pendingForceUpdate用以判断更新方式  
    // _pendingStateQueue为state数据变化引起，由this.setState方法发起  
    // _pendingForceUpdate为调用this.forceUpdate方法发起  
    // 子组件通过递归调用ReactReconciler.receiveComponent方法  
    internalInstance.performUpdateIfNecessary(transaction);
    if (__DEV__) {
      if (internalInstance._debugID !== 0) {
        ReactInstrumentation.debugTool.onUpdateComponent(
          internalInstance._debugID
        );
      }
    }
  },

};

module.exports = ReactReconciler;
