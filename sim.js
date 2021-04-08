class Render {
	constructor(canvas, world, view) {
		this.world = world;
		this.canvas = canvas;
		this.cont = canvas.parentNode;
		this.context = canvas.getContext('2d');

		this.view = view; // viewport in world coordinates
		this.aspectRatio = this.viewWidth / this.viewHeight;

		this.setPixelRatio();
		this.updateCanvasBounds();
		window.addEventListener('resize', this.updateCanvasBounds.bind(this));
	}

	get viewHeight() { return this.view.max.y - this.view.min.y; }
	get viewWidth() { return this.view.max.x - this.view.min.x; }

	setPixelRatio() {
		const devicePixelRatio = window.devicePixelRatio || 1;
		const backingStorePixelRatio = this.context.webkitBackingStorePixelRatio || this.context.mozBackingStorePixelRatio
			|| this.context.msBackingStorePixelRatio || this.context.oBackingStorePixelRatio
			|| this.context.backingStorePixelRatio || 1;

		this.pixelRatio = devicePixelRatio / backingStorePixelRatio;

		this.canvas.setAttribute('data-pixel-ratio', this.pixelRatio);
	}

	addMouse(mouse) {
		this.mouse = mouse;
		this.updateCanvasBounds();
	}

	updateCanvasBounds() {
		var width = this.cont.clientWidth;
		var height = this.cont.clientHeight;

		if (height * this.aspectRatio < width) {
			// height limited
			width = height * this.aspectRatio;
		} else {
			// width limited
			height = width / this.aspectRatio;
		}

		this.bounds = {
			min: {x: 0, y: 0},
			max: {x: width, y: height},
		}

		this.canvas.width = width * this.pixelRatio;
		this.canvas.height = height * this.pixelRatio;
		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';

		if (this.mouse) {
			Matter.Mouse.setScale(this.mouse, {
				x: this.viewWidth / this.canvas.width,
				y: this.viewHeight / this.canvas.height,
			});
			Matter.Mouse.setOffset(this.mouse, this.view.min);
		}

		this.context.setTransform(
			this.canvas.width / this.viewWidth, 0, 0,
			this.canvas.height / this.viewHeight, 0, 0
		);
		this.context.translate(-this.bounds.min.x, -this.bounds.min.y);
	}

	run() {
		const render = this;
		(function loop() {
			render.frameRequestId = window.requestAnimationFrame(loop);
			render.renderFrame();
		})();
	}

	renderFrame() {
		const c = this.context;
		// apply background

		// fill canvas with transparent
		c.globalCompositeOperation = 'source-in';
		c.fillStyle = "transparent";
		c.fillRect(0, 0, canvas.width, canvas.height);
		c.globalCompositeOperation = 'source-over';

		c.textAlign = "center";
		c.textBaseline = "middle";
		c.font = "20px sans-serif";

		for (const body of Matter.Composite.allBodies(this.world)) {
			if (!Matter.Bounds.overlaps(body.bounds, this.view)) {
				continue;
			}
			if (!body.render.visible) {
				continue;
			}

			const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
			for (const part of parts) {
				if (!part.render.visible) {
					continue;
				}

				if (part.circleRadius) {
					c.beginPath();
					c.arc(part.position.x, part.position.y, part.circleRadius, 0, 2*Math.PI);
				} else {
					// todo draw other things
					c.beginPath();
					c.moveTo(part.vertices[0].x, part.vertices[0].y);
					for (const pt of part.vertices) {
						c.lineTo(pt.x, pt.y);
					}
					c.lineTo(part.vertices[0].x, part.vertices[0].y);
					c.closePath();
				}
				c.fillStyle = part.render.fillStyle;
				if (part.render.lineWidth) {
					c.lineWidth = part.render.lineWidth;
					c.strokeStyle = part.render.strokeStyle;
					c.stroke();
				}
				c.fill();

				if (part.label) {
					const maxWidth = part.circleRadius ? 3*part.circleRadius : undefined;
					c.fillStyle = part.render.textStyle || "#FFFFFF";
					c.fillText(part.label, part.position.x, part.position.y, maxWidth);
					//console.log("label: " + part.label);
				}
			}
		}
	}
}

