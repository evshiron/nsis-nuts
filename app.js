
const express = require('express');
const morgan = require('morgan');

const nsisSync = require('./lib/');

const app = express();

app.use('*', morgan('combined'));

app.use('/', nsisSync({
    user: 'evshiron',
    repo: 'phantom',
    syncPreReleases: true,
}));

app.use((err, req, res, next) => {

    console.error(err);

    return res.status(500).end('INTERNAL_SERVER_ERROR');

});

app.listen(1337);
