import csv
import serial
import time
import os

# --- CONFIGURATION ---
PORT = "COM1" #/dev/cu.SLAB_USBtoUART
BAUD = 115200

TELEMETRY_CSV = "stress_csv.csv"

SIMULATION_CSV = "sim.txt"  # Create this file or point to your SIM path
H = 0.0

def run_sender():
    try:
        ser = serial.Serial(port=PORT, baudrate=BAUD, timeout=0.1)
        print(f"Serial port opened: {ser.name}")
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    print("--- GCS SENDER ACTIVE ---")
    print("Waiting for commands...")

    try:
        while True:
            if ser.in_waiting > 0:
                # Read command from Node.js
                command = ser.readline().decode("utf-8").strip().upper()
                #print(f"Command Received: {command}")
                #print(command)
                if command == "1N":
                    print(f"Command Received: CXON")
                    print("Action: Starting Telemetry Stream...")
                    stream_csv_data(ser, TELEMETRY_CSV)
                if command == "2N":
                    print(f"Command Received: CXOFF")
                    #print("CX_OFF") 
                if command == "3N":
                    print(f"Command Received: SIM ENABLE")
                    print("Action: Simulation ENABLED")
                if command == "4N":
                    print(f"Command Received: SIM ACTIVE")
                    print("Action: Simulation Mode Active")
                if command == "5N":
                    print(f"Command Received: SIM DISABLE")
                    print("Action: Simulation DISABLED")
                if command == "7N":
                    print(f"Command Received: CAL")
                    print("Action: Calibrating altitude...")
                if command == "8N":
                    print(f"Command Received: SERVO ON")
                    print("Action: Servo ON")
                if command == "9N":
                    print(f"Command Received: SERVO OFF")
                    print("Action: Servo OFF")
                if command == "10N": 
                    print(f"Command Received: GYRO ON")
                    print("Action: GYRO ON") 
                    ser.write("")
                if command == "11N":
                    print(f"Command Received: GYRO OFF")
                    print("Action: GYRO OFF")
                
                
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nSender stopped by user.")
    finally:
        if ser.is_open:
            ser.close()
            print("Serial port closed.")

def stream_csv_data(ser, file_path,simulated_H = None,simulated_P = None):
    """Generic function to stream any CSV until finished or stopped by GCS."""
    TOTAL_PKT_COUNT = 0  # this will act as teensy's internal count for the packet
    IS_SIM_ENABLED = False
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    try:
        with open(file_path, "r") as file:
            reader = csv.reader(file)
            header = next(reader) 

            is_calibrated = False

            
            for row in reader:
                # Check for INTERRUPT commands while streaming
                if ser.in_waiting > 0:
                    interrupt = ser.readline().decode("utf-8").strip().upper()
                    if interrupt == "2N":
                        print(f"Stream stopped by: CXOFF")
                        return
                    elif interrupt == "3N":
                        IS_SIM_ENABLED = True
                        print("Action: Simulation ENABLED")
                    elif interrupt == "4N":
                        if IS_SIM_ENABLED:
                            print("SIMUALTION MODE ACTIVATED....")    
                        else:
                            print("ERROR: SIMULATION MODE NOT ENABLED") 
                    elif interrupt == "5N":
                        if IS_SIM_ENABLED:
                            print("SIMULATION MODE DEACTIVATED...")
                        else:
                            print("ERROR: SIMUALTION MODE NOT ACTIVATED..")  
                    elif interrupt == "7N":
                        is_calibrated = True
                        print("Action: Calibrating...")
                        
                    elif interrupt == "8N":
                         print("Action: Servo ON")
                    elif interrupt == "9N":
                           print("Action: Servo Off")   
                    elif interrupt == "10N":
                         print("Action: GYRO ON")   
                    elif interrupt == "11N":
                        print("GYRO OFF")

                # Apply calibration if enabled
                if is_calibrated:
                    row[3] = "0.0"
                # Send the data row
                data_line = ",".join(row) + "\n"
                ser.write(data_line.encode("utf-8"))
                print(f"Sending Data: {data_line.strip()}")
                TOTAL_PKT_COUNT += 1
                # print(f"Total Packet sent from CanSat:{TOTAL_PKT_COUNT}")
                # Telemetry rate (0.02 second)
                time.sleep(1)
            
            print("End of file reached.")

    except Exception as e:
        print(f"Streaming Error: {e}")

if __name__ == "__main__":
    run_sender()