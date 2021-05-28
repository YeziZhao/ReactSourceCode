import ThemeContext from './themeContext';
import React from 'react';
import ReactDOM from 'react-dom';
import Header from './Header';

class ContextExample extends React.Component {
    render () {
      return (
        <ThemeContext.Provider value={{background: 'green', color: 'white'}}>
          <Header />
         </ThemeContext.Provider>
      );
    }
  }
export default ContextExample;