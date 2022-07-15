// PACKAGES //
const express = require("express"); // express for hosting
const path = require("path");
const fs = require("fs");
const auth = require("./auth.js");
const matchManager = require("./matchmanager.js");
const api = require("./api.js");

// STATIC GLOBAL VARS

// port for the client window.  repl doesn't really care what this value is, though
let port = 8080;

// root directory of client files
const clientDir = "./client/";
const clientRootDir = path.join(__dirname, clientDir);
const staticDir = path.join(clientRootDir, "static");

// express application
const app = express();

// AUTH SETUP
auth.init();

// API SETUP
api.init().catch(console.error);

// MATCH MANAGER SETUP
matchManager.loadCachedMatchScores();

// EXPRESS SETUP

// set static directory (makes serving scripts/stylesheets/etc. easier)
app.use("/static", express.static(staticDir));

// default path, responds with full client interface
app.get("/", (req, res) => {
	res.sendFile("index.html", {
		root: clientRootDir
	});
});

// uptime robot ping
app.get("/uptime", (req, res) => {
	res.send("score app online").end();
});

// client requests oauth credentials
app.get("/creds", (req, res) => {
  // send creds
  let creds = auth.getCredentials();

  res.send(JSON.stringify(creds)).end();
});

app.get("/deleteCreds", (req, res) => {
	// remove credentials
	auth.removeCredentials()
	.then(() => {
		res.send("Done").end();
	})
});

app.get("/reset", (req, res) => {
	matchManager.deleteScores()
	.then(() => {
		api.fetchTourneyInfo()
		.then(() => {
			res.send("Done").end();
		}).catch(console.error);
	}).catch(console.error);
});

// client requests to switch itself to finals mode
app.get("/inFinals", (req, res) => {
	// refetch tourney data
	// FIXME: it's probably dangerous to allow the client to force the server to make tons of api requests, would probably need a timeout or something if this was for general use but for now I can just tell the scorers in person not to spam the button
	api.fetchTourneyInfo()
	.then(() => {
		// tell client if we're in finals or not
		res.send(api.tourneyInFinals().toString()).end();
	})
	.catch(console.error);
});

// client needs tourney data
app.get("/tourneyInfo", (req, res) => {
	// if tournament is pending or matches aren't there, reload match info just in case the tournament hasn't been started yet
	let tourneyInfo = api.getTourneyInfo();

	if(!tourneyInfo || !tourneyInfo.stage || tourneyInfo.stage == "pending"){
		api.fetchTourneyInfo()
		.then(() => {
			res.send(JSON.stringify(api.getTourneyInfo())).end();
		});
	} else {
		res.send(JSON.stringify(tourneyInfo)).end();
	}
});

app.set("query parser", "simple");

// oauth redirect
app.get("/oauth", (req, res) => {
  // send user to oauth.html, which redirects to the right site once logged in
  res.sendFile("oauth.html", {
    root: clientRootDir
  });
	
	// fetch other credentials using code
  if(req.query.code){
		auth.fetchCredentials(req.query.code)
		.catch(console.error);
	}
});

app.use(express.json());

app.post("/matchScores", (req, res) => {
	let serverPayload = req.body;

	matchManager.updateMatchScore(serverPayload);

	res.send("Done").end();
});

app.post("/newTourney", (req, res) => {
	// reset tourney info
	api.init(req.body.url)
	.then(() => {
		res.send("Done").end();		
	})
});

// start listening
app.listen(port, function(){
	console.log("Server is listening");
});