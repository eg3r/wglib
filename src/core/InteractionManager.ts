import { CssCache } from "../helpers/CssHelper";
import { DragHandler } from "./DragHandler";
import GraphElement from "./GraphElement";
import { InteractionState } from "./InteractionState";
import { InteractionArgs, PointerInterface } from "./InteractionInterface";
import { Filter, filters, InteractionData, InteractionEvent } from "pixi.js";

export class InteractionManager {
   private dragHandler?: DragHandler;
   private interactionState = InteractionState.None;
   private hoverFilter!: Filter;
   private clickFilter?: Filter;
   public canDrag: boolean;
   private hoverCursor: string = "default";
   private clickCursor: string = "default";

   constructor(private parent: GraphElement, private interaction: PointerInterface) {
      const container = this.parent.getContainer();
      container.interactive = true;

      this.canDrag =
         typeof interaction.canDrag === "function"
            ? interaction.canDrag()
            : typeof interaction.canDrag === "boolean"
               ? interaction.canDrag
               : true;

      const vis = CssCache.getVisualProperties(this.parent.getCssClass() + ":active");

      if (vis) {
         this.clickFilter = new filters.AlphaFilter(vis.opacity || 0.5);
         this.clickCursor = vis?.cursor || "default";
      }

      if (this.canDrag) {
         this.dragHandler = new DragHandler(
            parent,
            (e) => this.dragStart(e),
            (e) => this.dragStop(e)
         );

         if (this.interaction.onDragging)
            this.dragHandler.onDragged((data?: InteractionData) => {
               if (this.interaction.onDragging)
                  this.interaction.onDragging(new InteractionArgs(this.parent, data));
            });
      } else {
         // NOTICE: Need DOWN and UP events if any click event is handled (handels visuals too)
         if (this.hasClickEvent()) {
            container.on("pointerdown", (e: InteractionEvent) => {
               const ev = new InteractionArgs(this.parent, e.data);
               this.handlePointerDown(ev);
               if (this.shouldPreventPropagation() || ev.shouldStopPropagation()) e?.stopPropagation();
            });
            container.on("pointerup", (e: InteractionEvent) => {
               const ev = new InteractionArgs(this.parent, e.data);
               this.handlePointerUp(ev);
               if (this.shouldPreventPropagation() || ev.shouldStopPropagation()) e?.stopPropagation();
            });
            container.on("pointerupoutside", (e: InteractionEvent) => {
               const ev = new InteractionArgs(this.parent, e.data);
               this.handlePointerUpOutside(ev);
               if (this.shouldPreventPropagation() || ev.shouldStopPropagation()) e?.stopPropagation();
            });
         }
      }

      this.createHoverFilterAndCursor();

      if (this.interaction.onPointerTap) {
         container.on("pointertap", (e: InteractionEvent) => {
            const ev = new InteractionArgs(this.parent);

            if (this.interaction.onPointerTap)
               this.interaction.onPointerTap(ev);

            if (this.shouldPreventPropagation() || ev.shouldStopPropagation()) e.stopPropagation();
         });
      }

      if (this.interaction.onRightClick)
         container.on("rightclick", (e: InteractionEvent) => {
            if (this.interaction.onRightClick) {
               const ev = new InteractionArgs(this.parent, e.data);
               this.interaction.onRightClick(ev);
               if (ev.shouldStopPropagation()) e.stopPropagation();
            }
         });
      if (this.interaction.onRightDown)
         container.on("rightdown", (e: InteractionEvent) => {
            if (this.interaction.onRightDown) {
               const ev = new InteractionArgs(this.parent, e.data);
               this.interaction.onRightDown(ev);
               if (ev.shouldStopPropagation()) e.stopPropagation();
            }
         });
      if (this.interaction.onRightUp)
         container.on("rightup", (e: InteractionEvent) => {
            if (this.interaction.onRightUp) {
               const ev = new InteractionArgs(this.parent, e.data);
               this.interaction.onRightUp(ev);
               if (ev.shouldStopPropagation()) e.stopPropagation();
            }
         });

      container.on("pointerover", (e: InteractionEvent) => {

         container.filters?.push(this.hoverFilter);
         if (this.interaction.onPointerOver) {
            const ev = new InteractionArgs(this.parent);
            this.interaction.onPointerOver(ev);
            if (ev.shouldStopPropagation()) e.stopPropagation();
         }
      });

      container.on("pointerout", (e: InteractionEvent) => {
         container.filters?.splice(container.filters.indexOf(this.hoverFilter), 1);
         if (this.interaction.onPointerOut) {
            const ev = new InteractionArgs(this.parent);
            this.interaction.onPointerOut(ev);
            if (ev.shouldStopPropagation()) e.stopPropagation();
         }

         // remove also click filter if out
         this.removeClickFilter();
      });
   }

