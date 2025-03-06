import {
	Material,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	type PerspectiveCamera,
	Raycaster,
	SphereGeometry,
	Vector3,
} from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import type { Clock, Lifecycle } from "~/core";
import { Seagull } from "~/objects/Seagull"; // Add Seagull import
import type { ExampleScene } from "~/scenes/ExampleScene";

export interface FirstPersonControlsParameters {
	camera: PerspectiveCamera;
	element: HTMLElement;
	clock: Clock;
	scene?: ExampleScene;
}

export class FirstPersonControls implements Lifecycle {
	public clock: Clock;
	public element: HTMLElement;
	private camera: PerspectiveCamera;
	private controls: PointerLockControls;
	private scene?: ExampleScene;

	private moveForward = false;
	private moveBackward = false;
	private moveLeft = false;
	private moveRight = false;
	private jumpRequested = false;
	private movementSpeed = 15;
	private jumpSpeed = 15;

	private velocity = new Vector3();
	private direction = new Vector3();
	private gravity = 50;
	private isOnGround = false;
	private playerHeight = 2.5;
	private canJump = true;

	private raycaster = new Raycaster();
	private collidableMeshes: Object3D[] = [];
	private collisionDistance = 1;
	private readonly COLLISION_UPDATE_INTERVAL = 500; // ms
	private lastCollisionUpdate = 0;
	private readonly _v1 = new Vector3();
	private readonly _v2 = new Vector3();
	private crosshair: HTMLDivElement | null = null;
	private balls: Mesh[] = [];
	private ballGeometry: SphereGeometry;
	private ballMaterial: MeshStandardMaterial;
	private readonly BALL_LIFETIME = 5000; // milliseconds
	private readonly BALL_SPEED = 100;
	private boundOnClick: (event: MouseEvent) => void;
	private ballRaycaster = new Raycaster();
	private readonly _v3 = new Vector3(); // Additional reusable vector
	private readonly BOUNCE_FACTOR = 0.6; // How much velocity is retained after bounce

	constructor({
		camera,
		element,
		clock,
		scene,
	}: FirstPersonControlsParameters) {
		this.camera = camera;
		this.element = element;
		this.clock = clock;
		this.scene = scene;

		this.ballGeometry = new SphereGeometry(0.2, 8, 8); // Small sphere with low poly count for performance
		this.ballMaterial = new MeshStandardMaterial({
			color: 0xfd6f00,
			metalness: 0.7,
			roughness: 0.3,
		});

		// Bind click handler once to avoid memory leaks
		this.boundOnClick = this.onMouseClick.bind(this);

		this.controls = new PointerLockControls(this.camera, this.element);

		this.createInstructions();
		this.createCrosshair();
		this.setupEventListeners();
	}

	private findCollidableMeshes(): void {
		if (!this.scene) return;

		this.collidableMeshes = [];

		this.scene.traverse((object) => {
			if (
				(object instanceof Mesh && !(object instanceof Water)) ||
				// Also include seagull objects in collision detection
				Seagull.isSeagull(object)
			) {
				this.collidableMeshes.push(object);
			}
		});

		console.log(`Found ${this.collidableMeshes.length} collidable objects`);

		if (this.collidableMeshes.length > 0) {
			console.log(
				"Collidable objects:",
				this.collidableMeshes.map(
					(obj) => obj.name || (obj.userData.isSeagull ? "seagull" : "unnamed"),
				),
			);
		} else {
			console.warn(
				"No collidable objects found! Your GLTF model might not be loaded yet or doesn't contain standard meshes.",
			);
		}
	}

	private createInstructions(): void {
		const instructions = document.createElement("div");
		instructions.style.position = "absolute";
		instructions.style.top = "10px";
		instructions.style.width = "100%";
		instructions.style.textAlign = "center";
		instructions.style.color = "#ffffff";
		instructions.style.backgroundColor = "rgba(0,0,0,0.5)";
		instructions.style.padding = "10px";
		instructions.style.zIndex = "100";
		instructions.innerHTML = "Click to enable first-person controls<br>";
		instructions.innerHTML += "WASD: Move, Space: Jump<br>";
		instructions.innerHTML += "ESC: Exit controls";
		document.body.appendChild(instructions);

		this.controls.addEventListener("lock", () => {
			instructions.style.display = "none";
		});

		this.controls.addEventListener("unlock", () => {
			instructions.style.display = "block";
		});
	}

