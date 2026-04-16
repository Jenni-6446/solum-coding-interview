from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from pathlib import Path
import pandas as pd

app = Flask(__name__)
CORS(app)


# Load data
BASE_DIR = Path(__file__).resolve().parent

POSSIBLE_DATA_PATHS = [
    BASE_DIR / "clean_facility_mortality.csv",
    BASE_DIR / "data" / "clean_facility_mortality.csv",
    BASE_DIR.parent / "data" / "clean_facility_mortality.csv",
]

DATA_PATH = None
for path in POSSIBLE_DATA_PATHS:
    if path.exists():
        DATA_PATH = path
        break

if DATA_PATH is None:
    raise FileNotFoundError(
        "clean_facility_mortality.csv not found. "
        "Please place it in the same folder as app.py, "
        "or in ./data/, or in ../data/."
    )

df = pd.read_csv(DATA_PATH, dtype={"zip_code": str})

# Clean again defensively in case the CSV format changes slightly
df["facility_name"] = df["facility_name"].astype(str).str.strip()
df["state"] = df["state"].astype(str).str.strip()
df["zip_code"] = df["zip_code"].astype(str).str.strip()
df["smr_date"] = df["smr_date"].astype(str).str.strip()
df["mortality_rate"] = pd.to_numeric(df["mortality_rate"], errors="coerce")

# Drop rows with invalid mortality values
df = df.dropna(subset=["mortality_rate"]).copy()

# Lowercase helper column for searching
if "facility_name_lower" not in df.columns:
    df["facility_name_lower"] = df["facility_name"].str.lower()

# Optional cleanup for empty-looking strings
for col in ["facility_name", "state", "zip_code", "smr_date", "facility_name_lower"]:
    df[col] = df[col].replace({"nan": "", "None": ""})



# Helper functions

def apply_filters(dataframe: pd.DataFrame) -> pd.DataFrame:
    filtered = dataframe.copy()

    states = [s.strip() for s in request.args.getlist("state") if s.strip()]
    zip_code = request.args.get("zip", "").strip()
    facility = request.args.get("facility", "").strip()

    if states:
        filtered = filtered[filtered["state"].isin(states)]

    if zip_code:
        filtered = filtered[
            filtered["zip_code"].str.contains(zip_code, case=False, na=False)
        ]

    if facility:
        keyword = facility.lower()
        filtered = filtered[
            filtered["facility_name_lower"].str.contains(keyword, na=False)
        ]

    return filtered


def safe_float(value):
    if pd.isna(value):
        return None
    return round(float(value), 2)


def make_summary_response(filtered_df: pd.DataFrame):
    if filtered_df.empty:
        return {
            "total": 0,
            "avgMortality": None,
            "minMortality": None,
            "maxMortality": None,
            "top10Highest": [],
            "top10Lowest": [],
        }

    sort_cols = ["mortality_rate", "facility_name", "state", "zip_code"]

    top10_highest = (
        filtered_df.sort_values(
            by=sort_cols,
            ascending=[False, True, True, True]
        )
        .head(10)[["facility_name", "state", "zip_code", "mortality_rate"]]
        .to_dict(orient="records")
    )

    top10_lowest = (
        filtered_df.sort_values(
            by=sort_cols,
            ascending=[True, True, True, True]
        )
        .head(10)[["facility_name", "state", "zip_code", "mortality_rate"]]
        .to_dict(orient="records")
    )

    return {
        "total": int(len(filtered_df)),
        "avgMortality": safe_float(filtered_df["mortality_rate"].mean()),
        "minMortality": safe_float(filtered_df["mortality_rate"].min()),
        "maxMortality": safe_float(filtered_df["mortality_rate"].max()),
        "top10Highest": top10_highest,
        "top10Lowest": top10_lowest,
    }


def make_empty_analysis_response():
    return {
        "monthlyTrend": [],
        "byState": [],
        "byZip": [],
        "distribution": [],
        "facilityRanking": [],
    }



# Routes

