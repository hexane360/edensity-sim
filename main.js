var simulation = null;

window.onload = function () {
	document.getElementById('selector-collapse').onclick = function() {
		document.getElementById('team-selector').classList.toggle('collapsed');
		simulation.render.updateCanvasBounds();
	}

	document.getElementById('reset').onclick = () => loadSimulation(false);

	document.getElementById('reload').onclick = () => loadSimulation(true);

	simulation = new Simulation(document.getElementById('canvas'));
	console.log("Loaded simulation");

	loadSimulation(); // start loading simulation data
};

function updateTotalDensity(calculated, actual) {
	document.getElementById('actualDensity').innerHTML = actual.toFixed(3);
	document.getElementById('calcDensity').innerHTML = calculated.toFixed(3);
}

class LazyData {
	constructor(load_function) {
		this.load_function = load_function;
		this._data = null;
		this._promise = null;
	}

	async load(force=false) {
		if (this._data !== null && !force) {
			return this._data;
		}
		if (!this._promise || force) {
			this._promise = this._load(force);
		}
		return await this._promise;
	}

	async _load(force) {
		this._data = await this.load_function(force);
		if (this._data !== null) {
			this.post_load();
		}
		return this._data;
	}

	post_load() { return; }

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
		this._promises = new Map();
	}

	async load(key, force=false) {
		if (super.has(key) && !force) {
			return super.get(key);
		}
		if (this._promises.get(key) && !force) { // another call already running
			return await this._promises.get(key);
		}
		const promise = this._load(key, force);
		this._promises.set(key, promise);
		return await promise;
	}

	async _load(key, force) {
		const val = await this.load_function(key, force);
		super.set(key, val);
		if (val !== null) {
			this.post_load(key);
		}
		return val;
	}

	post_load(_key) { return; }

	get(key) { return super.get(key); }

	set(_key, _val) { throw new Error("Setting is not supported."); }
}

var currentTeam = 'flowers';
const season = new LazyData(loadSeason);
const standings = new LazyData(loadStandings);
const teams = new LazyData(loadTeams); // store of basic team information, indexed by slug
const teamData = new MemoizedData(loadTeamData); // store of extended team data, indexed by slug
const stadiums = new LazyData(loadStadiums); // store of stadiums, indexed by team slug
const noodle = new LazyData(loadNoodle); // stores current noodle position
const champs = new LazyData(loadChampionships);

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

function makeTeamElements(teams) {
	const selector = document.getElementById('team-selector');
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

	for (const elem of document.getElementsByClassName('team-name')) {
		elem.innerHTML = team.getAttribute('aria-label');
	}

	for (const elem of document.getElementsByClassName('team-icon')) {
		elem.innerHTML = team.innerHTML;
		elem.setAttribute('style', team.getAttribute('style'));
	}

	if (currentTeam != team.id) {
		currentTeam = team.id;
		loadSimulation();
	}
}

async function loadSimulation(force=false) {
	/// Load the simulation with new team information or new logic
	await teams.load(force);

	const team_name = currentTeam;
	const [data, n] = await Promise.all([teamData.load(team_name, force), noodle.load(force)]);

	if (currentTeam == team_name) {
		return updateSimulationData(simulation, data, n);
	}
}
