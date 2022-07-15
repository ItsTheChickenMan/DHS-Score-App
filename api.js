// manages serverside api requests

// PACKAGE IMPORTS //
const fs = require("fs");
const auth = require("./auth.js");
const fetch = require("node-fetch");

// GLOBALS //
const apiDomain = "https://api.challonge.com/v2";
const newlineRegex = /[?:\r?\n)]+/g; // mainly for the split function to avoid annoying blank items between multiple newlines
const urlRegex = /\/|https:|challonge\.com/g;

// non-static globals

// a cache of all relevant info from a tourney info fetch
/*
{
	id: "",
	stage: "",
	matches: [
		{
			id: "",
			participants: [
				???
			],
		}
	]
}
*/
let tourneyCachedInfo = {};
let tourneyGroupStageMatchCount = 0; // I hate this!

// load tourneydata from cache file
async function init(url){
	// load tourneydata.txt
	let data = fs.readFileSync("tourneydata.txt").toString();
	
	// parse tourney data
	let terms = data.split(newlineRegex);

	// extract
	tourneyCachedInfo.id = url ? url.replace(urlRegex, "") : terms[0];
	tourneyGroupStageMatchCount = terms[1];
	
	// fetch tourney info (stage, matches, etc.) 
	let credentials = auth.getCredentials();
	
	if(credentials.access_token){
		await fetchTourneyInfo();
	}
}

// make an api request
// path does not include the domain (https://api.challonge.com/v2/)
async function apiRequest(path, returnPromise=false, method="GET", data){
	// check for valid credentials
	let credentials = auth.getCredentials();
	
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

// fetch tourney info from the server and cache it to tourneyCachedInfo
async function fetchTourneyInfo(){
	if(tourneyCachedInfo.id.length <= 0){
		throw new Error("No tourney uuid");
	}

	let res = await apiRequest("/tournaments/" + tourneyCachedInfo.id + ".json");

	let tourneyInfo = await res.json();
	
	// fetch match data

	// if there's an error, rip I guess
	if(tourneyInfo.errors){
		throw new Error(tourneyInfo.errors.detail);
	}
	
	// load the values into tourneyCachedInfo
	tourneyCachedInfo = {
		id: tourneyCachedInfo.id, // this is dumb thing, but it works and I'm tired so I don't care
		stage: tourneyInfo.data.attributes.state,
		matches: tourneyInfo.data.relationships.matches.data // doesn't contain extra info
	};

	// strip extra matches from cached info
	if(tourneyCachedInfo.matches.length != tourneyGroupStageMatchCount){
		tourneyCachedInfo.matches = tourneyCachedInfo.matches.slice(tourneyGroupStageMatchCount);

		// reorder match 3 and 4 because bronze
		let temp = tourneyCachedInfo.matches[3];
		tourneyCachedInfo.matches[3] = tourneyCachedInfo.matches[2];
		tourneyCachedInfo.matches[2] = temp;
	}

	if(tourneyCachedInfo.stage != "pending"){
		// also fetch match data
		await fetchMatchData().catch(console.error);
	}
}

// fetch match data for each match present in tourneyInfo
async function fetchMatchData(){
	let fetchPromises = [];

	for(let match of tourneyCachedInfo.matches){
		if(!match) throw new Error("Match is undefined");
		
		let id = match.id;
			
		let prom = apiRequest("/tournaments/"+tourneyCachedInfo.id+"/matches/"+id+".json", true);	

		fetchPromises.push(prom);
	}

	let matchResponses = await Promise.all(fetchPromises);
	let matchInfo = await Promise.all(matchResponses.map(res => res.json()));

	// keep necessary values in tourneyCachedInfo
	// FIXME: things might possibly break if the stage of the tournament changes exactly between when the tourney info is fetched and the match data is fetched
	for(let i = 0; i < tourneyCachedInfo.matches.length; i++){
		let cachedMatch = tourneyCachedInfo.matches[i];
		let moreMatchData = matchInfo[i]; // I can't think of a better name for this variable...

		// add state
		cachedMatch.state = moreMatchData.data.attributes.state;
		
		// add participants
		let participants = moreMatchData.included;

		// create participants array if necessary
		cachedMatch.participants = cachedMatch.participants || [];

		// get participant data
		for(let participant of participants){
			// check that the type is a participant, just to be sure
			// technically there's no reason for me to believe included could contain anything else, but I don't want to risk it
			if(participant.type != "participant") continue;

			// add to cached match
			cachedMatch.participants.push({
				id: participant.id,
				name: participant.attributes.name
			});
		}
	}
}

// return true if tournament is in finals, otherwise false
function tourneyInFinals(){
	// just look for the word "group", if it occurs more than 0 than we're not in finals yet (including group stage finalized)
	return !tourneyCachedInfo.stage.match(/group/g);
}

function getTourneyInfo(){
	return tourneyCachedInfo;	
}

module.exports = {
	init: init,
	getTourneyInfo: getTourneyInfo,
	apiRequest: apiRequest,
	fetchTourneyInfo: fetchTourneyInfo,
	fetchMatchData: fetchMatchData,
	tourneyInFinals: tourneyInFinals
};