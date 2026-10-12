import csv
import serial
import time
import os

class SimulationMode:
    def __init__(self):
        # commands sent in simulation mode
        self.invalid_commands = ["1N","2N"]

    def calculate_tti(self,desc_velocity,altitude):
        adjustment_factor = 0.000001 # avoid dividing by 0
        tti = float(altitude) / (float(desc_velocity) + adjustment_factor)
        return tti

    def calculate_alt_from_pressure(self,p_value):
        pressure = float(p_value)
        if pressure <= 0:
            return None, None
        P0 = 101325.0
        exponent = 1 / 5.255
        altitude = 44330 * (1 - (pressure / P0) ** exponent)
        return altitude, pressure

    def listen_and_transmit(self,p_values):
        '''Expected command format: 90325N -> 90325'''
        current_p = p_values.rstrip("N")
        new_alt, new_p = self.calculate_alt_from_pressure(current_p)
        return new_alt,new_p

    def read_csv(self, ser, cmd):
        # read the csv file
        if not os.path.exists("stress_csv.csv"):
            print("Error: File not found")
            return
        try:
            with open("stress_csv.csv", 'r') as file:
                reader = csv.reader(file)
                header = next(reader)
                for row in reader:
                    # Check for any incoming interrupts/commands while streaming
                    while ser.in_waiting > 0:
                        interrupt = ser.readline().decode("utf-8").strip().upper()
                        print("Interrupt: ", interrupt)
                        if interrupt == "5N":
                            print("Simulation mode stopped via interrupt.")
                            return

                    # Process simulation data for this row
                    alt, pressure = self.listen_and_transmit(cmd)
                    row[3] = str(alt)
                    row[4] = str(pressure)
                    
                    # Append the new calculated tti data
                    current_tti = self.calculate_tti(row[20], row[3])
                    print(current_tti)
                    row.append(str(current_tti))
                    
                    # Send the data row over serial
                    data_line = ",".join(row) + "\n"
                    ser.write(data_line.encode("utf-8"))
                    time.sleep(1)
                    
                print("End of file reached.")
        except Exception as e:
            print(f"Streaming Error: {e}")



