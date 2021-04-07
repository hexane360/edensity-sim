class Simulation {
	constructor(canvas) {
		this.canvas = canvas;
		this.cont = canvas.parentNode;
		this.engine = Matter.Engine.create();
		this.runner = Matter.Runner.create();
		this.world = this.engine.world;

		this.canvas.onselectstart = function() { return false; };

		this.simWidth = 1200;
		this.simHeight = 1000;

		this.scale = 5;

		this.aspectRatio = this.simWidth/this.simHeight;

		this.simBounds = {
			min: {x: 0, y: 0},
			max: {x: this.simWidth, y: this.simHeight},
		};

		this.render = Matter.Render.create({
			canvas: this.canvas,
			engine: this.engine,
			bounds: this.simBounds,
			options: {
				wireframes: true,
				showPositions: true,
				showAngleIndicator: true,
			}
		});

		this.updateCanvasDimensions();
		window.addEventListener('resize', this.updateCanvasDimensions.bind(this));

		this.mouse = Matter.Mouse.create(this.render.canvas);
		this.render.mouse = this.mouse;

		// remove unwanted event handlers
		this.cont.removeEventListener('mousewheel', this.mouse.mousewheel);
		this.cont.removeEventListener('DOMMouseScroll', this.mouse.mousewheel);

		this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
			mouse: this.mouse,
			constraint: {
				stiffness: 0.2,
				render: {visible: false}
			}
		});
		//Matter.World.add(this.world, this.mouseConstraint);

		this.addWalls();
		this.clearBodies();
	}

	addWalls() {
		const w = 30; // wall width
		Matter.World.add(this.world, [
			//Matter.Bodies.rectangle(50, 0, 100, 2, {isStatic: true}),
			Matter.Bodies.rectangle(-w/2, this.simHeight/2, w, this.simHeight, {isStatic: true}),
			Matter.Bodies.rectangle(this.simWidth + w/2, this.simHeight/2, w, this.simHeight, {isStatic: true}),
			Matter.Bodies.rectangle(this.simWidth/2, this.simHeight, this.simWidth, w, {isStatic: true}),
		]);
	}

	clearBodies() {
		Matter.World.clear(this.world, true); // keeps static objects
		this._bodies = [];
		Matter.World.add(this.world, this.mouseConstraint);
	}

	addBodies(bodies) {
		if (!('length' in bodies)) { bodies = [bodies]; }
		this._bodies = this._bodies.concat(bodies);
		Matter.World.add(this.world, bodies);
	}

	run() {
		Matter.Runner.run(this.runner, this.engine);
		Matter.Render.run(this.render);
	}

	updateCanvasDimensions() {
		var width = this.cont.clientWidth;
		var height = this.cont.clientHeight;

		if (height * this.aspectRatio < width) {
			// height limited
			width = height * this.aspectRatio;
		} else {
			// width limited
			height = width / this.aspectRatio;
		}

		this.render.options.width = width;
		this.render.options.height = height;
		this.drawBounds = {
			min: {x: 0, y: 0},
			max: {x: width, y: height},
		}
		Matter.Render.setPixelRatio(this.render, 'auto');
		Matter.Render.startViewTransform(this.render);
	}
}

const playerColor = "#00FFFF";
const performanceColor = "#FF0000";
const stadiumColor = "#00FF00";

function updateSimulationData(simulation, data, noodle) {
	console.log("team: " + data.team.url_slug);
	console.log("roster.length: " + data.roster.length);
	console.log("stadium: " + data.stadium.name);
	console.log("wins: " + data.wins);
	console.log("runs: " + data.runs);
	console.log("noodle: " + noodle);

	//season 14: players + runs + 10*wins + 5*netShame + 99*#champs + 5*grand + 5*fort + 500*filth + 100*parkmods
	var bodies = [
		[500*data.stadium.filthiness, "Filthiness", stadiumColor],
		[5*data.stadium.grandiosity, "Grandiosity", stadiumColor],
		[100*data.stadium.mods.length, "Stadium Mods", stadiumColor],
		[data.runs, "Runs", performanceColor],
		[10*data.wins, "Wins", performanceColor],
	];

	for (player of data.roster) {
		bodies.push([2*player.soul, player.name, playerColor]);
	}

	//todo deal with negative shame

	simulation.clearBodies();
	addBodiesScattered(simulation, bodies);
	//simulation.addBodies(makeBody(100, [25, 25]));
}

function calculatePlayerDensity(player) {
	//7*totalRating + 2*soul + 6.5*#ego + 26*#perk

	return player;
}

function addBodiesScattered(simulation, bodyList) {

	var bodies = [];
	for ([density, label, color] of bodyList) {
		if (!isFinite(density)) {
			console.log("Invalid density passed for " + label);
			continue;
		}
		const r = Math.sqrt(density)*simulation.scale;
		const x = simulation.simWidth * Math.random();
		const y = simulation.simHeight * 0.1 * Math.random();

		const body = Matter.Bodies.circle(x, y, r, {label: label, color: color});
		Matter.Body.setMass(body, density);
		bodies.push(body);
	}
	simulation.addBodies(bodies);
}
