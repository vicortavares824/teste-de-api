import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/24/outline"

interface FeedbackMessageProps {
  message: string
}

export function FeedbackMessage({ message }: FeedbackMessageProps) {
  const isSuccess = message.includes("✅")
  const isWarning = message.includes("⚠️")

  return (
    <div
      className={`mb-6 p-4 rounded-md border flex items-center gap-3 animate-pulse ${
        isSuccess
          ? "bg-emerald-950 border-emerald-700 text-emerald-100"
          : isWarning
            ? "bg-amber-950 border-amber-700 text-amber-100"
            : "bg-red-950 border-red-700 text-red-100"
      }`}
    >
      {isSuccess ? (
        <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
      ) : isWarning ? (
        <ExclamationTriangleIcon className="w-6 h-6 flex-shrink-0" />
      ) : (
        <XCircleIcon className="w-6 h-6 flex-shrink-0" />
      )}
      <span className="font-medium">{message}</span>
    </div>
  )
}
