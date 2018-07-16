// ReactUpdates模块约定了组件重绘过程的前后钩子。
// 包含ReactReconcileTransaction模块的前后钩子(可添加ComponentDidUpdate回调，及向组件提供updater参数，以使setState等方法可用)
// 包含本模块ReactUpdatesFlushTransaction函数设定的前后钩子(可添加组件重绘完成后的回调callback)
// 通过ReactUpdates.ReactReconcileTransaction提供ReactReconcileTransaction模块的接口
// 通过ReactUpdates.enqueueUpdate调用ReactDefaultBatchingStrategy模块，用于添加脏组件或触发重绘
// 通过ReactUpdates.batchedUpdates(fn)执行fn函数，并触发重绘等
'use strict';

// 用于添加，执行，重置回调队列
var CallbackQueue = require('CallbackQueue');
// 缓冲池，PooledClass.addPoolingTo(copyContructor)，用于将构造函数coyContructor转化为工厂函数。管理数据创建销毁，并将销毁的实例推入实例池PooledClass.instancePool
var PooledClass = require('PooledClass');
var ReactFeatureFlags = require('ReactFeatureFlags');
var ReactReconciler = require('ReactReconciler');
// 原型继承Transaction的某构造函数的实例将拥有perform(method,args)方法    
// 实现功能为，method函数执行前后，调用成对的前置钩子initialize、及后置钩子close；initialize为close提供参数 
var Transaction = require('Transaction');
// invariant(condition,format,a,b,c,d,e,f) condition为否值，替换format中的"%s"，并throw error报错   
var invariant = require('invariant');

var dirtyComponents = [];
var updateBatchNumber = 0;
var asapCallbackQueue = CallbackQueue.getPooled();
var asapEnqueued = false;

var batchingStrategy = null;
// 确认ReactUpdates.ReactReconcileTransaction、batchingStrategy已添加.这两个对象是通过注入的方式进行添加的
function ensureInjected() {
  invariant(
    ReactUpdates.ReactReconcileTransaction && batchingStrategy,
    'ReactUpdates: must inject a reconcile transaction class and batching ' +
    'strategy'
  );
}
// 组件更新前置钩子：将this.dirtyComponentsLength设置为dirtyComponent中脏组件的个数
// 组件更新后置钩子：重绘过程中添加脏组件，调用flushBatchedUpdates重绘添加的脏组件
var NESTED_UPDATES = {
  initialize: function() {
    this.dirtyComponentsLength = dirtyComponents.length;
  },
  close: function() {
    if (this.dirtyComponentsLength !== dirtyComponents.length) {
      // Additional updates were enqueued by componentDidUpdate handlers or
      // similar; before our own UPDATE_QUEUEING wrapper closes, we want to run
      // these new updates so that if A's componentDidUpdate calls setState on
      // B, B will update before the callback A's updater provided when calling
      // setState.
      // 在组件重绘过程中，再度添加脏组件，剔除dirtyComponents中已重绘的组件，调用flushBatchedUpdates重绘新添加的脏组件
      dirtyComponents.splice(0, this.dirtyComponentsLength);
      flushBatchedUpdates();
    } else {
      dirtyComponents.length = 0;
    }
  },
};
// 通过执行CallbackQueue回调函数队列机制，即this.callbackQueue
//  执行this.callbackQueue.enqueue(fn)注入组件更新完成后的回调callback，在runBatchedUpdates函数中实现  
// 通过Transaction添加前、后置钩子机制    
// 置钩子initialize方法用于清空回调队列；close用于触发组件更新完成后的回调callback
var UPDATE_QUEUEING = {
  initialize: function() {
    this.callbackQueue.reset();
  },
  close: function() {
    this.callbackQueue.notifyAll();
  },
};

var TRANSACTION_WRAPPERS = [NESTED_UPDATES, UPDATE_QUEUEING];

