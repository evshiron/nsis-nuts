
const Promise = require('bluebird');
const debug = require('debug')('nsisSync');

const { dirname, resolve: resolvePath, relative: relativePath } = require('path');
const { parse: parseUrl } = require('url');
const { exists, createReadStream, createWriteStream } = require('fs');
const { readFileAsync, writeFileAsync } = Promise.promisifyAll(require('fs'));
const { createHash } = require('crypto');

const request = require('request');
const yaml = require('js-yaml');

const GitHubApi = require('github-api');

function hash(type, path) {
    return new Promise((resolve, reject) => {

        const hasher = createHash(type);

        hasher.on('error', reject);

        hasher.on('readable', () => {

            const data = hasher.read();

            if(data) {
                resolve(data.toString('hex'));
            }

        });

        createReadStream(path).pipe(hasher);

    });
}

class SyncInfo {

    constructor(path) {

        this.path = path;

        this.channels = {};
        this.files = [];

    }

    addChannel(name, version) {
        return Promise.coroutine(function*() {

            const channel = {
                name, version,
            };

            this.channels[name] = channel;

            return channel;

        }.bind(this))();
    }

    addFile(version, path, sha256) {
        return Promise.coroutine(function*() {

            this.files = this.files.filter(file => file.version != version);

            const file = {
                version, path, sha256,
                added: Date.now(),
            };

            this.files.push(file);

            return file;

        }.bind(this))();
    }

    load() {
        return Promise.coroutine(function*() {

            const { channels, files } = JSON.parse(yield readFileAsync(this.path));

            this.channels = channels;
            this.files = files;

        }.bind(this))()
        .catch(console.error);
    }

    save() {
        return Promise.coroutine(function*() {

            yield writeFileAsync(this.path, this.serialize());

        }.bind(this))();
    }

    serialize() {
        return JSON.stringify(this, null, 4);
    }

    data() {
        return JSON.parse(this.serialize());
    }

}

class NsisSyncer {

    constructor({
        user, repo, token,
    }) {

        this.user = user;
        this.repo = repo;
        this.token = token;

        this.assetsDir = resolvePath('./assets/');

        this.info = new SyncInfo(resolvePath(this.assetsDir, 'versions.json'));

    }

    downloadAsset(asset) {
        return Promise.coroutine(function*() {

            console.log(`Downloading ${ asset.name }...`);

            const path = resolvePath(this.assetsDir, asset.name);

            if(yield new Promise(resolve => exists(path, resolve))) {

                const rpath = relativePath(this.assetsDir, path);

                const file = this.info.files.filter(file => file.path == rpath).shift();

                if(file) {

                    const sha256 = yield hash('sha256', path);

                    if(sha256 == file.sha256) {

                        console.log(`Discover cache for ${ asset.name }, skip.`);

                        return path;

                    }

                }

            }

            yield new Promise((resolve, reject) => {

                request(asset.browser_download_url, {}, (err, res) => {

                    if(err) {
                        return reject(err);
                    }

                    resolve();

                })
                .pipe(createWriteStream(path));

            });

            return path;

        }.bind(this))();
    }

    syncReleases(releases) {
        return Promise.coroutine(function*() {

            yield Promise.mapSeries([...releases].reverse(), (release) => {

                console.log(`Synchronizing ${ release.name }...`);

                return Promise.coroutine(function*() {

                    const paths = yield Promise.map(release.assets, asset => this.downloadAsset(asset));

                    const yml = paths.filter(path => path.includes('latest.yml')).shift();
                    const { version, sha2 } = yaml.safeLoad(yield readFileAsync(yml));

                    const path = paths.filter(path => /.+?-Setup-.+?\.exe/.test(path)).shift();
                    const sha256 = yield hash('sha256', path);

                    if(sha256 != sha2) {
                        throw new Error('ERROR_SHA256_MISMATCH');
                    }

                    yield this.info.addFile(version, relativePath(this.assetsDir, path), sha256);

                }.bind(this))();

            });

            const yml = resolvePath(this.assetsDir, 'latest.yml');
            const { version } = yaml.safeLoad(yield readFileAsync(yml));

            this.info.addChannel('latest', version);

        }.bind(this))();
    }

    start() {
        return Promise.coroutine(function*() {

            console.log(`Synchronizing ${ this.user }/${ this.repo }...`);

            yield this.info.load();

            const gapi = this.token ? new GitHubApi({ token: this.token }) : new GitHubApi();

            yield gapi.getRateLimit().getRateLimit()
            .then(res => debug(`quota: ${ res.data.rate.remaining }`));

            const { data } = yield gapi.getRepo(this.user, this.repo).listReleases();

            yield this.syncReleases(data);

            yield this.info.save();

            console.log(`Synchronized ${ this.user }/${ this.repo }.`);

        }.bind(this))();
    }

}

function nsisSync({
    user, repo, token,
}) {

    const syncer = new NsisSyncer({
        user, repo, token,
    });

    return syncer.start();

}

module.exports = nsisSync;
