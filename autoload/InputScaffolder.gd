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
	
	# Gamepad buttons mapping (GDD §7.1 / Audit Issue 4 - Verified Constants)
	var gamepad_buttons = {
		"flipper_left": [JOY_BUTTON_LEFT_SHOULDER],
		"flipper_right": [JOY_BUTTON_RIGHT_SHOULDER],
		"plunger_launch": [JOY_BUTTON_A],
		"nudge_left": [JOY_BUTTON_DPAD_LEFT],
		"nudge_right": [JOY_BUTTON_DPAD_RIGHT],
		"pause_toggle": [JOY_BUTTON_START]
	}
	
	for action in inputs:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		
		# Register keyboard bindings
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
		
		# Register gamepad button bindings
		if gamepad_buttons.has(action):
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
	
	print("InputScaffolder: Keyboard and Gamepad mappings successfully initialized.")
