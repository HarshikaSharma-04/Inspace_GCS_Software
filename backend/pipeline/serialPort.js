const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const EventEmitter = require("events");

class SerialService extends EventEmitter {
  constructor() {
    super();

    this.port = new SerialPort({
      path: "COM1", // virtual serial port
      baudRate: 115200,
    });

    const parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

    this.port.on("open", () => {
      console.log("Serial port opened");
    });

    parser.on("data", (data) => {
      //console.log("Telemetry received:", data);
      // emit event
      this.emit("telemetry", data.trim());
    });

    this.port.on("error", (err) => {
      console.error("Serial error:", err);
    });
  }
  sendCommand(cmd, callback) {
    if (!this.port.isOpen) {
      return callback(new Error("Serial port is not open"));
    }

    this.port.write(`${cmd}`, (err) => {
      //console.log("Command sent:", cmd);
      if (err) {
        console.error("Serial Write Error:", err);
        return callback(err);
      }


    });
  }
}

module.exports = new SerialService();