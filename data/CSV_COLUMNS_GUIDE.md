# CSV Columns Guide for US Colleges Database

## Essential Columns (Minimum Required)

These are the **must-have** columns for Path Pal to function properly:

### 1. Basic Identification
- **`id`** - Unique identifier (integer or string)
- **`name`** - Full college name (e.g., "Stanford University")
- **`city`** - City name
- **`state`** - State abbreviation (2-letter code, e.g., "CA", "NY")
- **`zip_code`** - ZIP code (optional but useful)

### 2. Admissions Data (Critical for Odds Calculator)
- **`acceptance_rate`** - Overall acceptance rate (decimal 0.0-1.0, e.g., 0.17 = 17%)
- **`sat_25th_percentile`** - SAT score 25th percentile (optional)
- **`sat_50th_percentile`** - SAT score median/average (optional)
- **`sat_75th_percentile`** - SAT score 75th percentile (optional)
- **`act_25th_percentile`** - ACT score 25th percentile (optional)
- **`act_50th_percentile`** - ACT score median (optional)
- **`act_75th_percentile`** - ACT score 75th percentile (optional)

### 3. Institution Type & Size
- **`type`** - Institution type (e.g., "Public", "Private", "Private For-Profit")
- **`size_category`** - Size category (e.g., "Small", "Medium", "Large")
- **`enrollment`** - Total enrollment (integer, optional - can calculate size_category from this)

### 4. Location Details (For Filtering)
- **`region`** - Region name (e.g., "West Coast", "Northeast", "South", "Midwest")
- **`latitude`** - Latitude coordinate (optional, for distance calculations)
- **`longitude`** - Longitude coordinate (optional, for distance calculations)

## Recommended Columns (Highly Useful)

These columns will enhance the app's functionality significantly:

### 5. Financial Information
- **`tuition_in_state`** - In-state tuition (integer, dollars per year)
- **`tuition_out_state`** - Out-of-state tuition (integer, dollars per year)
- **`room_board`** - Room and board costs (optional)
- **`total_cost_in_state`** - Total cost in-state (optional)
- **`total_cost_out_state`** - Total cost out-of-state (optional)
- **`average_financial_aid`** - Average financial aid awarded (optional)
- **`percent_receiving_aid`** - Percent receiving financial aid (optional)

### 6. Academic Data
- **`graduation_rate`** - 4-year graduation rate (decimal 0.0-1.0)
- **`retention_rate`** - Freshman retention rate (optional)
- **`student_faculty_ratio`** - Student to faculty ratio (optional)
- **`average_gpa`** - Average admitted student GPA (optional)

### 7. Post-Graduation Outcomes (For Career Paths)
- **`median_earnings_10_years`** - Median earnings 10 years after graduation (optional)
- **`median_earnings_6_years`** - Median earnings 6 years after graduation (optional)
- **`employment_rate`** - Employment rate (optional)

### 8. Programs & Majors
- **`popular_majors`** - JSON string or comma-separated list of popular majors (optional)
- **`offers_online`** - Boolean if online programs available (optional)
- **`degree_levels`** - Available degree levels (e.g., "Bachelor's, Master's, PhD")

## Advanced/Additional Columns (Nice to Have)

### 9. Campus Life
- **`campus_setting`** - Setting type (e.g., "Urban", "Suburban", "Rural")
- **`campus_size_acres`** - Campus size in acres (optional)
- **`athletics_division`** - NCAA division (e.g., "Division I", "Division II", "NAIA")
- **`housing_available`** - Boolean if on-campus housing available

### 10. Demographics
- **`percent_white`** - Percent white students (optional)
- **`percent_minority`** - Percent minority students (optional)
- **`percent_international`** - Percent international students (optional)
- **`gender_distribution`** - Gender distribution (optional)

### 11. Rankings & Recognition
- **`us_news_rank`** - US News ranking (optional)
- **`forbes_rank`** - Forbes ranking (optional)
- **`niche_grade`** - Niche overall grade (optional)

### 12. Application Information
- **`application_deadline_fall`** - Fall application deadline (optional)
- **`application_deadline_spring`** - Spring application deadline (optional)
- **`requires_sat`** - Boolean if SAT required (optional)
- **`requires_act`** - Boolean if ACT required (optional)
- **`test_optional`** - Boolean if test optional (optional)
- **`application_fee`** - Application fee in dollars (optional)

### 13. Additional Identifiers
- **`ipeds_id`** - IPEDS identifier (useful for data linking)
- **`ope_id`** - OPE ID (Office of Postsecondary Education)
- **`website`** - College website URL
- **`logo_url`** - Logo image URL (optional)

## Complete Minimal CSV Example

Here's what your CSV header might look like for the **minimum viable** dataset:

```csv
id,name,city,state,type,size_category,acceptance_rate,sat_50th_percentile,act_50th_percentile,tuition_in_state,tuition_out_state,graduation_rate
100654,Stanford University,Stanford,CA,Private,Medium,0.042,1505,34,56169,56169,0.948
166027,MIT,Cambridge,MA,Private,Medium,0.066,1535,35,53790,53790,0.953
110635,University of California Berkeley,Berkeley,CA,Public,Large,0.172,1415,31,14253,44207,0.912
```

## Complete Recommended CSV Example

Here's the **recommended** comprehensive CSV header:

```csv
id,name,city,state,zip_code,type,size_category,enrollment,acceptance_rate,sat_25th_percentile,sat_50th_percentile,sat_75th_percentile,act_25th_percentile,act_50th_percentile,act_75th_percentile,tuition_in_state,tuition_out_state,room_board,total_cost_in_state,total_cost_out_state,graduation_rate,retention_rate,student_faculty_ratio,average_gpa,median_earnings_10_years,employment_rate,region,campus_setting,popular_majors,website,ipeds_id
```

## Data Sources That Provide These Columns

1. **College Scorecard** (collegescorecard.ed.gov) - Has most of these fields
2. **IPEDS** (nces.ed.gov/ipeds) - Comprehensive but requires processing
3. **Common Data Set** - Standardized format, per-school basis
4. **US News** - Rankings and some additional data
5. **Peterson's** - Comprehensive database (may require license)

## My Recommendation Priority

1. **Start with Essentials** - Get the 13 essential columns first
2. **Add Financial Data** - Critical for college planning decisions
3. **Add Academic Outcomes** - Important for career paths feature
4. **Add Programs/Majors** - Essential for major matching
5. **Add Advanced Data** - Enhance over time as needed

## Notes

- **Acceptance rates** should be stored as decimals (0.17 not 17)
- **SAT/ACT scores** should be total scores, not section scores
- **Tuition** should be annual, not per credit or semester
- **IDs** should be unique and stable (prefer official IDs like IPEDS ID)
- Handle missing data gracefully - use NULL/empty strings
- Consider data freshness - when was it last updated?

