import axios from 'axios';
import Bottleneck from 'bottleneck';
import * as cheerio from 'cheerio';
import { insertOrUpdateStandard, updateStandardDetails } from './db.ts';
import { scrapeSamrDetails } from './scraper_details.ts';

import https from 'https';

const BASE_URL = 'https://std.samr.gov.cn';

const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }
});

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && response.data.code === 500 && response.data.message?.includes('访问过于频繁')) {
      throw new Error('IP_BLOCKED');
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.data && error.response.data.code === 500 && error.response.data.message?.includes('访问过于频繁')) {
      throw new Error('IP_BLOCKED');
    }
    return Promise.reject(error);
  }
);

// 使用 bottleneck 精准控制并发和请求频率
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000 // 2 seconds per request for SAMR
});

export const scrapeStateSamr: {
  isScraping: boolean;
  currentKeyword: string;
  page: number;
  totalPages: number;
  totalSaved: number;
  isCancelled: boolean;
  logs: string[];
} = {
  isScraping: false,
  currentKeyword: '',
  page: 0,
  totalPages: 0,
  totalSaved: 0,
  isCancelled: false,
  logs: []
};

export function addSamrLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logMsg = `[SAMR ${timestamp}] ${msg}`;
  console.log(logMsg);
  scrapeStateSamr.logs.push(logMsg);
  if (scrapeStateSamr.logs.length > 200) {
    scrapeStateSamr.logs.shift();
  }
}

