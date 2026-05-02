// Store trajectory data
let trajectoryData = {
  lat: [],
  lon: [],
  alt: []
};

// Initialize 3D Plot
function init3DPlot() {
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
      color: [0],
      colorscale: 'Jet',
      showscale: true,
      colorbar: {
        title: 'Alt (m)',
        thickness: 10,
        len: 0.6,
        x: 1.02
      }
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
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d']
  };

  Plotly.newPlot('plot-3d-container', [trace], layout, config);
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
  
  const lat = parseFloat(row.GPS_LATITUDE);
  const lon = parseFloat(row.GPS_LONGITUDE);
  const alt = parseFloat(row.GPS_ALTITUDE);
  
  if (isNaN(lat) || isNaN(lon) || isNaN(alt)) return;
  
  trajectoryData.lat.push(lat);
  trajectoryData.lon.push(lon);
  trajectoryData.alt.push(alt);
  
  const update = {
    x: [trajectoryData.lon],
    y: [trajectoryData.lat],
    z: [trajectoryData.alt],
    'marker.color': [trajectoryData.alt]
  };
  
  Plotly.restyle('plot-3d-container', update, [0]);
}

// Function to clear trajectory data
function clear3DPlot() {
  trajectoryData = { lat: [], lon: [], alt: [] };
  const update = {
    x: [[0]],
    y: [[0]],
    z: [[0]],
    'marker.color': [[0]]
  };
  Plotly.restyle('plot-3d-container', update, [0]);
}

// Make functions available globally
window.update3DPlot = update3DPlot;
window.clear3DPlot = clear3DPlot;
