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
IS_SIM_ENABLED = False
IS_SIM_ACTIVATED = False

def calculate_tti(desc_velocity,altitude):
    adjustment_factor = 0.000001 # avoid dividing by 0
    tti = float(altitude) / (float(desc_velocity) + adjustment_factor)
    return tti

def calculate_alt_from_pressure(command_str):
    parts = command_str.split(",")
    pressure_str = parts[-1].strip().removesuffix("N")
    pressure = float(pressure_str)
    if pressure <= 0:
        return None, None
    P0 = 101325.0
    exponent = 1 / 5.255
    altitude = 44330 * (1 - (pressure / P0) ** exponent)
    return altitude, pressure


def is_pressure_command(command):
    if not command.endswith("N") or command in {
        "1N", "2N", "3N", "4N", "5N", "6N", "7N", "8N", "9N", "10N", "11N"
    }:
        return False
    try:
        float(command[:-1])
    except ValueError:
        return False
    return True


def run_sender():
    global IS_SIM_ENABLED; global IS_SIM_ACTIVATED
    try:
        ser = serial.Serial(port=PORT, baudrate=BAUD, timeout=0.1)
        print(f"Serial port opened: {ser.name}")
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    print("--- GCS SENDER ACTIVE ---")
    print("Waiting for commands...")

    try:
        # command reception loop
        while True:
            if ser.in_waiting > 0:
                # Read command from Node.js
                command = ser.readline().decode("utf-8").strip().upper()
                print(f"Command Received: {command}")
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


    
def stream_csv_data(ser, file_path, simulated_H = None, simulated_P = None):
    """Generic function to stream any CSV until finished or stopped by GCS."""
    TOTAL_PKT_COUNT = 0 
    global IS_SIM_ENABLED;global IS_SIM_ACTIVATED
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return
    try:
        with open(file_path, "r") as file:
            reader = csv.reader(file)
            header = next(reader)
            for row in reader:
                # Use 'while' instead of 'if' to read ALL waiting commands and prevent lagging
                while ser.in_waiting > 0:
                    interrupt = ser.readline().decode("utf-8").strip().upper()
                    print("Interrupt: ",interrupt)
                    if interrupt == "2N":
                        print(f"Stream stopped by: CXOFF")
                        return
                    elif interrupt == "3N":
                        IS_SIM_ENABLED = True
                        print("Action: Simulation ENABLED")
                    elif interrupt == "4N":
                        if IS_SIM_ENABLED:
                            print("SIMULATION MODE ACTIVATED....")  
                            IS_SIM_ACTIVATED = True 
                        else:
                            print("ERROR: SIMULATION MODE NOT ENABLED") 
                    elif interrupt == "5N":
                        if IS_SIM_ENABLED:
                            print("SIMULATION MODE DEACTIVATED...")
                            IS_SIM_ACTIVATED = False
                        else:
                            print("ERROR: SIMULATION MODE NOT ACTIVATED..")  
                    elif interrupt == "7N":
                        print("Action: Calibrating...")
                        row[3] = "0.0"
                    elif interrupt == "8N":
                         print("Action: Servo ON")
                    elif interrupt == "9N":
                         print("Action: Servo Off")   
                    elif interrupt == "10N":
                         print("Action: GYRO ON")   
                    elif interrupt == "11N":
                        print("GYRO OFF")
                    elif is_pressure_command(interrupt):
                        try:
                            new_altitude, new_pressure = calculate_alt_from_pressure(interrupt)
                        except ValueError as e:
                            print(f"Invalid pressure command {interrupt}: {e}")
                        else:
                            if new_altitude is None:
                                print(f"Invalid pressure value in command: {interrupt}")
                            else:
                                row[3] = str(new_altitude)
                                row[4] = str(new_pressure)
                                print(
                                    f"Pressure received: {new_pressure}; "
                                    f"calculated altitude: {new_altitude}"
                                )

                # append the new data
                current_tti = calculate_tti(row[20],row[3])
                #print(current_tti)
                row.append(str(current_tti))
                # Send the data row
                data_line = ",".join(row) + "\n"
                ser.write(data_line.encode("utf-8"))
                TOTAL_PKT_COUNT += 1
                
                # Telemetry rate (1 second)
                time.sleep(1)
            
            print("End of file reached.")

    except Exception as e:
        print(f"Streaming Error: {e}")

if __name__ == "__main__":
    run_sender()