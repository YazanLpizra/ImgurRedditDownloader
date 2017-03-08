'use strict';

const fs = require('fs');
const request = require('requestretry');
const cheerio = require('cheerio');
const ProgressBar = require('progress');
const async = require('async');
const fork = require('child_process').fork;

const creds = require('./apiCredentials.js');

const imgurLinkexp = /(?:https?:\/\/)?(?:www)?(?:i\.)?imgur.com\/(?:a\/)?(?!gallery)[a-z0-9]+/gi;
const regex = new RegExp(imgurLinkexp);

// const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json';//limit=200
// const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json?limit=500';

const destFolder = process.argv[2] || __dirname + '\\images\\' //1st arguement
const maxParallel = require('os').cpus().length;

const REQUEST_DELAY_MS = 2000;

let $;
let index = 0;
let idCounter = 0;
let runningChildProcesses = 0;

console.log(redditUrl);
console.log(`Number of cpu cores: ${maxParallel}`);

var promise = new Promise((resolve, reject) => {
    // fs.readFile('data.json', (err, data) => {
    //     if (err) {
    //         reject(err);
    //     }
    //     else resolve(data);
    // });
    request(redditUrl)
        .then((redditData) => {
            fs.writeFile('data.json', JSON.stringify(JSON.parse(redditData.body), null, 2), (err) => {
                if (err) reject(err);
                else resolve(redditData);
            });
        })
})
    .then(onRedditDataRecieved, handleError)
    .then(onUrlListRecieved, handleError)
    .then(onImageUrlsRecieved, handleError)
    .catch(handleError);

function onImageUrlsRecieved(imageUrls) {
    return new Promise((resolve, reject) => {
        fs.writeFile(destFolder + '_url_list.txt', imageUrls.join('\n'));

        console.log(`Starting download of ${imageUrls.length} images. Please wait...\n`);

        for (let i = 0; i < maxParallel && i < imageUrls.length; i++) {
            createDownloaderProcess(imageUrls);
        }
    });
}

function createDownloaderProcess(imageUrls) {
    setTimeout(() => {
        if (index < imageUrls.length) {
            let url = imageUrls[index++];
            let fileName = `${destFolder}background_${idCounter++}${url.substr(-4)}`;
            fork('./downloadImage.js', [fileName, url])
                .on('close', (code, signal) => {
                    runningChildProcesses--;
                    createDownloaderProcess(imageUrls);
                });
            runningChildProcesses++;
        } else {
            runningChildProcesses--;
            console.log(`Child process ${process.pid} shutting down. Running processes left: ${runningChildProcesses}.`)
            if (runningChildProcesses == 0) {
                console.log(`>> Finished downloading ${index} images.`);
            }
        }
    }, REQUEST_DELAY_MS);
}

function onUrlListRecieved(urlList) {
    return new Promise((resolve, reject) => {

        console.log('Recieved', urlList.length, 'links to images and albums. Beginning processing of links.');

        let imgurPageDataPromises = [];
        let directImageLinks = [];

        for (let i = 0; i < urlList.length; i++) {
            let url = urlList[i];

            if (isDirectImageLink(url)) {
                directImageLinks.push(url);
            } else {
                imgurPageDataPromises.push(getImgurPageData(url))
            }
        }

        Promise.all(imgurPageDataPromises)
            .then((parsedUrls) => {
                resolve(
                    flatCombine(directImageLinks, parsedUrls)
                        .filter(Boolean)
                );
            })
            .catch(handleError);
    });
}

function getImgurPageData(imgurUrl) {
    const imgurAlbumEndpoint = 'https://api.imgur.com/3/album/%PAGEID%/images';
    const imgurImageEndpoint = 'https://api.imgur.com/3/image/%PAGEID%/'
    const imgurAuth = 'Client-Id ' + creds.imgur.clientId;

    let pageId = imgurUrl.split('/');
    pageId = pageId[pageId.length - 1];

    let isAlbum = imgurUrl.includes('\/a\/');

    let options = {
        url: isAlbum ? imgurAlbumEndpoint.replace('%PAGEID%', pageId) : imgurImageEndpoint.replace('%PAGEID%', pageId),
        headers: {
            'Authorization': imgurAuth
        }
    };

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            request(options)
                .then((jsonData) => {
                    let bodyData = JSON.parse(jsonData.body).data;

                    if (isAlbum) {

                        let urls = [];
                        for (let i = 0; i < bodyData.length; i++) {
                            urls.push(bodyData[i].link);
                        }

                        resolve(urls);
                    } else {
                        resolve(bodyData.link);
                    }
                    /*
                    fs.writeFile(`${destFolder}imgur-api-data\\${pageId}.txt`, JSON.stringify(jsonData, null, 2), (err) => {
                        if (err) reject(err);

                        let bodyData = JSON.parse(jsonData.body).data;

                        if (isAlbum) {

                            let urls = [];
                            for (let i = 0; i < bodyData.length; i++) {
                                urls.push(bodyData[i].link);
                            }

                            resolve(urls);
                        } else {
                            resolve(bodyData.link);
                        }
                    });
                    */
                });
        }, REQUEST_DELAY_MS);
    });
}

function onRedditDataRecieved(data) {
    return new Promise((resolve, reject) => {
        console.log('Recieved post data from Reddit. Beginning parsing for image links now.')

        let content = JSON.parse(data.body)[1].data.children;
        let urlList = [];

        for (let i = 0; i < content.length; i++) {
            if (content[i] && content[i].data && content[i].data.body) {
                let temp = content[i].data.body.match(regex)
                if (temp) {
                    urlList = flatCombine(urlList, temp);
                }
            }
        }
        fs.writeFile(`${destFolder}_imgurLinks.txt`, urlList.join('\n'), (err) => {
            if (err) reject(err);
            else resolve(urlList);
        });
    })
}

function handleError(error) {
    console.log('>> Errors:', error);
}

function isDirectImageLink(imageUrl) {
    let imageExtensions = ['png', 'jpg', 'jpeg'];
    for (let i = 0; i < imageExtensions.length; i++) {
        if (imageUrl.endsWith(imageExtensions[i])) {
            return true;
        }
    }
    return false;
}

function flatCombine(array, elems) {
    const flatten = function (arr) {
        return arr.reduce(
            (acc, val) => acc.concat(
                Array.isArray(val) ? flatten(val) : val
            ), []);
    }
    return flatten(array).concat(flatten(elems));
}