	private setupEventListeners(): void {
		this.element.addEventListener("click", () => {
			this.controls.lock();
		});

		document.addEventListener("keydown", this.onKeyDown.bind(this));
		document.addEventListener("keyup", this.onKeyUp.bind(this));
		document.addEventListener("mousedown", this.boundOnClick);
	}
	private onMouseClick(event: MouseEvent): void {
		// Only handle left clicks (button 0) when controls are active
		if (event.button === 0 && this.controls.isLocked && this.scene) {
			this.throwBall();
		}
	}
	private throwBall(): void {
		if (!this.scene) return;

		// Create ball mesh
		const ball = new Mesh(this.ballGeometry, this.ballMaterial);

		// Position ball slightly in front of camera
		ball.position.copy(this.camera.position);
		const direction = new Vector3(0, 0, -1).applyQuaternion(
			this.camera.quaternion,
		);
		ball.position.addScaledVector(direction, 0.5); // Start slightly in front to avoid collision with camera

		// Store velocity with the ball (as a custom property)
		// @ts-ignore - Adding custom property
		ball.velocity = direction.multiplyScalar(this.BALL_SPEED);

		// Add tag for collision detection with seagulls
		ball.userData.isBall = true;

		// Add to scene and tracking array
		this.scene.add(ball);
		this.balls.push(ball);

		// Set timeout to remove the ball
		setTimeout(() => {
			if (this.scene && ball.parent === this.scene) {
				this.scene.remove(ball);
			}
			const index = this.balls.indexOf(ball);
			if (index > -1) {
				this.balls.splice(index, 1);
			}
			ball.geometry.dispose();
		}, this.BALL_LIFETIME);
	}
	private onKeyDown(event: KeyboardEvent): void {
		switch (event.code) {
			case "KeyW":
			case "ArrowUp":
				this.moveForward = true;
				break;
			case "KeyS":
			case "ArrowDown":
				this.moveBackward = true;
				break;
			case "KeyA":
			case "ArrowLeft":
				this.moveLeft = true;
				break;
			case "KeyD":
			case "ArrowRight":
				this.moveRight = true;
				break;
			case "Space":
				this.jumpRequested = true;
				break;
		}
	}

	private onKeyUp(event: KeyboardEvent): void {
		switch (event.code) {
			case "KeyW":
			case "ArrowUp":
				this.moveForward = false;
				break;
			case "KeyS":
			case "ArrowDown":
				this.moveBackward = false;
				break;
			case "KeyA":
			case "ArrowLeft":
				this.moveLeft = false;
				break;
			case "KeyD":
			case "ArrowRight":
				this.moveRight = false;
				break;
			case "Space":
				this.jumpRequested = false;
				break;
		}
	}

	public setPosition(x: number, y: number, z: number): void {
		this.camera.position.set(x, y, z);
	}
	public lookAt(x: number, y: number, z: number): void {
		this.camera.lookAt(x, y, z);
	}

	public start(): void {
		setTimeout(() => {
			if (this.scene) {
				this.findCollidableMeshes();
			}
		}, 1000);
	}

	public stop(): void {
		this.controls.unlock();
	}

