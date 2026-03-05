import axios from 'axios';
import Bottleneck from 'bottleneck';
import * as cheerio from 'cheerio';
import { insertOrUpdateStandard } from './db.ts';

const BASE_URL = 'https://std.samr.gov.cn';

// 使用 bottleneck 精准控制并发和请求频率
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000 // 2 seconds per request for SAMR
});

export const scrapeStateSamr = {
  isScraping: false,
  currentKeyword: '',
  page: 0,
  totalPages: 0,
  totalSaved: 0
};

export async function scrapeSpecificPageSamr(keyword: string, page: number): Promise<{totalPages: number, totalRecords: number}> {
  console.log(`[SAMR] On-demand scraping page ${page} for "${keyword}"...`);
  try {
    const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(keyword)}&pageNo=${page}`;
    
    const response = await limiter.schedule(() => axios.get(searchUrl, {
      timeout: 10000
    }));

    console.log(`[SAMR DEBUG] HTTP Status: ${response.status}`);

    const html = response.data;
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
  } catch (error) {
    console.error(`[SAMR] Error on-demand scraping page ${page} for "${keyword}":`, error);
    return { totalPages: 1, totalRecords: 0 };
  }
}

export async function scrapeAndSaveSamr(initialKeyword: string, maxPages: number = 200) {
  if (scrapeStateSamr.isScraping) return;
  
  scrapeStateSamr.isScraping = true;
  scrapeStateSamr.totalSaved = 0;

  const keywordQueue = [initialKeyword];

  try {
    while (keywordQueue.length > 0) {
      const keyword = keywordQueue.shift()!;
      scrapeStateSamr.currentKeyword = keyword;
      scrapeStateSamr.page = 1;
      scrapeStateSamr.totalPages = 1;

      console.log(`[SAMR] Starting background scrape for "${keyword}"...`);
      let shouldSplit = false;

      do {
        console.log(`[SAMR] Scraping page ${scrapeStateSamr.page} for "${keyword}"...`);
        const searchUrl = `${BASE_URL}/search/stdPage?q=${encodeURIComponent(keyword)}&pageNo=${scrapeStateSamr.page}`;
        
        let retryCount = 0;
        let success = false;
        let html = '';

        while (!success && retryCount < 3) {
          try {
            const response = await limiter.schedule(() => axios.get(searchUrl, {
              timeout: 20000
            }));

            html = response.data;
            success = true;
          } catch (err: any) {
            retryCount++;
            console.error(`[SAMR WARN] Request failed on page ${scrapeStateSamr.page} (Attempt ${retryCount}/3): ${err.message}`);
            if (retryCount >= 3) {
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }

        const $ = cheerio.load(html);

        const posts = $('.post');
        console.log(`[SAMR DEBUG] Found ${posts.length} .post elements on page ${scrapeStateSamr.page}`);

        if (scrapeStateSamr.page === 1) {
          const match = html.match(/为您找到相关结果约&nbsp;<span>(\d+)<\/span>&nbsp;个/);
          if (match) {
            const totalRecords = parseInt(match[1], 10);
            scrapeStateSamr.totalPages = Math.ceil(totalRecords / 10);
            
            // SAMR might not have a 200 page limit, but let's keep it safe
            if (scrapeStateSamr.totalPages > 190) {
              console.log(`[SAMR INFO] 关键词 "${keyword}" 共有 ${scrapeStateSamr.totalPages} 页，超过 200 页限制！自动拆分为子任务...`);
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
              url
            });
            scrapeStateSamr.totalSaved++;
          }
        });

        scrapeStateSamr.page++;

      } while (scrapeStateSamr.page <= scrapeStateSamr.totalPages && scrapeStateSamr.page <= maxPages);
      
      if (shouldSplit) {
        for (let i = 0; i <= 9; i++) {
          keywordQueue.push(`${keyword}${i}`);
        }
      } else {
        console.log(`[SAMR] Finished scraping for "${keyword}".`);
      }

    }
    
    console.log(`[SAMR] All scraping tasks finished. Total saved: ${scrapeStateSamr.totalSaved} records.`);
  } catch (error) {
    console.error(`[SAMR] Error scraping:`, error);
  } finally {
    scrapeStateSamr.isScraping = false;
  }
}
