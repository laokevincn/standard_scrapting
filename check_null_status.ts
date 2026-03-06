import Database from 'better-sqlite3';
const db = new Database('standards.db');

const nullStatusCount = db.prepare('SELECT COUNT(*) as count FROM standards WHERE status IS NULL').get() as any;
console.log('Count of NULL status:', nullStatusCount.count);

const sample = db.prepare('SELECT id, std_num, title, status FROM standards WHERE status IS NULL LIMIT 5').all();
console.log('Sample:', sample);
