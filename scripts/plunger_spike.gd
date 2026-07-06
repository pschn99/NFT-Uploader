extends Node2D

@export var min_launch_speed: float = 300.0   # 3.0 m/s * 100 px/m
@export var max_launch_speed: float = 2000.0  # 20.0 m/s * 100 px/m
@export var max_charge_time: float = 1.0       # 1.0 second
@export var max_retraction: float = 80.0       # Visual retraction in pixels

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
	if ball_in_plunger != null:
		if Input.is_action_pressed("plunger_launch"):
			charging = true
			hold_time = min(hold_time + delta, max_charge_time)
			_update_visual(hold_time / max_charge_time)
		elif charging and Input.is_action_just_released("plunger_launch"):
			# Release!
			_launch_ball()
			charging = false
			hold_time = 0.0
			_update_visual(0.0)
	else:
		# If the ball left by other means, reset state
		if charging:
			charging = false
			hold_time = 0.0
			_update_visual(0.0)

func _launch_ball():
	if ball_in_plunger == null:
		return
		
	# Quadratic launch velocity formula
	var charge_ratio = hold_time / max_charge_time
	var v_launch = min_launch_speed + (max_launch_speed - min_launch_speed) * (charge_ratio * charge_ratio)
	
	# Apply velocity directly upward
	ball_in_plunger.linear_velocity = Vector2(0, -v_launch)
	SoundController.play_sfx("plunger_release")
	print("Plunger released! Hold time: ", hold_time, "s, Velocity: ", v_launch, " px/s")

func _update_visual(ratio: float):
	# The plunger tip is at y=0 when rest, moves down to y=max_retraction when fully charged
	plunger_visual.clear_points()
	var offset_y = ratio * max_retraction
	plunger_visual.add_point(Vector2(0, offset_y))
	plunger_visual.add_point(Vector2(0, offset_y + 40)) # Plunger shaft length 40 px

func _on_body_entered(body: Node2D):
	if body.name == "Ball" and body is RigidBody2D:
		ball_in_plunger = body
		print("Ball entered plunger launch zone.")

func _on_body_exited(body: Node2D):
	if body == ball_in_plunger:
		ball_in_plunger = null
		print("Ball exited plunger launch zone.")
