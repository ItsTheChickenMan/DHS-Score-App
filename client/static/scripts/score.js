// scorekeeper class

/*
const settingsPrompt = new Prompt({
	htmlContent: `
		<p>* = reloads page</p>
		<button id="new-creds-button">New credentials*</button><br>
		<button id="reset-scores-button">Reset Server Scores</button>
	`,
	js: function(){
		// hide on click
		// manage click events
		document.body.addEventListener("mouseup", function(e){
			// temporary override to suppress the hide action
			// note: fixed spelling of "supress" but it's probably still in a few commits.  shhhh
			if(this.suppressHide){
				this.suppressHide = false;
				return;
			}

			console.log(document.activeElement);
			
			if(document.activeElement == this.itemContainer){
				return;
			}
			
			// hide the menu
			this.hide();
		}.bind(this));
		
		// get each button
		const newCreds = document.getElementById("new-creds-button");
		const resetScores = document.getElementById("reset-scores-button");

		// add events for each button
		newCreds.addEventListener("click", e => {
			// ask server to delete credentials
			fetch("/deleteCreds")
			.then(res => {
				// clear localStoarge
				clearCredentials();
				
				window.location.reload();
			})
		});

		resetScores.addEventListener("click", e => {
			fetch("/deleteScores")
			.then(() => {
				fetchTourneyInfo();
			});
		});
	}
});
*/

class Scorekeeper {
  /* LIST FORMAT:
	{
	  categoryName: [
	    {
	      name: "", // name of this item
	      type: "", // either checkbox or number
	      worth: number, // how many points each amount of type is worth
	    }
	  ]
	}
  */
  constructor(list){
    // list, just for reference
    this.list = list;

		this.settingsPrompt = new Prompt({
			htmlContent: `
				<p>* = reloads page</p>
				<button id="new-creds-button">New credentials*</button><br>
				<button style="display: none;" id="new-tourney-button">Load Different Tournament*</button>	
				<button id="reset-scores-button">Reset Server Scores</button>
			`,
			args: [this],
			js: function(scorekeeper){
				// hide on click
				// manage click events
				window.addEventListener("mouseup", function(e){
					// temporary override to suppress the hide action
					// note: fixed spelling of "supress" but it's probably still in a few commits.  shhhh
					if(this.suppressHide){
						this.suppressHide = false;
						return;
					}
					
					// hide the menu
					this.hide();
				}.bind(this));
				
				// get each button
				const newCreds = document.getElementById("new-creds-button");
				const newTourney = document.getElementById("new-tourney-button");
				const resetScores = document.getElementById("reset-scores-button");
		
				// add events for each button
				newCreds.addEventListener("click", e => {
					// ask server to delete credentials
					fetch("/deleteCreds")
					.then(res => {
						// clear localStoarge
						clearCredentials();
						
						window.location.reload();
					})
				});

				newTourney.addEventListener("click", e => {
						// prompt for tourney id
						let tourneyText = prompt("Enter the url or uuid for the tournament:");

						if(!tourneyText){
							return alert("Invalid");
						}

						fetch("/newTourney", {
							method: "POST",
							body: JSON.stringify({
								url: tourneyText
							})
						})
						.then(res => {
							window.location.reload();
						});
				});
				
				resetScores.addEventListener("click", e => {
					scorekeeper.statusBarStatusElement.textContent = "Resetting scores...";
						
					fetch("/reset")
					.then(() => {
						scorekeeper.statusBarStatusElement.textContent = "Refetching tourney info...";
						
						fetchTourneyInfo()
						.then(() => {
							scorekeeper.statusBarStatusElement.textContent = "Done";

							scorekeeper.clearStatusBarStatus(3000);

							scorekeeper.update();
						})
						.catch(console.error);
					});
				});
			}
		});
			
		// stage manage
		this.stage = tourneyStage;
		
    // main container for whole scorekeeper
    this.mainContainer = document.createElement("div");

    // array of all input elements/score multipliers, in the same order as in the original list
    this.inputs = [];

		// status bar values/creation
		this.matchValues = []; // cached values for each match

		this.currentMatch = 1; // min 1, max is number of matches in tournament
		
		// create status bar contianer
		this.statusBarContainer = document.createElement("div");

		this.statusBarContainer.id = "status-bar-div";

		// create status bar
		this.createStatusBar();

		// add status bar container to main container
		this.mainContainer.appendChild(this.statusBarContainer);
		
		// create scorekeeper
		for(let category in this.list){
			// create category container
			// maybe we don't need this many containers...
			const categoryContainer = document.createElement("div");

			// header for category
			const categoryHeader = document.createElement("h2");

			// stylize
			categoryHeader.innerText = category;

			// add to container
			categoryContainer.appendChild(categoryHeader);
			
			const list = this.list[category];

			for(let item of list){
	      // create new elements
	      const itemContainer = document.createElement("div");
	      const itemLabel = document.createElement("label");

				let itemInput;

				if(item.type == "options"){
		      itemInput = document.createElement("select");
				} else {
					itemInput = document.createElement("input");
		  
		      // type
		      itemInput.type = item.type;
				}
				
	      // ids
	      itemLabel.id = item.name + "-label";
	      itemInput.id = item.name + "-input";
	      itemLabel.for = itemInput.id;
	      
	      // content
				let descriptor = {
					checkbox: "(" + item.worth + " points)",
					number: "(" + item.worth + " points each)",
					options: ""
				};
				
	      itemLabel.textContent = item.name + " " + descriptor[item.type] + " ";

				// if type is options, do a few more select based things
				if(item.type == "options"){
					// create options
					for(let i = 0; i < item.options.length; i++){
						let optionText = item.options[i];
						let optionWorth = item.worth[i];
						let optionElement = document.createElement("option");

						optionElement.innerText = optionText + " (" + optionWorth + " points)";
						optionElement.value = optionText;

						itemInput.appendChild(optionElement);
					}
				}

				// update score indicator
				// "input" applies to both input and select elements so that's nice
				itemInput.addEventListener("input", e => {
					// update score
					this.updateScoreIndicator();
				});
				
	      // push to container
	      itemContainer.appendChild(itemLabel);
	      itemContainer.appendChild(itemInput);
	
	      categoryContainer.appendChild(itemContainer);
	
	      this.inputs.push([itemInput, item.worth]);
	    }	

			this.mainContainer.appendChild(categoryContainer);
		}

		// create submission bar
		this.submissionBarContainer = document.createElement("div");
		
		this.createSubmissionBar();
		
		// add submission container to main container
		this.mainContainer.appendChild(this.submissionBarContainer);
  }

