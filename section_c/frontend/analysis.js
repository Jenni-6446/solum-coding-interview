const API_BASE = "http://127.0.0.1:5000";
const FILTER_STORAGE_KEY = "dialysisDashboardFiltersV1";

let zipChartInstance = null;
let distributionChartInstance = null;

let appliedFilterState = createEmptyFilterState();

function createEmptyFilterState() {
    return {
        states: [],
        zip: "",
        facility: ""
    };
}

function normalizeFilterState(rawState = {}) {
    const states = Array.isArray(rawState.states) ? rawState.states : [];

    return {
        states: [...new Set(
            states
                .map((state) => String(state || "").trim())
                .filter(Boolean)
        )],
        zip: String(rawState.zip || "").trim(),
        facility: String(rawState.facility || "").trim()
    };
}

function hasActiveFilters(filterState) {
    return (
        filterState.states.length > 0 ||
        Boolean(filterState.zip) ||
        Boolean(filterState.facility)
    );
}

function buildQueryString(filterState) {
    const params = new URLSearchParams();

    filterState.states.forEach((state) => params.append("state", state));

    if (filterState.zip) {
        params.append("zip", filterState.zip);
    }

    if (filterState.facility) {
        params.append("facility", filterState.facility);
    }

    return params.toString();
}

function parseFilterStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    return normalizeFilterState({
        states: params.getAll("state"),
        zip: params.get("zip") || "",
        facility: params.get("facility") || ""
    });
}

function getStoredFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);

        if (!raw) {
            return createEmptyFilterState();
        }

        return normalizeFilterState(JSON.parse(raw));
    } catch (error) {
        console.warn("Failed to read stored filters:", error);
        return createEmptyFilterState();
    }
}

function getInitialFilterState() {
    const urlState = parseFilterStateFromUrl();

    if (hasActiveFilters(urlState)) {
        return urlState;
    }

    return getStoredFilterState();
}

function saveFilterState(filterState) {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filterState));
}

function syncAnalysisUrl(filterState) {
    const queryString = buildQueryString(filterState);
    const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
}

function updateSummaryLink(filterState) {
    const link = document.getElementById("summaryPageLink");

    if (!link) return;

    const queryString = buildQueryString(filterState);
    link.href = queryString ? `index.html?${queryString}` : "index.html";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatRate(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "-";
    }

    return Number(value).toFixed(1);
}

function formatInteger(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "-";
    }

    return Number(value).toLocaleString();
}

function getFilterParams(filterState = appliedFilterState) {
    const params = new URLSearchParams();

    filterState.states.forEach((state) => params.append("state", state));

    if (filterState.zip) {
        params.append("zip", filterState.zip);
    }

    if (filterState.facility) {
        params.append("facility", filterState.facility);
    }

    return params;
}

function renderActiveFilters(filterState) {
    const toolbar = document.getElementById("analysisFilterToolbar");
    const textEl = document.getElementById("activeFilterText");
    const chipsEl = document.getElementById("activeFilterChips");

    if (!toolbar || !textEl || !chipsEl) return;

    chipsEl.innerHTML = "";

    if (!hasActiveFilters(filterState)) {
        toolbar.classList.add("is-hidden");
        textEl.textContent = "";
        return;
    }

    toolbar.classList.remove("is-hidden");
    textEl.textContent = "Active filters";

    filterState.states.forEach((state) => {
        const chip = document.createElement("span");
        chip.className = "filter-chip";
        chip.textContent = state;
        chipsEl.appendChild(chip);
    });

    if (filterState.zip) {
        const chip = document.createElement("span");
        chip.className = "filter-chip";
        chip.textContent = `ZIP: ${filterState.zip}`;
        chipsEl.appendChild(chip);
    }

    if (filterState.facility) {
        const chip = document.createElement("span");
        chip.className = "filter-chip";
        chip.textContent = `Facility: ${filterState.facility}`;
        chipsEl.appendChild(chip);
    }
}

