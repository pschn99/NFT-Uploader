extends Node

@onready var start_menu: CanvasLayer = $StartMenu
@onready var initials_entry: CanvasLayer = $InitialsEntry

const GAME_SESSION_SCENE: PackedScene = preload("res://scenes/GameSession.tscn")
var active_session: Node = null
var latest_game_score: int = 0

func _ready():
	start_menu.play_pressed.connect(_on_play_pressed)
	initials_entry.initials_confirmed.connect(_on_initials_confirmed)
	
	start_menu.visible = true
	initials_entry.visible = false
	print("Main: Application loaded.")

func _on_play_pressed():
	print("Main: Starting game session...")
	start_menu.visible = false
	
	# Instantiate GameSession
	active_session = GAME_SESSION_SCENE.instantiate()
	add_child(active_session)
	active_session.start_game()
	
	# Connect to session completion events
	active_session.game_completed.connect(_on_game_completed)
	
	# Initialize ScoreManager session values
	ScoreManager.reset_session()

func _on_game_completed(final_score: int):
	print("Main: Game session finished. Final score: ", final_score)
	latest_game_score = final_score
	
	# Remove active game session node from tree
	if active_session != null:
		active_session.queue_free()
		active_session = null
		
	# Check if final score qualifies for top 5 leaderboard
	if ScoreManager.is_high_score(final_score):
		print("Main: High score achieved!")
		initials_entry.set_score(final_score)
		initials_entry.visible = true
	else:
		# Return to start menu directly
		_return_to_menu()

func _on_initials_confirmed(initials: String):
	print("Main: High score initials: ", initials)
	ScoreManager.add_high_score(initials, latest_game_score)
	initials_entry.visible = false
	_return_to_menu()

func _return_to_menu():
	# Update leaderboard table displays
	start_menu.update_leaderboard_display()
	start_menu.visible = true
