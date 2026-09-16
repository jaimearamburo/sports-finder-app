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
        // viewportClassName, not a className on the scrolled content
        // itself: the Viewport is the part that stays fixed in place while
        // its content scrolls inside it, so an effect like a mask-image
        // edge fade - meant to track the visible window, not the total
        // scrollable content - has to live here to stay pinned to the
        // visible edge as the content scrolls underneath it.
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
      // group/scrollbar + plain :hover (not data-hovering) - data-hovering
      // is present whenever the pointer is anywhere over the scroll area,
      // not just this element; :hover only matches while the pointer is
      // actually over this thin strip itself. The Thumb reads it off this
      // ancestor via group-hover. Thumb is flex-1, so growing this
      // element's own cross-axis size on hover grows the thumb along with
      // it; no separate size rule needed on the Thumb itself.
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
