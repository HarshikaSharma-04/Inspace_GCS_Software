import { Map, resizeMap, updateMapLocation } from "./Map.js";
import CanvasTable from "./canvasTable.js";
import { initializeSimulationMode } from "./SimulationMode.js";
import { initTilt } from "./Tilt.js";
import { initHeadingBearingPlot, updateHeadingBearing } from "./polar.js";


// --- Navigation & main containers ---
const homeBtn = document.querySelector(".telemetry-btn--home");
const graphBtn = document.querySelector(".telemetry-btn--graph");
const csvBtn = document.querySelector(".telemetry-btn--csv");
const graphContainer = document.querySelector(".telemetry-graph-container");
const mapContainer = document.querySelector(".telemetry-map-container");
const csvContainer = document.querySelector(".telemetry-csv-container");
const mapDiv = document.getElementById("map");
const mapCamControl = document.querySelector(".map-wrapper");
const flightState = document.querySelector(".flight-state-command-section");
const cmdBottomContainer = document.querySelector(".cmd-bottom-container");
const modeValue = document.querySelector(".mode-value");

// --- Top dashboard ---
const missionTimeEl = document.querySelector(".mission-time-value");
const packetEl = document.querySelector(".packet-count-value");
const stageBoxes = document.querySelectorAll(".stage-box");
const levelDisplays = document.querySelectorAll(".level-display");

// --- Sidebar ---
const sidebar = document.querySelector(".sidebar");
const sidebar3DMap = document.querySelector(".plot-3d-section");
const GNSSContainer = document.querySelector(".gnss-container");
const sidebarTempEl = document.querySelector(".sidebar-temp-value");
const sidebarVoltageEl = document.querySelector(".sidebar-voltage-value");
const sidebarPressureEl = document.querySelector(".sidebar-pressure-value");
const sidebarAltitudeEl = document.querySelector(".sidebar-altitude-value");
const sidebarVelocityEl = document.querySelector(".sidebar-velocity-value");
const sidebarTimeToImpactEl = document.querySelector(".sidebar-time-to-impact-value");
const sidebarHeadingErrorEl = document.querySelector(".sidebar-heading-error-value");
const sidebarGlideRatioEl = document.querySelector(".sidebar-glide-ratio-value");

const sidebarGNSSTimeEls = document.querySelectorAll(".sidebar-gnss-time-value");
const sidebarGNSSAltitudeEls = document.querySelectorAll(".sidebar-gnss-altitude-value");
const sidebarGNSSLatitudeEls = document.querySelectorAll(".sidebar-gnss-latitude-value");
const sidebarGNSSLongitudeEls = document.querySelectorAll(".sidebar-gnss-longitude-value");
const sidebarGNSSSatsEls = document.querySelectorAll(".sidebar-gnss-sats-value");

const RPY_SELECTORS = [
  ".sidebar-gyro-r", ".sidebar-gyro-p", ".sidebar-gyro-y",
  ".sidebar-accel-r", ".sidebar-accel-p", ".sidebar-accel-y",
];

// --- Commands ---
const sendBtn = document.querySelector(".send-btn");
const commandInput = document.querySelector("#commandInput");
const cmdEchoList = document.getElementById("cmd-echo-list");
const cxBtn = document.getElementById("btn-cx");
const gyroBtn = document.getElementById("btn-gyro");
const servoBtn = document.getElementById("btn-servo");

// --- Plot / chart element ids ---
const HB_PLOT_ID = "heading-bearing-plot";
const GNSS_PLOT_ID = "GNSS-3d-plot";

// --- Global state ---
const MAX_3D_POINTS = 900;
const MAX_BUFFERED_ROWS = 900;
const MAX_TABLE_ROWS = 10000;
let MAX_POINTS = 900;

const xBuffer = new Float32Array(MAX_3D_POINTS);
const yBuffer = new Float32Array(MAX_3D_POINTS);
const zBuffer = new Float32Array(MAX_3D_POINTS);
let bufferIndex = 0;

let is3DMapInitialized = false;
let charts = {};
let chartInitialized = false;
let csvData = [];
let allRows = [];
let table;
let count = 0;
let currentView = "graph";
let lastRenderedState = null;
const telemetryQueue = [];
let telemetryFlushScheduled = false;

