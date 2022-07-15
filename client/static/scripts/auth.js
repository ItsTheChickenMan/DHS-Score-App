// GLOBALS //

const apiDomain = "https://api.challonge.com/v2";

// oauth constants
const redirectUri = "https://ScoreApp.dhsrobotics.repl.co/oauth";

const clientId = "b6fca03624df0ee4169438c7dd0f67cdc57120d0c1c6c1a8beea72d2f85bd3f0";

let credentials = {};

// UTILS //

// fetch credentials
async function getCredentials(){
  // check localstorage first
  let storage = window.localStorage;
  const status = document.getElementById("status-p");
  
  // if it's not there, ask the server for credentials
  if(!storage.getItem("access_token")){
    let res = await fetch("/creds");
    let json = await res.json();

    // if token still isn't available, user needs to be logged in
    // otherwise save the credentials to localStorage and then to here
    if(!json || !json.access_token){
      // create link to login site
      const url = getOAuthLink();

      const link = document.createElement("a");
      const blurb = document.createElement("p");

      link.innerText = "Click here to login to Challonge";
      link.target = "_top";
      link.href = url;

      blurb.innerHTML = "<strong>USE STEVEN'S ACCOUNT</strong>, or else the site can't access the proper tournament";

      // update status
      status.innerText += "login required";
      
      // throw onto the page wherever
      // TODO: probably throw this onto somewhere other than wherever, shouldn't be a big deal right now though
      document.body.appendChild(link);
      document.body.appendChild(blurb);
      
      // return false here to stop building the page
      return false;
    } else {
      // add to localstorage
      storage.setItem("access_token", json.access_token);
      storage.setItem("refresh_token", json.refresh_token);
    }
  }

  // get from localstorage
  credentials.access_token = storage.getItem("access_token");
  credentials.refresh_token = storage.getItem("refresh_token");

  // return true to confirm credentials
  return true;
}

// create the oauth link for the user to login with
function getOAuthLink(){
  const domain = "https://api.challonge.com/oauth/authorize";

	// TODO: figure out which scopes are necessary (including nearly all for now to avoid API issues)
  const scopes = "me tournaments:read tournaments:write matches:read matches:write participants:read participants:write attachments:read attachments:write";

  return `${domain}?scope=${scopes}&client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
}

function clearCredentials(){
	window.localStorage.removeItem("access_token");
	window.localStorage.removeItem("refresh_token");
}