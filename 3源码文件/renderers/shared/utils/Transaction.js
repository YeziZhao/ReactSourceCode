/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Transaction
 * @flow
 */

'use strict';
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错  
var invariant = require('invariant');

var OBSERVED_ERROR = {};

/**
 * `Transaction` creates a black box that is able to wrap any method such that
 * certain invariants are maintained before and after the method is invoked
 * (Even if an exception is thrown while invoking the wrapped method). Whoever
 * instantiates a transaction can provide enforcers of the invariants at
 * creation time. The `Transaction` class itself will supply one additional
 * automatic invariant for you - the invariant that any transaction instance
 * should not be run while it is already being run. You would typically create a
 * single instance of a `Transaction` for reuse multiple times, that potentially
 * is used to wrap several different methods. Wrappers are extremely simple -
 * they only require implementing two methods.
 *
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 *
 * Use cases:
 * - Preserving the input selection ranges before/after reconciliation.
 *   Restoring selection even in the event of an unexpected error.
 * - Deactivating events while rearranging the DOM, preventing blurs/focuses,
 *   while guaranteeing that afterwards, the event system is reactivated.
 * - Flushing a queue of collected DOM mutations to the main UI thread after a
 *   reconciliation takes place in a worker thread.
 * - Invoking any collected `componentDidUpdate` callbacks after rendering new
 *   content.
 * - (Future use case): Wrapping particular flushes of the `ReactWorker` queue
 *   to preserve the `scrollTop` (an automatic scroll aware DOM).
 * - (Future use case): Layout calculations before and after DOM updates.
 *
 * Transactional plugin API:
 * - A module that has an `initialize` method that returns any precomputation.
 * - and a `close` method that accepts the precomputation. `close` is invoked
 *   when the wrapped process is completed, or has failed.
 *
 * @param {Array<TransactionalWrapper>} transactionWrapper Wrapper modules
 * that implement `initialize` and `close`.
 * @return {Transaction} Single transaction for reuse in thread.
 *
 * @class Transaction
 */
