const fs = require('fs');
const lines = fs.readFileSync('src/i18n/translations.js', 'utf-8').split('\n');

let depth = 0;
let enStart = -1, enEnd = -1;
let viStart = -1, viEnd = -1;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim() === 'en: {') enStart = i;
    if (line.trim() === 'vi: {') viStart = i;
    
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    depth += openCount - closeCount;
    
    // When depth returns to 1 after en starts, en ends
    if (enStart >= 0 && enEnd < 0 && depth === 1 && i > enStart + 10 && line.includes('},')) {
        enEnd = i;
    }
    
    // When depth returns to 1 after vi starts, vi ends  
    if (viStart >= 0 && viEnd < 0 && depth === 1 && i > viStart + 10 && line.includes('},')) {
        viEnd = i;
    }
}

console.log(`EN: lines ${enStart + 1} to ${enEnd + 1}`);
console.log(`VI: lines ${viStart + 1} to ${viEnd + 1}`);

// Count braces in each section
const enSection = lines.slice(enStart, enEnd + 1).join('\n');
const viSection = lines.slice(viStart, viEnd + 1).join('\n');

const enOpen = (enSection.match(/\{/g) || []).length;
const enClose = (enSection.match(/\}/g) || []).length;
const viOpen = (viSection.match(/\{/g) || []).length;
const viClose = (viSection.match(/\}/g) || []).length;

console.log(`\nEN braces: ${enOpen} open, ${enClose} close, diff: ${enOpen - enClose}`);
console.log(`VI braces: ${viOpen} open, ${viClose} close, diff: ${viOpen - viClose}`);

// Show lines around where EN ends
console.log(`\n--- EN ending (lines ${enEnd - 2 + 1} to ${enEnd + 3 + 1}) ---`);
for (let i = enEnd - 2; i <= enEnd + 2 && i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}
