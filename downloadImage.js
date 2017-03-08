const fs = require('fs');
const request = require('requestretry');
const ProgressBar = require('progress');

let destFile = process.argv[2] || null;
let url = process.argv[3] || null;

if (destFile && url) {
    let req = request(url)
        .on('end',()=>{
            console.log(`${destFile} has been successfully downloaded and saved.`)
        })
        .on('error', (err) => {
            console.error(err);
        })
        .pipe(fs.createWriteStream(destFile));
}