	// MATCH MANAGING //

	// creates all the required elements for the status bar
	// NOTE: does not add to page
	createStatusBar(){
		// stylize container
		const statusHeaderContainer = document.createElement("div");

		statusHeaderContainer.id = "status-bar-header-container";
		statusHeaderContainer.style.display = "flex";
		statusHeaderContainer.style["align-items"] = "center";
		statusHeaderContainer.style.height = "50px";
		
		// create header
		this.statusBarHeader = document.createElement("h1");

		// id
		this.statusBarHeader.id = "status-bar-header";
		// NOTE: header text content is handled by update

		// stylize
		this.statusBarHeader.style.display = "inline"; // line up with buttons
		
		// create forward/backward buttons
		// TODO: I kinda hate this code and I want to rewrite it
		this.buttons = [];

		let directions = ["prev", "next"];
		let textOptions = ["< " + directions[0], directions[1] + " >"];
		let margins = ["right", "left"]
		let margin = "20px";
		
		for(let i = 0; i < 2; i++){
			this.buttons[i] = document.createElement("button");	

			const button = this.buttons[i];
			const direction = directions[i];

			// id
			button.id = "status-bar-" + direction + "-button";

			// text
			const text = textOptions[i]; // choose between < and >	

			button.textContent = text;

			// stylize
			button.style["margin-" + margins[i]] = margin;
			
			// button function
			button.addEventListener("click", e => {
				// transforms i from 0-1 to -1-1
				const change = i*2 - 1;

				this.saveCurrentValues();
				
				this.currentMatch += change;

				// clamp to appropriate values
				this.currentMatch = Math.min(this.currentMatch, tourneyMatches.length);
				this.currentMatch = Math.max(this.currentMatch, 1);
				
				this.update();
			});

			// add to container
			statusHeaderContainer.appendChild(button);

			// if this is the first button, add the header
			// I hate this as much as you do
			if(i == 0){
				// add to container
				statusHeaderContainer.appendChild(this.statusBarHeader);
			}
		}

		this.statusBarContainer.appendChild(statusHeaderContainer);

		// create alliance switch
		const allianceSwitchLabel = document.createElement("label");
		this.allianceSwitch = document.createElement("select");

		this.allianceSwitch.id = "status-bar-alliance-select";
		allianceSwitchLabel.for = this.allianceSwitch.id;

		allianceSwitchLabel.textContent = "CURRENTLY SELECTED ALLIANCE: ";

		this.allianceSwitch.addEventListener("change", e => {
			// save old values
			this.saveCurrentValues(1-this.allianceSwitch.selectedIndex)
			
			// update values
			this.loadExistingValues();

			// recompute score
			this.updateScoreIndicator();
		});
		
		// create two generic options (these get changed by update)
		for(let i = 0; i < 2; i++){
			const option = document.createElement("option");

			option.id = "status-bar-alliance-switch-option-" + (i+1);
			option.textContent = "(None)";

			this.allianceSwitch.appendChild(option);
		}

		// push both to container
		this.statusBarContainer.appendChild(allianceSwitchLabel);
		this.statusBarContainer.appendChild(this.allianceSwitch);

		// create the stage toggler
		this.stageToggle = document.createElement("button");

		// stylize
		this.stageToggle.style.display = "inline";
		this.stageToggle.style["margin-left"] = "5px";

		this.stageToggle.textContent = "Switch to Finals Stage";
		this.stageToggle.title = "If the finals stage has begun, this will fetch the finals stage matches.";

		// click event (attempt to switch to finals mode and fail if still in group stage)
		this.stageToggle.addEventListener("click", e => {
			// update status
			this.statusBarStatusElement.textContent = "Loading...";
			
			// check if server is in finals
			fetch("/inFinals")
			.then(res => res.json())
			.then(inFinals => {
				// if we're in finals, re-fetch tourney data
				if(inFinals){
					fetchTourneyInfo()
					.then(() => {
						// reset current match if overflowing
						if(this.currentMatch > tourneyMatches.length){
							this.currentMatch = 1;
						}

						// clear match values
						this.matchValues = [];
						
						// update scorekeeper to renew values
						this.update();
						
						this.statusBarStatusElement.textContent = "Final stage matches fetched!";

						this.clearStatusBarStatus(2000);
					})
					.catch(console.error);
				} else { // otherwise, let user know we're not in finals yet
					this.statusBarStatusElement.textContent = "The final stage hasn't started yet.";

					this.clearStatusBarStatus(2000);
				}
			})
			.catch(console.error);
		});

		// add to status bar
		this.statusBarContainer.appendChild(this.stageToggle);

		this.settingsButton = document.createElement("button");

		// stylize
		this.settingsButton.textContent = "Settings";
		this.settingsButton.style.display = "inline";
		this.settingsButton.style["margin-left"] = "5px";

		this.settingsButton.addEventListener("click", e => {
			this.settingsPrompt.show(e.clientX, e.clientY);
		});

		this.statusBarContainer.appendChild(this.settingsButton);
		
		// create status element
		this.statusBarStatusElement = document.createElement("p");

		// stylize
		this.statusBarStatusElement.style.display = "inline";
		this.statusBarStatusElement.style["margin-left"] = "10px";
		
		// append to container
		this.statusBarContainer.appendChild(this.statusBarStatusElement);
	}

