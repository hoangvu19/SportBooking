const fs = require('fs');
const lines = fs.readFileSync('src/i18n/translations.js', 'utf-8').split('\n');

let depth = 0;
let problems = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    
    const prevDepth = depth;
    depth += openCount - closeCount;
    
    // Log significant depth changes
    if (openCount > 0 || closeCount > 0) {
        const indent = '  '.repeat(Math.max(0, Math.min(prevDepth, depth)));
        console.log(`${lineNum.toString().padStart(4)}: depth ${prevDepth}→${depth} ${indent}${line.trim().substring(0, 60)}`);
    }
    
    if (depth < 0) {
        problems.push(`Line ${lineNum}: Negative depth ${depth}!`);
        break;
    }
}

console.log(`\nFinal depth: ${depth}`);
console.log(`Expected: 0`);

if (problems.length > 0) {
    console.log('\nProblems:');
    problems.forEach(p => console.log(p));
}
