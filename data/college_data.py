import csv
import json
import time
import os
from openai import OpenAI
from typing import Dict, List, Optional

# Configuration
CSV_INPUT = 'us_universities.csv'
CSV_OUTPUT = 'us_universities_enriched.csv'
GPT_KEY_FILE = '../gpt-key.txt'  # One level up from data folder
BATCH_SIZE = 10  # Number of requests per minute (adjust based on rate limits)
DELAY_BETWEEN_REQUESTS = 6  # seconds between requests (60/10 = 6 for 10/min)

# Read API key
def get_api_key() -> str:
    """Read API key from file or environment variable"""
    if os.path.exists(GPT_KEY_FILE):
        with open(GPT_KEY_FILE, 'r') as f:
            return f.read().strip()
    return os.getenv('GPT_API_KEY', '')

# Initialize OpenAI client
api_key = get_api_key()
if not api_key:
    raise ValueError("API key not found. Please set GPT_API_KEY environment variable or ensure gpt-key.txt exists.")

client = OpenAI(api_key=api_key)

def get_college_data(college_name: str, url: str) -> Dict:
    """
    Use GPT API to get comprehensive data for a college.
    Returns a dictionary with college information.
    """
    prompt = f"""For the college "{college_name}" (website: {url}), provide the following information as JSON.

CRITICAL: When exact data is not available, provide reasonable approximations based on:
- Similar colleges of the same type, size, and selectivity tier
- Public data sources and typical ranges for that category
- General knowledge about US colleges

PREFER APPROXIMATIONS OVER NULL VALUES. Use null ONLY when absolutely no reasonable estimate can be made.

Return this JSON structure:
{{
    "name": "{college_name}",
    "city": "city name (required - infer if needed)",
    "state": "state abbreviation, 2 letters (required - infer from name/location)",
    "type": "Public, Private, or Private For-Profit (required - infer from name if needed)",
    "size_category": "Small (<5000), Medium (5000-15000), or Large (>15000) - estimate based on college type",
    "acceptance_rate": decimal 0.0-1.0 (approximate from selectivity: highly selective 0.1-0.2, selective 0.3-0.6, less selective 0.6-0.9),
    "sat_50th_percentile": integer (approximate median SAT - use ranges: elite 1450+, selective 1300-1450, moderate 1100-1300, less selective <1100),
    "act_50th_percentile": integer (approximate median ACT - convert from SAT if needed: SAT 1400≈ACT 32, SAT 1300≈ACT 28, SAT 1200≈ACT 25),
    "tuition_in_state": integer dollars per year (approximate typical ranges: Public $5k-15k, Private $20k-60k, Elite private $50k+),
    "tuition_out_state": integer dollars per year (Public: typically 2-3x in-state, Private: usually same as in-state),
    "room_board": integer dollars per year (approximate typical: $10k-15k on-campus, estimate based on region and type),
    "graduation_rate": decimal 0.0-1.0 (approximate: Public 0.5-0.7, Private 0.6-0.9, Elite 0.85+),
    "retention_rate": decimal 0.0-1.0 (freshman retention - approximate: typical 0.7-0.9, elite 0.95+),
    "enrollment": integer (approximate student body size - small: 500-3000, medium: 3000-15000, large: 15000+),
    "student_faculty_ratio": integer (approximate typical: small private 10:1-15:1, large public 15:1-25:1),
    "region": "Northeast, Southeast, Midwest, Southwest, or West (required - infer from state)",
    "popular_majors": ["major1", "major2", "major3"] (common majors for college type or typical liberal arts/business/STEM if unknown),
    "median_earnings_10_years": integer dollars (approximate: $30k-50k typical, $50k-80k selective, $80k+ elite),
    "campus_setting": "Urban, Suburban, or Rural (approximate from city size if unknown)",
    "test_optional": boolean (true if SAT/ACT not required - many schools are now test optional, estimate from selectivity tier),
    "application_deadline_fall": "YYYY-MM-DD or 'Rolling' or 'Varies'" (typical: Jan 1 for regular, Nov 1-15 for early action/decision),
    "application_fee": integer dollars (approximate typical: $50-75, some waived, estimate $50 if unknown),
    "average_financial_aid": integer dollars per year (approximate: Private often $15k-30k, Public $5k-10k, estimate based on type),
    "percent_receiving_aid": decimal 0.0-1.0 (approximate typical: Private 0.7-0.9, Public 0.5-0.7),
    "transfer_acceptance_rate": decimal 0.0-1.0 (approximate: often similar to freshman rate, estimate from main acceptance rate),
    "latitude": float (approximate latitude for city/state - use major city in state if unknown),
    "longitude": float (approximate longitude for city/state - use major city in state if unknown),
    "housing_available": boolean (true if on-campus housing - most 4-year colleges have housing, estimate true),
    "ipeds_id": "IPEDS ID if known" or null
}}

Approximation guidelines:
- Public universities: lower tuition ($5k-15k in-state), larger size, moderate-high acceptance rates
- Private universities: higher tuition ($20k-60k), varied size, more selective generally
- Liberal arts colleges: small-medium size, private, higher graduation rates, liberal arts majors
- Research universities: large, higher graduation rates, STEM/business majors
- State flagship: large public, moderate-high selectivity, good outcomes

Return ONLY valid JSON, no additional text or explanation."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that provides accurate college information in JSON format. When exact data is unavailable, provide reasonable approximations based on similar colleges, typical ranges for the institution type, and general knowledge. Prefer approximations over null values. Always return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.4,  # Slightly higher for creative approximations when needed
            max_tokens=1200
        )
        
        content = response.choices[0].message.content.strip()
        
        # Try to extract JSON from response (in case GPT adds explanation)
        if content.startswith('```json'):
            content = content[7:]
        if content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        # Parse JSON
        data = json.loads(content)
        
        # Add original URL
        data['url'] = url
        
        return data
        
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON decode error for {college_name}: {e}")
        print(f"  Response was: {content[:200]}")
        return None
    except Exception as e:
        print(f"  ❌ Error fetching data for {college_name}: {e}")
        return None

def read_existing_progress() -> set:
    """Read already processed colleges from output file"""
    processed = set()
    if os.path.exists(CSV_OUTPUT):
        try:
            with open(CSV_OUTPUT, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    processed.add(row['name'].lower().strip())
        except Exception as e:
            print(f"Warning: Could not read existing progress: {e}")
    return processed

def main():
    """Main function to process all colleges"""
    print("🚀 Starting college data enrichment...")
    print(f"📁 Reading from: {CSV_INPUT}")
    print(f"💾 Writing to: {CSV_OUTPUT}")
    print()
    
    # Read existing progress
    processed = read_existing_progress()
    print(f"✅ Already processed: {len(processed)} colleges")
    print()
    
    # Read input CSV
    colleges = []
    with open(CSV_INPUT, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            colleges.append({
                'name': row['name'].strip(),
                'url': row['url'].strip()
            })
    
    print(f"📊 Total colleges to process: {len(colleges)}")
    print(f"🔄 Remaining: {len(colleges) - len(processed)}")
    print()
    
    # Determine output columns
    output_columns = [
        'name', 'url', 'city', 'state', 'type', 'size_category', 
        'acceptance_rate', 'sat_50th_percentile', 'act_50th_percentile',
        'tuition_in_state', 'tuition_out_state', 'room_board',
        'graduation_rate', 'retention_rate', 'enrollment', 'student_faculty_ratio',
        'region', 'popular_majors', 'median_earnings_10_years',
        'campus_setting', 'test_optional', 'application_deadline_fall',
        'application_fee', 'average_financial_aid', 'percent_receiving_aid',
        'transfer_acceptance_rate', 'latitude', 'longitude', 'housing_available', 'ipeds_id'
    ]
    
    # Open output file
    file_exists = os.path.exists(CSV_OUTPUT)
    mode = 'a' if file_exists else 'w'
    
    with open(CSV_OUTPUT, mode, newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=output_columns, extrasaction='ignore')
        
        # Write header if new file
        if not file_exists:
            writer.writeheader()
        
        # Process each college
        success_count = 0
        error_count = 0
        skipped_count = 0
        
        for i, college in enumerate(colleges, 1):
            college_name = college['name']
            college_key = college_name.lower().strip()
            
            # Skip if already processed
            if college_key in processed:
                skipped_count += 1
                continue
            
            print(f"[{i}/{len(colleges)}] Processing: {college_name}")
            
            # Get data from GPT
            data = get_college_data(college['name'], college['url'])
            
            if data:
                # Convert popular_majors list to string if needed
                if 'popular_majors' in data and isinstance(data['popular_majors'], list):
                    data['popular_majors'] = ', '.join(data['popular_majors']) if data['popular_majors'] else ''
                
                # Write to CSV
                writer.writerow(data)
                f.flush()  # Ensure data is written immediately
                success_count += 1
                print(f"  ✅ Success")
            else:
                error_count += 1
                print(f"  ❌ Failed")
            
            # Rate limiting
            if i < len(colleges):
                time.sleep(DELAY_BETWEEN_REQUESTS)
            
            # Progress update every 10 colleges
            if i % 10 == 0:
                print()
                print(f"📊 Progress: {i}/{len(colleges)}")
                print(f"   ✅ Success: {success_count}")
                print(f"   ❌ Errors: {error_count}")
                print(f"   ⏭️  Skipped: {skipped_count}")
                print()
    
    print()
    print("=" * 50)
    print("✨ Processing Complete!")
    print(f"   ✅ Success: {success_count}")
    print(f"   ❌ Errors: {error_count}")
    print(f"   ⏭️  Skipped: {skipped_count}")
    print(f"   📁 Output saved to: {CSV_OUTPUT}")
    print("=" * 50)

if __name__ == '__main__':
    main()

