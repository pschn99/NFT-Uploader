extends Node2D

@export var min_launch_speed: float = 300.0   # Min launch speed (3.0 m/s * PIXELS_PER_METER)
@export var max_launch_speed: float = 2000.0  # Max launch speed (20.0 m/s * PIXELS_PER_METER)
@export var max_charge_time: float = 1.0       # Max charge time (seconds)
@export var max_retraction: float = 80.0       # Visual shaft retraction (pixels)

var hold_time: float = 0.0
var charging: bool = false
var ball_in_plunger: RigidBody2D = null

@onready var plunger_visual: Line2D = $PlungerVisual
@onready var launch_area: Area2D = $LaunchArea

func _ready():
	launch_area.body_entered.connect(_on_body_entered)
	launch_area.body_exited.connect(_on_body_exited)
	_update_visual(0.0)

func _physics_process(delta: float):
	# If the ball is in the plunger pocket
	if ball_in_plunger != null:
		if Input.is_action_pressed("plunger_launch"):
			if Input.is_action_just_pressed("plunger_launch"):
				SoundController.play_sfx("plunger_charge")
			charging = true
			hold_time = min(hold_time + delta, max_charge_time)
			_update_visual(hold_time / max_charge_time)

		elif charging and Input.is_action_just_released("plunger_launch"):
			_launch_ball()
			charging = false
			hold_time = 0.0
			_update_visual(0.0)
	else:
		# Reset state if ball leaves pocket by nudging or other means
		if charging:
			charging = false
			hold_time = 0.0
			_update_visual(0.0)

func _launch_ball():
	if ball_in_plunger == null:
		return
		
	# Quadratic launch velocity formula (TDD §4.3)
	var charge_ratio = hold_time / max_charge_time
	var v_launch = min_launch_speed + (max_launch_speed - min_launch_speed) * (charge_ratio * charge_ratio)
	
	# Apply velocity directly upward
	ball_in_plunger.linear_velocity = Vector2(0, -v_launch)
	SoundController.play_sfx("plunger_release")
	print("Plunger launched ball! Hold time: ", hold_time, "s, Velocity: ", v_launch, " px/s")

func _update_visual(ratio: float):
	plunger_visual.clear_points()
	var offset_y = ratio * max_retraction
	# Draw plunger plunger shaft
	plunger_visual.add_point(Vector2(0, offset_y))
	plunger_visual.add_point(Vector2(0, offset_y + 40))

func _on_body_entered(body: Node2D):
	if body is RigidBody2D:
		ball_in_plunger = body
		# Lock ball horizontal position to plunger lane center if entering plunger lane
		# to ensure clean vertical launches
		ball_in_plunger.global_position.x = global_position.x
		ball_in_plunger.linear_velocity = Vector2.ZERO
		ball_in_plunger.angular_velocity = 0.0
		print("Ball entered plunger lane.")

func _on_body_exited(body: Node2D):
	if body == ball_in_plunger:
		ball_in_plunger = null
		print("Ball exited plunger lane.")
