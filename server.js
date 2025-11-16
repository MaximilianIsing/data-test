const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { rateStudent, getAdmissionOdds } = require('./rate-system');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Read GPT key from environment variable (for Render) or file (for local dev)
let GPT_API_KEY = process.env.GPT_API_KEY || '';
if (!GPT_API_KEY) {
  try {
    GPT_API_KEY = fs.readFileSync(path.join(__dirname, 'gpt-key.txt'), 'utf8').trim();
  } catch (error) {
    console.error('Warning: GPT API key not found in environment or file');
  }
}

// API endpoint for GPT requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!GPT_API_KEY) {
      return res.status(500).json({ error: 'GPT API key not configured' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GPT_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful college admissions counselor and academic advisor. Provide personalized, actionable advice for students planning their college path.'
          },
          ...(context || []),
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    res.json({ 
      message: data.choices[0].message.content,
      usage: data.usage
    });
  } catch (error) {
    console.error('GPT API error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Serve all HTML pages
const htmlPages = [
  'index.html', 'profile.html', 'odds.html', 'simulator.html', 
  'explorer.html', 'career.html', 'activities.html', 'planner.html', 
  'messages.html', 'saved.html'
];

htmlPages.forEach(page => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', page));
  });
  
  // Also handle without .html extension
  const route = page.replace('.html', '');
  if (route !== 'index') {
    app.get(`/${route}`, (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'pages', page));
    });
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages', 'index.html'));
});

// CSV file path
const CSV_PATH = path.join(__dirname, 'data', 'university_data.csv');

// Cache for CSV data
let collegeDataCache = null;
let collegeDataCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Simple CSV parser
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '"') {
      // Handle escaped quotes ("")
      if (j + 1 < line.length && line[j + 1] === '"' && inQuotes) {
        current += '"';
        j++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Remove surrounding quotes from value
      let value = current.trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"');
      }
      values.push(value);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Last value
  let value = current.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1).replace(/""/g, '"');
  }
  values.push(value);
  
  return values;
}

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  // Parse header line
  const headers = parseCSVLine(lines[0]);
  const results = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      results.push(row);
    }
  }
  
  return results;
}

// Load college data from CSV
function loadCollegeData() {
  try {
    const csvText = fs.readFileSync(CSV_PATH, 'utf8');
    return parseCSV(csvText);
  } catch (error) {
    console.error('Error loading CSV file:', error);
    return [];
  }
}

// Get college data (with caching)
function getCollegeData() {
  const now = Date.now();
  
  if (!collegeDataCache || !collegeDataCacheTime || (now - collegeDataCacheTime) > CACHE_DURATION) {
    collegeDataCache = loadCollegeData();
    collegeDataCacheTime = now;
    console.log(`Loaded ${collegeDataCache.length} colleges from CSV`);
  }
  
  return collegeDataCache;
}

// Transform CSV row to API format
function transformCollege(row, index) {
  // Use ipeds_id as id if available, otherwise generate one
  const id = row.ipeds_id || `csv-${index}`;
  
  // Combine city and state for location
  const location = row.city && row.state 
    ? `${row.city}, ${row.state}` 
    : (row.city || row.state || 'Unknown');
  
  // Parse acceptance rate (should be decimal)
  let acceptanceRate = null;
  if (row.acceptance_rate) {
    const parsed = parseFloat(row.acceptance_rate);
    if (!isNaN(parsed)) acceptanceRate = parsed;
  }
  
  // Parse numeric values
  const parseNum = (val) => {
    if (!val || val === '') return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  };
  
  return {
    id: id,
    name: row.name || 'Unknown',
    location: location,
    city: row.city || '',
    state: row.state || '',
    size: row.size_category || 'Unknown',
    type: row.type || 'Unknown',
    acceptanceRate: acceptanceRate,
    satAverage: parseNum(row.sat_50th_percentile),
    actMidpoint: parseNum(row.act_50th_percentile),
    tuitionInState: parseNum(row.tuition_in_state),
    tuitionOutState: parseNum(row.tuition_out_state),
    roomBoard: parseNum(row.room_board),
    graduationRate: parseNum(row.graduation_rate),
    retentionRate: parseNum(row.retention_rate),
    enrollment: parseNum(row.enrollment),
    studentFacultyRatio: parseNum(row.student_faculty_ratio),
    region: row.region || '',
    popularMajors: row.popular_majors || '',
    medianEarnings: parseNum(row.median_earnings_10_years),
    campusSetting: row.campus_setting || '',
    testOptional: row.test_optional === 'True' || row.test_optional === 'true',
    applicationDeadline: row.application_deadline_fall || '',
    applicationFee: parseNum(row.application_fee),
    averageFinancialAid: parseNum(row.average_financial_aid),
    percentReceivingAid: parseNum(row.percent_receiving_aid),
    transferAcceptanceRate: parseNum(row.transfer_acceptance_rate),
    latitude: parseNum(row.latitude),
    longitude: parseNum(row.longitude),
    housingAvailable: row.housing_available === 'True' || row.housing_available === 'true',
    url: row.url || '',
    rating: parseNum(row.rating) || null
  };
}

