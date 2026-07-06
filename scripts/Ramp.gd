class_name Ramp
extends Node2D

@export var entrance_path: NodePath
@export var exit_path: NodePath
@export var max_time_window: float = 1.5
@export var score_value: int = 500
@export var multiplier_increase: float = 1.0

var entrance_time: float = -1.0

func _ready():
	# Connect entrance and exit Area2D signals
	var entrance = get_node(entrance_path) as Area2D
	var exit = get_node(exit_path) as Area2D
	
	if entrance:
		entrance.body_entered.connect(_on_entrance_entered)
	if exit:
		exit.body_entered.connect(_on_exit_entered)

func _on_entrance_entered(body: Node2D):
	if body is RigidBody2D:
		entrance_time = Time.get_ticks_msec() / 1000.0
		print("Ramp: Ball entered entrance gate at time: ", entrance_time)

func _on_exit_entered(body: Node2D):
	if body is RigidBody2D:
		if entrance_time > 0.0:
			var current_time = Time.get_ticks_msec() / 1000.0
			var diff = current_time - entrance_time
			if diff <= max_time_window:
				# Decoupled signal emission (TDD §1.3 / Issue 2 & 4)
				Events.ramp_completed.emit(score_value)
				print("Ramp: Completed successfully in ", diff, "s!")
			else:
				print("Ramp: Too slow. Time taken: ", diff, "s (max: ", max_time_window, "s)")
			entrance_time = -1.0
