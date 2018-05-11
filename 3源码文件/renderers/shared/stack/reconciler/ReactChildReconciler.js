// ReactChildReconciler模块用于挂载、卸载、或更新ReactDomComponent子组件。
'use strict';

var ReactReconciler = require('ReactReconciler');
// 用于获取ReactCmpositeComponent组件实例或ReactDomComponent组件实例
var instantiateReactComponent = require('instantiateReactComponent');
// react组件的key值转译
var KeyEscapeUtils = require('KeyEscapeUtils');
// 由组件的构造函数及key键是否相同，判断是否可以更新组件
var shouldUpdateReactComponent = require('shouldUpdateReactComponent');
var warning = require('warning');
// 用于遍历props.children，触发执行instantiateChild函数，以对象形式获取相关ReactDomComponent组件实例  
var traverseAllChildren = require('traverseAllChildren');

var ReactComponentTreeHook;

if (
  typeof process !== 'undefined' &&
  process.env &&
  process.env.NODE_ENV === 'test'
) {
  // Temporary hack.
  // Inline requires don't work well with Jest:
  // https://github.com/facebook/react/issues/7240
  // Remove the inline requires when we don't need them anymore:
  // https://github.com/facebook/react/pull/7178
  ReactComponentTreeHook = require('ReactComponentTreeHook');
}
// 以集合childInstances获取react组件实例
function instantiateChild(childInstances, child, name, selfDebugID) {
  // We found a component instance.
  var keyUnique = (childInstances[name] === undefined);
  if (__DEV__) {
    if (!ReactComponentTreeHook) {
      ReactComponentTreeHook = require('ReactComponentTreeHook');
    }
    if (!keyUnique) {
      // ReactComponentTreeHook.getStackAddendumByID当key值相同，获取祖先节点的信息，警告用 
      warning(
        false,
        'flattenChildren(...): Encountered two children with the same key, ' +
        '`%s`. Child keys must be unique; when two children share a key, only ' +
        'the first child will be used.%s',
        KeyEscapeUtils.unescape(name),
        ReactComponentTreeHook.getStackAddendumByID(selfDebugID)
      );
    }
  }
  if (child != null && keyUnique) {
    // 获取child对应的react组件实例，表现为ReactCompositeComponent实例或ReactDomComponent实例等  
    childInstances[name] = instantiateReactComponent(child, true);
  }
}

/**
 * ReactChildReconciler provides helpers for initializing or updating a set of
 * children. Its output is suitable for passing it onto ReactMultiChild which
 * does diffed reordering and insertion.
 */