// --- Graph config (must be declared before loadGraphs() is called) ---
const UNIT_MAP = {
  ALTITUDE: "m",
  TEMPERATURE: "°C",
  PRESSURE: "Pa",
  VOLTAGE: "V",
  MAGNETOMETER: "μT",
  GYROSCOPE: "°/s",
  ACCELERATION: "°/s²",
};

const GRAPH_LAYOUT = [
  { id: "ALTITUDE", title: "ALTITUDE", units: "ALTITUDE" },
  { id: "PRESSURE", title: "PRESSURE", units: "PRESSURE" },
  { id: "TEMPERATURE", title: "TEMPERATURE", units: "TEMPERATURE" },
  {
    id: "ACCEL_COMBINED",
    title: "ACCELERATION",
    units: "ACCELERATION",
    combined: ["ACCEL_R", "ACCEL_P", "ACCEL_Y"],
  },
  {
    id: "GYRO_COMBINED",
    title: "GYRO SPIN RATE",
    units: "GYROSCOPE",
    combined: ["GYRO_R", "GYRO_P", "GYRO_Y"],
  },
  { id: "VOLTAGE", title: "VOLTAGE", units: "VOLTAGE" },
];

// the main line that connects the backend with the frontend
export const socket = io("http://127.0.0.1:3000");

socket.on("telemetry-update", (data) => {
  telemetryQueue.push(data);

  if (!telemetryFlushScheduled) {
    telemetryFlushScheduled = true;
    requestAnimationFrame(flushTelemetryQueue);
  }
});

socket.on("command-success", (verifiedCommand) => {
  handleButtonStateUI(verifiedCommand);
  addCommandEcho(verifiedCommand);
});

function showCommandMessage(message) {
  if (!commandInput) return;
  commandInput.value = message;
  commandInput.style.color = "red";
  commandInput.style.fontWeight = "bold";
  commandInput.style.fontSize = "18px";

  const clearWarning = () => {
    commandInput.value = "";
    commandInput.style.color = "";
    commandInput.style.fontWeight = "";
    commandInput.style.fontSize = "";
    commandInput.removeEventListener("focus", clearWarning);
    commandInput.removeEventListener("input", clearWarning);
  };
  commandInput.addEventListener("focus", clearWarning);
  commandInput.addEventListener("input", clearWarning);
}

socket.on("command-warning", showCommandMessage);

socket.on("clear-data", () => {
  csvData = [];
  clearChartData();
});


const _CT_COLS = [
  { title: "TEAM_ID", field: "TEAM_ID", w: 120 },
  { title: "TIME", field: "TIME_STAMP", w: 50 },
  { title: "PKT", field: "PACKET_COUNT", w: 40 },
  { title: "ALT", field: "ALTITUDE", w: 35 },
  { title: "PRESSURE", field: "PRESSURE", w: 45 },
  { title: "TEMP", field: "TEMPERATURE", w: 35 },
  { title: "VOLT", field: "VOLTAGE", w: 40 },

  { title: "GNSS_TIME", field: "GNSS_TIME", w: 55 },
  { title: "GNSS_LAT", field: "GNSS_LATITUDE", w: 55 },
  { title: "GNSS_LONG", field: "GNSS_LONGITUDE", w: 55 },
  { title: "GNSS_ALT", field: "GNSS_ALTITUDE", w: 55 },
  { title: "GNSS_SATS", field: "GNSS_SATS", w: 50 },

  { title: "ACCEL_R", field: "ACCEL_R", w: 55 },
  { title: "ACCEL_P", field: "ACCEL_P", w: 55 },
  { title: "ACCEL_Y", field: "ACCEL_Y", w: 55 },

  { title: "GYRO_R", field: "GYRO_R", w: 50 },
  { title: "GYRO_P", field: "GYRO_P", w: 50 },
  { title: "GYRO_Y", field: "GYRO_Y", w: 50 },

  { title: "STATE", field: "FLIGHT_SOFTWARE_STATE", w: 90 },
  { title: "CMD", field: "CMD_ECHO", w: 50 },
  { title: "G/D_RATIO", field: "GLIDE_RATIO", w: 50 },
  { title: "HEADING", field: "HEADING", w: 40 },
  { title: "BEARING", field: "BEARING", w: 40 },
  { title: "HEADING_ERR", field: "HEADING_ERROR", w: 50 }
];

