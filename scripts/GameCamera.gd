extends Camera2D

@export var decay_rate: float = 1.0       # How fast trauma decays (1.0 means full decay in 1s)
@export var max_offset: Vector2 = Vector2(50.0, 50.0) # Max horizontal/vertical shake offset
@export var max_roll: float = 0.1         # Max rotation angle in radians

var trauma: float = 0.0
var time_passed: float = 0.0
var noise: FastNoiseLite = FastNoiseLite.new()

func _ready():
	# Configure noise generator for organic simplex camera shakes
	noise.seed = randi()
	noise.noise_type = FastNoiseLite.TYPE_SIMPLEX
	noise.frequency = 0.1
	
	# Lock properties as specified in TDD §3.2
	position_smoothing_enabled = false
	drag_horizontal_enabled = false
	drag_vertical_enabled = false
	zoom = Vector2(0.5, 0.5)
	position = Vector2(1000, 1500)

func add_trauma(amount: float):
	# Add trauma (clamped between 0.0 and 1.0)
	trauma = clamp(trauma + amount, 0.0, 1.0)

func _process(delta: float):
	if trauma > 0.0:
		# Decay trauma linearly over time
		trauma = max(trauma - decay_rate * delta, 0.0)
		_shake(delta)
	else:
		# Reset to rest state when trauma is zero
		offset = Vector2.ZERO
		rotation = 0.0

func _shake(delta: float):
	time_passed += delta * 100.0 # scale time for noise lookup speed
	var shake_strength = trauma * trauma # non-linear trauma^2 scaling for nicer feel
	
	# Apply organic shakes to offset and rotation
	rotation = max_roll * shake_strength * noise.get_noise_1d(time_passed)
	offset.x = max_offset.x * shake_strength * noise.get_noise_2d(0, time_passed)
	offset.y = max_offset.y * shake_strength * noise.get_noise_2d(50, time_passed)
