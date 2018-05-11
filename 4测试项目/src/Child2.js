import React from 'react';
import PropTypes from 'prop-types';
const propTypes = {
    text: PropTypes.string
};
function Child2({ text }) {
    return (
        <button>{text}</button>
    );
}
Child2.propTypes = propTypes;
export default Child2;