// 用于获取当前浏览器下anmation、transition类事件名

'use strict';
// ExecutionEnvironment.canUseDOM用于判断平台是否可以操作dom节点
var ExecutionEnvironment = require('ExecutionEnvironment');

/**
 * Generate a mapping of standard vendor prefixes using the defined style property and event name.
 *
 * @param {string} styleProp
 * @param {string} eventName
 * @returns {object}
 */
// 获取不同浏览器下animationend、animationiteration、animationstart、transitionend类事件的名称 
function makePrefixMap(styleProp, eventName) {
  var prefixes = {};

  prefixes[styleProp.toLowerCase()] = eventName.toLowerCase();
  prefixes['Webkit' + styleProp] = 'webkit' + eventName;
  prefixes['Moz' + styleProp] = 'moz' + eventName;
  prefixes['ms' + styleProp] = 'MS' + eventName;
  prefixes['O' + styleProp] = 'o' + eventName.toLowerCase();

  return prefixes;
}

/**
 * A list of event names to a configurable list of vendor prefixes.
 */
// 对象形式缓存animationend、animationiteration、animationstart、transitionend事件名，内含不同浏览器下的不同事件名  
// 通过for...in语句，加document.createElement('div').style，选取当前浏览器下的事件名  
var vendorPrefixes = {
  animationend: makePrefixMap('Animation', 'AnimationEnd'),
  animationiteration: makePrefixMap('Animation', 'AnimationIteration'),
  animationstart: makePrefixMap('Animation', 'AnimationStart'),
  transitionend: makePrefixMap('Transition', 'TransitionEnd'),
};

/**
 * Event names that have already been detected and prefixed (if applicable).
 */
// / 缓存当前浏览器的animationend、animationiteration、animationstart、transitionend事件名  
var prefixedEventNames = {};

/**
 * Element to check for prefixes on.
 */
// 缓存当前浏览器支持的样式
var style = {};

/**
 * Bootstrap if a DOM exists.
 */
if (ExecutionEnvironment.canUseDOM) {
  style = document.createElement('div').style;

  // On some platforms, in particular some releases of Android 4.x,
  // the un-prefixed "animation" and "transition" properties are defined on the
  // style object but the events that fire will still be prefixed, so we need
  // to check if the un-prefixed events are usable, and if not remove them from the map.
   // Android 4.x使用无前缀的animation、transition样式，但是事件名却使用带前缀的样式  
  if (!('AnimationEvent' in window)) {
    delete vendorPrefixes.animationend.animation;
    delete vendorPrefixes.animationiteration.animation;
    delete vendorPrefixes.animationstart.animation;
  }

  // Same as above
  if (!('TransitionEvent' in window)) {
    delete vendorPrefixes.transitionend.transition;
  }
}

/**
 * Attempts to determine the correct vendor prefixed event name.
 *
 * @param {string} eventName
 * @returns {string}
 */
// 获取当前浏览器支持的animationend、animationiteration、animationstart、transitionend事件名  
function getVendorPrefixedEventName(eventName) {
  if (prefixedEventNames[eventName]) {
    return prefixedEventNames[eventName];

  // eventName不是animationend、animationiteration、animationstart、transitionend，直接返回  
  } else if (!vendorPrefixes[eventName]) {
    return eventName;
  }
  // prefixMap为对象形式，不同浏览器下的同类事件名  
  var prefixMap = vendorPrefixes[eventName];
  // 获取当前浏览器支持的事件名，并作缓存 
  for (var styleProp in prefixMap) {
    if (prefixMap.hasOwnProperty(styleProp) && styleProp in style) {
      return prefixedEventNames[eventName] = prefixMap[styleProp];
    }
  }

  return '';
}

module.exports = getVendorPrefixedEventName;
