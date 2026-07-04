from port import Port
from detect_port import detect
port = detect()
p = Port("COM2")
while True:
    cmd = input("Enter the command: ")
    p.write(cmd)