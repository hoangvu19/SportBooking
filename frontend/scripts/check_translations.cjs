const fs=require('fs');
const path='./src/i18n/translations.js';
const s=fs.readFileSync(path,'utf8');
let stack=0;
const lines=s.split('\n');
for(let i=0;i<lines.length;i++){
  const line=lines[i];
  for(let ch of line){
    if(ch==='{' ) stack++;
    if(ch==='}') stack--;
  }
  if(stack<0){
    console.log('Negative stack at line',i+1);
    break;
  }
}
console.log('Final stack',stack);
let problematic=[];
for(let i=0;i<lines.length;i++){
  if(lines[i].trim()==='};') problematic.push(i+1);
}
console.log('Lines exactly with "};" at',problematic);

// print last 60 lines with numbers
const start=Math.max(0,lines.length-60);
for(let i=start;i<lines.length;i++){
  console.log((i+1)+': '+lines[i]);
}
