# Section C - CMS Dialysis Mortality Dashboard

## Overview
This section contains a small full-stack application for analysing dialysis facility mortality data.

The project includes:
- a Flask backend API
- a simple frontend with two pages
- filtering, summary statistics, analysis views, pagination, and CSV export

## Project Structure

```text
section_c/
├── backend/
│   ├── app.py
│   ├── clean_facility_mortality.csv
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── analysis.html
│   ├── style.css
│   ├── index.js
│   └── analysis.js
└── README.md
Features
Summary Page
filter by State
filter by ZIP Code
filter by Facility Name
total facilities
average mortality
minimum mortality
maximum mortality
top highest mortality facilities
top lowest mortality facilities
paginated full table
Analysis Page
state comparison
ZIP code comparison
mortality distribution
facility ranking table
CSV export
How to Run
1. Start the backend

Open a terminal in the backend folder and run:

python app.py

If python does not work, try:

py app.py

The backend should run at:

http://127.0.0.1:5000
2. Open the frontend

Open frontend/index.html in a browser.

You can then navigate to the analysis page from the summary page.

Notes

The uploaded CMS facility file is a snapshot-style dataset rather than a true monthly time series for facility mortality. Therefore, the dashboard focuses on valid cross-sectional comparisons by state, ZIP code, distribution, and facility ranking.

Date-related fields were parsed and reviewed during data preparation, but they do not support a reliable month-level mortality trend for this specific file. To avoid presenting a misleading chart, the dashboard does not include a monthly mortality trend analysis.

Technical Notes
Backend: Flask + pandas
Frontend: HTML, CSS, JavaScript
Charts: Chart.js
Goal

The main goal of this section is to provide a simple and clear dashboard with correct filtering and aggregation logic.
