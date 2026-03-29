const URL = 'https://www.youtube.com/watch?v=0jmJdvI6f-A';

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

(async () => {
	console.log(`Launching browser...`);

	const browser = await puppeteer.launch({
		headless: "new",
		args: ['--disable-web-security']
	});

	const page = await browser.newPage();
	let collectedJS = '';

	page.on('response', async (response) => {
		const request = response.request();

		if (request.resourceType() === 'script') {
			try {
				const status = response.status();
				if (status >= 200 && status < 300) {
					const scriptContent = await response.text();

					const byteLength = Buffer.byteLength(scriptContent, 'utf8');
					const sizeMB = (byteLength / (1024 * 1024)).toFixed(4);
					const lines = scriptContent.split('\n').length;
					const wsCount = (scriptContent.match(/\s/g) || []).length;
					const wsPercent = scriptContent.length > 0 ? ((wsCount / scriptContent.length) * 100).toFixed(2) : '0.00';

					console.log(`${request.url()}`);
					console.log(`  └─ Size: ${sizeMB} MB | Lines: ${lines} | Whitespace: ${wsPercent}%\n`);

					collectedJS += `\n\n==========================================\n`;
					collectedJS += `SOURCE: ${request.url()}\n`;
					collectedJS += `==========================================\n\n`;
					collectedJS += scriptContent;
				}
			} catch (err) {
				console.log(`[Skipped] Could not extract text for ${request.url()}`);
			}
		}
	});

	console.log(`Navigating to ${URL}...\n`);
	try {
		await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

		console.log('Page loaded. Waiting an additional 5 seconds...');
		await new Promise(resolve => setTimeout(resolve, 5000));

	} catch (error) {
		console.error('Error during navigation:', error.message);
	} finally {
		console.log('Closing browser...');
		await browser.close();
	}

	console.log(`Writing data to all_scripts_collected.js...`);
	await fs.writeFile('all_scripts_collected.js', collectedJS, 'utf8');

	const stats = await fs.stat('all_scripts_collected.js');
	const fileSizeInMegabytes = stats.size / (1024 * 1024);

	console.log(`✅ Done! Saved ${fileSizeInMegabytes.toFixed(2)} MB of JavaScript to all_scripts_collected.js`);
})();
