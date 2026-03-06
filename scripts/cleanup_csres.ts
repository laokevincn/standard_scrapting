import Database from 'better-sqlite3';
import { updateStandardDetails } from '../src/db.ts';

const db = new Database('standards.db');

async function main() {
    console.log("Identifying records sourced from CSRES...");

    // Find records that have url_csres but no url_samr, or originally sourced from CSRES
    const standardsToClean = db.prepare(`
        SELECT id, std_num, title, url_csres 
        FROM standards 
        WHERE url_csres IS NOT NULL AND (url_samr IS NULL OR url_samr = '')
    `).all() as any[];

    console.log(`Found ${standardsToClean.length} records to clean and rescrape.`);

    if (standardsToClean.length === 0) {
        console.log("No records to clean.");
        return;
    }

    let successCount = 0;

    for (let i = 0; i < standardsToClean.length; i++) {
        const std = standardsToClean[i];
        console.log(`[${i + 1}/${standardsToClean.length}] Cleaning ${std.std_num}...`);

        try {
            // Nullify details, keeping std_num and title. Also clearing url_csres to avoid matching again.
            // updateStandardDetails only updates the fields provided.
            updateStandardDetails(std.std_num, {
                department: null,
                implement_date: null,
                status: 'Missing/Needs Scrape',
                publish_date: null,
                standard_category: null,
                ccs_code: null,
                ics_code: null,
                replace_standard: null,
                execution_unit: null,
                competent_department: null,
                url_csres: null, // Clear the CSRES url
                url: null // Clear original standard base url just in case
            });
            successCount++;
        } catch (error: any) {
            console.error(`  -> Error cleaning ${std.std_num}: ${error.message}`);
        }
    }

    console.log(`\nCleanup finished!`);
    console.log(`Successfully cleaned: ${successCount}`);
    console.log(`\nYou can now run 'npx tsx rescrape_samr.ts' to pull the fresh data from SAMR.`);
}

main().catch(console.error);
