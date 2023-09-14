import { formParser, setMaxFileSize } from './../formParser.js';
import express from 'express';
import fs from 'fs';

const app = express();
const router = express.Router();

//10MB
const SIZE = 10 * 1024 * 1024;

setMaxFileSize(SIZE);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

router.post('/', formParser, (req, res) => {
    console.log('File upload request received');

    console.log('req.body', req.body);
    //write the file to disk
    //create upload directory if it doesn't exist
    if (!fs.existsSync('./uploads')) {
        fs.mkdirSync('./uploads');
    }
    //write the file to disk
    fs.writeFileSync('./uploads/' + req.body.files[0].filename, req.body.files[0].data);
    res.send('File uploaded');
});

app.use('/test', router);

app.listen(3001, () => {
    console.log('Example app listening on port 3001!');
});