function setChartVisibility(canvasId, emptyId, hasData, message = "No data found for the current filters.") {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);

    if (!canvas || !empty) return;

    if (hasData) {
        canvas.style.display = "block";
        empty.style.display = "none";
    } else {
        canvas.style.display = "none";
        empty.textContent = message;
        empty.style.display = "flex";
    }
}

function destroyChart(instance) {
    if (instance) {
        instance.destroy();
    }
}

function getCommonChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        }
    };
}

function renderAnalysisSummary(summary) {
    document.getElementById("analysisTotalValue").textContent = formatInteger(summary.total);
    document.getElementById("analysisAvgValue").textContent = formatRate(summary.avgMortality);
    document.getElementById("analysisMinValue").textContent = formatRate(summary.minMortality);
    document.getElementById("analysisMaxValue").textContent = formatRate(summary.maxMortality);
}

function renderStateComparisonTable(rows) {
    const tbody = document.getElementById("stateComparisonBody");
    const subtitle = document.getElementById("stateTableSubtitle");

    if (!tbody || !subtitle) return;

    tbody.innerHTML = "";

    const displayRows = [...rows]
        .sort((a, b) => b.avgMortality - a.avgMortality)
        .slice(0, 8);

    if (displayRows.length === 0) {
        subtitle.textContent = "No state data found for the current filters.";
        tbody.innerHTML = `<tr><td colspan="3" class="empty-cell">No data found</td></tr>`;
        return;
    }

    subtitle.textContent = `Selected ${displayRows.length} state${displayRows.length > 1 ? "s" : ""} ranked by average facility mortality rate`;

    displayRows.forEach((row) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${escapeHtml(row.state)}</td>
            <td class="numeric">${formatRate(row.avgMortality)}</td>
            <td class="numeric">${formatInteger(row.facilityCount)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function renderZipChart(rows) {
    const subtitleEl = document.getElementById("zipChartSubtitle");
    const displayRows = [...rows]
        .sort((a, b) => b.avgMortality - a.avgMortality)
        .slice(0, 5);

    if (subtitleEl) {
        subtitleEl.textContent = `Top ${displayRows.length} ZIP code${displayRows.length > 1 ? "s" : ""} ranked by average mortality rate`;
    }

    if (displayRows.length === 0) {
        destroyChart(zipChartInstance);
        zipChartInstance = null;
        setChartVisibility("zipChart", "zipChartEmpty", false);
        return;
    }

    setChartVisibility("zipChart", "zipChartEmpty", true);

    const labels = displayRows.map((row) => row.zip_code);
    const values = displayRows.map((row) => row.avgMortality);
    const counts = displayRows.map((row) => row.facilityCount || 0);

    const canvas = document.getElementById("zipChart");
    const ctx = canvas.getContext("2d");

    destroyChart(zipChartInstance);

    zipChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: "rgba(96, 165, 250, 0.72)",
                borderColor: "rgba(59, 130, 246, 1)",
                borderWidth: 1,
                borderRadius: 10,
                barThickness: 16
            }]
        },
        options: {
            ...getCommonChartOptions(),
            indexAxis: "y",
            plugins: {
                ...getCommonChartOptions().plugins,
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const index = context.dataIndex;
                            return [
                                `Average mortality: ${Number(context.raw).toFixed(1)}`,
                                `Facilities in ZIP: ${counts[index]}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Average mortality rate"
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function normalizeDistributionRows(rows) {
    const merged = {
        "0-10": 0,
        "10-20": 0,
        "20-30": 0,
        "30-40": 0,
        "40+": 0
    };

    rows.forEach((row) => {
        const bucket = String(row.bucket || "").trim();
        const count = Number(row.count || 0);

        if (bucket === "0-10") merged["0-10"] += count;
        else if (bucket === "10-20") merged["10-20"] += count;
        else if (bucket === "20-30") merged["20-30"] += count;
        else if (bucket === "30-40") merged["30-40"] += count;
        else if (bucket === "40-50" || bucket === "50+") merged["40+"] += count;
    });

    return [
        { bucket: "0-10", count: merged["0-10"] },
        { bucket: "10-20", count: merged["10-20"] },
        { bucket: "20-30", count: merged["20-30"] },
        { bucket: "30-40", count: merged["30-40"] },
        { bucket: "40+", count: merged["40+"] }
    ];
}

function renderDistributionChart(rows) {
    const displayRows = normalizeDistributionRows([...rows]);

    const hasAnyData = displayRows.some((row) => Number(row.count) > 0);

    if (!hasAnyData) {
        destroyChart(distributionChartInstance);
        distributionChartInstance = null;
        setChartVisibility("distributionChart", "distributionChartEmpty", false);
        return;
    }

    setChartVisibility("distributionChart", "distributionChartEmpty", true);

    const labels = displayRows.map((row) => row.bucket);
    const values = displayRows.map((row) => row.count);

    const canvas = document.getElementById("distributionChart");
    const ctx = canvas.getContext("2d");

    destroyChart(distributionChartInstance);

    distributionChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: "rgba(147, 197, 253, 0.75)",
                borderColor: "rgba(59, 130, 246, 1)",
                borderWidth: 1,
                borderRadius: 10,
                maxBarThickness: 54
            }]
        },
        options: {
            ...getCommonChartOptions(),
            plugins: {
                ...getCommonChartOptions().plugins,
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Facility count: ${Number(context.raw).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: "Mortality range"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Facility count"
                    }
                }
            }
        }
    });
}

function renderRankingTable(rows) {
    const tbody = document.getElementById("rankingTableBody");
    const subtitle = document.getElementById("rankingSubtitle");

    if (!tbody || !subtitle) return;

    tbody.innerHTML = "";

    const displayRows = [...rows].slice(0, 10);

    if (displayRows.length === 0) {
        subtitle.textContent = "No facilities match the current filters.";
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No data found</td></tr>`;
        return;
    }

    subtitle.textContent = `Showing top ${displayRows.length} facilities ranked by mortality rate.`;

    displayRows.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="numeric">${index + 1}</td>
            <td class="facility-cell" title="${escapeHtml(row.facility_name)}">${escapeHtml(row.facility_name)}</td>
            <td>${escapeHtml(row.state)}</td>
            <td>${escapeHtml(row.zip_code)}</td>
            <td class="numeric">${formatRate(row.mortality_rate)}</td>
        `;

        tbody.appendChild(tr);
    });
}

async function loadAnalysis() {
    const params = getFilterParams(appliedFilterState);

    const [analysisResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/analysis?${params.toString()}`),
        fetch(`${API_BASE}/api/summary?${params.toString()}`)
    ]);

    if (!analysisResponse.ok || !summaryResponse.ok) {
        throw new Error("Failed to load analysis");
    }

    const analysisData = await analysisResponse.json();
    const summaryData = await summaryResponse.json();

    renderAnalysisSummary(summaryData);
    renderStateComparisonTable(analysisData.byState || []);
    renderZipChart(analysisData.byZip || []);
    renderDistributionChart(analysisData.distribution || []);
    renderRankingTable(analysisData.facilityRanking || []);
}

function exportFilteredData() {
    const params = getFilterParams(appliedFilterState);
    const exportUrl = `${API_BASE}/api/export?${params.toString()}`;
    window.open(exportUrl, "_blank");
}

document.getElementById("exportBtn").addEventListener("click", () => {
    exportFilteredData();
});

window.addEventListener("DOMContentLoaded", async () => {
    try {
        appliedFilterState = getInitialFilterState();
        saveFilterState(appliedFilterState);
        syncAnalysisUrl(appliedFilterState);
        updateSummaryLink(appliedFilterState);
        renderActiveFilters(appliedFilterState);
        await loadAnalysis();
    } catch (error) {
        console.error(error);
        alert("Failed to load the analysis page. Please make sure the backend server is running.");
    }
});