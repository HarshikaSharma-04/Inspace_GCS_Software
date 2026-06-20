const packetNumbers = [1,2,3,4,5,6,7,8];
//these are all the assumed values for now
const data_altitude = [10,10.2,10.1,10,10,10,10,10];
const data_temperature = [23,24,25,25.5,26,27,26.5,27.2];
const voltage = [12.5,12.3,12.1,11.9,11.8,11.7,11.6,11.5];
const gyro_r = [0,5,10,7,3,-5,0,2];
const gyro_p = [2,4,3,6,8,5,7,4];
const gyro_y = [-3,0,2,4,1,5,-2,0];
const accel_r = [0.01,-0.02,0.03,0,0.01,0.04,0.03,0.05];
const accel_p = [0.03,0.02,-0.01,0,0.01,0.04,0.03,0.05];
const accel_y = [0.02,0.01,0.03,0.02,0.01,0.02,0.03,0.04];

const mag_r = [30,32,31,29,28,30,31,33];
const mag_p = [40,42,41,39,38,40,41,43];
const mag_y = [50,52,51,49,48,50,51,53];

const gps_lat = [19.01,19.02,19.03,19.04,19.05,19.06,19.07,19.08];
const gps_long = [72.81,72.82,72.83,72.84,72.85,72.86,72.87,72.88];
const gps_alt = [100,105,110,108,115,120,118,125];


//info of each
const chartsInfo = [
  {id: "chart-altitude", label: "ALTITUDE", data:data_altitude},
  {id: "chart-temperature", label: "TEMPERATURE", data:data_temperature},
  {id: "chart-voltage", label: "VOLTAGE", data:voltage},
  {id: "chart-gyro_r", label: "GYRO_R", data:gyro_r},
  {id: "chart-gyro_p", label: "GYRO_P", data:gyro_p},
  {id: "chart-gyro_y", label: "GYRO_Y", data:gyro_y},
  {id: "chart-accel_r", label: "ACCEL_R", data:accel_r},
  {id: "chart-accel_p", label: "ACCEL_P", data:accel_p}
];

// styling for the graphs or any sort of editing to be done from here.
chartsInfo.forEach(info => {
  const ctx = document.getElementById(info.id).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: packetNumbers,
      datasets: [{
        label: info.label,
        data: info.data,
        borderColor: '#0d05a7ff',
        backgroundColor: '#ffffff', 
        fill: false,
        borderWidth: 3, 
        pointRadius: 4, 
        pointHoverRadius: 6,
      }]
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: '#000000',  
            font: { weight: 'bold', size: 14 }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Packets",
            color: '#000000',
            font: { weight: 'bold', size: 14 }
          },
          ticks: {
            color: '#000000',
            font: { weight: 'bold', size: 12 }
          },
          grid: { 
            color: '#555555' 
          }
        },
        y: {
          title: {
            display: true,
            text: info.label,
            color: '#000000',
            font: { weight: 'bold', size: 14 }
          },
          ticks: {
            color: '#000000',
            font: { weight: 'bold', size: 12 }
          },
          grid: {
            color: '#555555'
          }
        }
      },
      layout: {
        padding: 10
      },
      backgroundColor: '#ffffff' 
    }
  });
});