function initTabulator() {
  table = new CanvasTable("telemetry-table", _CT_COLS);
  // CanvasTable internally handles auto-scroll via _autoScroll flag based on scroll position
}

function safeInit(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`${name} initialization failed:`, err);
  }
}

safeInit("Heading/Bearing plot", initHeadingBearingPlot);

// default view
setActiveButton(homeBtn);
showSidebarContent();
showGraphView();

safeInit("Map", Map);
safeInit("Table", initTabulator);
safeInit("Tilt", () => initTilt(socket));
safeInit("Simulation mode", () =>
  initializeSimulationMode({ socket, modeValue, resetAllTelemetryData })
);
safeInit("Graphs", () => {
  if (!chartInitialized) loadGraphs();
});
safeInit("3D GNSS plot", () => {
  if (!is3DMapInitialized) init3DMap();
});

function flushTelemetryQueue() {
  telemetryFlushScheduled = false;
  if (!telemetryQueue.length) return;

  const shouldRenderDashboard = currentView !== "csv";
  const newRows = [];

  while (telemetryQueue.length) {
    const data = telemetryQueue.shift();
    processTelemetryData(data, shouldRenderDashboard);
    newRows.push(data);
  }

  if (table && newRows.length > 0) {
    table.blockRedraw();
    table.addData(newRows, false);

    count += newRows.length;
    while (count > MAX_TABLE_ROWS) {
      table.deleteFirstRow();
      count--;
    }
    table.restoreRedraw();
  }

  if (shouldRenderDashboard) {
    redrawAllCharts();
  }
}

function processTelemetryData(data, shouldRenderDashboard) {
  csvData.push(data);
  if (csvData.length > MAX_BUFFERED_ROWS) csvData.shift();

  allRows.push(data);
  if (allRows.length > MAX_BUFFERED_ROWS) allRows.shift();

  updateTopTelemetry(data); // also updates the flight-stage indicators

  if (shouldRenderDashboard) {
    updateSidebarTelemetry(data);
  }

  updateGraphs(data);

  if (shouldRenderDashboard) {
    const lat = parseFloat(data["GNSS_LATITUDE"]);
    const lng = parseFloat(data["GNSS_LONGITUDE"]);
    if (!isNaN(lat) && !isNaN(lng)) updateMapLocation(lat, lng);
  }
}

function stateToNum(state) {
  if (!state) return 0;
  if (!isNaN(state) && state !== "") return parseInt(state);
  const mapping = {
    LAUNCH_PAD: 1,
    ASCENT: 2,
    DESCENT: 3,
    GLIDER_DEPLOYMENT: 4,
    LANDED: 5,
  };
  return mapping[state.toString().toUpperCase()] || 0;
}

function updateTopTelemetry(row) {
  if (!row) return;
  if (missionTimeEl) missionTimeEl.innerText = row["TIME_STAMP"];

  sidebarGNSSTimeEls.forEach((el) => (el.innerText = row["GNSS_TIME"]));
  document.querySelectorAll(".packet-count-value").forEach((el) => {
    el.innerText = row["PACKET_COUNT"];
  });

  updateStageIndicators(stateToNum(row["FLIGHT_SOFTWARE_STATE"]));
}

function updateStageIndicators(currentState) {
  if (currentState === lastRenderedState) return;
  lastRenderedState = currentState;

  stageBoxes.forEach((box, index) => {
    const stageNumber = index + 1;
    box.classList.remove("current", "completed");
    if (stageNumber === currentState) {
      box.classList.add("current");
    } else if (stageNumber < currentState) {
      box.classList.add("completed");
    }
  });
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.innerText = value;
}

