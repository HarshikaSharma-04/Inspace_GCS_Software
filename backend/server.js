const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const fs = require("fs");
const io = new Server(server, { cors: { origin: "*" } });
const { filterGarbage } = require("./filterGarbage");
// importing functions from telemetryWriter.js file
const {
  initTelemetryCSV,
  writeTelemetryRow,
  deleteTelemetryCSV,
} = require("./telemetryWriter");

const PORT = 3000;
let telemetryInterval = null; //this is to read the data from csv file
let isCalReceived = false;
//6N:SIMP
const validCommands = {
  "CMD,041,CX,ON":"1N",
  "CMD,041,CX,OFF":"2N",
  "CMD,041,SIM,ENABLE":"3N",
  "CMD,041,SIM,ACTIVATE":"4N",
  "CMD,041,SIM,DISABLE":"5N",
  "CMD,041,CAL":"7N",
  "CMD,041,MEC,SERVO,ON":"8N",
  "CMD,041,MEC,SERVO,OFF":"9N",
  "CMD,041,MEC,GYRO,ON":"10N",
  "CMD,041,MEC,GYRO,OFF":"11N",
};

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Serve the index.html file from the frontend directory when the root URL is accessed
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

//read csv file
const csvPath = "test_csv.csv";
const file = fs.readFileSync(csvPath, "utf8");

// Split the file into rows, remove the header, and filter out empty rows
const rows = file
    .split("\n")
    .slice(1)          // remove header
    .filter(row => row.trim() !== "");

//Resolve decimal values to a specific precision
function resolveDecimal(value, precision) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (isNaN(n)) {
    return null;
  }
  const factor = Math.pow(10, precision);
  const truncated = Math.trunc(n * factor) / factor;

  return truncated.toFixed(precision);
}
//for starting the telemetry data reading from csv file
function startTelemetry() {
    // Read all rows from telemetry.csv
     if (telemetryInterval) return;
    let index = 0;

    telemetryInterval = setInterval(() => {

        if (index >= rows.length) {
            clearInterval(telemetryInterval);
            return;
        }

        handleCanSatData(rows[index]);

        index++;

    }, 1000);
}
//for stopping the telemetry data reading from csv file
function stopTelemetry() {
    if (telemetryInterval) {
        clearInterval(telemetryInterval);
        telemetryInterval = null;
    }
}
// this function is taking the emitted values
async function handleCanSatData(rawString) {
  let data;
  try {
    const parts = rawString.split(",").map((p) => p.trim());
    const [
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
    ] = parts;


data = {
  TEAM_ID,
  TIME_STAMP,
  PACKET_COUNT,

  ALTITUDE: resolveDecimal(ALTITUDE, 1),
  PRESSURE: resolveDecimal(PRESSURE, 1),
  TEMPERATURE: resolveDecimal(TEMPERATURE, 1),
  VOLTAGE: resolveDecimal(VOLTAGE, 2),

  GNSS_TIME,
  GNSS_LATITUDE: resolveDecimal(GNSS_LATITUDE, 4),
  GNSS_LONGITUDE: resolveDecimal(GNSS_LONGITUDE, 4),
  GNSS_ALTITUDE: resolveDecimal(GNSS_ALTITUDE, 1),
  GNSS_SATS,

  ACCEL_R: resolveDecimal(ACCEL_R, 2),
  ACCEL_P: resolveDecimal(ACCEL_P, 2),
  ACCEL_Y: resolveDecimal(ACCEL_Y, 2),

  GYRO_R: resolveDecimal(GYRO_R, 2),
  GYRO_P: resolveDecimal(GYRO_P, 2),
  GYRO_Y: resolveDecimal(GYRO_Y, 2),
  
  FLIGHT_SOFTWARE_STATE,

  CMD_ECHO: CMD_ECHO ? CMD_ECHO.replace(/"/g, "") : ""
};

  } catch (parseError) {
    console.error(
      "Parse failed — dropping packet:",
      parseError.message,
    );
    io.emit("telemetry-warning", {
      stage: "parse",
      reason: parseError.message,
    });
    return; // No data exists
  }

  let cleanedData = data; // Temporary variable to hold filtered data
  try {
    writeTelemetryRow(cleanedData).catch((err) =>
    console.error("CSV write failed:", err.message),
  );
    const result = await filterGarbage(data); 
    if (result!=null) {
      cleanedData = result;
    } 
  } catch (filterError) {
    console.error(
      "filter function crashed-sending unfiltered data",
      filterError.message,
    );
  }
  
  if (isCalReceived) isCalReceived = false;

  // write to csv file

  // final emit....this is independent
  io.emit("telemetry-update", cleanedData);
}
io.on("connection", (socket) => {

    console.log("GUI Connected");

    socket.on("send-command", (command) => {

        const cmd = command.trim().toUpperCase();

        if (!(cmd in validCommands)) {

            socket.emit("command-error", {
                message: "INVALID COMMAND",
                received: cmd
            });

            return;
        }

        console.log("Received:", cmd);
        // Send the accepted command to every connected GUI
        console.count("Backend command-echo");
        console.log(cmd);
        io.emit("command-echo", cmd);

        switch(validCommands[cmd]) {

            case "1N":
                console.log("CX ON");
                io.emit("clear-data");
                startTelemetry();
                socket.emit("command-response","Stream Started");
                break;

            case "2N":
                console.log("CX OFF");
                stopTelemetry();
                socket.emit("command-response","Stream Stopped");
                break;

            case "3N":
                console.log("SIM ENABLE");
                socket.emit("command-response","Simulation Enabled");
                break;

            case "4N":
                console.log("SIM ACTIVATE");
                socket.emit("command-response","Simulation Started");
                break;

            case "5N":
                console.log("SIM DISABLE");
                socket.emit("command-response","Simulation Stopped");
                break;

            case "7N":
                console.log("CAL");
                socket.emit("command-response", "Calibration Started");
                break;

            case "8N":
                console.log("SERVO ON");
                socket.emit("command-response", "Servo Enabled");
                break;

            case "9N":
                console.log("SERVO OFF");
                socket.emit("command-response", "Servo Disabled");
                break;

            case "10N":
                console.log("GYRO ON");
                break;

            case "11N":
                console.log("GYRO OFF");
                break;
        }

    });
    socket.on("disconnect", () => {
    console.log("GUI Disconnected");
   }); 

});
// on port 3000 the server is running
server.listen(PORT, async () => {
  await initTelemetryCSV();
  console.log(`Server running at http://localhost:${PORT}`);
});