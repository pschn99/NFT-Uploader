class_name Ball
extends RigidBody2D

@onready var trail: Line2D = $Trail

var trail_points: Array[Vector2] = []
const MAX_TRAIL_POINTS: int = 16

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
		
	# Default fallback for simple collisions (walls, flippers)
	if body.name.begins_with("Flipper"):
		SoundController.play_sfx("flipper")
	else:
		SoundController.play_sfx("nudge")
			
	# Emit trauma shake based on relative speed
	var session = get_node_or_null("/root/Main/GameSession")
	if session and session.has_method("add_camera_trauma"):
		var impact = linear_velocity.length() / 1000.0
		session.add_camera_trauma(clamp(impact, 0.1, 0.5))