// Colleges API endpoint
app.get('/api/colleges', async (req, res) => {
  try {
    const { search, page = 1, per_page = 20 } = req.query;
    
    // Get all college data
    let colleges = getCollegeData();
    
    // Filter by search term if provided (on raw CSV data)
    if (search) {
      const searchLower = search.toLowerCase();
      colleges = colleges.filter(row => {
        const name = (row.name || '').toLowerCase();
        const city = (row.city || '').toLowerCase();
        const state = (row.state || '').toLowerCase();
        return name.includes(searchLower) || city.includes(searchLower) || state.includes(searchLower);
      });
    }
    
    // Transform to API format
    const transformed = colleges.map((row, index) => transformCollege(row, index));
    
    // Pagination
    const pageNum = parseInt(page) || 1;
    const perPage = parseInt(per_page) || 20;
    const start = (pageNum - 1) * perPage;
    const end = start + perPage;
    const paginated = transformed.slice(start, end);
    
    res.json({
      results: paginated,
      page: pageNum,
      per_page: perPage,
      total: transformed.length
    });
  } catch (error) {
    console.error('Error fetching college data:', error);
    res.status(500).json({ error: 'Failed to fetch college data' });
  }
});

// Accounts CSV file path
const ACCOUNTS_CSV_PATH = path.join(__dirname, 'storage', 'accounts.csv');

// Ensure storage directory exists
const storageDir = path.join(__dirname, 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Initialize accounts CSV if it doesn't exist
if (!fs.existsSync(ACCOUNTS_CSV_PATH)) {
  const header = 'user_id,name,grade,gpa,weighted,sat,act,psat,majors,ap_courses,activities,interests,career_goals,rating,created_at,updated_at\n';
  fs.writeFileSync(ACCOUNTS_CSV_PATH, header, 'utf8');
}

// Helper function to escape CSV values
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Helper function to parse CSV value (handles quotes)
function parseCSVValue(value) {
  if (!value) return '';
  // Remove surrounding quotes if present
  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
    // Unescape double quotes
    value = value.replace(/""/g, '"');
  }
  return value;
}

// Read all accounts from CSV
function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_CSV_PATH)) {
      return [];
    }
    
    const csvText = fs.readFileSync(ACCOUNTS_CSV_PATH, 'utf8');
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) return []; // Only header or empty
    
    const headers = lines[0].split(',').map(h => h.trim());
    const accounts = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"') {
          if (inQuotes && lines[i][j + 1] === '"') {
            current += '"';
            j++; // Skip next quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(parseCSVValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(parseCSVValue(current.trim())); // Last value
      
      if (values.length >= headers.length) {
        const account = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          account[header] = value;
        });
        
        // Parse boolean and arrays
        if (account.weighted === 'true') account.weighted = true;
        else if (account.weighted === 'false') account.weighted = false;
        
        try {
          account.majors = account.majors ? JSON.parse(account.majors) : [];
        } catch (e) {
          account.majors = [];
        }
        
        try {
          account.ap_courses = account.ap_courses ? JSON.parse(account.ap_courses) : [];
        } catch (e) {
          account.ap_courses = [];
        }
        
        try {
          account.interests = account.interests ? JSON.parse(account.interests) : [];
        } catch (e) {
          account.interests = [];
        }
        
        try {
          // Skip invalid "[object Object]" strings
          if (account.activities && account.activities.trim() === '[object Object]') {
            account.activities = [];
          }
          // Try to parse as JSON array first
          else if (account.activities && account.activities.trim().startsWith('[')) {
            account.activities = JSON.parse(account.activities);
          } else if (account.activities && account.activities.trim()) {
            // Legacy string format - convert to array format for consistency
            // Parse "X hrs — description" format
            const lines = account.activities.split('\n').map(l => l.trim()).filter(Boolean);
            account.activities = lines.map(line => {
              const match = line.match(/^(\d+)\s*(hrs?|hours?|h)?\s*[-–:]\s*(.+)$/i);
              if (match) {
                return { hours: match[1], description: match[3] };
              }
              return { hours: '', description: line };
            });
          } else {
            account.activities = [];
          }
        } catch (e) {
          // If parsing fails completely, default to empty array
          account.activities = [];
        }
        
        // Parse rating as number if it exists
        if (account.rating && account.rating !== '') {
          const ratingNum = parseFloat(account.rating);
          account.rating = !isNaN(ratingNum) ? ratingNum : null;
        } else {
          account.rating = null;
        }
        
        accounts.push(account);
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('Error reading accounts CSV:', error);
    return [];
  }
}

