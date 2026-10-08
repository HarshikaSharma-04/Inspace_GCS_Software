let simulationEnabled = false;
let simulationActivated = false;

const simulationModeListeners = [];

export function isSimulationEnabled() {
  return simulationEnabled;
}

export function isSimulationActivated() {
  return simulationActivated;
}

export function isSimulationModeActive() {
  return simulationActivated;
}

export function onSimulationModeChange(callback) {
  simulationModeListeners.push(callback);
}

function notifySimulationModeChange() {
  simulationModeListeners.forEach((callback) => callback(simulationActivated));
}

export function enableSimulation() {
  simulationEnabled = true;
}

export function activateSimulation() {
  if (!simulationEnabled) return false;

  simulationActivated = true;
  notifySimulationModeChange();
  return true;
}

export function deactivateSimulation() {
  simulationActivated = false;
  notifySimulationModeChange();
}

export function disableSimulation() {
  simulationEnabled = false;
  deactivateSimulation();
}

export function initializeSimulationMode({ socket, modeValue, resetAllTelemetryData }) {
  socket.on("sim-command-response", (response) => {
    if (response === "Simulation Mode Started") {
      enableSimulation();
      activateSimulation();
      modeValue.textContent = "Simulation";
      modeValue.classList.add("simulation");
      resetAllTelemetryData();
    }
  });

  socket.on("command-response", (response) => {
    switch (response) {
      case "Simulation Enabled":
        enableSimulation();
        break;

      case "Simulation Started":
        if (activateSimulation()) {
          modeValue.textContent = "Simulation";
          modeValue.classList.add("simulation");
          resetAllTelemetryData();
        }
        break;

      case "Simulation Stopped":
        disableSimulation();
        modeValue.textContent = "Flight";
        modeValue.classList.remove("simulation");
        break;
    }
  });
}

const toggleSwitch = document.querySelector(".switch");

if (toggleSwitch) {
  toggleSwitch.addEventListener("click", function () {
    const isChecked = this.getAttribute("aria-checked") === "true";
    this.setAttribute("aria-checked", !isChecked);

    if (isChecked) {
      deactivateSimulation();
    } else {
      activateSimulation();
    }
  });
}
