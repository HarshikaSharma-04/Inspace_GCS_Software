# this file will contains the logic for writing on port, virtual port
import serial
from handle_command import *
import time
from detect_port import *


# listen at the port
class Port:
    def __init__(self,port):
        self.PORT = port
        self.BAUD_RATE = "9600"
    
    def listen(self):
        try:
            with serial.Serial(self.PORT,self.BAUD_RATE,timeout=0.1) as ser:
                print(f"Listening on {self.PORT}....")
                # clear all prev. readings
                ser.reset_input_buffer()

                while True:
                    if ser.in_waiting > 0: # if there exists any bytes of data
                        data = ser.readline()
                        try:
                            decoded_data = data.decode('utf-8').strip()
                            print(f"[Data]: {decoded_data}")
                        except UnicodeDecodeError:
                            # Handle corrupted frames/binary chunks
                            print(f"[Raw Bytes]: {data}")
        except KeyboardInterrupt:
            print("User intruppted...")
        except serial.SerialException as e:
            print("Serial Error: ",e)
    def write(self, data):
        try:
            with serial.Serial(self.PORT, self.BAUD_RATE, timeout=0.1) as ser:
                if isinstance(data, str):
                    payload = data.encode('utf-8')
                else:
                    payload = data # Already bytes/bytearray (e.g., custom binary packet)

                bytes_written = ser.write(payload)
                
                ser.flush()
                # Optional debug print (can be removed later to clear logs)
                print(f"[Tx Successfully sent {bytes_written} bytes]")
                return True

        except serial.SerialException as e:
            print(f"Write Error on port {self.PORT}: {e}")
            return False

port = detect()
if port:
    p = Port(port)
    #p.listen()
else:
    print("Error: Targeted virtual bridge device is not plugged in or active.")