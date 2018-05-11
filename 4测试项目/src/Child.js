import React from 'react';
import PropTypes from 'prop-types';
const propTypes = {
    text: PropTypes.string
};
function Button({ addField, text }) {
    return (
        <button>{text}</button>
    );
}
Button.propTypes = propTypes;
export default Button;