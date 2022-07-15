// FIXME: super dangerous to keep tokens openly available to the public, definitely have this changed for comp day

// PACKAGE IMPORTS //
const fetch = require("node-fetch");
const querystring = require("querystring");
const fs = require("fs");

// GLOBALS //

// contains the access token and refresh token (should only need the access token, but no point in not having both)
let credentials = null;

// oauth constants
const redirectUri = "https://ScoreApp.dhsrobotics.repl.co/oauth";

const clientId = process.env['CLIENT_ID'];
const clientSecret = process.env['CLIENT_SECRET'];

// UTILS //

// call on init to briefly do some credential checks
function init(){
	// read old tokens
	let data = fs.readFileSync("tokens.txt").toString().split(/\r?\n/g);
	
	// load credentials (won't have all the fun fancy values like it does when it's fetched, but that's ok)
	credentials = {
		access_token: data[0],
		refresh_token: data[1]
	};
}

// fetch tokens using code
async function fetchCredentials(code){
  let res = await fetch("https://api.challonge.com/oauth/token", {
    method: "POST",
    body: querystring.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });

  let json = await res.json();

	// save credentials
  credentials = json;

	// also write them to tokens.txt
	fs.writeFile("tokens.txt", json.access_token + "\n" + json.refresh_token, {}, err => {
		if(err) console.error(err);
	});
	
  return json;
}

async function removeCredentials(){
	fs.writeFileSync("tokens.txt", "");

	credentials.access_token = null;
	credentials.refresh_token = null;
}

// return the credentials object
function getCredentials(){
  return credentials;
}

// exports
module.exports = {
	init: init,
  getCredentials: getCredentials,
  fetchCredentials: fetchCredentials,
	removeCredentials: removeCredentials
};