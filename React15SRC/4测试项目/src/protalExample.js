import React, { Component } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
const propTypes = {
    children: PropTypes.any
};
class ProtalExample extends Component {
    constructor(props) {
        super(props);
        
    }
    
    render() {
        const modalNode = document.getElementById('modalNode');
        return (
            createPortal(this.props.children, modalNode)
        );
    }
}
ProtalExample.propTypes = propTypes;
export default ProtalExample;