// Write accounts to CSV
function writeAccounts(accounts) {
  try {
    const headers = ['user_id', 'name', 'grade', 'gpa', 'weighted', 'sat', 'act', 'psat', 'majors', 'ap_courses', 'activities', 'interests', 'career_goals', 'rating', 'created_at', 'updated_at'];
    
    let csv = headers.join(',') + '\n';
    
    accounts.forEach(account => {
      const row = headers.map(header => {
        let value = account[header];
        
        // Handle arrays and objects
        if (header === 'majors' || header === 'interests' || header === 'ap_courses' || header === 'activities') {
          if (Array.isArray(value)) {
            value = JSON.stringify(value);
          } else if (value && typeof value === 'object') {
            // If it's an object but not an array, try to stringify it
            value = JSON.stringify(value);
          } else if (typeof value === 'string' && value.trim()) {
            // If it's already a string (from CSV), use it as-is (should be valid JSON)
            value = value;
          } else {
            // Default to empty array
            value = '[]';
          }
        } else {
          // For non-array fields, use empty string if undefined/null
          // Exception: rating should be empty string if null/undefined (not 'null')
          if (header === 'rating') {
            value = (value !== null && value !== undefined && value !== '') ? String(value) : '';
          } else {
            value = value || '';
          }
        }
        
        // Handle boolean
        if (header === 'weighted') {
          value = value === true ? 'true' : 'false';
        }
        
        return escapeCSV(value);
      });
      
      csv += row.join(',') + '\n';
    });
    
    fs.writeFileSync(ACCOUNTS_CSV_PATH, csv, 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing accounts CSV:', error);
    return false;
  }
}

// Get account by user ID
function getAccount(userId) {
  const accounts = readAccounts();
  return accounts.find(acc => acc.user_id === userId) || null;
}

// Save or update account
function saveAccount(accountData) {
  const accounts = readAccounts();
  const existingIndex = accounts.findIndex(acc => acc.user_id === accountData.user_id);
  
  const now = new Date().toISOString();
  
  if (existingIndex >= 0) {
    // Update existing account
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      ...accountData,
      updated_at: now
    };
  } else {
    // Create new account
    accounts.push({
      user_id: accountData.user_id,
      name: accountData.name || '',
      grade: accountData.grade || '',
      gpa: accountData.gpa || '',
      weighted: accountData.weighted !== undefined ? accountData.weighted : true,
      sat: accountData.sat || '',
      act: accountData.act || '',
      psat: accountData.psat || '',
      majors: accountData.majors || [],
      ap_courses: accountData.ap_courses || [],
      activities: Array.isArray(accountData.activities) ? accountData.activities : [],
      interests: accountData.interests || [],
      career_goals: accountData.career_goals || accountData.careerGoals || '',
      rating: accountData.rating || null,
      created_at: now,
      updated_at: now
    });
  }
  
  return writeAccounts(accounts);
}

