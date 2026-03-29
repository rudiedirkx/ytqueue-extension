const CONTEXT_LENGTH = 30;

const fs = require('fs');

const searchTerm = process.argv[2];

if (!searchTerm) {
	console.error('❌ Error: Please provide a name to search for as an argument.');
	process.exit(1);
}

if (!fs.existsSync('all_scripts_collected.js')) {
	console.error(`❌ Error: all_scripts_collected.js not found.`);
	process.exit(1);
}

let fileContents;
try {
	fileContents = fs.readFileSync('all_scripts_collected.js', 'utf8');
} catch (err) {
	console.error(`❌ Error reading file: ${err.message}`);
	process.exit(1);
}

const CONTEXT_REGEX = new RegExp(`(?:(["'\`])(${searchTerm})\\1|(${searchTerm})\\s*:)`, 'g');

let matchCount = 0;
const results = [];

for (const match of fileContents.matchAll(CONTEXT_REGEX)) {
	if (results.length < 20) {
		const start = Math.max(0, match.index - CONTEXT_LENGTH);
		const end = Math.min(fileContents.length, match.index + match[0].length + CONTEXT_LENGTH);

		let context = fileContents.substring(start, end);
		context = context.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

		results.push(context);
	}
	matchCount++;
}

if (matchCount === 0) {
	console.log(`⚠️ No matches found for "${searchTerm}".`);
	process.exit(0);
}

console.log(`Found ${matchCount} total occurrences of "${searchTerm}".\n`);
console.log(`--- FIRST ${results.length} MATCHES ---`);

results.forEach((res, i) => {
	const num = String(i + 1).padStart(2, ' ');
	console.log(`${num}. ${res}`);
});