// 用于装载/更新/或卸载ReactDomComponent子组件
var ReactChildReconciler = {
  /**
   * Generates a "mount image" for each of the supplied children. In the case
   * of `ReactDOMComponent`, a mount image is a string of markup.
   *
   * @param {?object} nestedChildNodes Nested child maps.
   * @return {?object} A set of child instances.
   * @internal
   */
  // 获取props.children相关的react组件实例集合
  instantiateChildren: function(
    nestedChildNodes,
    transaction,
    context,
    selfDebugID // 0 in production and for roots
  ) {
    if (nestedChildNodes == null) {
      return null;
    }
    var childInstances = {};

    if (__DEV__) {
      traverseAllChildren(
        nestedChildNodes,
        (childInsts, child, name) => instantiateChild(
          childInsts,
          child,
          name,
          selfDebugID
        ),
        childInstances
      );
    } else {
      traverseAllChildren(nestedChildNodes, instantiateChild, childInstances);
    }
    return childInstances;
  },

  /**
   * 通过shouldUpdateReactComponent函数判断是否可以更新ReactDomComponent子组件。如不能卸载组件并装载新的子组件
   *
   * @param {?object} prevChildren 先前挂在的子节点，以key键作为标识，用于更新或移除
   * @param {?object} nextChildren 组件中即将挂在的子节点，以key键作为标识，通preChildren比较后添加或更新
   * mountImages：更新为组件最终渲染的子节点图谱  
  * removedNodes：更新为组件待移除的子节点 
   * @param {ReactReconcileTransaction} transaction： 生命周期管理 
   * hostParent：父节点信息
   * @param {object} context
   * @return {?object} A new set of child instances.
   * @internal
   */
  updateChildren: function(
    prevChildren,
    nextChildren,
    mountImages,
    removedNodes,
    transaction,
    hostParent,
    hostContainerInfo,
    context,
    selfDebugID // 0 in production and for roots
  ) {
    // We currently don't have a way to track moves here but if we use iterators
    // instead of for..in we can zip the iterators and check if an item has
    // moved.
    // TODO: If nothing has changed, return the prevChildren object so that we
    // can quickly bailout if nothing has changed.
    if (!nextChildren && !prevChildren) {
      return;
    }
    var name;
    var prevChild;
    // 遍历需要更新的子节点
    for (name in nextChildren) {
      // 不是自有属性，跳过
      if (!nextChildren.hasOwnProperty(name)) {
        continue;
      }
      // 根据当前节点的name，获取之前prevChildren的值
      prevChild = prevChildren && prevChildren[name];
      // 根据当前节点的name获取之前的_currentElement
      var prevElement = prevChild && prevChild._currentElement;
      // 获取当前需要更新的element
      var nextElement = nextChildren[name];
      // 判断是需要更新还是重新挂载
      if (prevChild != null &&
          shouldUpdateReactComponent(prevElement, nextElement)) {
            // 更新
        ReactReconciler.receiveComponent(
          prevChild, nextElement, transaction, context
        );
        // nextChildren存放需要更新的node
        nextChildren[name] = prevChild;
      } else {
        // 重新挂载
        if (prevChild) {
          // 移除的node放入removedNodes
          removedNodes[name] = ReactReconciler.getHostNode(prevChild);
          // 卸载
          ReactReconciler.unmountComponent(prevChild, false);
        }
        // The child must be instantiated before it's mounted.
        // 获取ReactCmpositeComponent组件实例或ReactDomComponent组件实例
        var nextChildInstance = instantiateReactComponent(nextElement, true);
        // 将卸载的数据存放到nextChildren
        nextChildren[name] = nextChildInstance;
        // Creating mount image now ensures refs are resolved in right order
        // (see https://github.com/facebook/react/pull/7101 for explanation).
        // 重新挂载的LazyTree
        var nextChildMountImage = ReactReconciler.mountComponent(
          nextChildInstance,
          transaction,
          hostParent,
          hostContainerInfo,
          context,
          selfDebugID
        );
        // mountImages：最后需要挂在到DOM上的真实node节点
        mountImages.push(nextChildMountImage);
      }
    }
    // Unmount children that are no longer present.
    // 从DOM上卸载掉本次更新不再需要的节点
    for (name in prevChildren) {
      if (prevChildren.hasOwnProperty(name) &&
          !(nextChildren && nextChildren.hasOwnProperty(name))) {
        prevChild = prevChildren[name];
        removedNodes[name] = ReactReconciler.getHostNode(prevChild);
        ReactReconciler.unmountComponent(prevChild, false);
      }
    }
  },

  /**
   * Unmounts all rendered children. This should be used to clean up children
   * when this component is unmounted.
   *
   * @param {?object} renderedChildren Previously initialized set of children.
   * @internal
   */
  // 遍历props.children相关react组件实例，执行unmountComponent方法卸载组件
  unmountChildren: function(renderedChildren, safely) {
    for (var name in renderedChildren) {
      if (renderedChildren.hasOwnProperty(name)) {
        var renderedChild = renderedChildren[name];
        ReactReconciler.unmountComponent(renderedChild, safely);
      }
    }
  },

};

module.exports = ReactChildReconciler;