@app.route("/")
def home():
    return jsonify({
        "message": "Section C backend is running",
        "rows": int(len(df)),
        "dataFile": str(DATA_PATH.name)
    })


@app.route("/api/states")
def states():
    state_list = (
        df["state"]
        .dropna()
        .loc[df["state"].str.len() > 0]
        .sort_values()
        .unique()
        .tolist()
    )
    return jsonify(state_list)


@app.route("/api/summary")
def summary():
    filtered_df = apply_filters(df)
    return jsonify(make_summary_response(filtered_df))


@app.route("/api/table")
def table():
    filtered_df = apply_filters(df)

    page = request.args.get("page", default=1, type=int)
    page_size = request.args.get("pageSize", default=10, type=int)

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 10

    # Prevent very large page sizes
    page_size = min(page_size, 100)

    filtered_df = filtered_df.sort_values(
        by=["facility_name", "state", "zip_code", "smr_date"],
        ascending=[True, True, True, True]
    )

    total = int(len(filtered_df))
    start = (page - 1) * page_size
    end = start + page_size

    page_data = filtered_df.iloc[start:end][
        ["facility_name", "state", "zip_code", "smr_date", "mortality_rate"]
    ].to_dict(orient="records")

    return jsonify({
        "data": page_data,
        "page": page,
        "pageSize": page_size,
        "total": total
    })


@app.route("/api/analysis")
def analysis():
    filtered_df = apply_filters(df)

    if filtered_df.empty:
        return jsonify(make_empty_analysis_response())

    # This dataset does not support a true month-level trend reliably
    monthly_trend = []

    by_state = (
        filtered_df.groupby("state", as_index=False)
        .agg(
            avgMortality=("mortality_rate", "mean"),
            facilityCount=("facility_name", "count")
        )
        .sort_values(
            by=["avgMortality", "facilityCount", "state"],
            ascending=[False, False, True]
        )
    )

    by_state["avgMortality"] = by_state["avgMortality"].round(2)

    by_zip = (
        filtered_df.groupby("zip_code", as_index=False)
        .agg(
            avgMortality=("mortality_rate", "mean"),
            facilityCount=("facility_name", "count")
        )
        .sort_values(
            by=["avgMortality", "facilityCount", "zip_code"],
            ascending=[False, False, True]
        )
        .head(12)
    )

    by_zip["avgMortality"] = by_zip["avgMortality"].round(2)

    # Distribution buckets
    bins = [0, 10, 20, 30, 40, 50, 100]
    labels = ["0-10", "10-20", "20-30", "30-40", "40-50", "50+"]

    temp = filtered_df.copy()
    temp["bucket"] = pd.cut(
        temp["mortality_rate"],
        bins=bins,
        labels=labels,
        right=False,
        include_lowest=True
    )

    distribution = (
        temp.groupby("bucket", observed=False)
        .size()
        .reindex(labels, fill_value=0)
        .reset_index(name="count")
    )

    distribution["bucket"] = distribution["bucket"].astype(str)

    facility_ranking = (
        filtered_df.sort_values(
            by=["mortality_rate", "facility_name", "state", "zip_code"],
            ascending=[False, True, True, True]
        )[["facility_name", "state", "zip_code", "mortality_rate"]]
        .head(50)
        .to_dict(orient="records")
    )

    return jsonify({
        "monthlyTrend": monthly_trend,
        "byState": by_state.to_dict(orient="records"),
        "byZip": by_zip.to_dict(orient="records"),
        "distribution": distribution.to_dict(orient="records"),
        "facilityRanking": facility_ranking
    })


@app.route("/api/export")
def export_csv():
    filtered_df = apply_filters(df)

    export_df = filtered_df[
        ["facility_name", "state", "zip_code", "smr_date", "mortality_rate"]
    ].copy()

    export_df = export_df.sort_values(
        by=["state", "facility_name", "zip_code", "smr_date"],
        ascending=[True, True, True, True]
    )

    csv_data = export_df.to_csv(index=False)

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=filtered_facility_mortality.csv"
        }
    )


if __name__ == "__main__":
    app.run(debug=True)