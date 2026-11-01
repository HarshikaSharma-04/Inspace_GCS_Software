const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const EventEmitter = require("events");

class SerialService extends EventEmitter {
  constructor() {
    super();

    this.port = new SerialPort({
      path: "/dev/cu.usbmodem166664401", // virtual serial port
      baudRate: 115200,
    });

    const parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

    this.port.on("open", () => {
      console.log("Serial port opened");
    });

    parser.on("data", (data) => {
      const line = data.trim();
      const acknowledgement = /^ACK,(.+)$/i.exec(line);
      if (acknowledgement) {
        this.emit("ack", acknowledgement[1].trim().toUpperCase());
        return;
      }
      this.emit("telemetry", line);
    });

    this.port.on("error", (err) => {
      console.error("Serial error:", err);
      this.emit("serial-error", err);
    });
  }
  sendCommand(cmd, callback) {
    if (!this.port.isOpen) {
      return callback(new Error("Serial port is not open"));
    }

    this.port.write(`${cmd}\n`, (err) => {
      //console.log("Command sent:", cmd);
      if (err) {
        console.error("Serial Write Error:", err);
        return callback(err);
      }


    });
  }
  close(callback) {
    if (!this.port.isOpen) {
      return callback();
    }

    this.port.close(callback);
  }
}

module.exports = new SerialService();
