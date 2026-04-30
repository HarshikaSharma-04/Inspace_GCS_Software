import { Map } from "./Map.js";

/* SELECTORS */
const csvBtn = document.querySelector(".telemetry-btn--csv");
const graphBtn = document.querySelector(".telemetry-btn--graph");
const mapBtn = document.querySelector(".telemetry-btn--map");

const missionTimeEl = document.querySelector(".mission-time-value");
const packetEl = document.querySelector(".packet-count-value");
const modeEl = document.querySelector(".mode-value");

const csvContainer = document.querySelector(".telemetry-csv-container");
const graphContainer = document.querySelector(".telemetry-graph-container");
const mapContainer = document.querySelector(".telemetry-map-container");


const sidebarTempEl = document.querySelector(".sidebar-temp-value");
const sidebarVoltageEl = document.querySelector(".sidebar-voltage-value");
const sidebarPressureEl = document.querySelector(".sidebar-pressure-value");
const sidebarAltitudeEl = document.querySelector(".sidebar-altitude-value");
const sidebarCmdEl = document.querySelector(".sidebar-cmd-value");
const sidebarGpsTimeEl = document.querySelector(".sidebar-gps-time-value");
const sidebarGpsAltitudeEl = document.querySelector(".sidebar-gps-altitude-value");
const sidebarGpsLatitudeEl = document.querySelector(".sidebar-gps-latitude-value");
const sidebarGpsLongitudeEl = document.querySelector(".sidebar-gps-longitude-value");
const sidebarGpsSatsEl = document.querySelector(".sidebar-gps-sats-value");
const mapDiv = document.getElementById("map");


/* STATE */
let csvLoaded = false;
let csvInterval = null;
let csvData = [];
let currentIndex = 0;
let charts = {};
let MAX_POINTS = 20; // this is the number of points visible in a view
let allRows = []; // stores all past telemetry rows
let chartInitialized = false;

/* DEFAULT VIEW  */
setActiveButton(graphBtn);
showGraphView();
loadCSV();

csvBtn.addEventListener("click", () => {
  setActiveButton(csvBtn);
  showCSVView();
  loadCSV();
});

graphBtn.addEventListener("click", () => {
  setActiveButton(graphBtn);
  showGraphView();
  loadGraphs();
});

mapBtn.addEventListener("click", () => {
  setActiveButton(mapBtn);
  showMapView();
  Map();
});

/*  VIEW FUNCTIONS */

function showCSVView() {
  csvContainer.style.display = "block";
  graphContainer.style.display = "none";
  mapContainer.style.display = "none";
  mapDiv.style.display = "none";
}

function showGraphView() {
  csvContainer.style.display = "none";
  graphContainer.style.display = "grid";
  mapContainer.style.display = "none";
  mapDiv.style.display = "none";
}

function showMapView() {
  csvContainer.style.display = "none";
  graphContainer.style.display = "none";
  mapContainer.style.display = "block";
  mapDiv.style.display = "block";
}

/* ACTIVE BUTTON */

function setActiveButton(activeBtn) {
  document
    .querySelectorAll(".page-button")
    .forEach((btn) => btn.classList.remove("active-btn"));

  activeBtn.classList.add("active-btn");
}

/* CSV LOADER*/

function loadCSV() {
  if (csvLoaded) return;

  Papa.parse("./test_csv.csv", {
    download: true,
    header: true,
    transformHeader: (h) => h.trim(),

    complete: function (results) {
      csvData = results.data.filter((row) => Object.keys(row).length > 1);

      if (csvData.length === 0) {
        csvContainer.innerHTML = "<p>No data found in CSV.</p>";
        return;
      }

      const headers = Object.keys(csvData[0]);

      csvContainer.innerHTML = `
        <div class="telemtry-data-container">
          <table class="csv-table">
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody id="csv-table-body"></tbody>
          </table>
        </div>
      `;

      const tbody = document.getElementById("csv-table-body");

      function addNextRow() {
        if (currentIndex >= csvData.length) {
          clearInterval(csvInterval);
          return;
        }

        const row = csvData[currentIndex];

        const rowHTML = `
          <tr>
            ${headers.map((h) => `<td>${row[h]}</td>`).join("")}
          </tr>
        `;

        tbody.innerHTML += rowHTML;

        updateTopTelemetry(row);
        updateSidebarTelemetry(row);
        updateGraphs(row);

        currentIndex++;
      }

      csvInterval = setInterval(addNextRow, 1000);
      csvLoaded = true;
      if (!Object.keys(charts).length) {
        loadGraphs();
      }
    },
  });
}


