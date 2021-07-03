class StatusLog {
	constructor(elem) {
		this.elem = elem;
		this._ops = new Map();
	}

	register(key, text) {
		if (this._ops.get(key)) {
			return this._ops.get(key);
		}
		const elem = document.createElement("div");
		elem.className = "status-msg hidden";
		elem.innerHTML = text;
		this._ops.set(key, elem);
		this.elem.appendChild(elem);
		window.getComputedStyle(elem).opacity; // force reflow
		elem.classList.remove("hidden");
	}

	success(key, msg) {
		const elem = this._ops.get(key);
		if (!elem) return;
		this._ops.delete(key);

		elem.classList.add("success");
		elem.innerHTML += msg;
		setTimeout(() => this._finish(elem), 1000);
	}

	fail(key, msg) {
		const elem = this._ops.get(key);
		if (!elem) return;
		this._ops.delete(key);

		elem.classList.add("failed");
		elem.innerHTML = msg;
		setTimeout(() => this._finish(elem), 5000);
	}

	finish(key) {
		const elem = this._ops.get(key);
		if (!elem) return;
		this._ops.delete(key);

		this._finish(elem);
	}

	_finish(elem) {
		elem.classList.add("hidden");
		setTimeout(() => this.elem.removeChild(elem), 5000);
	}
}

statusLog = new StatusLog(document.getElementById('status'));

async function json_request(url, status_msg, fail_msg, key) {
	if (!fail_msg) {
		status_msg = `${status_msg}...`
		fail_msg = `Failed to ${status_msg[0].toLowerCase()}${status_msg.slice(1)}`;
	}
	key = key || status_msg;
	statusLog.register(key, status_msg);
	var response;
	try {
		response = await fetch(url);
	} catch (e) {
		statusLog.fail(key, `${fail_msg}`);
		throw e;
	}
	if (!response.ok) {
		const msg = `${fail_msg} (${response.status} ${response.statusText})`;
		statusLog.fail(key, msg);
		throw new Error(msg);
	}
	try {
		const text = await response.text();
		if (text.trim().length == 0) { // accept empty JSON as null
			statusLog.finish(key);
			return null;
		}
		const result = JSON.parse(text);
		statusLog.success(key, " Done");
		return result;
	} catch (e) {
		statusLog.fail(key, `${fail_msg} (Couldn't parse JSON)`);
		throw e;
	}
}

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
	const data = await json_request(
		'https://api.blaseball-reference.com/v2/teams',
		"Fetching teams list",
	);

	const teams = new Map();
	for (const team of data) {
		console.log(team)
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
	const data = await json_request(
		'https://api.sibr.dev/chronicler/v1/stadiums',
		"Fetching stadium information",
	);

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
		playoffs.push(json_request(
			`https://cors-proxy.blaseball-reference.com/database/playoffs?number=${i}`,
			`Fetching season ${i} playoffs`,
		));
		/*
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
		*/
	}
	const champs = new Map();
	for (const t of (await teams.load(force)).keys()) {
		champs.set(t, 0);
	}
	for (const playoff of await Promise.all(playoffs)) {
		//console.log(playoff);
		if (!playoff || !playoff.winner) continue;
		mutateKey(champs, teams.byUUID.get(playoff.winner).url_slug, (wins) => wins+1);
	}
	return champs;
}

async function loadNoodle(force=false) {
	const data = await json_request(
		'https://cors-proxy.blaseball-reference.com/api/getIdols',
		"Fetching idols board"
	);
	return data.data.strictlyConfidential;
}

async function loadSeason(force=false) {
	const data = await json_request(
		'https://api.blaseball-reference.com/v2/config',
		"Fetching current season"
	);
	const season_number = data.defaults.season;

	return await json_request(
		`https://cors-proxy.blaseball-reference.com/database/season?number=${season_number}`,
		"Fetching season information"
	);
}

async function loadStandings(force=false) {
	const standings_id = (await season.load(force)).standings;
	if (!standings_id) { return null; }

	//url escaping is for suckers
	return await json_request(
		`https://cors-proxy.blaseball-reference.com/database/standings?id=${standings_id}`,
		"Fetching standings"
	);
}

async function loadTeamData(teamName, force=false) {
	/// Load extended data for a team

	const basic_data = (await teams.load(force)).get(teamName);
	const team_id = basic_data.team_id;

	const stadium = stadiums.load(force);
	const standing = standings.load(force);

	const team_data = await json_request(
		`https://cors-proxy.blaseball-reference.com/database/team?id=${team_id}`,
		`Fetching ${basic_data.nickname} information`
	);

	let player_ids = [];
	for (key of ["lineup", "rotation", "shadows"]) {
		player_ids = player_ids.concat(team_data[key]);
	}

	const [
		stadium_data,
		standings_data,
		roster_data
	] = await Promise.all([
		stadium,
		standing,
		json_request(
			`https://cors-proxy.blaseball-reference.com/database/players?ids=${player_ids.join(",")}`,
			`Fetching ${basic_data.nickname} roster`
		)
	]);

	return {
		name: teamName,
		team: team_data,
		stadium: stadium_data.get(teamName),
		champs: team_data.championships,
		runs: standings_data.runs[team_id],
		wins: standings_data.wins[team_id],
		net_shame: team_data.totalShamings - team_data.totalShames,
		roster: roster_data,
	}
}
