# Multipart form parser

This is a TypeScript module that provides functions to parse a multipart body buffer and extract its parts based on the provided boundary. It also includes utility functions to extract the boundary string from the Content-Type header and generate sample demo data for testing.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Demo Data](#demo-data)
- [Contributing](#contributing)
- [License](#license)


## Installation

This module is written in TypeScript and can be added to your project using npm:

```bash
npm install multipart-form-reader
```


## Usage

```js
//import
import { readForm, setMaxFileSize } from 'multipart-form-reader';
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

router.post('/', readForm, (req, res) => {
    console.log('File upload request received');
    //console.log('req.files', req.files);
    //console.log('req.body', req.body);
    //write the file to disk
    //create upload directory if it doesn't exist
    if (!fs.existsSync('./uploads')) {
        fs.mkdirSync('./uploads');
    }
    //write the file to disk
    fs.writeFileSync('./uploads/' + req.files[0].filename, req.files[0].data);
    res.send('File uploaded');
});

app.use('/test', router);

app.listen(3000, () => {
    console.log('Example app listening on port 3000!');
});
```
