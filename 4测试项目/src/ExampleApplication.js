import React from 'react';
// function Child() {
//     return (
//         <a herf="#">i'am child</a>
//     );
// }
// class ExampleApplication extends React.Component {
//     constructor(props) {
//         super(props);
//         this.state = {message: 'no message'};
//     }

//     componentWillMount() {
//         //...
//     }

//     componentDidMount() {
//         /* setTimeout(()=> {
//             this.setState({ message: 'timeout state message' });
//         }, 1000); */
//     }

//     shouldComponentUpdate(nextProps, nextState, nextContext) {
//         return true;
//     }

//     componentDidUpdate(prevProps, prevState, prevContext) {
//         //...
//     }

//     componentWillReceiveProps(nextProps) {
//         //...
//     }

//     componentWillUnmount() {
//         //...
//     }

//     onClickHandler() {
//         /* this.setState({ message: 'click state message' }); */
//     }

//     render() {
//         return (
//         <div>
//             <Child />
//             <button onClick={this.onClickHandler.bind(this)}> set state button </button>
//         </div>
//         )
//     }
// }
function Button({ addField}) {
    return (
        <button onClick={ addField }>add Field</button>
    );
}
function User({name, addField}) {
    return (
        <div>
            <p>{name}</p>
            <Button addField={addField}></Button>
            hello,wold
        </div>
    );
}
export default User;