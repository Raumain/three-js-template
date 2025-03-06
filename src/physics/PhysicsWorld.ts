import * as CANNON from "cannon";

export class PhysicsWorld {
	public world: CANNON.World;
	private timeStep: number = 1 / 60;
	private accumulator = 0;
	private bodies: CANNON.Body[] = [];

	constructor() {
		this.world = new CANNON.World();
		this.world.gravity.set(0, -4, 0);
		this.world.broadphase = new CANNON.NaiveBroadphase();
		this.world.solver.iterations = 10;

		// Add ground plane at y=0
		const groundShape = new CANNON.Plane();
		const groundBody = new CANNON.Body({
			mass: 0, // Mass 0 makes it static
			shape: groundShape,
			material: new CANNON.Material(""),
		});
		groundBody.quaternion.setFromAxisAngle(
			new CANNON.Vec3(1, 0, 0),
			-Math.PI / 2,
		); // Make it face up
		groundBody.position.set(0, 0, 0); // Position at y=0
		this.addBody(groundBody);
	}

	public update(deltaTime: number): void {
		// Fixed time step for more stable physics
		this.accumulator += deltaTime;

		// Cap max steps to prevent spiral of death if frame rate drops
		const maxSteps = 3;
		let steps = 0;

		while (this.accumulator >= this.timeStep && steps < maxSteps) {
			// Step the physics world
			this.world.step(this.timeStep);
			this.accumulator -= this.timeStep;
			steps++;
		}
	}

	public addBody(body: CANNON.Body): void {
		this.world.addBody(body);
		this.bodies.push(body);
	}

	public removeBody(body: CANNON.Body): void {
		const index = this.bodies.indexOf(body);
		if (index !== -1) {
			this.bodies.splice(index, 1);
		}
		//@ts-ignore
		this.world.removeBody(body);
	}

	public dispose(): void {
		// Remove all bodies
		for (const body of this.bodies.slice()) {
			this.removeBody(body);
		}
	}
}
