import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import https from 'https';
import { insertOrUpdateStandard } from './db.ts';

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
    const response = await axiosInstance.get(url);

    const $ = cheerio.load(response.data);
    $("style, script").remove();

    const fieldMapping = {
      '标准号': 'std_num',
      '中文标准名称': 'title',
      '标准状态': 'status',
      '发布日期': 'publish_date',
      '实施日期': 'implement_date',
      '代替标准': 'replace_standard',
      '全部代替标准': 'replace_standard',
      '中国标准分类号': 'ccs_code',
      '国际标准分类号': 'ics_code',
      '起草单位': 'execution_unit',
      '执行单位': 'execution_unit',
      '归口单位': 'competent_department',
      '主管部门': 'department',
    };

    const data: Record<string, string> = {};

    // First try the robust .basicInfo_item structure used in GB
    $('.basicInfo_item').each((_, item) => {
      const label = $(item).find('dt').text().trim().replace(/：$/, '');
      const value = $(item).find('dd').text().trim().replace(/\s+/g, " ");
      const mappedKey = fieldMapping[label as keyof typeof fieldMapping];
      if (mappedKey) {
        data[mappedKey] = value;
      }
    });

    // Fallback if basicInfo_item is empty (e.g. some DB or HB endpoints)
    if (Object.keys(data).length === 0) {
      $("dl dt").each((i, el) => {
        const label = $(el).text().trim().replace(/：$/, "");
        const value = $(el).next("dd").text().trim().replace(/\s+/g, " ");
        const mappedKey = fieldMapping[label as keyof typeof fieldMapping];
        if (mappedKey) {
          data[mappedKey] = value;
        }
      });
    }

    return {
      publish_date: data.publish_date || null,
      implement_date: data.implement_date || null,
      replace_standard: data.replace_standard || null,
      ccs_code: data.ccs_code || null,
      ics_code: data.ics_code ? data.ics_code.split(' ')[0] : null,
      competent_department: data.competent_department || null,
      execution_unit: data.execution_unit || null,
      standard_category: data.standard_category || null,
      status: data.status || null,
      department: data.department || null,
    };
  } catch (error) {
    if ((error as Error).message === 'IP_BLOCKED') {
      throw error;
    }
    console.error(`Error scraping samr details from ${url}:`, (error as Error).message);
    return null;
  }
}
