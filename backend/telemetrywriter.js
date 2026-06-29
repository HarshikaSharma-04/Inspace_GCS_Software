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

const TARGET_DIR = "./csv"; 

// 2. Update the path construction
const TELEMETRY_CSV_PATH = join(
  TARGET_DIR,
  `Team_041_${timestamp}.csv`
);


const CSV_HEADER =
  "TEAM_ID,TIME_STAMP,PACKET_COUNT,ALTITUDE,PRESSURE,TEMPERATURE,VOLTAGE," +
  "GNSS_TIME,GNSS_LATITUDE,GNSS_LONGITUDE,GNSS_ALTITUDE,GNSS_SATS,ACCEL_R,ACCEL_P,ACCEL_Y," +
  "GYRO_R,GYRO_P,GYRO_Y,FLIGHT_SOFTWARE_STATE,CMD_ECHO\n";


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
      CMD_ECHO
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
      CMD_ECHO
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

module.exports = {
  initTelemetryCSV,
  writeTelemetryRow,
  deleteTelemetryCSV,
};