function ReactUpdatesFlushTransaction() {
  // 调用事务初始化函数，设置transactionWrapper, 初始化wrapperInitData=[]，是close的参数。并将_isInTransaction设置为false（事务进行中标识）
  this.reinitializeTransaction();
  // 脏组件个数，用于更新dirtyComponents中待重绘的脏组件  
  this.dirtyComponentsLength = null;
   // this.callbackQueue用于存储组件更新完成后的回调
  this.callbackQueue = CallbackQueue.getPooled();
  // ReactReconcileTransaction是一开始注入的对象。获取它的一个实例
  this.reconcileTransaction = ReactUpdates.ReactReconcileTransaction.getPooled(
    /* useCreateElement */ true
  );
}
// 继承Transaction
Object.assign(
  ReactUpdatesFlushTransaction.prototype,
  Transaction,
  {
     // 通过Transaction模块设定前置及后置钩子，[{initialize,close}]形式    
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    },
    // 清空ReactReconcileTransaction实例中的回调函数componentDidMount、componentDidUpdate  
    // 清空CallbackQueue中的回调函数，再销毁this.reconcileTransaction 
    destructor: function() {
      this.dirtyComponentsLength = null;
      CallbackQueue.release(this.callbackQueue);
      this.callbackQueue = null;
      ReactUpdates.ReactReconcileTransaction.release(this.reconcileTransaction);
      this.reconcileTransaction = null;
    },

    perform: function(method, scope, a) { // a为ReactReconcileTransaction实例  
      // Essentially calls `this.reconcileTransaction.perform(method, scope, a)`
      // with this transaction's wrappers around it.
       // 间接调用ReactReconcileTransaction实例的perform方法执行method，method为当前模块的runBatchedUpdates函数  
    // method执行前后既会调用ReactReconcileTransaction设定的钩子，也会调用ReactUpdatesFlushTransaction设定的钩子 
      return Transaction.perform.call(
        this,
        this.reconcileTransaction.perform,
        this.reconcileTransaction,
        method,
        scope,
        a
      );
    },
  }
);
// 通过PooledClass模块管理实例的创建ReactUpdatesFlushTransaction.getPooled ,及实例数据的销毁ReactUpdatesFlushTransaction.release  
PooledClass.addPoolingTo(ReactUpdatesFlushTransaction);
// ReactDefaultBatchingStrategy.isBatchingUpdates为否值时  
// 执行callback回调，并调用flushBatchedUpdates重绘dirtyComponents中脏组件  
// batchingStrategy.isBatchingUpdates为真值，只执行callback回调  
function batchedUpdates(callback, a, b, c, d, e) {
  ensureInjected();
  return batchingStrategy.batchedUpdates(callback, a, b, c, d, e);
}

/**
 * Array comparator for ReactComponents by mount ordering.
 *
 * @param {ReactComponent} c1 first component you're comparing
 * @param {ReactComponent} c2 second component you're comparing
 * @return {number} Return value usable by Array.prototype.sort().
 */
