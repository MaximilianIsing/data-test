"""
One-off initialization script to copy university_data.csv to scanned.csv
with the cleaned/refined column schema.

Run once before starting the scraper service:
  python init_scanned.py
"""

import csv
import os
import re
from typing import Optional

from scraper_service import (
    SCANNED_CSV,
    INPUT_CSV,
    DATA_DIR,
    compute_college_score,
    get_scanned_csv_fields,
    parse_int,
    parse_ratio,
)

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)


def parse_percent(val):
    """Parse percent value (0-1 float or percentage string)."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return float(val) if 0 <= val <= 1 else None
    text = str(val).strip()
    m = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if m:
        return float(m.group(1)) / 100
    try:
        fval = float(text)
        return fval if 0 <= fval <= 1 else None
    except ValueError:
        return None


def parse_college_type(raw_type: str):
    """Extract college_type, college_years, college_public_private from type field."""
    if not raw_type:
        return None, None, None
    
    raw_type = str(raw_type).strip()
    college_type = raw_type
    college_years = None
    college_public_private = None
    
    # Extract public/private
    if "private" in raw_type.lower():
        if "for-profit" in raw_type.lower():
            college_public_private = "Private For-Profit"
        else:
            college_public_private = "Private"
    elif "public" in raw_type.lower():
        college_public_private = "Public"
    
    # Extract years if present (e.g., "4-year", "2-year")
    years_match = re.search(r"(\d+)\s*[-]?\s*year", raw_type.lower())
    if years_match:
        college_years = int(years_match.group(1))
    
    return college_type, college_years, college_public_private


def init_scanned_csv():
    """Initialize scanned.csv from university_data.csv with cleaned schema."""
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found")
        return
    
    # Use the same column schema as scraper_service.py
    ordered_fields = get_scanned_csv_fields()
    
    rows = []
    
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for college in reader:
            name = college.get("name", "").strip()
            if not name:
                continue
            
            # Map fields from university_data.csv to cleaned schema
            row = {col: "" for col in ordered_fields}
            row["name"] = name
            
            # College type parsing
            raw_type = college.get("type", "")
            college_type, college_years, _ = parse_college_type(raw_type)
            row["college_type"] = college_type or ""
            row["college_years"] = college_years if college_years is not None else ""
            
            # Direct mappings (already in correct format or need minor parsing)
            row["acceptance_rate_pct"] = parse_percent(college.get("acceptance_rate"))
            # SAT/ACT ranges - source data only has 50th percentile, so ranges will be empty
            # These will be populated by the scraper when it runs
            row["sat_25th_percentile"] = ""
            row["sat_75th_percentile"] = ""
            row["sat_50th_percentile"] = parse_int(str(college.get("sat_50th_percentile", "")))
            row["act_25th_percentile"] = ""
            row["act_75th_percentile"] = ""
            row["act_50th_percentile"] = parse_int(str(college.get("act_50th_percentile", "")))
            row["graduation_rate_pct"] = parse_percent(college.get("graduation_rate"))
            row["retention_rate_pct"] = parse_percent(college.get("retention_rate"))
            row["pct_receiving_aid_pct"] = parse_percent(college.get("percent_receiving_aid"))
            
            # Money fields
            row["avg_after_aid_val"] = parse_int(str(college.get("average_financial_aid", "")))
            # Use out-of-state tuition as avg_after_aid_costs (or in-state if out not available)
            tuition_out = parse_int(str(college.get("tuition_out_state", "")))
            tuition_in = parse_int(str(college.get("tuition_in_state", "")))
            row["avg_after_aid_costs_val"] = tuition_out if tuition_out else tuition_in
            row["avg_aid_package_val"] = parse_int(str(college.get("average_financial_aid", "")))
            row["avg_housing_cost_val"] = parse_int(str(college.get("room_board", "")))
            
            # Numeric fields
            row["undergrad_students_num"] = parse_int(str(college.get("enrollment", "")))
            row["student_faculty_ratio_num"] = parse_ratio(str(college.get("student_faculty_ratio", "")))
            row["num_majors_num"] = ""  # Not in source data
            row["college_board_code_num"] = ""  # Not in source data
            
            # Text fields
            row["setting"] = college.get("campus_setting", "").strip()
            row["rd_due_date"] = college.get("application_deadline_fall", "").strip()
            
            # Boolean fields (convert to string)
            test_opt = college.get("test_optional", "").strip()
            if test_opt in ("True", "true", "1", "Yes", "yes"):
                row["test_optional"] = "Yes"
            elif test_opt in ("False", "false", "0", "No", "no"):
                row["test_optional"] = "No"
            else:
                row["test_optional"] = test_opt
            
            row["gpa_optional"] = ""  # Not in source data
            
            # Compute college_score from available data
            score_input = {
                "acceptance_rate_pct": row["acceptance_rate_pct"] if row["acceptance_rate_pct"] else None,
                "sat_50th_percentile": row["sat_50th_percentile"] if row["sat_50th_percentile"] else None,
                "act_50th_percentile": row["act_50th_percentile"] if row["act_50th_percentile"] else None,
                "graduation_rate": row["graduation_rate_pct"] if row["graduation_rate_pct"] else None,
                "retention_rate": row["retention_rate_pct"] if row["retention_rate_pct"] else None,
                "undergrad_students_num": row["undergrad_students_num"] if row["undergrad_students_num"] else None,
                "student_faculty_ratio_num": row["student_faculty_ratio_num"] if row["student_faculty_ratio_num"] else None,
            }
            row["college_score"] = compute_college_score(score_input)
            
            # Convert None to empty string for CSV
            for k, v in row.items():
                if v is None:
                    row[k] = ""
            
            rows.append(row)
    
    # Write to scanned.csv
    tmp_path = SCANNED_CSV + ".tmp"
    with open(tmp_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ordered_fields)
        writer.writeheader()
        writer.writerows(rows)
    
    os.replace(tmp_path, SCANNED_CSV)
    print(f"Initialized {SCANNED_CSV} with {len(rows)} colleges from {INPUT_CSV}")


if __name__ == "__main__":
    init_scanned_csv()

