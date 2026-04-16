const API_BASE = "http://127.0.0.1:5000";
const FILTER_STORAGE_KEY = "dialysisDashboardFiltersV1";

let currentPage = 1;
const pageSize = 10;
let totalPages = 1;

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

function clearStoredFilterState() {
    localStorage.removeItem(FILTER_STORAGE_KEY);
}

function syncSummaryUrl(filterState) {
    const queryString = buildQueryString(filterState);
    const newUrl = queryString
        ? `${window.location.pathname}?${queryString}`
        : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
}

function updateAnalysisLink(filterState) {
    const link = document.getElementById("analysisPageLink");

    if (!link) return;

    const queryString = buildQueryString(filterState);
    link.href = queryString ? `analysis.html?${queryString}` : "analysis.html";
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

function formatInteger(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "-";
    }

    return Number(value).toLocaleString();
}

function formatRate(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "-";
    }

    return Number(value).toFixed(1);
}

function getStateCheckboxes() {
    return Array.from(
        document.querySelectorAll('#stateOptions input[type="checkbox"]')
    );
}

function getSelectedStates() {
    return getStateCheckboxes()
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value.trim())
        .filter(Boolean);
}

function updateStateButtonText() {
    const selectedStates = getSelectedStates();
    const button = document.getElementById("stateDropdownBtn");

    if (!button) return;

    if (selectedStates.length === 0) {
        button.textContent = "Select states";
    } else if (selectedStates.length <= 3) {
        button.textContent = selectedStates.join(", ");
    } else {
        button.textContent = `${selectedStates.length} states selected`;
    }
}

function setupStateDropdownEvents() {
    const dropdown = document.getElementById("stateDropdown");
    const button = document.getElementById("stateDropdownBtn");
    const menu = document.getElementById("stateDropdownMenu");

    if (!dropdown || !button || !menu) return;

    button.addEventListener("click", function (event) {
        event.stopPropagation();
        menu.classList.toggle("show");
    });

    document.addEventListener("click", function (event) {
        if (!dropdown.contains(event.target)) {
            menu.classList.remove("show");
        }
    });
}

function closeStateDropdown() {
    const menu = document.getElementById("stateDropdownMenu");

    if (menu) {
        menu.classList.remove("show");
    }
}

function applyFilterStateToForm(filterState) {
    const normalized = normalizeFilterState(filterState);
    const selectedStateSet = new Set(normalized.states);

    getStateCheckboxes().forEach((checkbox) => {
        checkbox.checked = selectedStateSet.has(checkbox.value);
    });

    document.getElementById("zipInput").value = normalized.zip;
    document.getElementById("facilityInput").value = normalized.facility;

    updateStateButtonText();
}

function getFilterStateFromForm() {
    return normalizeFilterState({
        states: getSelectedStates(),
        zip: document.getElementById("zipInput").value.trim(),
        facility: document.getElementById("facilityInput").value.trim()
    });
}

function setAppliedFilterState(filterState) {
    appliedFilterState = normalizeFilterState(filterState);

    if (hasActiveFilters(appliedFilterState)) {
        saveFilterState(appliedFilterState);
    } else {
        clearStoredFilterState();
    }

    syncSummaryUrl(appliedFilterState);
    updateAnalysisLink(appliedFilterState);

    const summaryEl = document.getElementById("filterSummary");
    if (summaryEl) {
        summaryEl.textContent = getFilterSummaryText(appliedFilterState);
    }
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

function getFilterSummaryText(filterState = appliedFilterState) {
    const parts = [];

    if (filterState.states.length > 0) {
        parts.push(`States: ${filterState.states.join(", ")}`);
    }

    if (filterState.zip) {
        parts.push(`ZIP: ${filterState.zip}`);
    }

    if (filterState.facility) {
        parts.push(`Facility: ${filterState.facility}`);
    }

    return parts.length > 0
        ? `Current filters: ${parts.join(" | ")}`
        : "Showing all facilities";
}

function setLoading(isLoading) {
    document.getElementById("applyBtn").disabled = isLoading;
    document.getElementById("resetBtn").disabled = isLoading;
    document.getElementById("exportBtn").disabled = isLoading;
    document.getElementById("prevBtn").disabled = isLoading || currentPage === 1;
    document.getElementById("nextBtn").disabled = isLoading || currentPage >= totalPages;
}

async function loadStates() {
    const response = await fetch(`${API_BASE}/api/states`);

    if (!response.ok) {
        throw new Error("Failed to load states");
    }

    const states = await response.json();
    const stateOptions = document.getElementById("stateOptions");

    stateOptions.innerHTML = "";

    if (!states || states.length === 0) {
        stateOptions.innerHTML = `<div class="custom-multi-empty">No states found</div>`;
        updateStateButtonText();
        return;
    }

    states.forEach((state) => {
        const label = document.createElement("label");
        label.className = "custom-multi-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = state;
        checkbox.addEventListener("change", updateStateButtonText);

        const text = document.createElement("span");
        text.textContent = state;

        label.appendChild(checkbox);
        label.appendChild(text);
        stateOptions.appendChild(label);
    });

    updateStateButtonText();
}

function renderTopTable(tbodyId, rows) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";

    if (!rows || rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No data found</td></tr>`;
        return;
    }

    rows.forEach((row, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td title="${escapeHtml(row.facility_name)}">${escapeHtml(row.facility_name)}</td>
            <td>${escapeHtml(row.state)}</td>
            <td>${escapeHtml(row.zip_code)}</td>
            <td class="numeric">${formatRate(row.mortality_rate)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function updateTopTitle(elementId, count, type) {
    const title = document.getElementById(elementId);

    if (!title) return;

    if (count === 0) {
        title.textContent = `${type} Mortality Facilities`;
        return;
    }

    const facilityWord = count === 1 ? "Facility" : "Facilities";
    title.textContent = `Top ${count} ${type} Mortality ${facilityWord}`;
}

async function loadSummary() {
    const params = getFilterParams(appliedFilterState);
    const response = await fetch(`${API_BASE}/api/summary?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Failed to load summary");
    }

    const data = await response.json();

    document.getElementById("totalValue").textContent = formatInteger(data.total);
    document.getElementById("avgValue").textContent = formatRate(data.avgMortality);
    document.getElementById("minValue").textContent = formatRate(data.minMortality);
    document.getElementById("maxValue").textContent = formatRate(data.maxMortality);

    const summaryEl = document.getElementById("filterSummary");
    if (summaryEl) {
        summaryEl.textContent = getFilterSummaryText(appliedFilterState);
    }

    renderTopTable("highestTableBody", data.top10Highest || []);
    renderTopTable("lowestTableBody", data.top10Lowest || []);

    updateTopTitle(
        "highestTitle",
        data.top10Highest ? data.top10Highest.length : 0,
        "Highest"
    );

    updateTopTitle(
        "lowestTitle",
        data.top10Lowest ? data.top10Lowest.length : 0,
        "Lowest"
    );
}

