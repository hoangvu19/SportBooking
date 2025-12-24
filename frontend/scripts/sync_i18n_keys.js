const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');
const EN_PATH = path.resolve(__dirname, '../src/locales/en/translation.json');
const VI_PATH = path.resolve(__dirname, '../src/locales/vi/translation.json');

function walkDir(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walkDir(full, cb);
    } else if (e.isFile()) {
      if (/\.(js|jsx|ts|tsx|mjs|cjs|json)$/.test(e.name)) cb(full);
    }
  }
}

function extractKeysFromFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  const re = /t\(\s*['"`]([^'"`\\)]+?)['"`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

function ensureJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function setNested(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function hasNested(obj, key) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return false;
    cur = cur[p];
    if (i < parts.length - 1 && (typeof cur !== 'object' || cur === null)) return false;
  }
  return true;
}

function humanizeKey(key) {
  const parts = key.split('.');
  let last = parts[parts.length - 1];
  const hintWords = ['title','subtitle','label','placeholder','name','text','description','message','action','actions','submit','cancel','details','empty','loading','success','error','stats','table','pagination'];
  if (hintWords.includes(last) && parts.length > 1) {
    last = parts[parts.length - 2];
  }
  // split camelCase and underscores
  const s = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-]/g, ' ');
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function main() {
  const allKeys = new Set();
  walkDir(SRC_DIR, (file) => {
    try {
      const keys = extractKeysFromFile(file);
      keys.forEach(k => allKeys.add(k));
    } catch (e) {
      console.error('Failed to read', file, e.message);
    }
  });

  console.log(`Found ${allKeys.size} i18n key(s) in source.`);

  const en = ensureJson(EN_PATH);
  const vi = ensureJson(VI_PATH);

  const added = [];
  for (const k of Array.from(allKeys).sort()) {
    if (!hasNested(en, k)) {
      const value = humanizeKey(k);
      setNested(en, k, value);
      setNested(vi, k, value); // copy English as placeholder for Vietnamese
      added.push(k);
    }
  }

  if (added.length === 0) {
    console.log('No new keys to add.');
  } else {
    // ensure directories
    fs.mkdirSync(path.dirname(EN_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(VI_PATH), { recursive: true });
    fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + '\n', 'utf8');
    fs.writeFileSync(VI_PATH, JSON.stringify(vi, null, 2) + '\n', 'utf8');
    console.log(`Added ${added.length} new key(s) to ${EN_PATH} and ${VI_PATH}`);
    console.log('Sample added keys:', added.slice(0, 30));
  }
}

if (require.main === module) main();
