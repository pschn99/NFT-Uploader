extends AnimatableBody2D

@export var is_right: bool = false
@export var rest_angle_deg: float = 30.0
@export var active_angle_deg: float = -30.0
@export var flipper_speed: float = 40.0 # rad/s target solenoid velocity

var rest_angle_rad: float
var active_angle_rad: float
var action_name: String = ""

# Input buffering latches
var pending_strike: bool = false
var active_ticks: int = 0
const MIN_ACTIVE_TICKS: int = 6
var angular_velocity: float = 0.0

func _ready():
	rest_angle_rad = deg_to_rad(rest_angle_deg)
	active_angle_rad = deg_to_rad(active_angle_deg)
	
	# Auto-adjust defaults symmetrically if it is a right flipper
	if is_right:
		if rest_angle_deg == 30.0 and active_angle_deg == -30.0:
			rest_angle_rad = deg_to_rad(-30.0)
			active_angle_rad = deg_to_rad(30.0)
			
		# Programmatically mirror vertices for right-sided flippers
		for child in get_children():
			if child is CollisionPolygon2D:
				var new_poly = PackedVector2Array()
				for pt in child.polygon:
					new_poly.append(Vector2(-pt.x, pt.y))
				child.polygon = new_poly
			elif child is Polygon2D:
				var new_poly = PackedVector2Array()
				for pt in child.polygon:
					new_poly.append(Vector2(-pt.x, pt.y))
				child.polygon = new_poly
		
	action_name = "flipper_right" if is_right else "flipper_left"
	rotation = rest_angle_rad

	print("Flipper initialized: ", name, " (", action_name, ") Rest: ", rad_to_deg(rest_angle_rad), " Active: ", rad_to_deg(active_angle_rad))

func _unhandled_input(event: InputEvent):
	if event.is_action_pressed(action_name):
		pending_strike = true
		SoundController.play_sfx("flipper")

func _physics_process(delta: float):
	var want_active = Input.is_action_pressed(action_name)
	
	if pending_strike:
		want_active = true
		pending_strike = false
		active_ticks = 0
		
	# Enforce minimum active swing duration (anti-ghosting)
	if want_active or active_ticks < MIN_ACTIVE_TICKS:
		active_ticks += 1
		if active_ticks < MIN_ACTIVE_TICKS:
			want_active = true

	var target_angle = active_angle_rad if want_active else rest_angle_rad
	
	if rotation == target_angle:
		angular_velocity = 0.0
		return
		
	var angle_diff = target_angle - rotation
	var step = flipper_speed * delta
	
	if abs(angle_diff) <= step:
		rotation = target_angle
		angular_velocity = 0.0
	else:
		var dir = 1.0 if angle_diff > 0.0 else -1.0
		angular_velocity = dir * flipper_speed
		rotation += angular_velocity * delta
