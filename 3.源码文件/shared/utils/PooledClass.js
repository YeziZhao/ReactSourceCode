/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule PooledClass
 * @flow
 */

'use strict';

var invariant = require('invariant');

/**
 * Static poolers. Several custom versions for each potential number of
 * arguments. A completely generic pooler is easy to implement, but would
 * require accessing the `arguments` object. In each of these, `this` refers to
 * the Class itself, not an instance. If any others are needed, simply add them
 * here, or in their own files.
 */
var oneArgumentPooler = function(copyFieldsFrom) {
  var Klass = this;
  // 当前缓存池里的实例个数不为空
  if (Klass.instancePool.length) {
    // 获取缓存池中的一个实例
    var instance = Klass.instancePool.pop();
    // 修改instance上的字段
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    // 返回新实例
    return new Klass(copyFieldsFrom);
  }
};
var twoArgumentPooler = function(a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function(a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

var fourArgumentPooler = function(a1, a2, a3, a4) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4);
  }
};

// 缓存池中去除的对象，使用完毕后需要调用release方法，将该实例返回缓存池
var standardReleaser = function(instance) {
  var Klass = this;
  invariant(
    instance instanceof Klass,
    'Trying to release an instance into a pool of a different type.'
  );
  // 如果Klass类上存在destructor，则调用(当不再需要这个对象的时候，就需要调用destructor，来释放这个对象所占的内存)
  instance.destructor();
  // 如果Klass的缓冲池个数小于最大存放个数，则放入缓冲池
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

type Pooler = any;

/**
 * Augments `CopyConstructor` to be a poolable class, augmenting only the class
 * itself (statically) not adding any prototypical fields. Any CopyConstructor
 * you give this may have a `poolSize` property, and will look for a
 * prototypical `destructor` on instances.
 *
 * @param {Function} CopyConstructor Constructor that can be used to reset.
 * @param {Function} pooler Customizable pooler.
 */
var addPoolingTo = function<T>(
  CopyConstructor: Class<T>,
  pooler: Pooler,
): Class<T> & {
  getPooled(/* arguments of the constructor */): T;
  release(): void;
} {
  // Casting as any so that flow ignores the actual implementation and trusts
  // it to match the type we declared
  // CopyConstructor 赋值给NewKlass
  var NewKlass = (CopyConstructor: any);
  // instancePool: 保存当前需要缓冲的类的实例对象
  NewKlass.instancePool = [];
  // 如果传入了pooler函数，则使用参数的值，否则使用默认一个参数的处理函数
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  // poolSize：存储一个number类型的值，表示最大缓冲的实例对象的个数
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  // 释放不再需要使用的对象的处理函数
  NewKlass.release = standardReleaser;
  return NewKlass;
};

// 将oneArgumentPooler，twoArgumentPooler也导出，可以通过addPoolingTo的第二个参数传入，自定义参数处理函数
var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: (oneArgumentPooler: Pooler),
  twoArgumentPooler: (twoArgumentPooler: Pooler),
  threeArgumentPooler: (threeArgumentPooler: Pooler),
  fourArgumentPooler: (fourArgumentPooler: Pooler),
};

module.exports = PooledClass;
