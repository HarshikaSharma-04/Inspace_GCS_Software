// Store trajectory data
let trajectoryData = {
  lat: [],
  lon: [],
  alt: []
};

// Initialize 3D Plot
function init3DPlot() {
  const container = document.getElementById('plot-3d-container');
  if (!container) {
    console.error('3D plot container not found!');
    return;
  }

  // Color constants from your desired config
  const woodMain = "#ffffff",
    woodDarkText = "#131313",
    woodPath = "#2E7D32";

  const trace = {
    x: [0],
    y: [0],
    z: [0],
    mode: 'lines', // Changed to lines per second config
    type: 'scatter3d',
    line: {
      color: woodPath,
      width: 8
    },
    hovertemplate: "<b>Lat:</b> %{x:.4f}<br><b>Long:</b> %{y:.4f}<br><b>Alt:</b> %{z:.1f}m<extra></extra>",
    name: 'Flight Path'
  };

  const layout = {
    autosize: true,
    margin: { l: 0, r: 40, b: 40, t: 0 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "white",
    scene: {
      aspectmode: "manual",
      aspectratio: { x: 1.0, y: 0.8, z: 1.5 },
      bgcolor: woodMain,
      camera: {
        eye: { x: 2.0, y: -2.0, z: 1.2 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
      },
      xaxis: {
        title: {
          text: "Latitude",
          font: { color: woodDarkText, weight: "bold" },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
      yaxis: {
        title: {
          text: "Longitude",
          font: { color: woodDarkText, weight: "bold" },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
      zaxis: {
        title: {
          text: "Altitude",
          font: { color: woodDarkText, weight: "bold", size: 16 },
        },
        backgroundcolor: woodMain,
        gridcolor: woodDarkText,
        showbackground: true,
        tickfont: { color: woodDarkText },
      },
    },
    font: { family: "monospace", size: 14, color: woodDarkText },
    showlegend: false
  };

  const config = {
    responsive: true,
    displayModeBar: false
  };

  Plotly.newPlot('plot-3d-container', [trace], layout, config)
    .then(() => {
      console.log('3D Plot initialized successfully!');
      // Assuming you still want to track initialization state
      if (typeof is3DMapInitialized !== 'undefined') {
          is3DMapInitialized = true;
      }
    })
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
