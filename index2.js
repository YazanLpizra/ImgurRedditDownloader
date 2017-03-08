'use strict';

const fs = require('fs');
const request = require('requestretry');
const cheerio = require('cheerio');
const creds = require('./apiCredentials.js');

const imgurLinkexp = /(?:https?:\/\/)?(?:www)?(?:i\.)?imgur.com\/(?:a\/)?(?!gallery)[a-z0-9]+/gi;
const regex = new RegExp(imgurLinkexp);
const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json';//limit=200
// const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json?limit=500';

const destFolder = __dirname + '\\images\\';

let $;
let idCounter = 0;
let hasErrors = false;

console.log(redditUrl)


var promise = new Promise((resolve, reject) => {
    request(redditUrl)
        .then((response) => {
            resolve(response.body);
        })
        .catch(handleError)
})
    .then(onRedditDataRecieved, handleError)
    .then(onUrlListRecieved, handleError)
    .then((data) => {
        console.log('data', data)
    })
    .catch(handleError)

function onUrlListRecieved(urlList) {
    let imgurPageDataPromises = [];
    let directImageLinks = [];

    console.log(urlList)

    for (let url in urlList) {
        if (isDirectImageLink(url)) {
            console.log(url,'is direct link')
            directImageLinks.push(url);
        } else {
            console.log(url,'is indirect link')            
            imgurPageDataPromises.push(getImgurPageData(url))
        }
    }

    Promise.all(imgurPageDataPromises)
        .then((parsedUrls) => {
            directImageLinks.concat(parsedUrls);
            resolve(directImageLinks);
        })
        .catch(handleError);
}

function getImgurPageData(imgurUrl) {
    const imgurAlbumEndpoint = 'https://api.imgur.com/3/album/%PAGEID%/images';
    const imgurImageEndpoint = 'https://api.imgur.com/3/image/%PAGEID%/'
    const imgurAuth = creds.imgur.clientId + ' ' + creds.imgur.clientSecret;

    let pageId = imgurUrl.split('/');
    pageId = pageId[pageId.length - 1];

    let options = {
        url: imgurUrl.includes('/a/') ? imgurAlbumEndpoint.replace('%PAGEID%', pageId) : imgurImageEndpoint.replace('%PAGEID%', pageId),
        headers: {
            'Authorization': imgurAuth
        }
    };

    console.log('hitting url:', options.url)

    return request(options)
        .then((jsonData) => {
            return jsonData.data.link;
        })
        .catch(handleError);
}

function onRedditDataRecieved(body) {
    let content = JSON.parse(body)[1].data.children;
    let urlList = [];

    for (let i = 0; i < content.length; i++) {
        if (content[i].data.body) {
            let temp = content[i].data.body.match(regex)
            if (temp) {
                if (Array.isArray(temp)) {
                    urlList.concat(temp);
                } else {
                    urlList.push(temp);
                }
            }
        }
    }
    resolve(urlList);
}

function handleError(error) {
    console.log('Error:', error);
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