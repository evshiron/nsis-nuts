
const Promise = require('bluebird');

const { Router } = require('express');
const serveStatic = require('serve-static');

const nsisSync = require('./nsisSync');

function nsisNuts({
    user, repo,
    token = null,
    syncPreReleases = false,
    syncInterval = 15 * 60 * 1000,
}) {

    let lastSync = -1;

    const router = Router();

    router.get('*', (req, res, next) => {
        Promise.coroutine(function*() {

            const now = Date.now();

            if(now - lastSync > syncInterval) {

                nsisSync({
                    user, repo, token, syncPreReleases,
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
