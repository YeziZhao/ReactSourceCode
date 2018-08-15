import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Button from './Child';
import Child from './Child2';
const propTypes = {
    name: PropTypes.string,
    children: PropTypes.string
};
class User extends Component {
    constructor(props) {
        super(props);
        this.state = {
            showText: true,
            title: 'zhaoyeziTitle'
        };
    }
    addField() {
        console.log('-----------------------------I an checking -------------hjhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh')
        this.setState({
            showText: false
        }, function() {
            console.log(1)
        });
    }
    capture() {
        console.log('--------------------------this.capture.bind(this) called')
    }
    render() {
        let { name, children } = this.props;
        let { show, text } = this.state;
        let styleObj ={
            display: this.state.showText ? true: false
        };
        return (
            <React.Fragment>
                <button onClick={this.addField.bind(this)} onClickCapture={this.capture.bind(this)}>CLICK</button>
                <button style={styleObj} onClick={this.addField.bind(this)} onClickCapture={this.capture.bind(this)}>CLICK</button>
                <button style={styleObj} onClick={this.addField.bind(this)} onClickCapture={this.capture.bind(this)}>CLICK</button>
          </React.Fragment>
            
        );
    }
}
User.propTypes = propTypes;
export default User;