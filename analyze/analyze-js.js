const BASE_PATTERN = 'yt-[\\w-]+';

const fs = require('fs');
const { execSync } = require('child_process');

const CONTEXT_REGEX = new RegExp(`(?:(["'\`])(${BASE_PATTERN})\\1|(${BASE_PATTERN})\\s*:)`, 'g');

if (!fs.existsSync('ignored-names.txt')) {
	console.error('❌ Error: ignored-names.txt not found. Please create this file.');
	process.exit(1);
}

const ignoredContent = fs.readFileSync('ignored-names.txt', 'utf8');
const parsedIgnoredNames = ignoredContent.split('\n')
	.map(name => name.trim())
	.filter(name => name.length > 0);

if (!fs.existsSync('all_scripts_collected.js')) {
	console.log(`all_scripts_collected.js not found. Running collect-js.js...`);
	try {
		execSync('node collect-js.js', { stdio: 'inherit' });
	} catch (err) {
		console.error(`❌ Error running collect-js.js: ${err.message}`);
		process.exit(1);
	}
}

console.log(`Reading all_scripts_collected.js...`);

let fileContents;
try {
	fileContents = fs.readFileSync('all_scripts_collected.js', 'utf8');
} catch (err) {
	console.error(`❌ Error reading file: ${err.message}`);
	process.exit(1);
}

console.log(`Searching for pattern...`);

const counts = {};
let totalMatches = 0;

for (const match of fileContents.matchAll(CONTEXT_REGEX)) {
	const foundName = match[2] || match[3];

	if (parsedIgnoredNames.includes(foundName)) {
		continue;
	}

	totalMatches++;
	counts[foundName] = (counts[foundName] || 0) + 1;
}

if (totalMatches === 0) {
	console.log('⚠️ No matches found (or all were ignored).');
	process.exit(0);
}

const sortedResults = Object.entries(counts)
	.map(([name, count]) => ({ name, count }))
	.sort((a, b) => b.count - a.count);

const uniqueCount = sortedResults.length;
console.log(`Found ${totalMatches} total occurrences (${uniqueCount} unique strings).\n`);

let outputData = `--- EXTRACTION RESULTS ---\n`;
outputData += `Source: all_scripts_collected.js\n`;
outputData += `Unique Items: ${uniqueCount}\n`;
outputData += `Ignored List Size: ${parsedIgnoredNames.length}\n`;
outputData += `--------------------------\n\n`;

sortedResults.forEach(item => {
	const formattedCount = String(item.count).padStart(6, ' ');
	outputData += `${formattedCount}x | ${item.name}\n`;
});

try {
	fs.writeFileSync('extracted_names.txt', outputData, 'utf8');

	console.log(`--- TOP 20 MATCHES ---`);
	const top20 = sortedResults.slice(0, 100);
	top20.forEach(item => {
		const formattedCount = String(item.count).padStart(6, ' ');
		console.log(`${formattedCount}x | ${item.name}`);
	});

	console.log(`\n✅ Success! Saved all ${uniqueCount} items to extracted_names.txt`);
} catch (err) {
	console.error(`❌ Error writing output file: ${err.message}`);
	process.exit(1);
}
