# Lessons Learned

## WeChat to Blog Publishing

- **Autonomous Execution**: When a specialized skill like `wechat-to-blog` exists, the user expects a zero-friction, one-command result. 
- **Avoid Over-Planning**: Do not create and request approval for an `implementation_plan.md` for routine, well-defined skill workflows. The skill itself *is* the plan.
- **Grouped Commands**: Use the `auto_publish.py` master script in a single `run_command` with `SafeToAutoRun: true` when possible.
- **Commit/Push Automation**: Automatically handle the build, commit, and push in the same task stream without pausing for unnecessary checkpoints.
- **Slug Discipline**: Always follow the `SKILL.md` instruction for **short English slugs**, even if a script's default behavior (like `auto_publish.py`) generates pinyin. Correct this silently before presenting the result.

## Workflow Orchestration

- **Friction vs. Precision**: If a task is a routine operation of a "utility" skill, reduce precision in favor of speed and autonomy.
- **Tool Approvals**: Minimize the number of separate `run_command` calls for the same logical operation to reduce the "Approve" burden on the user.
