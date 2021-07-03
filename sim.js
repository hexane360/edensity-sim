class Render {
	constructor(canvas, world, view) {
		this.world = world;
		this.canvas = canvas;
		this.cont = canvas.parentNode;
		this.context = canvas.getContext('2d');

		this.minView = view; // must-see viewport in world coordinates
		//this.aspectRatio = this.viewWidth / this.viewHeight;

		this.setPixelRatio();

		this.mouse = Matter.Mouse.create(this.canvas);

		this.updateCanvasBounds();

		window.addEventListener('resize', this.updateCanvasBounds.bind(this));

		this.debugPts = {}; // debug points to render
		this.debugGons = {}; // debug polygons to render

		// remove unwanted event handlers
		this.canvas.parentNode.removeEventListener('mousewheel', this.mouse.mousewheel);
		this.canvas.parentNode.removeEventListener('DOMMouseScroll', this.mouse.mousewheel);

		// forward tooltip mouse events to simulation
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

	get minViewHeight() { return this.minView.max.y - this.minView.min.y; }
	get minViewWidth() { return this.minView.max.x - this.minView.min.x; }

	setPixelRatio() {
		// set the canvas pixel ratio
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

		this.view = {
			min: {x: this.minView.min.x, y: this.minView.min.y },
			max: {x: this.minView.max.x, y: this.minView.max.y },
		};

		if (this.minViewHeight / height > this.minViewWidth / width) {
			// keep height the same, extend width to take up excess space
			const viewWidth = this.minViewHeight * width / height;
			this.view.min.x -= (viewWidth-this.minViewWidth)/2;
			this.view.max.x += (viewWidth-this.minViewWidth)/2;
		} else {
			// keep width the same, extend height (mostly on top)
			const viewHeight = this.minViewWidth * height / width;
			this.view.min.y -= (viewHeight-this.minViewHeight)*0.8;
			this.view.max.y += (viewHeight-this.minViewHeight)*0.2;
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

		this.context.setTransform(1, 0, 0, 1, 0, 0);
		this.context.scale(this.canvas.width / this.viewWidth, this.canvas.height / this.viewHeight);
		this.context.translate(-this.view.min.x, -this.view.min.y);
	}

	run() {
		this.updateCanvasBounds();
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

		// draw water
		c.fillStyle = "#000044";
		c.fillRect(
			this.view.min.x, this.world.waterHeight,
			this.viewWidth, this.view.max.y - this.world.waterHeight
		);

		for (const body of Matter.Composite.allBodies(this.world)) {
			if (!Matter.Bounds.overlaps(body.bounds, this.view)) continue;
			if (!body.render.visible) continue;

			const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
			for (const part of parts) {
				if (!part.render.visible) continue;

				if (part.circleRadius) {
					// draw circle
					c.beginPath();
					c.arc(part.position.x, part.position.y, part.circleRadius, 0, 2*Math.PI);
				} else {
					// draw polygon
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
					// draw label
					const maxWidth = part.circleRadius ? 3*part.circleRadius : undefined;
					c.fillStyle = part.render.textStyle || "#FFFFFF";
					c.fillText(part.label, part.position.x, part.position.y, maxWidth);
				}
			}

			// draw debug points
			for (const prop in this.debugPts) {
				let pts = this.debugPts[prop];
				if (!pts) continue;
				if (pts.length === undefined) pts = [pts]
				for (const pt of pts) {
					c.beginPath();
					c.arc(pt.x, pt.y, 8, 0, 2*Math.PI);
					c.fillStyle = "#FFFF00";
					c.fill();
				}
			}

			// draw debug polygons
			for (const prop in this.debugGons) {
				const polygon = this.debugGons[prop];
				if (polygon.length < 2) continue;
				c.beginPath();
				c.moveTo(polygon[polygon.length-1].x, polygon[polygon.length-1].y);
				for (let pt of polygon) {
					c.lineTo(pt.x, pt.y);
				}
				c.closePath();
				c.strokeStyle = "#FFFF00";
				c.stroke();

				c.fillStyle = "#FFFFFF";
				for (let i = 0; i < polygon.length; i++) {
					c.fillText(i, polygon[i].x, polygon[i].y);
				}
				/*
				c.fillStyle = "rgba(0,255,0,127)";
				c.fill();
				*/
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
		this.world.gravity.y = 0;

		this.running = false;

		Matter.Events.on(this.engine, 'beforeUpdate', this.applyForces.bind(this));

		this.simWidth = 2400;
		this.simHeight = 1400;

		this.world.waterHeight = this.simHeight * 0.6;
		this.imDensity = 0.000002;

		this.scale = 8;

		this.simBounds = {
			min: {x: 0, y: 0},
			max: {x: this.simWidth, y: this.simHeight},
		};

		this.render = new Render(canvas, this.world, this.simBounds);

		this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
			mouse: this.render.mouse,
			constraint: {
				stiffness: 0.005,
				damping: 0.05,
				angularStiffness: 0.2,
				render: {visible: false}
			}
		});


		this.bodies = [];
		this.constraints = [this.mouseConstraint];
		this.addStadium();
	}

	applyForces() {
		//stadium center
		const c = this.stadium.position;

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
		//uncomment to show buoyancy polygon
		//this.render.debugGons.water = water_pts;

		if (water_pts.length > 2) {
			const water_area = Matter.Vertices.area(water_pts);
			const buoyancy_center = Matter.Vertices.centre(water_pts);
			//uncomment to show center of buoyancy
			//this.render.debugPts.buoyancy = buoyancy_center;

			// apply a buoyancy force to the stadium
			Matter.Body.applyForce(this.stadium, buoyancy_center, {x: 0, y: -this.imDensity*water_area});
		}

		// apply a constant restoring acceleration to each body to keep the simulation near the center
		const dx = c.x - this.simWidth/2;
		const vx = this.stadium.velocity.x;
		let accel = -dx*0.000005 - vx*0.0001;
		if (this.mouseConstraint.body === this.stadium)
			accel = 0; // disable restoring acceleration while dragging

		this.stadium.force.x += accel * this.stadium.mass; // apply restoring force to stadium

		for (const body of this.bodies) {
			body.force.x += accel * body.mass; // apply restoring force to each body
			body.force.y += (body.gravity || 1) * body.mass * 0.001; // apply gravity to each body
		}
	}

	addStadium() {
		const t = 80; // wall thickness
		const h = this.simHeight * 0.9; // wall height
		const w = this.simWidth * 0.9; // wall width
		const d = this.simHeight * 0.2; // hull dip
		const r = w * 1.5;

		const outer = [
			...bowedLine({x: 0, y: 0}, {x: w/2, y: -d}, -r, 8),
			...bowedLine({x: w/2, y: -d}, {x: w, y: 0}, -r, 8).slice(1),
			...bowedLine({x: w, y: h-d}, {x: w/2, y: h}, -r, 8),
			...bowedLine({x: w/2, y: h}, {x: 0, y: h-d}, -r, 8).slice(1),
		];

		// offset to get inner poly (and flip winding direction)
		let inner = offsetPolygon(outer, -t).reverse();

		// add connector points between the inner and outer polys
		const points = [
			...outer,
			{x: 0, y: 0.01},
			{x: inner[inner.length-1].x, y: inner[inner.length-1].y + 0.01},
			...inner
		];

		const opts = {
			label: undefined,
			render: {
				fillStyle: "#ffffff",
				strokeStyle: "#ffffff",
				lineWidth: 2,
			},
			frictionAir: 0,
			mass: 1000,
			restitution: 0.1,
		};
		this.stadium = Matter.Bodies.fromVertices(
			this.simWidth/2, this.simHeight/2,
			[points], opts,
			undefined, undefined, 0, 0 //don't remove duplicate points
		)
		this.spawnBounds = {
			min: {x: (this.simWidth - w)/2 + t, y: (this.simHeight - h + d)/2},
			max: {x: (this.simWidth + w)/2 - t, y: (this.simHeight + h - d)/2}
		}

		Matter.World.add(this.world, this.stadium);
	}

	clearBodies() {
		Matter.Composite.clear(this.world, true); // keeps static objects
		this.bodies = [];
		this.addStadium();
		Matter.World.add(this.world, this.constraints);
	}

	addBodies(bodies) {
		bodies = [].concat(bodies);
		this.bodies = this.bodies.concat(bodies);
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

function bowedLine(p1, p2, r, n) {
	const v = Matter.Vector.sub(p2, p1);
	const midpoint = Matter.Vector.add(p1, Matter.Vector.mult(v, 1/2));
	const l = Matter.Vector.magnitude(v);
	if (2*Math.abs(r) < l) {
		throw Error("Radius not big enough");
	}
	const theta = Math.asin(l/(2*r));
	const perp = Matter.Vector.normalise({
		x: v.y,
		y: -v.x
	});
	const center = Matter.Vector.add(midpoint, Matter.Vector.mult(perp, r*Math.cos(theta)));

	const tstart = Math.atan2(p1.y - center.y, p1.x - center.x);
	const tend = Math.atan2(p2.y - center.y, p2.x - center.x);
	return arc(center, Math.abs(r), tstart, tend, n);
}

function arc(center, r, tstart, tend, n) {
	const arc = [];
	const tstep = (tend-tstart)/n;
	for (let i = 0; i <= n; i++) {
		const t = tstart + i*tstep;
		arc.push({
			x: center.x + r*Math.cos(t),
			y: center.y + r*Math.sin(t)
		});
	}
	return arc;
}

function offsetPolygon(poly, offset) {
	// offsets a polygon by a specified amount. A positive offset will expand the polygon outwards,
	// while a negative offset expands the polygon inwards. Assumes a CW winding direction.

	const offseted = [];
	for (let i = 0; i < poly.length; i++) {
		const lastPt = i == 0 ? poly[poly.length - 1] : poly[i-1];
		const pt = poly[i];
		const nextPt = poly[(i+1) % poly.length];

		const v1 = Matter.Vector.normalise(Matter.Vector.sub(pt, lastPt));
		const v2 = Matter.Vector.normalise(Matter.Vector.sub(pt, nextPt));
		const angle = Math.atan2(-v2.y, v2.x) - Math.atan2(-v1.y, v1.x);
		const p3 = Matter.Vector.normalise(Matter.Vector.rotate(v2, angle/2));
		if (Math.abs(Math.sin(angle/2)) < 0.000000001) {
			// close to a straight line, and we can't reliably determine the offset direction.
			continue;
		}
		offseted.push(Matter.Vector.add(pt, Matter.Vector.mult(p3, offset/Math.sin(angle/2))));
	}

	return offseted;
}

const playerColor = "#0000FF";
const performanceColor = "#FF0000";
const stadiumColor = "#00FF00";

function updateSimulationData(simulation, data, noodle) {
	console.log("team: " + data.name);
	console.log("roster.length: " + data.roster.length);
	console.log("stadium: " + data.stadium.name);
	console.log("wins: " + data.wins);
	console.log("runs: " + data.runs);
	console.log("champs: " + data.champs);
	console.log("noodle: " + noodle);
	console.log("net shame: " + data.net_shame);

	var light_switch = (data.stadium.renoLog.light_switch_toggle % 2 == 0) ? 1 : -1;


	//season 12/13: players + runs + 10*wins + 5*netShame + 99*#champs + 5*grand + 5*fort + 500*filth
	//season 14: players + runs + 10*wins + 5*netShame + 33*#champs + 100*grand + 100*fort + 500*filth + 50*parkmods
	var bodies = [
		// runs, wins, shame, champs
		{density: data.runs, label: "Runs", color: performanceColor, tooltip: `Total Runs: ${data.runs}`},
		{density: 10*data.wins, label: "Wins", color: performanceColor, tooltip: `Total Wins: ${data.wins}`},
		{density: 5*data.net_shame, label: "Shame", color: performanceColor, tooltip: `Total Net Shame: ${data.net_shame}`},
		{density: 33*data.champs, label: "Champs", color: performanceColor, tooltip: `Championships: ${data.champs}`},
		// stadium stats
		{density: light_switch*100*data.stadium.grandiosity, label: "Grandiosity", color: stadiumColor},
		{density: light_switch*100*data.stadium.fortification, label: "Fortification", color: stadiumColor},
		{density: light_switch*500*data.stadium.filthiness, label: "Filthiness", color: stadiumColor},
		{density: light_switch*-data.stadium.birds, label: "Birds", color: stadiumColor},
		{density: light_switch*-0.1*(data.stadium.state.air_balloons || 0), label: "Air Balloons", color: stadiumColor},
		{density: light_switch*-10*(data.stadium.state.flood_balloons || 0), label: "Flood Balloons", color: stadiumColor},
	];

	for (mod of data.stadium.mods) {
		// stadium mods
		bodies.push({density: light_switch*50, label: mod, color: stadiumColor});
	}

	for (player of data.roster) {
		// player stats
		const totalRating = player.pitchingRating + player.baserunningRating + player.hittingRating + player.defenseRating;
		bodies.push({
			density: player.eDensity, label: player.name, color: playerColor,
			tooltip: `Total rating: ${totalRating.toFixed(2)}<br>Soul: ${player.soul}`
		});
	}

	// sum and report eDensity
	let totalDensity = 0;
	for (body of bodies) {
		totalDensity += body.density;
	}
	updateTotalDensity(totalDensity, data.team.eDensity);

	simulation.clearBodies();
	addBodiesScattered(simulation, bodies);
	simulation.run();
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

function addBodiesScattered(sim, bodies) {
	// takes a list of objects, with the following properties:
	// density: eDensity of object
	// label: Label to use for object
	// color: Object fill color
	// tooltip?: Custom tooltip to display (defaults to label)

	var bodiesToAdd = [];
	for (body of bodies) {
		const density = body.density;
		delete body.density;

		if (!isFinite(density)) {
			console.log("Invalid density passed for " + body.label);
			continue;
		}
		if (density == 0) continue;

		const r = Math.sqrt(Math.abs(density)) * sim.scale;
		const x = sim.spawnBounds.min.x + (sim.spawnBounds.max.x - sim.spawnBounds.min.x) * Math.random();
		const y = sim.spawnBounds.min.y + (sim.spawnBounds.max.y - sim.spawnBounds.min.y) * Math.random();

		body.tooltip = `${body.label}<br>eDensity: ${density.toFixed(3)}<br>` + (body.tooltip || "");
		body.gravity = Math.sign(density);
		body.render = {
			fillStyle: body.color,
			textStyle: textColor(body.color),
		};
		body.restitution = 0.1;

		const bodyToAdd = Matter.Bodies.circle(x, y, r, body);
		Matter.Body.setMass(bodyToAdd, Math.abs(density));
		bodiesToAdd.push(bodyToAdd);
	}
	simulation.addBodies(bodiesToAdd);
}
