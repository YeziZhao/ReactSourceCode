// 提供给ReactChilren模块使用，用于遍历ReactNode形式的集合props.children获取其他props属性
'use strict';
// 容器组件，用户自定义组件的ReactCompositeComponent实例化、render过程中，给ReactCurrentOwner.owner赋值  
var ReactCurrentOwner = require('ReactCurrentOwner');
// 判断是否ReactElement
var REACT_ELEMENT_TYPE = require('ReactElementSymbol');

var getIteratorFn = require('getIteratorFn');
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错   
var invariant = require('invariant');
// 用于React元素的key属性转化  
var KeyEscapeUtils = require('KeyEscapeUtils');
// warning(condition,format) condition为否值，替换format中的"%s"，并console.error警告  
var warning = require('warning');

var SEPARATOR = '.';
var SUBSEPARATOR = ':';

/**
 * This is inlined from ReactElement since this file is shared between
 * isomorphic and renderers. We could extract this to a
 *
 */

/**
 * TODO: Test that a single child and an array with one item have the same key
 * pattern.
 */

var didWarnAboutMaps = false;

/**
 * Generate a key string that identifies a component within a set.
 *
 * @param {*} component A component that could contain a manual key.
 * @param {number} index Index that is used if a manual key is not provided.
 * @return {string}
 */
function getComponentKey(component, index) {
  // Do some typechecking here since we call this blindly. We want to ensure
  // that we don't block potential future ES APIs.
  if (component && typeof component === 'object' && component.key != null) {
    // Explicit key
    // 正则替换"="或":"为"=0"、"=2"
    return KeyEscapeUtils.escape(component.key);
  }
  // Implicit key determined by the index in the set
  return index.toString(36);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
// callback: 作为回调函数的首参
// traverseContext作为引用传递输出的最终结果result，用于将子元素扁平化。
// 当props.children为单节点形式时，对该节点执行callback回调，间接执行traverseContext.func函数  
// 当props.children为嵌套节点形式时，递归调用traverseAllChildrenImpl遍历子孙节点，通过callback回调执行traverseContext.func函数  
function traverseAllChildrenImpl(
  children,
  nameSoFar,
  callback,
  traverseContext
) {
  var type = typeof children;

  if (type === 'undefined' || type === 'boolean') {
    // All of the above are perceived as null.
    children = null;
  }
  // 作为单一节点ReactNode处理，通过回调callback间接执行traverseContext.func函数或塞入traverseContext中  
  if (children === null ||
      type === 'string' ||
      type === 'number' ||
      // The following is inlined from ReactElement. This means we can optimize
      // some checks. React Fiber also inlines this logic for similar purposes.
      (type === 'object' && children.$$typeof === REACT_ELEMENT_TYPE)) {
    callback(
      traverseContext,
      children,
      // If it's the only child, treat the name as if it was wrapped in an array
      // so that it's consistent if the number of children grows.
      nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar
    );
    return 1;
  }

  var child;
  var nextName;
  var subtreeCount = 0; // // 统计props.children中含有的节点个数  
  var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR;
  // props.children成数组形式，遍历子孙节点执行callback回调  
  // 通过回调callback间接执行traverseContext.func函数或塞入traverseContext中  
  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getComponentKey(child, i);
      subtreeCount += traverseAllChildrenImpl(
        child,
        nextName,
        callback,
        traverseContext
      );
    }
  // props.children为迭代器，遍历子孙节点执行callback回调  
  // 通过回调callback间接执行traverseContext.func函数或塞入traverseContext中
  } else {
    var iteratorFn = getIteratorFn(children);
    if (iteratorFn) {
      var iterator = iteratorFn.call(children);
      var step;
      if (iteratorFn !== children.entries) {
        var ii = 0;
        while (!(step = iterator.next()).done) {
          child = step.value;
          nextName = nextNamePrefix + getComponentKey(child, ii++);
          subtreeCount += traverseAllChildrenImpl(
            child,
            nextName,
            callback,
            traverseContext
          );
        }
      } else {
        if (__DEV__) {
          var mapsAsChildrenAddendum = '';
          if (ReactCurrentOwner.current) {
            var mapsAsChildrenOwnerName = ReactCurrentOwner.current.getName();
            if (mapsAsChildrenOwnerName) {
              mapsAsChildrenAddendum = ' Check the render method of `' + mapsAsChildrenOwnerName + '`.';
            }
          }
          warning(
            didWarnAboutMaps,
            'Using Maps as children is not yet fully supported. It is an ' +
            'experimental feature that might be removed. Convert it to a ' +
            'sequence / iterable of keyed ReactElements instead.%s',
            mapsAsChildrenAddendum
          );
          didWarnAboutMaps = true;
        }
        // Iterator will provide entry [k,v] tuples rather than values.
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry) {
            child = entry[1];
            nextName = (
              nextNamePrefix +
              KeyEscapeUtils.escape(entry[0]) + SUBSEPARATOR +
              getComponentKey(child, 0)
            );
            subtreeCount += traverseAllChildrenImpl(
              child,
              nextName,
              callback,
              traverseContext
            );
          }
        }
      }
      // 不能接受的对象格式数据，输出相应的错误
    } else if (type === 'object') {
      var addendum = '';
      if (__DEV__) {
        addendum =
          ' If you meant to render a collection of children, use an array ' +
          'instead or wrap the object using createFragment(object) from the ' +
          'React add-ons.';
        if (children._isReactElement) {
          addendum =
            ' It looks like you\'re using an element created by a different ' +
            'version of React. Make sure to use only one copy of React.';
        }
        if (ReactCurrentOwner.current) {
          var name = ReactCurrentOwner.current.getName();
          if (name) {
            addendum += ' Check the render method of `' + name + '`.';
          }
        }
      }
      var childrenString = String(children);
      invariant(
        false,
        'Objects are not valid as a React child (found: %s).%s',
        childrenString === '[object Object]' ?
          'object with keys {' + Object.keys(children).join(', ') + '}' :
          childrenString,
        addendum
      );
    }
  }

  return subtreeCount;
}

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 * @return {!number} The number of children in this subtree.
 */
// 用于遍历props.children或其他props属性(传递ReactNode)，执行callback回调函数  
// callback执行过程调用traverseContext.func对child进行处理，或者将child塞入traverseContext中
function traverseAllChildren(children, callback, traverseContext) {
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, '', callback, traverseContext);
}
// traverseAllChildren(children,function(traverseContext,child,name){}, traverseContext){}函数的第三个参数将作为回调函数的首参  
// react包下ReactChildren模块中，traverseContext存储遍历的执行函数，用于执行traverseContext.func方法  
// react包下flattenChildren模块中，traverseContext作为引用传递输出的最终结果result，用于将子元素扁平化  
// react包下ReactChildReconciler模块中，traverseContext获取props.children相关react组件实例的集合
module.exports = traverseAllChildren;
