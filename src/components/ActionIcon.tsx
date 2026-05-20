import { AlignLeft, Pencil, ListPlus, Search } from "lucide-react";
import type { Action } from "../lib/types";

interface Props {
  action: Action;
  size?: number;
}

/** Map an `Action` to its lucide icon. Centralized so M5 settings can mirror. */
export function ActionIcon({ action, size = 14 }: Props) {
  switch (action) {
    case "summarize":
      return <AlignLeft size={size} aria-hidden="true" />;
    case "edit":
      return <Pencil size={size} aria-hidden="true" />;
    case "elaborate":
      return <ListPlus size={size} aria-hidden="true" />;
    case "research":
      return <Search size={size} aria-hidden="true" />;
  }
}
