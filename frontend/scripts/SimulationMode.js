let simulationModeActive = false;

export function isSimulationModeActive(){
  return simulationModeActive;
}

const simulationModeListeners = [];
export function onSimulationModeChange(callback){
  simulationModeListeners.push(callback);
}

const toggleSwitch = document.querySelector('.switch');

toggleSwitch.addEventListener('click', function(){
  const isChecked = this.getAttribute('aria-checked') === 'true';
  this.setAttribute('aria-checked', !isChecked);

  simulationModeActive = !isChecked;

  if(simulationModeActive){
    //console.log("Simulation mode enabled & active");
  } else{
    //console.log("Simulation mode disabled");
  }
  simulationModeListeners.forEach(callback => callback(simulationModeActive));
});