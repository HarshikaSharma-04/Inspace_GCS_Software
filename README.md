# INSPACe 2026 GCS SOFTWARE  

## PRE-REQUISITE FOR THE GROUND STATION SOFTWARE
1. **Virtual Port Software**: Refer to this [Document](https://drive.google.com/file/d/1_p0vNYVFoLjOpYEZtKXJBkA9TpbqY_q1/view?usp=sharing)
2. **Latest version of NodeJS**
3. **Python 3.11+**

## FILE SYSTEM OF THE REPO:  
```
Inspace_GCS_Software/
├── .vscode/                 # Editor/workspace settings
├── backend/
│   └── cansat/             # This folder basically simulates the working for the cansat and to test the core logic of GCS, mostly used when actual hardware are not present
│       ├── csv/                     # Sample CSVs for testing
│       │   ├── telemetry_extended.csv
│       │   ├── test_csv_API.csv
│       │   ├── test_csv_AT.csv
│       │   ├── test_csv_SS.csv
│       │   └── test_csv.csv
│       ├── gcs_csv/                 # This folder contains the logged csv during the flight
│       ├── pipeline/                # Serial → structured telemetry pipeline
│       │   ├── serialPort.js            # Opens/reads the serial connection
│       │   ├── serialPortAPI.js         # API wrapper around the serial port (when the XBEE is used in API mode)
│       │   ├── filtergarbage.js         # Filters out noisy/invalid frames
│       │   ├── buildFrame.js            # Builds a structured frame from raw data (this is used to build frames for commands (GCS -> CAN-7USAT))
│       │   ├── readSimValues.js         # Reads values in simulation mode from the provided sim.txt
│       │   ├── telemetrywriter.js       # Writes parsed telemetry to CSV
│       │   ├── testFrame.js             # Test/sample frame generation
│       │   └── sim.txt                  # Sample simulation data
│       ├── api_mode_sender.py       # Sends telemetry in "API mode"
│       ├── detect_port.py           # Auto-detects the connected serial port (Yet to be implemented)
│       ├── port.py                  # Serial port configuration/handling
│       ├── send.py                  # Sends data over serial and receives the commands from the GCS
│       ├── write_test.py            # Writes test telemetry data
├── server.js                        # Main backend server (serves data to frontend)
├── package.json
└── package-lock.json
└── frontend/
    ├── images/                  # Logos, flags, and mission graphics
    │   ├── cansat.png
    │   ├── indian_flag.png
    │   ├── launch_pad.png
    │   ├── team_logo.png
    │   └── team_logo_new.png
    ├── scripts/
    │   ├── telemetry.js          # Core frontend logic — charts, 3D plot, socket connection
    │   ├── Map.js                # Map configuration/display
    │   ├── SimulationMode.js     # Toggles simulation mode on/off
    │   └── canvasTable.js        # Canvas-based CSV/data table
    ├── sectionsCSS/
    │   ├── style.css             # Base styling
    │   └── style_update.css      # Updated styling (colors, etc.)
    ├── index.html                # GUI structure/entry point
    └── package-lock.json
├── .gitignore
└── README.md
```

## HOW TO CONFIGURE VIRTUAL PORT  
After creating the virtual port as per the document above, navigate to `backend/pipeline/serialPort.js`  
```
class SerialService extends EventEmitter {
  constructor() {
    super();

    this.port = new SerialPort({
      path: "COM2", // virtual serial port (change this according to your machine)
      baudRate: 115200,
    });
```
Then, navigate to `backend/cansat/send.py`  
```
import csv
import serial
import time
import os

# --- CONFIGURATION ---
PORT = "COM1" (change this according to your machine)
BAUD = 115200

TELEMETRY_CSV = "stress_csv.csv"

SIMULATION_CSV = "sim.txt"  # Create this file or point to your SIM path
H = 0.0
```

## STEPS TO START THE GCS SOFTWARE:  
1. Clone the repo ```git clone https://github.com/HarshikaSharma-04/Inspace_GCS_Software.git```
2. Navigate to the repo directory where you cloned it:
```cd Inspace_GCS_Software```
4. Navigate to `backend` folder `cd backend`
5. Install the node dependencies `npm install`
6. Execute ```npm run dev``` (or if using offline use `node server.js`)

If using without physical hardware:  
```
cd backend/cansat
python send.py  
```

## TEAM  
Built by the **Software Department @ DJS Arya**.  
