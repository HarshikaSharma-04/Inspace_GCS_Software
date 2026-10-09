const fs = require("fs");
const path = require("path");
const { convertProcessSignalToExitCode } = require("util");

function getSimulationCommands() {
  const filePath = path.join(__dirname, "sim.txt");
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace("$", "041"));
  } catch (err) {
    console.error("Error reading sim.txt:", err);
    return [];
  }
}

function stripSimCommand(fullCmd) {
  const parts = fullCmd.split(",");
  return parts[3] + "N";
}

module.exports = { getSimulationCommands, stripSimCommand };