function updateSidebarTelemetry(row) {
  if (!row) return;
  const state = row["FLIGHT_SOFTWARE_STATE"];

  levelDisplays.forEach((levelEl) => {
    const s = levelEl.querySelector(".level-value");
    if (s) s.innerText = state;
  });

  // heading & bearing polar plot
  const heading = parseFloat(row.HEADING);
  const bearing = parseFloat(row.BEARING);
  if (!isNaN(heading) && !isNaN(bearing)) {
    updateHeadingBearing(heading, bearing);
  }
  if (sidebarHeadingErrorEl) sidebarHeadingErrorEl.innerText = row["HEADING_ERROR"];
  if (sidebarGlideRatioEl) sidebarGlideRatioEl.innerText = row["GLIDE_RATIO"];

  // scalar sensor values
  if (sidebarTempEl) sidebarTempEl.innerText = row["TEMPERATURE"] + " °C";
  if (sidebarVoltageEl) sidebarVoltageEl.innerText = row["VOLTAGE"] + " V";
  if (sidebarPressureEl) sidebarPressureEl.innerText = row["PRESSURE"] + " Pa";
  if (sidebarAltitudeEl) sidebarAltitudeEl.innerText = row["ALTITUDE"] + " m";
  if (sidebarVelocityEl) sidebarVelocityEl.innerText = row["DESC_VELOCITY"] + " m/s";
  if (sidebarTimeToImpactEl) sidebarTimeToImpactEl.innerText = row["TIME2IMPACT"] + " s";

  // gyro / accel
  setText(".sidebar-gyro-r", row.GYRO_R);
  setText(".sidebar-gyro-p", row.GYRO_P);
  setText(".sidebar-gyro-y", row.GYRO_Y);
  setText(".sidebar-accel-r", row.ACCEL_R);
  setText(".sidebar-accel-p", row.ACCEL_P);
  setText(".sidebar-accel-y", row.ACCEL_Y);

  // GNSS
  sidebarGNSSTimeEls.forEach((el) => (el.innerText = `${row["GNSS_TIME"]}`));
  sidebarGNSSAltitudeEls.forEach((el) => (el.innerText = `${row["GNSS_ALTITUDE"]} m`));
  sidebarGNSSLatitudeEls.forEach((el) => (el.innerText = `${row["GNSS_LATITUDE"]}°`));
  sidebarGNSSLongitudeEls.forEach((el) => (el.innerText = `${row["GNSS_LONGITUDE"]}°`));
  sidebarGNSSSatsEls.forEach((el) => (el.innerText = row["GNSS_SATS"]));

  update3DMap(row);
}

function update3DMap(row) {
  const lat = parseFloat(row["GNSS_LATITUDE"]);
  const long = parseFloat(row["GNSS_LONGITUDE"]);
  const alt = parseFloat(row["GNSS_ALTITUDE"]);
  if (isNaN(lat) || isNaN(long) || isNaN(alt)) return;
  if (!is3DMapInitialized) init3DMap();

  if (bufferIndex < MAX_3D_POINTS) {
    xBuffer[bufferIndex] = lat;
    yBuffer[bufferIndex] = long;
    zBuffer[bufferIndex] = alt;
    bufferIndex++;
  } else {
    // shift elements left by 1 position
    xBuffer.copyWithin(0, 1);
    yBuffer.copyWithin(0, 1);
    zBuffer.copyWithin(0, 1);
    xBuffer[MAX_3D_POINTS - 1] = lat;
    yBuffer[MAX_3D_POINTS - 1] = long;
    zBuffer[MAX_3D_POINTS - 1] = alt;
  }

  Plotly.restyle(
    GNSS_PLOT_ID,
    {
      x: [xBuffer.subarray(0, bufferIndex)],
      y: [yBuffer.subarray(0, bufferIndex)],
      z: [zBuffer.subarray(0, bufferIndex)],
    },
    [0]
  );
}

function updateGraphs(row) {
  if (!row || !chartInitialized) return;
  const packet = Number(row["PACKET_COUNT"]);

  for (let id in charts) {
    const chart = charts[id];
    const config = GRAPH_LAYOUT.find((g) => g.id === id);

    if (config?.combined) {
      config.combined.forEach((col, i) => {
        const y = Number(row[col]);
        chart.data.datasets[i].data.push({ x: packet, y });
      });
    } else {
      const val = Number(row[id]);
      if (!isNaN(val)) chart.data.datasets[0].data.push({ x: packet, y: val });
    }

    if (chart.data.datasets[0].data.length > MAX_POINTS) {
      chart.data.datasets.forEach((d) => d.data.shift());
    }

    chart.options.scales.x.max = packet + 2;
    chart.options.scales.x.min = Math.max(0, packet - MAX_POINTS);
  }
}

function redrawAllCharts() {
  if (!chartInitialized || !charts) return;
  for (let id in charts) {
    charts[id].update("none");
  }
}

