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
	
	# Only write settings to disk on drag release to prevent disk write overhead (L-7)
	master_slider.drag_ended.connect(func(_changed): ScoreManager.save_settings())
	music_slider.drag_ended.connect(func(_changed): ScoreManager.save_settings())
	sfx_slider.drag_ended.connect(func(_changed): ScoreManager.save_settings())
	
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
		
	# Support rebinding keys, gamepad buttons, and analog motion axes (H-2)
	var is_valid_event = false
	if event is InputEventKey and event.pressed and not event.is_echo():
		is_valid_event = true
	elif event is InputEventJoypadButton and event.pressed:
		is_valid_event = true
	elif event is InputEventJoypadMotion and abs(event.axis_value) > 0.5:
		is_valid_event = true
		
	if is_valid_event:
		# Erase existing key/joypad events for this action
		var events = InputMap.action_get_events(waiting_action)
		for ev in events:
			if ev is InputEventKey or ev is InputEventJoypadButton or ev is InputEventJoypadMotion:
				InputMap.action_erase_event(waiting_action, ev)
				
		# Configure new event
		var new_event = event.duplicate()
		if new_event is InputEventJoypadMotion:
			# Clamp axis value to clean full direction threshold
			new_event.axis_value = 1.0 if new_event.axis_value > 0.0 else -1.0
			
		InputMap.action_add_event(waiting_action, new_event)
		
		# Save keybind Event object using ScoreManager ConfigFile serialization (H-2)
		ScoreManager.save_keybinding(waiting_action, new_event)
		
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
		elif event is InputEventJoypadButton:
			match event.button_index:
				JOY_BUTTON_A: return "GP_A"
				JOY_BUTTON_B: return "GP_B"
				JOY_BUTTON_X: return "GP_X"
				JOY_BUTTON_Y: return "GP_Y"
				JOY_BUTTON_LEFT_SHOULDER: return "GP_LB"
				JOY_BUTTON_RIGHT_SHOULDER: return "GP_RB"
				JOY_BUTTON_DPAD_LEFT: return "GP_LEFT"
				JOY_BUTTON_DPAD_RIGHT: return "GP_RIGHT"
				JOY_BUTTON_DPAD_UP: return "GP_UP"
				JOY_BUTTON_DPAD_DOWN: return "GP_DOWN"
				JOY_BUTTON_START: return "GP_START"
				JOY_BUTTON_BACK: return "GP_BACK"
				_: return "GP_" + str(event.button_index)
		elif event is InputEventJoypadMotion:
			var sign_str = "+" if event.axis_value > 0.0 else -1.0
			match event.axis:
				JOY_AXIS_LEFT_X: return "GP_LSTICK_X" + ("+" if sign_str > 0 else "-")
				JOY_AXIS_LEFT_Y: return "GP_LSTICK_Y" + ("+" if sign_str > 0 else "-")
				JOY_AXIS_RIGHT_X: return "GP_RSTICK_X" + ("+" if sign_str > 0 else "-")
				JOY_AXIS_RIGHT_Y: return "GP_RSTICK_Y" + ("+" if sign_str > 0 else "-")
				JOY_AXIS_TRIGGER_LEFT: return "GP_LT"
				JOY_AXIS_TRIGGER_RIGHT: return "GP_RT"
				_: return "GP_AXIS_" + str(event.axis) + ("+" if sign_str > 0 else "-")
	return "NONE"

func _on_resume_pressed():
	resume_pressed.emit()

func _on_settings_pressed():
	settings_panel.visible = not settings_panel.visible

func _on_exit_pressed():
	exit_pressed.emit()

func _on_master_changed(val: float):
	ScoreManager.master_volume = val / 100.0
	ScoreManager._apply_volumes()

func _on_music_changed(val: float):
	ScoreManager.music_volume = val / 100.0
	ScoreManager._apply_volumes()

func _on_sfx_changed(val: float):
	ScoreManager.sfx_volume = val / 100.0
	ScoreManager._apply_volumes()
