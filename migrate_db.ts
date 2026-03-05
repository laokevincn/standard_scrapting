import Database from 'better-sqlite3';

const db = new Database('standards.db');

const columnsToAdd = [
  'url_csres TEXT',
  'url_samr TEXT',
  'publish_date TEXT',
  'replace_standard TEXT',
  'standard_category TEXT',
  'ccs_code TEXT',
  'ics_code TEXT',
  'execution_unit TEXT',
  'competent_department TEXT'
];

for (const col of columnsToAdd) {
  try {
    db.exec(`ALTER TABLE standards ADD COLUMN ${col}`);
    console.log(`Added column: ${col}`);
  } catch (err: any) {
    if (err.message.includes('duplicate column name')) {
      console.log(`Column already exists: ${col}`);
    } else {
      console.error(`Error adding column ${col}:`, err.message);
    }
  }
}

// Migrate existing url to url_csres or url_samr based on content
db.exec(`
  UPDATE standards 
  SET url_csres = url 
  WHERE url LIKE '%csres.com%' AND url_csres IS NULL
`);

db.exec(`
  UPDATE standards 
  SET url_samr = url 
  WHERE url LIKE '%samr.gov.cn%' AND url_samr IS NULL
`);

console.log('Database migration completed.');
db.close();
