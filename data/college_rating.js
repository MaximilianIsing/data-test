const fs = require('fs');
const path = require('path');
const { rateCollege } = require('../rate-system');

// Paths
const ENRICHED_CSV = path.join(__dirname, 'us_universities_enriched.csv');
const OUTPUT_CSV = path.join(__dirname, 'university_data.csv');

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Last value
    
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        let value = values[index] || '';
        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        row[header] = value;
      });
      results.push(row);
    }
  }
  
  return { headers, rows: results };
}

// Write CSV
function writeCSV(headers, rows, filePath) {
  const lines = [];
  
  // Write header
  lines.push(headers.map(h => `"${h}"`).join(','));
  
  // Write rows
  for (const row of rows) {
    const values = headers.map(header => {
      const value = String(row[header] || '');
      // Escape quotes and wrap in quotes if contains comma or quote
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(','));
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function main() {
  console.log('Loading colleges from enriched CSV...');
  
  const csvText = fs.readFileSync(ENRICHED_CSV, 'utf8');
  const { headers, rows } = parseCSV(csvText);
  
  console.log(`Found ${rows.length} colleges`);
  console.log('Calculating ratings...');
  
  // Calculate rating for each college
  for (let i = 0; i < rows.length; i++) {
    const college = rows[i];
    const rating = rateCollege(college);
    college.rating = rating;
    
    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${rows.length} colleges...`);
    }
  }
  
  console.log(`Calculated ratings for all ${rows.length} colleges`);
  
  // Add rating to headers if not already there
  if (!headers.includes('rating')) {
    headers.push('rating');
  }
  
  // Write to new CSV
  console.log(`Writing to ${OUTPUT_CSV}...`);
  writeCSV(headers, rows, OUTPUT_CSV);
  
  console.log(`Successfully wrote ${rows.length} colleges to ${OUTPUT_CSV}`);
  
  // Print statistics
  const ratings = rows.map(r => parseInt(r.rating)).filter(r => !isNaN(r));
  if (ratings.length > 0) {
    ratings.sort((a, b) => a - b);
    console.log('\nRating Statistics:');
    console.log(`  Min: ${Math.min(...ratings)}`);
    console.log(`  Max: ${Math.max(...ratings)}`);
    console.log(`  Average: ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}`);
    console.log(`  Median: ${ratings[Math.floor(ratings.length / 2)]}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

