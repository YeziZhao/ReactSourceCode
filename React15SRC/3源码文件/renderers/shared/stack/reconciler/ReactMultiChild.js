/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChild
 */

'use strict';

var ReactComponentEnvironment = require('ReactComponentEnvironment');
var ReactInstanceMap = require('ReactInstanceMap');
var ReactInstrumentation = require('ReactInstrumentation');

var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactReconciler = require('ReactReconciler');
var ReactChildReconciler = require('ReactChildReconciler');

var emptyFunction = require('emptyFunction');
var flattenChildren = require('flattenChildren');
var invariant = require('invariant');

/**
 * Make an update for markup to be rendered and inserted at a supplied index.
 *
 * @param {string} markup Markup that renders into an element.
 * @param {number} toIndex Destination index.
 * @private
 */
function makeInsertMarkup(markup, afterNode, toIndex) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: 'INSERT_MARKUP',
    content: markup,
    fromIndex: null,
    fromNode: null,
    toIndex: toIndex,
    afterNode: afterNode,
  };
}

/**
 * Make an update for moving an existing element to another index.
 *
 * @param {number} fromIndex Source index of the existing element.
 * @param {number} toIndex Destination index of the element.
 * @private
 */
function makeMove(child, afterNode, toIndex) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: 'MOVE_EXISTING',
    content: null,
    fromIndex: child._mountIndex,
    fromNode: ReactReconciler.getHostNode(child),
    toIndex: toIndex,
    afterNode: afterNode,
  };
}

/**
 * Make an update for removing an element at an index.
 *
 * @param {number} fromIndex Index of the element to remove.
 * @private
 */
function makeRemove(child, node) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: 'REMOVE_NODE',
    content: null,
    fromIndex: child._mountIndex,
    fromNode: node,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Make an update for setting the markup of a node.
 *
 * @param {string} markup Markup that renders into an element.
 * @private
 */
function makeSetMarkup(markup) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: 'SET_MARKUP',
    content: markup,
    fromIndex: null,
    fromNode: null,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Make an update for setting the text content.
 *
 * @param {string} textContent Text content to set.
 * @private
 */
function makeTextContent(textContent) {
  // NOTE: Null values reduce hidden classes.
  return {
    type: 'TEXT_CONTENT',
    content: textContent,
    fromIndex: null,
    fromNode: null,
    toIndex: null,
    afterNode: null,
  };
}

/**
 * Push an update, if any, onto the queue. Creates a new queue if none is
 * passed and always returns the queue. Mutative.
 */
function enqueue(queue, update) {
  if (update) {
    queue = queue || [];
    queue.push(update);
  }
  return queue;
}

/**
 * Processes any enqueued updates.
 *
 * @private
 */
function processQueue(inst, updateQueue) {
  ReactComponentEnvironment.processChildrenUpdates(
    inst,
    updateQueue,
  );
}

var setChildrenForInstrumentation = emptyFunction;
if (__DEV__) {
  var getDebugID = function(inst) {
    if (!inst._debugID) {
      // Check for ART-like instances. TODO: This is silly/gross.
      var internal;
      if ((internal = ReactInstanceMap.get(inst))) {
        inst = internal;
      }
    }
    return inst._debugID;
  };
  setChildrenForInstrumentation = function(children) {
    var debugID = getDebugID(this);
    // TODO: React Native empty components are also multichild.
    // This means they still get into this method but don't have _debugID.
    if (debugID !== 0) {
      ReactInstrumentation.debugTool.onSetChildren(
        debugID,
        children ? Object.keys(children).map(key => children[key]._debugID) : []
      );
    }
  };
}

/**
 * ReactMultiChild are capable of reconciling multiple children.
 *
 * @class ReactMultiChild
 * @internal
 */
