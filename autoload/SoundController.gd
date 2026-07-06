extends Node

var sounds = {}
var active_players = []
const MAX_PLAYERS = 8

var bgm_player: AudioStreamPlayer = null
var lpf_effect: AudioEffectLowPassFilter = null

func _ready():
	process_mode = PROCESS_MODE_ALWAYS
	print("SoundController: Generating chiptune assets...")
	_initialize_synth_sounds()
	
	# Create pool of players (TDD §3.4 / Issue 7c)
	for i in range(MAX_PLAYERS):
		var p = AudioStreamPlayer2D.new()
		add_child(p)
		p.bus = "SFX"
		active_players.append(p)
	
	# Verify audio buses (fallback to Master if SFX bus doesn't exist)
	var sfx_bus_idx = AudioServer.get_bus_index("SFX")
	if sfx_bus_idx == -1:
		print("SoundController: 'SFX' bus not found, using 'Master'")
		for p in active_players:
			p.bus = "Master"
			
	# Connect decoupled global event signals (TDD §1.3 / Issues 4 & 9)
	Events.ball_impact.connect(_on_ball_impact)
	Events.bumper_hit.connect(func(_score): play_sfx("bumper"))
	Events.slingshot_hit.connect(func(_score): play_sfx("slingshot"))
	Events.rollover_triggered.connect(func(_score): play_sfx("nudge"))
	Events.ramp_completed.connect(func(_score): play_sfx("ramp")) # Wire dedicated ramp SFX (Issue 3 recommendation)
	Events.tilt_triggered.connect(func(): play_sfx("tilt_warning"))
	Events.flipper_activated.connect(func(_is_right): play_sfx("flipper"))
	
	_setup_low_pass_filter()
	_start_bgm()
	print("SoundController: Initialization complete.")

func _process(delta: float):
	# Dynamic low-pass and volume reduction during Pause (TDD §3.4 / Issues 5 & 14)
	if bgm_player and bgm_player.playing:
		var is_paused = get_tree().paused
		var music_bus_idx = AudioServer.get_bus_index("Music")
		if music_bus_idx != -1 and lpf_effect:
			AudioServer.set_bus_effect_enabled(music_bus_idx, 0, is_paused)
		
		# Muffle volume by 12dB when paused
		var target_db = -12.0 if is_paused else 0.0
		bgm_player.volume_db = lerp(bgm_player.volume_db, target_db, 10.0 * delta)

func _initialize_synth_sounds():
	# Generate retro wavs in memory
	sounds["bumper"] = generate_beep(600.0, 0.1, "sine")
	sounds["slingshot"] = generate_beep(120.0, 0.08, "noise")
	sounds["flipper"] = generate_beep(80.0, 0.04, "square")
	sounds["plunger_charge"] = generate_sweep(200.0, 600.0, 1.0, "sine")
	sounds["plunger_release"] = generate_sweep(800.0, 200.0, 0.25, "noise")
	sounds["tilt_warning"] = generate_beep(220.0, 0.15, "square")
	sounds["game_over"] = generate_sweep(400.0, 100.0, 0.8, "triangle")
	
	# Unique nudge double blip (Issue 4 recommendation)
	sounds["nudge"] = generate_double_blip(200.0, 400.0, 0.12)
	
	# Dedicated ramp completion rising sweep (Issue 3 recommendation)
	sounds["ramp"] = generate_sweep(600.0, 1200.0, 0.4, "sine")
	
	# Sad descending arpeggio for drain (Issue 7 & 9)
	sounds["drain"] = generate_sweep(250.0, 50.0, 0.8, "triangle")
	
	# Generic wall collision impact sound (TD-5)
	sounds["wall_hit"] = generate_beep(150.0, 0.05, "sine")

func _on_ball_impact(velocity: float):
	# Map impact speed to blip frequency and volume
	if velocity > 100.0:
		play_sfx("wall_hit")

func play_sfx(sound_name: String, position: Vector2 = Vector2(1000, 1500)):
	if not sounds.has(sound_name):
		print("SoundController: Sound not found: ", sound_name)
		return
		
	# Find available player in the pool
	for p in active_players:
		if not p.playing:
			p.global_position = position
			p.stream = sounds[sound_name]
			p.play()
			return
			
	# Fallback: override the first player
	var first_player = active_players[0]
	first_player.global_position = position
	first_player.stream = sounds[sound_name]
	first_player.play()

func stop_sfx(sound_name: String):
	if not sounds.has(sound_name):
		return
	var stream = sounds[sound_name]
	for p in active_players:
		if p.playing and p.stream == stream:
			p.stop()

func _setup_low_pass_filter():
	var music_bus_idx = AudioServer.get_bus_index("Music")
	if music_bus_idx != -1:
		lpf_effect = AudioEffectLowPassFilter.new()
		lpf_effect.cutoff_hz = 700.0 # muffled cutoff
		lpf_effect.resonance = 0.5
		AudioServer.add_bus_effect(music_bus_idx, lpf_effect, 0)
		AudioServer.set_bus_effect_enabled(music_bus_idx, 0, false)

func _start_bgm():
	# Loopable retro chiptune BGM loop (GDD §9 / TDD §3.4 / Issue 5)
	var music_bus_idx = AudioServer.get_bus_index("Music")
	bgm_player = AudioStreamPlayer.new()
	add_child(bgm_player)
	bgm_player.bus = "Music" if music_bus_idx != -1 else "Master"
	bgm_player.stream = generate_bgm()
	bgm_player.play()
	print("SoundController: Procedural chiptune BGM started.")

func generate_bgm() -> AudioStreamWAV:
	var mix_rate = 11025
	var note_dur = 0.4 # Tempo
	var notes = [110.0, 130.0, 147.0, 165.0, 147.0, 130.0, 110.0, 98.0]
	var total_duration = notes.size() * note_dur
	var num_samples = int(mix_rate * total_duration)
	var buffer = PackedByteArray()
	buffer.resize(num_samples)
	
	var phase = 0.0
	for i in range(num_samples):
		var t = float(i) / mix_rate
		var note_idx = int(t / note_dur) % notes.size()
		var freq = notes[note_idx]
		
		phase += freq / mix_rate
		if phase > 1.0:
			phase -= 1.0
		
		var val = 148 if phase < 0.5 else 108
		buffer[i] = val
		
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_8_BITS
	stream.mix_rate = mix_rate
	stream.data = buffer
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_begin = 0
	stream.loop_end = num_samples
	return stream

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
			
		var fade = 1.0
		if i > num_samples - 200:
			fade = float(num_samples - i) / 200.0
		var centered = val - 128
		val = int(centered * fade + 128)
		
		data[i] = clamp(val, 0, 255)
		
	stream.data = data
	return stream

func generate_double_blip(freq1: float, freq2: float, duration: float) -> AudioStreamWAV:
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_8_BITS
	stream.mix_rate = 11025
	stream.stereo = false
	
	var data = PackedByteArray()
	var num_samples = int(duration * stream.mix_rate)
	data.resize(num_samples)
	
	var half = num_samples / 2
	for i in range(num_samples):
		var t = float(i) / stream.mix_rate
		var freq = freq1 if i < half else freq2
		var val = int(abs(fmod(t * freq * 4.0, 4.0) - 2.0) / 2.0 * 255)
		
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
