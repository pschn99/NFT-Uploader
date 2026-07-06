class_name Bumper
extends StaticBody2D

@export var score_value: int = 100
@export var kick_speed: float = 800.0 # Rebound kick velocity in px/s

@onready var fill_poly: Polygon2D = $FillPoly

var flash_tween: Tween = null

func _ready():
	fill_poly.visible = true

func hit(ball: RigidBody2D):
	# Decoupled signal emission (TDD §1.3 / Issue 2)
	Events.bumper_hit.emit(score_value)
	Events.ball_impact.emit(kick_speed)
	
	# Apply realistic rebound physics combining incoming speed & kick speed (Issue TD-4)
	var dir = (ball.global_position - global_position).normalized()
	if dir == Vector2.ZERO:
		dir = Vector2.UP # Fallback to prevent NaN
		
	var incoming_speed = ball.linear_velocity.length()
	ball.linear_velocity = dir * (incoming_speed * 0.5 + kick_speed)
	
	# Safe tween-based visual hollow flash animation (remediation of L-3)
	if flash_tween:
		flash_tween.kill()
	fill_poly.visible = false
	flash_tween = create_tween()
	flash_tween.tween_callback(func(): fill_poly.visible = true).set_delay(0.1)
