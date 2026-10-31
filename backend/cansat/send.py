import csv
import serial
import time
import os
from transmit_sim import SimulationMode

# --- CONFIGURATION ---
PORT = "COM2"
BAUD = 115200
TELEMETRY_CSV = "stress_csv.csv"
COMMAND_DEDUPLICATION_SECONDS = 2

is_sim_enabled = False
is_sim_activated = False
is_telemetry_streaming = False
last_processed_command = None
last_processed_command_time = 0
sim = SimulationMode()

def process_command(ser, command, current_row=None):
    """Single point of truth for command processing."""
    global is_sim_enabled, is_sim_activated, last_processed_command, last_processed_command_time

    current_time = time.monotonic()
    if (
        command == last_processed_command and
        current_time - last_processed_command_time < COMMAND_DEDUPLICATION_SECONDS
    ):
        print(f"[GCS] Duplicate Command Ignored: {command}")
        return

    last_processed_command = command
    last_processed_command_time = current_time

    print(f"[GCS] Command Received: {command}")

    if command == "1N":
        if is_telemetry_streaming:
            print("Action: Telemetry Stream already running.")
            return
        print("Action: Starting Telemetry Stream...")
        stream_csv_data(ser, TELEMETRY_CSV)
    elif command == "2N":
        print("Action: Stopping Telemetry Stream...")
        return "STOP"
    elif command == "3N":
        is_sim_enabled = True
        print("Action: Simulation ENABLED")
    elif command == "4N":
        if is_sim_enabled:
            is_sim_activated = True
            print("Action: Simulation Mode ACTIVATED")
            sim.read_csv(ser, command)
        else:
            print("ERROR: Simulation Mode NOT ENABLED")
    elif command == "5N":
        if is_sim_enabled:
            is_sim_activated = False
            print("Action: Simulation Mode DEACTIVATED")
        else:
            print("ERROR: Simulation Mode NOT ACTIVATED")
    elif command == "7N":
        print("Action: Calibrating altitude...")
        if current_row and len(current_row) > 3:
            current_row[3] = "0.0"
    elif command == "8N":
        print("Action: Servo ON")
    elif command == "9N":
        print("Action: Servo OFF")
    elif command == "10N":
        print("Action: GYRO ON")
    elif command == "11N":
        print("Action: GYRO OFF")
    return None

def run_sender():
    try:
        ser = serial.Serial(port=PORT, baudrate=BAUD, timeout=0.1)
        print(f"Serial port opened: {ser.name}")
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    print("--- GCS SENDER ACTIVE ---")
    try:
        while True:
            if ser.in_waiting > 0:
                command = ser.readline().decode("utf-8").strip().upper()
                process_command(ser, command)
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\nSender stopped by user.")
    finally:
        if ser.is_open:
            ser.close()
            print("Serial port closed.")

def stream_csv_data(ser, file_path):
    global is_telemetry_streaming

    if is_telemetry_streaming:
        return
    is_telemetry_streaming = True

    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        is_telemetry_streaming = False
        return
    try:
        with open(file_path, "r") as file:
            reader = csv.reader(file)
            next(reader, None)  # Skip header
            for row in reader:
                while ser.in_waiting > 0:
                    interrupt = ser.readline().decode("utf-8").strip().upper()
                    status = process_command(ser, interrupt, current_row=row)
                    if status == "STOP":
                        return

                data_line = ",".join(row) + "\n"
                print(f"[PKT SENT]: {row[2]}")
                ser.write(data_line.encode("utf-8"))
                time.sleep(1)

            print("End of file reached.")
    except Exception as e:
        print(f"Streaming Error: {e}")
    finally:
        is_telemetry_streaming = False

if __name__ == "__main__":
    run_sender()
