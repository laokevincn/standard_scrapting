import Database from 'better-sqlite3';

const mainDb = new Database('standards.db');
const bakDb = new Database('standards_bak.db');

console.log('Starting database merge...');

// Get all records from bakDb
const bakRecords = bakDb.prepare('SELECT * FROM standards').all() as any[];
console.log(`Found ${bakRecords.length} records in standards_bak.db`);

let inserted = 0;
let updated = 0;

const insertOrUpdateStmt = mainDb.prepare(`
  INSERT INTO standards (std_num, title, department, implement_date, status, url, updated_at)
  VALUES (@std_num, @title, @department, @implement_date, @status, @url, @updated_at)
  ON CONFLICT(std_num) DO UPDATE SET
    title = @title,
    department = @department,
    implement_date = @implement_date,
    status = @status,
    url = @url,
    updated_at = @updated_at
`);

mainDb.transaction(() => {
  for (const record of bakRecords) {
    const existing = mainDb.prepare('SELECT id FROM standards WHERE std_num = ?').get(record.std_num);
    
    insertOrUpdateStmt.run({
      std_num: record.std_num,
      title: record.title,
      department: record.department,
      implement_date: record.implement_date,
      status: record.status,
      url: record.url,
      updated_at: record.updated_at
    });

    if (existing) {
      updated++;
    } else {
      inserted++;
    }
  }
})();

console.log(`Merge completed. Inserted: ${inserted}, Updated: ${updated}`);

// Close databases
mainDb.close();
bakDb.close();
