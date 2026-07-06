extends CanvasLayer

@onready var score_label: Label = $ScoreLabel
@onready var multiplier_label: Label = $MultiplierLabel
@onready var balls_label: Label = $BallsLabel

func _ready():
	# Connect to ScoreManager signals
	ScoreManager.score_changed.connect(_on_score_changed)
	ScoreManager.multiplier_changed.connect(_on_multiplier_changed)
	ScoreManager.balls_changed.connect(_on_balls_changed)
	
	# Initialize HUD displays
	_on_score_changed(ScoreManager.current_score)
	_on_multiplier_changed(ScoreManager.score_multiplier)
	_on_balls_changed(ScoreManager.balls_remaining)
	
	multiplier_label.visible = false

func _on_score_changed(new_score: int):
	# Pad with zeros for classic retro arcade counter look (e.g. 000000)
	score_label.text = "SCORE: %06d" % new_score

func _on_multiplier_changed(new_mult: float):
	if new_mult > 1.0:
		multiplier_label.text = "MULTIPLIER: %dX!" % int(new_mult)
		multiplier_label.visible = true
		
		# Show a quick retro flash animation using a timer
		var t = get_tree().create_timer(1.5)
		t.timeout.connect(func():
			if ScoreManager.score_multiplier == new_mult: # Ensure multiplier hasn't changed again
				multiplier_label.visible = false
		)
	else:
		multiplier_label.visible = false

func _on_balls_changed(new_balls: int):
	var ball_icons = ""
	for i in range(new_balls):
		ball_icons += "O " # Retro circles
	balls_label.text = "BALLS: " + ball_icons.strip_edges()
	if new_balls == 0:
		balls_label.text = "BALLS: NONE"
