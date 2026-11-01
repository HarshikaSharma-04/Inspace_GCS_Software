// Displays live gyro-based CanSat tilt; integrate once with initTilt(socket) in telemetry.js.
// Background = #6750a4, font = monospace.
/*
const CANSAT_IMG = "../images/model.png";
const FONT_FAMILY = 'monospace';

let pitch = 0;
let yaw = 0;
let lastTimestamp = null;
let lastPacketCount = null;
let cansatImage = null;
let pitchReadout = null;
let yawReadout = null;

// colors for the #6750a4 background
const C = {
  bg: "#e9e6ff",
  text: "#070707",
  line: "rgb(0, 2, 74)",
};

function renderTilt() {
  if (!cansatImage || !pitchReadout || !yawReadout) {
    return;
  }

  const normalizedYaw = ((yaw % 360) + 360) % 360;
  cansatImage.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
  pitchReadout.textContent = `Pitch: ${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}°`;
  yawReadout.textContent = `Yaw: ${normalizedYaw.toFixed(1)}°`;
}

export function resetTilt() {
  //roll = 0;
  pitch = 0;
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

  const gyroPitch = parseNumber(row.GYRO_P);
  const gyroYaw = parseNumber(row.GYRO_Y);
  if (gyroPitch === null || gyroYaw === null) {
    return;
  }

  pitch += gyroPitch * dt;
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
        background: ${C.bg} !important;
        color: ${C.text};
        font-family: ${FONT_FAMILY};
      }
      .tilt-container .telemetry-panel-heading {
        color: ${C.text};
        font-family: ${FONT_FAMILY};
      }
      .tilt-container .tilt-ref {
        position: absolute;
        top: 60px;
        bottom: 50px;
        left: 50%;
        border-left: 1px dashed ${C.line};
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
        color: ${C.text};
        font-family: ${FONT_FAMILY};
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
  pitchReadout = document.createElement("span");
  pitchReadout.className = "tilt-pitch";
  yawReadout = document.createElement("span");
  yawReadout.className = "tilt-yaw";
  readout.append(pitchReadout, yawReadout);

  container.append(referenceLine, stage, readout);
  renderTilt();

  socket.on("telemetry-update", updateTilt);
  socket.on("clear-data", resetTilt);
}*/

// Telemetry 3D CanSat Visualizer (Three.js): Pitch + Roll.
// Integrate once with initTilt(socket) in telemetry.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ---------- Config ----------
const CANSAT_MODEL_URL = "../images/model_2.glb";
const DRACO_DECODER_PATH = "/draco/";
const FONT_FAMILY = "monospace";
const MAX_PIXEL_RATIO = 2;
const TARGET_MODEL_SIZE = 3.0;
const SMOOTHING = 8;
const EPSILON = 0.0005;
const PITCH_CLAMP = 60;

const C = {
  bgHex: "#ffffff",
  bgCss: "#ffffff",
  text: "#070707",
  line: "rgb(0, 2, 74)",
  pitchColor: "#cc3333",
  rollColor: "#3366cc",
};

// ---------- State ----------
let pitch = 0;
let roll = 0;
let lastPacketCount = null;

let pitchReadout = null;
let rollReadout = null;
let lastPitchText = "";
let lastRollText = "";

let scene, camera, renderer, pivot, cansatModel;
let stageEl = null;
let resizeObserver = null;
let intersectionObserver = null;
let socketRef = null;

let rafId = null;
let lastFrameTime = null;
let isVisible = true;
let disposed = true;

const targetQuat = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, "YXZ"); // roll (Y, model's long axis) -> pitch (X)

const D2R = Math.PI / 180;

function requestRender() {
  if (rafId === null && !disposed) {
    rafId = requestAnimationFrame(frame);
  }
}

function frame(now) {
  rafId = null;
  if (disposed || !renderer) return;

  if (!isVisible || document.hidden) {
    lastFrameTime = null;
    return;
  }

  const dt = lastFrameTime === null
    ? 1 / 60
    : Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;

  let converging = false;
  if (pivot) {
    if (pivot.quaternion.angleTo(targetQuat) > EPSILON) {
      pivot.quaternion.slerp(targetQuat, 1 - Math.exp(-SMOOTHING * dt));
      converging = true;
    } else {
      pivot.quaternion.copy(targetQuat);
    }
  }

  renderer.render(scene, camera);

  if (converging) {
    requestRender();
  } else {
    lastFrameTime = null;
  }
}

function updateTarget() {
  const clampedPitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch));
  // Euler(x = pitch, y = roll, z = 0), order YXZ
  euler.set(clampedPitch * D2R, roll * D2R, 0, "YXZ");
  targetQuat.setFromEuler(euler);
}

