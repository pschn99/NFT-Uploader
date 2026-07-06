extends CanvasLayer

signal initials_confirmed(initials: String)

@onready var score_label: Label = $ScoreLabel
@onready var char1: Label = $CharContainer/Char1
@onready var char2: Label = $CharContainer/Char2
@onready var char3: Label = $CharContainer/Char3
@onready var indicator1: Label = $IndicatorContainer/Ind1
@onready var indicator2: Label = $IndicatorContainer/Ind2
@onready var indicator3: Label = $IndicatorContainer/Ind3

var characters: Array = []
var active_char_indices: Array[int] = [0, 0, 0] # A, A, A
var cursor_index: int = 0
var current_entry_score: int = 0

func _ready():
	# Populate characters A to Z
	for i in range(26):
		characters.append(char(65 + i))
		
	update_char_displays()
	update_indicators()

func set_score(score: int):
	current_entry_score = score
	score_label.text = "SCORE: %d" % score
	active_char_indices = [0, 0, 0]
	cursor_index = 0
	update_char_displays()
	update_indicators()

func _unhandled_input(event: InputEvent):
	if not visible:
		return
		
	# Cycle cursor left/right
	if event.is_action_pressed("ui_left"):
		cursor_index = (cursor_index - 1 + 3) % 3
		update_indicators()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		cursor_index = (cursor_index + 1) % 3
		update_indicators()
		get_viewport().set_input_as_handled()
	# Cycle characters up/down
	elif event.is_action_pressed("ui_up"):
		active_char_indices[cursor_index] = (active_char_indices[cursor_index] - 1 + 26) % 26
		update_char_displays()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		active_char_indices[cursor_index] = (active_char_indices[cursor_index] + 1) % 26
		update_char_displays()
		get_viewport().set_input_as_handled()
	# Confirm initials
	elif event.is_action_pressed("ui_accept"):
		var initials = characters[active_char_indices[0]] + characters[active_char_indices[1]] + characters[active_char_indices[2]]
		initials_confirmed.emit(initials)
		get_viewport().set_input_as_handled()

func update_char_displays():
	char1.text = characters[active_char_indices[0]]
	char2.text = characters[active_char_indices[1]]
	char3.text = characters[active_char_indices[2]]

func update_indicators():
	indicator1.text = "^" if cursor_index == 0 else " "
	indicator2.text = "^" if cursor_index == 1 else " "
	indicator3.text = "^" if cursor_index == 2 else " "