// 用于某函数method执行前后，添加前置钩子函数initialize和后置钩子函数close.前置钩子函数的意义是为向后置钩子提供参数
// reinitializeWrapper: 是该实例初始化时执行
// getTransactionWrappers: 用于添加前、后置钩子。返回是[{initialize:function(){}, close:function(){}}]形式
// perform(method, arg): 用于触发前置钩子initialize、method(arg), 后置钩子close的顺序执行
var TransactionImpl = {
  /**
   * Sets up this instance so that it is prepared for collecting metrics. Does
   * so such that this setup method may be used on an instance that is already
   * initialized, in a way that does not consume additional memory upon reuse.
   * That can be useful if you decide to make your subclass of this mixin a
   * "PooledClass".
   */
  // 初始化事务
  reinitializeTransaction: function(): void {
    // 将前置钩子和后置钩子transactionWrapper添加到this.transactionWrappers中（父Transaction·这个值为空，每个子类里面都有自己的transaxtionWrapper对象）
    this.transactionWrappers = this.getTransactionWrappers();
    // 初始化后置钩子close方法的参数，由前置钩子initialize方法返回值构成  
    if (this.wrapperInitData) {
      this.wrapperInitData.length = 0;
    } else {
      this.wrapperInitData = [];
    }
    // 当前正在执行事务的标志设置为false
    this._isInTransaction = false;
  },
  // 是否是正在运行中的事务
  _isInTransaction: false,

  // 用于添加method方法的前置钩子及后置钩子transactionWrapper={initialize:function(){},close:function(){}}  
  // 前置钩子initialize方法为后置钩子close方法提供参数，且存放于this.wrapperInitData中  
  // 返回值形如[{initialize:function(){},close:function(){}}]  
  getTransactionWrappers: null,

  // 判断perform方法执行与否，由此断定closeAll方法是外部调用还是内部调用(不允许外部调用)
  isInTransaction: function(): boolean {
    return !!this._isInTransaction;
  },

  // 外部接口，执行各个钩子initialize放啊，随后执行method方法，最后执行close钩子方法
  perform: function<
    A, B, C, D, E, F, G,
    T: (a: A, b: B, c: C, d: D, e: E, f: F) => G // eslint-disable-line space-before-function-paren
  >(
    method: T, scope: any,
    a: A, b: B, c: C, d: D, e: E, f: F,
  ): G {
    !!this.isInTransaction() // 判断当前事务是否正在执行。实例的perform方法单次只能执行一个 
    invariant(
      !this.isInTransaction(),
      'Transaction.perform(...): Cannot initialize a transaction when there ' +
      'is already an outstanding transaction.'
    );
     // 记录执行过程中是否抛出错误
     var errorThrown;
     // 记录目标函数执行之后的返回值
     var ret;
    try {
      // 对当前的事务加锁，同一时间只能处理一个事务
      this._isInTransaction = true;
      // Catching errors makes debugging more difficult, so we start with
      // errorThrown set to true before setting it to false after calling
      // close -- if it's still set to true in the finally block, it means
      // one of these calls threw.
      // 假设抛出错误
      errorThrown = true;
      // 调用initializeAll，调用所有wrapper的initialize方法
      this.initializeAll(0);
      // 执行真正的目标函数
      ret = method.call(scope, a, b, c, d, e, f);
      // 结束假设抛出错误
      errorThrown = false;
    } finally {
      try {
        // 不管异常还是不异常，都会调用wrapper的close方法
        // 假如抛出异常
        if (errorThrown) {
          // If `method` throws, prefer to show that stack trace over any thrown
          // by invoking `closeAll`.
          try {
            this.closeAll(0);
          } catch (err) {
          }
        } else {
          // Since `method` didn't throw, we don't want to silence the exception
          // here.
          this.closeAll(0);
        }
      } finally {
        // 最后关闭事务
        this._isInTransaction = false;
      }
    }
    return ret;
  },
  // 内部调用，在method函数执行前，调用前置钩子transactionWrapper中的initialize方法  
  initializeAll: function(startIndex: number): void {
    // 获取自身的transactionWrappers
    var transactionWrappers = this.transactionWrappers;
    // 遍历transactionWrappers
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      try {
        // 先使用一个空对象设置到this.wrapperInitData[i]
        this.wrapperInitData[i] = OBSERVED_ERROR;
        // 从wrapper中获取是否有值，有则返回调用结果
        this.wrapperInitData[i] = wrapper.initialize ?
          wrapper.initialize.call(this) :
          null;
      } finally {
        // 如果wrapper.initialize李没有值，则继续调用下一个wrapper
        if (this.wrapperInitData[i] === OBSERVED_ERROR) {
          try {
            this.initializeAll(i + 1);
          } catch (err) {
          }
        }
      }
    }
  },

// 内部调用，在method函数执行后，调用后置钩子transactionWrapper中的initialize方法  
  closeAll: function(startIndex: number): void {
    invariant(
      this.isInTransaction(),
      'Transaction.closeAll(): Cannot close transaction when none are open.'
    );
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      // 获取当前的wrapper
      var wrapper = transactionWrappers[i];
      // 前置钩子返回值 
      var initData = this.wrapperInitData[i];
      var errorThrown;
      try {
        // 先假设异常
        errorThrown = true;
        // 调用wrapper的close方法，并将initData传入
        if (initData !== OBSERVED_ERROR && wrapper.close) {
          wrapper.close.call(this, initData);
        }
        // 解除假设失败
        errorThrown = false;
      } finally {
        // 如果失败，需要将游标向前加1，继续后续wrapper的调用
        if (errorThrown) {
          try {
            this.closeAll(i + 1);
          } catch (e) {
          }
        }
      }
    }
    // 清空提供给后置钩子close方法的参数
    this.wrapperInitData.length = 0;
  },
};

export type Transaction = typeof TransactionImpl;

module.exports = TransactionImpl;
