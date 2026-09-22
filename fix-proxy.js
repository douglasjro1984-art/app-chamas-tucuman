const fs = require('fs');
let lines = fs.readFileSync('backend/server.js', 'utf8').split('\n');
// Find line 140 (0-indexed: 139) which is "];\r"
// Insert "app.set('trust proxy', 1);" after it
const insertLine = 140; // 0-indexed = line 141
const insertAfter = "];";
if (lines[139].trim() === '];') {
    lines.splice(140, 0, "app.set('trust proxy', 1);");
    const newStr = lines.join('\n');
    fs.writeFileSync('backend/server.js', newStr);
    console.log('Done, inserted trust proxy after line 140');
} else {
    console.log('Line 140 is:', JSON.stringify(lines[139]));
}