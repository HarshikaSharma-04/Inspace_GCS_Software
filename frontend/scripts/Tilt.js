// Displays live gyro-based CanSat tilt; integrate once with initTilt(socket) in telemetry.js.
const CANSAT_IMG = "../images/cansat.png";

let roll = 0;
let yaw = 0;
let lastTimestamp = null;
let lastPacketCount = null;
let cansatImage = null;
let rollReadout = null;
let yawReadout = null;

function renderTilt() {
  if (!cansatImage || !rollReadout || !yawReadout) {
    return;
  }

  const normalizedYaw = ((yaw % 360) + 360) % 360;
  cansatImage.style.transform = `rotateZ(${roll}deg) rotateY(${yaw}deg)`;
  rollReadout.textContent = `Roll: ${roll >= 0 ? "+" : ""}${roll.toFixed(1)}°`;
  yawReadout.textContent = `Yaw: ${normalizedYaw.toFixed(1)}°`;
}

export function resetTilt() {
  roll = 0;
  yaw = 0;
  lastTimestamp = null;
  lastPacketCount = null;
  renderTilt();
}

function parseNumber(value) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function updateTilt(row) {
  if (!row || typeof row !== "object") {
    return;
  }

  const packetCount = parseNumber(row.PACKET_COUNT);
  if (
    packetCount !== null &&
    lastPacketCount !== null &&
    packetCount < lastPacketCount
  ) {
    resetTilt();
  }
  if (packetCount !== null) {
    lastPacketCount = packetCount;
  }

  const timestamp = parseTimestamp(row.TIME_STAMP);
  let dt = timestamp !== null && lastTimestamp !== null
    ? timestamp - lastTimestamp
    : 1;
  if (dt <= 0 || dt > 5) {
    dt = 1;
  }
  lastTimestamp = timestamp;

  const gyroRoll = parseNumber(row.GYRO_R);
  const gyroYaw = parseNumber(row.GYRO_Y);
  if (gyroRoll === null || gyroYaw === null) {
    return;
  }

  roll += gyroRoll * dt;
  yaw += gyroYaw * dt;
  renderTilt();
}

export function initTilt(socket) {
  const container = document.querySelector(".tilt-container");
  if (!container) {
    return;
  }

  if (!document.getElementById("tilt-visualization-styles")) {
    const style = document.createElement("style");
    style.id = "tilt-visualization-styles";
    style.textContent = `
      .tilt-container {
        position: relative;
        overflow: hidden;
      }
      .tilt-container .tilt-ref {
        position: absolute;
        top: 60px;
        bottom: 50px;
        left: 50%;
        border-left: 1px dashed rgba(255, 255, 255, .35);
      }
      .tilt-container .tilt-stage {
        position: absolute;
        left: 0;
        right: 0;
        top: 60px;
        bottom: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        perspective: 700px;
      }
      .tilt-container .tilt-cansat {
        height: 70%;
        width: auto;
        transform-origin: 50% 50%;
        transform-style: preserve-3d;
        transition: transform 0.4s linear;
      }
      .tilt-container .tilt-readout {
        position: absolute;
        bottom: 12px;
        width: 100%;
        display: flex;
        justify-content: space-around;
        color: white;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  }

  const referenceLine = document.createElement("div");
  referenceLine.className = "tilt-ref";

  const stage = document.createElement("div");
  stage.className = "tilt-stage";

  cansatImage = document.createElement("img");
  cansatImage.className = "tilt-cansat";
  cansatImage.src = CANSAT_IMG;
  cansatImage.alt = "CanSat";
  stage.appendChild(cansatImage);

  const readout = document.createElement("div");
  readout.className = "tilt-readout";
  rollReadout = document.createElement("span");
  rollReadout.className = "tilt-roll";
  yawReadout = document.createElement("span");
  yawReadout.className = "tilt-yaw";
  readout.append(rollReadout, yawReadout);

  container.append(referenceLine, stage, readout);
  renderTilt();

  socket.on("telemetry-update", updateTilt);
  socket.on("clear-data", resetTilt);
}
