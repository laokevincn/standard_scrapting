import sqlite3 from 'better-sqlite3';
import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const db = new sqlite3('standards.db');

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function findSamrUrl(stdNum: string): Promise<string | null> {
    const cleanStdNum = stdNum.replace(/[\s/]/g, ' ').trim();
    const searchUrl = `https://openstd.samr.gov.cn/bzgk/auth/stdDataList?key=${encodeURIComponent(cleanStdNum)}`;

    try {
        const res = await axiosInstance.get(searchUrl);
        const $ = cheerio.load(res.data);
        let foundUrl = null;

        $('table.table tbody tr').each((_, row) => {
            if (foundUrl) return; // already found
            const codeColumn = $(row).find('td').eq(1).text().trim();
            const onclickAttr = $(row).attr('onclick');

            if (codeColumn === stdNum && onclickAttr) {
                // e.g. onclick="window.open('/bzgk/auth/stdHBDetailed?id=...', '_blank')"
                const match = onclickAttr.match(/window\.open\('([^']+)'/);
                if (match && match[1]) {
                    let relativeUrl = match[1];
                    // remove query string &state=... and &c_date=... if needed, but not strictly necessary for SAMR
                    foundUrl = `https://openstd.samr.gov.cn${relativeUrl}`;
                }
            }
        });

        return foundUrl;
    } catch (err: any) {
        console.error(`  [Search Error for ${stdNum}] ${err.message}`);
        return null;
    }
}

async function scrapeSamrDetails(url: string) {
    try {
        const res = await axiosInstance.get(url);
        const $ = cheerio.load(res.data);

        // Scrape details from SAMR
        const fieldMapping = {
            '标准号': 'std_num',
            '中文标准名称': 'title',
            '标准状态': 'status',
            '发布日期': 'publish_date',
            '实施日期': 'implement_date',
            '代替标准': 'replace_standard',
            '中国标准分类号': 'ccs_code',
            '国际标准分类号': 'ics_code',
            '起草单位': 'execution_unit', // Using execution_unit to store drafting units
            '归口单位': 'competent_department', // Using competent_department to store technical committees
            '主管部门': 'department', // Using department to store competent departments
        };

        const data: Record<string, string> = {};
        $('.basicInfo_item').each((_, item) => {
            const label = $(item).find('dt').text().trim().replace(/：$/, '');
            const value = $(item).find('dd').text().trim();
            const mappedKey = fieldMapping[label as keyof typeof fieldMapping];
            if (mappedKey) {
                data[mappedKey] = value;
            }
        });

        // standard category rule: title contains "GB", "GB/T", etc...
        let std_cat = '';
        if (data.std_num) {
            if (data.std_num.startsWith('GB/T')) std_cat = '国家推荐性标准';
            else if (data.std_num.startsWith('GB')) std_cat = '国家强制性标准';
            else if (data.std_num.startsWith('GB/Z')) std_cat = '国家标准化指导性技术文件';
            else std_cat = '行业标准';
        }

        return {
            std_num: data.std_num || '',
            title: data.title || '',
            publish_date: data.publish_date || '',
            implement_date: data.implement_date || '',
            status: data.status || '',
            replace_standard: data.replace_standard || '',
            ccs_code: data.ccs_code || '',
            ics_code: data.ics_code || '',
            execution_unit: data.execution_unit || '',
            competent_department: data.competent_department || '',
            department: data.department || '',
            standard_category: std_cat,
            url: url,
            url_samr: url
        };
    } catch (err: any) {
        console.error(`  [Detail Scrape Error] ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('Fetching missing records (status = Missing/Needs Scrape)...');
    const records = db.prepare(`SELECT id, std_num, url_samr, url FROM standards WHERE status = 'Missing/Needs Scrape'`).all() as any[];

    console.log(`Found ${records.length} records to rescrape.`);

    const updateStmt = db.prepare(`
    UPDATE standards SET 
      title = ?,
      publish_date = ?,
      implement_date = ?,
      status = ?,
      replace_standard = ?,
      ccs_code = ?,
      ics_code = ?,
      execution_unit = ?,
      competent_department = ?,
      department = ?,
      standard_category = ?,
      url = ?,
      url_samr = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        console.log(`[${i + 1}/${records.length}] Processing ${record.std_num}...`);

        let targetUrl = record.url_samr || record.url;

        // If we don't have a valid SAMR url, find it
        if (!targetUrl || !targetUrl.includes('openstd.samr.gov.cn')) {
            targetUrl = await findSamrUrl(record.std_num);
            await delay(500); // 500ms between search and fetch
        }

        if (!targetUrl) {
            console.log(`  -> Failed to find SAMR URL for ${record.std_num}`);
            // Mark it as failed so we don't keep trying it as "Missing/Needs Scrape" forever if we don't want to
            db.prepare(`UPDATE standards SET status = 'Scrape Failed' WHERE id = ?`).run(record.id);
            failCount++;
            continue;
        }

        // Now scrape the details
        const details = await scrapeSamrDetails(targetUrl);

        if (details && details.title) {
            updateStmt.run(
                details.title,
                details.publish_date,
                details.implement_date,
                details.status,
                details.replace_standard,
                details.ccs_code,
                details.ics_code,
                details.execution_unit,
                details.competent_department,
                details.department,
                details.standard_category,
                details.url,
                details.url_samr,
                record.id
            );
            successCount++;
            console.log(`  -> Successfully updated "${details.title}"`);
        } else {
            console.log(`  -> Failed to parse details from ${targetUrl}`);
            failCount++;
        }

        // Rate limiting
        await delay(1000); // 1s delay
    }

    console.log(`\nRescrape Complete!`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);
}

main().catch(console.error);
