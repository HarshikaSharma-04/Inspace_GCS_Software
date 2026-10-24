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


// Telemetry 3D CanSat Visualizer (Three.js), optimized.
// Integrate once with initTilt(socket) in telemetry.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ---------- Config ----------
const CANSAT_MODEL_URL = "../images/model_2.glb";
// Only fetched if the .glb is Draco-compressed. Copy
// node_modules/three/examples/jsm/libs/draco/ into your static folder.
const DRACO_DECODER_PATH = "/draco/";
const FONT_FAMILY = "monospace";
const MAX_PIXEL_RATIO = 2;      // caps GPU load on 3x displays
const TARGET_MODEL_SIZE = 2.0;  // model's largest dimension in scene units
const SMOOTHING = 8;            // higher = snappier, lower = smoother
const EPSILON = 0.0005;         // radians; below this we stop animating
const PITCH_CLAMP = 60;         // max visual pitch in degrees (readout still shows real value)

const C = {
  bgHex: "#ffffff",
  bgCss: "#ffffff",
  text: "#070707",
  line: "rgb(0, 2, 74)",
  pitchColor: "#cc3333",
  yawColor: "#3366cc",
};

// ---------- State ----------
let pitch = 0;
let yaw = 0;
let lastPacketCount = null;

let pitchReadout = null;
let yawReadout = null;
let lastPitchText = "";
let lastYawText = "";

let scene, camera, renderer, pivot, cansatModel;
let stageEl = null;
let resizeObserver = null;
let intersectionObserver = null;
let socketRef = null;

let rafId = null;
let lastFrameTime = null;
let isVisible = true;
let disposed = true;

// Reused objects (avoid per-frame allocations)
const targetQuat = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, "YXZ"); // yaw -> pitch (no roll)

const D2R = Math.PI / 180;


function requestRender() {
  if (rafId === null && !disposed) {
    rafId = requestAnimationFrame(frame);
  }
}

function frame(now) {
  rafId = null;
  if (disposed || !renderer) return;

  // Paused while hidden; resumes via visibility/intersection handlers
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
      // Frame-rate independent exponential smoothing
      pivot.quaternion.slerp(targetQuat, 1 - Math.exp(-SMOOTHING * dt));
      converging = true;
    } else {
      pivot.quaternion.copy(targetQuat);
    }
  }

  renderer.render(scene, camera);

  if (converging) {
    requestRender();   // keep animating until settled
  } else {
    lastFrameTime = null; // idle: no loop running until next packet
  }
}

function updateTarget() {
  // Clamp visual pitch so the model stays in the viewport;
  // the text readout still displays the real unclamped value.
  const clampedPitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch));
  euler.set(clampedPitch * D2R, yaw * D2R, 0, "YXZ");
  targetQuat.setFromEuler(euler);
}

function updateReadouts() {
  if (!pitchReadout || !yawReadout) return;
  const normalizedYaw = ((yaw % 360) + 360) % 360;
  const p = `Pitch: ${pitch >= 0 ? "+" : ""}${pitch.toFixed(1)}°`;
  const y = `Yaw: ${normalizedYaw.toFixed(1)}°`;
  // Only touch the DOM when text actually changed
  if (p !== lastPitchText) {
    pitchReadout.textContent = p;
    lastPitchText = p;
  }
  if (y !== lastYawText) {
    yawReadout.textContent = y;
    lastYawText = y;
  }
}

function renderTilt() {
  updateTarget();
  updateReadouts();
  requestRender();
}

