const fs = require('fs');
const path = require('path');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const srcDir = path.join(__dirname, 'src');
const files = getAllFiles(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix mismatched quotes: from "..." to from "..."'
  const mismatchedQuotes = content.match(/from\s+"[^"]+'/g);
  if (mismatchedQuotes) {
    mismatchedQuotes.forEach(match => {
      const fixed = match.replace(/"([^"]+)'$/, '"$1"');
      content = content.replace(match, fixed);
      modified = true;
    });
  }

  // Fix mismatched quotes: from '...' to from '..."
  const mismatchedQuotes2 = content.match(/from\s+'[^']+"/g);
  if (mismatchedQuotes2) {
    mismatchedQuotes2.forEach(match => {
      const fixed = match.replace(/'([^']+)"$/, "'$1'");
      content = content.replace(match, fixed);
      modified = true;
    });
  }

  if (modified) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed quotes:', file);
  }
});

console.log('Done fixing quotes!');
