const { buildTransmitFrame } = require("./buildFrame");

const frame = buildTransmitFrame(
    "0013A20012345678",
    "HELLO"
);

console.log(frame);
console.log(frame.toString("hex"));