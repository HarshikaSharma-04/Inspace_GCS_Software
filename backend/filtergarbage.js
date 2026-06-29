

async function filterGarbage(data) {
  if (!data) return null;

  let cleanedData = { ...data };

  for (let key in data) {
    let value = String(data[key]);
    let isInvalid = false;

    // Detect Noise (The replacement characters)
    if (/[^\x20-\x7E]/.test(value) || value.includes("0x")) {
      isInvalid = true;
    }
    if (key.toUpperCase() === "MODE") {
      if (!["F", "S"].includes(value.toUpperCase())) {
        isInvalid = true;
      }
    }
    
    // Numerical Validation
    const isNumericField = key.match(/MAG|ACCEL|GYRO|PACKET_COUNT|GPS_LAT|GPS_LONG/i);

    if (isNumericField && !isInvalid) {
      let sanitizedStr = value.replace(/[^\d.-]/g, "");
      let numValue = parseFloat(sanitizedStr);

      if (isNaN(numValue)) {
        isInvalid = true;
      } 
    }

    // 3. Mark as NULL or NaN if invalid
    if (isInvalid) {
      cleanedData[key] = "null";
    } else {
      // Just trim and remove any hidden non-numeric noise for numeric fields
      if (isNumericField) {
        cleanedData[key] = value.replace(/[^\d.-]/g, "");
      } else {
        cleanedData[key] = value.trim();
      }
    }
  }

  return cleanedData;
}

module.exports = { filterGarbage };