// Generate unique user ID
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Profile API endpoint - GET
app.get('/api/profile', async (req, res) => {
  try {
    const userId = req.query.user_id;
    
    if (!userId) {
      return res.status(400).json({ error: 'user_id parameter required' });
    }
    
    const account = getAccount(userId);
    
    if (!account) {
      // Return default profile if not found
      return res.json({
        user_id: userId,
        name: '',
        grade: '',
        gpa: '',
        weighted: true,
        sat: '',
        act: '',
        psat: '',
        majors: [],
        apCourses: [],
        activities: '',
        interests: [],
        careerGoals: '',
        rating: null
      });
    }
    
    // Only return rating if it exists in the account (profile was saved and rated)
    // Don't calculate on-the-fly - rating should only exist after profile is saved
    // Parse rating as number (it comes from CSV as string)
    let studentRating = null;
    if (account.rating !== null && account.rating !== undefined && account.rating !== '') {
      const ratingNum = typeof account.rating === 'string' ? parseFloat(account.rating) : account.rating;
      studentRating = !isNaN(ratingNum) ? ratingNum : null;
    }
    
    // Transform to frontend format
    res.json({
      user_id: account.user_id,
      name: account.name || '',
      grade: account.grade || '',
      gpa: account.gpa || '',
      weighted: account.weighted !== undefined ? account.weighted : true,
      sat: account.sat || '',
      act: account.act || '',
      psat: account.psat || '',
      majors: account.majors || [],
      apCourses: account.ap_courses || [],
      activities: Array.isArray(account.activities) ? account.activities : [], // Return as array (legacy strings are converted to [] in readAccounts)
      interests: account.interests || [],
      careerGoals: account.career_goals || '',
      rating: studentRating
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Profile API endpoint - POST (create/update)
app.post('/api/profile', async (req, res) => {
  try {
    const profileData = req.body;
    
    if (!profileData.user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Compute a private rating for this student (not returned to client)
    let rating = null;
    try {
      const calculatedRating = await rateStudent({
        gpa: profileData.gpa,
        weighted: profileData.weighted,
        sat: profileData.sat,
        act: profileData.act,
        apCourses: profileData.apCourses || [],
        activities: profileData.activities || [] // Pass as array (rateStudent handles conversion)
      });
      // Only set rating if it's a valid number
      if (calculatedRating !== null && calculatedRating !== undefined && !isNaN(calculatedRating)) {
        rating = calculatedRating;
      }
    } catch (e) {
      console.error('Error rating student profile:', e);
      rating = null;
    }
    
    // Transform frontend format to backend format
    const accountData = {
      user_id: profileData.user_id,
      name: profileData.name || '',
      grade: profileData.grade || '',
      gpa: profileData.gpa || '',
      weighted: profileData.weighted !== undefined ? profileData.weighted : true,
      sat: profileData.sat || '',
      act: profileData.act || '',
      psat: profileData.psat || '',
      majors: profileData.majors || [],
      ap_courses: profileData.apCourses || [],
      activities: Array.isArray(profileData.activities) ? profileData.activities : [], // Store as array
      interests: profileData.interests || [],
      career_goals: profileData.careerGoals || profileData.career_goals || '',
      rating: rating
    };
    
    const success = saveAccount(accountData);
    
    if (success) {
      res.json({ success: true, message: 'Profile saved successfully' });
    } else {
      res.status(500).json({ error: 'Failed to save profile' });
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// Generate user ID endpoint
app.get('/api/user-id', (req, res) => {
  const userId = generateUserId();
  res.json({ user_id: userId });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Path Pal server running on port ${PORT}`);
  if (GPT_API_KEY) {
    console.log('✓ GPT API key configured');
  } else {
    console.warn('⚠ Warning: GPT API key not configured. AI features will not work.');
  }
  
  // Load college data on startup
  const collegeCount = getCollegeData().length;
  if (collegeCount > 0) {
    console.log(`✓ Loaded ${collegeCount} colleges from CSV`);
  } else {
    console.warn('⚠ Warning: No college data loaded from CSV. Check data/university_data.csv');
  }
  
  // Initialize accounts storage
  if (fs.existsSync(ACCOUNTS_CSV_PATH)) {
    const accounts = readAccounts();
    console.log(`✓ Accounts storage initialized with ${accounts.length} account(s)`);
  } else {
    console.log('✓ Accounts storage initialized (empty)');
  }
});

