import serial.tools.list_ports
def detect():
    name = "HHD Software Bridged Serial Port"
    ports = serial.tools.list_ports.comports()
    if not ports:
        return "No physical or virtual ports found."
    matched_ports = []
    for port in ports:
        # Strip spaces and match the unique part of your software bridge description
        if name in port.description.strip():
            matched_ports.append(port.device)
    if matched_ports:
        return matched_ports[0]
    else: return None
