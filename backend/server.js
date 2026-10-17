const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const app = express();
const server = http.createServer(app);
const fs = require("fs");
const io = new Server(server, { cors: { origin: "*" } });
const { filterGarbage } = require("./pipeline/filtergarbage");
const serialPort = require("./pipeline/serialPort");
// importing functions from telemetryWriter.js file
const { initTelemetryCSV, writeTelemetryRow, deleteTelemetryCSV, } = require("./pipeline/telemetrywriter");
const { getSimulationCommands, stripSimCommand } = require("./pipeline/readSimValues");

const PORT = 3000;
let isSimEnabled = false;
let isSimActivated = false;
let isCxSent = false;
let simInterval = null;
//6N:SIMP

const validCommands = {
  "CMD,041,CX,ON": "1N",
  "CMD,041,CX,OFF": "2N",
  "CMD,041,SIM,ENABLE": "3N",
  "CMD,041,SIM,ACTIVATE": "4N",
  "CMD,041,SIM,DISABLE": "5N",
  "CMD,041,CAL": "7N",
  "CMD,041,MEC,SERVO,ON": "8N",
  "CMD,041,MEC,SERVO,OFF": "9N",
  "CMD,041,MEC,GYRO,ON": "10N",
  "CMD,041,MEC,GYRO,OFF": "11N",
};

//for offline
app.use(
  "/node_modules",
  express.static(path.join(__dirname, "node_modules"))
);

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Serve the index.html file from the frontend directory when the root URL is accessed
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});


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
    // //console.error(
    //   "Parse failed — dropping packet:",
    //   parseError.message,
    // );
    socket.emit("telemetry-warning", {
      stage: "parse",
      reason: parseError.message,
    });
    return; // No data exists
  }
  let cleanedData = data; // Temporary variable to hold filtered data
  try {
    writeTelemetryRow(cleanedData).catch((err) => {
      // console.error("CSV write failed:", err.message);
    });
    const result = await filterGarbage(data);
    if (result != null) {
      cleanedData = result;
    }
  } catch (filterError) {
    // console.error(
    //   "filter function crashed-sending unfiltered data",
    //   filterError.message,
    // );
  }
  // final emit....this is independent
  io.emit("telemetry-update", cleanedData);
}

serialPort.on("telemetry", (packet) => {
  handleCanSatData(packet);
});


io.on("connection", (socket) => {
  socket.on("send-command", (cmd) => {
    const command = validCommands[cmd];
    if (!command) {
      socket.emit("command-response", "Invalid Command");
      return;
    }
    if (cmd === "CMD,041,CX,ON") {
      if (isSimActivated) {
        socket.emit("command-warning", "Warning: Cannot enable Flight Mode while in Simulation Mode!");
        return;
      }
      isCxSent = true;
    }
    else if (cmd === "CMD,041,CX,OFF") {
      isCxSent = false;
    }
    // handling simulation commands:
    if (cmd === "CMD,041,SIM,ENABLE") {
      if (isCxSent) {
        socket.emit("command-warning", "Warning: Cannot enable simulation while in Flight Mode!");
        return;
      }
      isSimEnabled = true;
    }
    else if (cmd === "CMD,041,SIM,ACTIVATE") {
      if (!isSimEnabled) {
        socket.emit("command-warning", "Warning: Please ENABLE the simulation mode first!");
        return;
      }
      isSimActivated = true;
    }
    else if (cmd === "CMD,041,SIM,DISABLE") {
      if (!isSimActivated) {
        socket.emit("command-warning", "Warning: Simulation must be ACTIVATED before it can be disabled!");
        return;
      }
      // Reset states upon successful disable
      isSimEnabled = false;
      isSimActivated = false;
      if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
      }
      socket.emit("command-response", "Simulation Stopped");
    }
    if (isSimActivated) {
      socket.emit("sim-command-response", "Simulation Mode Started");
      const rawSimCommands = getSimulationCommands();
      let index = 0;
      if (simInterval) clearInterval(simInterval);
      simInterval = setInterval(() => {
        if (index < rawSimCommands.length) {
          const fullCommand = rawSimCommands[index];
          //io.emit("sim-command", fullCommand);
          socket.emit("command-success", fullCommand);
          const strippedValue = stripSimCommand(fullCommand);
          serialPort.sendCommand(strippedValue, (err) => {
            if (err) console.error("Serial Write Error:", err.message);
          });
          index++;
        } else {
          clearInterval(simInterval);
        }
      }, 1000);
    }

    // write on port
    serialPort.sendCommand(command, (err) => {
      if (err) {
        socket.emit("command-response", "Failed to send command");
        return;
      }
      if (cmd === "CMD,041,SIM,ENABLE") {
        socket.emit("command-response", "Simulation Enabled");
      }
      else if (cmd === "CMD,041,SIM,ACTIVATE") {
        socket.emit("command-response", "Simulation Started");
      }
    });
    socket.emit("command-success", cmd);
  });
  socket.on("disconnect", () => {
    console.log("GUI Disconnected");
  });
});


function shutdown() {
  console.log("Closing server and serial connections...");
  serialPort.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
}
process.on("SIGINT", shutdown);  
process.on("SIGTERM", shutdown); 
server.listen(PORT, "127.0.0.1", async () => {
  //await initTelemetryCSV();
  console.log(`Server running at http://localhost:${PORT}`);
});