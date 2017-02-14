
const Promise = require('bluebird');

const { Router } = require('express');
const serveIndex = require('serve-index');
const serveStatic = require('serve-static');

const NsisSyncer = require('./nsisSyncer');

function nsisNuts({
    user, repo,
    token = null,
    syncPreReleases = false,
    syncInterval = 15 * 60 * 1000,
}) {

    let lastSync = -1;

    const nsisSyncer = new NsisSyncer({
        user, repo, token, syncPreReleases,
    });

    const router = Router();

    router.get('*', (req, res, next) => {
        Promise.coroutine(function*() {

            const now = Date.now();

            if(now - lastSync > syncInterval) {

                nsisSyncer.start();

                lastSync = now;

            }

        })()
        .then(next);
    });

    router.use('/', serveIndex('./assets/', {
        view: 'details',
    }));
    router.use('/', serveStatic('./assets/'));

    router.get('/:channel', (req, res, next) => {

        const channel = req.params.channel;

        nsisSyncer.getInfo()
        .then((info) => {

            const c = info.channels[channel];

            if(!c) {
                return next(new Error('ERROR_CHANNEL_NOT_FOUND'));
            }

            const file = info.files.filter(file => file.version == c.version).shift();

            if(!file) {
                return next(new Error('ERROR_FILE_NOT_FOUND'));
            }

            res.redirect(`${ file.path }`);

        });

    });

    return router;

}

module.exports = nsisNuts;
