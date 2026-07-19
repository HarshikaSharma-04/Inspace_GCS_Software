const { SerialPort } = require("serialport");
const xbee_api = require("xbee-api");
const EventEmitter = require("events");
const buildFrame = require("./buildFrame");
class SerialService extends EventEmitter {
  constructor() {
    super();
    let commandError = false;
    this.xbeeAPI = new xbee_api.XBeeAPI({
      api_mode: 1,
    });

    this.port = new SerialPort({
      path: "COM2",
      baudRate: 115200,
    });

    this.port.pipe(this.xbeeAPI.parser);

    this.port.on("open", () => {
      console.log("Serial port opened (API)");
    });

    this.xbeeAPI.parser.on("data", (frame) => {
      if (
        frame.type === xbee_api.constants.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET ||
        frame.type === xbee_api.constants.FRAME_TYPE.RX_PACKET_64
      ) {
        const telemetryString = frame.data.toString("ascii");
        //console.log("Telemetry received:", telemetryString);
        this.emit("telemetry", telemetryString);
      }
    });

    this.port.on("error", (err) => {
      console.error("Serial error:", err);
    });
  }

  // Send command as XBee API frame
  sendCommand(data, callback) {
  let frame;
  try {
    const frameConfig = {
      type: xbee_api.constants.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
      destination64: "0013A200426C1146",
      destination16: "fffe",
      data: data
    };
    
    frame = this.xbeeAPI.buildFrame(null); // pass null purposely so that the library returns an empty frame, to test the manaul builder

    if (!frame) throw new Error("Library produced empty frame");

  } catch (e) {
    console.warn("xbee-api failed, switching to manual parser:", e.message);
    frame = buildFrame.buildTransmitFrame("0013A200423F4D0C", data); // manual frame builder
  }

  //for testing
  console.log("Manual API Frame:");
  console.log(frame);
  console.log(frame.toString("hex").toUpperCase());

  this.port.write(frame, (err) => {
    if (err) {
      console.error("Transmission error:", err);
    }
    if (callback) callback(err);
  });
}

}

module.exports = new SerialService();