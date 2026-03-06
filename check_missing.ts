import Database from 'better-sqlite3';
const db = new Database('standards.db');

const missingCount = db.prepare('SELECT COUNT(*) as count FROM standards WHERE status = ?').get('Missing/Needs Scrape') as any;
console.log('Count of "Missing/Needs Scrape":', missingCount.count);

const nullDateCount = db.prepare('SELECT COUNT(*) as count FROM standards WHERE publish_date IS NULL').get() as any;
console.log('Count of NULL publish_date:', nullDateCount.count);

const sampleNull = db.prepare('SELECT id, std_num, status FROM standards WHERE publish_date IS NULL LIMIT 5').all();
console.log('Sample NULL records:', sampleNull);
