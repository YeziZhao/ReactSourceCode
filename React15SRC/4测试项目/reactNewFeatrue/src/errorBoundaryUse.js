import React, { Component } from 'react';
import ErrorBoundary from './errorBoundary';

class UseError extends Component {
    constructor(props) {
        super(props);
    }
    render(){
        return (
            <div>
                <ErrorBoundary>
                    <div>假如我出错了，ErrorBoundary会捕获异常</div>
                </ErrorBoundary>
                <button onClick={this.onClick}>Update</button>
            </div>
        )
    }
}