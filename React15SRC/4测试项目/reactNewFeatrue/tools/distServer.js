import express from 'express';
import path from 'path';
import open from 'open';
import compression from 'compression';
import configs from './configs';

/* eslint-disable no-console */

const {
    host,
    port
} = configs.client;
const app = express();

app.use(compression());
app.use('/dist', express.static('dist'));

app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));    
});

app.listen(port, function(err) {
    if (err) {
        console.error(err);
    }
    else {
        open(`http://${host}:${port}`);
    }
});

