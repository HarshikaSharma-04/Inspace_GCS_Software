from port import Port
#port = detect()
p = Port("COM2") # change here
while True:
    cmd = input("Enter the command: ")
    p.write(cmd)    