class_name Ball
extends RigidBody2D

@onready var trail: Line2D = $Trail

var trail_points: Array[Vector2] = []
const MAX_TRAIL_POINTS: int = 16
const MAX_SPEED: float = 2500.0 # Clamp max speed to prevent physical tunneling

# Shared trail gradient (M-1: allocated once, reused across all ball instances)
static var _shared_trail_gradient: Gradient = null

func _ready():
	contact_monitor = true
	max_contacts_reported = 4
	body_entered.connect(_on_body_entered)
	
	# Configure the trail node to remain in global coordinate space
	trail.top_level = true
	trail.global_position = Vector2.ZERO
	trail.global_rotation = 0.0
	trail.width = 8.0
	
	# Assign shared trail gradient (M-1: avoids per-instance allocation)
	if _shared_trail_gradient == null:
		_shared_trail_gradient = Gradient.new()
		_shared_trail_gradient.set_color(0, Color(1, 1, 1, 0))
		_shared_trail_gradient.set_color(1, Color(1, 1, 1, 1.0))
	trail.gradient = _shared_trail_gradient

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
	# Prioritize custom hit logic for bumpers, slingshots (H-3: group-verified)
	if body.is_in_group("bumpers") or body.is_in_group("slingshots"):
		body.hit(self)
		return
		
	# Emit decoupled impact signals (TDD §1.3)
	var speed = linear_velocity.length()
	Events.ball_impact.emit(speed, global_position)
	
	if not body.is_in_group("flippers"):
		Events.wall_hit.emit(speed, global_position)
