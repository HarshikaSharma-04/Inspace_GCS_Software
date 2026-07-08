import serial
import serial.tools.list_ports

def is_port_available(port_name):
    try:
        ser = serial.Serial(port_name, timeout=1)
        ser.close()
        return True
    except serial.SerialException:
        return False

def detect():
    name = "HHD Software Bridged Serial Port"
    ports = serial.tools.list_ports.comports()

    if not ports:
        return "No physical or virtual ports found."

    matched_ports = []

    for port in ports:
        print(f"{port.device} - {port.description}")
        matched_ports.append(port.device)

    for port in matched_ports:
        # Check for common XBEE USB serial port names => yaha name check karna hai
        if (
            "ttyUSB" in port or
            "ttyACM" in port or
            "COM" in port or
            "usbserial" in port or
            "usbmodem" in port
        ):
            if is_port_available(port):
                return port

    return "No available XBEE port found."