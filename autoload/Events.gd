extends Node

signal ball_impact(impact_velocity: float)
signal bumper_hit(score: int)
signal slingshot_hit(score: int)
signal rollover_triggered(score: int)
signal ramp_completed(score: int)
signal nudge_triggered(tilt_count: int)
signal tilt_triggered()
signal tilt_recovered()