	public update(): boolean {
		if (this.collidableMeshes.length === 0 && this.scene) {
			this.findCollidableMeshes();
		}

		if (
			this.scene &&
			this.clock.elapsed - this.lastCollisionUpdate >
				this.COLLISION_UPDATE_INTERVAL
		) {
			this.lastCollisionUpdate = this.clock.elapsed;
			this.initSpatialPartitioning();
		}

		if (this.controls.isLocked) {
			const delta = this.clock.delta / 1000;

			this.checkGroundCollision();

			if (!this.isOnGround) {
				this.velocity.y -= this.gravity * delta;
			} else if (this.velocity.y < 0) {
				this.velocity.y = 0;
			}

			if (this.jumpRequested && this.isOnGround && this.canJump) {
				this.velocity.y = this.jumpSpeed;
				this.isOnGround = false;
				this.canJump = false;

				setTimeout(() => {
					this.canJump = true;
				}, 250);
			}

			this.direction.z = Number(this.moveBackward) - Number(this.moveForward);
			this.direction.x = Number(this.moveRight) - Number(this.moveLeft);

			if (this.direction.length() > 0) {
				this.direction.normalize();

				const horizontalSpeed = this.movementSpeed * delta;
				this.direction.multiplyScalar(horizontalSpeed);

				const originalPosition = this.camera.position.clone();

				this.controls.moveForward(-this.direction.z);
				this.controls.moveRight(this.direction.x);

				if (this.checkCollision()) {
					this.camera.position.copy(originalPosition);
				}
			}

			const originalYPosition = this.camera.position.y;
			this.camera.position.y += this.velocity.y * delta;

			if (this.checkCollision()) {
				this.camera.position.y = originalYPosition;
				this.velocity.y = 0;
			}
		}

		const delta = this.clock.delta / 1000;
		for (let i = this.balls.length - 1; i >= 0; i--) {
			const ball = this.balls[i];
			// @ts-ignore - Accessing custom property
			const velocity = ball.velocity;

			if (velocity) {
				// Store original position for collision detection
				this._v3.copy(ball.position);

				// Calculate movement for this frame
				const moveDistance = velocity.length() * delta;

				// Set up raycaster in the direction of movement
				this.ballRaycaster.set(ball.position, velocity.clone().normalize());

				// Check for collisions
				if (this.collidableMeshes.length > 0) {
					const intersections = this.ballRaycaster.intersectObjects(
						this.collidableMeshes,
						false,
					);

					// Handle collision if an object is in the path
					if (
						intersections.length > 0 &&
						intersections[0].distance < moveDistance
					) {
						const collision = intersections[0];

						// Check if we hit a seagull
						const hitSeagull = Seagull.isSeagull(collision.object);

						if (hitSeagull) {
							console.log("Hit a seagull!");

							// Find the corresponding seagull instance by traversing up the object hierarchy
							let seagullObject = collision.object;
							while (seagullObject && !seagullObject.userData.isSeagullRoot) {
								if (seagullObject.parent) {
									seagullObject = seagullObject.parent;
								} else {
									break;
								}
							}

							// Find the matching Seagull instance to call the hit method
							if (this.scene) {
								// Find all seagulls in the scene
								const seagullsInScene: Seagull[] = [];
								this.scene.traverse((obj) => {
									if (obj.userData?.seagullInstance instanceof Seagull) {
										seagullsInScene.push(obj.userData.seagullInstance);
									}
								});

								// Try to find the specific seagull that was hit
								for (const seagull of this.scene.seagulls) {
									const model = seagull.getModel();
									if (
										model === seagullObject ||
										model?.getObjectById(collision.object.id)
									) {
										// We found the seagull instance, call hit()
										seagull.hit();
										break;
									}
								}
							}

							// Remove the ball after hitting a seagull
							if (this.scene && ball.parent === this.scene) {
								this.scene.remove(ball);
								const ballIndex = this.balls.indexOf(ball);
								if (ballIndex > -1) {
									this.balls.splice(ballIndex, 1);
								}
							}

							continue; // Skip further processing for this ball
						}

						// Calculate bounce direction using reflection
						const normal = collision.face?.normal;
						if (normal) {
							// Convert normal from object space to world space
							const normalWorld = normal
								.clone()
								.applyQuaternion(collision.object.quaternion);

							// Reflect velocity vector around normal
							velocity.reflect(normalWorld).multiplyScalar(this.BOUNCE_FACTOR);

							// Position the ball at the impact point (slightly offset along normal)
							ball.position
								.copy(collision.point)
								.addScaledVector(normalWorld, 0.2);

							// Play bounce sound (could add later)
							// if (this.bounceSound?.buffer) this.bounceSound.play();
							continue; // Skip regular movement this frame
						}
					}
				}

				// No collision, update position normally
				ball.position.addScaledVector(velocity, delta);

				// Apply gravity
				velocity.y -= 9.8 * delta;

				// Floor collision detection (simple)
				if (ball.position.y < 0) {
					ball.position.y = 0;
					velocity.y = -velocity.y * this.BOUNCE_FACTOR;

					// Reduce horizontal momentum slightly when hitting the floor
					velocity.x *= 0.95;
					velocity.z *= 0.95;

					// Stop tiny bounces
					if (Math.abs(velocity.y) < 0.5) {
						velocity.y = 0;
					}
				}

				// Stop balls with negligible movement
				if (velocity.lengthSq() < 0.1) {
					velocity.set(0, 0, 0);
				}
			}
		}

		return true;
	}

