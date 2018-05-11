/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 */

'use strict';
// 用于更新或挂在用户自定义组件的协调器
var ReactCompositeComponent = require('ReactCompositeComponent');
// 用于创建空组件
var ReactEmptyComponent = require('ReactEmptyComponent');
// 用于创建React封装DOM标签组件/或文本组件
var ReactHostComponent = require('ReactHostComponent');

var getNextDebugID = require('getNextDebugID');
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错  
var invariant = require('invariant');
// warning(condition,format) condition为否值，替换format中的"%s"，并console.error警告
var warning = require('warning');

// 继承ReactCompositeComponent,并将instantiateReactComonent赋值给原型方法，避免循环因爱。用于挂载用户自定义组件创建的元素
var ReactCompositeComponentWrapper = function(element) {
  // 调用ReactCompositeComponent上的construct
  this.construct(element);
};
Object.assign(
  ReactCompositeComponentWrapper.prototype,
  ReactCompositeComponent,
  {
    _instantiateReactComponent: instantiateReactComponent,
  }
);
// 适用于提示require加载的文件没有export 
function getDeclarationErrorAddendum(owner) {
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

// 内部组件书写形式，包含mountComponent/receiveComponent.用于挂载组件。用于自定义的组件包含render方法，指示待绘制的ReactNode包含哪些元素，挂载mountComponent却通过内部组件实现
function isInternalComponentType(type) {
  return (
    typeof type === 'function' &&
    typeof type.prototype !== 'undefined' &&
    typeof type.prototype.mountComponent === 'function' &&
    typeof type.prototype.receiveComponent === 'function'
  );
}

// 参数node是ReactNode（ReactElement || ReactFragment || ReactText）,其中ReactElement又可以分为ReactComponentElement|| ReactDOMElement
function instantiateReactComponent(node, shouldHaveDebugID) {
  var instance;

  // 空组件，由ReactEmptyComponent默认调用ReactDOMEmptyComponent创建  
  if (node === null || node === false) {
    instance = ReactEmptyComponent.create(instantiateReactComponent);

  // 当node==object，则将node封装为标签组件或者自定义组件处理
  } else if (typeof node === 'object') {
    var element = node;
    var type = element.type;
    // type类型错误报错，提示require加载的文件没有export  
    if (
      typeof type !== 'function' &&
      typeof type !== 'string'
    ) {
      var info = '';
      if (__DEV__) {
        if (
          type === undefined ||
          typeof type === 'object' &&
          type !== null &&
          Object.keys(type).length === 0
        ) {
          info +=
            ' You likely forgot to export your component from the file ' +
            'it\'s defined in.';
        }
      }
      info += getDeclarationErrorAddendum(element._owner);
      invariant(
        false,
        'Element type is invalid: expected a string (for built-in components) ' +
        'or a class/function (for composite components) but got: %s.%s',
        type == null ? type : typeof type,
        info,
      );
    }

    // // 当node节点的type是string,则初始化DOM标签组件
    if (typeof element.type === 'string') {
      // DOM标签（ReactDOMComponent）
      instance = ReactHostComponent.createInternalComponent(element);
      // 如果时React内部组件(实现了mountComponent等方法)不能使用字符串引用的暂时替代方案
    } else if (isInternalComponentType(element.type)) {
      instance = new element.type(element);
      // 维持旧有api的有效性 
      if (!instance.getHostNode) {
        instance.getHostNode = instance.getNativeNode;
      }

    // 自定义组件，创建原型几成ReactCompositeComponent类的ReactCompositeComponentWrapper实例
    } else {
      instance = new ReactCompositeComponentWrapper(element);
    }
  
  // 当 node 类型为字符串或数字时，初始化文本组件
  // 当node类型为文本节点时不算Virsual DOM.但是React为了保证渲染的一致性，将其封装为文本组件ReactDOMTextComponent
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactHostComponent.createInstanceForText(node);
  } else {
    invariant(
      false,
      'Encountered invalid React node of type %s',
      typeof node
    );
  }

  if (__DEV__) {
    warning(
      typeof instance.mountComponent === 'function' &&
      typeof instance.receiveComponent === 'function' &&
      typeof instance.getHostNode === 'function' &&
      typeof instance.unmountComponent === 'function',
      'Only React Components can be mounted.'
    );
  }

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  // 初始化参数
  instance._mountIndex = 0;
  instance._mountImage = null;

  if (__DEV__) {
    instance._debugID = shouldHaveDebugID ? getNextDebugID() : 0;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if (__DEV__) {
    // Object.preventExtensions使对象属性不可扩展，但可修改  
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}

module.exports = instantiateReactComponent;
