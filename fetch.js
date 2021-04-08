function http_error(response, message) {
	if (message) {
		console.error(message);
	}
	if (response) {
		console.error(response);
	}
	return null;
}

async function loadTeams(_force=false) {
	//'https://cors-proxy.blaseball-reference.com/database/allTeams'
	const response = await fetch('https://api.blaseball-reference.com/v2/teams');
	if (!response.ok) {
		return http_error(response, "Error fetching teams from blaseball.com:");
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

async function loadStadiums(force=false) {
	const response = await fetch('https://api.sibr.dev/chronicler/v1/stadiums');
	if (!response.ok) {
		return http_error(response, "Error fetching stadium information from chronicler:");
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

function mutateKey(map, key, f) {
	map.set(key, f(map.get(key)));
}

async function loadChampionships(force=false) {
	var playoffs = [];
	const currentSeason = (await season.load(force)).seasonNumber;
	for (var i = 0; i <= currentSeason; i++) {
		playoffs.push((async function() {
			const response = await fetch(`https://cors-proxy.blaseball-reference.com/database/playoffs?number=${i}`);
			if (!response.ok) {
				return http_error(response, "Error fetching championship information:");
			}
			try {
				return await response.json();
			} catch (e) { // ignore empty json
				if (e instanceof SyntaxError) {
					return null;
				}
				throw e;
			}
		})());
	}
	const champs = new Map();
	for (const t of (await teams.load(force)).keys()) {
		champs.set(t, 0);
	}
	for (const playoff of await Promise.all(playoffs)) {
		console.log(playoff);
		if (!playoff) { continue; }
		mutateKey(champs, teams.byUUID.get(playoff.winner).url_slug, (wins) => wins+1);
	}
	return champs;
}

async function loadNoodle(force=false) {
	const response = await fetch('https://cors-proxy.blaseball-reference.com/api/getIdols');
	if (!response.ok) {
		return http_error(response, "Error fetching noodle information:");
	}

	const data = await response.json();
	return data.data.strictlyConfidential;
}

async function loadSeason(force=false) {
	var response = await fetch('https://api.blaseball-reference.com/v2/config');
	if (!response.ok) {
		return http_error(response, "Error fetching season information:");
	}

	const season_number = (await response.json()).defaults.season;

	response = await fetch(`https://cors-proxy.blaseball-reference.com/database/season?number=${season_number}`);
	if (!response.ok) {
		return http_error(response, "Error fetching season information:");
	}
	return await response.json();
}

async function loadStandings(force=false) {
	// fetch season # (and maybe standings) from blaseball-reference
	const standings_id = (await season.load(force)).standings;
	if (!standings_id) { return null; }

	//url escaping is for suckers
	const response = await fetch(`https://cors-proxy.blaseball-reference.com/database/standings?id=${standings_id}`);
	if (!response.ok) {
		return http_error(response, "Error fetching standings:");
	}
	return await response.json();
}

async function loadTeamData(team, force=false) {
	/// Load extended data for a team

	const [
		team_data,
		stadium_data,
		standings_data,
		champs_data
	] = await Promise.all([
		teams.load(force),
		stadiums.load(force),
		standings.load(force),
		champs.load(force)
	]);

	//load players
	const response = await fetch(`https://api.blaseball-reference.com/v1/currentRoster?slug=${team}&includeShadows=true`);
	if (!response.ok) {
		return http_error(response, "Error fetching roster information:");
	}
	const roster = await response.json();

	//fetch('https://api.blaseball-reference.com/v2/stats?type=season&group=hitting&fields=runs_batted_in&season=current&teamId=3f8bbb15-61c0-4e3f-8e4a-907a5fb1565e');

	return {
		// todo need # of championship wins
		team: team_data.get(team),
		stadium: stadium_data.get(team),
		champs: champs_data.get(team),
		runs: standings_data.runs[team_data.get(team).team_id],
		wins: standings_data.wins[team_data.get(team).team_id],
		roster: roster,
	}
}
