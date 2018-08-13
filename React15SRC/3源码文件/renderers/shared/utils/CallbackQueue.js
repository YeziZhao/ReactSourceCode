// CallbackQueue模块用于添加，执行，重置回调函数队列
// react中，使用var Export=PooledClass.addPoolingTo(CallbackQueue)工厂化CallbackQueue构造函数，
// export.getPooled方法：实现功能是管理CallbackQueue实例的创建
// Export.release方法: 实例数据（回调函数及其执行上下文）的销毁.销毁数据的实例存入Export.instancePool实例池中，可通过Export.getPooled方法取

'use strict';
// 引入事务：PooledClass.addPoolin gTo(copyContructor)用于将构造函数copyContructor转化为工厂函数，
// 意义在于管理实例数据的创建和销毁。并将销毁数据的实例推入到实例池copyContructor.instancePool中
var PooledClass = require('PooledClass');
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错  
var invariant = require('invariant');

// 用于添加、执行、重置回调函数队列。react中实际使用是用于挂载componentDidMount等钩子方法
// 通过PooledClass模块管理实例创建的CallbackQueue.getPooled.以及实例数据的销毁CallbackQueue.release
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
   * @param {?object} context Context to c   all `callback` with.
   * @internal
   */
  // 往回调队列中添加函数及其执行的上下文环境，通过notifyAll方法触发
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
  // 触发回调函数队列的函数的执行。回调函数个数与其执行上下文参数个数不匹配则报错
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
  // 获取回调函数队列中的回调函数个数
  checkpoint() {
    return this._callbacks ? this._callbacks.length : 0;
  }
  // 将回调函数队列中的回调函数个数设定为参数len
  rollback(len: number) {
    if (this._callbacks && this._contexts) {
      this._callbacks.length = len;
      this._contexts.length = len;
    }
  }

  // 重置回调函数队列 
  reset() {
    this._callbacks = null;
    this._contexts = null;
  }

  // PooledClass 模块装饰需要，设置destructor方法供release方法调用，用于销毁实例数据
  destructor() {
    this.reset();
  }
}
// 通过PooledClass模块管理实例的创建CallBackQueue.getPooled。以及实例数据的销毁CallBackQueue.release
module.exports = PooledClass.addPoolingTo(CallbackQueue);
