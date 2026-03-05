import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { insertOrUpdateStandard } from './db.ts';

export async function scrapeCsresDetails(url: string): Promise<any> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Referer': 'http://www.csres.com/',
      },
      timeout: 10000
    });

    const html = iconv.decode(Buffer.from(response.data), 'gbk');
    const $ = cheerio.load(html);
    const text = $("body").text();

    const extract = (label: string) => {
      const regex = new RegExp(`${label}：\\s*([^\\n]+)`);
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    return {
      publish_date: extract("发布日期"),
      implement_date: extract("实施日期"),
      replace_standard: extract("替代情况"),
      ccs_code: extract("中标分类"),
      ics_code: extract("ICS分类"),
      competent_department: extract("归口单位"),
      execution_unit: extract("提出单位"),
      standard_category: extract("标准类别")
    };
  } catch (error) {
    console.error(`Error scraping csres details from ${url}:`, error);
    return null;
  }
}

export async function scrapeSamrDetails(url: string): Promise<any> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    $("style, script").remove();
    
    const details: any = {};
    $("dl dt").each((i, el) => {
      const key = $(el).text().trim();
      const value = $(el).next("dd").text().trim().replace(/\s+/g, " ");
      details[key] = value;
    });

    return {
      publish_date: details['发布日期'] || null,
      implement_date: details['实施日期'] || null,
      replace_standard: details['全部代替标准'] || null,
      ccs_code: details['中国标准分类号'] || null,
      ics_code: details['国际标准分类号'] ? details['国际标准分类号'].split(' ')[0] : null,
      competent_department: details['归口单位'] || null,
      execution_unit: details['执行单位'] || null,
      standard_category: details['标准类别'] || null
    };
  } catch (error) {
    console.error(`Error scraping samr details from ${url}:`, error);
    return null;
  }
}