   private shouldPreventPropagation(): boolean {
      return typeof this.interaction.preventPropagation === "function"
         ? this.interaction.preventPropagation()
         : typeof this.interaction.preventPropagation === "boolean"
            ? this.interaction.preventPropagation
            : false;
   }

   private handlePointerUp(e: InteractionArgs) {
      if (this.interaction.onPointerUp) {
         this.interaction.onPointerUp(e);
      }

      this.removeClickFilter();
   }

   private handlePointerUpOutside(e: InteractionArgs) {
      if (this.interaction.onPointerUpOutside) {
         this.interaction.onPointerUpOutside(e);
      }

      this.removeClickFilter();
   }

   private handlePointerDown(e: InteractionArgs) {
      if (this.interaction.onPointerDown) {
         this.interaction.onPointerDown(e);
      }

      if (!e.shouldStopPropagation()) this.applyClickFilter();
   }

   private hasClickEvent() {
      return (
         this.interaction.onPointerDown ||
         this.interaction.onPointerTap ||
         this.interaction.onRightClick ||
         this.interaction.onRightDown ||
         this.interaction.onRightUp ||
         this.interaction.canDrag
      );
   }

   private applyClickFilter() {
      if (this.clickFilter) {
         const container = this.parent.getContainer();
         if (!container.filters?.includes(this.clickFilter))
            container.filters?.push(this.clickFilter);
         this.parent.getContainer().cursor = this.clickCursor;
      }
   }

   private removeClickFilter() {
      const container = this.parent.getContainer();
      if (
         this.clickFilter &&
         container?.filters?.includes(this.clickFilter) &&
         this.interactionState !== InteractionState.Dragged
      ) {
         container?.filters.splice(container?.filters.indexOf(this.clickFilter), 1);
      }
      this.parent.getContainer().cursor = this.hoverCursor;
   }

   private createHoverFilterAndCursor(): void {
      const vis = CssCache.getVisualProperties(this.parent.getCssClass() + ":hover");
      this.hoverFilter = new filters.AlphaFilter(vis?.opacity || 1.2);
      this.hoverCursor = vis?.cursor || "default";
      this.parent.getContainer().cursor = this.hoverCursor;
   }

   private dragStart(e: InteractionArgs) {
      if (this.interaction.onDragStart) {
         this.interaction.onDragStart(e);
         if (e.shouldStopPropagation()) return;
      }

      // if (this.interaction.onPointerDown) {
      //    this.interaction.onPointerDown(e);
      // }

      this.interactionState = InteractionState.Dragged;
      this.handlePointerDown(e);
   }

   private dragStop(e: InteractionArgs) {
      if (this.interaction.onDragEnd) {
         this.interaction.onDragEnd(e);
         if (e.shouldStopPropagation()) return;
      }

      if (this.interaction.onPointerUp) {
         this.interaction.onPointerUp(e);
         if (e.shouldStopPropagation()) return;
      }

      this.interactionState = InteractionState.None;
      this.handlePointerUp(e);
   }

   public getInteractionState(): InteractionState {
      return this.interactionState;
   }

   // TODO: need also a cleanup, check if actually clean after removal of fn parent
   public addDraggingCallback(fn: (data?: InteractionData) => void): void {
      if (this.dragHandler) this.dragHandler.onDragged(fn);
   }
}
