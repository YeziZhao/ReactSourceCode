import React from 'react';
import ReactDOM from 'react-dom';

// 创建context实例
const ThemeContext = React.createContext({
  background: 'red',
  color: 'white'
});

export default ThemeContext;