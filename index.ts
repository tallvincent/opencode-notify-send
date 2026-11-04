import { spawn } from "node:child_process"
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

const waitToRetry = (delay: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }

    let timeout: ReturnType<typeof setTimeout>
    const finish = () => {
      clearTimeout(timeout)
      signal.removeEventListener("abort", finish)
      resolve()
    }

    timeout = setTimeout(finish, delay)
    signal.addEventListener("abort", finish, { once: true })
    if (signal.aborted) finish()
  })

export default Plugin.define({
  id: "finished-notification",

  setup(ctx) {
    const controller = new AbortController()
    void (async () => {
      let retryDelay = 1000

      while (!controller.signal.aborted) {
        try {
          for await (const event of ctx.event.subscribe({
            signal: controller.signal,
          })) {
            retryDelay = 1000

            // Each location has its own plugin lifecycle, while the event
            // stream is server-wide. Handle only events for this location.
            if (event.location?.directory !== ctx.location.directory) continue

            const message = notificationFor(event.type)
            if (message) sendNotification(message)
          }

          if (!controller.signal.aborted) {
            console.error("OpenCode notification event subscription ended; reconnecting")
          }
        } catch (error) {
          if (controller.signal.aborted) break
          console.error("OpenCode notification event subscription failed:", error)
        }

        if (controller.signal.aborted) break
        await waitToRetry(retryDelay, controller.signal)
        retryDelay = Math.min(retryDelay * 2, 30_000)
      }
    })()

    return () => controller.abort()
  },
})
