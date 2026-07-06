extends CanvasLayer

signal play_pressed()

@onready var leaderboard_list: Label = $LeaderboardList
@onready var play_button: Button = $PlayButton

func _ready():
	play_button.pressed.connect(_on_play_pressed)
	update_leaderboard_display()

func update_leaderboard_display():
	var entries = ScoreManager.leaderboard_entries
	var list_text = ""
	
	for i in range(entries.size()):
		var entry = entries[i]
		# Formatted string with pad spacings for clean columns
		var place = str(i + 1) + "."
		var initials = str(entry["initials"]).to_upper()
		var score_val = str(entry["score"])
		list_text += "%-4s %-8s %s\n" % [place, initials, score_val]
		
	leaderboard_list.text = list_text

func _on_play_pressed():
	play_pressed.emit()
