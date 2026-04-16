# Section C - CMS Dialysis Mortality Dashboard

## Overview

This section contains a small full-stack application for analysing dialysis facility mortality data.

The project includes:

- a Flask backend API
- a lightweight frontend dashboard
- filtering, summary metrics, comparison views, and CSV export

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
```

## Features

### Summary Page
- Filter by state
- Filter by ZIP code
- Filter by facility name
- Total facilities
- Average mortality
- Minimum mortality
- Maximum mortality
- Top highest mortality facilities
- Top lowest mortality facilities
- Paginated full table

### Analysis Page
- State comparison
- ZIP code comparison
- Mortality distribution
- Facility ranking table
- CSV export

## How to Run

### 1. Start the backend

Open a terminal in the `backend` folder and run:

```bash
python app.py
```

If `python` does not work, try:

```bash
py app.py
```

The backend should run at:

```text
http://127.0.0.1:5000
```

### 2. Open the frontend

Open `frontend/index.html` in a browser.

You can then navigate to the analysis page from the summary page.

## Notes

The uploaded CMS facility file is a snapshot-style dataset rather than a true monthly time series for facility mortality.

Date-related fields were parsed and reviewed during data preparation, but they do not support a reliable month-level mortality trend analysis.

## Technical Notes

- Backend: Flask + pandas
- Frontend: HTML, CSS, JavaScript
- Charts: Chart.js

## Goal

The main goal of this section is to provide a simple and clear dashboard with correct filtering and aggregation logic.
