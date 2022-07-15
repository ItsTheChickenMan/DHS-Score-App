// GLOBALS //

// scorekeeper list
// manages the structure of the actual scorekeeper, see score.js for more details
const scorekeeper = new Scorekeeper(
{
	"Autonomous": [
		{
			name: "Parked on Coast?",
			type: "checkbox",
			worth: 6
		},
		{
			name: "Buoy Delivered?",
			type: "checkbox",
			worth: 12
		},
		{
			name: "Cargo Delivered",
			type: "number",
			worth: 10
		}
	],
	"TeleOp": [
		{
			name: "Cargo Delivered",
			type: "number",
			worth: 6
		}
	],
	"End Game": [
		{
			name: "Recovery Center Parking",
			type: "options",
			options: ["Not Parked", "Partially Parked", "Fully Parked"],
			worth: [0, 3, 6]
		},
		{
			name: "Saved the Castaway?",
			type: "checkbox",
			worth: 18
		},
		{
			name: "Duck on Tape?",
			type: "checkbox",
			worth: 20
		}
	],
	"Penalties": [
		{
			name: "Minor Penalties",
			type: "number",
			worth: -8
		},
		{
			name: "Major Penalties",
			type: "number",
			worth: -16
		}
	]
}
);

// MAIN //

// fetch credentials
getCredentials()
.then(status => {
  // true=successful
  if(status){
		// update status
		let status = document.getElementById("status-p");

		let statusMessage = "Fetching tourney info (should only be a few seconds)...";
		status.textContent = statusMessage;
		
		// fetch tournament info
		fetchTourneyInfo()
		.then(e => {
			document.body.removeChild(status);
			
			// show scorekeeper
			scorekeeper.show();
		}).catch(err => {
			status.innerHTML = err + "<br><br>If the error above starts with TypeError, reload the page.  It usually fixes it.<br>In fact, as a general rule of thumb, reloading the page will probably fix it anyways.  If it doesn't, get Phoenix";

			// also show the settings button cause why not
			document.body.appendChild(scorekeeper.settingsButton);
			document.body.appendChild(scorekeeper.statusBarStatusElement);
		});
  } else {
		document.getElementById("status-p").textContent = "Login required";
	}
})
.catch(console.error);


// EVENT LISTENERS //