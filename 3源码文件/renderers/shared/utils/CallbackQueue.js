// CallbackQueue模块用于添加，执行，重置回调函数队列
// react中，使用var Export=PooledClass.addPoolingTo(CallbackQueue)工厂化CallbackQueue构造函数，
// export.getPooled方法：实现功能是管理CallbackQueue实例的创建
// Export.release方法: 实例数据（回调函数及其执行上下文）的销毁.销毁数据的实例存入Export.instancePool实例池中，可通过Export.getPooled方法取

'use strict';
// 引入事务
var PooledClass = require('PooledClass');
var invariant = require('invariant');

class CallbackQueue<T> {
  _callbacks: ?Array<() => void>;
  _contexts: ?Array<T>;
  _arg: ?mixed;

  constructor(arg) {
    this._callbacks = null;
    this._contexts = null;
    this._arg = arg;
  }

  /**
   * Enqueues a callback to be invoked when `notifyAll` is invoked.
   *
   * @param {function} callback Invoked when `notifyAll` is invoked.
   * @param {?object} context Context to call `callback` with.
   * @internal
   */
  enqueue(callback: () => void, context: T) {
    this._callbacks = this._callbacks || [];
    this._callbacks.push(callback);
    this._contexts = this._contexts || [];
    this._contexts.push(context);
  }

  /**
   * Invokes all enqueued callbacks and clears the queue. This is invoked after
   * the DOM representation of a component has been created or updated.
   *
   * @internal
   */
  notifyAll() {
    var callbacks = this._callbacks;
    var contexts = this._contexts;
    var arg = this._arg;
    if (callbacks && contexts) {
      invariant(
        callbacks.length === contexts.length,
        'Mismatched list of contexts in callback queue'
      );
      this._callbacks = null;
      this._contexts = null;
      for (var i = 0; i < callbacks.length; i++) {
        callbacks[i].call(contexts[i], arg);
      }
      callbacks.length = 0;
      contexts.length = 0;
    }
  }

  checkpoint() {
    return this._callbacks ? this._callbacks.length : 0;
  }

  rollback(len: number) {
    if (this._callbacks && this._contexts) {
      this._callbacks.length = len;
      this._contexts.length = len;
    }
  }

  /**
   * Resets the internal queue.
   *
   * @internal
   */
  reset() {
    this._callbacks = null;
    this._contexts = null;
  }

  /**
   * `PooledClass` looks for this.
   */
  destructor() {
    this.reset();
  }
}

module.exports = PooledClass.addPoolingTo(CallbackQueue);
