import React from 'react';
import PropTypes from 'prop-types';
import Child from './refChid';
const propTypes = {
};

class RefComponent extends React.Component {
    constructor(props) {
        super(props);
        // 创建
        this.myRef = React.createRef();
        this.focusTextInput = this.focusTextInput.bind(this);
    }
    componentDidMount(){
        console.log(this.myRef.current.value);
        //render之后就可以输出该ref指向的那个节点
    }
    focusTextInput () {
        this.myRef.current.focus();
        console.log(this.myRef.current.value);
    }
  
    render() {
        // 使用
        return (
            <Child 
            inputRef={this.myRef}
            focusTextInput={this.focusTextInput}
        />
        );
    }
}
RefComponent.propTypes = propTypes;
export default RefComponent;