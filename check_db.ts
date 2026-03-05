import Database from 'better-sqlite3';

try {
  const db = new Database('standards.db');
  console.log('Running PRAGMA integrity_check...');
  const result = db.pragma('integrity_check');
  console.log('Result:', result);

  console.log('Querying standards...');
  const standards = db.prepare('SELECT COUNT(*) as count FROM standards').get() as {count: number};
  console.log('Total standards:', standards.count);
  
  // try scanning all rows to see if reading them crashes
  console.log('Fetching all standards...');
  const allStds = db.prepare('SELECT * FROM standards').all();
  console.log('Fetched rows:', allStds.length);
  
} catch (error) {
  console.error('Database Error:', error);
}