class Simulation {
	constructor(canvas) {
		this.canvas = canvas;
		this.engine = Matter.Engine.create();
		this.runner = Matter.Runner.create();
		this.world = this.engine.world;

		this.canvas.onselectstart = function() { return false; };

		this.simWidth = 1800;
		this.simHeight = 1000;
	
		this.spawnBounds = {
			min: {x: this.simWidth*0.2, y: this.simWidth*0.1},
			width: this.simWidth*0.6,
			height: this.simWidth*0.4,
		}

		this.scale = 10;

		this.simBounds = {
			min: {x: 0, y: 0},
			max: {x: this.simWidth, y: this.simHeight},
		};

		this.mouse = Matter.Mouse.create(this.canvas);
		// remove unwanted event handlers
		this.canvas.parentNode.removeEventListener('mousewheel', this.mouse.mousewheel);
		this.canvas.parentNode.removeEventListener('DOMMouseScroll', this.mouse.mousewheel);

		this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
			mouse: this.mouse,
			constraint: {
				stiffness: 0.2,
				render: {visible: false}
			}
		});

		this.render = new Render(canvas, this.world, this.simBounds);
		this.render.addMouse(this.mouse);

		this.addWalls();
		this.clearBodies();
	}

	addWalls() {
		const w = 30; // wall width
		const opts = {isStatic: true, label: undefined, render: {visible: false}};
		Matter.World.add(this.world, [
			//Matter.Bodies.rectangle(50, 0, 100, 2, {isStatic: true}),
			Matter.Bodies.rectangle(-w/2, this.simHeight/2, w, this.simHeight, opts),
			Matter.Bodies.rectangle(this.simWidth + w/2, this.simHeight/2, w, this.simHeight, opts),
			Matter.Bodies.rectangle(this.simWidth/2, this.simHeight, this.simWidth, w, opts),
		]);
	}

	addStadium() {
		const t = 50; // wall thickness
		const h = this.simHeight * 0.8; // wall height
		const w = this.simWidth * 0.9; // wall width

		const opts = {label: undefined, render: {fillStyle: "#ffffff"}};
		const left = Matter.Bodies.rectangle((this.simWidth - w + t)/2, this.simHeight/2, t, h, opts);
		const right = Matter.Bodies.rectangle((this.simWidth + w - t)/2, this.simHeight/2, t, h, opts);
		const bottom = Matter.Bodies.rectangle(this.simWidth/2, (this.simHeight + h - t)/2, w - t, t, opts);
		const top = Matter.Bodies.rectangle(this.simWidth/2, (this.simHeight - h + t)/2, w - t, t, opts);

		Matter.World.add(this.world, Matter.Body.create({parts: [left, bottom, right, top]}));
	}

	clearBodies() {
		Matter.World.clear(this.world, true); // keeps static objects
		this._bodies = [];
		Matter.World.add(this.world, this.mouseConstraint);
		this.addWalls();
		this.addStadium();
	}

	addBodies(bodies) {
		if (!bodies.length) { bodies = [bodies]; }
		this._bodies = this._bodies.concat(bodies);
		Matter.World.add(this.world, bodies);
	}

	run() {
		Matter.Runner.run(this.runner, this.engine);
		this.render.run();
	}
}

const playerColor = "#0000FF";
const performanceColor = "#FF0000";
const stadiumColor = "#00FF00";

function updateSimulationData(simulation, data, noodle) {
	console.log("team: " + data.team.url_slug);
	console.log("roster.length: " + data.roster.length);
	console.log("stadium: " + data.stadium.name);
	console.log("wins: " + data.wins);
	console.log("runs: " + data.runs);
	console.log("champs: " + data.champs);
	console.log("noodle: " + noodle);

	//season 14: players + runs + 10*wins + 5*netShame + 99*#champs + 5*grand + 5*fort + 500*filth + 100*parkmods
	var bodies = [
		[data.runs, "Runs", performanceColor],
		[10*data.wins, "Wins", performanceColor],
		[99*data.champs, "Champs", performanceColor],
		//[5*data.netShame, ]
		[500*data.stadium.filthiness, "Filthiness", stadiumColor],
		[5*data.stadium.grandiosity, "Grandiosity", stadiumColor],
	];

	for (mod of data.stadium.mods) {
		bodies.push([100, mod, stadiumColor]);
	}

	for (player of data.roster) {
		bodies.push([2*player.soul, player.player_name.split(" ").join("\n"), playerColor]);
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

function textColor(color) {
	const r = parseInt(color.substr(1,2), 16);
	const g = parseInt(color.substr(3,2), 16);
	const b = parseInt(color.substr(5,2), 16);

	if ((r+g+b)/3 > 127) {
		// light color
		return "#000000";
	} else {
		// dark color
		return "#ffffff";
	}
}

function addBodiesScattered(sim, bodyList) {

	var bodies = [];
	for ([density, label, color] of bodyList) {
		if (!isFinite(density)) {
			console.log("Invalid density passed for " + label);
			continue;
		}
		const r = Math.sqrt(Math.abs(density))*sim.scale;
		const x = sim.spawnBounds.min.x + sim.spawnBounds.width * Math.random();
		const y = sim.spawnBounds.min.y + sim.spawnBounds.height * Math.random();

		const body = Matter.Bodies.circle(x, y, r, {
			label: label,
			density: density,
			render: {
				fillStyle: color,
				textStyle: textColor(color),
			}
		});
		Matter.Body.setMass(body, density);
		bodies.push(body);
	}
	simulation.addBodies(bodies);
}