export async function scrapeSpecificPageSamr(keyword: string, page: number): Promise<{ totalPages: number, totalRecords: number }> {
  console.log(`[SAMR] On-demand scraping page ${page} for "${keyword}"...`);
  try {
    const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(keyword)}&pageNo=${page}`;

    const response = await limiter.schedule(() => axiosInstance.get(searchUrl, {
      timeout: 10000
    }));

    console.log(`[SAMR DEBUG] HTTP Status: ${response.status}`);

    const html = response.data;
    if (typeof html === 'string' && (html.includes('loginPop()') || html.includes('访问过于频繁'))) {
      throw new Error('IP_BLOCKED');
    }
    const $ = cheerio.load(html);

    const posts = $('.post');
    console.log(`[SAMR DEBUG] Found ${posts.length} .post elements on page ${page}`);

    let totalPages = 1;
    let totalRecords = 0;
    const match = html.match(/为您找到相关结果约&nbsp;<span>(\d+)<\/span>&nbsp;个/);
    if (match) {
      totalRecords = parseInt(match[1], 10);
      totalPages = Math.ceil(totalRecords / 10); // SAMR seems to have 10 per page
    }

    posts.each((i, el) => {
      const a = $(el).find('.s-title a');
      const std_num = a.find('.en-code').text().trim().replace(/\s+/g, ' ');
      const title = a.text().replace(std_num, '').trim();
      const status = $(el).find('.s-status').first().text().trim();
      const implement_date = $(el).find('.glyphicon-saved').nextAll('time').text().trim();
      const department = $(el).find('.media-left:contains("归口单位")').next('.media-body').text().trim();

      const tid = a.attr('tid');
      const pid = a.attr('pid');
      let url = '';
      if (tid === 'BV_HB') url = `${BASE_URL}/hb/search/stdHBDetailed?id=${pid}`;
      else if (tid === 'BV_DB') url = `${BASE_URL}/db/search/stdDBDetailed?id=${pid}`;
      else url = `${BASE_URL}/gb/search/gbDetailed?id=${pid}`;

      if (std_num && title) {
        insertOrUpdateStandard({
          std_num,
          title,
          department,
          implement_date,
          status,
          url
        });
      }
    });

    return { totalPages, totalRecords };
  } catch (error: any) {
    if (error.message === 'IP_BLOCKED') {
      console.error(`[SAMR CRITICAL] IP Blocked during on-demand scrape!`);
    } else {
      console.error(`[SAMR] Error on-demand scraping page ${page} for "${keyword}":`, error);
    }
    return { totalPages: 1, totalRecords: 0 };
  }
}

export async function scrapeAndSaveSamr(initialKeyword: string, maxPages: number = 200) {
  if (scrapeStateSamr.isScraping) return;

  scrapeStateSamr.isScraping = true;
  scrapeStateSamr.isCancelled = false;
  scrapeStateSamr.totalSaved = 0;
  scrapeStateSamr.logs = [];

  const keywordQueue = [initialKeyword];

  try {
    while (keywordQueue.length > 0) {
      if (scrapeStateSamr.isCancelled) {
        addSamrLog(`Task cancelled by user.`);
        break;
      }

      const keyword = keywordQueue.shift()!;
      scrapeStateSamr.currentKeyword = keyword;
      scrapeStateSamr.page = 1;
      scrapeStateSamr.totalPages = 1;

      addSamrLog(`Starting background scrape for "${keyword}"...`);
      let shouldSplit = false;

      do {
        if (scrapeStateSamr.isCancelled) {
          addSamrLog(`Stopping page loop. Task cancelled.`);
          break;
        }

        addSamrLog(`Scraping page ${scrapeStateSamr.page} for "${keyword}"...`);
        const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(keyword)}&pageNo=${scrapeStateSamr.page}`;

        let retryCount = 0;
        let success = false;
        let html = '';

        while (!success && retryCount < 3) {
          try {
            const response = await limiter.schedule(() => axiosInstance.get(searchUrl, {
              timeout: 20000
            }));

            html = response.data;
            if (typeof html === 'string' && (html.includes('loginPop()') || html.includes('访问过于频繁'))) {
              throw new Error('IP_BLOCKED');
            }
            success = true;
          } catch (err: any) {
            if (err.message === 'IP_BLOCKED') {
              throw err;
            }
            retryCount++;
            addSamrLog(`WARNING: Request failed on page ${scrapeStateSamr.page} (Attempt ${retryCount}/3): ${err.message}`);
            if (retryCount >= 3) {
              throw err;
            }
            if (scrapeStateSamr.isCancelled) break;
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }

        const $ = cheerio.load(html);

        const posts = $('.post');
        addSamrLog(`Found ${posts.length} results on page ${scrapeStateSamr.page}`);

        if (scrapeStateSamr.page === 1) {
          const match = html.match(/为您找到相关结果约&nbsp;<span>(\d+)<\/span>&nbsp;个/);
          if (match) {
            const totalRecords = parseInt(match[1], 10);
            scrapeStateSamr.totalPages = Math.ceil(totalRecords / 10);
            addSamrLog(`Total matched records roughly: ${totalRecords} (approx ${scrapeStateSamr.totalPages} pages)`);

            // SAMR might not have a 200 page limit, but let's keep it safe
            if (scrapeStateSamr.totalPages > 190) {
              addSamrLog(`INFO: Keyword "${keyword}" has ${scrapeStateSamr.totalPages} pages, exceeding 200! Auto-splitting into sub-tasks...`);
              shouldSplit = true;
              break;
            }
          }
        }

        posts.each((i, el) => {
          const a = $(el).find('.s-title a');
          const std_num = a.find('.en-code').text().trim().replace(/\s+/g, ' ');
          const title = a.text().replace(std_num, '').trim();
          const status = $(el).find('.s-status').first().text().trim();
          const implement_date = $(el).find('.glyphicon-saved').nextAll('time').text().trim();
          const department = $(el).find('.media-left:contains("归口单位")').next('.media-body').text().trim();

          const tid = a.attr('tid');
          const pid = a.attr('pid');
          let url = '';
          if (tid === 'BV_HB') url = `${BASE_URL}/hb/search/stdHBDetailed?id=${pid}`;
          else if (tid === 'BV_DB') url = `${BASE_URL}/db/search/stdDBDetailed?id=${pid}`;
          else url = `${BASE_URL}/gb/search/gbDetailed?id=${pid}`;

          if (std_num && title) {
            insertOrUpdateStandard({
              std_num,
              title,
              department,
              implement_date,
              status,
              url,
              url_samr: url
            });
            scrapeStateSamr.totalSaved++;
          }
        });

        scrapeStateSamr.page++;

      } while (scrapeStateSamr.page <= scrapeStateSamr.totalPages && scrapeStateSamr.page <= maxPages && !scrapeStateSamr.isCancelled);

      if (scrapeStateSamr.isCancelled) {
        break;
      }

      if (shouldSplit) {
        for (let i = 0; i <= 9; i++) {
          keywordQueue.push(`${keyword}${i}`);
        }
      } else {
        addSamrLog(`Finished scraping for "${keyword}".`);
      }

    }

    if (scrapeStateSamr.isCancelled) {
      addSamrLog(`Scraping aborted by user. Saved ${scrapeStateSamr.totalSaved} records before stopping.`);
    } else {
      addSamrLog(`All tasks finished. Total saved: ${scrapeStateSamr.totalSaved} records.`);
    }
  } catch (error: any) {
    if (error.message === 'IP_BLOCKED') {
      addSamrLog(`CRITICAL: SAMR IP Blocked (访问过于频繁). Aborting all tasks.`);
      scrapeStateSamr.isCancelled = true;
    } else {
      addSamrLog(`ERROR during execution: ${error.message}`);
      console.error(`[SAMR ERROR]:`, error);
    }
  } finally {
    scrapeStateSamr.isScraping = false;
    scrapeStateSamr.isCancelled = false;
  }
}

