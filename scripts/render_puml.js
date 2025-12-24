const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const http = require('http');

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function append3bytes(b1, b2, b3) {
  const c1 = (b1 >> 2) & 0x3F;
  const c2 = ((b1 & 0x3) << 4) | ((b2 >> 4) & 0xF);
  const c3 = ((b2 & 0xF) << 2) | ((b3 >> 6) & 0x3);
  const c4 = b3 & 0x3F;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function plantumlEncode(buf) {
  let res = '';
  for (let i = 0; i < buf.length; i += 3) {
    const b1 = buf[i];
    const b2 = (i + 1 < buf.length) ? buf[i + 1] : 0;
    const b3 = (i + 2 < buf.length) ? buf[i + 2] : 0;
    res += append3bytes(b1, b2, b3);
  }
  return res;
}

function deflateAndEncode(text) {
  const deflated = zlib.deflateRawSync(Buffer.from(text, 'utf-8'));
  return plantumlEncode(deflated);
}

function fetchAndSave(url, outPath) {
  const client = url.startsWith('https://') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('Status ' + res.statusCode));
        return;
      }
      const ws = fs.createWriteStream(outPath);
      res.pipe(ws);
      ws.on('finish', () => resolve());
      ws.on('error', (err) => reject(err));
    });
    req.on('error', reject);
  });
}

function postAndSave(hostname, path, text, outPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(text, 'utf8')
      }
    };
    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        const ws = fs.createWriteStream(outPath);
        res.pipe(ws);
        ws.on('finish', () => resolve());
        ws.on('error', (err) => reject(err));
        return;
      }
      // Follow redirect (PlantUML may redirect to an encoded PNG URL)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers && res.headers.location) {
        const loc = res.headers.location;
        fetchAndSave(loc, outPath).then(resolve).catch(reject);
        return;
      }
      reject(new Error('Status ' + res.statusCode));
    });
    req.on('error', reject);
    req.write(text, 'utf8');
    req.end();
  });
}

async function main() {
  const pumlPath = process.argv[2] || 'ARCHITECTURE/component-connector-view.puml';
  const outPath = process.argv[3] || 'ARCHITECTURE/component-connector-view.png';
  if (!fs.existsSync(pumlPath)) {
    console.error('PUML file not found:', pumlPath);
    process.exit(2);
  }
  const content = fs.readFileSync(pumlPath, 'utf-8');
  // strip any ``` text wrappers (some files had fenced code)
  const cleaned = content.replace(/^```[\s\S]*?\n/, '').replace(/\n```\s*$/, '');
  // Try POSTing raw PlantUML text to the PlantUML server
  try {
    console.log('POSTing PlantUML to plantuml.com server...');
    await postAndSave('www.plantuml.com', '/plantuml/png', cleaned, outPath);
    console.log('Saved PNG to', outPath);
    return;
  } catch (err) {
    console.error('POST failed:', err.message);
  }

  // Fallback: use encoded URL (if POST not allowed)
  try {
    const encoded = deflateAndEncode(cleaned);
    const url = 'https://www.plantuml.com/plantuml/png/' + encoded;
    console.log('Requesting (fallback):', url);
    await fetchAndSave(url, outPath);
    console.log('Saved PNG to', outPath);
  } catch (err) {
    console.error('Failed to fetch/save (fallback):', err.message);
    process.exit(1);
  }
}

main();
