extends Node

func _ready():
	print("--- PROJECT VERIFICATION RUNNER ---")
	var success = true
	
	# 1. Verify Input Map Actions & Bindings
	var required_actions = ["flipper_left", "flipper_right", "plunger_launch", "nudge_left", "nudge_right", "pause_toggle"]
	for action in required_actions:
		if not InputMap.has_action(action):
			print("❌ Missing input action: ", action)
			success = false
		else:
			var events = InputMap.action_get_events(action)
			var has_key = false
			var has_joy = false
			for ev in events:
				if ev is InputEventKey:
					has_key = true
				elif ev is InputEventJoypadButton:
					has_joy = true
			if not has_key:
				print("❌ Input action ", action, " is missing Keyboard bindings!")
				success = false
			if not has_joy:
				print("❌ Input action ", action, " is missing Gamepad bindings!")
				success = false
			if has_key and has_joy:
				print("   Input action ", action, " verified (Keyboard + Gamepad)")
				
	# 2. Verify Physics Settings
	var ticks = ProjectSettings.get_setting("physics/common/physics_ticks_per_second")
	var steps = ProjectSettings.get_setting("physics/common/max_physics_steps_per_frame")
	if ticks != 240:
		print("❌ Physics tick rate is ", ticks, " instead of 240 Hz!")
		success = false
	else:
		print("   Physics tick rate verified at 240 Hz")
	if steps != 8:
		print("❌ Physics max steps is ", steps, " instead of 8!")
		success = false
	else:
		print("   Physics max steps verified at 8")
		
	# 3. Verify Audio Buses
	var music_idx = AudioServer.get_bus_index("Music")
	var sfx_idx = AudioServer.get_bus_index("SFX")
	if music_idx == -1:
		print("❌ AudioServer is missing 'Music' bus!")
		success = false
	else:
		print("   AudioServer 'Music' bus verified")
	if sfx_idx == -1:
		print("❌ AudioServer is missing 'SFX' bus!")
		success = false
	else:
		print("   AudioServer 'SFX' bus verified")
		
	# 4. Verify Ball restitution bounciness
	var ball_scene = load("res://scenes/Ball.tscn")
	if ball_scene == null:
		print("❌ Failed to load Ball.tscn!")
		success = false
	else:
		var ball = ball_scene.instantiate()
		if ball.physics_material_override == null:
			print("❌ Ball has no physics material override!")
			success = false
		else:
			var bounce = ball.physics_material_override.bounce
			if bounce < 0.7:
				print("❌ Ball bounciness is ", bounce, ", which is too low (expected >= 0.7)!")
				success = false
			else:
				print("   Ball bounciness verified at ", bounce)
		ball.free()
		
	# 5. Verify Table Elements (Milestone 2 Layout)
	var table_scene = load("res://scenes/Table.tscn")
	if table_scene == null:
		print("❌ Failed to load Table.tscn!")
		success = false
	else:
		var table = table_scene.instantiate()
		var expected_nodes = [
			"BumperA", "BumperB", "BumperC",
			"SlingshotLeft", "SlingshotRight",
			"RolloverLane1", "RolloverLane2", "RolloverLane3",
			"Ramp", "Ramp/EntranceGate", "Ramp/ExitGate"
		]
		for node_path in expected_nodes:
			var node = table.get_node_or_null(node_path)
			if node == null:
				print("❌ Table is missing expected element: ", node_path)
				success = false
			else:
				print("   Table element verified: ", node_path)
		table.free()
		
	if success:
		print("✅ ALL AUDIT VERIFICATIONS COMPLETED SUCCESSFULLY!")
		get_tree().quit(0)
	else:
		print("❌ VERIFICATION RUNNER ENCOUNTERED ERRORS!")
		get_tree().quit(1)
