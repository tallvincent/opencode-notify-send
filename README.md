# OpenCode agent notifications

Local OpenCode V2 TypeScript plugin that sends desktop notifications for
completed agent executions, permission requests, and questions/forms waiting
for user input.

The plugin is discovered globally from `~/.config/opencode/plugins/`. It uses
OpenCode's built-in `@opencode/plugin` API and requires `notify-send` on the
OpenCode server's `PATH`.
