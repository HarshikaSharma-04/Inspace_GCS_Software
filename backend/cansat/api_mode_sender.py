import csv
import serial
import time
import os

PORT = "COM1"
BAUD = 115200
TELEMETRY_CSV = "telemetry_extended.csv"
SIMULATION_CSV = "sim.txt"

def wrap_in_api_frame(payload_str):
    """Wraps a string in a standard XBee 0x90 (Receive Packet) frame."""
    payload = payload_str.encode("ascii")
    header = b'\x90\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xFE\x01'
    frame_content = header + payload
    length = len(frame_content)
    checksum = 0xFF - (sum(frame_content) & 0xFF)
    return b'\x7E' + bytes([(length >> 8) & 0xFF, length & 0xFF]) + frame_content + bytes([checksum])

def parse_api_frame(ser):
    # 1. Look for start delimiter (0x7E)
    # We read one byte at a time until we find the start of a frame
    start_byte = ser.read(1)
    if not start_byte or start_byte != b'\x7E':
        return None

    print(f"[PARSE] Start delimiter: OK (0x7E)")

    # 2. Read length (2 bytes)
    length_bytes = ser.read(2)
    if len(length_bytes) < 2:
        return None
    length = (length_bytes[0] << 8) | length_bytes[1]
    print(f"[PARSE] Frame data length: {length} bytes")

    # 3. Read frame data + 1 byte for checksum
    full_payload = ser.read(length + 1)
    if len(full_payload) < length + 1:
        print("[PARSE] FAIL: Incomplete frame received")
        return None

    frame_data = full_payload[:length]
    received_checksum = full_payload[length]

    # 4. Verify Checksum
    computed_sum = sum(frame_data) & 0xFF
    computed_checksum = 0xFF - computed_sum

    if received_checksum != computed_checksum:
        print(f"[PARSE] FAIL: Checksum mismatch (Recv: {hex(received_checksum)}, Comp: {hex(computed_checksum)})")
        return None

    # 5. Parse Fields (Offsets are now relative to frame_data)
    frame_type = frame_data[0]
    # In XBee API, Receive Packet (0x90) and Transmit Request (0x10) have different offsets
    # If receiving from another XBee, it's likely 0x90
    if frame_type == 0x90:
        # 0x90 format: Type(1), Addr64(8), Addr16(2), Options(1), Data(n)
        rf_data = frame_data[12:].decode('utf-8', errors='replace')
    elif frame_type == 0x10:
        # 0x10 format: Type(1), ID(1), Addr64(8), Addr16(2), Bcast(1), Opt(1), Data(n)
        rf_data = frame_data[14:].decode('utf-8', errors='replace')
    else:
        rf_data = frame_data[1:].decode('utf-8', errors='replace') # Fallback

    return rf_data

def stream_csv_data(ser, file_path):
    """Reads rows from CSV and sends them as valid XBee API frames."""
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    try:
        with open(file_path, "r") as file:
            reader = csv.reader(file)
            next(reader)  # skip header
            for row in reader:
                if not row:
                    continue

                # Check for interrupt (2N) while streaming
                if ser.in_waiting > 0:
                    interrupt = parse_api_frame(ser)
                    if interrupt and "2N" in interrupt:
                        print("Stream interrupted by: 2N")
                        return

                telemetry_string = ",".join(row)
                api_packet = wrap_in_api_frame(telemetry_string)
                ser.write(api_packet)
                print(f"[{time.strftime('%H:%M:%S')}] Sent API Frame (Length {len(api_packet)})")
                time.sleep(0.2)

        print("--- End of file reached ---")
    except Exception as e:
        print(f"Streaming Error: {e}")

def run_sender():
    try:
        ser = serial.Serial(port=PORT, baudrate=BAUD, timeout=0.5)
        print(f"Serial port opened: {ser.name}")
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    print("--- GCS SENDER ACTIVE ---")
    print("Waiting for commands...")

    try:
        while True:
            if ser.in_waiting > 0:
                command = parse_api_frame(ser)

                if command:
                    print(f"Command Received: {command}")

                    if command == "1N":
                        print("Action: Starting Telemetry Stream from CSV...")
                        stream_csv_data(ser, TELEMETRY_CSV)

                    elif command == "4N":
                        print("\n[ALERT]: SIMULATION MODE HAS STARTED\n")
                        stream_csv_data(ser, SIMULATION_CSV)

                    elif command == "6N":
                        print("Action: Calibrating...")
                        ser.write(wrap_in_api_frame("CALIBRATION_SUCCESS"))

                    elif command == "2N":
                        print("Action: System Idle.")

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nSender stopped by user.")
    finally:
        if ser.is_open:
            ser.close()
            print("Serial port closed.")

if __name__ == "__main__":
    run_sender()