function clearChartData() {
  if (!chartInitialized || !charts) return;
  for (let id in charts) {
    const chart = charts[id];
    if (chart?.data?.datasets) {
      chart.data.datasets.forEach((d) => {
        d.data = [];
      });
      chart.update("none");
    }
  }
}


// ---------- View switching ----------
function setActiveButton(activeBtn) {
  document
    .querySelectorAll(".page-button")
    .forEach((btn) => btn.classList.remove("active-btn"));
  if (activeBtn) activeBtn.classList.add("active-btn");
}

function showSidebarContent() {
  if (sidebar) sidebar.style.display = "flex";
  if (sidebar3DMap) sidebar3DMap.style.display = "flex";
  if (GNSSContainer) GNSSContainer.style.display = "flex";
  if (flightState) flightState.style.display = "flex";
  if (cmdBottomContainer) cmdBottomContainer.style.display = "flex";
}

function showCSVView() {
  currentView = "csv";

  csvContainer.style.display = "block";

  // hide graphs & map
  graphContainer.style.display = "none";
  mapContainer.style.display = "none";
  mapDiv.style.display = "none";

  // hide dashboard sections
  if (sidebar) sidebar.style.display = "none";
  if (GNSSContainer) GNSSContainer.style.display = "none";
  if (flightState) flightState.style.display = "none";
  if (mapCamControl) mapCamControl.style.display = "none";
  if (cmdBottomContainer) cmdBottomContainer.style.display = "none";

  // refresh table
  if (table) {
    requestAnimationFrame(() => table.onShow());
  }
}

function showGraphView() {
  currentView = "graph";
  csvContainer.style.display = "none";
  if (cmdBottomContainer) cmdBottomContainer.style.display = "flex";
  graphContainer.style.display = "block";
  mapContainer.style.display = "flex";
  mapDiv.style.display = "block";
  if (mapCamControl) mapCamControl.style.display = "block";

  resizeMap();
  resizePlots();
  redrawAllCharts();
}

function resizePlots() {
  try {
    if (is3DMapInitialized) {
      Plotly.Plots.resize(document.getElementById(GNSS_PLOT_ID));
    }
    const hbDiv = document.getElementById(HB_PLOT_ID);
    if (hbDiv && hbDiv.data) Plotly.Plots.resize(hbDiv);
  } catch (err) {
    console.error("Plot resize failed:", err);
  }
}

// ---------- Simulation reset ----------
function resetAllTelemetryData() {
  csvData = [];
  allRows = [];
  count = 0;
  bufferIndex = 0;
  lastRenderedState = null;
  if (table) table.clearData();

  if (is3DMapInitialized) {
    Plotly.restyle(
      GNSS_PLOT_ID,
      {
        x: [xBuffer.subarray(0, 0)],
        y: [yBuffer.subarray(0, 0)],
        z: [zBuffer.subarray(0, 0)],
      },
      [0]
    );
  }

  if (chartInitialized && charts) {
    for (let id in charts) {
      const chart = charts[id];
      if (chart?.data?.datasets) {
        chart.data.datasets.forEach((d) => {
          d.data = [];
        });
        chart.options.scales.x.min = 0;
        chart.options.scales.x.max = MAX_POINTS;
        chart.update("none");
      }
    }
  }

  if (missionTimeEl) missionTimeEl.innerText = "00:00:00";
  if (packetEl) packetEl.innerText = "00";

  [
    sidebarTempEl,
    sidebarVoltageEl,
    sidebarPressureEl,
    sidebarAltitudeEl,
    sidebarVelocityEl,
  ].forEach((el) => {
    if (el) el.innerText = "0";
  });

  if (sidebarTimeToImpactEl) sidebarTimeToImpactEl.innerText = "00";
  if (sidebarHeadingErrorEl) sidebarHeadingErrorEl.innerText = "--";
  if (sidebarGlideRatioEl) sidebarGlideRatioEl.innerText = "--";

  [
    ...sidebarGNSSTimeEls,
    ...sidebarGNSSAltitudeEls,
    ...sidebarGNSSLatitudeEls,
    ...sidebarGNSSLongitudeEls,
    ...sidebarGNSSSatsEls,
  ].forEach((el) => {
    el.innerText = "---";
  });

  RPY_SELECTORS.forEach((selector) => setText(selector, "---"));

  levelDisplays.forEach((levelEl) => {
    const value = levelEl.querySelector(".level-value");
    if (value) value.innerText = "---";
  });

  updateStageIndicators(1);
  try {
    updateHeadingBearing(0, 0);
  } catch (err) {
    console.error("Heading/Bearing reset failed:", err);
  }
}

