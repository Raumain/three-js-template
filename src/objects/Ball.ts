import * as CANNON from "cannon";
import {
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	type Vector3,
} from "three";

export class Ball {
	private mesh: Mesh;
	private body: CANNON.Body;
	private readonly RADIUS = 0.2;
	private readonly MASS = 1;
	private readonly LIFETIME = 5000; // milliseconds
	private creationTime: number;
	private onCollideCallback?: (event: { body: CANNON.Body }) => void;
	private disposed = false;

	constructor(
		position: Vector3,
		velocity: Vector3,
		onCollideCallback?: (event: { body: CANNON.Body }) => void,
	) {
		// Create three.js visual representation
		const geometry = new SphereGeometry(this.RADIUS, 16, 16);
		const material = new MeshStandardMaterial({
			color: 0xfda111,
			emissive: 0xed8111,
			emissiveIntensity: 0.5,
			roughness: 0.4,
		});
		this.mesh = new Mesh(geometry, material);
		this.mesh.castShadow = true;
		this.mesh.position.copy(position);

		// Create cannon.js physics body
		const shape = new CANNON.Sphere(this.RADIUS);
		this.body = new CANNON.Body({
			mass: this.MASS,
			shape: shape,
			linearDamping: 0.1, // Air resistance
			position: new CANNON.Vec3(position.x, position.y, position.z),
		});

		// Set initial velocity
		this.body.velocity.set(velocity.x, velocity.y, velocity.z);

		// Store creation time for lifetime management
		this.creationTime = Date.now();

		// Set up collision callback
		this.onCollideCallback = onCollideCallback;
		if (this.onCollideCallback) {
			this.body.addEventListener("collide", this.onCollideCallback);
		}
	}

	public update(): boolean {
		if (this.disposed) return false;

		// Update mesh position from physics body
		if (this.body && this.mesh) {
			this.mesh.position.set(
				this.body.position.x,
				this.body.position.y,
				this.body.position.z,
			);

			// Update mesh rotation from physics body
			this.mesh.quaternion.set(
				this.body.quaternion.x,
				this.body.quaternion.y,
				this.body.quaternion.z,
				this.body.quaternion.w,
			);
		}

		// Check if ball has lived too long and should be removed
		const currentTime = Date.now();
		return currentTime - this.creationTime < this.LIFETIME;
	}

	public getMesh(): Mesh {
		return this.mesh;
	}

	public getBody(): CANNON.Body {
		return this.body;
	}

	public dispose(): void {
		if (this.disposed) return;

		// Clean up listeners
		if (this.onCollideCallback) {
			this.body.removeEventListener("collide", this.onCollideCallback);
		}

		// Clean up geometry and material
		this.mesh.geometry.dispose();
		if (Array.isArray(this.mesh.material)) {
			for (const material of this.mesh.material) {
				material.dispose();
			}
		} else {
			(this.mesh.material as MeshStandardMaterial).dispose();
		}

		this.disposed = true;
	}
}
