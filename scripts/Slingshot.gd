extends StaticBody2D

@export var score_value: int = 50
@export var kick_speed: float = 600.0       # Kick velocity in px/s
@export var kick_direction: Vector2 = Vector2(0.83, -0.55) # Outward normal direction
@export var is_right: bool = false

@onready var fill_poly: Polygon2D = $FillPoly
@onready var active_face: Area2D = $ActiveFace
@onready var active_shape: CollisionShape2D = $ActiveFace/CollisionShape2D

func _ready():
	active_face.body_entered.connect(_on_active_face_entered)
	fill_poly.visible = true
	
	if is_right:
		# Auto-adjust normal direction symmetrically
		if kick_direction == Vector2(0.83, -0.55):
			kick_direction = Vector2(-0.83, -0.55)
			
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
		
		# Programmatically duplicate and mirror SegmentShape2D
		if active_shape and active_shape.shape is SegmentShape2D:
			var seg = active_shape.shape.duplicate()
			seg.a = Vector2(-seg.a.x, seg.a.y)
			seg.b = Vector2(-seg.b.x, seg.b.y)
			active_shape.shape = seg

func _on_active_face_entered(body: Node2D):
	if body is RigidBody2D:
		ScoreManager.add_score(score_value)
		SoundController.play_sfx("slingshot")
		
		# Kick velocity vector perpendicular to active face
		body.linear_velocity = kick_direction.normalized() * kick_speed
		
		# Invert/hollow flash
		fill_poly.visible = false
		var t = get_tree().create_timer(0.1)
		t.timeout.connect(func(): fill_poly.visible = true)
		
		var session = get_node_or_null("/root/Main/GameSession")
		if session and session.has_method("add_camera_trauma"):
			session.add_camera_trauma(0.2)