	// clear status bar status element
	clearStatusBarStatus(delay=2000){
		if(!delay){
			this.statusBarStatusElement.textContent = "";
		} else {
			window.setTimeout(() => {
				this.statusBarStatusElement.textContent = "";
			}, delay);
		}
	}

	// clear submission bar status element
	clearSubmissionBarStatus(delay=2000){
		if(!delay){
			this.submissionBarStatusElement.textContent = "";
		} else {
			window.setTimeout(() => {
				this.submissionBarStatusElement.textContent = "";
			}, delay);
		}
	}
	
	// create the submission bar on the bottom of the scorekeeper
	// NOTE: does not add to page
	createSubmissionBar(){
		// create elements
		this.scoreIndicator = document.createElement("p");
		this.submissionButton = document.createElement("button");

		// stylize
		this.scoreIndicator.textContent = "Score: 0";

		this.submissionButton.textContent = "Submit Score";
		this.submissionButton.title = "This will upload the score above to the server.\nThe score won't be displayed in the bracket until both scores for this match have been uploaded.\nThe score can be updated at any time by resubmitting.";

		// create status element
		this.submissionBarStatusElement = document.createElement("p");

		// stylize
		this.submissionBarStatusElement.style.display = "inline";
		this.submissionBarStatusElement.style["margin-left"] = "10px";
		
		// event listener for button
		this.submissionButton.addEventListener("click", e => {
			// get alliance to report based on selected index of allianceSwitch

			let score = this.getScore();
			let alliance = this.allianceSwitch.selectedIndex;
			
			updateMatchScoresGroupStage(this.currentMatch, score, alliance)
			.then(() => {
				console.log("life is pain");
				
				this.submissionBarStatusElement.textContent = "Successfully uploaded";

				this.clearSubmissionBarStatus(2000);
			})
			.catch(console.error);
		});

		this.submissionBarContainer.appendChild(this.scoreIndicator);
		this.submissionBarContainer.appendChild(this.submissionButton);
		this.submissionBarContainer.appendChild(this.submissionBarStatusElement);
	}

