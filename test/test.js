import { readForm, setMaxFileSize } from './../formParser.js';
import express from 'express';
import fs from 'fs';

const app = express();
const router = express.Router();

setMaxFileSize(SIZE);


app.listen(3001, () => {
    console.log('Example app listening on port 3001!');
});