export function resetTilt() {
  pitch = 0;
  yaw = 0;
  lastPacketCount = null;
  updateTarget();
  if (pivot) pivot.quaternion.copy(targetQuat); // snap back, no long sweep
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

function parseTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds;
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

  // Use pre-computed degree values from backend
  const tiltPitch = parseNumber(row.TILT_PITCH);
  const tiltYaw = parseNumber(row.TILT_YAW);

  if (tiltPitch === null || tiltYaw === null) return;

  pitch = tiltPitch;
  yaw = tiltYaw;

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

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

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

  // Pivot group rotates; the model inside is centered, so it spins
  // around its true center.
  pivot = new THREE.Group();
  scene.add(pivot);

  // --- Axis reference lines (fixed in scene, don't rotate with model) ---
  const AXIS_LEN = 4; // half-length of each line
  const dashSize = 0.15;
  const gapSize = 0.1;

  // Yaw axis — vertical dashed line (Y)
  const yawGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -AXIS_LEN, 0),
    new THREE.Vector3(0, AXIS_LEN, 0),
  ]);
  const yawLine = new THREE.Line(
    yawGeo,
    new THREE.LineDashedMaterial({ color: 0x3366cc, dashSize, gapSize, linewidth: 1 })
  );
  yawLine.computeLineDistances();
  scene.add(yawLine);

  // Pitch axis — horizontal dashed line (X)
  const pitchGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-AXIS_LEN, 0, 0),
    new THREE.Vector3(AXIS_LEN, 0, 0),
  ]);
  const pitchLine = new THREE.Line(
    pitchGeo,
    new THREE.LineDashedMaterial({ color: 0xcc3333, dashSize, gapSize, linewidth: 1 })
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
      // Anchor the pivot at the TOP of the model (pendulum style).
      // 1. Inside the pivot: offset the model so its top aligns with pivot origin (0,0,0).
      const scaledMaxY = box.max.y * scale;
      const scaledMinY = box.min.y * scale;
      const scaledCenterX = center.x * scale;
      const scaledCenterZ = center.z * scale;
      cansatModel.position.set(-scaledCenterX, -scaledMaxY, -scaledCenterZ);

      // 2. Move the pivot group down so the model stays centered in the viewport.
      //    The model now spans from y=0 (top) to y=-(scaledMaxY-scaledMinY) (bottom)
      //    inside the pivot. Shifting pivot down by half the height centers it on screen.
      const modelHeight = scaledMaxY - scaledMinY;
      pivot.position.set(0, modelHeight / 2, 0);

      pivot.add(cansatModel);
      pivot.quaternion.copy(targetQuat); // apply any telemetry received while loading
      draco.dispose(); // free decoder workers once loaded
      requestRender();
    },
    undefined,
    (error) => console.error("Error loading CanSat 3D model:", error)
  );

  // Resize: one observer covers window resizes and panel layout changes
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stageContainer);

  // Pause when scrolled off-screen
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

  if (!disposed) destroyTilt(); // guard against double init
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
      .tilt-container .tilt-legend-line--pitch {
        border-color: ${C.pitchColor};
      }
      .tilt-container .tilt-legend-line--yaw {
        border-color: ${C.yawColor};
      }
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
      .tilt-container .tilt-readout-item--pitch {
        color: ${C.pitchColor};
      }
      .tilt-container .tilt-readout-item--yaw {
        color: ${C.yawColor};
      }
    `;
    document.head.appendChild(style);
  }

  const legend = document.createElement("div");
  legend.className = "tilt-legend";

  const pitchLegend = document.createElement("span");
  pitchLegend.className = "tilt-legend-item";
  const pitchLegendLine = document.createElement("span");
  pitchLegendLine.className = "tilt-legend-line tilt-legend-line--pitch";
  pitchLegend.append(pitchLegendLine, document.createTextNode("Pitch (Horizontal)"));

  const yawLegend = document.createElement("span");
  yawLegend.className = "tilt-legend-item";
  const yawLegendLine = document.createElement("span");
  yawLegendLine.className = "tilt-legend-line tilt-legend-line--yaw";
  yawLegend.append(yawLegendLine, document.createTextNode("Yaw (Vertical)"));

  legend.append(pitchLegend, yawLegend);

  const stage = document.createElement("div");
  stage.className = "tilt-stage";

  const readout = document.createElement("div");
  readout.className = "tilt-readout";

  const pitchItem = document.createElement("div");
  pitchItem.className = "tilt-readout-item tilt-readout-item--pitch";
  const pitchSwatch = document.createElement("span");
  pitchSwatch.className = "tilt-legend-line tilt-legend-line--pitch";
  pitchReadout = document.createElement("span");
  pitchReadout.className = "tilt-pitch";
  pitchItem.append(pitchSwatch, pitchReadout);

  const yawItem = document.createElement("div");
  yawItem.className = "tilt-readout-item tilt-readout-item--yaw";
  const yawSwatch = document.createElement("span");
  yawSwatch.className = "tilt-legend-line tilt-legend-line--yaw";
  yawReadout = document.createElement("span");
  yawReadout.className = "tilt-yaw";
  yawItem.append(yawSwatch, yawReadout);

  readout.append(pitchItem, yawItem);

  container.append(legend, stage, readout);

  initThreeStage(stage);
  updateTarget();
  updateReadouts();
  requestRender();

  socketRef = socket;
  socket.on("telemetry-update", updateTilt);
  socket.on("clear-data", resetTilt);
}

// Call if the panel is ever removed, to free GPU memory and listeners.
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
    container.querySelector(".tilt-ref")?.remove();
    container.querySelector(".tilt-stage")?.remove();
    container.querySelector(".tilt-readout")?.remove();
  }

  scene = camera = renderer = pivot = cansatModel = null;
  stageEl = pitchReadout = yawReadout = null;
  lastPitchText = lastYawText = "";
}