// 比较组件的挂载顺序  
function mountOrderComparator(c1, c2) {
  return c1._mountOrder - c2._mountOrder;
}
// 调用dirtyComponents中各组件的performUpdateIfNecessary以重绘该组件  
// 并将该组件更新完成的回调_pendingCallbacks添加到ReactUpdatesFlushTransaction后置钩子中 
function runBatchedUpdates(transaction) {
  var len = transaction.dirtyComponentsLength;
  // ReactUpdatesFlushTransaction中，前置钩子已将transaction.dirtyComponentsLength赋值为dirtyComponents.length  
  // 再作校验，以确保  
  invariant(
    len === dirtyComponents.length,
    'Expected flush transaction\'s stored dirty-components length (%s) to ' +
    'match dirty-components array length (%s).',
    len,
    dirtyComponents.length
  );

  // Since reconciling a component higher in the owner hierarchy usually (not
  // always -- see shouldComponentUpdate()) will reconcile children, reconcile
  // them before their children by sorting the array.
  // 以组件的挂载顺序排序 
  dirtyComponents.sort(mountOrderComparator);

  // Any updates enqueued while reconciling must be performed after this entire
  // batch. Otherwise, if dirtyComponents is [A, B] where A has children B and
  // C, B could update twice in a single batch if C's render enqueues an update
  // to B (since B would have already updated, we should skip it, and the only
  // way we can know to do so is by checking the batch counter).
  updateBatchNumber++;

  for (var i = 0; i < len; i++) {
    // If a component is unmounted before pending changes apply, it will still
    // be here, but we assume that it has cleared its _pendingCallbacks and
    // that performUpdateIfNecessary is a noop.
    // 若组件尚未挂载，确保组件的performUpdateIfNecessary、_pendingCallbacks为空  
    var component = dirtyComponents[i];

    // If performUpdateIfNecessary happens to enqueue any new updates, we
    // shouldn't execute the callbacks until the next render happens, so
    // stash the callbacks first
    var callbacks = component._pendingCallbacks;
    component._pendingCallbacks = null;

    var markerName;
    if (ReactFeatureFlags.logTopLevelRenders) {
      var namedComponent = component;
      // Duck type TopLevelWrapper. This is probably always true.
      if (component._currentElement.type.isReactTopLevelWrapper) {
        namedComponent = component._renderedComponent;
      }
      markerName = 'React update: ' + namedComponent.getName();
      console.time(markerName);
    }
    // ReactReconciler.performUpdateIfNecessary间接调用component.performUpdateIfNecessary重绘组件  
    // transaction.reconcileTransaction即ReactReconcileTransaction实例  
    // 用于向组件提供updater参数，使setState等方法可用；以及挂载componentDidMount、componentDidUpdate回调  
    ReactReconciler.performUpdateIfNecessary(
      component,
      transaction.reconcileTransaction,
      updateBatchNumber
    );

    if (markerName) {
      console.timeEnd(markerName);
    }
  // 将组件更新完成后需要触发执行的callbacks回调函数添加到ReactUpdatesFlushTransaction后置钩子中  
    if (callbacks) {
      for (var j = 0; j < callbacks.length; j++) {
        transaction.callbackQueue.enqueue(
          callbacks[j],
          component.getPublicInstance()
        );
      }
    }
  }
}
// 以特定钩子重绘dirtyComponents中的各组件  
// 钩子包括ReactUpdatesFlushTransaction前后钩子，含组件重绘完成后的回调_pendingCallbacks  
// 包括ReactReconcileTransaction前后钩子，含componentDidMount、componentDidUpdate回调  
var flushBatchedUpdates = function() {
  // ReactUpdatesFlushTransaction's wrappers will clear the dirtyComponents
  // array and perform any updates enqueued by mount-ready handlers (i.e.,
  // componentDidUpdate) but we need to check here too in order to catch
  // updates enqueued by setState callbacks and asap calls.
  while (dirtyComponents.length || asapEnqueued) {
    if (dirtyComponents.length) {
      // 获得ReactUpdatesFlushTransaction实例  
      var transaction = ReactUpdatesFlushTransaction.getPooled();
       // 执行runBatchedUpdates  
      // runBatchedUpdates函数调用dirtyComponents中各组件的performUpdateIfNecessary以重绘该组件  
      //    并将该组件更新完成的回调_pendingCallbacks添加到ReactUpdatesFlushTransaction后置钩子中  
      // 并执行ReactUpdatesFlushTransaction前后钩子，含组件重绘完成后的回调_pendingCallbacks  
      // 并执行ReactReconcileTransaction前后钩子，含componentDidMount、componentDidUpdate回调
      transaction.perform(runBatchedUpdates, null, transaction);
      // runBatchedUpdates及钩子函数执行完成，销毁ReactUpdatesFlushTransaction实例数据  
      ReactUpdatesFlushTransaction.release(transaction);
    }
    // ReactDefaultBatchingStrategy.batchedUpdates触发重绘时，执行asap方法添加的回调
    if (asapEnqueued) {
      asapEnqueued = false;
      var queue = asapCallbackQueue;
      asapCallbackQueue = CallbackQueue.getPooled();
      queue.notifyAll();
      CallbackQueue.release(queue);
    }
  }
};

/**
 * Mark a component as needing a rerender, adding an optional callback to a
 * list of functions which will be executed once the rerender occurs.
 */
// batchingStrategy.isBatchingUpdates即ReactDefaultBatchingStrategy.isBatchingUpdates为否值时  
// 意味batchingStrategy.batchedUpdates不在执行中，添加脏组件并调用flushBatchedUpdates重绘  
// batchingStrategy.isBatchingUpdates为真值，只向dirtyComponents中添加脏组件  
function enqueueUpdate(component) {
  ensureInjected();

  // Various parts of our code (such as ReactCompositeComponent's
  // _renderValidatedComponent) assume that calls to render aren't nested;
  // verify that that's the case. (This is called by each top-level update
  // function, like setState, forceUpdate, etc.; creation and
  // destruction of top-level components is guarded in ReactMount.)
  // batchingStrategy.isBatchingUpdates在batchingStrategy.batchedUpdates执行过程中为真，执行完成置否  
  // 通过Transition模块设置特定钩子实现，同时包含调用flushBatchedUpdates重绘脏组件的钩子  
  if (!batchingStrategy.isBatchingUpdates) {
    batchingStrategy.batchedUpdates(enqueueUpdate, component);
    return;
  }

  dirtyComponents.push(component);
  if (component._updateBatchNumber == null) {
    component._updateBatchNumber = updateBatchNumber + 1;
  }
}

