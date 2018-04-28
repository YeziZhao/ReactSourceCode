import webpack from 'webpack';
import path from 'path';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
var BomPlugin = require('webpack-utf8-bom');//将文件转成utf-8 bom格式，解决中文乱码的问题
const GLOBALS = {
    'process.env.NODE_ENV': JSON.stringify('production')
};

export default {
    devtool: 'hidden-source-map',
    entry: {
        index: [
            './src/index'
        ]
    },
    target: 'web',
    output: {
        path: path.join(__dirname, '../dist'),   // Note: Physical files are only output by the production build
        publicPath: '/dist/',
        filename: '[name].js'
    },
    devServer: {
        contentBase: './dist'
    },
    plugins: [
        new webpack.optimize.OccurrenceOrderPlugin(),
        new webpack.DefinePlugin(GLOBALS),
        new ExtractTextPlugin('[name].css'),
        new webpack.optimize.UglifyJsPlugin(),
        new HtmlWebpackPlugin({
            title: 'Notice',
            minify: {
                collapseWhitespace: true,
                removeComments: true
            },
            hash: true,
            chunks: ['index'],
            filename: 'notice/index.html',
            template: './src/index.html'
        }),
        new HtmlWebpackPlugin({
            title: 'Notice',
            minify: {
                collapseWhitespace: true,
                removeComments: true
            },
            hash: true,
            chunks: ['index'],
            filename: 'notice/detail.html',
            template: './src/index.html'
        }),
        new HtmlWebpackPlugin({
            title: 'Update',
            minify: {
                collapseWhitespace: true,
                removeComments: true
            },
            hash: true,
            chunks: ['index'],
            filename: 'update/index.html',
            template: './src/index.html'
        }),
        new HtmlWebpackPlugin({
            title: 'Update',
            minify: {
                collapseWhitespace: true,
                removeComments: true
            },
            hash: true,
            chunks: ['index'],
            filename: 'update/detail.html',
            template: './src/index.html'
        }),
        new BomPlugin(true, /\.(html|js|css)$/),//解决cshtml中文乱码的问题
    ],
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: 'babel-loader'
            },
            {
                test: /\.css$/,
                loader: ExtractTextPlugin.extract({
                    fallback: 'style-loader',
                    use: [
                        {
                            loader: 'css-loader',
                            options: {
                                sourceMap: true,
                                importLoaders: 1,
                                localIdentName: '[name]__[local]',  // [name]__[local]--[hash:base64:5] -> name: module name, local: original name
                                modules: true
                            }
                        },
                        {
                            loader: 'postcss-loader',
                            options: {
                                sourceMap: 'inline'
                            }
                        }
                    ]
                })
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'images/[name].[ext]'
                        }
                    }
                ]
            },
            {
                test: /\.(woff2?|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    name: 'fonts/[name].[ext]'
                }
            },
            {
                test: /\.(ttf|eot)$/,
                loader: 'file-loader',
                options: {
                    name: 'fonts/[name].[ext]'
                }
            },
            {
                test: /\.json$/,
                loader: 'json-loader'
            }
        ]
    },
    node: {
        fs: 'empty'
    }
};