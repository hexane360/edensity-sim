class Render {
	constructor(canvas, world, view) {
		this.world = world;
		this.canvas = canvas;
		this.cont = canvas.parentNode;
		this.context = canvas.getContext('2d');

		this.view = view; // viewport in world coordinates
		this.aspectRatio = this.viewWidth / this.viewHeight;

		this.debugPts = {};
		this.debugGons = {};

		this.setPixelRatio();
		window.addEventListener('resize', this.updateCanvasBounds.bind(this));

		this.mouse = Matter.Mouse.create(this.canvas);
		// remove unwanted event handlers
		this.canvas.parentNode.removeEventListener('mousewheel', this.mouse.mousewheel);
		this.canvas.parentNode.removeEventListener('DOMMouseScroll', this.mouse.mousewheel);

		this.updateCanvasBounds();

		this.tooltip = document.getElementById('sim-tooltip');
		canvas.addEventListener('mousemove', this.updateTooltip.bind(this));
		this.tooltip.addEventListener('mousemove', this.updateTooltip.bind(this));
		this.tooltip.addEventListener('mousemove', this.mouse.mousemove);
		this.tooltip.addEventListener('mouseup', this.mouse.mouseup);
		this.tooltip.addEventListener('mousedown', this.mouse.mousedown);
		this.tooltip.addEventListener('touchmove', this.mouse.mousemove);
		this.tooltip.addEventListener('touchstart', this.mouse.mousedown);
		this.tooltip.addEventListener('touchend', this.mouse.mouseup);
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

	updateTooltip(event) {
		const canvasPos = this.canvas.getBoundingClientRect();
		const position = { // position in simulation coordinates
			x: this.view.min.x + (event.clientX - canvasPos.x) * this.viewWidth/canvasPos.width,
			y: this.view.min.y + (event.clientY - canvasPos.y) * this.viewHeight/canvasPos.height,
		};
		const tooltipPos = {
			left: event.clientX,
			bottom: window.innerHeight - event.clientY,
		};

		var show = false;
		for (const body of this.world.bodies) {
			if (!body.tooltip || !Matter.Bounds.contains(body.bounds, position)) {
				continue;
			}
			for (const part of body.parts) {
				if (!Matter.Vertices.contains(part.vertices, position)) {
					continue;
				}
				show = true;
				this.tooltip.classList.add('show');
				this.tooltip.setAttribute('style', `left: ${tooltipPos.left}px; bottom: ${tooltipPos.bottom}px;`);
				this.tooltip.innerHTML = body.tooltip;
				break;
			}
		}

		if (show) {
			this.tooltip.classList.add('show');
		} else {
			this.tooltip.classList.remove('show');
		}
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

		Matter.Mouse.setScale(this.mouse, {
			x: this.viewWidth / this.canvas.width,
			y: this.viewHeight / this.canvas.height,
		});
		Matter.Mouse.setOffset(this.mouse, this.view.min);

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
		c.fillRect(this.view.min.x, this.view.min.y, this.viewWidth, this.viewHeight);
		c.globalCompositeOperation = 'source-over';

		c.textAlign = "center";
		c.textBaseline = "middle";
		c.font = "20px sans-serif";

		c.fillStyle = "#000044";
		c.fillRect(this.view.min.x, this.world.waterHeight, this.viewWidth, this.view.max.y - this.world.waterHeight);

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

			for (const prop in this.debugPts) {
				var pt = this.debugPts[prop];
				if (pt.x && pt.y) {
					pt = [pt.x, pt.y];
				}
				c.beginPath();
				c.arc(pt[0], pt[1], 8, 0, 2*Math.PI);
				c.fillStyle = "#FFFF00";
				c.fill();
			}

			for (const prop in this.debugGons) {
				const polygon = this.debugGons[prop];
				if (polygon.length < 2) continue;
				c.beginPath();
				c.moveTo(polygon[polygon.length-1].x, polygon[polygon.length-1].y);
				for (const pt of polygon) {
					c.lineTo(pt.x, pt.y);
				}
				c.closePath();
				c.strokeStyle = "#FFFF00";
				c.stroke();
				c.fillStyle = "rgba(0,255,0,127)";
				c.fill();
			}
		}

		for (const constraint of Matter.Composite.allConstraints(this.world)) {
			if (!constraint.render.visible) {
				continue;
			}
			const ptA = Matter.Constraint.pointAWorld(constraint);
			const ptB = Matter.Constraint.pointBWorld(constraint);

			c.beginPath();
			c.moveTo(ptA.x, ptA.y);
			c.lineTo(ptB.x, ptB.y);
			c.strokeStyle = "#FFFF00";
			c.stroke();
		}
	}
}

