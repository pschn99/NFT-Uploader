class_name Slingshot
extends StaticBody2D

@export var score_value: int = 50
@export var kick_speed: float = 600.0       # Kick velocity in px/s
@export var kick_direction: Vector2 = Vector2(0.83, -0.55) # Outward normal direction
@export var is_right: bool = false

@onready var fill_poly: Polygon2D = $FillPoly

var flash_tween: Tween = null

func _ready():
	fill_poly.visible = true
	
	if is_right:
		# Auto-adjust normal direction symmetrically (Issue 3b)
		kick_direction = Vector2(-kick_direction.x, kick_direction.y)
			
		# Programmatically mirror vertices for right flipper
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
			elif child is Line2D:
				var new_points = PackedVector2Array()
				for pt in child.points:
					new_points.append(Vector2(-pt.x, pt.y))
				child.points = new_points

func hit(ball: RigidBody2D):
	# Decoupled signal emission (TDD §1.3 / Issue 2 & 4)
	Events.slingshot_hit.emit(score_value)
	Events.ball_impact.emit(kick_speed)
	
	# Apply realistic rebound physics combining reflected incoming speed & kick speed (Issue TD-4 / M-3)
	var reflected = ball.linear_velocity.reflect(kick_direction.normalized())
	var incoming_speed = reflected.length()
	ball.linear_velocity = kick_direction.normalized() * (incoming_speed * 0.3 + kick_speed)
	
	# Safe tween-based visual hollow flash animation (remediation of L-3)
	if flash_tween:
		flash_tween.kill()
	fill_poly.visible = false
	flash_tween = create_tween()
	flash_tween.tween_callback(func(): fill_poly.visible = true).set_delay(0.1)
