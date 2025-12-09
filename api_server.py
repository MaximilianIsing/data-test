"""
API server for accessing scanned.csv data.
Runs alongside the scraper service.
"""

import os
import csv
import io
from flask import Flask, jsonify, request, abort
from scraper_service import SCANNED_CSV, DATA_DIR, log

app = Flask(__name__)
ENDPOINT_KEY_FILE = os.path.join(DATA_DIR, "endpointkey.txt")


def get_endpoint_key():
    """Read the endpoint key from file."""
    if not os.path.exists(ENDPOINT_KEY_FILE):
        log(f"Warning: {ENDPOINT_KEY_FILE} not found")
        return None
    
    try:
        with open(ENDPOINT_KEY_FILE, "r", encoding="utf-8") as f:
            key = f.read().strip()
            return key if key else None
    except Exception as e:
        log(f"Error reading {ENDPOINT_KEY_FILE}: {e}")
        return None


@app.route("/getdata", methods=["GET"])
def get_data():
    """Get scanned.csv data. Requires ?key= parameter matching endpointkey.txt"""
    # Validate key
    provided_key = request.args.get("key")
    expected_key = get_endpoint_key()
    
    if not expected_key:
        abort(500, description="Server configuration error: endpoint key not found")
    
    if not provided_key or provided_key != expected_key:
        abort(401, description="Unauthorized: invalid key")
    
    # Read and return CSV data
    if not os.path.exists(SCANNED_CSV):
        abort(404, description="Data file not found")
    
    try:
        data = []
        with open(SCANNED_CSV, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(row)
        
        return jsonify({
            "success": True,
            "count": len(data),
            "data": data
        })
    except Exception as e:
        log(f"Error reading {SCANNED_CSV}: {e}")
        abort(500, description=f"Error reading data: {str(e)}")


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    # For local testing
    app.run(host="0.0.0.0", port=5000)

