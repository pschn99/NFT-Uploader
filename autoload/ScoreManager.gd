extends Node

signal score_changed(new_score: int)
signal multiplier_changed(new_mult: float)
signal balls_changed(new_balls: int)
signal leaderboard_updated()

const SAVE_VERSION: int = 1
const LEADERBOARD_PATH: String = "user://leaderboard.cfg"
const SETTINGS_PATH: String = "user://settings.cfg"

# Active game state
var current_score: int = 0
var score_multiplier: float = 1.0
var balls_remaining: int = 3
var scoring_enabled: bool = true

# High score entry layout: Array of Dictionary {"initials": String, "score": int}
var leaderboard_entries: Array = []

# Audio settings cached
var master_volume: float = 0.8
var music_volume: float = 0.8
var sfx_volume: float = 0.8

func _ready():
	load_leaderboard()
	load_settings()
	
	# Connect to decoupled event bus (TDD §1.3 / Issues 4 & 9)
	Events.bumper_hit.connect(_on_bumper_hit)
	Events.slingshot_hit.connect(_on_slingshot_hit)
	Events.rollover_triggered.connect(_on_rollover_triggered)
	Events.ramp_completed.connect(_on_ramp_completed)
	Events.tilt_triggered.connect(func(): scoring_enabled = false)
	Events.tilt_recovered.connect(func(): scoring_enabled = true)

# --- Game Lifecycle Management ---
func reset_session():
	current_score = 0
	score_multiplier = 1.0
	balls_remaining = 3
	scoring_enabled = true
	score_changed.emit(current_score)
	multiplier_changed.emit(score_multiplier)
	balls_changed.emit(balls_remaining)

func add_score(amount: int):
	if not scoring_enabled:
		return
	var points = int(amount * score_multiplier)
	current_score += points
	score_changed.emit(current_score)

func increment_multiplier(amount: float):
	score_multiplier += amount
	multiplier_changed.emit(score_multiplier)

func reset_multiplier():
	score_multiplier = 1.0
	multiplier_changed.emit(score_multiplier)

func use_ball() -> bool:
	balls_remaining -= 1
	balls_changed.emit(balls_remaining)
	return balls_remaining > 0

# --- Event Bus Handlers ---
func _on_bumper_hit(score: int):
	add_score(score)

func _on_slingshot_hit(score: int):
	add_score(score)

func _on_rollover_triggered(score: int):
	add_score(score)

func _on_ramp_completed(score: int):
	add_score(score)
	increment_multiplier(1.0)

# --- Leaderboard Config Persistence ---
func load_leaderboard():
	var config = ConfigFile.new()
	var err = config.load(LEADERBOARD_PATH)
	
	if err == OK:
		var version = config.get_value("meta", "version", 1)
		if version == SAVE_VERSION:
			leaderboard_entries = config.get_value("scores", "entries", [])
			print("ScoreManager: Leaderboard loaded. Entry count: ", leaderboard_entries.size())
			return
			
	# First-Launch or Version Mismatch: Initialize defaults
	print("ScoreManager: Initializing default leaderboard entries...")
	leaderboard_entries = [
		{"initials": "PBL", "score": 5000},
		{"initials": "ZZZ", "score": 4000},
		{"initials": "ARC", "score": 3000},
		{"initials": "VEC", "score": 2000},
		{"initials": "ONE", "score": 1000}
	]
	save_leaderboard()

func save_leaderboard():
	var config = ConfigFile.new()
	config.set_value("meta", "version", SAVE_VERSION)
	config.set_value("scores", "entries", leaderboard_entries)
	var err = config.save(LEADERBOARD_PATH)
	if err != OK:
		print("ScoreManager: Failed to save leaderboard to ", LEADERBOARD_PATH, " error: ", err)
	else:
		print("ScoreManager: Leaderboard saved.")
	leaderboard_updated.emit()

func is_high_score(score: int) -> bool:
	if leaderboard_entries.size() < 5:
		return true
	for entry in leaderboard_entries:
		if score >= entry["score"]:
			return true
	return false

func add_high_score(initials: String, score: int):
	var clean_initials = initials.to_upper().substr(0, 3)
	if clean_initials.is_empty():
		clean_initials = "PBL"
		
	var new_entry = {"initials": clean_initials, "score": score}
	leaderboard_entries.append(new_entry)
	leaderboard_entries.sort_custom(func(a, b): return a["score"] > b["score"])
	
	if leaderboard_entries.size() > 5:
		leaderboard_entries.resize(5)
		
	save_leaderboard()

# --- Audio Settings Persistence ---
func load_settings():
	var config = ConfigFile.new()
	var err = config.load(SETTINGS_PATH)
	
	if err == OK:
		master_volume = config.get_value("audio", "master_volume", 0.8)
		music_volume = config.get_value("audio", "music_volume", 0.8)
		sfx_volume = config.get_value("audio", "sfx_volume", 0.8)
		print("ScoreManager: Audio settings loaded (Master: ", master_volume, ")")
		_apply_volumes()
		
		# Load custom keybindings if present
		var actions = ["flipper_left", "flipper_right", "plunger_launch", "nudge_left", "nudge_right", "pause_toggle"]
		for action in actions:
			var saved_key = config.get_value("controls", action, -1)
			if saved_key != -1:
				var events = InputMap.action_get_events(action)
				for ev in events:
					if ev is InputEventKey:
						InputMap.action_erase_event(action, ev)
				var new_event = InputEventKey.new()
				new_event.physical_keycode = saved_key
				InputMap.action_add_event(action, new_event)
				print("ScoreManager: Applied custom keybind for ", action, ": ", OS.get_keycode_string(saved_key))
		return
		
	print("ScoreManager: Initializing default settings...")
	master_volume = 0.8
	music_volume = 0.8
	sfx_volume = 0.8
	save_settings()

func save_settings():
	var config = ConfigFile.new()
	config.set_value("meta", "version", SAVE_VERSION)
	config.set_value("audio", "master_volume", master_volume)
	config.set_value("audio", "music_volume", music_volume)
	config.set_value("audio", "sfx_volume", sfx_volume)
	
	var err = config.save(SETTINGS_PATH)
	if err != OK:
		print("ScoreManager: Failed to save settings. error: ", err)
	else:
		print("ScoreManager: Settings saved.")
	_apply_volumes()

func update_volumes(master: float, music: float, sfx: float):
	master_volume = master
	music_volume = music
	sfx_volume = sfx
	save_settings()

func save_keybinding(action_name: String, keycode: int):
	var config = ConfigFile.new()
	config.load(SETTINGS_PATH)
	config.set_value("controls", action_name, keycode)
	var err = config.save(SETTINGS_PATH)
	if err != OK:
		print("ScoreManager: Failed to save keybinding. error: ", err)
	else:
		print("ScoreManager: Saved custom keybind for ", action_name, ": ", OS.get_keycode_string(keycode))

func _apply_volumes():
	_set_bus_vol("Master", master_volume)
	_set_bus_vol("Music", music_volume)
	_set_bus_vol("SFX", sfx_volume)

func _set_bus_vol(bus_name: String, ratio: float):
	var bus_idx = AudioServer.get_bus_index(bus_name)
	if bus_idx != -1:
		if ratio <= 0.0001:
			AudioServer.set_bus_mute(bus_idx, true)
		else:
			AudioServer.set_bus_mute(bus_idx, false)
			# Idiomatic volume db conversion using linear_to_db (Issue M2-18 / TD-8)
			var db = linear_to_db(ratio)
			AudioServer.set_bus_volume_db(bus_idx, clamp(db, -80.0, 6.0))
