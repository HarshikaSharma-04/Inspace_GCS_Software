# this file will contains the logic for writing on port, virtual port
import serial
import time
from detect_port import *

class Port:
    def __init__(self, port):
        self.PORT = port
        self.BAUD_RATE = 9600  
        self.ser = None        
    def connect(self):  
        try:
            if self.ser is None or not self.ser.is_open:
                self.ser = serial.Serial(self.PORT, self.BAUD_RATE, timeout=0.1)
                print(f"Successfully connected to {self.PORT}...")
                self.ser.reset_input_buffer()
            return True
        except serial.SerialException as e:
            print(f"Connection Error on port {self.PORT}: {e}")
            return False

    def listen(self):
        try:
            # Check if bytes are present
            if self.ser.in_waiting > 0:
                data = self.ser.readline()
                try:
                    decoded_data = data.decode('utf-8', errors='ignore').strip()
                    if decoded_data:  # If it's not a blank line
                        return decoded_data
                except Exception:
                    return None
            return None 

        except serial.SerialException as e:
            print("Serial Read Error: ", e)
            return None

    def write(self, data):
        try:
            if self.ser is None or not self.ser.is_open:
                if not self.connect():
                    return False

            if isinstance(data, list):
                data = ",".join(map(str, data)) 
            
            if isinstance(data, str):
                payload = data.encode("utf-8")
            else:
                payload = data

            bytes_written = self.ser.write(payload)
            #self.ser.flush() 
            print(payload)
            return True

        except serial.SerialException as e:
            print(f"Write Error on port {self.PORT}: {e}")
            return False

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
            print(f"Port {self.PORT} closed safely.")

port = detect()
if port:
    p = Port(port)
else:
    print("Error: Targeted virtual bridge device is not plugged in or active.")