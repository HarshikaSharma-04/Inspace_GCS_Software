import { Map } from "./Map.js";

/* SELECTORS */
const csvBtn = document.querySelector(".telemetry-btn--csv");
const graphBtn = document.querySelector(".telemetry-btn--graph");
const homeBtn = document.querySelector(".telemetry-btn--home");

const missionTimeEl = document.querySelector(".mission-time-value");
const packetEl = document.querySelector(".packet-count-value");
const modeEl = document.querySelector(".mode-value");

const csvContainer = document.querySelector(".telemetry-csv-container");
const graphContainer = document.querySelector(".telemetry-graph-container");
const mapContainer = document.querySelector(".telemetry-map-container");
const gnssContainer = document.querySelector(".gnss-container");
const mainSection = document.querySelector(".telemetry-visualization-section");
const sidebar = document.querySelector(".sidebar");

const sidebarTempEl = document.querySelector(".sidebar-temp-value");
const sidebarVoltageEl = document.querySelector(".sidebar-voltage-value");
const sidebarPressureEl = document.querySelector(".sidebar-pressure-value");
const sidebarAltitudeEl = document.querySelector(".sidebar-altitude-value");
const accelREl = document.querySelector(".sidebar-accel-r");
const accelPEl = document.querySelector(".sidebar-accel-p");
const accelYEl = document.querySelector(".sidebar-accel-y");
const gyroREl = document.querySelector(".sidebar-gyro-r");
const gyroPEl = document.querySelector(".sidebar-gyro-p");
const gyroYEl = document.querySelector(".sidebar-gyro-y");
const magREl = document.querySelector(".sidebar-mag-r");
const magPEl = document.querySelector(".sidebar-mag-p");
const magYEl = document.querySelector(".sidebar-mag-y");
const cmdEchoList = document.getElementById("cmd-echo-list");
const commandInput = document.querySelector(".command");
const sendBtn = document.querySelector(".send-btn");
let commandHistory = [];

function renderCmdEcho(){
  if(commandHistory.length === 0){
    cmdEchoList.innerHTML = '<span class="cmd-echo-empty">No commands sent</span>';
    return;
  }
  cmdEchoList.innerHTML = commandHistory
    .map((cmd, i) => `<div class="cmd-echo-item${i === commandHistory.length - 1 ? ' cmd-echo-latest' : ''}">&gt; ${cmd}</div>`)
    .join("");
  cmdEchoList.scrollTop = cmdEchoList.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const val = commandInput.value.trim();
  if(!val) return;
  commandHistory.push(val);
  renderCmdEcho();
  commandInput.value = "";
});

commandInput.addEventListener("keydown", (e)=> {
  if(e.key !== "Enter") return;
  const val = commandInput.value.trim();
  if(!val) return;
  commandHistory.push(val);
  renderCmdEcho();
  commandInput.value = "";
});

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
setActiveButton(homeBtn);
showHomeView();
loadCSV();

csvBtn.addEventListener("click", () => {
  setActiveButton(csvBtn);
  showCSVView();
  loadCSV();
});