async function loadTable() {
    const params = getFilterParams(appliedFilterState);
    params.append("page", currentPage);
    params.append("pageSize", pageSize);

    const response = await fetch(`${API_BASE}/api/table?${params.toString()}`);

    if (!response.ok) {
        throw new Error("Failed to load table");
    }

    const data = await response.json();
    const tbody = document.getElementById("fullTableBody");
    tbody.innerHTML = "";

    if (!data.data || data.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No data found</td></tr>`;
    } else {
        data.data.forEach((row) => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td title="${escapeHtml(row.facility_name)}">${escapeHtml(row.facility_name)}</td>
                <td>${escapeHtml(row.state)}</td>
                <td>${escapeHtml(row.zip_code)}</td>
                <td>${escapeHtml(row.smr_date)}</td>
                <td class="numeric">${formatRate(row.mortality_rate)}</td>
            `;

            tbody.appendChild(tr);
        });
    }

    totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    document.getElementById("pageInfo").textContent = `Page ${currentPage} of ${totalPages}`;

    document.getElementById("tableSummary").textContent =
        `Showing ${data.data ? data.data.length : 0} rows on this page • ${formatInteger(data.total)} total matching facilities`;

    document.getElementById("prevBtn").disabled = currentPage === 1;
    document.getElementById("nextBtn").disabled = currentPage >= totalPages;
}

async function loadAll() {
    setLoading(true);

    try {
        await loadSummary();
        await loadTable();
    } catch (error) {
        console.error("Summary page load error:", error);
        alert("Failed to load data. Please make sure the backend is running.");
    } finally {
        setLoading(false);
    }
}

function resetFormInputs() {
    getStateCheckboxes().forEach((checkbox) => {
        checkbox.checked = false;
    });

    document.getElementById("zipInput").value = "";
    document.getElementById("facilityInput").value = "";

    updateStateButtonText();
}

function exportFilteredData() {
    const params = getFilterParams(appliedFilterState);
    const exportUrl = `${API_BASE}/api/export?${params.toString()}`;
    window.open(exportUrl, "_blank");
}

document.getElementById("applyBtn").addEventListener("click", async () => {
    currentPage = 1;
    closeStateDropdown();
    setAppliedFilterState(getFilterStateFromForm());
    await loadAll();
});

document.getElementById("resetBtn").addEventListener("click", async () => {
    currentPage = 1;
    resetFormInputs();
    closeStateDropdown();
    setAppliedFilterState(createEmptyFilterState());
    await loadAll();
});

document.getElementById("exportBtn").addEventListener("click", () => {
    exportFilteredData();
});

document.getElementById("prevBtn").addEventListener("click", async () => {
    if (currentPage > 1) {
        currentPage -= 1;
        await loadAll();
    }
});

document.getElementById("nextBtn").addEventListener("click", async () => {
    if (currentPage < totalPages) {
        currentPage += 1;
        await loadAll();
    }
});

window.addEventListener("DOMContentLoaded", async () => {
    try {
        setupStateDropdownEvents();
        await loadStates();

        const initialFilterState = getInitialFilterState();
        applyFilterStateToForm(initialFilterState);
        setAppliedFilterState(initialFilterState);

        await loadAll();
    } catch (error) {
        console.error("Initial page load error:", error);
        alert("Failed to load page. Please check backend and API connection.");
    }
});