import http from 'http';

type Part = {
  contentDispositionHeader: string;
  contentTypeHeader: string;
  part: number[];
};

type Input = {
  filename?: string;
  name?: string;
  type: string;
  data: Buffer;
};

enum ParsingState {
  INIT,
  READING_HEADERS,
  READING_DATA,
  READING_PART_SEPARATOR,
}

interface Request extends http.IncomingMessage {
  body?: {
    fields: { [key: string]: string };
    files: Input[];
  }
}


//make a middleware that parses the form data and adds it to the request object
let maxFileSize = 1000000;
export function setMaxFileSize(size: number) {
  maxFileSize = size;
}

export function formParser(req: Request, res: http.ServerResponse, next: () => void) {
  const header = req.headers['content-type'];
  const boundary = getBoundary(header);
  if (!boundary) {
    res.statusCode = 400;
    res.end('Content type header does not contain boundary');
    return;
  }

  //console.log('boundary', boundary);

  const contentLength = req.headers['content-length'] as string;

  const fileSize = parseInt(contentLength, 10);

  //console.log('fileSize', fileSize);

  if (fileSize > maxFileSize) {
    res.writeHead(413, { Connection: 'close' });
    res.end('File is too big');
    return;
  }

  const body: Buffer[] = [];
  req.on('data', (chunk: any) => {
    body.push(chunk);
  });

  req.on('error', (err: any) => {
    console.error(err);
    if (body.length > 0) {
      body.length = 0;
    }
    res.writeHead(500, { Connection: 'close' });
    res.end('Something went wrong');
    return;
  });

  req.on('aborted', () => {
    if (body.length > 0) {
      body.length = 0;
    }
    console.log('Request aborted');
    res.writeHead(400, { Connection: 'close' });
    res.end();
    return;
  });

  req.on('end', () => {
    const bodyBuffer = Buffer.concat(body);

    const formData = parse(bodyBuffer, boundary);
  
    if (!formData) {
      res.writeHead(400, { Connection: 'close' });
      res.end('Invalid form data');
      return;
    }

    //add fields to the req.body.fields object and files to the req.body.files array
    req.body = { fields: {}, files: [] };
    for (const input of formData) {
      if (input.filename) {
        req.body.files.push(input);
      } else {
        req.body.fields[input.name as string] = input.data.toString();
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
function parse(multipartBodyBuffer: Buffer, boundary: string): Input[] {
  let lastline = '';
  let contentDispositionHeader = '';
  let contentTypeHeader = '';
  let state: ParsingState = ParsingState.INIT;
  let buffer: number[] = [];
  const allParts: Input[] = [];

  let currentPartHeaders: string[] = [];

  for (let i = 0; i < multipartBodyBuffer.length; i++) {
    const oneByte: number = multipartBodyBuffer[i];
    const prevByte: number | null = i > 0 ? multipartBodyBuffer[i - 1] : null;
    const newLineDetected: boolean = oneByte === 0x0a && prevByte === 0x0d;
    const newLineChar: boolean = oneByte === 0x0a || oneByte === 0x0d;

    if (!newLineChar) lastline += String.fromCharCode(oneByte);

    if (state === ParsingState.INIT && newLineDetected) {
      // searching for boundary
      if ('--' + boundary === lastline) {
        state = ParsingState.READING_HEADERS; // found boundary, start reading headers
      }
      lastline = '';
    } else if (state === ParsingState.READING_HEADERS && newLineDetected) {
      // parsing headers
      if (lastline.length) {
        currentPartHeaders.push(lastline);
      } else {
        // found empty line, search for the headers we want and set the values
        for (const h of currentPartHeaders) {
          if (h.toLowerCase().startsWith('content-disposition:')) {
            contentDispositionHeader = h;
          } else if (h.toLowerCase().startsWith('content-type:')) {
            contentTypeHeader = h;
          }
        }
        state = ParsingState.READING_DATA;
        buffer = [];
      }
      lastline = '';
    } else if (state === ParsingState.READING_DATA) {
      // parsing data
      if (lastline.length > boundary.length + 4) {
        lastline = ''; // memory save
      }
      if ('--' + boundary === lastline) {
        const j = buffer.length - lastline.length;
        const part = buffer.slice(0, j - 1);

        allParts.push(processPart({ contentDispositionHeader, contentTypeHeader, part }));
        buffer = [];
        currentPartHeaders = [];
        lastline = '';
        state = ParsingState.READING_PART_SEPARATOR;
        contentDispositionHeader = '';
        contentTypeHeader = '';
      } else {
        buffer.push(oneByte);
      }
      if (newLineDetected) {
        lastline = '';
      }
    } else if (state === ParsingState.READING_PART_SEPARATOR) {
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
function getBoundary(header: string | undefined): string {
  if (!header) {
    return '';
  }
  const items = header.split(';');
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i].trim();
      if (item.indexOf('boundary') >= 0) {
        const k = item.split('=');
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
function processPart(part: Part): Input {
  const obj = function (str: string) {
    const k = str.split('=');
    const a = k[0].trim();

    const b = JSON.parse(k[1].trim());
    const o = {};
    Object.defineProperty(o, a, {
      value: b,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return o;
  };

  const header = part.contentDispositionHeader.split(';');
  const filenameData = header[2];
  let input = {};

  if (filenameData) {
    input = obj(filenameData);
    const contentType = part.contentTypeHeader.split(':')[1].trim();
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

  return input as Input;
}