// ---------- Command UI ----------
function handleButtonStateUI(cmd) {
  if (cxBtn) {
    if (cmd === "CMD,041,CX,ON") {
      cxBtn.textContent = "CXOFF";
      cxBtn.classList.add("btn-active");
      cxBtn.setAttribute("data-cmd", "CMD,041,CX,OFF");
    } else if (cmd === "CMD,041,CX,OFF") {
      cxBtn.textContent = "CXON";
      cxBtn.classList.remove("btn-active");
      cxBtn.setAttribute("data-cmd", "CMD,041,CX,ON");
    }
  }

  if (gyroBtn) {
    if (cmd === "CMD,041,MEC,GYRO,ON") {
      gyroBtn.textContent = "GYRO OFF";
      gyroBtn.classList.add("btn-active");
      gyroBtn.setAttribute("data-cmd", "CMD,041,MEC,GYRO,OFF");
    } else if (cmd === "CMD,041,MEC,GYRO,OFF") {
      gyroBtn.textContent = "GYRO ON";
      gyroBtn.classList.remove("btn-active");
      gyroBtn.setAttribute("data-cmd", "CMD,041,MEC,GYRO,ON");
    }
  }

  if (servoBtn) {
    if (cmd === "CMD,041,MEC,SERVO,ON") {
      servoBtn.textContent = "SERVO OFF";
      servoBtn.classList.add("btn-active");
      servoBtn.setAttribute("data-cmd", "CMD,041,MEC,SERVO,OFF");
    } else if (cmd === "CMD,041,MEC,SERVO,OFF") {
      servoBtn.textContent = "SERVO ON";
      servoBtn.classList.remove("btn-active");
      servoBtn.setAttribute("data-cmd", "CMD,041,MEC,SERVO,ON");
    }
  }
}

function addCommandEcho(cmd) {
  if (!cmdEchoList) return;
  const div = document.createElement("div");
  div.className = "cmd-echo-item";
  const currentTime = new Date().toTimeString().slice(0, 8);
  div.textContent = `[${currentTime}] ${cmd}`;
  cmdEchoList.replaceChildren(div);
}

document.querySelectorAll(".cmd-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const commandToFill = button.getAttribute("data-cmd");
    if (commandInput) {
      commandInput.value = commandToFill;
      commandInput.focus();
    }
  });
});

if (commandInput) {
  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (sendBtn) sendBtn.click();
    }
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", () => {
    const command = commandInput.value.trim().toUpperCase();
    if (!command) return;

    //addCommandEcho(command);
    socket.emit("send-command", command);

    commandInput.value = "";
    commandInput.focus();
  });
}

// ---------- Navigation buttons ----------
csvBtn.addEventListener("click", () => {
  setActiveButton(csvBtn);
  showCSVView();
});

homeBtn.addEventListener("click", () => {
  setActiveButton(homeBtn);
  showSidebarContent();
  showGraphView();
});

