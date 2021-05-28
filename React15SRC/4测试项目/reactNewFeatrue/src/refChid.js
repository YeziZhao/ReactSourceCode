import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
    inputRef: PropTypes.object,
    focusTextInput: PropTypes.func
};
function Child({
    inputRef,
    focusTextInput
}){
    return <input ref={inputRef} onFocus={focusTextInput}></input>;
  }
Child.propTypes = propTypes;

export default Child;