var ParsingState;
(function (ParsingState) {
    ParsingState[ParsingState["INIT"] = 0] = "INIT";
    ParsingState[ParsingState["READING_HEADERS"] = 1] = "READING_HEADERS";
    ParsingState[ParsingState["READING_DATA"] = 2] = "READING_DATA";
    ParsingState[ParsingState["READING_PART_SEPARATOR"] = 3] = "READING_PART_SEPARATOR";
})(ParsingState || (ParsingState = {}));
//make a middleware that parses the form data and adds it to the request object
var maxFileSize = 1000000;
export function setMaxFileSize(size) {
    maxFileSize = size;
}
export function formParser(req, res, next) {
    var header = req.headers['content-type'];
    var boundary = getBoundary(header);
    if (!boundary) {
        res.statusCode = 400;
        res.end('Content type header does not contain boundary');
        return;
    }
    console.log('boundary', boundary);
    var contentLength = req.headers['content-length'];
    var fileSize = parseInt(contentLength, 10);
    console.log('fileSize', fileSize);
    if (fileSize > maxFileSize) {
        res.writeHead(413, { Connection: 'close' });
        res.end('File is too big');
        return;
    }
    var body = [];
    req.on('data', function (chunk) {
        body.push(chunk);
    });
    req.on('error', function (err) {
        console.error(err);
        if (body.length > 0) {
            body.length = 0;
        }
        res.writeHead(500, { Connection: 'close' });
        res.end('Something went wrong');
        return;
    });
    req.on('aborted', function () {
        if (body.length > 0) {
            body.length = 0;
        }
        console.log('Request aborted');
        res.writeHead(400, { Connection: 'close' });
        res.end();
        return;
    });
    req.on('end', function () {
        var bodyBuffer = Buffer.concat(body);
        var formData = parse(bodyBuffer, boundary);
        if (!formData) {
            res.writeHead(400, { Connection: 'close' });
            res.end('Invalid form data');
            return;
        }
        //add fields to the req.body object and files to the req.files array
        req.files = [];
        req.body = {};
        for (var _i = 0, formData_1 = formData; _i < formData_1.length; _i++) {
            var input = formData_1[_i];
            if (input.filename) {
                req.files.push(input);
            }
            else {
                req.body = input;
            }
        }
        next();
    });
}
/**
 * Parses a multipart body buffer and extracts the parts based on the provided boundary.
 *
 * @param {Buffer} multipartBodyBuffer - The multipart body buffer.
 * @param {string} boundary - The boundary string.
 * @returns {Input[]} An array of extracted parts.
 */
function parse(multipartBodyBuffer, boundary) {
    var lastline = '';
    var contentDispositionHeader = '';
    var contentTypeHeader = '';
    var state = ParsingState.INIT;
    var buffer = [];
    var allParts = [];
    var currentPartHeaders = [];
    for (var i = 0; i < multipartBodyBuffer.length; i++) {
        var oneByte = multipartBodyBuffer[i];
        var prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
        var newLineDetected = oneByte === 0x0a && prevByte === 0x0d;
        var newLineChar = oneByte === 0x0a || oneByte === 0x0d;
        if (!newLineChar)
            lastline += String.fromCharCode(oneByte);
        if (state === ParsingState.INIT && newLineDetected) {
            // searching for boundary
            if ('--' + boundary === lastline) {
                state = ParsingState.READING_HEADERS; // found boundary, start reading headers
            }
            lastline = '';
        }
        else if (state === ParsingState.READING_HEADERS && newLineDetected) {
            // parsing headers
            if (lastline.length) {
                currentPartHeaders.push(lastline);
            }
            else {
                // found empty line, search for the headers we want and set the values
                for (var _i = 0, currentPartHeaders_1 = currentPartHeaders; _i < currentPartHeaders_1.length; _i++) {
                    var h = currentPartHeaders_1[_i];
                    if (h.toLowerCase().startsWith('content-disposition:')) {
                        contentDispositionHeader = h;
                    }
                    else if (h.toLowerCase().startsWith('content-type:')) {
                        contentTypeHeader = h;
                    }
                }
                state = ParsingState.READING_DATA;
                buffer = [];
            }
            lastline = '';
        }
        else if (state === ParsingState.READING_DATA) {
            // parsing data
            if (lastline.length > boundary.length + 4) {
                lastline = ''; // memory save
            }
            if ('--' + boundary === lastline) {
                var j = buffer.length - lastline.length;
                var part = buffer.slice(0, j - 1);
                allParts.push(processPart({ contentDispositionHeader: contentDispositionHeader, contentTypeHeader: contentTypeHeader, part: part }));
                buffer = [];
                currentPartHeaders = [];
                lastline = '';
                state = ParsingState.READING_PART_SEPARATOR;
                contentDispositionHeader = '';
                contentTypeHeader = '';
            }
            else {
                buffer.push(oneByte);
            }
            if (newLineDetected) {
                lastline = '';
            }
        }
        else if (state === ParsingState.READING_PART_SEPARATOR) {
            if (newLineDetected) {
                state = ParsingState.READING_HEADERS;
            }
        }
    }
    return allParts;
}
/**
 * Extracts the boundary string from the Content-Type header.
 *
 * @param {string} header - The Content-Type header.
 * @returns {string} The extracted boundary string.
 */
function getBoundary(header) {
    if (!header) {
        return '';
    }
    var items = header.split(';');
    if (items) {
        for (var i = 0; i < items.length; i++) {
            var item = items[i].trim();
            if (item.indexOf('boundary') >= 0) {
                var k = item.split('=');
                return k[1].trim().replace(/^["']|["']$/g, '');
            }
        }
    }
    return '';
}
/**
 * Processes a part and transforms it into Input format.
 *
 * @param {Part} part - The part to process.
 * @returns {Input} Processed input.
 */
function processPart(part) {
    var obj = function (str) {
        var k = str.split('=');
        var a = k[0].trim();
        var b = JSON.parse(k[1].trim());
        var o = {};
        Object.defineProperty(o, a, {
            value: b,
            writable: true,
            enumerable: true,
            configurable: true,
        });
        return o;
    };
    var header = part.contentDispositionHeader.split(';');
    var filenameData = header[2];
    var input = {};
    if (filenameData) {
        input = obj(filenameData);
        var contentType = part.contentTypeHeader.split(':')[1].trim();
        Object.defineProperty(input, 'type', {
            value: contentType,
            writable: true,
            enumerable: true,
            configurable: true,
        });
    }
    Object.defineProperty(input, 'name', {
        value: header[1].split('=')[1].replace(/"/g, ''),
        writable: true,
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(input, 'data', {
        value: Buffer.from(part.part),
        writable: true,
        enumerable: true,
        configurable: true,
    });
    return input;
}