graphBtn.addEventListener("click", () => {
  setActiveButton(graphBtn);
  showSidebarContent();
  showGraphView();
  graphContainer.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---------- 3D GNSS plot builder ----------
function init3DMap() {
  const woodMain = "#ffffff",
    woodDarkText = "#131313",
    woodPath = "#4c2e7d";

  const axisStyle = (text, extraFont = {}) => ({
    title: { text, font: { color: woodDarkText, weight: "bold", ...extraFont } },
    backgroundcolor: woodMain,
    gridcolor: woodDarkText,
    showbackground: true,
    tickfont: { color: woodDarkText },
  });

  const layout = {
    hovermode: false,
    autosize: true,
    margin: { l: 0, r: 0, b: 50, t: 0, pad: 0 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "white",
    scene: {
      aspectmode: "manual",
      aspectratio: { x: 1.0, y: 1.0, z: 2.0 },
      bgcolor: woodMain,
      showbackground: false,
      camera: {
        eye: { x: 2.0, y: -2.0, z: 1.7 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1.0 },
      },
      xaxis: axisStyle("GNSS_LAT"),
      yaxis: axisStyle("GNSS_LON"),
      zaxis: axisStyle("GNSS_ALT", { size: 16 }),
    },
    font: { family: "monospace", size: 13, color: woodDarkText },
    showlegend: false,
  };

  const trace = {
    type: "scatter3d",
    mode: "lines",
    name: "Flight Path",
    x: xBuffer.subarray(0, 0),
    y: yBuffer.subarray(0, 0),
    z: zBuffer.subarray(0, 0),
    line: { width: 6, color: woodPath, dash: "solid" },
  };

  Plotly.newPlot(GNSS_PLOT_ID, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  });
  is3DMapInitialized = true;
}

// ---------- Chart.js graph builder ----------
function loadGraphs() {
  if (chartInitialized) return;

  graphContainer.innerHTML = `
    <div class="telemtry-data-container-graph" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      ${GRAPH_LAYOUT.map(
    (g) => `
        <div class="telemetry-grid-item">
          <canvas id="${g.id}_chart"></canvas>
        </div>`
  ).join("")}
    </div>`;

  charts = {};

  const sharedOptions = {
    parsing: false,
    spanGaps: true,
    normalized: true,
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    elements: { line: { tension: 0.3 } },
    plugins: {
      title: {
        display: true,
        color: "#1a1a1a",
        font: { weight: "bold", size: 16 },
        padding: { top: 10, bottom: 10 },
      },
      legend: {
        labels: { color: "#1a1a1a", font: { weight: "bold", size: 16 } },
      },
    },
    scales: {
      x: {
        type: "linear",
        title: {
          display: true,
          text: "Packet Count",
          color: "#1a1a1a",
          font: { weight: "bold", size: 16 },
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        title: { display: true, color: "#1a1a1a", font: { weight: "bold", size: 16 } },
        grid: { color: "rgba(0,0,0,0.05)" },
      },
    },
  };

  const getGradient = (ctx, color) => {
    const g = ctx.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, color.replace("1)", "0.4)"));
    g.addColorStop(1, "rgba(255,255,255,0)");
    return g;
  };

  GRAPH_LAYOUT.forEach((graph) => {
    const canvas = document.getElementById(`${graph.id}_chart`);
    const ctx = canvas.getContext("2d");
    const unit = UNIT_MAP[graph.units] ? ` (${UNIT_MAP[graph.units]})` : "";
    let datasets;

    if (graph.combined) {
      const colors = [
        "rgba(250,17,67,1)",
        "rgba(0,129,215,1)",
        "rgba(28,93,2,1)",
      ];
      datasets = graph.combined.map((label, i) => ({
        label: label.replace("_", " "),   // "GYRO P", "GYRO R", "GYRO Y"
        data: [],
        borderColor: colors[i],
        backgroundColor: getGradient(ctx, colors[i]),
        fill: true,
        borderWidth: 2,
      }));
    } else {
      datasets = [
        {
          label: graph.title,
          data: [],
          borderColor: "#4a8a9a",
          backgroundColor: getGradient(ctx, "rgba(74,138,154,1)"),
          fill: true,
          borderWidth: 3,
        },
      ];
    }

    charts[graph.id] = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        ...sharedOptions,
        plugins: {
          ...sharedOptions.plugins,
          title: { ...sharedOptions.plugins.title, text: graph.title },
          legend: { display: !!graph.combined },
        },
        scales: {
          ...sharedOptions.scales,
          y: {
            ...sharedOptions.scales.y,
            ticks: { color: "#000000" },
            title: {
              ...sharedOptions.scales.y.title,
              display: true,
              color: "#000000",
              text: `${graph.title}${unit}`,
            },
          },
        },
      },
    });
  });

  allRows.forEach((row) => updateGraphs(row));
  chartInitialized = true;
}

// ---------- Global listeners ----------
window.addEventListener("resize", resizePlots);

document.addEventListener("keydown", (event) => {
  if (event.key === "/" || event.key === "c") {
    if (commandInput && document.activeElement !== commandInput) {
      event.preventDefault();
      commandInput.focus();
    }
  }
  if (event.key === "ArrowUp") window.scrollBy(0, -50);
  if (event.key === "ArrowDown") window.scrollBy(0, 50);
});