# Shared memory, now in the repo so it crosses machines

**Moved here 2026-08-18.** Memory used to live only at
`~/.claude/projects/<project>/memory/`, outside the repo, so git never carried it.
Sessions on this machine shared it; **sessions on another machine had a completely
separate set**. That broke the one assumption the per-client channel split rests
on, which is that memory is the layer every session sees.

The real files live here. The path Claude Code expects is a symlink to this
directory, so tooling is unchanged and git now tracks every lesson.

## Setting this up on a new machine

Clone the repo, then once:

```bash
M=~/.claude/projects/-Users-<user>-Documents-Rexos/memory
mv "$M" "$M.pre-repo-backup"        # only if it already exists
ln -s "$(pwd)/docs/memory" "$M"
```

Check it worked by reading `MEMORY.md` through the symlinked path, and by
writing a file there and confirming it appears in `git status`.

## What this changes in practice

Lessons now arrive by `git pull` like everything else, and they show up in diffs,
which makes them reviewable. A lesson written on one machine reaches the other
the next time someone pulls.

**One consequence to expect: memory files can now conflict.** Two sessions writing
the same lesson on different machines will collide in git rather than silently
diverging. That is the better failure, but check `MEMORY.md` before filing a
lesson, per the convention in `AGENTS.md`.
