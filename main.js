window.onload = function () {
	console.log("Loaded");
};

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
}

var teams = []
var teamIds = {} //maps nice html IDs to blaseball UUIDs

async function loadTeams() {
	const response = await fetch('https://cors-proxy.blaseball-reference.com/database/allTeams', {
		mode: 'cors',
	});
	if (!response.ok) {
		console.error("Error fetching teams from blaseball.com:");
		console.error(response);
		return;
	}
	selector = document.getElementById('team-selector');
	const data = await response.json();
	for (const team of data) {
		if (team.stadium === null) {
			//console.log("Skipping hidden team " + team.fullName);
			continue;
		}
		team.nice_id = team.nickname.toLowerCase().replaceAll(' ', '-');
		teamIds[team.nice_id] = team.id;
		if (team.emoji.slice(0,2) === '0x') {
			// convert emoji from unicode code point
			team.emoji = String.fromCodePoint(team.emoji);
		}
		teams.push(team);

		const elem = document.createElement("button");
		elem.innerHTML = team.emoji;
		elem.id = team.nice_id;
		elem.className = 'team';
		elem.setAttribute('style', `background: ${team.mainColor}`);
		elem.setAttribute('aria-label', team.fullName);
		elem.setAttribute('aria-pressed', 'false');
		elem.onclick = () => selectTeam(elem);

		selector.appendChild(elem);
	}

	selectTeam(document.getElementById('flowers'));
}

loadTeams();

data = {}

async function updateSim(team) {
	/// Updates the simulation with the new team information

	if (data.contains(team)) {
		return team[data];
	}
}