/**
 * Enqueue a callback to be run at the end of the current batching cycle. Throws
 * if no updates are currently being performed.
 */
// 挂载callback回调，ReactDefaultBatchingStrategy.batchedUpdates重绘机制触发时有效  
// 也即用于挂载ReactDefaultBatchingStrategy.batchedUpdates方法重绘时的回调函数 
function asap(callback, context) {
  // ReactDefaultBatchingStrategy.batchedUpdates重绘机制未触发，报错  
  invariant(
    batchingStrategy.isBatchingUpdates,
    'ReactUpdates.asap: Can\'t enqueue an asap callback in a context where' +
    'updates are not being batched.'
  );
  asapCallbackQueue.enqueue(callback, context);
  asapEnqueued = true;
}
// 根据开发环境配置有所不同的注射器  
// 其中ReactUpdates.ReactReconcileTransaction用于约定组件挂载前后的钩子函数，添加componentDidMount、componentDidUpdate回调  
//     以及向组件构造函数传入updater参数，使setState、replaceState、forceUpdate方法可用  
// batchingStrategy用途是？？？  
var ReactUpdatesInjection = {
  injectReconcileTransaction: function(ReconcileTransaction) {
    // ReactDefaultInjection模块中，将ReactUpdates.ReactReconcileTransaction设定为ReactReconcileTransaction模块  
    invariant(
      ReconcileTransaction,
      'ReactUpdates: must provide a reconcile transaction class'
    );
    ReactUpdates.ReactReconcileTransaction = ReconcileTransaction;
  },
 // ReactDefaultInjection模块中，将batchingStrategy设定为为ReactDefaultBatchingStrategy模块
  injectBatchingStrategy: function(_batchingStrategy) {
    invariant(
      _batchingStrategy,
      'ReactUpdates: must provide a batching strategy'
    );
    invariant(
      typeof _batchingStrategy.batchedUpdates === 'function',
      'ReactUpdates: must provide a batchedUpdates() function'
    );
    invariant(
      typeof _batchingStrategy.isBatchingUpdates === 'boolean',
      'ReactUpdates: must provide an isBatchingUpdates boolean attribute'
    );
    batchingStrategy = _batchingStrategy;
  },
};

var ReactUpdates = {
  // 默认为ReactReconcileTransaction模块  
  // 实现功能为在mountComponentIntoNode函数调用指定的钩子函数，包括用户配置的componentDidMount、componentDidUpdate回调  
  // 使用方式为getPooled方法创建实例，release方法销毁实例数据  
  // perform方法执行mountComponentIntoNode函数，及前后钩子函数  
  // getReactMountReady().enqueue(fn)添加用户配置的componentDidMount、componentDidUpdate回调  
  // getReactMountReady().checkpoint()方法获取回调个数  
  // getReactMountReady().rollback(checkpoint)将回调个数设为checkpoint  
  // 另一实现功能为向组件实例注入updater参数，将向setState、replaceState、forceUpdate方法提供函数功能  
  ReactReconcileTransaction: null,
  // ReactDefaultBatchingStrategy.isBatchingUpdates为否值时  
  // 执行callback回调，并调用flushBatchedUpdates重绘dirtyComponents中脏组件  
  // batchingStrategy.isBatchingUpdates为真值，只执行callback回调 
  batchedUpdates: batchedUpdates,
  // batchingStrategy.isBatchingUpdates即ReactDefaultBatchingStrategy.isBatchingUpdates为否值时  
  // 意味batchingStrategy.batchedUpdates不在执行中，添加脏组件并调用flushBatchedUpdates重绘  
  // batchingStrategy.isBatchingUpdates为真值，只向dirtyComponents中添加脏组件  
  enqueueUpdate: enqueueUpdate,
  // 以特定钩子重绘dirtyComponents中的各组件  
  // 钩子包括ReactUpdatesFlushTransaction前后钩子，含组件重绘完成后的回调_pendingCallbacks  
  //包括ReactReconcileTransaction前后钩子，含componentDidMount、componentDidUpdate回调
  flushBatchedUpdates: flushBatchedUpdates,
  // 其中，ReactUpdates.ReactReconcileTransaction默认为ReactReconcileTransaction模块  
  // batchingStrategy默认为ReactDefaultBatchingStrategy模块  
  injection: ReactUpdatesInjection,  
  // 用于挂载ReactDefaultBatchingStrategy.batchedUpdates方法重绘时的回调函数  
  asap: asap  
};
module.exports = ReactUpdates;
