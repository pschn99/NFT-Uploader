class_name RolloverLane
extends Area2D

@export var score_value: int = 200

@onready var light: Polygon2D = $Light

var flash_tween: Tween = null

func _ready():
	body_entered.connect(_on_body_entered)
	light.visible = true

func _on_body_entered(body: Node2D):
	if body is RigidBody2D:
		# Decoupled signal emission (TDD §1.3)
		Events.rollover_triggered.emit(score_value, global_position)
		
		# Toggle light off and on to flash safely using Tween
		if flash_tween:
			flash_tween.kill()
		light.visible = false
		flash_tween = create_tween()
		flash_tween.tween_callback(func(): light.visible = true).set_delay(0.2)