// Helper functions 

/* TELEMETRY UPDATE */

function updateTopTelemetry(row) {
  if (!row) return;

  missionTimeEl.innerText = row["MISSION_TIME"];
  packetEl.innerText = String(row["PACKET_COUNT"]).padStart(2, "0");

  if (row["MODE"] === " F") {
    modeEl.innerText = "FLIGHT";
  } else {
    modeEl.innerText = "SIMULATION";
  }

  updateStageIndicators(parseInt(row["STATE"]));
  allRows.push(row);
}

/* STAGE INDICATORS UPDATE */
function updateStageIndicators(currentState) {
  const stageBoxes = document.querySelectorAll(".stage-box");

  stageBoxes.forEach((box, index) => {
    const stageNumber = index + 1;

    // reset
    box.classList.remove("completed", "current");

    if (stageNumber > currentState) {
      box.classList.add("completed");
    } else if (stageNumber === currentState) {
      box.classList.add("current");
    }
  });
}


/* SIDEBAR TELEMETRY UPDATE */

function updateSidebarTelemetry(row) {
  if (!row) return;
  sidebarTempEl.innerText = row["TEMPERATURE"];
  sidebarVoltageEl.innerText = row["VOLTAGE"];
  sidebarPressureEl.innerText = row["PRESSURE"];
  sidebarAltitudeEl.innerText = row["ALTITUDE"];
  sidebarCmdEl.innerText = row["CMD_ECHO"];
  sidebarGpsTimeEl.innerText = row["GPS_TIME"];
  sidebarGpsAltitudeEl.innerText = row["GPS_ALTITUDE"];
  sidebarGpsLatitudeEl.innerText = row["GPS_LATITUDE"];
  sidebarGpsLongitudeEl.innerText = row["GPS_LONGITUDE"];
  sidebarGpsSatsEl.innerText = row["GPS_SATS"];
}

/*  GRAPHS */

function loadGraphs() {
  if (!csvData || csvData.length === 0) return;

  if (chartInitialized) return;

  let columns = Object.keys(csvData[0]).filter(
    (col) =>
      col !== "MISSION_TIME" &&
      col !== "PACKET_COUNT" &&
      col !== "MODE" &&
      col !== "GPS_SATS" &&
      col !== "CMD_ECHO" &&
      col != "TEAM_ID" &&
      col != "STATE"
  );

  graphContainer.innerHTML = `
    <div class="telemtry-data-container-graph">
      ${columns
        .map(
          (col) => `
        <div class="telemetry-grid-item">
          <canvas id="${col}_chart"></canvas>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  charts = {};

  columns.forEach((col) => {
    const ctx = document.getElementById(`${col}_chart`);

    charts[col] = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            data: [],
            borderWidth: 2,
            borderColor: "#8787ffff",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            type: "linear",
            reverse: false,
            title: { display: true, text: "Packet" },
          },
          y: { title: { display: true, text: col } },
        },
      },
    });
  });

  allRows.forEach((row) => {
    const packet = Number(row["PACKET_COUNT"]);

    for (let col in charts) {
      const value = Number(row[col]);
      if (isNaN(value)) continue;

      charts[col].data.datasets[0].data.push({ x: packet, y: value });
    }
  });

  chartInitialized = true;
}

function updateGraphs(row) {
  if (!row || Object.keys(charts).length === 0) return;

  const packet = Number(row["PACKET_COUNT"]);
  if (isNaN(packet)) return;

  for (let col in charts) {
    const value = Number(row[col]);
    if (isNaN(value)) continue;

    charts[col].data.datasets[0].data.push({ x: packet, y: value });

    if (charts[col].data.datasets[0].data.length > MAX_POINTS) {
      charts[col].data.datasets[0].data.shift();
    }

    const minX = Math.max(0, packet - MAX_POINTS + 1);
    const maxX = minX + MAX_POINTS;

    charts[col].options.scales.x.min = minX;
    charts[col].options.scales.x.max = maxX;
    charts[col].update("none");
  }
}

function stopTelemetry() {
  if (csvInterval) {
    clearInterval(csvInterval);
    csvInterval = null;
  }

  csvLoaded = false;
  currentIndex = 0;

  const tbody = document.getElementById("csv-table-body");
  if (tbody) {
    tbody.innerHTML = "";
  }

  for (let col in charts) {
    if (charts[col] && charts[col].data && charts[col].data.datasets[0]) {
      charts[col].data.datasets[0].data = [];
      charts[col].update("none");
    }
  }

  csvData = [];
  allRows = [];
}
