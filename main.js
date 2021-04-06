window.onload = function () {
	console.log("Loaded");
};

class LazyData {
	constructor(load_function) {
		this.load_function = load_function;
		this._data = null;
	}

	async load(force=false) {
		if (this._data !== null && !force) {
			return this._data;
		}
		const result = await this.load_function(force);
		if (this._data !== null && !force) {
			return this._data; // another request has completed while awaiting
		}
		this._data = result;
		if (this._data !== null) {
			this.post_load();
		}
		return this._data;
	}

	post_load(first) { return; }

	get data() {
		if (this._data == null) {
			throw new Error("Uninitalized data used");
		}
		return this._data;
	}
}

class MemoizedData extends Map {
	constructor(load_function) {
		super();
		this.load_function = load_function;
	}

	async load(key, force=false) {
		if (super.has(key) && !force) {
			return super.get(key);
		}
		const val = await this.load_function(key, force);
		if (super.has(key) && !force) {
			return super.get(key); // another request has completed while awaiting
		}
		super.set(key, val);
		return val;
	}

	get(key) { return super.get(key); }

	set(key, val) {	throw new Error("Setting is not supported."); }
}

var currentTeam = 'flowers';
const teams = new LazyData(loadTeams); // store of basic team information, indexed by slug
const teamData = new MemoizedData(loadTeamData); // store of extended team data, indexed by slug
const stadiums = new LazyData(loadStadiums); // store of stadiums, indexed by team slug

teams._byUUID = null;
Object.defineProperty(teams, 'byUUID', {get: function() {
	if (this._data == null) {
		throw new Error("Uninitalized data used");
	}
	return this._byUUID;
}});
teams.post_load = function () {
	// store references to teams by UUID as well
	this._byUUID = new Map();
	for (const team of this._data.values()) {
		this._byUUID.set(team.team_id, team);
	}

	makeTeamElements(this._data);
	selectTeam(document.getElementById(currentTeam));
}

teams.load(); //begin loading teams right away

async function loadTeams(force=false) {
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

function makeTeamElements(teams) {
	selector = document.getElementById('team-selector');
	//selector.replaceChildren(); // clear current teams
	selector.innerHTML = "";

	for (const team of teams.values()) {
		const elem = document.createElement("button");
		elem.innerHTML = team.team_emoji;
		elem.id = team.url_slug;
		elem.className = 'team';
		elem.setAttribute('style', `background: ${team.team_main_color}`);
		elem.setAttribute('title', team.full_name);
		elem.setAttribute('aria-label', team.full_name);
		elem.setAttribute('aria-pressed', 'false');
		elem.onclick = () => selectTeam(elem);

		selector.appendChild(elem);
	}
}

function selectTeam(team) {
	for (const other_team of document.getElementById('team-selector').querySelectorAll('button[aria-pressed="true"]')) {
		if (team.id !== other_team.id) {
			//other_team.ariaPressed = 'false';
			other_team.setAttribute('aria-pressed', 'false');
		}
	}
	team.setAttribute('aria-pressed', 'true');
	currentTeam = team.id;

	for (const elem of document.getElementsByClassName('team-name')) {
		elem.innerHTML = team.getAttribute('aria-label');
	}

	for (const elem of document.getElementsByClassName('team-icon')) {
		elem.innerHTML = team.innerHTML;
		elem.setAttribute('style', team.getAttribute('style'));
	}
}

async function loadStadiums(force=false) {
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

async function loadTeamData(team, force=false) {
	/// Load extended data for a team

	await teams.load(force);

	//load players
	//https://api.blaseball-reference.com/v1/currentRoster?slug=tacos&includeShadows=true
	//collect soul, ego, and perk

	//load stadium
	return teams.data.get(team);
}


async function updateSim(force=false) {
	/// Updates the simulation with new team information or new logic
	await teams.load(force);

	team_name = currentTeam;
	const [team, stadium] = await Promise.all([teamData.load(team_name, force), stadiums.load(force)]);

	console.log(team);
	console.log(stadium);
}
