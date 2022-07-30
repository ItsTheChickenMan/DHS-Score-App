# DHS-Score-App

Scoring app used for the (second session of the) Coastal Cleanup outreach event hosted by teams 13406 and 7571

This was used to keep track of team scores and upload them to the bracket created in Challonge.  It worked with only one technical difficulty on competition day (which was repl related), so overall I'd say it was a success.

This is mainly an archive, and isn't meant to be used.  The code may or may not be used again next season.

# Notes/Thoughts

Here's a couple of takeaways from this project, in no particular order:
- Challonge API v2 could be better.  Some things were inconvienent, but others were plain broken.
	- Broken:
	   - In two stage tourneys (with group and finals stage), Challonge would use two different IDs for participants in match data, depending on if the match was a group match or a finals match.  However, only the IDs present in the finals match were actually valid for a request to `/tournaments/{url}/participants/{participant_id}.json`.  Thankfully, the data returned by a request for match data also included some data on the participants, which as enough for me to use.
	   - The `/tournaments/{url}/matches.json` endpoint doesn't work, at least for me.  Any request would result in a 500 internal server error without any other details on the error.
    - Inconveniences:
        - Many responses would have an array of loosely related data to the request with the key `included`, but documentation of the included data was non-existent.
        - When updating scores with a PUT request to the `/tournaments/{url}/matches/{match_id}.json` endpoint, scores for both participants have to be provided or Challonge will set the missing participant's score to 0.  This was especially irritating since the original structure for the project was focused around a lack of reliance on the server itself, but was then dependent on the server for managing scores because the clients can't send the scores on their own.
        - The code examples in the postman documentation were sometimes inconsistent with the documentation.
- The code is very messy primarily because I had to change the structure of the application halfway through to account for the Challonge API.  It's partially my fault for lacking foresight, but I'm still mad about it anyways.  If I were to rewrite this project (and I might), I would probably rewrite it using websockets instead.  I really wanted to stick with a structure that would make the clients independent of the repl server, but it doesn't seem like that's possible, so if there's going to be dependence I think that enabling the server to communicate with the clients freely would be much better.
- If I rewrite this, I should also come up with a more secure way to access the API without caching access tokens in an unencrypted, unhidden text file.
