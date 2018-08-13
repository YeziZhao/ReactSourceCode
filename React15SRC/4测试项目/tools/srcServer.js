import express from 'express';
import webpack from 'webpack';
import path from 'path';
import config from '../configs/webpack.config.dev';
import open from 'open';
import colors from 'colors';
import pConfigs from './configs';

// proxy
import httpProxy from 'http-proxy';
const apiProxy = httpProxy.createProxyServer();

/* eslint-disable no-console */

// const port = 3000;
const {
    server,
    client
} = pConfigs;

const app = express();
const compiler = webpack(config);

let webpackDevMiddlewareInstance = require('webpack-dev-middleware')(compiler, {
    noInfo: true,
    publicPath: config.output.publicPath,
    quiet: true    // display nothing to the console
});
app.use(webpackDevMiddlewareInstance);

app.use(require('webpack-hot-middleware')(compiler));

app.use('/api/*', (req, res) => {
    let proxiedUrl = req.baseUrl;
    const url = require('url');
    let url_parts = url.parse(req.url, true);
    if (url_parts.search !== null) {
        proxiedUrl += url_parts.search;
    }
    req.url = proxiedUrl;

    apiProxy.web(req, res, {
        target: {
            host: server.host,
            port: server.port
        }
    });

    // Default Proxy without Parameters.
    // req.url = req.baseUrl;  // URL
    // apiProxy.web(req, res, {
    //     target: {
    //         host: 'localhost',
    //         port: 8080
    //     }
    // });
});

app.get('*', function(req, res, next) {
    let filename = path.join(compiler.outputPath, 'index.html');
    compiler.outputFileSystem.readFile(filename, function(err, result) {
        if (err) {
            return next(err);
        }
        res.set('content-type','text/html');
        res.send(result);
        res.end();
    });
});

app.listen(client.port, function(err) {
    if (err) {
        console.error(err);
    }
    else {
        // open(`http://localhost:${port}`);

        // to wait until Webpack Dev Server loaded.
        webpackDevMiddlewareInstance.waitUntilValid(() => {
            open(`http://${client.host}:${client.port}`);
        });   
    }
});