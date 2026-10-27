import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { Plugin } from "@opencode/plugin"

const notificationFor = (eventType: string): string | undefined => {
  if (eventType === "session.execution.succeeded") return "Agent finished"
  if (eventType === "session.error") return "Agent encountered an error"
  if (eventType === "form.created") return "Agent needs your input"
  if (eventType === "permission.asked" || eventType.endsWith(".permission.asked")) {
    return "Agent needs permission"
  }
  if (eventType === "question.asked" || eventType.endsWith(".question.asked")) {
    return "Agent has a question"
  }
}

const sendNotification = (message: string): void => {
  const child = spawn(
    "notify-send",
    ["--app-name=OpenCode", message],
    { stdio: "ignore" },
  )

  child.once("error", (error) => {
    console.error("Failed to start OpenCode notification:", error)
  })
  child.once("close", (code, signal) => {
    if (code !== 0) {
      console.error(
        `OpenCode notification exited with code ${code} (signal: ${signal ?? "none"})`,
      )
    }
  })
  child.unref()
}

export default Plugin.define({
  id: "finished-notification",

  setup(ctx) {
    // Global plugins are instantiated per location; subscribe only once.
    if (ctx.location.directory !== homedir()) return

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          const message = notificationFor(event.type)
          if (message) sendNotification(message)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("OpenCode notification event subscription failed:", error)
        }
      }
    })()

    return () => controller.abort()
  },
})
