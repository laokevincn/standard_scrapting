import { findSamrUrl } from './src/scraper_samr.ts';
import { scrapeSamrDetails } from './src/scraper_details.ts';
import fs from 'fs';

async function run() {
    const num = 'DB4408/T 52-2025';
    console.log('Searching for:', num);
    const url = await findSamrUrl(num);
    console.log('Found URL:', url);
    if (url) {
        const details = await scrapeSamrDetails(url);
        console.log('Details:', details);
        fs.writeFileSync('output-db4408.json', JSON.stringify({ url, details }, null, 2));
    } else {
        fs.writeFileSync('output-db4408.json', JSON.stringify({ error: 'No URL found' }));
    }
}

run();
