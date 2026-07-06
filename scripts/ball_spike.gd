extends RigidBody2D

func _ready():
	contact_monitor = true
	max_contacts_reported = 4
	body_entered.connect(_on_body_entered)

func _draw():
	# Draw a filled white circle of radius 15
	draw_circle(Vector2.ZERO, 15, Color.WHITE)

func _physics_process(_delta):
	# If the ball falls too low, respawn it at the top
	if global_position.y > 3000:
		global_position = Vector2(900, 1000)
		linear_velocity = Vector2.ZERO
		angular_velocity = 0.0
		print("Ball spike: Respawned ball at top.")

func _on_body_entered(body: Node2D):
	if body.name.begins_with("Flipper"):
		SoundController.play_sfx("bumper")
	else:
		SoundController.play_sfx("nudge")
