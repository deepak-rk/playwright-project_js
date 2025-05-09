
const fs = require('fs');


function readLargeJsonFile(filePath) {
    return new Promise((resolve, reject) => {
        let data = '';

        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });

        stream.on('data', chunk => {
            data += chunk;
        });

        stream.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (error) {
                reject(error);
            }
        });

        stream.on('error', error => {
            reject(error);
        });
    });
}


readLargeJsonFile('large-file.json')
    .then(jsonData => console.log(jsonData))
    .catch(error => console.error('Error reading JSON file:', error));