	private createCrosshair(): void {
		// Create crosshair element
		this.crosshair = document.createElement("div");

		// Style the crosshair
		Object.assign(this.crosshair.style, {
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			width: "20px",
			height: "20px",
			pointerEvents: "none", // Makes sure it doesn't interfere with mouse events
			zIndex: "1000",
		});

		// Create the crosshair shape with a plus sign
		const horizontal = document.createElement("div");
		Object.assign(horizontal.style, {
			position: "absolute",
			width: "100%",
			height: "2px",
			backgroundColor: "white",
			top: "50%",
			transform: "translateY(-50%)",
		});

		const vertical = document.createElement("div");
		Object.assign(vertical.style, {
			position: "absolute",
			width: "2px",
			height: "100%",
			backgroundColor: "white",
			left: "50%",
			transform: "translateX(-50%)",
		});

		// Add dot in the center (optional)
		const center = document.createElement("div");
		Object.assign(center.style, {
			position: "absolute",
			width: "4px",
			height: "4px",
			borderRadius: "50%",
			backgroundColor: "white",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
		});

		// Assemble the crosshair
		this.crosshair.appendChild(horizontal);
		this.crosshair.appendChild(vertical);
		this.crosshair.appendChild(center);

		// Add to DOM
		document.body.appendChild(this.crosshair);

		// Show/hide with pointer lock
		this.controls.addEventListener("lock", () => {
			if (this.crosshair) this.crosshair.style.display = "block";
		});

		this.controls.addEventListener("unlock", () => {
			if (this.crosshair) this.crosshair.style.display = "none";
		});

		// Initially hidden until controls are locked
		if (this.crosshair) this.crosshair.style.display = "none";
	}

	private checkGroundCollision(): void {
		if (this.collidableMeshes.length === 0) return;

		this.raycaster.set(this.camera.position, new Vector3(0, -1, 0));
		const intersections = this.raycaster.intersectObjects(
			this.collidableMeshes,
			false,
		);

		this.isOnGround =
			intersections.length > 0 &&
			intersections[0].distance <= this.playerHeight;
	}

	private checkCollision(): boolean {
		this._v1.copy(this.camera.position);
		this._v2.copy(this.direction);
		this.raycaster.set(this.camera.position, this._v2);
		if (this.collidableMeshes.length === 0) return false;

		const directions: Vector3[] = [];
		if (this.moveForward || this.moveBackward) {
			directions.push(new Vector3(0, 0, this.moveForward ? -1 : 1));
		}
		if (this.moveLeft || this.moveRight) {
			directions.push(new Vector3(this.moveRight ? 1 : -1, 0, 0));
		}
		directions.push(new Vector3(0, -1, 0));

		for (const direction of directions) {
			this.raycaster.set(this.camera.position, direction);
			const intersections = this.raycaster.intersectObjects(
				this.collidableMeshes,
				false,
			);

			if (
				intersections.length > 0 &&
				intersections[0].distance < this.collisionDistance
			) {
				return true;
			}
		}

		return false;
	}

	private initSpatialPartitioning(): void {
		if (!this.scene) return;

		// Simple distance-based culling
		this.collidableMeshes = [];
		const playerPosition = this.camera.position;

		this.scene.traverse((object) => {
			if (object instanceof Mesh && !(object instanceof Water)) {
				// Only consider objects within reasonable distance
				if (object.position.distanceTo(playerPosition) < 50) {
					this.collidableMeshes.push(object);
				}
			}
		});
	}
	public dispose(): void {
		if (this.scene) {
			for (const ball of this.balls) {
				this.scene.remove(ball);
				ball.geometry.dispose();
				if (ball.material instanceof Material) {
					ball.material.dispose();
				}
			}
		}
		this.balls = [];
		this.ballGeometry.dispose();
		this.ballMaterial.dispose();

		this.controls.unlock();
		if (this.crosshair?.parentNode) {
			this.crosshair.parentNode.removeChild(this.crosshair);
		}
		document.removeEventListener("keydown", this.onKeyDown.bind(this));
		document.removeEventListener("keyup", this.onKeyUp.bind(this));
		this.controls.dispose();
	}
}
