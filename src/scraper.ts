import { gotScraping } from 'got-scraping';
import Bottleneck from 'bottleneck';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { insertOrUpdateStandard } from './db.ts';

const BASE_URL = 'http://www.csres.com';

// 使用 bottleneck 精准控制并发和请求频率
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 5000 // 强制每 5 秒最多 1 个请求，防止触发频控
});

export const scrapeState = {
  isScraping: false,
  currentKeyword: '',
  page: 0,
  totalPages: 0,
  totalSaved: 0
};

export async function scrapeSpecificPage(keyword: string, page: number): Promise<{totalPages: number, totalRecords: number}> {
  console.log(`On-demand scraping page ${page} for "${keyword}"...`);
  try {
    const gbkBuffer = iconv.encode(keyword, 'gbk');
    let gbkEncodedKeyword = '';
    for (let i = 0; i < gbkBuffer.length; i++) {
      gbkEncodedKeyword += '%' + gbkBuffer[i].toString(16).toUpperCase();
    }

    const searchUrl = `${BASE_URL}/s.jsp?keyword=${gbkEncodedKeyword}&pageNum=${page}`;
    
    const response = await limiter.schedule(() => gotScraping.get(searchUrl, {
      responseType: 'buffer',
      headers: {
        'Referer': 'http://www.csres.com/',
        'Cookie': 'source=www.csres.com; JSESSIONID=AAB03DB4CE4C833B66A1D799333EACD4.wwwcsres; __utma=131666461.1647832508.1772439543.1772439543.1772439543.1; __utmb=131666461; __utmc=131666461; __utmz=131666461.1772439543.1.1.utmccn=(direct)|utmcsr=(direct)|utmcmd=(none); cCount202632=12',
      },
      timeout: { request: 10000 },
      retry: { limit: 0 } // 我们自己处理重试逻辑
    }));

    console.log(`[DEBUG] HTTP Status: ${response.statusCode}`);

    const html = iconv.decode(response.body, 'gbk');
    const $ = cheerio.load(html);

    const rows = $('tr');
    console.log(`[DEBUG] Found ${rows.length} <tr> elements on page ${page}`);

    if (page === 1) {
      if (html.includes('安全拦截') || html.includes('验证码') || html.includes('防火墙')) {
        console.log('[WARN] 可能被目标网站的防火墙或验证码拦截了！');
        console.log(`[DEBUG] HTML Preview:\n${html.substring(0, 500)}`);
      } else if (html.includes('您无权访问') || html.includes('超出我们允许的范围')) {
        console.log('[WARN] 目标网站提示：您的访问已经超出允许的范围（IP 访问频率过高或需要登录）。');
      } else if (rows.length < 10) {
        console.log(`[DEBUG] HTML Preview (first 500 chars):\n${html.substring(0, 500)}`);
      }
    }

    let totalPages = 1;
    let totalRecords = 0;
    const match = html.match(/共找到(\d+)条/);
    if (match) {
      totalRecords = parseInt(match[1], 10);
      totalPages = Math.ceil(totalRecords / 20);
    }

    $('tr').each((i, el) => {
      const tds = $(el).children('td');
      if (tds.length >= 5) {
        const std_num = $(tds[0]).text().trim().replace(/\s+/g, ' ');
        const title = $(tds[1]).text().trim().replace(/\s+/g, ' ');
        const department = $(tds[2]).text().trim().replace(/\s+/g, ' ');
        const implement_date = $(tds[3]).text().trim().replace(/\s+/g, ' ');
        const status = $(tds[4]).text().trim().replace(/\s+/g, ' ');
        
        const link = $(tds[0]).find('a').attr('href');
        const url = link ? (link.startsWith('http') ? link : `${BASE_URL}${link}`) : '';

        // Filter out ISBNs and purely numeric strings with hyphens (e.g., 978-7-5066-7832-2)
        const isISBN = /^\d+(-\d+)+$/.test(std_num);

        if (std_num && !std_num.includes('标准编号') && std_num.length < 50 && title && !isISBN) {
          insertOrUpdateStandard({
            std_num,
            title,
            department,
            implement_date,
            status,
            url
          });
        }
      }
    });

    return { totalPages, totalRecords };
  } catch (error) {
    console.error(`Error on-demand scraping page ${page} for "${keyword}":`, error);
    return { totalPages: 1, totalRecords: 0 };
  }
}

