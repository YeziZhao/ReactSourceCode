import React, { Component } from 'react';
import PropTypes from 'prop-types';
const propTypes = {
};
class RenderType extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showText: true,
            title: 'zhaoyeziTitle'
        };
    }
    
    render() {
        return (
            // 数组
            // [
            //     <button key={1}>button1</button>,
            //     <button key={2}>button2</button>,
            //     <button key={3}>button3</button>,
            // ]
            
            // null
            // null
            
            // string
            // 'hello'

            //boolean
            true
        );
    }
}
RenderType.propTypes = propTypes;
export default RenderType;