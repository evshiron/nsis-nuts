
const Promise = require('bluebird');

const { Router } = require('express');
const serveStatic = require('serve-static');

const nsisSync = require('./nsisSync');

function nsisNuts({
    user, repo,
    syncInterval = 15 * 60 * 1000,
}) {

    let lastSync = -1;

    const router = Router();

    router.get('*', (req, res, next) => {
        Promise.coroutine(function*() {

            const now = Date.now();

            if(now - lastSync > syncInterval) {

                nsisSync({
                    user, repo,
                });

                lastSync = now;

            }

        })()
        .then(next);
    });

    router.use('/', serveStatic('./assets/'));

    return router;

}

module.exports = nsisNuts;