export async function scrapeAndSave(initialKeyword: string, maxPages: number = 200) {
  if (scrapeState.isScraping) return;
  
  scrapeState.isScraping = true;
  scrapeState.totalSaved = 0;

  // 使用队列来管理搜索任务，支持关键词自动拆分
  const keywordQueue = [initialKeyword];

  try {
    while (keywordQueue.length > 0) {
      const keyword = keywordQueue.shift()!;
      scrapeState.currentKeyword = keyword;
      scrapeState.page = 1;
      scrapeState.totalPages = 1;

      console.log(`Starting background scrape for "${keyword}"...`);
      let shouldSplit = false;

      do {
        console.log(`Scraping page ${scrapeState.page} for "${keyword}"...`);
        const gbkBuffer = iconv.encode(keyword, 'gbk');
        let gbkEncodedKeyword = '';
        for (let i = 0; i < gbkBuffer.length; i++) {
          gbkEncodedKeyword += '%' + gbkBuffer[i].toString(16).toUpperCase();
        }

        const searchUrl = `${BASE_URL}/s.jsp?keyword=${gbkEncodedKeyword}&pageNum=${scrapeState.page}`;
        
        let retryCount = 0;
        let success = false;
        let html = '';

        while (!success && retryCount < 3) {
          try {
            const response = await limiter.schedule(() => gotScraping.get(searchUrl, {
              responseType: 'buffer',
              headers: {
                'Referer': 'http://www.csres.com/',
                'Cookie': 'source=www.csres.com; JSESSIONID=AAB03DB4CE4C833B66A1D799333EACD4.wwwcsres; __utma=131666461.1647832508.1772439543.1772439543.1772439543.1; __utmb=131666461; __utmc=131666461; __utmz=131666461.1772439543.1.1.utmccn=(direct)|utmcsr=(direct)|utmcmd=(none); cCount202632=12',
              },
              timeout: { request: 20000 },
              retry: { limit: 0 }
            }));

            html = iconv.decode(response.body, 'gbk');
            success = true;
          } catch (err: any) {
            retryCount++;
            console.error(`[WARN] Request failed on page ${scrapeState.page} (Attempt ${retryCount}/3): ${err.message}`);
            if (retryCount >= 3) {
              throw err; // Re-throw if max retries reached
            }
            // Wait longer before retrying (10 seconds)
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }

        const $ = cheerio.load(html);

        const rows = $('tr');
        console.log(`[DEBUG] Found ${rows.length} <tr> elements on page ${scrapeState.page}`);

        if (scrapeState.page === 1) {
          if (html.includes('安全拦截') || html.includes('验证码') || html.includes('防火墙')) {
            console.log('[WARN] 可能被目标网站的防火墙或验证码拦截了！');
            console.log(`[DEBUG] HTML Preview:\n${html.substring(0, 500)}`);
          } else if (html.includes('您无权访问') || html.includes('超出我们允许的范围')) {
            console.log('[WARN] 目标网站提示：您的访问已经超出允许的范围（IP 访问频率过高或需要登录）。');
            console.log('[INFO] 触发了查询次数限制，系统将暂停抓取 30 分钟以等待解封...');
            await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 暂停 30 分钟
            console.log('[INFO] 暂停结束，尝试恢复抓取...');
            // 将当前关键词重新放回队列头部，以便重试
            keywordQueue.unshift(keyword);
            break; // 跳出当前关键词的翻页循环，重新开始
          } else if (rows.length < 10) {
            console.log(`[DEBUG] HTML Preview (first 500 chars):\n${html.substring(0, 500)}`);
          }

          const match = html.match(/共找到(\d+)条/);
          if (match) {
            const totalRecords = parseInt(match[1], 10);
            scrapeState.totalPages = Math.ceil(totalRecords / 20);
            
            // 核心逻辑：如果总页数超过 190 页（接近 200 页的物理限制），则触发自动拆分
            if (scrapeState.totalPages > 190) {
              console.log(`[INFO] 关键词 "${keyword}" 共有 ${scrapeState.totalPages} 页，超过 200 页限制！自动拆分为子任务...`);
              shouldSplit = true;
              break; // 跳出当前关键词的翻页循环
            }
          }
        }

        $('tr').each((i, el) => {
          const tds = $(el).children('td');
          if (tds.length >= 5) {
            const std_num = $(tds[0]).text().trim().replace(/\s+/g, ' ');
            const title = $(tds[1]).text().trim().replace(/\s+/g, ' ');
            const department = $(tds[2]).text().trim().replace(/\s+/g, ' ');
            const implement_date = $(tds[3]).text().trim().replace(/\s+/g, ' ');
            const status = $(tds[4]).text().trim().replace(/\s+/g, ' ');
            
            const link = $(tds[0]).find('a').attr('href');
            const url = link ? (link.startsWith('http') ? link : `${BASE_URL}${link}`) : '';

            // Filter out ISBNs and purely numeric strings with hyphens (e.g., 978-7-5066-7832-2)
            const isISBN = /^\d+(-\d+)+$/.test(std_num);

            if (std_num && !std_num.includes('标准编号') && std_num.length < 50 && title && !isISBN) {
              insertOrUpdateStandard({
                std_num,
                title,
                department,
                implement_date,
                status,
                url
              });
              scrapeState.totalSaved++;
            }
          }
        });

        scrapeState.page++;

      } while (scrapeState.page <= scrapeState.totalPages && scrapeState.page <= maxPages);
      
      if (shouldSplit) {
        // 将关键词拆分为 10 个子任务 (例如 "GB" 拆分为 "GB0", "GB1" ... "GB9")
        // 注意：不要加空格，因为工标网空格是通配符/多词搜索
        for (let i = 0; i <= 9; i++) {
          keywordQueue.push(`${keyword}${i}`);
        }
      } else {
        console.log(`Finished scraping for "${keyword}".`);
      }

    } // end while queue
    
    console.log(`All scraping tasks finished. Total saved: ${scrapeState.totalSaved} records.`);
  } catch (error) {
    console.error(`Error scraping:`, error);
  } finally {
    scrapeState.isScraping = false;
  }
}
