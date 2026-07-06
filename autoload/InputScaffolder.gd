extends Node

func _enter_tree():
	setup_inputs()

func setup_inputs():
	# Keyboard keys mapping
	var inputs = {
		"flipper_left": [KEY_Z, KEY_LEFT],
		"flipper_right": [KEY_X, KEY_RIGHT],
		"plunger_launch": [KEY_SPACE],
		"nudge_left": [KEY_A],
		"nudge_right": [KEY_D],
		"pause_toggle": [KEY_ESCAPE]
	}
	
	# Gamepad buttons mapping (GDD §7.1 / §7.2 / Issues 3 & 6)
	var gamepad_buttons = {
		"flipper_left": [JOY_BUTTON_LEFT_SHOULDER],
		"flipper_right": [JOY_BUTTON_RIGHT_SHOULDER],
		"plunger_launch": [JOY_BUTTON_A],
		"nudge_left": [JOY_BUTTON_DPAD_LEFT],
		"nudge_right": [JOY_BUTTON_DPAD_RIGHT],
		"pause_toggle": [JOY_BUTTON_START],
		"ui_up": [JOY_BUTTON_DPAD_UP],
		"ui_down": [JOY_BUTTON_DPAD_DOWN],
		"ui_left": [JOY_BUTTON_DPAD_LEFT],
		"ui_right": [JOY_BUTTON_DPAD_RIGHT]
	}
	
	# Gamepad axes mapping (GDD §7.1 / Issue 6)
	var gamepad_motions = {
		"flipper_left": [{"axis": JOY_AXIS_TRIGGER_LEFT, "value": 0.5}],     # L2 trigger
		"flipper_right": [{"axis": JOY_AXIS_TRIGGER_RIGHT, "value": 0.5}],   # R2 trigger
		"plunger_launch": [{"axis": JOY_AXIS_LEFT_Y, "value": 0.5}]         # Left Stick Pull
	}
	
	# 1. Register Action Keys
	for action in inputs:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		
		for key in inputs[action]:
			var event = InputEventKey.new()
			event.physical_keycode = key
			
			var exists = false
			for existing_event in InputMap.action_get_events(action):
				if existing_event is InputEventKey and existing_event.physical_keycode == key:
					exists = true
					break
			
			if not exists:
				InputMap.action_add_event(action, event)
		
	# 2. Register Gamepad Buttons
	for action in gamepad_buttons:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
			
		for btn in gamepad_buttons[action]:
			var event = InputEventJoypadButton.new()
			event.button_index = btn
			
			var exists = false
			for existing_event in InputMap.action_get_events(action):
				if existing_event is InputEventJoypadButton and existing_event.button_index == btn:
					exists = true
					break
			
			if not exists:
				InputMap.action_add_event(action, event)
				
	# 3. Register Gamepad Motion Axes
	for action in gamepad_motions:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
			
		for motion in gamepad_motions[action]:
			var event = InputEventJoypadMotion.new()
			event.axis = motion["axis"]
			event.axis_value = motion["value"]
			
			var exists = false
			for existing_event in InputMap.action_get_events(action):
				if existing_event is InputEventJoypadMotion and existing_event.axis == motion["axis"]:
					exists = true
					break
			
			if not exists:
				InputMap.action_add_event(action, event)
	
	print("InputScaffolder: Keyboard and Gamepad (Buttons, Axes, D-Pad) successfully initialized.")
