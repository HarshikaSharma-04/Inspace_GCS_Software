# this file contains the core logic for simulating CanSat's telemetry transmission
import csv
from detect_port import detect
from port import Port
import time
class Cansat:
    def __init__(self):
        self.port = detect()
        self.p = Port(self.port)
        self.path = "./csv/test_csv.csv"
        self.prevcmd = ""
        self.sim_mode = False
        self.flight_mode = False
        self.sim_mode_E = False
        self._file_handle = None
        self._csv_reader = None

    # read csv
    def read_csv(self):
        """Initializes the CSV stream safely without an internal blocking loop."""
        print("Operating on port: ", self.port)
        try:
            self._file_handle = open(self.path, mode="r", newline="", encoding="utf-8")
            self._csv_reader = csv.reader(self._file_handle)

            try:
                next(self._csv_reader)
            except StopIteration:
                print("File empty, nothing to read")
                return
            print("Telemetry stream ready")

        except FileNotFoundError:
            print("Incorrect file name or path")
            self.flight_mode = False
        except Exception as e:
            print("Exception: ", e)
            self.flight_mode = False

    # listen for commands
    def handleCommand(self):
        if not self.p.connect():
            print("Failed to initialize port.")
            return
        print("Awaiting commands...")
        while True:
            cmd = self.p.listen()
            if cmd:
                if cmd == "1N":
                    # start the transmission
                    self.flight_mode = True
                    print("Telemetry started")
                    self.read_csv()  # start the telemetry
                elif cmd == "2N":
                    # calibrate the altitude
                    # logic for altitude calibration
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
                        self.sim_mode = False
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
cansat = Cansat()
cansat.handleCommand()