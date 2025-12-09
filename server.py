"""
Render server entry point for the college scraper.
Starts both the scraper service and API server on startup.
"""

import csv
import os
import threading
from flask import Flask
from scraper_service import (
    SCANNED_CSV,
    INPUT_CSV,
    DATA_DIR,
    main as scraper_main,
    log,
)

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Import init function
from init_scanned import init_scanned_csv
from api_server import app as api_app, get_endpoint_key


def check_and_init():
    """Check if scanned.csv exists and has data, initialize if needed."""
    # Copy university_data.csv to data directory if it doesn't exist there
    # Try multiple possible locations in repo
    possible_repo_csvs = ["university_data.csv", "data/university_data.csv"]
    repo_csv = None
    for path in possible_repo_csvs:
        if os.path.exists(path):
            repo_csv = path
            break
    
    if repo_csv and not os.path.exists(INPUT_CSV):
        log(f"Copying {repo_csv} to {INPUT_CSV}...")
        import shutil
        shutil.copy2(repo_csv, INPUT_CSV)
        log(f"Copied {repo_csv} to {INPUT_CSV}")
    
    if not os.path.exists(SCANNED_CSV):
        log(f"{SCANNED_CSV} not found, initializing...")
        init_scanned_csv()
        log("Initialization complete")
        return
    
    # Check if file is empty or only has header
    try:
        with open(SCANNED_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            row_count = sum(1 for _ in reader)
            # If file has no data rows (only header), initialize
            if row_count == 0:
                log(f"{SCANNED_CSV} is empty (no data rows), initializing...")
                init_scanned_csv()
                log("Initialization complete")
    except Exception as e:
        log(f"Error checking {SCANNED_CSV}: {e}, initializing...")
        init_scanned_csv()
        log("Initialization complete")


def run_scraper():
    """Run the scraper in a separate thread."""
    log("Starting scraper main loop...")
    try:
        scraper_main()
    except Exception as e:
        log(f"Fatal error in scraper: {e}")
        raise


def start_server():
    """Start both the scraper service and API server."""
    log("Starting college scraper server...")
    
    # Check and initialize if needed
    check_and_init()
    
    # Check endpoint key
    key = get_endpoint_key()
    if key:
        log(f"API endpoint key loaded (length: {len(key)})")
    else:
        log("Warning: API endpoint key not found - /getdata endpoint will be disabled")
    
    # Start scraper in background thread
    scraper_thread = threading.Thread(target=run_scraper, daemon=True)
    scraper_thread.start()
    log("Scraper thread started")
    
    # Start API server in main thread
    log("Starting API server on port 5000...")
    try:
        api_app.run(host="0.0.0.0", port=5000)
    except Exception as e:
        log(f"Fatal error in API server: {e}")
        raise


if __name__ == "__main__":
    start_server()

