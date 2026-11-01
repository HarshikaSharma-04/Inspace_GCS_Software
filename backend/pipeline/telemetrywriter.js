const { existsSync } = require("fs");
const { writeFile, appendFile, unlink } = require("fs/promises");
const { join } = require("path");


const timestamp = new Date()
  .toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  .replace(/\//g, "-")
  .replace(/, /g, "_")
  .replace(/:/g, "-");

const TARGET_DIR = "./gcs_csv";

// 2. Update the path construction
const TELEMETRY_CSV_PATH = join(
  TARGET_DIR,
  `Team_041_${timestamp}.csv`
);


const CSV_HEADER =
  "TEAM_ID,TIME_STAMP,PACKET_COUNT,ALTITUDE,PRESSURE,TEMPERATURE,VOLTAGE," +
  "GNSS_TIME,GNSS_LATITUDE,GNSS_LONGITUDE,GNSS_ALTITUDE,GNSS_SATS,ACCEL_R,ACCEL_P,ACCEL_Y," +
  "GYRO_R,GYRO_P,GYRO_Y,FLIGHT_SOFTWARE_STATE,CMD_ECHO,GLIDE_RATIO,HEADING,BEARING,HEADING_ERROR,MAG_R,MAG_P,MAG_Y,\n";


async function initTelemetryCSV() {
  try {
    if (!existsSync(TELEMETRY_CSV_PATH)) {
      await writeFile(TELEMETRY_CSV_PATH, CSV_HEADER, "utf8");

      console.log("Telemetry CSV created:");
      console.log(TELEMETRY_CSV_PATH);
    } else {
      console.log("Telemetry CSV already exists.");
    }
  } catch (err) {
    console.error("Failed to initialize telemetry CSV:", err);
  }
}

async function writeTelemetryRow(data) {
  const {
    TEAM_ID,
    TIME_STAMP,
    PACKET_COUNT,
    ALTITUDE,
    PRESSURE,
    TEMPERATURE,
    VOLTAGE,
    GNSS_TIME,
    GNSS_LATITUDE,
    GNSS_LONGITUDE,
    GNSS_ALTITUDE,
    GNSS_SATS,
    ACCEL_R,
    ACCEL_P,
    ACCEL_Y,
    GYRO_R,
    GYRO_P,
    GYRO_Y,
    FLIGHT_SOFTWARE_STATE,
    CMD_ECHO,
    GLIDE_RATIO,
    HEADING,
    BEARING,
    HEADING_ERROR,
    MAG_R,
    MAG_P,
    MAG_Y,
  } = data;

  // Create CSV row
  const row =
    [
      TEAM_ID,
      TIME_STAMP,
      PACKET_COUNT,
      ALTITUDE,
      PRESSURE,
      TEMPERATURE,
      VOLTAGE,
      GNSS_TIME,
      GNSS_LATITUDE,
      GNSS_LONGITUDE,
      GNSS_ALTITUDE,
      GNSS_SATS,
      ACCEL_R,
      ACCEL_P,
      ACCEL_Y,
      GYRO_R,
      GYRO_P,
      GYRO_Y,
      FLIGHT_SOFTWARE_STATE,
      CMD_ECHO,
      GLIDE_RATIO,
      HEADING,
      BEARING,
      HEADING_ERROR,
      MAG_R,
      MAG_P,
      MAG_Y,
    ].join(",") + "\n";

  try {
    // Non-blocking append
    await appendFile(TELEMETRY_CSV_PATH, row, "utf8");
  } catch (err) {
    console.error("Failed to write telemetry row:", err);
  }
}

async function deleteTelemetryCSV() {
  try {
    if (existsSync(TELEMETRY_CSV_PATH)) {
      await unlink(TELEMETRY_CSV_PATH);

      console.log("Telemetry CSV deleted.");
    } else {
      console.warn("Telemetry CSV not found.");
    }
  } catch (err) {
    console.error("Failed to delete telemetry CSV:", err);
  }
}

// ---------- Accelerometer vector → absolute orientation (°) ----------
// State variables must persist between telemetry packets
// Inside pipeline/telemetrywriter.js

let previousPitch = 0;
let previousRoll = 0;
let lastTimestamp = null;

const ALPHA = 0.98;

function calculateFusedTilt(data, currentTimestampMs = Date.now()) {
  if (!data || typeof data !== "object") return null;

  // Convert incoming string telemetry values to numbers
  const accelR = Number(data.ACCEL_R);
  const accelP = Number(data.ACCEL_P);
  const accelY = Number(data.ACCEL_Y);
  const gyroR = Number(data.GYRO_R);
  const gyroP = Number(data.GYRO_P);

  // Validate numeric values
  if ([accelR, accelP, accelY, gyroR, gyroP].some((v) => !Number.isFinite(v))) {
    return null;
  }

  // Calculate delta time (dt) in seconds
  if (lastTimestamp === null) {
    lastTimestamp = currentTimestampMs;
  }

  let dt = (currentTimestampMs - lastTimestamp) / 1000.0;
  // Guard against initial timestamp jumps or paused connections
  if (dt <= 0 || dt > 5) dt = 1.0;
  lastTimestamp = currentTimestampMs;

  const radiansToDegrees = 180 / Math.PI;

  // 1. Calculate absolute angles from Accelerometer
  const accelPitch = Math.atan2(-accelR, Math.hypot(accelP, accelY)) * radiansToDegrees;
  const accelRoll = Math.atan2(accelP, accelY) * radiansToDegrees;

  // 2. Apply Complementary Filter
  const pitch = ALPHA * (previousPitch + gyroP * dt) + (1 - ALPHA) * accelPitch;
  const roll = ALPHA * (previousRoll + gyroR * dt) + (1 - ALPHA) * accelRoll;

  previousPitch = pitch;
  previousRoll = roll;

  return {
    TILT_PITCH: Math.round(pitch * 10) / 10 || 0,
    TILT_ROLL: Math.round(roll * 10) / 10 || 0,
  };
}


module.exports = {
  initTelemetryCSV,
  writeTelemetryRow,
  deleteTelemetryCSV,
  calculateFusedTilt,
};