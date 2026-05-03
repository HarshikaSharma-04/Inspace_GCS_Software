// Store trajectory data
let trajectoryData = {
  lat: [],
  lon: [],
  alt: []
};

// Initialize 3D Plot
function init3DPlot() {
  console.log('Initializing 3D Plot...');
  
  const container = document.getElementById('plot-3d-container');
  if (!container) {
    console.error('3D plot container not found!');
    return;
  }
  
  const trace = {
    x: [0],
    y: [0],
    z: [0],
    mode: 'lines+markers',
    type: 'scatter3d',
    line: {
      color: '#6750a4',
      width: 6
    },
    marker: {
      size: 4,
      color: '#6750a4'
    },
    name: 'Flight Path'
  };

  const layout = {
    margin: { l: 0, r: 0, t: 10, b: 0 },
    scene: {
      xaxis: { title: 'Longitude', gridcolor: '#e0e0e0', showbackground: true },
      yaxis: { title: 'Latitude', gridcolor: '#e0e0e0', showbackground: true },
      zaxis: { title: 'Altitude (m)', gridcolor: '#e0e0e0', showbackground: true },
      camera: {
        eye: { x: 1.8, y: 1.8, z: 1.3 }
      },
      bgcolor: '#f8f9fa'
    },
    paper_bgcolor: '#ffffff',
    showlegend: false
  };

  const config = {
    responsive: true,
    displayModeBar: false
  };

  Plotly.newPlot('plot-3d-container', [trace], layout, config)
    .then(() => console.log('3D Plot initialized successfully!'))
    .catch(err => console.error('Error initializing 3D plot:', err));
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init3DPlot);
} else {
  init3DPlot();
}

// Function to update 3D plot with new telemetry data point
function update3DPlot(row) {
  if (!row) return;
  
  // Handle column names with or without spaces
  const lat = parseFloat(row.GNSS_LATITUDE || row[' GNSS_LATITUDE'] || row['GNSS_LATITUDE ']);
  const lon = parseFloat(row.GNSS_LONGITUDE || row[' GNSS_LONGITUDE'] || row['GNSS_LONGITUDE ']);
  const alt = parseFloat(row.GNSS_ALTITUDE || row[' GNSS_ALTITUDE'] || row['GNSS_ALTITUDE ']);
  
  console.log('3D Plot Update:', { lat, lon, alt, row }); // Debug log
  
  if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
    console.log('Invalid GPS data, skipping update');
    return;
  }
  
  trajectoryData.lat.push(lat);
  trajectoryData.lon.push(lon);
  trajectoryData.alt.push(alt);
  
  console.log('Trajectory data:', trajectoryData); // Debug log
  
  const update = {
    x: [trajectoryData.lon],
    y: [trajectoryData.lat],
    z: [trajectoryData.alt]
  };
  
  Plotly.restyle('plot-3d-container', update, [0]);
}

// Function to clear trajectory data
function clear3DPlot() {
  trajectoryData = { lat: [], lon: [], alt: [] };
  const update = {
    x: [[0]],
    y: [[0]],
    z: [[0]]
  };
  Plotly.restyle('plot-3d-container', update, [0]);
}

// Make functions available globally
window.update3DPlot = update3DPlot;
window.clear3DPlot = clear3DPlot;
