import { useReducer } from "react";
import {
  generationReducer,
  initialGenerationState,
} from "@/hooks/generationReducer";

export function useGenerationLifecycle() {
  return useReducer(generationReducer, initialGenerationState);
}
