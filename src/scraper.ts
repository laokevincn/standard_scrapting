import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { insertOrUpdateStandard } from './db.ts';

const BASE_URL = 'http://www.csres.com';

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
    
    const response = await axios.get(searchUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': BASE_URL
      },
      timeout: 10000
    });

    console.log(`[DEBUG] HTTP Status: ${response.status}`);

    const html = iconv.decode(Buffer.from(response.data), 'gbk');
    const $ = cheerio.load(html);

    const rows = $('tr');
    console.log(`[DEBUG] Found ${rows.length} <tr> elements on page ${page}`);

    if (rows.length < 5 && page === 1) {
      console.log(`[DEBUG] HTML Preview (first 500 chars):\n${html.substring(0, 500)}`);
      if (html.includes('安全拦截') || html.includes('验证码') || html.includes('防火墙')) {
        console.log('[WARN] 可能被目标网站的防火墙或验证码拦截了！');
      } else if (html.includes('您无权访问') || html.includes('超出我们允许的范围')) {
        console.log('[WARN] 目标网站提示：您的访问已经超出允许的范围（IP 访问频率过高或需要登录）。');
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

export async function scrapeAndSave(keyword: string, maxPages: number = 100) {
  if (scrapeState.isScraping) return;
  
  scrapeState.isScraping = true;
  scrapeState.currentKeyword = keyword;
  scrapeState.page = 1;
  scrapeState.totalPages = 1;
  scrapeState.totalSaved = 0;

  console.log(`Starting background scrape for "${keyword}"...`);

  try {
    do {
      console.log(`Scraping page ${scrapeState.page} for "${keyword}"...`);
      const gbkBuffer = iconv.encode(keyword, 'gbk');
      let gbkEncodedKeyword = '';
      for (let i = 0; i < gbkBuffer.length; i++) {
        gbkEncodedKeyword += '%' + gbkBuffer[i].toString(16).toUpperCase();
      }

      const searchUrl = `${BASE_URL}/s.jsp?keyword=${gbkEncodedKeyword}&pageNum=${scrapeState.page}`;
      
      const response = await axios.get(searchUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': BASE_URL
        },
        timeout: 15000
      });

      console.log(`[DEBUG] HTTP Status: ${response.status}`);

      const html = iconv.decode(Buffer.from(response.data), 'gbk');
      const $ = cheerio.load(html);

      const rows = $('tr');
      console.log(`[DEBUG] Found ${rows.length} <tr> elements on page ${scrapeState.page}`);

      if (rows.length < 5 && scrapeState.page === 1) {
        console.log(`[DEBUG] HTML Preview (first 500 chars):\n${html.substring(0, 500)}`);
        if (html.includes('安全拦截') || html.includes('验证码') || html.includes('防火墙')) {
          console.log('[WARN] 可能被目标网站的防火墙或验证码拦截了！');
        } else if (html.includes('您无权访问') || html.includes('超出我们允许的范围')) {
          console.log('[WARN] 目标网站提示：您的访问已经超出允许的范围（IP 访问频率过高或需要登录）。');
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

      if (scrapeState.page === 1) {
        const match = html.match(/共找到(\d+)条/);
        if (match) {
          const totalRecords = parseInt(match[1], 10);
          scrapeState.totalPages = Math.ceil(totalRecords / 20);
        }
      }

      scrapeState.page++;
      
      // Delay to prevent IP ban
      if (scrapeState.page <= scrapeState.totalPages && scrapeState.page <= maxPages) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } while (scrapeState.page <= scrapeState.totalPages && scrapeState.page <= maxPages);
    
    console.log(`Finished scraping for "${keyword}". Saved ${scrapeState.totalSaved} records.`);
  } catch (error) {
    console.error(`Error scraping "${keyword}":`, error);
  } finally {
    scrapeState.isScraping = false;
  }
}
