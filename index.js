'use strict';

const fs = require('fs');
const request = require('request');
const rp = require('request-promise');
const cheerio = require('cheerio');
const creds = require('./apiCredentials.js');

// const expression = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
const imgurLinkexp = /(?:https?:\/\/)?(?:www)?(?:i\.)?imgur.com\/(?:a\/)?(?!gallery)[a-z0-9]+/gi;
const regex = new RegExp(imgurLinkexp);
const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json';//limit=200
// const redditUrl = 'https://www.reddit.com/r/AskReddit/comments/5vao3o/what_is_your_current_desktop_background/.json?limit=500';

const destFolder = __dirname + '\\images\\';

let urlList = [];
let promises = [];
let $;
let idCounter = 0;
let hasErrors = false;
let imgurAuth = creds.imgur.clientId + ' ' + creds.imgur.clientSecret;

console.log(redditUrl)

// request(redditUrl)
//     .on('response', function (response) {
//         console.log(response.statusCode) // 200 
//         console.log(response.headers['content-type']) 
//     })
//     .on('error', function (err) {
//         console.log(err)
//     })
//     .pipe(fs.createWriteStream('./data.json'))


fs.readFile('./data.json', 'utf8', (err, data) => {
    if (err) console.error(err)
    else {
        let contents = JSON.parse(data)[1].data.children;
        console.log('Number of posts to parse through: ' + contents.length);

        // for (let i = 0; i < 3; i++) {
            for (let i = 0; i < contents.length; i++) {

            let urlArray = parseUrl(contents[i].data.body);

            if (urlArray) {
                // console.log(urlArray)
                for (let j = 0; j < urlArray.length; j++) {
                    // let promise = rp.get(urlArray[j])
                    // .then((body) => {
                    //     $ = cheerio.load(body);
                    //     $('img').each(function (i, $tag) {
                    //         let $this = $(this);
                    //         if ($this.attr('itemprop') === 'contentURL') {
                    //             //prepending http because request module wasnt happy without it. substring because the image urls start with '//'
                    //             let imgUrl = 'http://' + $this.attr('src').substring(2);
                    //             writeImageToFile(imgUrl);
                    //             urlList.push(imgUrl);
                    //         }
                    //     });
                    // })
                    // .catch((error) => {
                    //     fs.appendFile(destFolder + '_error-log.txt', error + '\n', 'utf8');
                    //     hasErrors = true;
                    // });
                    // promises.push(promise);
                    promises.push(writeImageToFile(urlArray[j]));
                }
            }
        }

        // Promise.all(promises).then(() => {
        //     fs.writeFile(destFolder + '_url-list.txt', urlList, 'utf8');
        //     if (hasErrors) {
        //         console.error('Error encountered. Please check error log in:', destFolder + '_error-log.txt');
        //     } else {
        //         console.log('done');
        //     }
        // });
    }
});

let parseUrl = function (text) {
    // console.log('-- parseUrl input: ' + text)
    if (!text) return null;
    return text.match(regex);
}

let writeImageToFile = function (imgUrl) {
    const imgurImageApi = 'https://api.imgur.com/3/image/';
    const imgurAlbumApi = 'https://api.imgur.com/3/album/%placeholder%/images';

    console.log('imgurl:', imgUrl);

    if (imgUrl.endsWith('.png') || imgUrl.endsWith('.jpg')) {
        console.log('is direct image link')
        let filePath = destFolder + 'background_' + idCounter++ + imgUrl.substr(-4);
        return rp(imgUrl).pipe(fs.createWriteStream(filePath));
    } else {
        console.log('is not direct image link')
        let filePath = destFolder + 'background_' + idCounter++ + imgUrl.substr(-4);
        console.log(imgUrl, '\n Piping image to ', filePath)


        return rp({
            url: imgUrl,
            headers: {
                Authorization: 'Client-ID ' + creds.imgur.clientId
            }
        }).then((data) => {
            // data = data.data;
            // for (let i = 0; i < data.length; i++) {
            //     request(data[i].link).pipe(fs.createWriteStream(filePath));
            // }
            // console.log(data)
            fs.writeFile('logs', JSON.stringify(data, null, 2) + '\n====================================');
        });
    }
}