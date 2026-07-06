extends CanvasLayer

@onready var score_label: Label = $ScoreLabel
@onready var multiplier_label: Label = $MultiplierLabel
@onready var balls_label: Label = $BallsLabel
@onready var tilt_label: Label = $TiltLabel

var is_tilting: bool = false
var flash_timer: float = 0.0
const FLASH_INTERVAL: float = 0.2

func _ready():
	# Connect to ScoreManager signals
	ScoreManager.score_changed.connect(_on_score_changed)
	ScoreManager.multiplier_changed.connect(_on_multiplier_changed)
	ScoreManager.balls_changed.connect(_on_balls_changed)
	
	# Connect to Event bus for decoupled Tilt status warnings (GDD §4 / Issue 13)
	Events.tilt_triggered.connect(_on_tilt_triggered)
	Events.tilt_recovered.connect(_on_tilt_recovered)
	
	# Initialize HUD displays
	_on_score_changed(ScoreManager.current_score)
	_on_multiplier_changed(ScoreManager.score_multiplier)
	_on_balls_changed(ScoreManager.balls_remaining)
	
	multiplier_label.visible = false
	tilt_label.visible = false

func _process(delta: float):
	# Safe, non-recursive frame-based tilt flashing (Issue 7f recommendation)
	if is_tilting:
		flash_timer += delta
		if flash_timer >= FLASH_INTERVAL:
			flash_timer = 0.0
			tilt_label.visible = not tilt_label.visible

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

func _on_tilt_triggered():
	is_tilting = true
	flash_timer = 0.0
	tilt_label.visible = true

func _on_tilt_recovered():
	is_tilting = false
	tilt_label.visible = false
