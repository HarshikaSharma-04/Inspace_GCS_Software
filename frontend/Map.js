let map = null;
let marker = null;
const cansatLocation = [26.69, 84.17];

export function Map(){
    const mapDiv = document.getElementById('map');
    if(mapDiv){
        mapDiv.style.height = '100%';
        mapDiv.style.width = '100%';
        mapDiv.style.display = 'block';
    }

    if(map !== null){
        setTimeout(() => map.invalidateSize(), 100);
        return;
    }

    map = L.map('map').setView(cansatLocation, 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // attribution: '© OpenStreetMap'
    }).addTo(map);

    marker = L.marker(cansatLocation)
        .addTo(map)
        .bindPopup("DJS ARYA")
        .openPopup();

    setTimeout(() => map.invalidateSize(), 200);
}
export function resizeMap() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}
export function updateMapLocation(lat, lng) {
    if (!map || !marker) return;

    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
}
