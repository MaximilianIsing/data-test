# Render One-Time Job Setup

This project is configured to run as a one-time job on Render to enrich college data using OpenAI's API.

## Setup Instructions

1. **Push to GitHub**
   - Commit all files and push to a GitHub repository

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create the service

3. **Set Environment Variable**
   - In the Render service settings, go to "Environment"
   - Add environment variable: `GPT_API_KEY`
   - Paste your OpenAI API key as the value

4. **Deploy**
   - Click "Manual Deploy" → "Deploy latest commit"
   - The job will start processing colleges

## Notes

- The job will process colleges from `data/us_universities.csv`
- Output will be saved to `data/us_universities_enriched.csv`
- Progress is saved incrementally - if the job stops, you can redeploy and it will resume from where it left off
- To download the output file, use Render's shell feature or modify the script to upload to cloud storage

## Monitoring

- Check logs in Render dashboard to monitor progress
- The script prints progress every 10 colleges
- Estimated time: ~207 minutes for 2071 colleges (at 6 seconds per college)

