extends CanvasLayer

signal resume_pressed()
signal exit_pressed()

@onready var resume_button: Button = $MenuContainer/ResumeButton
@onready var settings_button: Button = $MenuContainer/SettingsButton
@onready var exit_button: Button = $MenuContainer/ExitButton

@onready var settings_panel: VBoxContainer = $SettingsPanel
@onready var master_slider: HSlider = $SettingsPanel/MasterSlider/Slider
@onready var music_slider: HSlider = $SettingsPanel/MusicSlider/Slider
@onready var sfx_slider: HSlider = $SettingsPanel/SfxSlider/Slider

@onready var left_flip_btn: Button = $SettingsPanel/LeftFlipperRebind/Button
@onready var right_flip_btn: Button = $SettingsPanel/RightFlipperRebind/Button
@onready var plunger_btn: Button = $SettingsPanel/PlungerRebind/Button
@onready var nudge_l_btn: Button = $SettingsPanel/NudgeLeftRebind/Button
@onready var nudge_r_btn: Button = $SettingsPanel/NudgeRightRebind/Button
@onready var pause_btn: Button = $SettingsPanel/PauseRebind/Button

var is_waiting_for_key: bool = false
var waiting_action: String = ""
var waiting_button: Button = null

func _ready():
	resume_button.pressed.connect(_on_resume_pressed)
	settings_button.pressed.connect(_on_settings_pressed)
	exit_button.pressed.connect(_on_exit_pressed)
	
	master_slider.value_changed.connect(_on_master_changed)
	music_slider.value_changed.connect(_on_music_changed)
	sfx_slider.value_changed.connect(_on_sfx_changed)
	
	left_flip_btn.pressed.connect(func(): _start_rebind("flipper_left", left_flip_btn))
	right_flip_btn.pressed.connect(func(): _start_rebind("flipper_right", right_flip_btn))
	plunger_btn.pressed.connect(func(): _start_rebind("plunger_launch", plunger_btn))
	nudge_l_btn.pressed.connect(func(): _start_rebind("nudge_left", nudge_l_btn))
	nudge_r_btn.pressed.connect(func(): _start_rebind("nudge_right", nudge_r_btn))
	pause_btn.pressed.connect(func(): _start_rebind("pause_toggle", pause_btn))
	
	# Load settings into sliders (range 0 to 100)
	master_slider.value = ScoreManager.master_volume * 100.0
	music_slider.value = ScoreManager.music_volume * 100.0
	sfx_slider.value = ScoreManager.sfx_volume * 100.0
	
	_update_rebind_buttons_text()
	settings_panel.visible = false

func _unhandled_input(event: InputEvent):
	if not visible or not is_waiting_for_key:
		return
		
	if event is InputEventKey and event.pressed:
		var keycode = event.physical_keycode
		
		# Erase existing key events for this action
		var events = InputMap.action_get_events(waiting_action)
		for ev in events:
			if ev is InputEventKey:
				InputMap.action_erase_event(waiting_action, ev)
				
		# Add new key event
		var new_event = InputEventKey.new()
		new_event.physical_keycode = keycode
		InputMap.action_add_event(waiting_action, new_event)
		
		# Save keybind using ScoreManager
		ScoreManager.save_keybinding(waiting_action, keycode)
		
		# Reset wait state
		is_waiting_for_key = false
		waiting_action = ""
		waiting_button = null
		
		# Update UI text
		_update_rebind_buttons_text()
		get_viewport().set_input_as_handled()

func _start_rebind(action_name: String, button: Button):
	if is_waiting_for_key:
		return
	is_waiting_for_key = true
	waiting_action = action_name
	waiting_button = button
	button.text = "PRESS ANY KEY..."

func _update_rebind_buttons_text():
	left_flip_btn.text = _get_action_key_text("flipper_left")
	right_flip_btn.text = _get_action_key_text("flipper_right")
	plunger_btn.text = _get_action_key_text("plunger_launch")
	nudge_l_btn.text = _get_action_key_text("nudge_left")
	nudge_r_btn.text = _get_action_key_text("nudge_right")
	pause_btn.text = _get_action_key_text("pause_toggle")

func _get_action_key_text(action_name: String) -> String:
	var events = InputMap.action_get_events(action_name)
	for event in events:
		if event is InputEventKey:
			return OS.get_keycode_string(event.physical_keycode)
	return "NONE"

func _on_resume_pressed():
	resume_pressed.emit()

func _on_settings_pressed():
	settings_panel.visible = not settings_panel.visible

func _on_exit_pressed():
	exit_pressed.emit()

func _on_master_changed(val: float):
	ScoreManager.master_volume = val / 100.0
	ScoreManager.save_settings()

func _on_music_changed(val: float):
	ScoreManager.music_volume = val / 100.0
	ScoreManager.save_settings()

func _on_sfx_changed(val: float):
	ScoreManager.sfx_volume = val / 100.0
	ScoreManager.save_settings()
