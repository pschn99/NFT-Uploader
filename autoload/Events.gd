extends Node

signal ball_impact(velocity: float)
signal bumper_hit(score_value: int)
signal slingshot_hit(score_value: int)
signal rollover_triggered(score_value: int)
signal ramp_completed(score_value: int)
signal nudge_triggered(tilt_count: int)
signal tilt_triggered()
signal tilt_recovered()
signal flipper_activated(is_right: bool)
