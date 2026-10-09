import json
import sys


def calculate_alt_from_pressure(command_str):
    """Parses CMD,041,SIM,91325 and calculates altitude."""
    try:
        parts = command_str.split(",")

        pressure_str = parts[-1].strip().removesuffix("N")
        pressure = float(pressure_str)

        if pressure <= 0:
            return None, None

        P0 = 101325.0
        exponent = 1 / 5.255

        altitude = 44330 * (1 - (pressure / P0) ** exponent)

        return altitude, pressure

    except (ValueError, IndexError):
        print(f"Skipping malformed SIM command: '{command_str}'", file=sys.stderr)
        return None, None


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--stream":
        for command in sys.stdin:
            altitude, pressure = calculate_alt_from_pressure(command)
            if altitude is None:
                print(json.dumps({"error": "Invalid simulation pressure command"}), flush=True)
            else:
                print(json.dumps({"altitude": altitude, "pressure": pressure}), flush=True)
        sys.exit(0)

    if len(sys.argv) != 2:
        print("Expected one simulation pressure command", file=sys.stderr)
        sys.exit(1)

    altitude, pressure = calculate_alt_from_pressure(sys.argv[1])
    if altitude is None:
        print("Invalid simulation pressure command", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({"altitude": altitude, "pressure": pressure}))
