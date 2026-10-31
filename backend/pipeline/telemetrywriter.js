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
  "GYRO_R,GYRO_P,GYRO_Y,MAG_R,MAG_P,MAG_Y,FLIGHT_SOFTWARE_STATE,CMD_ECHO\n";


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
      MAG_R,
      MAG_P,
      MAG_Y,
      FLIGHT_SOFTWARE_STATE,
      CMD_ECHO,
      GLIDE_RATIO,
      HEADING,
      BEARING,
      HEADING_ERROR
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
      MAG_R,
      MAG_P,
      MAG_Y,
      FLIGHT_SOFTWARE_STATE,
      CMD_ECHO,
      GLIDE_RATIO,
      HEADING,
      BEARING,
      HEADING_ERROR
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

// ---------- Gyro rate (°/s) → orientation (°) integration ----------
// Maintains running state; call resetGyroIntegration() on mission reset.
let _gyroPitchDeg = 0;
let _gyroYawDeg = 0;
let _lastGyroTimestamp = null;
let _lastGyroPacketCount = null;

function _parseGyroTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3]);
  if (h > 23 || m > 59 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Integrate GYRO_P and GYRO_Y (°/s) into cumulative TILT_PITCH and TILT_YAW (°).
 * Accepts the full telemetry data object; returns { TILT_PITCH, TILT_YAW }.
 */
function integrateGyroToDegrees(data) {
  if (!data || typeof data !== "object") {
    return { TILT_PITCH: _gyroPitchDeg, TILT_YAW: _gyroYawDeg };
  }

  // Reset accumulators if packet count wraps (new mission)
  const pktCount = data.PACKET_COUNT !== undefined ? Number(data.PACKET_COUNT) : null;
  if (
    pktCount !== null &&
    !isNaN(pktCount) &&
    _lastGyroPacketCount !== null &&
    pktCount < _lastGyroPacketCount
  ) {
    resetGyroIntegration();
  }
  if (pktCount !== null && !isNaN(pktCount)) {
    _lastGyroPacketCount = pktCount;
  }

  // Compute dt from timestamps
  const ts = _parseGyroTimestamp(data.TIME_STAMP);
  let dt = ts !== null && _lastGyroTimestamp !== null ? ts - _lastGyroTimestamp : 1;
  if (dt <= 0 || dt > 5) dt = 1;
  _lastGyroTimestamp = ts;

  // Parse gyro rates
  const gp = data.GYRO_P !== undefined ? Number(data.GYRO_P) : NaN;
  const gy = data.GYRO_Y !== undefined ? Number(data.GYRO_Y) : NaN;

  if (Number.isFinite(gp)) _gyroPitchDeg += gp * dt;
  if (Number.isFinite(gy)) _gyroYawDeg += gy * dt;

  return {
    TILT_PITCH: Math.round(_gyroPitchDeg * 10) / 10,
    TILT_YAW: Math.round(_gyroYawDeg * 10) / 10,
  };
}

function resetGyroIntegration() {
  _gyroPitchDeg = 0;
  _gyroYawDeg = 0;
  _lastGyroTimestamp = null;
  _lastGyroPacketCount = null;
}

module.exports = {
  initTelemetryCSV,
  writeTelemetryRow,
  deleteTelemetryCSV,
  integrateGyroToDegrees,
  resetGyroIntegration,
};