import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import cron from 'node-cron';
import { getStandards, getStandardCount, getAllPrefixes, updatePrefixScrapedAt, getStandardsWithoutDetails, updateStandardDetails } from './src/db.ts';
import { scrapeAndSave, scrapeState, scrapeSpecificPage } from './src/scraper.ts';
import { scrapeAndSaveSamr, scrapeStateSamr, scrapeSpecificPageSamr, rescrapeState, startRescrapeMissing, findSamrUrl } from './src/scraper_samr.ts';
import { scrapeCsresDetails, scrapeSamrDetails } from './src/scraper_details.ts';
import adminRouter, { authenticateToken, requireAdmin, authenticateApiToken } from './src/admin.ts';
import Database from 'better-sqlite3';
import * as xlsx from 'xlsx';
import { getBackups, createBackup, deleteBackup, restoreBackup, getBackupSchedule, setBackupSchedule } from './src/backup.ts';

const db = new Database('standards.db');

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

  // Background job to fetch details for standards
  const fetchDetailsJob = async () => {
    try {
      if (!scrapeState.isScraping && !scrapeStateSamr.isScraping) {
        const standards = getStandardsWithoutDetails(5);
        for (const std of standards) {
          let details = null;
          if (std.url_csres) {
            details = await scrapeCsresDetails(std.url_csres);
          } else if (std.url_samr) {
            details = await scrapeSamrDetails(std.url_samr);
          }

          if (details) {
            updateStandardDetails(std.std_num, details);
            console.log(`Updated details for ${std.std_num}`);
          } else {
            // If details couldn't be fetched, update the updated_at so we don't get stuck on it
            updateStandardDetails(std.std_num, { publish_date: '' }); // use empty string to mark as processed
          }
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
        }
      }
    } catch (error) {
      console.error('Error in fetch details job:', error);
    } finally {
      setTimeout(fetchDetailsJob, 10000); // run every 10 seconds
    }
  };

  // Start the details fetching job
  setTimeout(fetchDetailsJob, 5000);

  // API Routes
  app.use('/api/admin', adminRouter);

  // Backup API Routes
  app.get('/api/admin/backups', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { getBackups, getBackupSchedule } = await import('./src/backup.ts');
      res.json({
        backups: getBackups(),
        schedule: getBackupSchedule()
      });
    } catch (error) {
      console.error('Error fetching backups:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/backups', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { createBackup } = await import('./src/backup.ts');
      const backup = createBackup();
      res.json({ success: true, backup });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/backups/schedule', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { schedule } = req.body;
      const { setBackupSchedule } = await import('./src/backup.ts');
      setBackupSchedule(schedule);
      res.json({ success: true, schedule });
    } catch (error) {
      console.error('Error setting backup schedule:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/admin/backups/:filename', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      const { deleteBackup } = await import('./src/backup.ts');
      const success = deleteBackup(filename);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Backup not found' });
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/backups/:filename/restore', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { filename } = req.params;
      const { restoreBackup } = await import('./src/backup.ts');
      const success = restoreBackup(filename);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Backup not found' });
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Protected API for downloading data
  app.get('/api/export', authenticateApiToken, (req, res) => {
    const query = req.query.q as string || '';
    const sortBy = req.query.sortBy as string || 'updated_at';
    const sortOrder = req.query.sortOrder as string || 'desc';
    let filters = {};
    try {
      if (req.query.filters) {
        filters = JSON.parse(req.query.filters as string);
      }
    } catch (e) {
      console.error('Failed to parse filters for export', e);
    }
    const items = getStandards(query, 10000, 0, sortBy, sortOrder, filters); // Limit to 10k for export

    const ws = xlsx.utils.json_to_sheet(items);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Standards");
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="standards.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });

  // Admin standard management
  app.delete('/api/admin/standards/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM standards WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.put('/api/admin/standards/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const details = req.body;

    const setClauses = [];
    const params: any = { id };

    for (const [key, value] of Object.entries(details)) {
      if (key !== 'id' && key !== 'updated_at') {
        setClauses.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      db.prepare(`UPDATE standards SET ${setClauses.join(', ')} WHERE id = @id`).run(params);
    }
    res.json({ success: true });
  });

  app.post('/api/admin/standards/batch-delete', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { ids, selectAllFiltered, query = '', filters = {} } = req.body;
      if (selectAllFiltered) {
        const { buildWhereClause } = await import('./src/db.ts');
        const { whereClause, params } = buildWhereClause(query, filters);
        db.prepare(`DELETE FROM standards ${whereClause}`).run(...params);
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM standards WHERE id IN (${placeholders})`).run(...ids);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Batch delete error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/standards/batch-refresh', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { ids, selectAllFiltered, query = '', filters = {} } = req.body;
      let standards: any[] = [];

      if (selectAllFiltered) {
        const { buildWhereClause } = await import('./src/db.ts');
        const { whereClause, params } = buildWhereClause(query, filters);
        standards = db.prepare(`SELECT * FROM standards ${whereClause}`).all(...params) as any[];
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        standards = db.prepare(`SELECT * FROM standards WHERE id IN (${placeholders})`).all(...ids) as any[];
      }

      if (standards.length > 0) {
        // Start background refresh
        (async () => {
          for (const std of standards) {
            let details = null;
            if (std.url_csres) {
              details = await scrapeCsresDetails(std.url_csres);
            } else if (std.url_samr) {
              details = await scrapeSamrDetails(std.url_samr);
            }
            if (details) {
              updateStandardDetails(std.std_num, details);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        })();
      }
      res.json({ success: true, message: 'Batch refresh started in background' });
    } catch (err) {
      console.error('Batch refresh error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/standards/batch-edit', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { field, value, ids, selectAllFiltered, query = '', filters = {} } = req.body;

      const allowedFields = ['department', 'status', 'standard_category'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: 'Invalid field for batch edit' });
      }

      const updateQuery = `UPDATE standards SET ${field} = ?, updated_at = CURRENT_TIMESTAMP`;

      if (selectAllFiltered) {
        const { buildWhereClause } = await import('./src/db.ts');
        const { whereClause, params } = buildWhereClause(query, filters);
        const setClause = whereClause ? `${whereClause}` : '';
        db.prepare(`${updateQuery} ${setClause}`).run(value, ...params);
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`${updateQuery} WHERE id IN (${placeholders})`).run(value, ...ids);
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Batch edit error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/admin/standards/:id/scrape-detail', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const std = db.prepare('SELECT * FROM standards WHERE id = ?').get(id) as any;

      if (!std) {
        return res.status(404).json({ error: 'Standard not found' });
      }

      let details: any = null;
      let targetUrl = std.url_samr || std.url_csres || null;

      // If we don't have a SAMR URL, try to dynamically search for one
      if (!std.url_samr) {
        const foundUrl = await findSamrUrl(std.std_num);
        if (foundUrl) {
          targetUrl = foundUrl;
          db.prepare('UPDATE standards SET url_samr = ? WHERE id = ?').run(targetUrl, id);
        }
      }

      if (targetUrl && targetUrl.includes('csres.com')) {
        details = await scrapeCsresDetails(targetUrl);
      } else if (targetUrl) {
        details = await scrapeSamrDetails(targetUrl);
        if (details) details.url_samr = targetUrl;
      }

      if (details) {
        updateStandardDetails(std.std_num, details);

        // If we successfully fetched from SAMR, ensure the main url pointer is updated and csres is erased
        if (targetUrl && !targetUrl.includes('csres.com')) {
          db.prepare('UPDATE standards SET url = ?, url_csres = NULL WHERE id = ?').run(targetUrl, id);
        }

        const updated = db.prepare('SELECT * FROM standards WHERE id = ?').get(id);
        res.json({ success: true, data: updated, message: 'Scrape completed' });
      } else {
        res.status(400).json({ success: false, error: 'Could not fetch details or no URL available' });
      }
    } catch (error) {
      console.error('Error in manual detail scrape:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/standards', async (req, res) => {
    try {
      const query = req.query.q as string || '';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const sortBy = req.query.sortBy as string || 'updated_at';
      const sortOrder = req.query.sortOrder as string || 'desc';

      let filters = {};
      try {
        if (req.query.filters) {
          filters = JSON.parse(req.query.filters as string);
        }
      } catch (e) {
        console.error('Failed to parse filters', e);
      }

      // 从本地数据库查询结果
      const items = getStandards(query, limit, offset, sortBy, sortOrder, filters);
      const dbTotal = getStandardCount(query, filters);

      const finalTotalPages = Math.ceil(dbTotal / limit);

      res.json({
        data: items,
        pagination: {
          total: dbTotal,
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

  app.get('/api/standards/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const { getStandardById } = await import('./src/db.ts');
      const standard = getStandardById(id);

      if (!standard) {
        return res.status(404).json({ error: 'Standard not found' });
      }

      res.json(standard);
    } catch (error) {
      console.error('Error fetching standard by ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/scrape', (req, res) => {
    const { keyword, source } = req.body;

    if (source === 'rescrape') {
      if (rescrapeState.isRunning) {
        return res.status(409).json({ error: 'A rescrape task is already running', state: rescrapeState });
      }
      startRescrapeMissing().catch(console.error);
      return res.json({ success: true, message: `Started rescraping missing standards` });
    }

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    if (source === 'samr') {
      if (scrapeStateSamr.isScraping) {
        return res.status(409).json({ error: 'A scrape task is already running', state: scrapeStateSamr });
      }
      scrapeAndSaveSamr(keyword, 5000).catch(console.error);
      res.json({ success: true, message: `Started scraping for ${keyword} on SAMR` });
    } else {
      if (scrapeState.isScraping) {
        return res.status(409).json({ error: 'A scrape task is already running', state: scrapeState });
      }
      scrapeAndSave(keyword, 5000).catch(console.error);
      res.json({ success: true, message: `Started scraping for ${keyword} on CSRES` });
    }
  });

  app.get('/api/scrape/status', (req, res) => {
    const source = req.query.source as string || 'samr';
    if (source === 'rescrape') {
      res.json(rescrapeState);
    } else if (source === 'samr') {
      res.json(scrapeStateSamr);
    } else {
      res.json(scrapeState);
    }
  });

  app.post('/api/scrape/cancel', (req, res) => {
    const source = req.body.source as string || 'samr';

    if (source === 'rescrape') {
      if (!rescrapeState.isRunning) {
        return res.status(400).json({ error: 'No rescrape task is currently running.' });
      }
      rescrapeState.isCancelled = true;
      res.json({ success: true, message: 'Cancellation signal sent.' });
    } else if (source === 'samr') {
      if (!scrapeStateSamr.isScraping) {
        return res.status(400).json({ error: 'No SAMR scrape task is currently running.' });
      }
      scrapeStateSamr.isCancelled = true;
      res.json({ success: true, message: 'Cancellation signal sent to SAMR scraper.' });
    } else {
      if (!scrapeState.isScraping) {
        return res.status(400).json({ error: 'No CSRES scrape task is currently running.' });
      }
      res.json({ success: true, message: 'Cancellation not fully implemented for CSRES.' });
    }
  });

  // --- Backup API Endpoints ---

  app.get('/api/admin/backups', authenticateApiToken, (req, res) => {
    try {
      const backups = getBackups();
      res.json({ success: true, data: backups });
    } catch (error) {
      console.error('Error fetching backups:', error);
      res.status(500).json({ error: 'Failed to fetch backups' });
    }
  });

  app.post('/api/admin/backups', authenticateApiToken, (req, res) => {
    try {
      const backup = createBackup();
      res.json({ success: true, data: backup, message: 'Backup created successfully' });
    } catch (error) {
      console.error('Error creating backup:', error);
      res.status(500).json({ error: 'Failed to create backup' });
    }
  });

  app.delete('/api/admin/backups/:filename', authenticateApiToken, (req, res) => {
    try {
      const { filename } = req.params;
      const success = deleteBackup(filename);
      if (success) {
        res.json({ success: true, message: 'Backup deleted' });
      } else {
        res.status(404).json({ error: 'Backup not found' });
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      res.status(500).json({ error: 'Failed to delete backup' });
    }
  });

  app.post('/api/admin/backups/restore', authenticateApiToken, (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename) return res.status(400).json({ error: 'Filename is required' });

      const success = restoreBackup(filename);
      if (success) {
        res.json({ success: true, message: 'Database restored successfully' });
      } else {
        res.status(404).json({ error: 'Backup not found' });
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      res.status(500).json({ error: 'Failed to restore backup' });
    }
  });

  app.get('/api/admin/backups/schedule', authenticateApiToken, (req, res) => {
    res.json({ success: true, schedule: getBackupSchedule() });
  });

  app.post('/api/admin/backups/schedule', authenticateApiToken, (req, res) => {
    try {
      const { schedule } = req.body;
      setBackupSchedule(schedule);
      res.json({ success: true, message: 'Backup schedule updated', schedule: getBackupSchedule() });
    } catch (error) {
      console.error('Error updating backup schedule:', error);
      res.status(500).json({ error: 'Failed to update backup schedule' });
    }
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
