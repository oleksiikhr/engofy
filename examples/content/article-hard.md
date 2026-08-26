# The Night the Server Room Flooded

"If the backup generator doesn't kick in within ninety seconds, we're finished," Priya muttered, half to herself, half to the intern hovering by the door. I'd been putting off the maintenance check for weeks — partly out of laziness, partly because I'd convinced myself nothing would ever go wrong on my watch. That illusion fell apart at 11:47 p.m., when the sprinkler system above rack 12 went off without warning and started dumping water onto $2.3 million worth of hardware. We scrambled to shut off the mains, dragged three servers onto a dry cart, and somehow managed to keep the core database limping along on a single, badly overheating node.

By the time the fire marshal showed up — visibly unimpressed that we'd tried to *handle it ourselves* instead of calling it in right away — we'd already lost about forty minutes of transaction logs, which meant hours of painstaking reconciliation the next morning. Looking back, I still can't quite believe we pulled it off; if Priya hadn't kept her head and talked the rest of us through it step by step, the whole thing would've gone up in smoke, figuratively if not literally.

The postmortem wasn't pretty. Half the room wanted to point fingers, and the other half just wanted to go home and sleep it off. Our manager, to her credit, refused to let anyone throw anyone else under the bus — she said the real failure was a maintenance schedule nobody had actually signed off on, not any one person dropping the ball. It took the better part of a month to iron out a new on-call rotation that people could actually live with, and even longer to convince finance to sign off on a proper backup-power overhaul instead of the twenty-year-old generator we'd been limping along with.

Three things I'd tell my past self, in no particular order:
1. **Don't** assume "someone else is probably on top of it" — chase it down yourself.
2. A `cron` job that silently fails is worse than no job at all; make it page someone.
3. When in doubt, [read the incident runbook](https://example.com/runbook) *before* you need it, not while the room is filling up with water.

Honestly? I still flinch a little every time it rains.
