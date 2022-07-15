// manages match scores
// FIXME: implementing finals made this file and many other files completely janky, and I'm embarrassed that some of the lines and practices in this file exist.  If it weren't 2 days before the tournament I'd rewrite the whole project

// PACKAGE IMPORTS //
const auth = require("./auth.js");
const api = require("./api.js");
const fetch = require("node-fetch");
const fs = require("fs");

// GLOBALS //

// number of unsatisfied calls to cache the match scores
// this exists mainly just to avoid a bunch of fs.writeFile calls happening to the same file at the same time
let unsatisfiedCaches = 0;

const cacheDir = "matchscores.txt";

/*
[
	[
		{
			score: number,
			participant: id,
		},
		{
			score: number,
			participant: id,
		}
	],
	...
]
*/
let matchScores = [];
let tourneyInFinals = false;

// UTILS //

// cache match scores
// skipCheck is only for internal use, don't set it to true outside of this function
async function cacheMatchScores(skipCheck){
	if(!skipCheck){
		unsatisfiedCaches++;
		
		if(unsatisfiedCaches > 1) return;
	}
	
	fs.writeFile(cacheDir, JSON.stringify(matchScores)+"\n"+tourneyInFinals.toString(), {}, err => {
		if(err) console.error(err);

		unsatisfiedCaches--;
		
		if(unsatisfiedCaches > 0){
			cacheMatchScores(true);
		}
	});
}

// load cached match scores
function loadCachedMatchScores(){
	let file = fs.readFileSync(cacheDir).toString();
	let items = file.split(/\r?\n/g);
	
	matchScores = JSON.parse(items[0]);
	tourneyInFinals = JSON.parse(items[1]);
}

// update a match score from a client update paylod
function updateMatchScore(payload){
	// get api values from api.js
	let tourneyInfo = api.getTourneyInfo();

	if(!tourneyInfo){
		console.error("No tourney info to update match score");
		return;
	}
	
	// extract important values from payload
	let matchIndex = payload.match_index;
	let matchNumber = matchIndex+1;
	let score = Math.max(payload.score, 0);
	let alliance = payload.alliance;

	let inFinals = api.tourneyInFinals();
	
	// check if tourney switched to finals since last update
	// also mess with match number
	if(inFinals){
		if(!tourneyInFinals){
			tourneyInFinals = true;
	
			// delete all old scores
			matchScores = [];

			cacheMatchScores();
		}

		// I hate this...
		if(matchIndex < 7){
			matchIndex = Math.ceil(matchNumber/3)-1;	
		} else {
			matchIndex = Math.ceil(matchIndex/3);
		}
	}
	
	// derive other values
	let tourneyUuid = tourneyInfo.id;
	let match = tourneyInfo.matches[matchIndex];
	let matchId = match.id;
	let participantId = match.participants[alliance].id;

	// check for existing scores
	if(!matchScores[matchIndex]){
		// create new scores
		matchScores[matchIndex] = [null, null];
	}

	let scores = matchScores[matchIndex];
	
	console.log("Saving score for match " + matchNumber + " alliance " + alliance);
	
	// assign score
	if(inFinals && matchNumber != 7){
		let set = (matchNumber-1-Math.floor((matchNumber-1)/6)) % 3;

		console.log("set " + set);
		
		if(!scores[alliance]) scores[alliance] = {scores: [], participant: null};
		
		scores[alliance].scores[set] = score;
		scores[alliance].participant = participantId;
	} else {
		scores[alliance] = {
			score: score,
			participant: participantId,
		};
	}

	// save match scores
	cacheMatchScores();
	
	// check if opposite score is present
	if(scores[1-alliance]){
		// if it is, prepare a server payload

		// first check credentials
		let credentials = auth.getCredentials();

		if(!credentials) return;
		
		// then figure out who's advancing
		let allianceAdvancing = false;
		let otherAdvancing = false;

		let allianceScoreSet = "";
		let otherScoreSet = "";
		
		if(scores[alliance].scores){
			// winner is most wins, but only if all sets are present
			if(scores[alliance].scores.length == scores[1-alliance].scores.length){
				let allianceWins = 0;
				let otherWins = 0;
				let sets = scores[alliance].scores.length;
				
				for(let i = 0; i < sets; i++){
					let allianceScore = scores[alliance].scores[i] || 0;
					let otherScore = scores[1-alliance].scores[i] || 0;

					allianceWins += + (allianceScore > otherScore);
					otherWins += + (otherScore > allianceScore);
					
					allianceScoreSet += allianceScore + ",";
					otherScoreSet += otherScore + ",";
				}

				allianceScoreSet = allianceScoreSet.slice(0, -1);
				otherScoreSet = otherScoreSet.slice(0, -1);
				
				allianceAdvancing = allianceWins > otherWins;
				otherAdvancing = !allianceAdvancing;
			} else {
				return;
			}
		} else {
			// winner is highest score
			allianceAdvancing = scores[alliance].score >= scores[1-alliance].score;
			otherAdvancing = scores[1-alliance].score >= scores[alliance].score;

			console.log(allianceAdvancing);
			console.log(otherAdvancing);
			
			allianceScoreSet = scores[alliance].score.toString();
			otherScoreSet = scores[1-alliance].score.toString();
		}
			
		// then create the server payload
		let serverPayload = {
			data: {
		    type: "Match",
		    attributes: {
		      match: [
		        {
		          participant_id: scores[alliance].participant,
		          score_set: allianceScoreSet,
		          advancing: allianceAdvancing
		        },
		        {
		        	participant_id: scores[1-alliance].participant,
		          score_set: otherScoreSet,
		          advancing: otherAdvancing
		        }
		      ]
		    }
		  }	
		};

		// send server payload
		fetch("https://api.challonge.com/v2/tournaments/"+tourneyUuid+"/matches/"+matchId+".json", {
			method: "PUT",
			redirect: "follow",
			headers: {
				"Authorization-Type": "v2",
				"Authorization": "Bearer " + credentials.access_token,
				"Content-Type": "application/vnd.api+json",
				"Accept": "application/json",
			},
			body: JSON.stringify(serverPayload),
		})
		.then(res => {
			console.log("match " + matchNumber + " scores uploaded");
		})
		.catch(console.error);
	}	
}

async function deleteScores(){
	matchScores = []; 	
	tourneyInFinals = false;
	
	await cacheMatchScores();
}

// exports
module.exports = {
	updateMatchScore: updateMatchScore,
	cacheMatchScores: cacheMatchScores,
	loadCachedMatchScores: loadCachedMatchScores,
	deleteScores: deleteScores
};