let map = null;
const cansatLocation = [38.4137, -79.5863]; 

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
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker(cansatLocation)
        .addTo(map)
        .bindPopup("DJS ARYA")
        .openPopup();

    setTimeout(() => map.invalidateSize(), 200);
}
