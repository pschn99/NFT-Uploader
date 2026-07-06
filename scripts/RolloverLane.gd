extends Area2D

@export var score_value: int = 200

@onready var light: Polygon2D = $Light

func _ready():
	body_entered.connect(_on_body_entered)
	light.visible = true

func _on_body_entered(body: Node2D):
	if body is RigidBody2D:
		ScoreManager.add_score(score_value)
		
		# Play retro chiptune blip
		SoundController.play_sfx("nudge")
		
		# Toggle light off and on to flash
		light.visible = false
		var t = get_tree().create_timer(0.2)
		t.timeout.connect(func(): light.visible = true)
