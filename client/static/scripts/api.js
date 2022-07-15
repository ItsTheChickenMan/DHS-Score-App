// was dedicated to api requests but is now more focused on communicating with the server to make api requests

// GLOBALS //
let tourneyUuid = ""; // tourney uuid
let tourneyInfo = {}; // object for tournament info
let tourneyMatches = []; // all matches
let tourneyStage = ""; // group = group stage, final = final stage
let matchOffset = 0; // amount to offset the matchIndex by when sent to the server, based on how many matches were filtered

// UTILS //

// set the uuid from a url or uuid
// TODO: might want to make more adaptable for future games?
function setTourneyUuid(url){
	url = url.replace(/\/|https:|challonge\.com/g, "");

	tourneyUuid = url;
}

// fetch all matches manually
// relies on tourneyInfo being populated
// I hate the challonge API
async function fetchMatches(){
	// go through each match id and fetch full information
	let matches = tourneyInfo.data.relationships.matches.data;

	// check localstorage first though
	let localStorageMatches = JSON.parse(window.localStorage.getItem("match_data"));

	// if the lengths match (not switching tournament modes), keep local matches
	if(localStorageMatches){
		tourneyMatches = localStorageMatches;
		return;
	}

	let matchRequests = [];
	
	for(let match of matches){
		// match id
		let id = match.id;

		// make api request
		let req = apiRequest("/tournaments/"+tourneyUuid+"/matches/"+id+".json", "GET", undefined, );

		matchRequests.push(req);
	}

	let matchResponses = await Promise.all(matchRequests);
	let json = await Promise.all(matchResponses.map(res => res.json()));

	tourneyMatches.push(...json);
	
	// save tourney matches to localStorage to save on API calls
	window.localStorage.setItem("match_data", JSON.stringify(tourneyMatches));
}

// display an input box and button for user to paste in the tourney uuid
// resolves when user presses the done button
// DEPRECATED, the server now manages the tourney uuid
async function promptForTourneyUuid(){
	const uuidLabel = document.createElement("label");
	const uuidInput = document.createElement("input");
	const uuidButton = document.createElement("button");

	// set ids
	const prefix = "tourney-uuid";
	
	uuidLabel.id = prefix + "-label";
	uuidInput.id = prefix + "-input";
	uuidButton.id = prefix + "-button";

	// label stuff
	uuidLabel.textContent = "Paste the tournament url/uuid here to get started, and press Done when ready ";
	uuidLabel.for = uuidInput.id;

	// button stuff
	uuidButton.textContent = "Done";

	// push elements to page
	document.body.appendChild(uuidLabel);
	document.body.appendChild(uuidInput);
	document.body.appendChild(uuidButton);
	
	return new Promise((resolve, reject) => {
		// button click
		uuidButton.addEventListener("click", e => {
			// url
			let url = uuidInput.value;

			// remove elements from page
			document.body.removeChild(uuidLabel);
			document.body.removeChild(uuidInput);
			document.body.removeChild(uuidButton);
			
			// assign to tourney id
			setTourneyUuid(url);

			resolve("Done");
		});
	});
}

// api requests //
// all api requests rely on fetch and therefore are asynchronous

// make an api request
// path does not include the domain (https://api.challonge.com/v2/)
async function apiRequest(path, method="GET", data, returnPromise=false){
	if(!credentials || !credentials.access_token){
		throw new Error("Missing credentials");	
	}
	
	const url = apiDomain + path;

	const request = fetch(url, {
		method: method,
		body: data ? JSON.stringify(data) : undefined,
		redirect: "follow",
		// load headers
		headers: {
			// v2 oauth2 authorization
			"Authorization-Type": "v2",
			// not sure why the content type needs to be this
			"Content-Type": "application/vnd.api+json",
			// TODO: might vary?
			"Accept": "application/json",
			// auth
			"Authorization": "Bearer " + credentials.access_token
		}
	});

	if(returnPromise){
		return request;
	} else {
		return await request;
	}
}

// make a request for tournament info with the current tourney id
// also stores the info into tourneyInfo
/*async function fetchTourneyInfo(){
	if(tourneyUuid.length <= 0){
		throw new Error("No tourney uuid");
	}

	let res = await apiRequest("/tournaments/" + tourneyUuid + ".json");

	let json = await res.json();

	tourneyInfo = json;

	// also grab match data too cause why not
	await fetchMatches();
	
	return json;
}
*/

// ask the server for tourney info
async function fetchTourneyInfo(){
	// ask server politely
	let json = await fetch("/tourneyInfo").then(res => res.json());

	// store locally
	tourneyInfo = json;

	if(!tourneyInfo || !tourneyInfo.stage){
		throw new Error("No tournament info, the credentials are probably invalid for this tourney");
	}
	
	// check to make sure tourney has started
	if(tourneyInfo.stage == "pending"){
		throw new Error("The tournament hasn't started yet");
	}

	if(tourneyInfo.matches.length < 1){
		throw new Error("No matches for tournament were found");
	}
	
	// store tourneyMatches locally as well

	// in group stage, report the matches as is
	// in finals stage, drop the original matches (any with state "complete") and separate the rest into 3 different matches (which are sent to the server as the same match, but a different set)
	tourneyMatches = json.matches;
	tourneyStage = "group";
	
	// if stage contains "group", finals haven't started yet
	if(!tourneyInfo.stage.match(/group/g)){	
		tourneyStage = "finals";
		
		// drop any completed matches (should all be in order)
		// this algorithm assumes all completed matches are next to one another (because they're in the same stage, they should be)
		/*let lastComplete = -1;
		let index = tourneyMatches.length;
		
		while(lastComplete == -1 && index >= 0){
			index--;
			
			let match = tourneyMatches[index];

			if(match.state == "complete") lastComplete = index;
		}

		matchOffset = lastComplete+1;
			
		// remove completed matches
		tourneyMatches = tourneyMatches.slice(lastComplete+1);*/

		let newMatchList = [];
		
		// the remaining matches should be split into three
		for(let i = 0; i < tourneyMatches.length; i++){
			let match = tourneyMatches[i];

			// set the "set" property of this match
			match.set = 1;

			newMatchList.push(match);

			match.number = i+1;
			
			// skip third match, because bronze (leave as one set)
			if(i == 2) continue;
			
			// create two more identical matches
			for(let j = 0; j < 2; j++){
				let newMatch = structuredClone(match);

				newMatch.set = j+2;

				newMatchList.push(newMatch);
			}
		}

		tourneyMatches = newMatchList;
	}
}

// update the scores for a single match, for a single alliance
// matchNumber should not be zero indexed
// if alliance is 0, player1 is chosen (topmost team in bracket) otherwise player2
// this should only be used in the group stage, since the finals stage is 3 actual matches per lineup so it requires some extra code to work
async function updateMatchScoresGroupStage(matchNumber, score, alliance){
	// get match data
	let matchIndex = matchNumber-1;
	let matchData = tourneyMatches[matchIndex];

	// validate
	if(!matchData){
		throw new Error("invalid match number");
	}

	// ensure that the participants have been determined
	if(matchData.participants.length < 2){
		// alert user of error and exit peacefully
		alert("The teams for this match haven't been determined yet, so their scores can't be submitted");
		throw new Error("Read the alert");
	}
	
	// format match scores
	// TODO: determine tie system
	let serverPayload = {
		match_index: matchIndex,
		score: score,
		alliance: alliance
	};

	// send payload to host server, which manages it from here
	await fetch("/matchScores", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(serverPayload)
	});
}