graphBtn.addEventListener("click", () => {
  setActiveButton(graphBtn);
  showHomeView();   
  loadGraphs();

  setTimeout(() => {
    graphContainer.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 200);
});

homeBtn.addEventListener("click", () => {
  setActiveButton(homeBtn);
  showHomeView();

  mainSection.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});

/*  VIEW FUNCTIONS */
function showHomeView() {
  csvContainer.style.display = "none";
  graphContainer.style.display = "grid";
  mapContainer.style.display = "none";

  mapDiv.style.display = "block";      
  gnssContainer.style.display = "block"; 
  sidebar.style.display = "flex";
  Map();
}

function showCSVView() {
  csvContainer.style.display = "block";
  graphContainer.style.display = "none";
  mapContainer.style.display = "none";
  mapDiv.style.display = "none";
  gnssContainer.style.display = "none";
  sidebar.style.display = "none";
  csvContainer.style.gridColumn = "1 / -1";
  
}

function showGraphView() {
  csvContainer.style.display = "none";
  graphContainer.style.display = "grid";
  mapContainer.style.display = "none";
  mapDiv.style.display = "block";
  sidebar.style.display = "flex"; 
  gnssContainer.style.display = "block";
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
        
        // Update 3D plot
        console.log('Attempting to update 3D plot, function exists:', typeof window.update3DPlot);
        if (typeof window.update3DPlot === 'function') {
          window.update3DPlot(row);
        } else {
          console.error('update3DPlot function not found!');
        }

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
  sidebarGpsTimeEl.innerText = row["GNSS_TIME"];
  sidebarGpsAltitudeEl.innerText = row["GNSS_ALTITUDE"];
  sidebarGpsLatitudeEl.innerText = row["GNSS_LATITUDE"];
  sidebarGpsLongitudeEl.innerText = row["GNSS_LONGITUDE"];
  sidebarGpsSatsEl.innerText = row["GNSS_SATS"];
  accelREl.innerText = row["ACCEL_R"];
  accelPEl.innerText = row["ACCEL_P"];
  accelYEl.innerText = row["ACCEL_Y"];

  gyroREl.innerText = row["GYRO_R"];
  gyroPEl.innerText = row["GYRO_P"];
  gyroYEl.innerText = row["GYRO_Y"];

  magREl.innerText = row["MAG_R"];
  magPEl.innerText = row["MAG_P"];
  magYEl.innerText = row["MAG_Y"];
}

/*  GRAPHS */

function loadGraphs() {
  if (!csvData || csvData.length === 0) return;
  if (chartInitialized) return;

  graphContainer.innerHTML = `
    <div class="telemtry-data-container-graph">

      <div class="telemetry-grid-item">
        <canvas id="altitude_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="pressure_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="temperature_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="voltage_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="gyro_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="accel_chart"></canvas>
      </div>

      <div class="telemetry-grid-item">
        <canvas id="mag_chart"></canvas>
      </div>

    </div>
  `;

  charts = {};

  function createMultiLineChart(id, labels) {
    return new Chart(document.getElementById(id), {
      type: "line",
      data: {
        datasets: [
          { label: "R", data: [], borderColor: "red", tension: 0.4 },
          { label: "P", data: [], borderColor: "green", tension: 0.4 },
          { label: "Y", data: [], borderColor: "blue", tension: 0.4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: true },
        },
        scales: {
          x: { type: "linear", title: { display: true, text: "Packet" } ,grid: { display: false }},
          y: { title: { display: true, text: labels },grid: { display: false }},
        },
      },
    });
  }

  function createSingleChart(id, label) {
    return new Chart(document.getElementById(id), {
      type: "line",
      data: {
        datasets: [
          {
            label: label,
            data: [],
            borderColor: "#8787ff",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: true } },
        scales: {
          x: { type: "linear", title: { display: true, text: "Packet" } ,grid: { display: false }},
          y: { title: { display: true, text: label },grid: { display: false }},
        },
      },
    });
  }

  // create charts
  charts.altitude = createSingleChart("altitude_chart", "ALTITUDE");
  charts.pressure = createSingleChart("pressure_chart", "PRESSURE");
  charts.temperature = createSingleChart("temperature_chart", "TEMPERATURE");
  charts.voltage = createSingleChart("voltage_chart", "VOLTAGE");

  charts.gyro = createMultiLineChart("gyro_chart", "GYRO (deg/s)");
  charts.accel = createMultiLineChart("accel_chart", "ACCEL (m/s²)");
  charts.mag = createMultiLineChart("mag_chart", "MAG (µT)");

  chartInitialized = true;
}

function updateGraphs(row) {
  if (!row || !charts) return;

  const packet = Number(row["PACKET_COUNT"]);
  if (isNaN(packet)) return;

  // Single value charts
  charts.altitude.data.datasets[0].data.push({ x: packet, y: Number(row["ALTITUDE"]) });
  charts.pressure.data.datasets[0].data.push({ x: packet, y: Number(row["PRESSURE"]) });
  charts.temperature.data.datasets[0].data.push({ x: packet, y: Number(row["TEMPERATURE"]) });
  charts.voltage.data.datasets[0].data.push({ x: packet, y: Number(row["VOLTAGE"]) });

  // Gyro (R,P,Y)
  charts.gyro.data.datasets[0].data.push({ x: packet, y: Number(row["GYRO_R"]) });
  charts.gyro.data.datasets[1].data.push({ x: packet, y: Number(row["GYRO_P"]) });
  charts.gyro.data.datasets[2].data.push({ x: packet, y: Number(row["GYRO_Y"]) });

  // Accel (R,P,Y)
  charts.accel.data.datasets[0].data.push({ x: packet, y: Number(row["ACCEL_R"]) });
  charts.accel.data.datasets[1].data.push({ x: packet, y: Number(row["ACCEL_P"]) });
  charts.accel.data.datasets[2].data.push({ x: packet, y: Number(row["ACCEL_Y"]) });

  // Mag (R,P,Y)
  charts.mag.data.datasets[0].data.push({ x: packet, y: Number(row["MAG_R"]) });
  charts.mag.data.datasets[1].data.push({ x: packet, y: Number(row["MAG_P"]) });
  charts.mag.data.datasets[2].data.push({ x: packet, y: Number(row["MAG_Y"]) });

  // LIMIT POINTS + UPDATE
  Object.values(charts).forEach(chart => {
    chart.data.datasets.forEach(ds => {
      if (ds.data.length > MAX_POINTS) ds.data.shift();
    });

    const minX = Math.max(0, packet - MAX_POINTS + 1);
    const maxX = minX + MAX_POINTS;

    chart.options.scales.x.min = minX;
    chart.options.scales.x.max = maxX;

    chart.update("none");
  });
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

  // Clear 3D plot
  if (typeof window.clear3DPlot === 'function') {
    window.clear3DPlot();
  }

  csvData = [];
  allRows = [];
}
