extends Node

signal ball_impact(velocity: float, position: Vector2)
signal bumper_hit(score_value: int, position: Vector2)
signal slingshot_hit(score_value: int, position: Vector2)
signal rollover_triggered(score_value: int, position: Vector2)
signal ramp_completed(score_value: int, multiplier_increase: float, position: Vector2)
signal nudge_triggered(tilt_count: int)
signal tilt_triggered()
signal tilt_recovered()
signal flipper_activated(is_right: bool, position: Vector2)
signal ball_saved()
signal wall_hit(velocity: float, position: Vector2)
