const express = require("express");
const http = require("http");
const { spawn } = require("child_process");
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
//let TELEMETRY_QUEUE = [];
let isSimEnabled = false;
let isSimActivated = false;
let isCxSent = false;
let simInterval = null;
let simRunId = 0;
let activeSimulationProcess = null;
let simulationOutput = "";
let simulationRequests = [];
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

function failSimulationRequests(error) {
  while (simulationRequests.length) {
    simulationRequests.shift().reject(error);
  }
}

function startSimulationProcess() {
  const python = process.env.PYTHON || "python";
  const script = path.join(__dirname, "cansat", "simulation.py");
  const child = spawn(python, [script, "--stream"], { windowsHide: true });
  activeSimulationProcess = child;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    simulationOutput += chunk;
    let newlineIndex;
    while ((newlineIndex = simulationOutput.indexOf("\n")) !== -1) {
      const line = simulationOutput.slice(0, newlineIndex).trim();
      simulationOutput = simulationOutput.slice(newlineIndex + 1);
      if (!line) continue;

      const request = simulationRequests.shift();
      if (!request) continue;
      try {
        const result = JSON.parse(line);
        if (!Number.isFinite(result.pressure) || result.pressure <= 0 || !Number.isFinite(result.altitude)) {
          throw new Error("Invalid simulation result");
        }
        request.resolve(result);
      } catch (error) {
        request.reject(new Error(`Invalid simulation output: ${error.message}`));
      }
    }
  });

  const handleProcessError = (error) => {
    if (activeSimulationProcess === child) {
      activeSimulationProcess = null;
    }
    failSimulationRequests(error);
  };
  child.on("error", handleProcessError);
  child.stdin.on("error", handleProcessError);
  child.on("close", (code) => {
    if (activeSimulationProcess === child) {
      activeSimulationProcess = null;
      failSimulationRequests(new Error(`Simulation process exited with code ${code}`));
    }
  });
}

function calculateSimulationAltitude(strippedCommand) {
  return new Promise((resolve, reject) => {
    if (!activeSimulationProcess || !activeSimulationProcess.stdin.writable) {
      reject(new Error("Simulation process is not available"));
      return;
    }
    simulationRequests.push({ resolve, reject });
    activeSimulationProcess.stdin.write(`${strippedCommand}\n`);
  });
}

function stopSimulation() {
  simRunId++;
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
  if (activeSimulationProcess) {
    activeSimulationProcess.kill();
    activeSimulationProcess = null;
  }
  simulationOutput = "";
  failSimulationRequests(new Error("Simulation stopped"));
}

function finishSimulation(socket) {
  isSimEnabled = false;
  isSimActivated = false;
  stopSimulation();
  socket.emit("command-response", "Simulation Stopped");
}

function startSimulation(socket) {
  const rawSimCommands = getSimulationCommands();
  let index = 0;
  let packetCount = 0;
  let isProcessing = false;
  const runId = ++simRunId;
  startSimulationProcess();

  simInterval = setInterval(async () => {
    if (!isSimActivated || runId !== simRunId) {
      stopSimulation();
      return;
    }
    if (isProcessing) return;
    if (index >= rawSimCommands.length) {
      finishSimulation(socket);
      return;
    }

    const fullCommand = rawSimCommands[index++];
    const strippedValue = stripSimCommand(fullCommand);
    const pressure = Number(String(strippedValue).replace(/N$/, ""));
    if (!Number.isFinite(pressure) || pressure <= 0) {
      console.error("Invalid simulation pressure:", fullCommand);
      return;
    }

    isProcessing = true;
    socket.emit("command-success", fullCommand);
    serialPort.sendCommand(strippedValue, (err) => {
      if (err) console.error("Serial Write Error:", err.message);
    });

    try {
      const result = await calculateSimulationAltitude(strippedValue);
      if (!isSimActivated || runId !== simRunId) return;

      io.emit("telemetry-update", {
        TEAM_ID: "041",
        TIME_STAMP: new Date().toISOString(),
        PACKET_COUNT: ++packetCount,
        ALTITUDE: resolveDecimal(result.altitude, 1),
        PRESSURE: resolveDecimal(result.pressure, 1),
        CMD_ECHO: fullCommand,
      });
    } catch (error) {
      if (runId === simRunId) {
        console.error("Simulation calculation failed:", error.message);
      }
    } finally {
      isProcessing = false;
      if (index >= rawSimCommands.length && runId === simRunId) {
        finishSimulation(socket);
      }
    }
  }, 1000);
}

// this function is taking the emitted values
async function handleCanSatData(rawString) {
  if (isSimActivated) return;
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
      CMD_ECHO,
      DESC_VELOCITY
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

      CMD_ECHO: CMD_ECHO ? CMD_ECHO.replace(/"/g, "") : "",
      DESC_VELOCITY: DESC_VELOCITY ? DESC_VELOCITY.replace(/"/g, "") : ""
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
    /*
    writeTelemetryRow(cleanedData).catch((err) =>
      //console.error("CSV write failed:", err.message),
    );*/
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
  if (isSimActivated) return;
  io.emit("telemetry-update", cleanedData);
}

serialPort.on("telemetry", (packet) => {
  if (isSimActivated) return;
  handleCanSatData(packet);
});


io.on("connection", (socket) => {

  //console.log("GUI Connected");

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
      if (isSimActivated || simInterval) {
        socket.emit("command-warning", "Warning: Simulation is already active!");
        return;
      }
      isSimActivated = true;
      socket.emit("sim-command-response", "Simulation Mode Started");
      startSimulation(socket);
    }

    else if (cmd === "CMD,041,SIM,DISABLE") {
      if (!isSimActivated) {
        socket.emit("command-warning", "Warning: Simulation must be ACTIVATED before it can be disabled!");
        return;
      }
      // Reset states upon successful disable
      isSimEnabled = false;
      isSimActivated = false;
      stopSimulation();
      socket.emit("command-response", "Simulation Stopped");
    }


    //yaha it will write on serialPort and then echo back to GUI
    serialPort.sendCommand(command, (err) => {
      if (err) {
        //console.error(err);
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

// an attempt to graceful shutdown of ports
function shutdown() {
  console.log("Closing server and serial connections...");
  serialPort.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
}
process.on("SIGINT", shutdown);  // Catches Ctrl+C
process.on("SIGTERM", shutdown); // Catches termination signals
// on port 3000 the server is running
server.listen(PORT, "127.0.0.1", async () => {
  //await initTelemetryCSV();
  console.log(`Server running at http://localhost:${PORT}`);
});