function updateReadouts() {
  if (!pitchReadout || !rollReadout) return;
  const normalizedRoll = ((roll % 360) + 360) % 360;
  const p = `Pitch: ${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}°`;
  const r = `Roll: ${normalizedRoll.toFixed(1)}°`;
  if (p !== lastPitchText) {
    pitchReadout.textContent = p;
    lastPitchText = p;
  }
  if (r !== lastRollText) {
    rollReadout.textContent = r;
    lastRollText = r;
  }
}

function renderTilt() {
  updateTarget();
  updateReadouts();
  requestRender();
}

export function resetTilt() {
  pitch = 0;
  roll = 0;
  lastPacketCount = null;
  updateTarget();
  if (pivot) pivot.quaternion.copy(targetQuat);
  updateReadouts();
  requestRender();
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

function updateTilt(row) {
  if (!row || typeof row !== "object") return;

  const packetCount = parseNumber(row.PACKET_COUNT);
  if (
    packetCount !== null &&
    lastPacketCount !== null &&
    packetCount < lastPacketCount
  ) {
    resetTilt();
  }
  if (packetCount !== null) lastPacketCount = packetCount;

  // Backend field names: TILT_PITCH and TILT_ROLL (degrees).
  // Falls back to TILT_YAW so an un-renamed backend keeps working.
  const tiltPitch = parseNumber(row.TILT_PITCH);
  const tiltRoll = parseNumber(row.TILT_ROLL ?? row.TILT_YAW);

  if (tiltPitch === null || tiltRoll === null) return;

  pitch = tiltPitch;
  roll = tiltRoll;

  renderTilt();
}

// ---------- Three.js setup ----------
function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const key in m) {
          const v = m[key];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    }
  });
}

function resize() {
  if (!stageEl || !renderer || !camera) return;
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  requestRender();
}

function initThreeStage(stageContainer) {
  stageEl = stageContainer;
  const width = stageContainer.clientWidth || 300;
  const height = stageContainer.clientHeight || 300;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bgHex);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  // const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  // dirLight.position.set(5, 10, 7.5);
  // scene.add(dirLight);
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainLight.position.set(5, 10, 7.5);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x90caf9, 0.5); // Soft blue rim light
  fillLight.position.set(-5, -5, -5);
  scene.add(fillLight);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  stageContainer.appendChild(renderer.domElement);

  pivot = new THREE.Group();
  scene.add(pivot);

  // --- Axis reference lines (fixed in scene) ---
  const AXIS_LEN = 3.5;
  const dashSize = 0.08;
  const gapSize = 0.08;

  // Roll axis: vertical dashed line (Y, the CanSat's long axis)
  const rollGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -AXIS_LEN, 0),
    new THREE.Vector3(0, AXIS_LEN, 0),
  ]);
  const rollLine = new THREE.Line(
    rollGeo,
    new THREE.LineDashedMaterial({ color: 0x3366cc, dashSize, gapSize })
  );
  rollLine.computeLineDistances();
  scene.add(rollLine);

  // Pitch axis: horizontal dashed line (X)
  const pitchGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-AXIS_LEN, 0, 0),
    new THREE.Vector3(AXIS_LEN, 0, 0),
  ]);
  const pitchLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-AXIS_LEN, 0, 0),
      new THREE.Vector3(AXIS_LEN, 0, 0),
    ]),
    new THREE.LineDashedMaterial({ color: 0xdc2626, dashSize, gapSize, opacity: 0.5, transparent: true })
  );
  pitchLine.computeLineDistances();
  scene.add(pitchLine);

  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  loader.load(
    CANSAT_MODEL_URL,
    (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene);
        draco.dispose();
        return;
      }
      cansatModel = gltf.scene;

      const box = new THREE.Box3().setFromObject(cansatModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = TARGET_MODEL_SIZE / maxDim;

      cansatModel.scale.setScalar(scale);


      cansatModel.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      pivot.position.set(0, 0, 0);

      pivot.add(cansatModel);
      pivot.quaternion.copy(targetQuat);
      draco.dispose();
      requestRender();
    },
    undefined,
    (error) => console.error("Error loading CanSat 3D model:", error)
  );

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stageContainer);

  intersectionObserver = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible) requestRender();
  });
  intersectionObserver.observe(stageContainer);

  document.addEventListener("visibilitychange", onVisibilityChange);
}

function onVisibilityChange() {
  if (!document.hidden) requestRender();
}

