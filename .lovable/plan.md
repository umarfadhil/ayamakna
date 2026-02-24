

# Fix Graph Zoom Issues (Mobile Pinch + Double-Click Focus)

## Problem 1: Mobile Pinch Zoom Doesn't Follow Gesture Center

**Root cause**: The current code disables D3's built-in zoom (`on('wheel.zoom', null)`) and replaces it with a custom wheel handler. But D3's built-in zoom already handles both wheel AND touch/pinch gestures correctly. By disabling it and only adding a `wheel` listener, pinch-to-zoom on mobile is broken entirely.

The custom wheel handler also captures `w` and `h` once at mount, so they go stale on resize.

**Fix**: Remove the custom wheel handler entirely. Instead, use D3's built-in zoom behavior which natively supports:
- Mouse wheel zoom centered on cursor
- Touch pinch-to-zoom centered on pinch midpoint
- Pan via drag (mouse and touch)

The only adaptation needed is to offset the coordinate system since we render with center = (w/2, h/2). We do this by adjusting the zoom's `translateExtent` or by wrapping the transform in the render loop.

## Problem 2: Double-Click Doesn't Center on Node

**Root cause**: The current double-click handler calculates:
```
translate(-node.x * currentK, -node.y * currentK).scale(currentK)
```
This positions the node at the origin of the transform, but the canvas render adds `w/2, h/2` offset. The math is actually correct for centering -- but it doesn't zoom in, which makes it feel broken. Also, the transition may conflict with the custom zoom handler.

**Fix**: Compute the transform properly and zoom in slightly (e.g. scale to 2x or clamp to at least 1.5x) so the double-click feels like a "focus" action.

## Changes

### `src/components/graph/ForceGraph.tsx`

**Zoom setup (lines ~247-285)**: Replace the entire zoom+custom wheel block:
- Use D3 zoom with default wheel and touch handling (do NOT disable `wheel.zoom`)
- The center-offset is already handled in the render loop (`ctx.translate(t.x + w/2, t.y + h/2)`)
- D3 zoom naturally zooms toward cursor/pinch center because it tracks pointer position
- Remove the stale `w`/`h` captures

**Double-click handler (lines ~305-320)**: Fix the transform calculation:
- Zoom to a target scale (e.g. `Math.max(currentK, 2.0)`)
- Translate so the node is at screen center: `translate(-node.x * newK, -node.y * newK)`
- Use smooth animated transition (already has `duration(600)`)

### `src/test/linguisticService.test.ts` (lines 54-61)

Add missing `pos` property to all test token objects to fix the pre-existing build errors (unrelated but blocking).

## Summary (Bullet Diff)

- **Remove** custom `wheel.customZoom` handler -- use D3's native zoom (supports wheel + pinch)
- **Keep** D3 zoom's default `wheel.zoom` instead of nullifying it
- **Fix** double-click: zoom to `max(currentK, 2.0)` and center with `translate(-node.x * newK, -node.y * newK)`
- **Fix** test file: add `pos: 'VERB'` (or similar) to 7 test token objects

