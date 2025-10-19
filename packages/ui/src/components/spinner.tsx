import type { IconProps } from '@tabler/icons-react'
import { cn } from '@repo/ui/lib/utils'
import { IconLoader2 } from '@tabler/icons-react'

function Spinner({ className, ...props }: IconProps) {
  return (
    <IconLoader2
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
