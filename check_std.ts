import Database from 'better-sqlite3';
import { scrapeSamrDetails } from './src/scraper_details.ts';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs';

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
});

async function test() {
    const db = new Database('standards.db');
    const std: any = db.prepare('SELECT * FROM standards WHERE std_num = ?').get('DB4408/T 52-2025');

    if (std && std.url_samr) {
        const details = await scrapeSamrDetails(std.url_samr);

        const response = await axiosInstance.get(std.url_samr);
        const $ = cheerio.load(response.data);

        const dlText = $('dl dt').map((i, el) => $(el).text() + ': ' + $(el).next('dd').text()).get();

        fs.writeFileSync('output.log', JSON.stringify({
            dbRecord: std,
            scrapedDetails: details,
            basicInfoCount: $('.basicInfo_item').length,
            dlCount: $('dl dt').length,
            dlText: dlText
        }, null, 2));

    } else {
        fs.writeFileSync('output.log', 'No SAMR URL found locally.');
    }
}

test();
