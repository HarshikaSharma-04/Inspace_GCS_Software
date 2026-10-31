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
const { writeTelemetryRow, integrateGyroToDegrees } = require("./pipeline/telemetrywriter");
const { getSimulationCommands, stripSimCommand } = require("./pipeline/readSimValues");

const PORT = 3000;
const COMMAND_RATE_HZ = 20;
const COMMAND_INTERVAL_NS = BigInt(1_000_000_000 / COMMAND_RATE_HZ);
let isSimEnabled = false;
let isSimActivated = false;
let isCxSent = false;
let simInterval = null;
let currentCommand = null;
let commandStreamTimer = null;
let commandStreamRunning = false;
let nextCommandTick = null;
let commandsRemaining = 0;
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

function setCurrentCommand(command) {
  currentCommand = command;
  commandsRemaining = COMMAND_RATE_HZ;
  startCommandStream();
}

function stopCommandStream() {
  commandStreamRunning = false;
  nextCommandTick = null;
  commandsRemaining = 0;
  if (commandStreamTimer) {
    clearTimeout(commandStreamTimer);
    commandStreamTimer = null;
  }
}

function commandStreamTick() {
  if (!commandStreamRunning) return;

  if (currentCommand && commandsRemaining > 0) {
    const commandNumber = COMMAND_RATE_HZ - commandsRemaining + 1;
    commandsRemaining--;
    console.log(`Sending command (${commandNumber}/${COMMAND_RATE_HZ}):`, currentCommand);
    serialPort.sendCommand(currentCommand, (err) => {
      if (err) {
        console.error("Serial Write Error:", err.message);
        stopCommandStream();
      }
    });
  }

  if (!commandStreamRunning) return;
  if (commandsRemaining === 0) {
    stopCommandStream();
    return;
  }

  nextCommandTick += COMMAND_INTERVAL_NS;
  const delayNs = nextCommandTick - process.hrtime.bigint();
  commandStreamTimer = setTimeout(
    commandStreamTick,
    Number(delayNs > 0n ? delayNs : 0n) / 1_000_000
  );
}

function startCommandStream() {
  if (commandStreamRunning) return;

  commandStreamRunning = true;
  nextCommandTick = process.hrtime.bigint();
  commandStreamTick();
}

//for offline
app.use(
  "/node_modules",
  express.static(path.join(__dirname, "node_modules"))
);
app.use("/tiles", express.static(path.join(__dirname, "..", "frontend", "tiles")));

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
  const parts = rawString.split(",").map((p) => p.trim());
  // if (parts.length !== 27) {
  //   console.warn("Ignoring non-telemetry serial data:", rawString);
  //   return;
  // }

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
    MAG_R,
    MAG_P,
    MAG_Y,
    FLIGHT_SOFTWARE_STATE,
    CMD_ECHO,
    GLIDE_RATIO,
    HEADING,
    BEARING,
    HEADING_ERROR
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
    MAG_R: resolveDecimal(MAG_R, 2),
    MAG_P: resolveDecimal(MAG_P, 2),
    MAG_Y: resolveDecimal(MAG_Y, 2),
    FLIGHT_SOFTWARE_STATE,
    CMD_ECHO: CMD_ECHO ? CMD_ECHO.replace(/"/g, "") : "",
    GLIDE_RATIO: resolveDecimal(GLIDE_RATIO, 2),
    HEADING: resolveDecimal(HEADING, 2),
    BEARING: resolveDecimal(BEARING, 2),
    HEADING_ERROR: resolveDecimal(HEADING_ERROR, 2)
  };
  // Integrate gyro rates (°/s) into orientation angles (°) for tilt visualization
  const tiltAngles = integrateGyroToDegrees(data);
  data.TILT_PITCH = tiltAngles.TILT_PITCH;
  data.TILT_YAW = tiltAngles.TILT_YAW;

  let cleanedData = data; // Temporary variable to hold filtered data
  try {
    writeTelemetryRow(cleanedData).catch((err) => {
      io.emit("telemetry-write-error", "Error writing telemetry data: " + err.message);
    });
    const result = await filterGarbage(data);
    if (result != null) {
      cleanedData = result;
    }
  } catch (filterError) {
    io.emit("telemetry-filter-error", "Error filtering telemetry data: " + filterError.message);
  }
  // final emit....this is independent
  io.emit("telemetry-update", cleanedData);
}


serialPort.on("telemetry", (packet) => {
  handleCanSatData(packet);
});

serialPort.on("serial-error", stopCommandStream);


io.on("connection", (socket) => {
  socket.on("send-command", (cmd) => {
    const command = validCommands[cmd];
    if (!command || (cmd in validCommands) === false) {
      socket.emit("command-warning", "Invalid Command");
      return;
    }
    if (cmd === "CMD,041,CX,ON") {
      if (isSimEnabled || isSimActivated) {
        socket.emit("command-warning", "[WARNING]:Cannot switch the Mode");
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
        socket.emit("command-warning", "[WARNING]:Cannot switch the Mode");
        return;
      }
      isSimEnabled = true;
    }
    else if (cmd === "CMD,041,SIM,ACTIVATE") {
      if (isCxSent) {
        socket.emit("command-warning", "[WARNING]:Cannot switch the Mode");
        return;
      }
      if (!isSimEnabled) {
        socket.emit("command-warning", "[WARNING]:Simulation not ENABLED");
        return;
      }
      isSimActivated = true;
    }
    else if (cmd === "CMD,041,SIM,DISABLE") {
      if (!isSimActivated) {
        socket.emit("command-warning", "[WARNING]:Not in Simulation Mode");
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
    if (isSimActivated && isSimEnabled && cmd === "CMD,041,SIM,ACTIVATE") {
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
          setCurrentCommand(strippedValue);
          index++;
        } else {
          clearInterval(simInterval);
        }
      }, 1000);
    }

    // write on port

    setCurrentCommand(command);
    socket.emit("command-success", cmd);
  });
  socket.on("disconnect", () => {
    console.log("GUI Disconnected");
  });
});


function shutdown() {
  console.log("Closing server and serial connections...");
  stopCommandStream();
  serialPort.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.listen(PORT, "127.0.0.1", async () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
