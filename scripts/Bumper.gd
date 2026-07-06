class_name Bumper
extends StaticBody2D

@export var score_value: int = 100
@export var kick_speed: float = 800.0 # Rebound kick velocity in px/s

@onready var fill_poly: Polygon2D = $FillPoly

func _ready():
	fill_poly.visible = true

func hit(ball: RigidBody2D):
	# Decoupled signal emission (TDD §1.3 / Issue 2)
	Events.bumper_hit.emit(score_value)
	Events.ball_impact.emit(kick_speed)
	
	# Apply active radial rebound force to ball
	var dir = (ball.global_position - global_position).normalized()
	if dir == Vector2.ZERO:
		dir = Vector2.UP # Fallback to prevent NaN
	ball.linear_velocity = dir * kick_speed
	
	# Visual hollow flash animation (toggle center fill polygon)
	fill_poly.visible = false
	var t = get_tree().create_timer(0.1)
	t.timeout.connect(func(): fill_poly.visible = true)
