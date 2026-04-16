from pathlib import Path
import pandas as pd


# =========================
# Locate source file
# =========================
BASE_DIR = Path(__file__).resolve().parent

POSSIBLE_INPUT_PATHS = [
    BASE_DIR / "DFC_FACILITY.csv",
    BASE_DIR / "data" / "DFC_FACILITY.csv",
    BASE_DIR.parent / "data" / "DFC_FACILITY.csv",
]

INPUT_PATH = None
for path in POSSIBLE_INPUT_PATHS:
    if path.exists():
        INPUT_PATH = path
        break

if INPUT_PATH is None:
    raise FileNotFoundError(
        "DFC_FACILITY.csv not found. "
        "Please place it in the same folder as data_prep.py, "
        "or in ./data/, or in ../data/."
    )


# Output file will be saved beside app.py by default
OUTPUT_PATH = BASE_DIR / "clean_facility_mortality.csv"


# =========================
# Read raw CSV
# =========================
df = pd.read_csv(INPUT_PATH, dtype={"ZIP Code": str})


# =========================
# Keep only required columns
# =========================
required_columns = [
    "Facility Name",
    "State",
    "ZIP Code",
    "SMR Date",
    "Mortality Rate (Facility)"
]

missing_columns = [col for col in required_columns if col not in df.columns]
if missing_columns:
    raise ValueError(f"Missing required columns in source CSV: {missing_columns}")

df = df[required_columns].copy()


# =========================
# Rename columns
# =========================
df.columns = [
    "facility_name",
    "state",
    "zip_code",
    "smr_date",
    "mortality_rate"
]


# =========================
# Clean text fields
# =========================
text_columns = ["facility_name", "state", "zip_code", "smr_date"]

for col in text_columns:
    df[col] = (
        df[col]
        .astype(str)
        .str.strip()
        .replace({"nan": "", "None": ""})
    )


# =========================
# Convert mortality to numeric
# =========================
df["mortality_rate"] = pd.to_numeric(df["mortality_rate"], errors="coerce")


# =========================
# Drop invalid rows
# =========================
# Remove missing mortality values
df = df.dropna(subset=["mortality_rate"]).copy()

# Remove negative mortality values if they exist
df = df[df["mortality_rate"] >= 0].copy()

# Remove rows missing key identity fields
df = df[
    (df["facility_name"] != "") &
    (df["state"] != "") &
    (df["zip_code"] != "")
].copy()


# =========================
# Add helper search column
# =========================
df["facility_name_lower"] = df["facility_name"].str.lower()


# =========================
# Sort for stable output
# =========================
df = df.sort_values(
    by=["state", "facility_name", "zip_code", "smr_date"],
    ascending=[True, True, True, True]
).reset_index(drop=True)


# =========================
# Save cleaned file
# =========================
df.to_csv(OUTPUT_PATH, index=False)


# =========================
# Console checks
# =========================
print("Source file:", INPUT_PATH)
print("Output file:", OUTPUT_PATH)
print("Cleaned data shape:", df.shape)
print()

print("Preview:")
print(df.head())
print()

print("Number of states:", df["state"].nunique())
print("Number of ZIP codes:", df["zip_code"].nunique())
print("Min mortality rate:", df["mortality_rate"].min())
print("Max mortality rate:", df["mortality_rate"].max())
print("Rows with non-empty SMR date:", (df["smr_date"] != "").sum())