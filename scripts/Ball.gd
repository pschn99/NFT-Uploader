class_name Ball
extends RigidBody2D

@onready var trail: Line2D = $Trail

var trail_points: Array[Vector2] = []
const MAX_TRAIL_POINTS: int = 16
const MAX_SPEED: float = 2500.0 # Clamp max speed to prevent tunneling (Issue M-1)

func _ready():
	contact_monitor = true
	max_contacts_reported = 4
	body_entered.connect(_on_body_entered)
	
	# Configure the trail node to remain in global coordinate space
	trail.top_level = true
	trail.global_position = Vector2.ZERO
	trail.global_rotation = 0.0
	trail.width = 8.0
	
	# Create a fading gradient for the retro vector look
	var grad = Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 0))       # Fade out completely at tail
	grad.set_color(1, Color(1, 1, 1, 1.0))     # Seamless white connection at ball
	trail.gradient = grad

func _draw():
	# Render the dynamic ball visually as a 1-bit white circle
	draw_circle(Vector2.ZERO, 15.0, Color.WHITE)

func _physics_process(_delta: float):
	# Clamp velocity to prevent physical tunneling or instabilities
	if linear_velocity.length() > MAX_SPEED:
		linear_velocity = linear_velocity.limit_length(MAX_SPEED)

func _process(_delta: float):
	# Record global coordinate history for the visual trail
	trail_points.append(global_position)
	if trail_points.size() > MAX_TRAIL_POINTS:
		trail_points.pop_front()
		
	# Draw the line trail using global points
	trail.points = PackedVector2Array(trail_points)

func _on_body_entered(body: Node2D):
	# Prioritize custom hit logic for bumpers, slingshots, etc.
	if body.has_method("hit"):
		body.hit(self)
		return
		
	# Emit decoupled impact signals (TDD §1.3 / Issue 2)
	var speed = linear_velocity.length()
	Events.ball_impact.emit(speed)
	
	if body.name.begins_with("Flipper"):
		# Flipper activation sound now routed via Events bus (Issue M-2)
		Events.flipper_activated.emit(body.is_right)
	else:
		SoundController.play_sfx("wall_hit")
