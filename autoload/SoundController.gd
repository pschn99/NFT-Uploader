extends Node


var sounds = {}
var active_players = []
const MAX_PLAYERS = 8

func _ready():
	print("SoundController: Generating chiptune assets...")
	_initialize_synth_sounds()
	
	# Create pool of players
	for i in range(MAX_PLAYERS):
		var p = AudioStreamPlayer.new()
		add_child(p)
		p.bus = "SFX"
		active_players.append(p)
	
	# Verify audio buses (fallback to Master if SFX bus doesn't exist)
	var sfx_bus_idx = AudioServer.get_bus_index("SFX")
	if sfx_bus_idx == -1:
		print("SoundController: 'SFX' bus not found, using 'Master'")
		for p in active_players:
			p.bus = "Master"
			
	print("SoundController: Initialization complete.")

func _initialize_synth_sounds():
	# Generate various standard pinball retro sounds
	sounds["bumper"] = generate_beep(600.0, 0.1, "sine")
	sounds["slingshot"] = generate_beep(120.0, 0.08, "noise")
	sounds["flipper"] = generate_beep(80.0, 0.04, "square")
	sounds["nudge"] = generate_beep(300.0, 0.08, "triangle")
	sounds["plunger_charge"] = generate_sweep(200.0, 600.0, 0.5, "sine")
	sounds["plunger_release"] = generate_sweep(800.0, 200.0, 0.25, "noise")
	sounds["ramp"] = generate_beep(880.0, 0.3, "sine") # We can make a nice chime
	sounds["tilt_warning"] = generate_beep(220.0, 0.15, "square")
	sounds["game_over"] = generate_sweep(400.0, 100.0, 0.8, "triangle")

func play_sfx(sound_name: String):
	if not sounds.has(sound_name):
		print("SoundController: Sound not found: ", sound_name)
		return
		
	# Find available player in the pool
	for p in active_players:
		if not p.playing:
			p.stream = sounds[sound_name]
			p.play()
			return
			
	# If all busy, override the first player
	var first_player = active_players[0]
	first_player.stream = sounds[sound_name]
	first_player.play()

func generate_beep(frequency: float, duration: float, type: String = "sine") -> AudioStreamWAV:
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_8_BITS
	stream.mix_rate = 11025
	stream.stereo = false
	
	var data = PackedByteArray()
	var num_samples = int(duration * stream.mix_rate)
	data.resize(num_samples)
	
	for i in range(num_samples):
		var t = float(i) / stream.mix_rate
		var val = 0
		if type == "sine":
			val = int(sin(t * frequency * 2.0 * PI) * 127 + 128)
		elif type == "square":
			val = 255 if sin(t * frequency * 2.0 * PI) >= 0 else 0
		elif type == "triangle":
			val = int(abs(fmod(t * frequency * 4.0, 4.0) - 2.0) / 2.0 * 255)
		elif type == "noise":
			val = int(randf() * 255)
			
		# Apply linear decay fade-out to prevent clicks/pops
		var fade = 1.0
		if i > num_samples - 200:
			fade = float(num_samples - i) / 200.0
		var centered = val - 128
		val = int(centered * fade + 128)
		
		data[i] = clamp(val, 0, 255)
		
	stream.data = data
	return stream

func generate_sweep(start_freq: float, end_freq: float, duration: float, type: String = "sine") -> AudioStreamWAV:
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_8_BITS
	stream.mix_rate = 11025
	stream.stereo = false
	
	var data = PackedByteArray()
	var num_samples = int(duration * stream.mix_rate)
	data.resize(num_samples)
	
	var phase = 0.0
	for i in range(num_samples):
		var ratio = float(i) / num_samples
		var freq = start_freq + (end_freq - start_freq) * ratio
		phase += (freq * 2.0 * PI) / stream.mix_rate
		
		var val = 0
		if type == "sine":
			val = int(sin(phase) * 127 + 128)
		elif type == "square":
			val = 255 if sin(phase) >= 0 else 0
		elif type == "triangle":
			val = int(abs(fmod(phase / PI, 2.0) - 1.0) * 255)
		elif type == "noise":
			val = int(randf() * 255)
			
		var fade = 1.0
		if i > num_samples - 200:
			fade = float(num_samples - i) / 200.0
		var centered = val - 128
		val = int(centered * fade + 128)
		
		data[i] = clamp(val, 0, 255)
		
	stream.data = data
	return stream
