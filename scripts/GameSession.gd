class_name GameSession
extends Node2D

signal game_completed(final_score: int)

enum GameState {
	MENU,
	PLAYING,
	PAUSED,
	TILT,
	DRAINED,
	GAME_OVER
}

@export var nudge_impulse: float = 300.0
@export var max_nudges: int = 3
@export var nudge_decay_time: float = 4.0 # 1 charge decays every 4 seconds

var current_state: GameState = GameState.MENU
var pre_pause_state: GameState = GameState.PLAYING
var tilt_count: int = 0
var decay_timer: float = 0.0
var active_ball: RigidBody2D = null
var tilt_session_id: int = 0

const BALL_SCENE: PackedScene = preload("res://scenes/Ball.tscn")

@onready var camera: Camera2D = $GameCamera
@onready var hud: CanvasLayer = $HUD
@onready var pause_menu: CanvasLayer = $PauseMenu
@onready var table: Node2D = $Table
@onready var plunger: Node2D = $Table/Plunger
@onready var drain_area: Area2D = $Table/DrainArea

func _ready():
	# Connect UI signals
	pause_menu.resume_pressed.connect(_on_resume_pressed)
	pause_menu.exit_pressed.connect(_on_exit_pressed)
	
	# Connect Table Drain area
	drain_area.body_entered.connect(_on_ball_drained)
	
	# Connect ball impact signal to camera shake (TDD §1.3 / Issue 2 & 9)
	Events.ball_impact.connect(_on_events_ball_impact)
	
	# Initialize overlays
	pause_menu.visible = false
	current_state = GameState.MENU
	
	# Disable flippers initially (idle menu state)
	_set_flippers_enabled(false)
	print("GameSession: Initialized in MENU state.")

func start_game():
	print("GameSession: Starting active play (PLAYING).")
	current_state = GameState.PLAYING
	_set_flippers_enabled(true)
	_spawn_ball()

func _set_flippers_enabled(enabled: bool):
	# Flippers register in the "flippers" group dynamically
	var flippers = get_tree().get_nodes_in_group("flippers")
	for f in flippers:
		if f.has_method("set_disabled"):
			f.set_disabled(not enabled)

func _process(delta: float):
	if current_state == GameState.PLAYING:
		# Process nudge decay
		if tilt_count > 0:
			decay_timer += delta
			if decay_timer >= nudge_decay_time:
				tilt_count -= 1
				decay_timer = 0.0
				print("GameSession: Nudge charges decayed. Current: ", tilt_count)

func _unhandled_input(event: InputEvent):
	if current_state == GameState.PLAYING:
		if event.is_action_pressed("pause_toggle"):
			_set_pause_state(true)
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("nudge_left"):
			_nudge_table(-1.0)
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("nudge_right"):
			_nudge_table(1.0)
			get_viewport().set_input_as_handled()
	elif current_state == GameState.PAUSED:
		if event.is_action_pressed("pause_toggle"):
			_set_pause_state(false)
			get_viewport().set_input_as_handled()

func _nudge_table(dir_sign: float):
	if active_ball == null:
		return
		
	# Apply nudge impulse to ball
	active_ball.apply_central_impulse(Vector2(dir_sign * nudge_impulse, 0))
	
	# Award points for nudges performed when ball is in the drain zone (GDD §5 / Issue 3 / Finding H-3)
	if active_ball.global_position.y >= Constants.DRAIN_THRESHOLD_Y and active_ball.global_position.x < 1800.0:
		ScoreManager.add_score(25)
		
	add_camera_trauma(0.3)
	SoundController.play_sfx("nudge")
	
	tilt_count += 1
	decay_timer = 0.0
	Events.nudge_triggered.emit(tilt_count)
	print("GameSession: Table nudged! Tilt count: ", tilt_count)
	
	if tilt_count >= max_nudges:
		_trigger_tilt()

func _trigger_tilt():
	print("GameSession: TILT TRIGGERED!")
	current_state = GameState.TILT
	add_camera_trauma(0.6)
	_set_flippers_enabled(false)
	Events.tilt_triggered.emit() # Notify Event bus
	
	tilt_session_id += 1
	var active_id = tilt_session_id
	
	# Restore play state after 2 seconds (if not drained)
	get_tree().create_timer(2.0).timeout.connect(func():
		if current_state == GameState.TILT and tilt_session_id == active_id:
			_restore_from_tilt()
	)

func _restore_from_tilt():
	print("GameSession: Recovered from tilt.")
	current_state = GameState.PLAYING
	tilt_count = 0
	_set_flippers_enabled(true)
	Events.tilt_recovered.emit() # Notify Event bus

func _spawn_ball():
	# If a ball already exists, destroy it first
	if active_ball != null:
		active_ball.queue_free()
		active_ball = null
		
	# Instantiating ball
	active_ball = BALL_SCENE.instantiate()
	# Spawn at Plunger launch area pocket (plunger position offset)
	active_ball.global_position = plunger.global_position + Constants.SPAWN_OFFSET
	table.add_child(active_ball)
	print("GameSession: Spawned new ball at plunger.")

func _on_ball_drained(body: Node2D):
	if body is RigidBody2D and body == active_ball:
		if current_state not in [GameState.PLAYING, GameState.TILT]:
			return
			
		print("GameSession: Ball drained.")
		current_state = GameState.DRAINED
		SoundController.play_sfx("drain")
		
		# Deduct ball stock
		var has_balls = ScoreManager.use_ball()
		
		# Clear multiplier on drain
		ScoreManager.reset_multiplier()
		
		if has_balls:
			# Delay a bit and spawn next ball
			get_tree().create_timer(1.0).timeout.connect(func():
				_spawn_ball()
				tilt_count = 0
				_set_flippers_enabled(true)
				current_state = GameState.PLAYING
			)
		else:
			# Game over
			current_state = GameState.GAME_OVER
			SoundController.play_sfx("game_over")
			get_tree().create_timer(1.0).timeout.connect(func():
				game_completed.emit(ScoreManager.current_score)
			)

func _on_events_ball_impact(velocity: float):
	# Calculate trauma screenshake based on impact velocity
	var impact = velocity / 1000.0
	add_camera_trauma(clamp(impact, 0.1, 0.5))

func add_camera_trauma(amount: float):
	if camera and camera.has_method("add_trauma"):
		camera.add_trauma(amount)

func _set_pause_state(paused: bool):
	get_tree().paused = paused
	pause_menu.visible = paused
	
	# Cache and restore state correctly (Issue 8)
	if paused:
		pre_pause_state = current_state
		current_state = GameState.PAUSED
	else:
		current_state = pre_pause_state
	print("GameSession: Pause toggled: ", paused)

func _on_resume_pressed():
	_set_pause_state(false)

func _on_exit_pressed():
	# Clean exit to main menu, unpause first
	_set_pause_state(false)
	game_completed.emit(ScoreManager.current_score)
