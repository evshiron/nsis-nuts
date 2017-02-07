
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

app.listen(1337);
