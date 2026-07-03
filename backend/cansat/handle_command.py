# this file handles all the incoming commands
from port import *

class Commands:
    def __init__(self):
        self.prevcmd = ""
        self.sim_mode = False
        self.flight_mode = False
        self.sim_mode_E = False
    def handleCommand(self,cmd):
        if cmd == "1N":
            # start the transmission
            print("Telemetry started")
            self.flight_mode = True
        elif cmd == "2N":
            # calibrate the altitude
            print("Altitude calibrated")
        elif cmd == "3N":
            if self.flight_mode:
                print("Cannot enter simulation mode during flight, continuing in fligh mode")
            # enables the sim mode
            else:
                print("Simulated mode enabled")
                self.sim_mode_E = True
        elif cmd == "4N":
            if self.sim_mode_E:
            # activates the sim mode
                print("Activated the sim mode")
                self.sim_mode = True
            else:
                # continue in flight mode
                print("Sim enable was not received, continuing in flight mode")
        elif cmd == "5N":
            if self.sim_mode:
                # deactivate the sim mode
                print("Simulation mode deactivated")
            else:
                print("Sim mode was not activated,continuing in flight mode")
        elif cmd == "6N":
            # activate the gyro
            print("MEC GYRO ON")
        elif cmd == "7N":
            # deactivate the gyro
            print("MEC GYRO OFF")
        elif cmd == "8N":
            # activate the servo
            print("SERVO ON")
        elif cmd == "9N":
            print("SERVO OFF")
        elif cmd == "10N":
            # barometric pressure values
            print("Starting to send pressure values")
        elif cmd == "11N":
            # stop the telemetry transmission
            print("Telemetry transmission stopped")
            self.flight_mode = False
        self.prevcmd = cmd

# to test the class logic uncomment below snippet and comment out the object 'c' for Commnads below it.
'''
if __name__ == "__main__":
    c = Commands()
    while True:
        cmd = input("CMD: ")
        c.handleCommand(cmd)
        if cmd == "q":
            break
'''
c = Commands()