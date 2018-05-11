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
        this.setState({
            showText: !this.state.showText
        }, () => {
            console.log("this.state.showText", this.state.showText);
        });
    }
    handleClick() {

    }
    render() {
        let { name, children } = this.props;
        let { show, text } = this.state;
        return (
            <div>
                <button onClick={this.addField.bind(this)}>CLICK</button>
            {
                this.state.showText ?
                    <Button text={'button text'}/>: 
                    <Child text={'child text'}/>
            }
        </div>
        );
    }
}
User.propTypes = propTypes;
export default User;