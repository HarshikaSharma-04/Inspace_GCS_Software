import { Map, resizeMap, updateMapLocation } from "./Map.js";
import CanvasTable from "./canvasTable.js";
// the main line that connects the backend with the frontend
export const socket = io("http://localhost:3000");

// Navigation & Main Containers
const homeBtn = document.querySelector(".telemetry-btn--home");
const graphBtn = document.querySelector(".telemetry-btn--graph");
const csvBtn = document.querySelector(".telemetry-btn--csv");
const graphContainer = document.querySelector(".telemetry-graph-container");
const mapContainer = document.querySelector(".telemetry-map-container");
const csvContainer = document.querySelector(".telemetry-csv-container");
const cmdEchoList = document.getElementById("cmd-echo-list");
const modeValue = document.querySelector(".mode-value");

// Top Dashboard Elements
const missionTimeEl = document.querySelector(".mission-time-value");
const packetEl = document.querySelector(".packet-count-value");

// Sidebar Elements
const sidebar = document.querySelector(".sidebar");
const sidebar3DMap = document.querySelector(".plot-3d-section");
const sidebarTempEl = document.querySelector(".sidebar-temp-value");
const sidebarVoltageEl = document.querySelector(".sidebar-voltage-value");
const sidebarPressureEl = document.querySelector(".sidebar-pressure-value");
const sidebarAltitudeEl = document.querySelector(".sidebar-altitude-value");
// command buttons:
const cxBtn = document.getElementById("btn-cx");
const calBtn = document.getElementById("btn-cal");
const simEnableBtn = document.getElementById("btn-sim-enable");
const simActivateBtn = document.getElementById("btn-sim-activate");
const simDisableBtn = document.getElementById("btn-sim-disable");
const gyroBtn = document.getElementById("btn-gyro");
const servoBtn = document.getElementById("btn-servo");

const mapCamControl = document.querySelector(".map-wrapper")
document.querySelectorAll(".cmd-btn").forEach(button => {
  button.addEventListener("click", () => {
    const commandToFill = button.getAttribute("data-cmd");
    if (commandInput) {
      commandInput.value = commandToFill;
      commandInput.focus();
    }
  });
});


// GNS & Specialized Sidebar Elements
const sidebarGNSSTimeEls = document.querySelectorAll(".sidebar-gnss-time-value");
const sidebarGNSSAltitudeEls = document.querySelectorAll(".sidebar-gnss-altitude-value");
const sidebarGNSSLatitudeEls = document.querySelectorAll(".sidebar-gnss-latitude-value");
const sidebarGNSSLongitudeEls = document.querySelectorAll(".sidebar-gnss-longitude-value");
const sidebarGNSSSatsEls = document.querySelectorAll(".sidebar-gnss-sats-value");
const GNSSContainer = document.querySelector(".gnss-container");

//send button and command input
const sendBtn = document.querySelector(".send-btn");
const commandInput = document.querySelector("#commandInput");

commandInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendBtn.click();
  }
});

