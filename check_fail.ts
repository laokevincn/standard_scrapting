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

async function run() {
    const url = 'https://std.samr.gov.cn/gb/search/gbDetailed?id=71F772D776D0D3A7E05397BE0A0AB82A';
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);
    const rows: Record<string, string> = {};
    $('.basicInfo_item').each((_, item) => {
        const label = $(item).find('dt').text().trim();
        const value = $(item).find('dd').text().trim();
        rows[label] = value;
    });
    console.log(rows);
    fs.writeFileSync('output_gb.json', JSON.stringify(rows, null, 2));
}

run();
