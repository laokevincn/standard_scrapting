import Database from 'better-sqlite3';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Bottleneck from 'bottleneck';
import { scrapeSamrDetails } from './src/scraper_details.ts';
import { updateStandardDetails } from './src/db.ts';

const db = new Database('standards.db');
const BASE_URL = 'https://std.samr.gov.cn';

const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 2000 // SAMR rate limiting
});

async function findSamrUrl(std_num: string): Promise<string | null> {
    try {
        const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(std_num)}&pageNo=1`;
        const response = await limiter.schedule(() => axios.get(searchUrl, { timeout: 10000 }));
        const $ = cheerio.load(response.data);

        let foundUrl = null;
        $('.post').each((i, el) => {
            const a = $(el).find('.s-title a');
            const code = a.find('.en-code').text().trim().replace(/\s+/g, ' ');
            if (code === std_num) {
                const tid = a.attr('tid');
                const pid = a.attr('pid');
                if (tid === 'BV_HB') foundUrl = `${BASE_URL}/hb/search/stdHBDetailed?id=${pid}`;
                else if (tid === 'BV_DB') foundUrl = `${BASE_URL}/db/search/stdDBDetailed?id=${pid}`;
                else foundUrl = `${BASE_URL}/gb/search/gbDetailed?id=${pid}`;
                return false; // break loop
            }
        });
        return foundUrl;
    } catch (error: any) {
        console.error(`Error searching SAMR for ${std_num}:`, error.message);
        return null;
    }
}

async function main() {
    const standards = db.prepare('SELECT id, std_num, url_samr FROM standards ORDER BY updated_at ASC').all() as any[];
    console.log(`Found ${standards.length} standards to check and rescrape.`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < standards.length; i++) {
        const std = standards[i];
        console.log(`[${i + 1}/${standards.length}] Processing ${std.std_num}...`);

        try {
            let url = std.url_samr;
            if (!url) {
                url = await findSamrUrl(std.std_num);
                if (url) {
                    console.log(`  -> Found SAMR URL: ${url}`);
                    updateStandardDetails(std.std_num, { url_samr: url });
                } else {
                    console.log(`  -> Could not find SAMR URL. Skipping.`);
                    skippedCount++;
                    continue;
                }
            }

            const details = await scrapeSamrDetails(url);
            if (details) {
                updateStandardDetails(std.std_num, details);
                successCount++;
                console.log(`  -> Success. Details updated.`);
            } else {
                failCount++;
                console.log(`  -> Failed to parse details from SAMR.`);
            }
        } catch (error: any) {
            failCount++;
            console.log(`  -> Error scraping ${std.std_num}: ${error.message}`);
        }
    }

    console.log(`\nRescrape finished!`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped (not found): ${skippedCount}`);
}

main().catch(console.error);
