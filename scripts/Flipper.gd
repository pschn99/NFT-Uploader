class_name Flipper
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
var is_disabled: bool = false # Limp drop flag

func _ready():
	add_to_group("flippers")
	rest_angle_rad = deg_to_rad(rest_angle_deg)
	active_angle_rad = deg_to_rad(active_angle_deg)
	
	# Auto-adjust defaults symmetrically if it is a right flipper
	if is_right:
		rest_angle_rad = deg_to_rad(-rest_angle_deg)
		active_angle_rad = deg_to_rad(-active_angle_deg)
			
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

func set_disabled(disabled: bool):
	is_disabled = disabled
	if disabled:
		pending_strike = false

func _unhandled_input(event: InputEvent):
	if is_disabled:
		return
		
	if event.is_action_pressed(action_name):
		pending_strike = true
		Events.flipper_activated.emit(is_right, global_position) # Decoupled bus emission
	elif event.is_action_released(action_name):
		Events.flipper_activated.emit(is_right, global_position) # Decoupled bus emission

func _physics_process(delta: float):
	var want_active = false
	if not is_disabled:
		want_active = Input.is_action_pressed(action_name)
		
		if pending_strike:
			want_active = true
			pending_strike = false
			active_ticks = 0
			
		# Enforce minimum active swing duration (anti-ghosting)
		if want_active or active_ticks < MIN_ACTIVE_TICKS:
			active_ticks += 1
			if active_ticks < MIN_ACTIVE_TICKS:
				want_active = true

	# Limp drop behaves by setting target to rest_angle when disabled
	var target_angle = active_angle_rad if want_active else rest_angle_rad
	
	if is_equal_approx(rotation, target_angle):
		return
		
	var angle_diff = target_angle - rotation
	var step = flipper_speed * delta
	
	if abs(angle_diff) <= step:
		rotation = target_angle
	else:
		var dir = 1.0 if angle_diff > 0.0 else -1.0
		rotation += dir * flipper_speed * delta
