/*eslint-disable no-console */
/*eslint-disable import/default */
import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import FragmentComponent from './FragmentExample';
import TypeComponent from './renderType';
import ProtalExample from './protalExample';
import RefComponent from './refExample';
import ContextExample from './contextExample';

ReactDOM.render(
    <FragmentComponent name={'zhaoyehong'}>hello, yezi</FragmentComponent>,
    // <TypeComponent/>,
    // <ProtalExample>
    //     <FragmentComponent name={'zhaoyehong'}>hello, yezi</FragmentComponent>
    // </ProtalExample> , 
    // <RefComponent/>,
    // <ContextExample/>,
    document.getElementById('app')
);
