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

		this.aspectRatio = this.simWidth/this.simHeight;

		this.simBounds = {
			min: {x: 0, y: 0},
			max: {x: this.simWidth, y: this.simHeight},
		};

		this.addWalls();

		this.render = Matter.Render.create({
			canvas: this.canvas,
			engine: this.engine,
			bounds: this.simBounds,
			options: {
				wireframes: true,
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
		Matter.World.add(this.world, this.mouseConstraint);
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

function updateSimulationData(simulation, data, noodle) {
	console.log("team: " + data.team.url_slug);
	console.log("roster.length: " + data.roster.length);
	console.log("stadium: " + data.stadium.name);
	console.log("wins: " + data.wins);
	console.log("runs: " + data.runs);
	console.log("noodle: " + noodle);
	Matter.World.add(simulation.world, [makeBody(100, [25, 25])]);
}

function makeBody(density, pos=null, color=null, text=null) {
	[x, y] = pos || [0., 0.]

	r = Math.sqrt(density);
	body = Matter.Bodies.circle(x, y, r, {
	});

	Matter.Body.setMass(body, density);

	return body;
}