	updateScoreIndicator(){
		this.scoreIndicator.textContent = "Score: " + this.getScore();
	}
	
	// updates the status bar and the scorekeeper
	update(){
		// load stage just in case it changes
		this.stage = tourneyStage;
		
		// update match header
		let currentMatch = tourneyMatches[this.currentMatch-1];
		let matchNumber = this.currentMatch;
		let closingText = ")";
		
		if(this.stage == "finals"){
			matchNumber = currentMatch.number;
			closingText = ", set " + currentMatch.set + ")";
		}
		
		this.statusBarHeader.textContent = "Match " + matchNumber + " (" + this.stage + " stage" + closingText;
		
		// update alliance options
		
		// assign each alliance name to an allianceSwitch option 
		for(let i = 0; i < 2; i++){
			let name = currentMatch.participants[i]?.name ?? "(Not Determined)";
			let option = this.allianceSwitch.options[i];

			// assign name to option content
			option.textContent = name;
		}
		
		// load cached values
		this.loadExistingValues();

		// recompute score
		this.updateScoreIndicator();
	}

	// save the current input values into the appropriate matchValues index
	saveCurrentValues(allianceOverride){
		// fetch selected alliance
		let alliance = allianceOverride == null ? this.allianceSwitch.selectedIndex : allianceOverride;

		if(!this.matchValues[this.currentMatch]) this.matchValues[this.currentMatch] = [];

		// initialize if undefined
		if(!this.matchValues[this.currentMatch][alliance]) this.matchValues[this.currentMatch][alliance] = [];

		// loop through all input elements
		for(let i = 0; i < this.inputs.length; i++){
			let inputArray = this.inputs[i];
			let inputElement = inputArray[0];
			let inputWorth = inputArray[1];

			switch(inputElement.type){
				case "checkbox":
					this.matchValues[this.currentMatch][alliance][i] = inputElement.checked;
					break;
				case "select-one":
					this.matchValues[this.currentMatch][alliance][i] = inputElement.selectedIndex;
					break;
				case "number":
				default:
					this.matchValues[this.currentMatch][alliance][i] = inputElement.value;
					break;
			}
		}
	}
	
	// search this.matchValues for existing values for this match
	loadExistingValues(){
		let alliance = this.allianceSwitch.selectedIndex;
		let values = this.matchValues[this.currentMatch] ? this.matchValues[this.currentMatch][alliance] : null;
		
		if(!values) values = [];

		// loop through all input elements
		for(let i = 0; i < this.inputs.length; i++){
			let inputArray = this.inputs[i];
			let inputElement = inputArray[0];
			let inputWorth = inputArray[1];
			let value = values[i] || "";

			// take different action depending on input type
			switch(inputElement.type){
				case "checkbox":
					inputElement.checked = value;
					break;
				case "select-one":
					inputElement.selectedIndex = value;
					break;
				case "number":
				default:
					inputElement.value = value;
					break;
			}
		}
	}
	
  // show to a container (or just the document body by default)
  show(container=document.body){
		// update once to initialize all values
		this.update();
		
    container.appendChild(this.mainContainer);
  }
  
  // determine the current score based on all of the inputs
  getScore(){
    // base score
		let score = 0;
		
    // loop through each input for a value
    // NOTE: treats absence of value as 0
		for(let input of this.inputs){
			let element = input[0];
			let worth = input[1];
			
			// total point value
			let pointValue = 0;
			
			// if worth is an array, this is an options input
			if(Array.isArray(worth)){
				// get selected index
				let index = element.selectedIndex;

				// if invalid, skip
				if(index == -1) continue;

				// add points
				pointValue = worth[index];
			} else {
				// value
				let value = 0;
				
				if(element.type == "checkbox"){
					value = + element.checked; // unary + converts boolean to integer (in this case 0 or 1)
				} else {
					value = parseInt(element.value);
				}
	
				// validate
				if(!value || value.length < 1){
					continue; // ignore this input altogether
				}

				pointValue = value * worth;
			}

			// add to score
			score += pointValue;
		}

		// return the final score
		return score;
  }
}