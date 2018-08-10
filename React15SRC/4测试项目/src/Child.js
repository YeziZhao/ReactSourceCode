import React, { Component } from 'react';
import PropTypes from 'prop-types';
const propTypes = {
    text: PropTypes.string
};

class Button extends Component {
    constructor(props) {
        super(props);
    }
    render() {
        return <button>{this.props.text}</button>
    }
}
export default Button;