export const rescrapeState: {
  isRunning: boolean;
  totalFound: number;
  processed: number;
  successCount: number;
  failCount: number;
  isCancelled: boolean;
  logs: string[];
} = {
  isRunning: false,
  totalFound: 0,
  processed: 0,
  successCount: 0,
  failCount: 0,
  isCancelled: false,
  logs: []
};

function addRescrapeLog(msg: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logMsg = `[Rescrape ${timestamp}] ${msg}`;
  console.log(logMsg);
  rescrapeState.logs.push(logMsg);
  if (rescrapeState.logs.length > 200) {
    rescrapeState.logs.shift();
  }
}

// Re-using the logic from rescrape_missing.ts
export async function findSamrUrl(stdNum: string): Promise<string | null> {
  const cleanStdNum = stdNum.replace(/[\s/]/g, ' ').trim();
  const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(cleanStdNum)}`;

  try {
    const res = await limiter.schedule(() => axiosInstance.get(searchUrl, { timeout: 15000 }));
    if (res.data && typeof res.data === 'string' && (res.data.includes('loginPop()') || res.data.includes('访问过于频繁'))) {
      throw new Error('IP_BLOCKED');
    }
    const $ = cheerio.load(res.data);
    let foundUrl: string | null = null;

    $('.post').each((_, el) => {
      if (foundUrl) return;
      const a = $(el).find('.s-title a');
      const codeColumn = a.find('.en-code').text().trim().replace(/\s+/g, ' ');

      if (codeColumn === stdNum || codeColumn.replace(/\s/g, '') === stdNum.replace(/\s/g, '')) {
        const tid = a.attr('tid');
        const pid = a.attr('pid');
        if (tid === 'BV_HB') foundUrl = `${BASE_URL}/hb/search/stdHBDetailed?id=${pid}`;
        else if (tid === 'BV_DB') foundUrl = `${BASE_URL}/db/search/stdDBDetailed?id=${pid}`;
        else foundUrl = `${BASE_URL}/gb/search/gbDetailed?id=${pid}`;
      }
    });

    return foundUrl;
  } catch (err: any) {
    if (err.message === 'IP_BLOCKED') throw err;
    console.error(`  [Search Error for ${stdNum}] ${err.message}`);
    return null;
  }
}


import { getMissingScrapeStandards, markStandardFailed } from './db.ts';

export async function startRescrapeMissing() {
  if (rescrapeState.isRunning) return;

  rescrapeState.isRunning = true;
  rescrapeState.isCancelled = false;
  rescrapeState.successCount = 0;
  rescrapeState.failCount = 0;
  rescrapeState.logs = [];

  try {
    addRescrapeLog('Fetching missing records (status = Missing/Needs Scrape)...');
    const records = getMissingScrapeStandards();

    rescrapeState.totalFound = records.length;
    rescrapeState.processed = 0;
    addRescrapeLog(`Found ${records.length} records to rescrape.`);

    for (const record of records) {
      if (rescrapeState.isCancelled) {
        addRescrapeLog(`Task cancelled by user.`);
        break;
      }

      rescrapeState.processed++;
      addRescrapeLog(`[${rescrapeState.processed}/${records.length}] Processing ${record.std_num}...`);

      let targetUrl = record.url_samr || record.url;

      if (!targetUrl || !targetUrl.includes('samr.gov.cn')) {
        targetUrl = await findSamrUrl(record.std_num) || '';
      }

      if (!targetUrl) {
        addRescrapeLog(`  -> Failed to find SAMR URL for ${record.std_num}`);
        markStandardFailed(record.id);
        rescrapeState.failCount++;
        continue;
      }

      const details = await scrapeSamrDetails(targetUrl);

      if (details) {
        // Tag the URL so we don't query it again
        details.url_samr = targetUrl;
        updateStandardDetails(record.std_num, details);
        rescrapeState.successCount++;
        addRescrapeLog(`  -> Successfully updated "${record.std_num}"`);
      } else {
        addRescrapeLog(`  -> Failed to parse details from ${targetUrl}`);
        rescrapeState.failCount++;
      }
    }

    if (rescrapeState.isCancelled) {
      addRescrapeLog(`Rescrape aborted by user. Success: ${rescrapeState.successCount}, Failed: ${rescrapeState.failCount}`);
    } else {
      addRescrapeLog(`Rescrape Complete! Success: ${rescrapeState.successCount}, Failed: ${rescrapeState.failCount}`);
    }
  } catch (error: any) {
    if (error.message === 'IP_BLOCKED') {
      addRescrapeLog(`CRITICAL: SAMR IP Blocked (访问过于频繁). Aborting all rescrape tasks.`);
      rescrapeState.isCancelled = true;
    } else {
      addRescrapeLog(`ERROR during rescrape: ${error.message}`);
      console.error(`[Rescrape ERROR]:`, error);
    }
  } finally {
    rescrapeState.isRunning = false;
    rescrapeState.isCancelled = false;
  }
}
