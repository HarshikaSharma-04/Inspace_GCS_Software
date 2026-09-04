let map = null;
let currentMarker = null;
let initialMarker = null;
let flightPathPolyline = null;
let trajectoryCoordinates = [];
let circle = null;
const cansatLocation = [19.2243, 72.8680];
const greenIcon = new L.Icon({
    iconUrl: 'images/launch_pad.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'images/cansat.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

export function Map() {
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
        mapDiv.style.height = '100%';
        mapDiv.style.width = '100%';
        mapDiv.style.display = 'block';
    }

    if (map !== null) {
        setTimeout(() => map.invalidateSize(), 100);
        return;
    }

    map = L.map('map').setView(cansatLocation, 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);
    trajectoryCoordinates = [[cansatLocation[0], cansatLocation[1]]];
    circle = L.circle([19.2243, 72.8680], {
        color: 'green',
        fillColor: 'rgb(17, 255, 0)',
        fillOpacity: 0.4,
        radius: 100 // 100 meters
    }).addTo(map);
    flightPathPolyline = L.polyline([], {
        color: '#0c05e9',
        weight: 4,
        opacity: 0.85,
        smoothFactor: 1
    }).addTo(map);
    initialMarker = L.marker(cansatLocation, { icon: greenIcon })
        .addTo(map)
        .bindPopup("<b>Initial Position</b><br>Launch Site")
        .openPopup();
    currentMarker = L.marker(cansatLocation, { icon: redIcon })
        .addTo(map)
        .bindPopup("<b>DJS ARYA</b><br>Live Telemetry");

    setTimeout(() => map.invalidateSize(), 200);
}

export function resizeMap() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

export function updateMapLocation(lat, lng) {
    if (!map || !currentMarker) return;
    currentMarker.setLatLng([lat, lng]);
    trajectoryCoordinates.push([lat, lng]);
    flightPathPolyline.setLatLngs(trajectoryCoordinates);
    const autoPanToggle = document.getElementById('autoPanToggle');
    if (autoPanToggle && autoPanToggle.checked) {
        map.panTo([lat, lng]);
    }
}
export function clearMapTrajectory() {
    trajectoryCoordinates = [[cansatLocation[0], cansatLocation[1]]];
    if (flightPathPolyline) {
        flightPathPolyline.setLatLngs(trajectoryCoordinates);
    }
    if (currentMarker) {
        currentMarker.setLatLng(cansatLocation);
    }
    map.setView(cansatLocation, 13);
}