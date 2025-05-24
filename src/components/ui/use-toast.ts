// This file exports a toast function using sonner
import { toast as sonnerToast } from "sonner"

type ToastProps = {
	title?: string
	description?: string
	variant?: "default" | "destructive"
	duration?: number
}

export const toast = ({
	title,
	description,
	variant = "default",
	duration = 3000,
	...props
}: ToastProps) => {
	return sonnerToast(title, {
		description,
		duration,
		className: variant === "destructive" ? "destructive" : "",
		...props
	})
}
