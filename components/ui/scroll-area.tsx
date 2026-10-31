"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"
import { cn } from "cn"

function ScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props & { viewportClassName?: string }) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        // viewportClassName styles the Viewport, which stays fixed while
        // content scrolls, so effects like an edge fade track the visible
        // window.
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      // group/scrollbar with :hover, not data-hovering (set anywhere over the
      // scroll area), so only hovering this strip grows it. The Thumb is flex-1
      // and grows with it.
      className={cn(
        "group/scrollbar flex touch-none p-px transition-[height,width,colors] duration-200 select-none data-horizontal:h-1.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent hover:data-horizontal:h-2.5 data-vertical:h-full data-vertical:w-1.5 data-vertical:border-l data-vertical:border-l-transparent hover:data-vertical:w-2.5",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border transition-colors duration-150 group-hover/scrollbar:bg-[color-mix(in_oklch,var(--border),var(--muted-foreground))]"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