var ReactMultiChild = {

  /**
   * Provides common functionality for components that must reconcile multiple
   * children. This is used by `ReactDOMComponent` to mount, update, and
   * unmount child components.
   *
   * @lends {ReactMultiChild.prototype}
   */
  Mixin: {

    _reconcilerInstantiateChildren: function(nestedChildren, transaction, context) {
      if (__DEV__) {
        var selfDebugID = getDebugID(this);
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            return ReactChildReconciler.instantiateChildren(
              nestedChildren, transaction, context, selfDebugID
            );
          } finally {
            ReactCurrentOwner.current = null;
          }
        }
      }
      return ReactChildReconciler.instantiateChildren(
        nestedChildren, transaction, context
      );
    },

    _reconcilerUpdateChildren: function(
      prevChildren,
      nextNestedChildrenElements, // 不是null就是 nextChildren（ReactElement类型）
      mountImages,
      removedNodes,
      transaction,
      context
    ) {
      var nextChildren;
      var selfDebugID = 0;
      if (__DEV__) {
        selfDebugID = getDebugID(this);
        if (this._currentElement) {
          try {
            ReactCurrentOwner.current = this._currentElement._owner;
            // 访问我们的子树指针nextNestedChildrenElements，得到与prevChildren同层的nextChildren
            nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);
          } finally {
            ReactCurrentOwner.current = null;
          }
          // 将prevChildren、nextChildren封装成ReactDOMComponent类型。
          ReactChildReconciler.updateChildren(
            prevChildren,
            nextChildren,
            mountImages,
            removedNodes,
            transaction,
            this,
            this._hostContainerInfo,
            context,
            selfDebugID
          );
          return nextChildren;
        }
      }
      nextChildren = flattenChildren(nextNestedChildrenElements, selfDebugID);
      ReactChildReconciler.updateChildren(
        prevChildren,
        nextChildren,
        mountImages,
        removedNodes,
        transaction,
        this,
        this._hostContainerInfo,
        context,
        selfDebugID
      );
      return nextChildren;
    },

    /**
     * Generates a "mount image" for each of the supplied children. In the case
     * of `ReactDOMComponent`, a mount image is a string of markup.
     *
     * @param {?object} nestedChildren Nested child maps.
     * @return {array} An array of mounted representations.
     * @internal
     */
    mountChildren: function(nestedChildren, transaction, context) {
      var children = this._reconcilerInstantiateChildren(
        nestedChildren, transaction, context
      );
      this._renderedChildren = children;
      // 一个一个挂在子元素，并放入到mountImages中并返回，这个就是最终返回的DOMLazyTree上的子node数组列表
      var mountImages = [];
      var index = 0;
      for (var name in children) {
        if (children.hasOwnProperty(name)) {
          var child = children[name];
          var selfDebugID = 0;
          if (__DEV__) {
            selfDebugID = getDebugID(this);
          }
           // 调用子元素上的挂在信息返回node节点
          var mountImage = ReactReconciler.mountComponent(
            child,
            transaction,
            this,
            this._hostContainerInfo,
            context,
            selfDebugID
          );
          child._mountIndex = index++;
          mountImages.push(mountImage);
        }
      }

      return mountImages;
    },

    /**
     * Replaces any rendered children with a text content string.
     *
     * @param {string} nextContent String of content.
     * @internal
     */
    updateTextContent: function(nextContent) {
      var prevChildren = this._renderedChildren;
      // Remove any rendered children.
      ReactChildReconciler.unmountChildren(prevChildren, false);
      for (var name in prevChildren) {
        if (prevChildren.hasOwnProperty(name)) {
          invariant(false, 'updateTextContent called on non-empty component.');
        }
      }
      // Set new text content.
      var updates = [makeTextContent(nextContent)];
      processQueue(this, updates);
    },

    /**
     * Replaces any rendered children with a markup string.
     *
     * @param {string} nextMarkup String of markup.
     * @internal
     */
    updateMarkup: function(nextMarkup) {
      var prevChildren = this._renderedChildren;
      // Remove any rendered children.
      ReactChildReconciler.unmountChildren(prevChildren, false);
      for (var name in prevChildren) {
        if (prevChildren.hasOwnProperty(name)) {
          invariant(false, 'updateTextContent called on non-empty component.');
        }
      }
      var updates = [makeSetMarkup(nextMarkup)];
      processQueue(this, updates);
    },

    /**
     * Updates the rendered children with new children.
     *
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    updateChildren: function(nextNestedChildrenElements, transaction, context) {
      // Hook used by React ART
      this._updateChildren(nextNestedChildrenElements, transaction, context);
    },

    /**
     * @param {?object} nextNestedChildrenElements Nested child element maps.
     * @param {ReactReconcileTransaction} transaction
     * @final
     * @protected
     */
    _updateChildren: function(nextNestedChildrenElements, transaction, context) {
      // -prevChildren 和nextChildren都是ReactElement，也就是虚拟DOM.cont他们的$$typeof.Symbol(react.element) 可以看出来的
      // removedNodes和mountImages：这些变量会随着调用栈一层层往下作为参数传下去并被修改和包装
      // 之前的children
      var prevChildren = this._renderedChildren;
      // 本次需要移除的node节点集合
      var removedNodes = {};
      // 本次需要挂载到DOM的DOMLazyTree（真实DOM的映射）
      var mountImages = [];
      // 本次需要挂载的children
      var nextChildren = this._reconcilerUpdateChildren(
        prevChildren,
        nextNestedChildrenElements,
        mountImages,
        removedNodes,
        transaction,
        context
      );
      if (!nextChildren && !prevChildren) {
        return;
      }
      var updates = null;
      var name;
      // `nextIndex` will increment for each child in `nextChildren`, but
      // `lastIndex` will be the last index visited in `prevChildren`.
      // `nextIndex`会为`nextChildren`中的每个child自增
      var nextIndex = 0;
      // `lastIndex`将是'prevChildren`中最后一个访问的索引
      var lastIndex = 0;
      // `nextMountIndex` will increment for each newly mounted child.
      var nextMountIndex = 0;
      var lastPlacedNode = null;
      // 遍历nextChildren,通过hasOwnProperty过滤原型上的属性和方法
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        // 将同层节点进行比较
        if (prevChild === nextChild) {
          // 节点相同：则enqueue一个moveChild方法返回的type为MOVE_EXISTING的对象到updates里
          // 即把更新放入一个队列，moveChild也就是移动已有节点，但是是否真的移动会根据整体diff算法的结果来决定(本例当然是没移动了)，然后修改若干index量
          updates = enqueue(
            updates,
            this.moveChild(prevChild, lastPlacedNode, nextIndex, lastIndex)
          );
          // 修改lastIndex
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          // 将旧对象的_mountIndex更新为新集合中的位置
          prevChild._mountIndex = nextIndex;
        } else {
          // 就会计算一堆index(这里其实是算法的核心，此处先不细说)，然后再次enqueue一个update，事实上是一个type属性为INSERT_MARKUP的对象。
          if (prevChild) {
            // Update `lastIndex` before `_mountIndex` gets unset by unmounting.
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            // The `removedNodes` loop below will actually remove the child.
          }
          // The child must be instantiated before it's mounted.
          updates = enqueue(
            updates,
            this._mountChildAtIndex(
              nextChild,
              mountImages[nextMountIndex],
              lastPlacedNode,
              nextIndex,
              transaction,
              context
            )
          );
          nextMountIndex++;
        }
        nextIndex++;
        // 通过ReactReconciler.getHostNode根据nextChild得到真实DOM
        lastPlacedNode = ReactReconciler.getHostNode(nextChild);
      }
      // Remove children that are no longer present.
      // 把需要删除的节点用enqueue的方法继续入队unmount操作。
      for (name in removedNodes) {
        if (removedNodes.hasOwnProperty(name)) {
          // 这里this._unmountChild返回的是REMOVE_NODE对象
          updates = enqueue(
            updates,
            this._unmountChild(prevChildren[name], removedNodes[name])
          );
        }
      }
      // 整个更新的diff流程就走完了，而updates保存了全部的更新队列，最终由processQueue来挨个执行更新。
      if (updates) {
        processQueue(this, updates);
      }
      this._renderedChildren = nextChildren;

      if (__DEV__) {
        setChildrenForInstrumentation.call(this, nextChildren);
      }
    },

    /**
     * Unmounts all rendered children. This should be used to clean up children
     * when this component is unmounted. It does not actually perform any
     * backend operations.
     *
     * @internal
     */
    unmountChildren: function(safely) {
      var renderedChildren = this._renderedChildren;
      ReactChildReconciler.unmountChildren(renderedChildren, safely);
      this._renderedChildren = null;
    },

    /**
     * Moves a child component to the supplied index.
     *
     * @param {ReactComponent} child Component to move. 就集合中存在的本次节点对象
     * @param {number} toIndex Destination index of the element.本次需要插入节点的位置
     * @param {number} lastIndex Last index visited of the siblings of `child`.节点在旧集合中的位置
     * @protected
     */
    moveChild: function(child, afterNode, toIndex, lastIndex) {
      // If the index of `child` is less than `lastIndex`, then it needs to
      // be moved. Otherwise, we do not need to move it because a child will be
      // inserted or moved before `child`.
      if (child._mountIndex < lastIndex) {
        return makeMove(child, afterNode, toIndex);
      }
    },

    /**
     * Creates a child component.
     *
     * @param {ReactComponent} child Component to create.
     * @param {string} mountImage Markup to insert.
     * @protected
     */
    createChild: function(child, afterNode, mountImage) {
      return makeInsertMarkup(mountImage, afterNode, child._mountIndex);
    },

    /**
     * Removes a child component.
     *
     * @param {ReactComponent} child Child to remove.
     * @protected
     */
    removeChild: function(child, node) {
      return makeRemove(child, node);
    },

    /**
     * Mounts a child with the supplied name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to mount.
     * @param {string} name Name of the child.
     * @param {number} index Index at which to insert the child.
     * @param {ReactReconcileTransaction} transaction
     * @private
     */
    _mountChildAtIndex: function(
      child,
      mountImage,
      afterNode,
      index,
      transaction,
      context) {
      child._mountIndex = index;
      return this.createChild(child, afterNode, mountImage);
    },

    /**
     * Unmounts a rendered child.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to unmount.
     * @private
     */
    _unmountChild: function(child, node) {
      var update = this.removeChild(child, node);
      child._mountIndex = null;
      return update;
    },

  },

};

module.exports = ReactMultiChild;