function handleButtonStateUI(cmd) {
  if (cmd === "CMD,041,CX,ON") {
    cxBtn.textContent = "CXOFF";
    cxBtn.classList.add("btn-active");
    cxBtn.setAttribute("data-cmd", "CMD,041,CX,OFF");
  } else if (cmd === "CMD,041,CX,OFF") {
    cxBtn.textContent = "CXON";
    cxBtn.classList.remove("btn-active");
    cxBtn.setAttribute("data-cmd", "CMD,041,CX,ON");
  }

  if (cmd === "CMD,041,MEC,GYRO,ON") {
    gyroBtn.textContent = "GYRO OFF";
    gyroBtn.classList.add("btn-active");
    gyroBtn.setAttribute("data-cmd", "CMD,041,MEC,GYRO,OFF");
  } else if (cmd === "CMD,041,MEC,GYRO,OFF") {
    gyroBtn.textContent = "GYRO ON";
    gyroBtn.classList.remove("btn-active");
    gyroBtn.setAttribute("data-cmd", "CMD,041,MEC,GYRO,ON");
  }

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

sendBtn.addEventListener("click", () => {
  const command = commandInput.value.trim();

  if (!command) return;
  //addCommandEcho(command); 
  socket.emit("send-command", command);

  commandInput.value = "";
  commandInput.focus();
});

let commandHistory = [];

function addCommandEcho(cmd) {
  if (!cmdEchoList) return;
  const empty = cmdEchoList.querySelector(".cmd-echo-empty");
  if (empty) empty.remove();
  commandHistory.push(cmd);
  if (commandHistory.length > 3) {
    commandHistory.shift();
  }
  const div = document.createElement("div");
  div.className = "cmd-echo-item";
  div.textContent = cmd;
  cmdEchoList.appendChild(div);
  if (cmdEchoList.children.length > 3) {
    cmdEchoList.removeChild(cmdEchoList.firstElementChild);
  }
}

// Controls & Visuals
const mapDiv =
  document.getElementById("map");
const flightState = document.querySelector(".flight-state-command-section");

// Global Variables
let is3DMapInitialized = false;
let charts = {};
let chartInitialized = false;
let csvData = [];
let MAX_POINTS = 10000;
let allRows = [];
let table;
let count = 0;
let currentView = "graph";
let lastRenderedState = null;
const MAX_BUFFERED_ROWS = 10000;
const telemetryQueue = [];
let telemetryFlushScheduled = false;
const stageBoxes = document.querySelectorAll(".stage-box");
const levelDisplays = document.querySelectorAll(".level-display");

const _CT_COLS = [
  { title: "TEAM_ID", field: "TEAM_ID", w: 60 },
  { title: "TIME", field: "TIME_STAMP", w: 75 },
  { title: "PACKET", field: "PACKET_COUNT", w: 60 },
  { title: "ALTITUDE", field: "ALTITUDE", w: 60 },
  { title: "PRESSURE", field: "PRESSURE", w: 70 },
  { title: "TEMP", field: "TEMPERATURE", w: 55 },
  { title: "VOLTAGE", field: "VOLTAGE", w: 60 },

  { title: "GNSS_TIME", field: "GNSS_TIME", w: 80 },
  { title: "GNSS_LAT", field: "GNSS_LATITUDE", w: 80 },
  { title: "GNSS_LONG", field: "GNSS_LONGITUDE", w: 80 },
  { title: "GNSS_ALT", field: "GNSS_ALTITUDE", w: 75 },
  { title: "GNSS_SATS", field: "GNSS_SATS", w: 65 },

  { title: "ACCEL_R", field: "ACCEL_R", w: 60 },
  { title: "ACCEL_P", field: "ACCEL_P", w: 60 },
  { title: "ACCEL_Y", field: "ACCEL_Y", w: 60 },

  { title: "GYRO_R", field: "GYRO_R", w: 60 },
  { title: "GYRO_P", field: "GYRO_P", w: 60 },
  { title: "GYRO_Y", field: "GYRO_Y", w: 60 },

  { title: "STATE", field: "FLIGHT_SOFTWARE_STATE", w: 110 },
  { title: "CMD", field: "CMD_ECHO", w: 70 }
];
// initialization and default view setup
setActiveButton(homeBtn);
showSidebarContent();
showGraphView();
//loadCSV();

// handling for SIMULATION command
function resetAllTelemetryData() {
  csvData = [];
  allRows = [];
  count = 0;
  lastRenderedState = null;

  if (table) table.clearData();

  if (is3DMapInitialized) {
    Plotly.restyle("gnss-3d-plot", { x: [[]], y: [[]], z: [[]] }, [0]);
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
  ].forEach((el) => {
    if (el) el.innerText = "0";
  });

  [
    ...sidebarGNSSTimeEls,
    ...sidebarGNSSAltitudeEls,
    ...sidebarGNSSLatitudeEls,
    ...sidebarGNSSLongitudeEls,
    ...sidebarGNSSSatsEls,
  ].forEach((el) => {
    el.innerText = "---";
  });

  updateStageIndicators(1);
}
// Simulation state tracking


let simEnabled = false;


socket.on("sim-command-response", (response) => {
  console.log("Simulation Command Response:", response);
  // clear the plots, charts, everything and just add the the new command to echo list
  if (response === "Simulation Mode Started") {
    simEnabled = true;
    modeValue.textContent = "Simulation";
    modeValue.classList.add("simulation");
    resetAllTelemetryData();
  }
});

socket.on("command-success", (verifiedCommand) => {
  handleButtonStateUI(verifiedCommand);
  addCommandEcho(verifiedCommand);
});
socket.on("command-warning", (warningMessage) => {
  if (commandInput) {
    commandInput.value = warningMessage;
    commandInput.style.color = "red";
    commandInput.style.fontWeight = "bold";
    commandInput.style.fontSize = "22px"
    const clearWarning = () => {
      commandInput.value = "";
      commandInput.style.color = "";
      commandInput.style.fontWeight = "";
      commandInput.removeEventListener("focus", clearWarning);
      commandInput.removeEventListener("input", clearWarning);
    };

    commandInput.addEventListener("focus", clearWarning);
    commandInput.addEventListener("input", clearWarning);
  }
});
socket.on("command-response", (response) => {
  switch (response) {
    case "Simulation Enabled":
      simEnabled = true;
      break;

    case "Simulation Started":
      if (simEnabled) {
        modeValue.textContent = "Simulation";
        modeValue.classList.add("simulation");
        resetAllTelemetryData();
      }
      break;

    case "Simulation Stopped":
      simEnabled = false;
      modeValue.textContent = "Flight";
      modeValue.classList.remove("simulation");
      break;
  }
});

// clear data
socket.on("clear-data", () => {
  csvData = [];
  if (chartInitialized && charts) {
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
});

socket.on("telemetry-update", (data) => {
  telemetryQueue.push(data);

  if (!telemetryFlushScheduled) {
    telemetryFlushScheduled = true;
    requestAnimationFrame(flushTelemetryQueue);
  }
});

function flushTelemetryQueue() {
  telemetryFlushScheduled = false;
  if (!telemetryQueue.length) {
    return
  }

  const shouldRenderDashboard = currentView !== "csv";
  const newRows = [];

  while (telemetryQueue.length) {

    const data = telemetryQueue.shift();

    processTelemetryData(
      data,
      shouldRenderDashboard
    );
    console.log(data.FLIGHT_SOFTWARE_STATE);
    console.log(stateToNum(data.FLIGHT_SOFTWARE_STATE));
    updateStageIndicators(stateToNum(data.FLIGHT_SOFTWARE_STATE));

    newRows.push(data);
  }

  if (table && newRows.length > 0) {
    table.blockRedraw();
    table.addData(newRows, false);

    count += newRows.length;

    while (count > 10000) {
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
  if (csvData.length > MAX_BUFFERED_ROWS) {
    csvData.shift();
  }


  allRows.push(data);
  if (allRows.length > MAX_BUFFERED_ROWS) {
    allRows.shift();
  }
  updateTopTelemetry(data);

  if (shouldRenderDashboard) {
    updateTopTelemetry(data);
    updateSidebarTelemetry(data);
  }

  updateGraphs(data);

  if (shouldRenderDashboard) {
    const lat = parseFloat(data["GNSS_LATITUDE"]);
    const lng = parseFloat(data["GNSS_LONGITUDE"]);
    if (!isNaN(lat) && !isNaN(lng)) updateMapLocation(lat, lng);
  }
}

try {
  Map();
} catch (err) {
  console.error("Map initialization failed:", err);
}

try {
  initTabulator();
} catch (err) {
  console.error("Tabulator initialization failed:", err);
}

// hide-unhide functions
function setActiveButton(activeBtn) {
  document
    .querySelectorAll(".page-button")
    .forEach((btn) => btn.classList.remove("active-btn"));
  activeBtn.classList.add("active-btn");
}



function showSidebarContent() {
  if (sidebar) sidebar.style.display = "flex";
  if (sidebar3DMap) sidebar3DMap.style.display = "flex";
  if (GNSSContainer) GNSSContainer.style.display = "flex";
  if (flightState) flightState.style.display = "flex";

  const cmdArea = document.querySelector(".cmd-bottom-container");
  if (cmdArea) cmdArea.style.display = "flex";
}

function showCSVView() {
  currentView = "csv";

  // Show CSV table
  csvContainer.style.display = "block";

  // Hide graphs & map
  graphContainer.style.display = "none";
  mapContainer.style.display = "none";
  mapDiv.style.display = "none";

  // Hide dashboard sections
  if (sidebar) sidebar.style.display = "none";
  if (GNSSContainer) GNSSContainer.style.display = "none";
  if (flightState) flightState.style.display = "none";
  if (mapCamControl) mapCamControl.style.display = "none"
  const cmdArea = document.querySelector(".cmd-bottom-container");
  if (cmdArea) cmdArea.style.display = "none";

  // Refresh table
  if (table) {
    requestAnimationFrame(() => {
      table.onShow();
    });
  }
}
function showGraphView() {
  currentView = "graph";
  csvContainer.style.display = "none";
  graphContainer.style.display = "block";
  mapDiv.style.display = "block";
  if (mapCamControl) mapCamControl.style.display = "block";
  resizeMap();
  if (is3DMapInitialized) {
    Plotly.Plots.resize(document.getElementById("GNSS-3d-plot"));
  }
  redrawAllCharts();
}

// event listeners for navigation buttons
csvBtn.addEventListener("click", () => {
  setActiveButton(csvBtn);
  showCSVView();
  sidebar.style.display = "none";
  const cmdCont = document.querySelector(".command-container");
  if (cmdCont) cmdCont.style.display = "none";
  // loadCSV();
});

homeBtn.addEventListener("click", () => {
  setActiveButton(homeBtn);
  showSidebarContent();
  showGraphView();
  csvContainer.style.display = "none";
});

graphBtn.addEventListener("click", () => {
  setActiveButton(graphBtn);
  showSidebarContent();
  showGraphView();
  csvContainer.style.display = "none";
  graphContainer.scrollIntoView({ behavior: "smooth", block: "start" });
});

function initTabulator() {
  table = new CanvasTable("telemetry-table", _CT_COLS);
  // CanvasTable internally handles auto-scroll via _autoScroll flag based on scroll position
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
  missionTimeEl.innerText = row["TIME_STAMP"];
  document.querySelectorAll(".sidebar-gnss-time-value").forEach(el => {
    el.innerText = row["GNSS_TIME"];
  });
  document.querySelectorAll(".packet-count-value").forEach(el => {
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

function updateSidebarTelemetry(row) {
  if (!row) return;
  const state = row["FLIGHT_SOFTWARE_STATE"];

  levelDisplays.forEach((levelEl) => {
    const s = levelEl.querySelector(".level-value");
    if (s) s.innerText = state;
  });

  if (sidebarTempEl) sidebarTempEl.innerText = row["TEMPERATURE"] + " °C";
  if (sidebarVoltageEl) sidebarVoltageEl.innerText = row["VOLTAGE"] + " V";
  if (sidebarPressureEl) sidebarPressureEl.innerText = row["PRESSURE"] + " Pa";
  if (sidebarAltitudeEl) sidebarAltitudeEl.innerText = row["ALTITUDE"] + " m";

  document.querySelector(".sidebar-gyro-r").innerText = row.GYRO_R;
  document.querySelector(".sidebar-gyro-p").innerText = row.GYRO_P;
  document.querySelector(".sidebar-gyro-y").innerText = row.GYRO_Y;

  document.querySelector(".sidebar-accel-r").innerText = row.ACCEL_R;
  document.querySelector(".sidebar-accel-p").innerText = row.ACCEL_P;
  document.querySelector(".sidebar-accel-y").innerText = row.ACCEL_Y;





  sidebarGNSSTimeEls.forEach((el) => (el.innerText = `${row["GNSS_TIME"]}`));
  sidebarGNSSAltitudeEls.forEach(
    (el) => (el.innerText = `${row["GNSS_ALTITUDE"]} m`),
  );
  sidebarGNSSLatitudeEls.forEach(
    (el) => (el.innerText = `${row["GNSS_LATITUDE"]}°`),
  );
  sidebarGNSSLongitudeEls.forEach(
    (el) => (el.innerText = `${row["GNSS_LONGITUDE"]}°`),
  );
  sidebarGNSSSatsEls.forEach((el) => (el.innerText = row["GNSS_SATS"]));

  update3DMap(row);
}

// 3D plotly map setup
function init3DMap() {
  const woodMain = "#ffffff",
    woodDarkText = "#131313",
    woodPath = "#2E7D32";
  const layout = {
    autosize: true,
    margin: { l: 0, r: 40, b: 40, t: 0 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "white",
    scene: {
      aspectmode: "manual",
      aspectratio: { x: 1.0, y: 0.8, z: 1.5 },
      bgcolor: woodMain,
      camera: {
        eye: { x: 2.0, y: -2.0, z: 1.2 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      },
      xaxis: {
        title: {
          text: "Latitude",
          font: { color: woodDarkText, weight: "bold" },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
      yaxis: {
        title: {
          text: "Longitude",
          font: { color: woodDarkText, weight: "bold" },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
      zaxis: {
        title: {
          text: "Altitude",
          font: { color: woodDarkText, weight: "bold", size: 16 },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
    },
    font: { family: "monospace", size: 14, color: woodDarkText },
    showlegend: false,
  };
  Plotly.newPlot(
    "GNSS-3d-plot",
    [
      {
        type: "scatter3d",
        mode: "lines",
        name: "Flight Path",
        x: [],
        y: [],
        z: [],
        line: { width: 8, color: woodPath },
        hovertemplate:
          "<b>Lat:</b> %{x:.4f}<br><b>Long:</b> %{y:.4f}<br><b>Alt:</b> %{z:.1f}m<extra></extra>",
      },
    ],
    layout,
    { displayModeBar: false, responsive: true },
  );
  is3DMapInitialized = true;
}

function update3DMap(row) {
  const lat = parseFloat(row["GNSS_LATITUDE"]);
  const long = parseFloat(row["GNSS_LONGITUDE"]);
  const alt = parseFloat(row["GNSS_ALTITUDE"]);
  if (isNaN(lat) || isNaN(long) || isNaN(alt)) return;
  if (!is3DMapInitialized) init3DMap();
  Plotly.extendTraces(
    "GNSS-3d-plot",
    { x: [[lat]], y: [[long]], z: [[alt]] },
    [0],
    MAX_POINTS,
  );
}

window.addEventListener("resize", () => {
  try {
    if (is3DMapInitialized) {
      Plotly.Plots.resize(document.getElementById("GNSS-3d-plot"));
    }
  } catch (err) {
    console.error("3D Plot resize failed:", err);
  }
});

// graph logic
const UNIT_MAP = {
  ALTITUDE: "m",
  TEMPERATURE: "°C",
  PRESSURE: "Pa",
  VOLTAGE: "V",
  // CURRENT: "A",
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
    combined: ["ACCEL_P", "ACCEL_R", "ACCEL_Y"],
  },
  {
    id: "GYRO_COMBINED",
    title: "GYRO SPIN RATE",
    units: "GYROSCOPE",
    combined: ["GYRO_P", "GYRO_R", "GYRO_Y"],
  },
  { id: "VOLTAGE", title: "VOLTAGE", units: "VOLTAGE" },
  // { id: "CURRENT", title: "CURRENT", units: "CURRENT" },
];

function loadGraphs() {
  if (chartInitialized) return;

  graphContainer.innerHTML = `
    <div class="telemtry-data-container-graph" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      ${GRAPH_LAYOUT.map(
    (g) => `
        <div class="telemetry-grid-item">
          <canvas id="${g.id}_chart"></canvas>
        </div>`,
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
        label,
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
            title: {
              ...sharedOptions.scales.y.title,
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

function updateGraphs(row) {
  if (!row || !chartInitialized) return;
  const packet = Number(row["PACKET_COUNT"]);

  for (let id in charts) {
    const chart = charts[id];
    const config = GRAPH_LAYOUT.find((g) => g.id === id);

    if (config?.combined) {
      config.combined.forEach((col, i) => {
        chart.data.datasets[i].data.push({ x: packet, y: Number(row[col]) });
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

document.addEventListener("keydown", (event) => {
  if (event.key === "/" || event.key === "c") {
    const input = document.getElementById("commandInput");
    if (document.activeElement !== input) {
      event.preventDefault();
      input.focus();
    }
  }
  if (event.key === "ArrowUp") window.scrollBy(0, -50);
  if (event.key === "ArrowDown") window.scrollBy(0, 50);
});

try {
  if (!chartInitialized) {
    loadGraphs();
  }
} catch (err) {
  console.error("Graph initialization failed:", err);
}

try {
  if (!is3DMapInitialized) {
    init3DMap();
  }
} catch (err) {
  console.error("3D Map initialization failed:", err);
}
