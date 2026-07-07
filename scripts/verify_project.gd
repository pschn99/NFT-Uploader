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
				elif ev is InputEventJoypadButton or ev is InputEventJoypadMotion:
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
		
	# 3. Verify Default Window Override Dimensions (TDD §3.2)
	var width_override = ProjectSettings.get_setting("display/window/size/window_width_override")
	var height_override = ProjectSettings.get_setting("display/window/size/window_height_override")
	if width_override != 600 or height_override != 900:
		print("❌ Default window size override is ", width_override, "x", height_override, " instead of 600x900!")
		success = false
	else:
		print("   Default window size override verified at 600x900")
		
	# 4. Verify Audio Buses
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
		
	# 5. Verify Ball Configuration (Resititution + Mask)
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
			if bounce < 0.8:
				print("❌ Ball bounciness is ", bounce, ", which is too low (expected >= 0.8)!")
				success = false
			else:
				print("   Ball bounciness verified at ", bounce)
			var friction = ball.physics_material_override.friction
			if friction > 0.1:
				print("❌ Ball friction is ", friction, ", which is too high (expected <= 0.1)!")
				success = false
			else:
				print("   Ball friction verified at ", friction)
				
		# Verify ball collision mask
		if ball.collision_mask != 30:
			print("❌ Ball has incorrect collision mask: ", ball.collision_mask, " (expected 30)!")
			success = false
		else:
			print("   Ball collision mask verified at 30")
			
		# Verify ball CCD mode (TDD §4.5 / L-8)
		if ball.continuous_cd != 2:
			print("❌ Ball continuous_cd is ", ball.continuous_cd, " instead of 2 (CCD_MODE_CAST_SHAPE)!")
			success = false
		else:
			print("   Ball continuous_cd verified at CAST_SHAPE")
			
		ball.free()
		
	# 6. Verify Events signal interface compliance (TDD §5)
	var expected_signals = ["ball_impact", "bumper_hit", "slingshot_hit", "rollover_triggered", "ramp_completed", "nudge_triggered", "tilt_triggered", "tilt_recovered", "flipper_activated", "ball_saved", "wall_hit"]
	for sig in expected_signals:
		if not Events.has_signal(sig):
			print("❌ Events bus is missing required signal: ", sig)
			success = false
		else:
			print("   Events bus signal verified: ", sig)
			
	# 7. Verify Table Elements (Milestone 2 Layout)
	var table_scene = load("res://scenes/Table.tscn")
	if table_scene == null:
		print("❌ Failed to load Table.tscn!")
		success = false
	else:
		var table = table_scene.instantiate()
		add_child(table) # Add to tree so flipper _ready runs and registers groups
		
		var expected_nodes = [
			"BumperA", "BumperB", "BumperC",
			"SlingshotLeft", "SlingshotRight",
			"RolloverLane1", "RolloverLane2", "RolloverLane3",
			"Ramp", "Ramp/EntranceGate", "Ramp/ExitGate",
			"OneWayGate"
		]
		for node_path in expected_nodes:
			var node = table.get_node_or_null(node_path)
			if node == null:
				print("❌ Table is missing expected element: ", node_path)
				success = false
			else:
				print("   Table element verified: ", node_path)
				
		# Verify Flipper Group membership
		var left_flipper = table.get_node_or_null("FlipperLeft")
		var right_flipper = table.get_node_or_null("FlipperRight")
		if left_flipper == null or not left_flipper.is_in_group("flippers"):
			print("❌ FlipperLeft is not in 'flippers' group!")
			success = false
		else:
			print("   FlipperLeft group membership verified")
		if right_flipper == null or not right_flipper.is_in_group("flippers"):
			print("❌ FlipperRight is not in 'flippers' group!")
			success = false
		else:
			print("   FlipperRight group membership verified")
			
		# Verify Slingshot StaticBody2D collision_mask (Finding C-3)
		for side in ["Left", "Right"]:
			var sling = table.get_node_or_null("Slingshot" + side)
			if sling:
				if sling.collision_mask != 1:
					print("❌ Slingshot", side, " is missing collision_mask (Layer 1)!")
					success = false
				else:
					print("   Slingshot", side, " collision_mask verified")
					
		# Verify Plunger LaunchArea Active collision_mask
		var plunger = table.get_node_or_null("Plunger")
		if plunger:
			var area = plunger.get_node_or_null("LaunchArea")
			if area == null or area.collision_mask != 1:
				print("❌ Plunger LaunchArea is missing collision_mask (Layer 1)!")
				success = false
			else:
				print("   Plunger LaunchArea collision_mask verified")
				
		remove_child(table)
		table.free()
		
	if success:
		print("✅ ALL AUDIT VERIFICATIONS COMPLETED SUCCESSFULLY!")
		get_tree().quit(0)
	else:
		print("❌ VERIFICATION RUNNER ENCOUNTERED ERRORS!")
		get_tree().quit(1)
