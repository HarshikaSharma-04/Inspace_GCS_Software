# INSPACe 2026 GCS SOFTWARE  

## FILE SYSTEM OF THE REPO:  
1. In the folder  `sectionCSS` we have below files:

- `Map.css` styling for maps section.

2. `index.html` this file contains the structure for our GUI.

3. JavaScript Files: 
- `telemetry.js` Contains the core JS logic for the frontend inlcuding charts and 3D plot, and handles the socket connection.
- `Map.js` This JS file handles the fetching of Map images according to the CanSat's coordinates, from LeafletJS.
- `SimulationMode.js` This JS file handles the toggling on / off of Simulation mode.

4. `test_csv.csv` This is a sample csv file for the telemetry data that are being demonstrated on the GUI.

## STEPS TO START THE GCS SOFTWARE:  
1. clone the repo `git clone https://github.com/HarshikaSharma-04/Inspace_GCS_Software.git`
2. navigate to the repo directory where you cloned it: `cd Inspace_GCS_Software`
3. navigate to `backend` folder `cd backend`
4. install the node dependencies `npm install`
5. execute `npm run dev`
