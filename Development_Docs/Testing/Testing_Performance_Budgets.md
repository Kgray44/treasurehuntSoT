# Testing Performance Budgets

These are target budgets, not claimed current performance and never permission to reduce correctness: plan generation under 10 seconds; focused static under 60 seconds; impacted unit/component under 3 minutes; impacted integration under 8 minutes; focused browser family under 10 minutes; subsystem closure under 25 minutes; full local release under 60 minutes; distributed CI release under 30 minutes when sufficient workers exist.

Every receipt records queue, setup, execution, teardown, total wall, CPU, and retry time. Historical durations identify slow-suite owners and regressions; queue time is not hidden inside execution duration. A suite over budget triggers investigation, resource/fixture/selection improvement, or an explicit exception—not test weakening or reduced coverage. Existing repository documentation contains historical durations but no normalized current duration store; Phase 1 establishes the data model before enforcement.
