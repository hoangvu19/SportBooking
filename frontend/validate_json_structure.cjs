const fs = require('fs');

const content = fs.readFileSync('src/i18n/translations.js', 'utf-8');

// Try to find the exact location of the error
const lines = content.split('\n');

// Find matching braces
let stack = [];
let errors = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '{') {
            stack.push({ line: lineNum, col: j, char: '{' });
        } else if (char === '}') {
            if (stack.length === 0) {
                errors.push(`Line ${lineNum}, col ${j}: Unmatched closing brace`);
            } else {
                stack.pop();
            }
        }
    }
}

console.log(`Total lines: ${lines.length}`);
console.log(`Unclosed braces: ${stack.length}`);

if (stack.length > 0) {
    console.log('\nUnclosed opening braces:');
    stack.forEach((item, idx) => {
        if (idx < 10) {
            const snippet = lines[item.line - 1].substring(Math.max(0, item.col - 20), item.col + 40);
            console.log(`  Line ${item.line}: ...${snippet}...`);
        }
    });
}

if (errors.length > 0) {
    console.log('\nUnmatched closing braces:');
    errors.forEach(e => console.log(`  ${e}`));
}

// Find the specific problem area around line 1522
console.log('\n--- Content around line 1522 ---');
for (let i = 1518; i <= 1525 && i < lines.length; i++) {
    const openCount = (lines[i].match(/\{/g) || []).length;
    const closeCount = (lines[i].match(/\}/g) || []).length;
    console.log(`${i + 1}: [+${openCount}/-${closeCount}] ${lines[i]}`);
}