export function initTilt(socket) {
  const container = document.querySelector(".tilt-container");
  if (!container) return;

  if (!disposed) destroyTilt();
  disposed = false;

  if (!document.getElementById("tilt-visualization-styles")) {
    const style = document.createElement("style");
    style.id = "tilt-visualization-styles";
    style.textContent = `
      .tilt-container {
        position: relative;
        overflow: hidden;
        background: ${C.bgCss} !important;
        color: ${C.text};
        font-family: ${FONT_FAMILY};
      }
      .tilt-container .tilt-legend {
        position: absolute;
        top: 36px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
        font-size: 11px;
        font-family: ${FONT_FAMILY};
        font-weight: 600;
        z-index: 2;
        pointer-events: none;
      }
      .tilt-container .tilt-legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #444444;
      }
      .tilt-container .tilt-legend-line {
        display: inline-block;
        width: 16px;
        height: 0;
        border-top: 2px dashed;
      }
      .tilt-container .tilt-legend-line--pitch { border-color: ${C.pitchColor}; }
      .tilt-container .tilt-legend-line--roll  { border-color: ${C.rollColor}; }
      .tilt-container .tilt-stage {
        position: absolute;
        left: 0;
        right: 0;
        top: 55px;
        bottom: 45px;
      }
      .tilt-container .tilt-readout {
        position: absolute;
        bottom: 12px;
        width: 100%;
        display: flex;
        justify-content: space-around;
        font-family: ${FONT_FAMILY};
        font-weight: bold;
        z-index: 2;
      }
      .tilt-container .tilt-readout-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .tilt-container .tilt-readout-item--pitch { color: ${C.pitchColor}; }
      .tilt-container .tilt-readout-item--roll  { color: ${C.rollColor}; }
    `;
    document.head.appendChild(style);
  }

  // Legend
  const legend = document.createElement("div");
  legend.className = "tilt-legend";

  const pitchLegend = document.createElement("span");
  pitchLegend.className = "tilt-legend-item";
  const pitchLegendLine = document.createElement("span");
  pitchLegendLine.className = "tilt-legend-line tilt-legend-line--pitch";
  pitchLegend.append(pitchLegendLine, document.createTextNode("Pitch (Horizontal)"));

  const rollLegend = document.createElement("span");
  rollLegend.className = "tilt-legend-item";
  const rollLegendLine = document.createElement("span");
  rollLegendLine.className = "tilt-legend-line tilt-legend-line--roll";
  rollLegend.append(rollLegendLine, document.createTextNode("Roll (Vertical)"));

  legend.append(pitchLegend, rollLegend);

  const stage = document.createElement("div");
  stage.className = "tilt-stage";

  // Readouts
  const readout = document.createElement("div");
  readout.className = "tilt-readout";

  const pitchItem = document.createElement("div");
  pitchItem.className = "tilt-readout-item tilt-readout-item--pitch";
  const pitchSwatch = document.createElement("span");
  pitchSwatch.className = "tilt-legend-line tilt-legend-line--pitch";
  pitchReadout = document.createElement("span");
  pitchReadout.className = "tilt-pitch";
  pitchItem.append(pitchSwatch, pitchReadout);

  const rollItem = document.createElement("div");
  rollItem.className = "tilt-readout-item tilt-readout-item--roll";
  const rollSwatch = document.createElement("span");
  rollSwatch.className = "tilt-legend-line tilt-legend-line--roll";
  rollReadout = document.createElement("span");
  rollReadout.className = "tilt-roll";
  rollItem.append(rollSwatch, rollReadout);

  readout.append(pitchItem, rollItem);

  container.append(legend, stage, readout);

  initThreeStage(stage);
  updateTarget();
  updateReadouts();
  requestRender();

  socketRef = socket;
  socket.on("telemetry-update", updateTilt);
  socket.on("clear-data", resetTilt);
}

export function destroyTilt() {
  disposed = true;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastFrameTime = null;

  if (socketRef) {
    socketRef.off("telemetry-update", updateTilt);
    socketRef.off("clear-data", resetTilt);
    socketRef = null;
  }

  document.removeEventListener("visibilitychange", onVisibilityChange);
  if (resizeObserver) resizeObserver.disconnect();
  if (intersectionObserver) intersectionObserver.disconnect();
  resizeObserver = intersectionObserver = null;

  if (scene) disposeObject(scene);
  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  const container = document.querySelector(".tilt-container");
  if (container) {
    container.querySelector(".tilt-legend")?.remove();
    container.querySelector(".tilt-stage")?.remove();
    container.querySelector(".tilt-readout")?.remove();
  }

  scene = camera = renderer = pivot = cansatModel = null;
  stageEl = pitchReadout = rollReadout = null;
  lastPitchText = lastRollText = "";
}