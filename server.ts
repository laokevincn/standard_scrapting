import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import cron from 'node-cron';
import { getStandards, getStandardCount, getAllPrefixes, updatePrefixScrapedAt } from './src/db.ts';
import { scrapeAndSave, scrapeState, scrapeSpecificPage } from './src/scraper.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Schedule daily background scrape at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Starting daily background scrape for standard prefixes...');
    try {
      const prefixes = getAllPrefixes();
      for (const { prefix } of prefixes) {
        // Wait until any current scrape finishes
        while (scrapeState.isScraping) {
          await new Promise(resolve => setTimeout(resolve, 60000)); // wait 1 minute
        }
        console.log(`Daily scrape: starting prefix ${prefix}`);
        await scrapeAndSave(prefix, 5000);
        updatePrefixScrapedAt(prefix);
        // Wait a bit between prefixes
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      console.log('Daily background scrape completed.');
    } catch (error) {
      console.error('Error in daily background scrape:', error);
    }
  });

  // API Routes
  app.get('/api/standards', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      let scrapedTotalPages = 0;
      let scrapedTotalRecords = 0;
      if (query) {
        // 实时抓取该页数据并合并到本地数据库
        const scrapeResult = await scrapeSpecificPage(query, page);
        scrapedTotalPages = scrapeResult.totalPages;
        scrapedTotalRecords = scrapeResult.totalRecords;
      }

      // 从本地数据库查询合并后的结果
      const items = getStandards(query, limit, offset);
      const dbTotal = getStandardCount(query);

      const finalTotal = Math.max(dbTotal, scrapedTotalRecords);
      const finalTotalPages = Math.ceil(finalTotal / limit);

      res.json({
        data: items,
        pagination: {
          total: finalTotal,
          page,
          limit,
          totalPages: finalTotalPages
        }
      });
    } catch (error) {
      console.error('Error fetching standards:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/scrape', (req, res) => {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }
    
    if (scrapeState.isScraping) {
      return res.status(409).json({ error: 'A scrape task is already running', state: scrapeState });
    }

    // Start async, allow up to 5000 pages
    scrapeAndSave(keyword, 5000).catch(console.error);
    res.json({ success: true, message: `Started scraping for ${keyword}` });
  });

  app.get('/api/scrape/status', (req, res) => {
    res.json(scrapeState);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
