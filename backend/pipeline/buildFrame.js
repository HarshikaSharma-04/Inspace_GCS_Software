// manual frame builder
// compute the checksum
function computeChecksum(frameData) {
    let sum = 0;

  for (let i = 0; i < frameData.length; i++) {
    sum += frameData[i];
  }
  sum = sum & 0xFF;

  return 0xFF - sum;
}

function buildTransmitFrame(destAddr64, data, frameID = 0x01) {
  const rfData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

  const destAddrClean = destAddr64.replace(/\s+/g, '').toUpperCase();
  const addrBytes = Buffer.from(destAddrClean, 'hex');

  // Constants 
  const FRAME_TYPE = 0x10; 
  const ADDR_16 = Buffer.from("FFFE", "hex");
  const BROADCAST_RADIUS = 0x00; // 0x00 = Maximum hops (Standard)
  const TRANSMIT_OPTIONS = 0x00; // 0x00 = Disable Retries/ACK if configured at firmware

  // Total: Type(1)+ID(1)+Dest64(8)+Dest16(2)+Bcast(1)+Opt(1)+Data(n)
  const frameDataSize = 14 + rfData.length;
  const frameData = Buffer.alloc(frameDataSize);

  let offset = 0;
  frameData[offset++] = FRAME_TYPE;
  frameData[offset++] = frameID;
  addrBytes.copy(frameData, offset);
  offset += 8;
  ADDR_16.copy(frameData, offset);
  offset += 2;
  frameData[offset++] = BROADCAST_RADIUS; // Position 12
  frameData[offset++] = TRANSMIT_OPTIONS;  // Position 13
  rfData.copy(frameData, offset);         // Data starts at Position 14

  const checksum = computeChecksum(frameData);
  
  const finalFrame = Buffer.alloc(4 + frameData.length);
  finalFrame[0] = 0x7E;
  finalFrame.writeUInt16BE(frameData.length, 1);
  frameData.copy(finalFrame, 3);
  finalFrame[finalFrame.length - 1] = checksum;

  return finalFrame;
}

module.exports = {
    buildTransmitFrame}