class Simulation {
	constructor(canvas) {
		this.canvas = canvas;
		this.engine = Matter.Engine.create();
		this.runner = Matter.Runner.create();
		this.world = this.engine.world;
		this.world.gravity.y = 0;

		this.running = false;

		Matter.Events.on(this.engine, 'beforeUpdate', this.applyForces.bind(this));

		//this.canvas.onselectstart = function() { return false; };

		this.simWidth = 1800;
		this.simHeight = 1000;

		this.world.waterHeight = this.simHeight * 0.4;
		this.imDensity = 0.000002;

		this.spawnBounds = {
			min: {x: this.simWidth*0.2, y: this.simWidth*0.1},
			width: this.simWidth*0.6,
			height: this.simWidth*0.4,
		}

		this.scale = 8;

		this.simBounds = {
			min: {x: 0, y: 0},
			max: {x: this.simWidth, y: this.simHeight},
		};

		this.render = new Render(canvas, this.world, this.simBounds);

		this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
			mouse: this.render.mouse,
			constraint: {
				stiffness: 0.2,
				render: {visible: false}
			}
		});

		this.bodies = [];
		this.persistentBodies = [];
		this.constraints = [this.mouseConstraint];
		//this.addWalls();
		this.addStadium();
	}

	addWalls() {
		const w = 30; // wall width
		const opts = {isStatic: true, label: undefined, render: {visible: false}};
		Matter.World.add(this.world, [
			Matter.Bodies.rectangle(-w/2, this.simHeight/2, w, this.simHeight, opts),
			Matter.Bodies.rectangle(this.simWidth + w/2, this.simHeight/2, w, this.simHeight, opts),
			Matter.Bodies.rectangle(this.simWidth/2, this.simHeight, this.simWidth, w, opts),
		]);
	}

	getCode(pt, width, height) {
		var code = 0;
		if (x < -width/2) {
			code |= 1;
		} else if (x > width/2) {
			code |= 2;
		} else if (y < -height/2) {
			code |= 4;
		} else if (y > height/2) {
			code |= 8;
		}
		return code;
	}

	applyForces() {
		//stadium center
		const c = this.stadium.position;
		var theta = this.stadium.angle;

		var stadium_pts = [...this.stadium.vertices];
		var water_pts = [];

		const waterHeight = this.world.waterHeight;

		for (var i = 0; i < stadium_pts.length; i++) {
			const pt = stadium_pts[i];
			const next = stadium_pts[(i+1) % stadium_pts.length];
			if (pt.y > waterHeight) {
				//underwater
				water_pts.push(pt);
				if (next.y < waterHeight) {
					//but next point isn't, so find the boundary between the two
					water_pts.push({
						x: pt.x + (next.x - pt.x) * (pt.y - waterHeight) / (pt.y - next.y),
						y: waterHeight,
					});
				}
			} else if (next.y > waterHeight) {
				//not underwater, but next point is, so find the boundary
				water_pts.push({
					x: next.x + (pt.x - next.x) * (next.y - waterHeight) / (next.y - pt.y),
					y: waterHeight,
				});
			}
		}
		//this.render.debugGons.water = water_pts;

		if (water_pts.length > 2) {
			const water_area = Matter.Vertices.area(water_pts);
			const buoyancy_center = Matter.Vertices.centre(water_pts);
			this.render.debugPts.buoyancy = buoyancy_center;

			Matter.Body.applyForce(this.stadium, buoyancy_center, {x: 0, y: -this.imDensity*water_area});
		}

		const dx = this.simWidth/2 - c.x;
		Matter.Body.applyForce(this.stadium, c, {x: dx*0.005, y: 0});

		for (const body of this.bodies) {
			body.force.y += (body.gravity || 1) * body.mass * 0.0001;
		}
	}

	addStadium() {
		const t = 50; // wall thickness
		const h = this.simHeight * 1.2; // wall height
		const w = this.simWidth * 0.9; // wall width

		const opts = {label: undefined, render: {fillStyle: "#ffffff"}};
		const left = Matter.Bodies.rectangle((this.simWidth - w + t)/2, this.simHeight/2, t, h, opts);
		const right = Matter.Bodies.rectangle((this.simWidth + w - t)/2, this.simHeight/2, t, h, opts);
		const bottom = Matter.Bodies.rectangle(this.simWidth/2, (this.simHeight + h - t)/2, w - t, t, opts);
		const top = Matter.Bodies.rectangle(this.simWidth/2, (this.simHeight - h + t)/2, w - t, t, opts);

		this.stadium = Matter.Body.create({
			parts: [left, bottom, right, top],
			frictionAir: 0,
			mass: 1000,
			restitution: 0.1,
		});
		this.stadium.height = h;
		this.stadium.width = w;
		this.addBodies(this.stadium, true);
	}

	clearBodies() {
		Matter.Composite.clear(this.world, true); // keeps static objects
		this.bodies = [];
		this.addStadium();
		//Matter.World.add(this.world, this.persistentBodies);
		Matter.World.add(this.world, this.constraints);
	}

	addBodies(bodies, persistent=false) {
		bodies = [].concat(bodies);
		if (persistent) {
			this.persistentBodies = this.persistentBodies.concat(bodies);
		} else {
			this.bodies = this.bodies.concat(bodies);
		}
		Matter.World.add(this.world, bodies);
	}

	addConstraints(constraints) {
		constraints = [].concat(constraints);
		this.constraints = this.constraints.concat(constraints);
		Matter.World.add(this.world, constraints);
	}

	run() {
		if (!this.running) {
			this.running = true;
			Matter.Runner.run(this.runner, this.engine);
			this.render.run();
		}
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
	console.log("net shame: " + data.net_shame);

	//season 14: players + runs + 10*wins + 5*netShame + 99*#champs + 5*grand + 5*fort + 500*filth + 100*parkmods
	var bodies = [
		[data.runs, "Runs", performanceColor],
		[10*data.wins, "Wins", performanceColor],
		[99*data.champs, "Champs", performanceColor],
		[5*data.net_shame, "Shame", performanceColor],
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
	simulation.run();
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
		if (density == 0) {
			continue;
		}
		const r = Math.sqrt(Math.abs(density))*sim.scale;
		const x = sim.spawnBounds.min.x + sim.spawnBounds.width * Math.random();
		const y = sim.spawnBounds.min.y + sim.spawnBounds.height * Math.random();

		const body = Matter.Bodies.circle(x, y, r, {
			label: label,
			tooltip: label,
			gravity: Math.sign(density),
			render: {
				fillStyle: color,
				textStyle: textColor(color),
			},
			restitution: 0.1,
		});
		Matter.Body.setMass(body, Math.abs(density));
		bodies.push(body);
	}
	simulation.addBodies(bodies);
}
