import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border border-gray-200 px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:border-gray-800 dark:focus:ring-gray-500",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gray-900 text-gray-50 shadow hover:bg-gray-900/80 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-100/80",
        secondary:
          "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80 dark:bg-gray-800 dark:text-gray-50 dark:hover:bg-gray-800/80",
        destructive:
          "border-transparent bg-red-600 text-white shadow hover:bg-red-600/80 dark:bg-red-500 dark:hover:bg-red-500/80",
        outline: "text-gray-950 dark:text-gray-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
