export async function loadTeams(_force=false) {
	//'https://cors-proxy.blaseball-reference.com/database/allTeams'
	const response = await fetch('https://api.blaseball-reference.com/v2/teams');
	if (!response.ok) {
		console.error("Error fetching teams from blaseball.com:");
		console.error(response);
		return;
	}

	const data = await response.json();
	const teams = new Map();
	for (const team of data) {
		if (team.current_team_status !== "active") {
			//console.log("Skipping hidden team " + team.fullName);
			continue;
		}
		//team.url_slug = team.nickname.toLowerCase().replaceAll(' ', '-');
		if (team.team_emoji.slice(0,2) === '0x') {
			// convert emoji from unicode code point
			team.team_emoji = String.fromCodePoint(team.team_emoji);
		}
		teams.set(team.url_slug, team);
	}
	return teams;
}

export async function loadStadiums(force=false) {
	const response = await fetch('https://api.sibr.dev/chronicler/v1/stadiums');
	if (!response.ok) {
		console.error("Error fetching stadium information from chronicler:");
		console.error(response);
		return null;
	}

	const data = await response.json();
	await teams.load(force);

	const stadiums = new Map();
	for (const entry of data.data) {
		const stadium = entry.data;
		if (!teams.byUUID.has(stadium.teamId)) {
			console.log("Skipping unused stadium " + stadium.name);
			continue;
		}
		const team_slug = teams.byUUID.get(stadium.teamId).url_slug;
		stadium.team_slug = team_slug;
		stadiums.set(team_slug, stadium);
	}
	return stadiums;
}

export async function loadTeamData(team, force=false) {
	/// Load extended data for a team

	await teams.load(force);

	//load players
	//https://api.blaseball-reference.com/v1/currentRoster?slug=tacos&includeShadows=true
	//collect soul, ego, and perk

	//load stadium
	return teams.data.get(team);
}
